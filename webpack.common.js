const {CleanWebpackPlugin} = require('clean-webpack-plugin');
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
    new CleanWebpackPlugin(),
    new MiniCssExtractPlugin({
        filename: `${packageJson.version}/assets/[contenthash].css`,
      }
    ),
  ],
  output: {
    filename: `${packageJson.version}/assets/[name].[contenthash].js`,
    path: path.resolve(__dirname, 'dist'),
  },
  optimization: {
    moduleIds: 'hashed',
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
        loader: 'file-loader',
        options: {
          name: `${packageJson.version}/assets/[contenthash].[ext]`,
        },
      },
    ],
  },
};
