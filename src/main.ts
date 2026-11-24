import { existsSync } from 'fs';
import { join } from 'path';
import { App, Tags } from 'aws-cdk-lib';
import { apiEndpoint, resolveStage } from './stage';
import { resolveVersion } from './version';
import { WebsiteStack } from './website-stack';

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

new WebsiteStack(app, 'KenilworthfordWebsite', {
  apiEndpoint: apiEndpoint(stage),
  env: { region: 'eu-west-2' },
  siteDirectory,
  version,
});

Tags.of(app).add('endor:ManagedBy', 'cdk');
Tags.of(app).add('endor:Stage', stage);
Tags.of(app).add('endor:Version', version);

app.synth();
