import { existsSync } from 'fs';
import { join } from 'path';
import { App, Tags } from 'aws-cdk-lib';
import { apiEndpoint, resolveStage, siteDomain } from './stage';
import { resolveVersion } from './version';
import { WebsiteStack } from './website-stack';
import { CertificateStack } from './website-stack/certificate-stack';

const app = new App();
const stage = resolveStage();
const version = resolveVersion();

// Built by the site:build task, which the build runs before synthesizing
const siteDirectory = join('dist', 'site');
if (!existsSync(join(siteDirectory, version, 'index.html'))) {
  throw new Error(
    `No site build for version ${version} in ${siteDirectory}/${version}. Run "npx projen site:build" first.`,
  );
}

// CloudFront only uses certificates in us-east-1, so a stage with a domain
// has a certificate stack there, which the website stack reads across regions
const domainName = siteDomain(stage);
const certificateStack = domainName
  ? new CertificateStack(app, 'KenilworthfordWebsiteCertificate', {
    crossRegionReferences: true,
    domainName,
    env: { region: 'us-east-1' },
  })
  : undefined;

new WebsiteStack(app, 'KenilworthfordWebsite', {
  apiEndpoint: apiEndpoint(stage),
  crossRegionReferences: !!certificateStack,
  domain: domainName && certificateStack
    ? { name: domainName, certificate: certificateStack.certificate }
    : undefined,
  env: { region: 'eu-west-2' },
  siteDirectory,
  version,
});

Tags.of(app).add('endor:ManagedBy', 'cdk');
Tags.of(app).add('endor:Stage', stage);
Tags.of(app).add('endor:Version', version);

app.synth();
