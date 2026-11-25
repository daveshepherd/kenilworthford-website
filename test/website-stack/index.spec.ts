import { join } from 'path';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { configScript, WebsiteStack } from '../../src/website-stack';

const siteDirectory = join(__dirname, '..', 'fixtures', 'site');

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
