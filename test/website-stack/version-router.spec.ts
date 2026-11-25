import { versionRouterCode } from '../../src/website-stack/version-router';

type Request = {
  uri: string;
  querystring: Record<string, { value: string }>;
};
type Handler = (event: { request: Request }) => Request;

/** Loads the generated CloudFront Function code as a callable handler. */
function loadHandler(version: string): Handler {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(`${versionRouterCode(version)}\nreturn handler;`)();
}

describe('versionRouterCode', () => {
  const handler = loadHandler('2.1.0');
  const route = (uri: string, querystring: Request['querystring'] = {}) =>
    handler({ request: { uri, querystring } }).uri;

  test.each([
    ['/', '/2.1.0/index.html'],
    ['/index.html', '/2.1.0/index.html'],
    ['/chart.html', '/2.1.0/chart.html'],
    ['/config.js', '/2.1.0/config.js'],
    ['/sw.js', '/2.1.0/sw.js'],
    ['/workbox-316db014.js', '/2.1.0/workbox-316db014.js'],
    ['/manifest.webmanifest', '/2.1.0/manifest.webmanifest'],
    ['/folder/', '/2.1.0/folder/index.html'],
  ])('that %s is served from %s', (uri, expected) => {
    expect(route(uri)).toBe(expected);
  });

  test.each([
    '/2.1.0/assets/app.1a2b.js',
    // An earlier release's assets, which a page loaded before a switch still uses
    '/2.0.9/assets/app.3c4d.js',
    '/2.2.0-rc.1/index.html',
  ])('that the versioned path %s is passed through', (uri) => {
    expect(route(uri)).toBe(uri);
  });

  test('that ?version= previews another release', () => {
    expect(route('/', { version: { value: '2.0.9' } })).toBe('/2.0.9/index.html');
    expect(route('/chart.html', { version: { value: '2.2.0-rc.1' } })).toBe(
      '/2.2.0-rc.1/chart.html',
    );
  });

  test.each(['latest', '../secret', '2.0', '2.0.9/../x'])(
    'that ?version=%s is ignored',
    (value) => {
      expect(route('/', { version: { value } })).toBe('/2.1.0/index.html');
    },
  );

  test('that paths that only look versioned are routed', () => {
    expect(route('/2.1.0')).toBe('/2.1.0/2.1.0');
    expect(route('/v2.1.0/index.html')).toBe('/2.1.0/v2.1.0/index.html');
  });
});
