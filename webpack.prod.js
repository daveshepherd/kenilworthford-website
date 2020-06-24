const merge = require('webpack-merge');
const AWS = require('aws-sdk');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const S3Plugin = require('webpack-s3-plugin');

const common = require('./webpack.common.js');

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
    new S3Plugin({
      s3Options: {
        credentials: new AWS.SharedIniFileCredentials({profile: 'endor'}),
      },
      s3UploadOptions: {
        Bucket: 'kenilworthford-website',
        CacheControl: 'public,max-age=86400',
      },
      basePath: "/"
    }),
  ],
});
