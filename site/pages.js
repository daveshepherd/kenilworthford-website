const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const TITLE = 'Is Kenilworth ford flooded?';

const PAGES = [
  { filename: 'index.html', chunks: ['app', 'pwa', 'css', 'runtime', 'vendors'] },
  { filename: 'about.html', chunks: ['pwa', 'css', 'runtime'] },
  { filename: 'chart.html', chunks: ['chart', 'pwa', 'css', 'runtime', 'vendors'] },
  { filename: 'offline.html', chunks: ['pwa', 'css', 'runtime'], title: `Offline - ${TITLE}` },
];

/**
 * The plugins that emit the site's pages, web app manifest and icons, shared
 * by the production and development builds.
 */
module.exports = function pagePlugins({ publicPath, titleSuffix = '' }) {
  return [
    new CopyPlugin({
      patterns: [
        { from: './src/images/icon-192.png', to: 'assets/icon-192.png' },
        { from: './src/images/icon-512.png', to: 'assets/icon-512.png' },
      ],
    }),
    new HtmlWebpackPlugin({
      inject: false,
      template: './src/manifest.webmanifest',
      filename: 'manifest.webmanifest',
      minify: false,
      templateParameters: { publicPath },
    }),
    ...PAGES.map((page) => new HtmlWebpackPlugin({
      chunks: page.chunks,
      filename: page.filename,
      template: `./src/${page.filename}`,
      title: `${page.title ?? TITLE}${titleSuffix}`,
    })),
  ];
};
