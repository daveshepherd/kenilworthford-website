import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** Semver, such as 2.1.0 or 2.1.0-rc.1, as site/version.js accepts. */
export const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

/**
 * The version of the site to deploy, which names its folder in the bucket.
 *
 * In order: the VERSION environment variable; the release tag that the
 * release job writes to dist/releasetag.txt (without its leading "v"), which
 * the deploy jobs download with the build; or package.json's version, 0.0.0
 * outside a release. site/version.js resolves the same version for the build.
 */
export function resolveVersion(
  rootDir: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): string {
  let version = env.VERSION?.trim();
  const releaseTag = join(rootDir, 'dist', 'releasetag.txt');
  if (!version && existsSync(releaseTag)) {
    version = readFileSync(releaseTag, 'utf-8').trim().replace(/^v/, '');
  }
  if (!version) {
    version = JSON.parse(
      readFileSync(join(rootDir, 'package.json'), 'utf-8'),
    ).version as string;
  }
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`Invalid version "${version}": expected semver, such as 1.2.3`);
  }
  return version;
}
