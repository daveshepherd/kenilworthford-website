import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { resolveVersion } from '../src/version';

function project(files: { releaseTag?: string; packageVersion?: string }) {
  const dir = mkdtempSync(join(tmpdir(), 'version-'));
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ version: files.packageVersion ?? '0.0.0' }),
  );
  if (files.releaseTag !== undefined) {
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist', 'releasetag.txt'), files.releaseTag);
  }
  return dir;
}

describe('resolveVersion', () => {
  test('that the release tag is used, without its v', () => {
    expect(resolveVersion(project({ releaseTag: 'v2.3.4\n' }), {})).toBe('2.3.4');
  });

  test('that package.json is used outside a release', () => {
    expect(resolveVersion(project({ packageVersion: '0.0.0' }), {})).toBe('0.0.0');
  });

  test('that VERSION overrides the release tag', () => {
    expect(
      resolveVersion(project({ releaseTag: 'v2.3.4' }), { VERSION: '2.3.5-rc.1' }),
    ).toBe('2.3.5-rc.1');
  });

  test.each(['latest', '2.3', '../2.3.4', 'v2.3.4/x'])('that %s is rejected', (version) => {
    expect(() => resolveVersion(project({}), { VERSION: version })).toThrow(
      'Invalid version',
    );
  });
});
