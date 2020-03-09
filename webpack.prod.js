const merge = require('webpack-merge');
const AWS = require('aws-sdk');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const S3Plugin = require('webpack-s3-plugin');

const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'production',
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: './src/index.html',
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
