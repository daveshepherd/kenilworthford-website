const { fromIni } = require('@aws-sdk/credential-providers');
const CompressionPlugin = require('compression-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { merge } = require('webpack-merge');
const path = require('path');

const common = require('./webpack.common.js');

const packageJson = require(`${process.cwd()}${path.sep}package.json`);

module.exports = merge(common, {
  mode: 'production',
  plugins: [
    new HtmlWebpackPlugin({
      chunks: ['app', 'css', 'runtime', 'vendors'],
      filename: 'index.html',
      template: './src/index.html',
      title: 'Is Kenilworth ford flooded?',
    }),
    new HtmlWebpackPlugin({
      chunks: ['css'],
      filename: 'about.html',
      template: './src/about.html',
      title: 'Is Kenilworth ford flooded?',
    }),
    new HtmlWebpackPlugin({
      chunks: ['chart', 'css', 'runtime', 'vendors'],
      filename: 'chart.html',
      template: './src/chart.html',
      title: 'Is Kenilworth ford flooded?',
    }),
    // Gzip compression for smaller file transfers
    new CompressionPlugin({
      algorithm: 'gzip',
      test: /\.(js|css|html|svg)$/,
      threshold: 8192,
      minRatio: 0.8,
    }),
  ],
  optimization: {
    // Additional production optimizations
    minimize: true,
    concatenateModules: true,
  },
});
