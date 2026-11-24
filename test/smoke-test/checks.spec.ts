import { runSmokeTest, versionedUrls } from '../../src/smoke-test/checks';

const VERSION = '2.1.0';
const HOME = `<html><link href="/${VERSION}/assets/app.css" rel="stylesheet">
<script src="/${VERSION}/assets/app.js"></script>
<script src="config.js"></script><a href="chart.html">Chart</a></html>`;

type Route = { status?: number; body?: string; headers?: Record<string, string> };

/** A healthy deployment of VERSION, with overrides per path. */
function site(overrides: Record<string, Route> = {}) {
  const routes: Record<string, Route> = {
    '/': { body: HOME },
    '/index.html': { body: HOME },
    '/about.html': { body: `<script src="/${VERSION}/assets/pwa.js"></script>` },
    '/chart.html': { body: `<script src="/${VERSION}/assets/chart.js"></script>` },
    '/offline.html': { body: `<link href="/${VERSION}/assets/app.css">` },
    [`/?version=${VERSION}`]: { body: HOME },
    [`/${VERSION}/assets/app.css`]: {},
    [`/${VERSION}/assets/app.js`]: {},
    '/config.js': {
      body: 'window.__runtime_configuration = {"apiEndpoint": "https://api.example.com"};',
    },
    '/sw.js': { headers: { 'cache-control': 'no-cache' } },
    '/manifest.webmanifest': {
      body: `{"icons":[{"src":"/${VERSION}/assets/icon-192.png"}]}`,
      headers: { 'content-type': 'application/manifest+json' },
    },
    ...overrides,
  };
  const requested: string[] = [];
  const fetch = jest.fn(async (url: URL) => {
    const path = url.pathname + url.search;
    requested.push(path);
    const route = routes[path] ?? { status: 404 };
    return new Response(route.body ?? '', {
      status: route.status ?? 200,
      headers: route.headers,
    });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, requested };
}

const options = (fetch: typeof globalThis.fetch) => ({
  apiEndpoint: 'https://api.example.com',
  baseUrl: 'https://d111111abcdef8.cloudfront.net',
  fetch,
  intervalMs: 1,
  timeoutMs: 50,
  version: VERSION,
});

describe('versionedUrls', () => {
  test('that it finds each same-site file of the release once', () => {
    expect(versionedUrls(`${HOME}<script src="/${VERSION}/assets/app.js"></script>`, VERSION))
      .toEqual([`/${VERSION}/assets/app.css`, `/${VERSION}/assets/app.js`]);
  });

  test('that it reads the unquoted attributes of a minified page', () => {
    const minified = `<link rel=icon href=/${VERSION}/assets/i.png><script defer src=/${VERSION}/assets/app.js></script><script src=config.js></script><a href='/${VERSION}/x.html'>`;
    expect(versionedUrls(minified, VERSION)).toEqual([
      `/${VERSION}/assets/i.png`,
      `/${VERSION}/assets/app.js`,
      `/${VERSION}/x.html`,
    ]);
  });

  test('that other releases and relative or external URLs are ignored', () => {
    expect(
      versionedUrls('<script src="/2.0.0/assets/a.js"></script><a href="https://x.com/2.1.0/">', VERSION),
    ).toEqual([]);
  });
});

describe('runSmokeTest', () => {
  test('that a healthy release passes and every referenced file is fetched', async () => {
    const { fetch, requested } = site();
    await expect(runSmokeTest(options(fetch))).resolves.toEqual([]);
    expect(requested).toEqual(
      expect.arrayContaining([`/${VERSION}/assets/app.css`, `/${VERSION}/assets/app.js`]),
    );
  });

  test('that it waits for CloudFront to serve the new release', async () => {
    let calls = 0;
    const healthy = site().fetch;
    const fetch = (async (url: URL) => {
      if (url.pathname === '/' && !url.search && calls++ < 2) {
        return new Response('<script src="/2.0.0/assets/app.js"></script>');
      }
      return healthy(url);
    }) as typeof globalThis.fetch;
    await expect(runSmokeTest(options(fetch))).resolves.toEqual([]);
    expect(calls).toBe(3);
  });

  test('that it fails if the release never becomes active', async () => {
    const { fetch } = site({ '/': { body: '<script src="/2.0.0/assets/app.js"></script>' } });
    await expect(runSmokeTest(options(fetch))).resolves.toEqual([
      `/ didn't serve release ${VERSION} within 0.05s`,
    ]);
  });

  test.each<[string, Record<string, Route>, string]>([
    ['a missing asset', { [`/${VERSION}/assets/app.js`]: { status: 403 } }, `/${VERSION}/assets/app.js returned 403`],
    ['a page from another release', { '/chart.html': { body: '/2.0.0/' } }, `/chart.html doesn't reference release ${VERSION}`],
    ['a broken preview', { [`/?version=${VERSION}`]: { status: 404 } }, `/?version=${VERSION} returned 404`],
    ['config.js for another stage', { '/config.js': { body: '"https://api.other.com"' } }, '/config.js doesn\'t point at https://api.example.com'],
    ['a cached service worker', { '/sw.js': { headers: { 'cache-control': 'max-age=300' } } }, '/sw.js has Cache-Control "max-age=300", expected no-cache'],
    ['a manifest served as binary', { '/manifest.webmanifest': { body: '', headers: { 'content-type': 'binary/octet-stream' } } }, '/manifest.webmanifest has Content-Type "binary/octet-stream"'],
  ])('that it reports %s', async (_, overrides, failure) => {
    const { fetch } = site(overrides);
    await expect(runSmokeTest(options(fetch))).resolves.toEqual([failure]);
  });
});
