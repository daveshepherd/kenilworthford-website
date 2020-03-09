const merge = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  plugins: [
    new CopyPlugin([
      { from: './src/test-api', to: 'api' },
    ]),
    new HtmlWebpackPlugin({
      filename: 'dev.html',
      template: './src/index.html',
      title: 'Is Kenilworth ford flooded? (DEV)',
    }),
  ],
});
