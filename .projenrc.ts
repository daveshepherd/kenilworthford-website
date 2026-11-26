import { NodePackageManager } from 'projen/lib/javascript';
import { CdkTypeScriptApp } from 'projen-modules';

const project = new CdkTypeScriptApp({
  cdkVersion: '2.272.0',
  codeOwners: ['daveshepherd'],
  context: {
    // The website stack reads the certificate from the us-east-1 stack as a
    // stack output, without the custom resources a strong reference adds.
    // ACM won't delete a certificate CloudFront is using anyway.
    '@aws-cdk/core:defaultCrossStackReferences': 'weak',
  },
  copyrightOwner: 'Dave Shepherd',
  deployments: [
    {
      environment: 'development',
      region: 'eu-west-2',
      env: { STAGE: 'development' },
    },
    {
      environment: 'production',
      region: 'eu-west-2',
      env: { STAGE: 'production' },
    },
  ],
  description: 'The kenilworthford.com website, and the AWS infrastructure that serves it',
  // Bundled into the site by webpack
  deps: ['highcharts'],
  devDeps: [
    '@babel/core',
    '@babel/preset-env',
    '@playwright/test',
    'babel-loader',
    'copy-webpack-plugin',
    'core-js',
    'css-loader',
    'html-webpack-plugin',
    'mini-css-extract-plugin',
    'projen-modules',
    'style-loader',
    'webpack',
    'webpack-cli',
    'webpack-dev-server',
    'webpack-merge',
    'workbox-webpack-plugin',
  ],
  gitignore: ['/dist/site-dev/'],
  license: 'MIT',
  // Releases before the move to CDK were 1.x, deployed from a laptop
  majorVersion: 2,
  name: 'kenilworthford-website',
  packageManager: NodePackageManager.YARN_CLASSIC,
  projenrcTs: true,
  readme: {
    description: `The [kenilworthford.com](https://kenilworthford.com) website, which shows whether the Kenilworth ford is flooded, using river levels from the [river-levels](https://github.com/daveshepherd/river-levels) API.

The site is built with webpack from [\`site/\`](site). The CDK app in [\`src/\`](src) uploads each release to its own folder in S3, \`/<version>/\`, and CloudFront serves the active release at the site root.

See [docs/infrastructure.md](docs/infrastructure.md) for the architecture, releases, testing and rollback.`,
  },
  release: true,
  // Sole maintainer, who can't approve their own pull requests: the queue
  // merges these authors' PRs without an approval. Everyone else needs one.
  trustedAuthors: ['daveshepherd'],
  workflowPackageCache: true,
});

// The site is built before the CDK app is synthesized, into the release
// artifact (dist/), so the deploy jobs upload exactly what was built and
// tested. The release task bumps package.json first, so the build gets the
// release's version.
const siteBuild = project.addTask('site:build', {
  description: 'Build the website into dist/site/<version>/',
  exec: 'webpack --config site/webpack.prod.js',
});
project.preCompileTask.spawn(siteBuild);
project.addTask('site:serve', {
  description: 'Serve the website locally, with canned API responses',
  exec: 'webpack serve --config site/webpack.dev.js',
});

// Deploy, then check the site CloudFront serves is the release just deployed.
// A failed check fails the deploy job, so a broken development deploy stops
// the release before production.
const smokeTest = project.addTask('smoke-test', {
  description: 'Check the deployed site serves this release (needs a deploy first)',
  exec: 'ts-node --project tsconfig.json src/smoke-test/run.ts',
});
project.cdkTasks.deploy.reset();
project.cdkTasks.deploy.execArgs(
  ['cdk', 'deploy', '--all', '--outputs-file', 'cdk.out/deploy-outputs.json'],
  { receiveArgs: true },
);
project.cdkTasks.deploy.spawn(smokeTest);

// Browser tests of the site build, served as CloudFront serves it. They catch
// what only a browser shows, such as the service worker breaking navigation.
const browserTest = project.addTask('test:browser', {
  description: 'Test the site build in a browser (needs site:build first)',
  steps: [
    { exec: 'playwright install chromium' },
    { exec: 'playwright test --config test/browser/playwright.config.ts' },
  ],
});
project.testTask.spawn(browserTest);

const testTsconfig = project.tryFindObjectFile('test/tsconfig.json');
testTsconfig?.addOverride('compilerOptions.isolatedModules', true);
// The browser tests run code in the page, and Playwright's types use the DOM's
testTsconfig?.addOverride('compilerOptions.lib', ['es2022', 'dom']);

project.synth();
