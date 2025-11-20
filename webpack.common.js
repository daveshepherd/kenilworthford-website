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
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
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
