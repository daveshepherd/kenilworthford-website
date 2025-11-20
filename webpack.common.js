const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');

const packageJson = require(`${process.cwd()}${path.sep}package.json`);

module.exports = {
  entry: {
    app: './src/js/index.js',
    chart: './src/js/chart.js',
    css: './src/css/style.css',
  },
  plugins: [
    new MiniCssExtractPlugin({
        filename: `${packageJson.version}/assets/[contenthash].css`,
      }
    ),
  ],
  output: {
    clean: true, // Clean the output directory before emit
    filename: `${packageJson.version}/assets/[name].[contenthash].js`,
    path: path.resolve(__dirname, 'dist'),
  },
  optimization: {
    moduleIds: 'deterministic',
    runtimeChunk: 'single',
    usedExports: true, // Enable tree shaking
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // Separate Highcharts into its own chunk
        highcharts: {
          test: /[\\/]node_modules[\\/]highcharts/,
          name: 'highcharts',
          priority: 20,
          chunks: 'all',
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
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        include: [
          path.resolve(__dirname, 'src'),
          // Include node_modules/highcharts for transpilation
          path.resolve(__dirname, 'node_modules/highcharts')
        ],
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            cacheDirectory: true
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: '../',
            }
          },
          'css-loader',
        ],
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        type: 'asset/resource',
        generator: {
          filename: `${packageJson.version}/assets/[contenthash][ext]`,
        },
      },
    ],
  },
};
