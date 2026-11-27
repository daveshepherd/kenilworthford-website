import { readFileSync } from 'fs';
import { join } from 'path';
import { App } from 'aws-cdk-lib';
import { Annotations, Match, Template } from 'aws-cdk-lib/assertions';
import { configScript, WebsiteStack } from '../../src/website-stack';
import { CertificateStack } from '../../src/website-stack/certificate-stack';

const siteDirectory = join(__dirname, '..', 'fixtures', 'site');
// The app's context, from cdk.json, which test apps don't read
const { context } = JSON.parse(readFileSync(join(__dirname, '..', '..', 'cdk.json'), 'utf-8'));

function synth(version = '1.2.3') {
  const stack = new WebsiteStack(new App(), 'test', {
    apiEndpoint: 'https://api.example.com',
    env: { region: 'eu-west-2' },
    siteDirectory,
    version,
  });
  return Template.fromStack(stack);
}

describe('WebsiteStack', () => {
  const template = synth();
  const resources = template.toJSON().Resources as Record<string, any>;
  const deployments = Object.entries(resources).filter(
    ([, resource]) => resource.Type === 'Custom::CDKBucketDeployment',
  );
  const deploymentFor = (id: string) => {
    const match = deployments.find(([logicalId]) => logicalId.startsWith(id));
    if (!match) throw new Error(`No deployment ${id}`);
    return match[1].Properties;
  };

  test('that the bucket is private and kept if the stack is deleted', () => {
    template.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Retain',
      Properties: Match.objectLike({
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      }),
    });
  });

  test('that only the distribution can read the bucket', () => {
    template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 's3:GetObject',
            Effect: 'Allow',
            Principal: { Service: 'cloudfront.amazonaws.com' },
            Condition: Match.objectLike({ StringEquals: Match.anyValue() }),
          }),
        ]),
      },
    });
  });

  test('that every deployment uploads into the version folder and keeps earlier releases', () => {
    expect(deployments).toHaveLength(4);
    for (const [, { Properties }] of deployments) {
      expect(Properties).toMatchObject({
        DestinationBucketKeyPrefix: '1.2.3/',
        Prune: false,
        RetainOnDelete: true,
      });
    }
  });

  test('that hashed assets are cached for a year', () => {
    expect(deploymentFor('deployassets')).toMatchObject({
      Include: ['assets/*'],
      Exclude: ['*'],
      SystemMetadata: { 'cache-control': 'public, max-age=31536000, immutable' },
    });
  });

  test('that the service worker and manifest are never cached', () => {
    expect(deploymentFor('deployserviceworker')).toMatchObject({
      Include: ['sw.js'],
      SystemMetadata: { 'cache-control': 'no-cache' },
    });
    expect(deploymentFor('deploymanifest')).toMatchObject({
      Include: ['manifest.webmanifest'],
      SystemMetadata: {
        'cache-control': 'no-cache',
        'content-type': 'application/manifest+json',
      },
    });
  });

  test('that pages and config.js are cached for 5 minutes, without the other files', () => {
    const pages = deploymentFor('deploypages');
    expect(pages).toMatchObject({
      Exclude: ['assets/*', 'sw.js', 'manifest.webmanifest'],
      SystemMetadata: { 'cache-control': 'public, max-age=300' },
    });
    expect(pages.Include).toBeUndefined();
    // The release, and config.js
    expect(pages.SourceObjectKeys).toHaveLength(2);
  });

  test('that the version router serves the release', () => {
    template.hasResourceProperties('AWS::CloudFront::Function', {
      FunctionCode: Match.stringLikeRegexp('var ACTIVE_VERSION = "1\\.2\\.3";'),
      FunctionConfig: Match.objectLike({ Runtime: 'cloudfront-js-2.0' }),
    });
  });

  test('that the router only switches once the whole release is uploaded', () => {
    const [, router] = Object.entries(resources).find(
      ([, resource]) => resource.Type === 'AWS::CloudFront::Function',
    )!;
    const deploymentIds = deployments.map(([logicalId]) => logicalId);
    // Each deployment's custom resource, or the construct that holds it
    for (const id of deploymentIds) {
      expect(router.DependsOn).toEqual(
        expect.arrayContaining([expect.stringMatching(id.replace(/[0-9A-F]{8}$/, ''))]),
      );
    }
  });

  test('that the distribution routes every request through the version router over HTTPS', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          Compress: true,
          FunctionAssociations: [
            Match.objectLike({ EventType: 'viewer-request' }),
          ],
          ViewerProtocolPolicy: 'redirect-to-https',
        }),
        HttpVersion: 'http2and3',
        PriceClass: 'PriceClass_100',
      }),
    });
  });

  test('that the smoke test can find the distribution and release', () => {
    template.hasOutput('Version', { Value: '1.2.3' });
    template.hasOutput('DistributionDomainName', Match.anyValue());
  });

  test('that a version without a build fails', () => {
    expect(() => synth('9.9.9')).toThrow();
  });
});

