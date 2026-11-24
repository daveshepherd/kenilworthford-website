const path = require('path');
const WorkboxPlugin = require('workbox-webpack-plugin');
const { merge } = require('webpack-merge');

const common = require('./webpack.common.js');
const pagePlugins = require('./pages.js');
const version = require('./version');

// Each release is built into its own folder, dist/site/<version>/, and every
// URL in it is absolute under /<version>/. The CDK app uploads dist/site/ to
// the bucket as is, and the CloudFront version router serves the active
// release's folder at the site root. CloudFront compresses responses, so
// nothing is pre-compressed here.
const publicPath = `/${version}/`;

module.exports = merge(common({
  outputPath: path.resolve(__dirname, '../dist/site', version),
  publicPath,
}), {
  mode: 'production',
  plugins: [
    ...pagePlugins({ publicPath }),
    new WorkboxPlugin.GenerateSW({
      swDest: 'sw.js',
      clientsClaim: true,
      skipWaiting: true,
      // Must be a precached URL, which are all under /<version>/
      navigateFallback: `${publicPath}offline.html`,
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      runtimeCaching: [
        {
          urlPattern: ({ request }) => request.destination === 'document',
          handler: 'NetworkFirst',
          options: {
            cacheName: 'pages',
            networkTimeoutSeconds: 4,
          },
        },
        {
          urlPattern: ({ request }) =>
            request.destination === 'style' ||
            request.destination === 'script' ||
            request.destination === 'worker',
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'static-resources',
          },
        },
        {
          urlPattern: ({ request }) => request.destination === 'image',
          handler: 'CacheFirst',
          options: {
            cacheName: 'images',
            expiration: {
              maxEntries: 60,
              maxAgeSeconds: 30 * 24 * 60 * 60,
            },
          },
        },
        {
          urlPattern: ({ url }) => url.pathname.endsWith('/status'),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-status',
            networkTimeoutSeconds: 4,
            expiration: {
              maxEntries: 20,
              maxAgeSeconds: 10 * 60,
            },
          },
        },
      ],
    }),
  ],
  optimization: {
    // Additional production optimizations
    minimize: true,
    concatenateModules: true,
  },
});
