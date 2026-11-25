import { join } from 'path';
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  Function,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  HttpVersion,
  PriceClass,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import {
  BucketDeployment,
  CacheControl,
  ISource,
  Source,
} from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { versionRouterCode } from './version-router';

export interface WebsiteStackProps extends StackProps {
  /** The release to upload and make active, such as 2.1.0. */
  version: string;
  /** The site build output, which holds a folder per version (dist/site). */
  siteDirectory: string;
  /** The river-levels API the release's config.js points the site at. */
  apiEndpoint: string;
}

/**
 * The release's config.js, which the pages load before their scripts. It's
 * written at deploy time, so the same build can be deployed to every stage.
 */
export function configScript(apiEndpoint: string): string {
  return `window.__runtime_configuration = ${JSON.stringify({ apiEndpoint }, null, 2)};\n`;
}

/** How long browsers and CloudFront cache each kind of file. */
export const CACHE_CONTROL = {
  // Hashed file names, so a file's content never changes
  assets: [
    CacheControl.setPublic(),
    CacheControl.maxAge(Duration.days(365)),
    CacheControl.fromString('immutable'),
  ],
  // Must be fetched every time, so a new release's service worker and
  // manifest are picked up straight away
  noCache: [CacheControl.noCache()],
  pages: [CacheControl.setPublic(), CacheControl.maxAge(Duration.minutes(5))],
};

/**
 * The website: a private bucket holding a folder per release, and a
 * CloudFront distribution whose version router serves the active release.
 *
 * Each deploy uploads its release's folder alongside the earlier ones, then
 * points the router at it. Earlier releases stay in the bucket, so they can be
 * previewed with ?version=x.y.z, and rolled back to by redeploying them.
 */
export class WebsiteStack extends Stack {
  public readonly bucket: Bucket;
  public readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props: WebsiteStackProps) {
    super(scope, id, props);
    const { version } = props;

    this.bucket = new Bucket(this, 'site-bucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // Holds every release, which rollbacks and previews depend on
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const releaseDirectory = join(props.siteDirectory, version);
    const release = Source.asset(releaseDirectory);
    const config = Source.data('config.js', configScript(props.apiEndpoint));

    // s3 sync sets one Cache-Control (and Content-Type) per deployment, so
    // there's a deployment for each kind of file. They never prune, and keep
    // their files if replaced, so earlier releases stay in the bucket.
    const deploy = (
      deploymentId: string,
      options: {
        sources: ISource[];
        cacheControl: CacheControl[];
        include?: string[];
        exclude?: string[];
        contentType?: string;
      },
    ) =>
      new BucketDeployment(this, deploymentId, {
        ...options,
        destinationBucket: this.bucket,
        destinationKeyPrefix: `${version}/`,
        prune: false,
        retainOnDelete: true,
      });
    const deployments = [
      deploy('deploy-assets', {
        sources: [release],
        cacheControl: CACHE_CONTROL.assets,
        exclude: ['*'],
        include: ['assets/*'],
      }),
      deploy('deploy-service-worker', {
        sources: [release],
        cacheControl: CACHE_CONTROL.noCache,
        exclude: ['*'],
        include: ['sw.js'],
      }),
      deploy('deploy-manifest', {
        sources: [release],
        cacheControl: CACHE_CONTROL.noCache,
        contentType: 'application/manifest+json',
        exclude: ['*'],
        include: ['manifest.webmanifest'],
      }),
      deploy('deploy-pages', {
        sources: [release, config],
        cacheControl: CACHE_CONTROL.pages,
        exclude: ['assets/*', 'sw.js', 'manifest.webmanifest'],
      }),
    ];

    const versionRouter = new Function(this, 'version-router', {
      code: FunctionCode.fromInline(versionRouterCode(version)),
      comment: `Serves release ${version} at the site root`,
      runtime: FunctionRuntime.JS_2_0,
    });
    // Only switch to the release once all of it is in the bucket
    for (const deployment of deployments) {
      versionRouter.node.addDependency(deployment);
    }

    this.distribution = new Distribution(this, 'distribution', {
      comment: 'kenilworthford.com website',
      defaultBehavior: {
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
        // Honours each file's Cache-Control
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        functionAssociations: [
          {
            eventType: FunctionEventType.VIEWER_REQUEST,
            function: versionRouter,
          },
        ],
        origin: S3BucketOrigin.withOriginAccessControl(this.bucket),
        responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      httpVersion: HttpVersion.HTTP2_AND_3,
      // North America and Europe, which covers a UK site's visitors
      priceClass: PriceClass.PRICE_CLASS_100,
    });

    new CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
    });
    new CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
    });
    new CfnOutput(this, 'BucketName', { value: this.bucket.bucketName });
    new CfnOutput(this, 'Version', { value: version });
  }
}