describe('WebsiteStack with a domain', () => {
  const app = new App({ context });
  const certificateStack = new CertificateStack(app, 'certificate', {
    crossRegionReferences: true,
    domainName: 'dev.example.com',
    env: { region: 'us-east-1' },
  });
  const stack = new WebsiteStack(app, 'website', {
    apiEndpoint: 'https://api.example.com',
    crossRegionReferences: true,
    domain: { name: 'dev.example.com', certificate: certificateStack.certificate },
    env: { region: 'eu-west-2' },
    siteDirectory,
    version: '1.2.3',
  });
  const template = Template.fromStack(stack);

  test('that the certificate is in us-east-1 and validated by DNS', () => {
    Template.fromStack(certificateStack).hasResourceProperties(
      'AWS::CertificateManager::Certificate',
      { DomainName: 'dev.example.com', ValidationMethod: 'DNS' },
    );
  });

  test('that the distribution serves the domain over SNI with the certificate', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Aliases: ['dev.example.com'],
        ViewerCertificate: Match.objectLike({
          // Read from the certificate stack's output, without custom resources
          AcmCertificateArn: {
            'Fn::GetStackOutput': Match.objectLike({ StackName: 'certificate', Region: 'us-east-1' }),
          },
          SslSupportMethod: 'sni-only',
        }),
      }),
    });
    template.hasOutput('SiteDomain', { Value: 'dev.example.com' });
  });

  test('that a certificate outside us-east-1 fails', () => {
    expect(
      () => new CertificateStack(new App(), 'certificate', {
        domainName: 'dev.example.com',
        env: { region: 'eu-west-2' },
      }),
    ).toThrow('us-east-1');
  });
});

describe('WebsiteStack with a domain still on another distribution', () => {
  const app = new App({ context });
  const certificateStack = new CertificateStack(app, 'certificate', {
    crossRegionReferences: true,
    domainName: 'example.com',
    env: { region: 'us-east-1' },
  });
  const stack = new WebsiteStack(app, 'website', {
    apiEndpoint: 'https://api.example.com',
    crossRegionReferences: true,
    domain: {
      name: 'example.com',
      certificate: certificateStack.certificate,
      pendingMove: true,
    },
    env: { region: 'eu-west-2' },
    siteDirectory,
    version: '1.2.3',
  });
  const template = Template.fromStack(stack);

  test('that the distribution has the certificate, ready for associate-alias, but not the domain', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Aliases: Match.absent(),
        ViewerCertificate: Match.objectLike({
          AcmCertificateArn: Match.anyValue(),
          SslSupportMethod: 'sni-only',
        }),
      }),
    });
    expect(template.findOutputs('SiteDomain')).toEqual({});
  });

  test('that the missing domain is expected, not warned about', () => {
    Annotations.fromStack(stack).hasNoWarning('*', Match.anyValue());
  });
});

describe('WebsiteStack without a domain', () => {
  test('that the distribution is only on its CloudFront domain', () => {
    const template = synth();
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({ Aliases: Match.absent() }),
    });
    expect(template.findOutputs('SiteDomain')).toEqual({});
  });
});

describe('configScript', () => {
  test('that it sets the API endpoint the site reads', () => {
    const window: { __runtime_configuration?: { apiEndpoint: string } } = {};
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function('window', configScript('https://api.example.com'))(window);
    expect(window.__runtime_configuration).toEqual({
      apiEndpoint: 'https://api.example.com',
    });
  });
});
