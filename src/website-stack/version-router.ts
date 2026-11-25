/**
 * The CloudFront Function code that serves a release's folder at the site
 * root, so /chart.html is fetched from /<version>/chart.html.
 *
 * - Paths that already start with a version folder, such as the hashed
 *   assets at /2.1.0/assets/app.1a2b.js, are passed through unchanged, so a
 *   page keeps loading its own release's assets after a switch.
 * - A path ending in / is served its index.html.
 * - ?version=x.y.z serves that release instead, to preview a release that
 *   isn't active, or one that was, without deploying.
 *
 * CloudFront caches by the rewritten path, so switching the active version
 * needs no invalidation: the new version's paths are new cache keys.
 */
export function versionRouterCode(activeVersion: string) {
  return `var ACTIVE_VERSION = ${JSON.stringify(activeVersion)};
var VERSION = /^\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z.-]+)?$/;
var VERSIONED_PATH = /^\\/\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z.-]+)?\\//;

function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (VERSIONED_PATH.test(uri)) {
    return request;
  }
  var version = ACTIVE_VERSION;
  var preview = request.querystring.version;
  if (preview && VERSION.test(preview.value)) {
    version = preview.value;
  }
  if (uri.charAt(uri.length - 1) === '/') {
    uri += 'index.html';
  }
  request.uri = '/' + version + uri;
  return request;
}`;
}
