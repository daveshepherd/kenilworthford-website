const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const { merge } = require('webpack-merge');

const common = require('./webpack.common.js');
const pagePlugins = require('./pages.js');

// The development build isn't versioned: it's served from the root, with a
// local config.js and canned API responses from src/test-api.
const publicPath = '/';

module.exports = merge(common({
  outputPath: path.resolve(__dirname, '../dist/site-dev'),
  publicPath,
}), {
  mode: 'development',
  devServer: {
    compress: true,
    port: 8080,
    open: true,
    hot: true,
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: './src/test-api', to: 'api' },
        { from: './src/test-api/config.js', to: '' },
      ],
    }),
    ...pagePlugins({ publicPath, titleSuffix: ' (DEV)' }),
  ],
});
