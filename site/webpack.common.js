const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');

/**
 * Shared webpack config.
 *
 * Every file is written under `outputPath`, with hashed assets in `assets/`,
 * and referenced with absolute URLs under `publicPath`. The production build
 * uses `/<version>/` for both, so each release is a self-contained folder.
 */
module.exports = function commonConfig({ outputPath, publicPath }) {
  return {
    context: __dirname,
    entry: {
      app: './src/js/index.js',
      chart: './src/js/chart.js',
      pwa: './src/js/pwa.js',
      css: './src/css/style.css',
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: 'assets/[contenthash].css',
      }),
    ],
    output: {
      clean: true, // Clean the output directory before emit
      filename: 'assets/[name].[contenthash].js',
      path: outputPath,
      publicPath,
    },
    optimization: {
      moduleIds: 'deterministic',
      runtimeChunk: 'single',
      usedExports: true, // Enable tree shaking
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          // Highcharts will be lazy-loaded, so handle async chunks
          highcharts: {
            test: /[\\/]node_modules[\\/]highcharts/,
            name: 'highcharts',
            priority: 20,
            chunks: 'async', // Only for dynamically imported chunks
          },
          // Other vendor libraries
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            chunks: 'all',
          },
        },
      },
    },
    performance: {
      hints: 'warning',
      maxEntrypointSize: 300000, // 300KB
      maxAssetSize: 300000, // 300KB
      // Filter out async chunks from performance warnings
      assetFilter: function(assetFilename) {
        // Don't warn about async chunks (lazy-loaded modules)
        return !assetFilename.includes('highcharts');
      },
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          include: [
            path.resolve(__dirname, 'src'),
            // Include node_modules/highcharts for transpilation
            path.resolve(__dirname, '../node_modules/highcharts'),
          ],
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
              cacheDirectory: true,
            },
          },
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
        {
          test: /\.(png|svg|jpg|gif)$/,
          type: 'asset/resource',
          generator: {
            filename: 'assets/[contenthash][ext]',
          },
        },
      ],
    },
  };
};
