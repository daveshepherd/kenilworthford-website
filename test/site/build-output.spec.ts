import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { referencedUrls } from '../../src/smoke-test/checks';
import { resolveVersion } from '../../src/version';

/**
 * Checks the site build that the release uploads: that every file a page,
 * the manifest or the service worker refers to is in the release's folder,
 * and that nothing refers to another release's.
 *
 * The build runs site:build before the tests, so dist/site/<version>/ is
 * there in CI. Running jest on its own skips these until you build the site.
 */
const version = resolveVersion();
const releaseDir = join(__dirname, '..', '..', 'dist', 'site', version);
const built = existsSync(releaseDir);
if (!built && process.env.CI) {
  throw new Error(`No site build in ${releaseDir}; site:build must run before the tests`);
}

const read = (file: string) => readFileSync(join(releaseDir, file), 'utf-8');
const exists = (url: string) => existsSync(join(releaseDir, url.slice(`/${version}/`.length)));
const PAGES = ['index.html', 'about.html', 'chart.html', 'offline.html'];

(built ? describe : describe.skip)(`site build ${version}`, () => {
  test('that every page is built', () => {
    for (const page of PAGES) {
      expect(existsSync(join(releaseDir, page))).toBe(true);
    }
  });

  test.each(PAGES)('that every file %s refers to is in the release', (page) => {
    const urls = referencedUrls(read(page));
    const versioned = urls.filter((url) => url.startsWith(`/${version}/`));
    expect(versioned.length).toBeGreaterThan(0);
    expect(versioned.filter((url) => !exists(url))).toEqual([]);
  });

  test.each([...PAGES, 'manifest.webmanifest', 'sw.js'])(
    'that %s refers to no other release',
    (file) => {
      const versions = [...read(file).matchAll(/["'(=]\/(\d+\.\d+\.\d+[^/"']*)\//g)].map(
        ([, v]) => v,
      );
      expect(versions.filter((v) => v !== version)).toEqual([]);
    },
  );

  test('that the pages that call the API load config.js, which the deploy writes', () => {
    expect(referencedUrls(read('index.html'))).toContain('config.js');
    expect(referencedUrls(read('chart.html'))).toContain('config.js');
  });

  test('that the manifest\'s icons are in the release', () => {
    const manifest = JSON.parse(read('manifest.webmanifest'));
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      expect(exists(icon.src)).toBe(true);
    }
  });

  test('that everything the service worker precaches is in the release', () => {
    const sw = read('sw.js');
    const precached = [...sw.matchAll(/url:"([^"]+)"/g)].map(([, url]) => url);
    expect(precached).toContain(`/${version}/offline.html`);
    expect(precached.filter((url) => !exists(url))).toEqual([]);
  });

  test('that the service worker only shows the offline page when the network fails', () => {
    const sw = read('sw.js');
    // A fallback for pages that can't be fetched or found in the cache
    expect(sw).toContain(`PrecacheFallbackPlugin({fallbackURL:"/${version}/offline.html"})`);
    // Not navigateFallback, which serves the offline page for every navigation
    expect(sw).not.toContain('NavigationRoute');
  });

  test('that the Workbox runtime the service worker imports is in the release', () => {
    // GenerateSW loads it as an AMD module: define(["./workbox-<hash>"], ...)
    const imports = [...read('sw.js').matchAll(/define\(\["\.\/(workbox-[^"]+)"/g)].map(
      ([, module]) => `${module}.js`,
    );
    expect(imports.length).toBeGreaterThan(0);
    const files = readdirSync(releaseDir);
    expect(imports.filter((file) => !files.includes(file))).toEqual([]);
  });
});
