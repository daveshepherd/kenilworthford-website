import { NodePackageManager } from 'projen/lib/javascript';
import { CdkTypeScriptApp } from 'projen-modules';

const project = new CdkTypeScriptApp({
  cdkVersion: '2.272.0',
  codeOwners: ['daveshepherd'],
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

project
  .tryFindObjectFile('test/tsconfig.json')
  ?.addOverride('compilerOptions.isolatedModules', true);

project.synth();
