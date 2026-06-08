const { fromIni } = require('@aws-sdk/credential-providers');
const CompressionPlugin = require('compression-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const WorkboxPlugin = require('workbox-webpack-plugin');
const { merge } = require('webpack-merge');
const path = require('path');

const common = require('./webpack.common.js');

const packageJson = require(`${process.cwd()}${path.sep}package.json`);

module.exports = merge(common, {
  mode: 'production',
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: './src/images/icon-192.png', to: `${packageJson.version}/assets/icon-192.png` },
        { from: './src/images/icon-512.png', to: `${packageJson.version}/assets/icon-512.png` },
      ],
    }),
    new HtmlWebpackPlugin({
      inject: false,
      template: './src/manifest.webmanifest',
      filename: 'manifest.webmanifest',
      minify: false,
      templateParameters: {
        version: packageJson.version,
      },
    }),
    new HtmlWebpackPlugin({
      chunks: ['app', 'pwa', 'css', 'runtime', 'vendors'],
      filename: 'index.html',
      template: './src/index.html',
      title: 'Is Kenilworth ford flooded?',
    }),
    new HtmlWebpackPlugin({
      chunks: ['pwa', 'css', 'runtime'],
      filename: 'about.html',
      template: './src/about.html',
      title: 'Is Kenilworth ford flooded?',
    }),
    new HtmlWebpackPlugin({
      chunks: ['chart', 'pwa', 'css', 'runtime', 'vendors'],
      filename: 'chart.html',
      template: './src/chart.html',
      title: 'Is Kenilworth ford flooded?',
    }),
    new HtmlWebpackPlugin({
      chunks: ['pwa', 'css', 'runtime'],
      filename: 'offline.html',
      template: './src/offline.html',
      title: 'Offline - Is Kenilworth ford flooded?',
    }),
    // Gzip compression for smaller file transfers
    new CompressionPlugin({
      algorithm: 'gzip',
      test: /\.(js|css|html|svg)$/,
      threshold: 8192,
      minRatio: 0.8,
    }),
    new WorkboxPlugin.GenerateSW({
      swDest: 'sw.js',
      clientsClaim: true,
      skipWaiting: true,
      navigateFallback: '/offline.html',
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
