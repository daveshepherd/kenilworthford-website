const AWS = require('aws-sdk');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const merge = require('webpack-merge');
const path = require('path');
const S3Plugin = require('webpack-s3-plugin');

const common = require('./webpack.common.js');

const packageJson = require(`${process.cwd()}${path.sep}package.json`);

module.exports = merge(common, {
  mode: 'development',
  plugins: [
    new CopyPlugin([
      {from: './src/test-api', to: 'api'},
    ]),
    new HtmlWebpackPlugin({
      chunks: ['app', 'css', 'runtime', 'vendors'],
      filename: 'index.html',
      template: './src/index.html',
      title: 'Is Kenilworth ford flooded? (DEV)',
    }),
    new HtmlWebpackPlugin({
      chunks: ['css'],
      filename: 'about.html',
      template: './src/about.html',
      title: 'Is Kenilworth ford flooded? (DEV)',
    }),
    new HtmlWebpackPlugin({
      chunks: ['chart', 'css', 'runtime', 'vendors'],
      filename: 'chart.html',
      template: './src/chart.html',
      title: 'Is Kenilworth ford flooded? (DEV)',
    }),
    new S3Plugin({
      exclude: `${packageJson.version}/assets`,
      s3Options: {
        credentials: new AWS.SharedIniFileCredentials({profile: 'endor'}),
      },
      s3UploadOptions: {
        Bucket: 'kenilworthford-website',
        CacheControl: 'public,max-age=86400',
      },
      basePath: `dev/${packageJson.version}/`,
    }),
    new S3Plugin({
      include: `${packageJson.version}/assets`,
      s3Options: {
        credentials: new AWS.SharedIniFileCredentials({profile: 'endor'}),
      },
      s3UploadOptions: {
        Bucket: 'kenilworthford-website',
        CacheControl: 'public,max-age=86400',
      },
      basePath: "dev/"
    }),
  ],
});
