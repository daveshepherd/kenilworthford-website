# Deployment Scripts

This project now uses modern AWS SDK v3 based deployment scripts instead of the outdated webpack-s3-plugin.

## Available Commands

### Production Deployment

```bash
npm run deploy-prod
```

- Builds the project in production mode (increments version)
- Uploads assets to root with long cache (24 hours)
- Uploads HTML and other files to versioned path with shorter cache (5 minutes)
- Follows the same pattern as the original webpack-s3-plugin configuration

## Configuration

The deployment scripts use:

- **AWS Profile**: `endor`
- **S3 Bucket**: `prod-kenilworthford-website-eu-west-1-238573916854`
- **AWS Region**: `eu-west-1`

## Features

✅ **Modern AWS SDK v3** - Uses the latest AWS SDK with tree-shaking support
✅ **Better Error Handling** - Clear error messages and proper exit codes
✅ **Progress Indicators** - Shows upload progress with checkmarks
✅ **MIME Type Detection** - Automatically sets correct Content-Type headers
✅ **Smart Caching** - Different cache policies for assets vs content
✅ **File Validation** - Checks for dist directory before deployment

## Migration from webpack-s3-plugin

The new deployment scripts provide the same functionality as the old webpack-s3-plugin but with:

- Modern AWS SDK v3 (smaller bundle, better performance)
- More reliable error handling
- Better logging and progress indication
- Separation of concerns (build vs deploy)
- Easier to debug and maintain

## Manual Usage

You can also run the scripts directly:

# Production deployment

node scripts/deploy-prod.js

```

```
