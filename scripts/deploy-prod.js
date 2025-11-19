#!/usr/bin/env node

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { fromIni } = require('@aws-sdk/credential-providers');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

const packageJson = require('../package.json');

// Configuration
const BUCKET_NAME = 'prod-kenilworthford-website-eu-west-1-238573916854';
const DIST_DIR = path.join(__dirname, '..', 'dist');
const VERSION_PATH = `${packageJson.version}/`;
const CACHE_CONTROL_ASSETS = 'public,max-age=86400';
const CACHE_CONTROL_HTML = 'public,max-age=300'; // Shorter cache for HTML files

// Initialize S3 client
const s3Client = new S3Client({
  credentials: fromIni({ profile: 'endor' }),
  region: 'eu-west-1'
});

// Get MIME type based on file extension
function getMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Get cache control based on file type
function getCacheControl(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.html') {
    return CACHE_CONTROL_HTML;
  }
  return CACHE_CONTROL_ASSETS;
}

// Recursively get all files in directory
async function getAllFiles(dir, baseDir = dir) {
  const files = [];
  const items = await readdir(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stats = await stat(fullPath);
    
    if (stats.isDirectory()) {
      const subFiles = await getAllFiles(fullPath, baseDir);
      files.push(...subFiles);
    } else {
      const relativePath = path.relative(baseDir, fullPath);
      files.push({
        localPath: fullPath,
        key: relativePath.replace(/\\/g, '/'), // Ensure forward slashes for S3
        isAsset: relativePath.includes('assets/'),
        isHtml: path.extname(relativePath).toLowerCase() === '.html'
      });
    }
  }
  
  return files;
}

// Upload file to S3
async function uploadFile(file) {
  try {
    const fileContent = await readFile(file.localPath);
    
    // Determine S3 key based on file type
    let s3Key;
    if (file.isAsset) {
      // Assets go to root with long cache
      s3Key = file.key;
    } else {
      // HTML and other files go to versioned path
      s3Key = VERSION_PATH + file.key;
    }
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: fileContent,
      ContentType: getMimeType(file.key),
      CacheControl: getCacheControl(file.key)
    });
    
    await s3Client.send(command);
    console.log(`✓ Uploaded: ${s3Key}`);
  } catch (error) {
    console.error(`✗ Failed to upload ${file.key}:`, error.message);
    throw error;
  }
}

// Main deployment function
async function deployToProduction() {
  try {
    console.log(`\n🚀 Deploying to S3 bucket: ${BUCKET_NAME}`);
    console.log(`📁 Source directory: ${DIST_DIR}`);
    console.log(`🏷️  Version: ${packageJson.version}`);
    console.log(`👤 AWS Profile: endor\n`);
    
    // Check if dist directory exists
    if (!fs.existsSync(DIST_DIR)) {
      throw new Error(`Distribution directory not found: ${DIST_DIR}`);
    }
    
    // Get all files to upload
    const files = await getAllFiles(DIST_DIR);
    const assetFiles = files.filter(f => f.isAsset);
    const nonAssetFiles = files.filter(f => !f.isAsset);
    
    console.log(`📦 Found ${files.length} files to upload:`);
    console.log(`   - ${assetFiles.length} asset files (long cache)`);
    console.log(`   - ${nonAssetFiles.length} content files (versioned)\n`);
    
    // Upload files
    for (const file of files) {
      await uploadFile(file);
    }
    
    console.log(`\n✅ Successfully deployed ${files.length} files to production!`);
    console.log(`🌐 Production URL: https://${BUCKET_NAME}.s3.amazonaws.com/${VERSION_PATH}index.html`);
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run deployment
if (require.main === module) {
  deployToProduction();
}

module.exports = { deployToProduction };