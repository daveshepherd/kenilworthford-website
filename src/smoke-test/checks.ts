/**
 * Checks that a deployed site serves a release correctly. The deploy task
 * runs them after cdk deploy (see run.ts), so a deploy that leaves the site
 * broken fails, and development failing stops the release before production.
 */

export interface SmokeTestOptions {
  /** The site's origin, such as https://d111111abcdef8.cloudfront.net */
  baseUrl: string;
  /** The release that should be active */
  version: string;
  /** The API endpoint the release's config.js should contain */
  apiEndpoint: string;
  /**
   * How long to wait for CloudFront to serve the release, as a new version
   * router can take a few minutes to reach every edge location
   * @default 5 minutes
   */
  timeoutMs?: number;
  /** @default 10 seconds */
  intervalMs?: number;
  fetch?: typeof fetch;
  log?: (message: string) => void;
}

/**
 * The src and href URLs in a page, whether their attribute values are quoted
 * or not, as the minified pages leave most of them unquoted.
 */
export function referencedUrls(html: string): string[] {
  return [
    ...html.matchAll(/\s(?:src|href)=(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g),
  ].map(([, doubleQuoted, singleQuoted, unquoted]) =>
    doubleQuoted ?? singleQuoted ?? unquoted,
  );
}

/** The unique same-site URLs under /<version>/ that a page references. */
export function versionedUrls(html: string, version: string): string[] {
  return [
    ...new Set(
      referencedUrls(html).filter((url) => url.startsWith(`/${version}/`)),
    ),
  ];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs the checks and returns a description of each failure, or an empty
 * array if they all pass.
 */
export async function runSmokeTest(options: SmokeTestOptions): Promise<string[]> {
  const {
    baseUrl,
    version,
    apiEndpoint,
    timeoutMs = 5 * 60 * 1000,
    intervalMs = 10 * 1000,
    log = () => {},
  } = options;
  const doFetch = options.fetch ?? fetch;
  const failures: string[] = [];
  const get = (path: string) => doFetch(new URL(path, baseUrl), { redirect: 'manual' });

  // The release is active once the home page references its assets
  const deadline = Date.now() + timeoutMs;
  let home: string | undefined;
  for (;;) {
    try {
      const response = await get('/');
      const body = await response.text();
      if (response.status === 200 && body.includes(`/${version}/`)) {
        home = body;
        break;
      }
      log(`Waiting for / to serve ${version} (status ${response.status})`);
    } catch (error) {
      log(`Waiting for / to serve ${version} (${(error as Error).message})`);
    }
    if (Date.now() + intervalMs > deadline) {
      return [`/ didn't serve release ${version} within ${timeoutMs / 1000}s`];
    }
    await sleep(intervalMs);
  }
  log(`/ serves ${version}`);

  const expect = async (
    path: string,
    check: (response: Response, body: string) => string | undefined,
  ) => {
    try {
      const response = await get(path);
      const body = await response.text();
      const problem =
        response.status === 200
          ? check(response, body)
          : `returned ${response.status}`;
      if (problem) {
        failures.push(`${path} ${problem}`);
      } else {
        log(`${path} OK`);
      }
    } catch (error) {
      failures.push(`${path} failed: ${(error as Error).message}`);
    }
  };
  const servesRelease = (_: Response, body: string) =>
    body.includes(`/${version}/`) ? undefined : `doesn't reference release ${version}`;

  const assets = versionedUrls(home, version);
  if (assets.length === 0) {
    failures.push(`/ references no files under /${version}/`);
  }
  for (const asset of assets) {
    await expect(asset, () => undefined);
  }
  for (const page of ['/index.html', '/about.html', '/chart.html', '/offline.html']) {
    await expect(page, servesRelease);
  }
  await expect(`/?version=${version}`, servesRelease);
  await expect('/config.js', (_, body) =>
    body.includes(JSON.stringify(apiEndpoint))
      ? undefined
      : `doesn't point at ${apiEndpoint}`,
  );
  await expect('/sw.js', (response) =>
    response.headers.get('cache-control')?.includes('no-cache')
      ? undefined
      : `has Cache-Control "${response.headers.get('cache-control')}", expected no-cache`,
  );
  await expect('/manifest.webmanifest', (response, body) => {
    if (!response.headers.get('content-type')?.includes('application/manifest+json')) {
      return `has Content-Type "${response.headers.get('content-type')}"`;
    }
    return body.includes(`/${version}/assets/icon-192.png`)
      ? undefined
      : `doesn't reference release ${version}'s icons`;
  });

  return failures;
}
