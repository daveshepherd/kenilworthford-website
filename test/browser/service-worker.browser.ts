import { join } from 'path';
import { expect, Page, test } from '@playwright/test';
import { SiteServer, startSiteServer } from './site-server';
import { resolveVersion } from '../../src/version';

/**
 * Runs the site build in a real browser, served as CloudFront serves it, to
 * check what only a browser can: that once the service worker takes over,
 * pages still load, and that it shows the offline page only when it has to.
 */

const version = resolveVersion();
// dist/site/ holds the release folders, as the bucket does
const bucketDirectory = join(__dirname, '..', '..', 'dist', 'site');
const PAGES = ['/', '/about.html', '/chart.html'];

let site: SiteServer;
test.beforeAll(async () => {
  site = await startSiteServer({ bucketDirectory, version });
});
test.afterAll(async () => site?.close());

test.beforeEach(async ({ context }) => {
  // Keep the tests to this server, without analytics or other third parties
  await context.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, (route) => route.abort());
});

/** Loads the site and waits until the service worker controls the page. */
async function installServiceWorker(page: Page) {
  await page.goto(`${site.url}/`);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      );
    }
  });
}

const isOfflinePage = (page: Page) => page.getByRole('heading', { name: 'Offline' });

test('that the home page shows the ford\'s status from the API', async ({ page }) => {
  await page.goto(`${site.url}/`);
  await expect(page.locator('#fordStatus')).not.toHaveText('Loading...');
});

test('that every page loads once the service worker controls it', async ({ page }) => {
  await installServiceWorker(page);
  for (const path of PAGES) {
    await page.goto(`${site.url}${path}`);
    await expect(page).toHaveURL(`${site.url}${path}`);
    await expect(page.getByRole('heading', { name: /Is Kenilworth ford flooded/ })).toBeVisible();
    await expect(isOfflinePage(page)).toHaveCount(0);
  }
});

test('that a page visited before going offline still loads', async ({ page, context }) => {
  await installServiceWorker(page);
  await page.goto(`${site.url}/about.html`);
  await context.setOffline(true);
  await page.goto(`${site.url}/about.html`);
  await expect(page).toHaveTitle(/About/);
  await expect(isOfflinePage(page)).toHaveCount(0);
});

test('that a page not visited before going offline shows the offline page', async ({ page, context }) => {
  await installServiceWorker(page);
  await context.setOffline(true);
  await page.goto(`${site.url}/chart.html`);
  await expect(isOfflinePage(page)).toBeVisible();
});
