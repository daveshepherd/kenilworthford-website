const { fromIni } = require('@aws-sdk/credential-providers');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { merge } = require('webpack-merge');
const path = require('path');

const common = require('./webpack.common.js');

const packageJson = require(`${process.cwd()}${path.sep}package.json`);

module.exports = merge(common, {
  mode: 'development',
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 8080,
    open: true,
    hot: true,
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {from: './src/test-api', to: 'api'},
        {from: './src/test-api/config.js', to: ''},
        {from: './src/images/icon-192.png', to: `${packageJson.version}/assets/icon-192.png`},
        {from: './src/images/icon-512.png', to: `${packageJson.version}/assets/icon-512.png`},
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
      title: 'Is Kenilworth ford flooded? (DEV)',
    }),
    new HtmlWebpackPlugin({
      chunks: ['pwa', 'css', 'runtime'],
      filename: 'about.html',
      template: './src/about.html',
      title: 'Is Kenilworth ford flooded? (DEV)',
    }),
    new HtmlWebpackPlugin({
      chunks: ['chart', 'pwa', 'css', 'runtime', 'vendors'],
      filename: 'chart.html',
      template: './src/chart.html',
      title: 'Is Kenilworth ford flooded? (DEV)',
    }),
    new HtmlWebpackPlugin({
      chunks: ['pwa', 'css', 'runtime'],
      filename: 'offline.html',
      template: './src/offline.html',
      title: 'Offline - Is Kenilworth ford flooded? (DEV)',
    }),
  ],
});
