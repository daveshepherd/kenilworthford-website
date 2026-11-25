// The version the site is built as. It names the release's folder in the
// bucket (/<version>/) and is what the CloudFront version router serves.
//
// projen's release task bumps package.json before building, so release builds
// get the new semver version. Local builds get package.json's 0.0.0 unless
// VERSION is set.
const packageJson = require('../package.json');

const version = process.env.VERSION || packageJson.version;

if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid version "${version}": expected semver, such as 1.2.3`);
}

module.exports = version;
