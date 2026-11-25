import { readFile } from 'fs/promises';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { extname, join, normalize, sep } from 'path';
import { configScript } from '../../src/website-stack';
import { versionRouterCode } from '../../src/website-stack/version-router';

/**
 * Serves the site build as CloudFront does: each request goes through the
 * real version router code, and files get the Cache-Control the deploy sets.
 * config.js points the site at canned API responses, served here too, so the
 * tests don't depend on the river-levels API.
 */

type Request = { uri: string; querystring: Record<string, { value: string }> };
type Handler = (event: { request: Request }) => Request;

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

/** The Cache-Control the deploy sets on each file (see src/website-stack). */
function cacheControl(path: string): string {
  if (/^\/[^/]+\/assets\//.test(path)) return 'public, max-age=31536000, immutable';
  if (/\/(sw\.js|manifest\.webmanifest)$/.test(path)) return 'no-cache';
  return 'public, max-age=300';
}

export const API_RESPONSES: Record<string, unknown> = {
  '/api/status': {
    depth: 0.66,
    direction: 'falling',
    rate: 'none',
    state: 'clear',
    lastUpdate: new Date().toISOString(),
  },
  '/api/chart': [
    [Date.now() - 3600000, 0.7],
    [Date.now(), 0.66],
  ],
};

export interface SiteServer {
  url: string;
  close(): Promise<void>;
}

export async function startSiteServer(options: {
  bucketDirectory: string;
  version: string;
}): Promise<SiteServer> {
  const { bucketDirectory, version } = options;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const router: Handler = new Function(`${versionRouterCode(version)}\nreturn handler;`)();
  let config = '';

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const api = API_RESPONSES[url.pathname];
    if (api) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(api));
      return;
    }

    const querystring = Object.fromEntries(
      [...url.searchParams].map(([key, value]) => [key, { value }]),
    );
    const path = router({ request: { uri: url.pathname, querystring } }).uri;
    const headers = {
      'content-type': CONTENT_TYPES[extname(path)] ?? 'application/octet-stream',
      'cache-control': cacheControl(path),
    };
    // The deploy writes config.js into the release, so the build doesn't have it
    if (path === `/${version}/config.js`) {
      res.writeHead(200, headers);
      res.end(config);
      return;
    }
    const file = normalize(join(bucketDirectory, path));
    if (!file.startsWith(join(bucketDirectory, sep))) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, headers);
      res.end(body);
    } catch {
      // A private S3 bucket returns 403 for missing objects
      res.writeHead(403).end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  // Service workers need a secure context, which loopback addresses are
  const url = `http://127.0.0.1:${port}`;
  config = configScript(`${url}/api`);

  return {
    url,
    close: () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
