# Kenilworth Ford Website

A real-time status website that shows whether Kenilworth Ford (a river crossing in Warwickshire, UK) is currently flooded or passable. The site fetches water level data from the Environment Agency's API and displays it with a simple traffic-light indicator.

## Overview

- **Home page** (`index.html`): Real-time ford status with water level direction indicator
- **Chart page** (`chart.html`): Historical water level data visualization (Highcharts)
- **About page** (`about.html`): Information about the ford, data sources, and liability disclaimer
- **API endpoint**: Reads from Environment Agency real-time monitoring station (default) or test data in development

## Prerequisites

- **Node.js**: 18+ recommended (20+ preferred)
- **Yarn**: 1.x

### Crypto Issues (Legacy Node)

If you encounter OpenSSL errors with an older Node/OpenSSL combination:

```bash
export NODE_OPTIONS=--openssl-legacy-provider
```

## Install

```bash
yarn
```

Installs all dependencies including webpack, Babel, CSS processors, and Highcharts.

## Development

### Start the Dev Server

```bash
yarn serve
```

This runs `webpack-dev-server` on `http://localhost:8080` with:
- Hot module reloading (HMR) enabled
- In-memory asset generation
- Browser auto-open enabled

The dev server serves test API responses from `src/test-api/` by default. Update `src/test-api/config.js` to point to a different API endpoint if needed.

### Build Without Server

To create a development build without running the server:

```bash
yarn build-dev
```

Output is written to `dist/`. Assets are versioned and hashed for caching.

### Understanding the Build

- **Asset versioning**: All JS/CSS bundles are placed in `1.0.28/assets/` (version from `package.json`)
- **Code splitting**: Highcharts is loaded asynchronously; vendors and runtime are split for optimal caching
- **CSS extraction**: Styles are extracted to separate `.css` files rather than inlined
- **Tree shaking**: Unused exports are removed during production builds

## Testing

Currently, there are no automated tests. To add tests:

```bash
yarn add -D vitest jsdom @playwright/test
```

Consider testing:
- Status display logic (`clear`, `flooded`, `impassable`, `unavailable` states)
- Time formatting and datetime attributes
- API fetch behavior and error handling
- Page load and visibility change detection

## Production Build

```bash
yarn build
```

**Important**: This command:
1. Runs `yarn version --patch` first, which increments `package.json` version
2. Requires a clean git working tree (checked by `preversion` hook)
3. Generates production-optimized output to `dist/`
4. Enables gzip compression for assets

After building, verify output with:
```bash
open dist/index.html
```

## Deployment

Deploy to AWS S3:

```bash
yarn deploy
```

This command:
1. Runs a production build (including versioning)
2. Uploads all files in `dist/` using `scripts/deploy-prod.js`
3. Uses AWS profile `endor` from `~/.aws/credentials`
4. Uploads to S3 bucket `prod-kenilworthford-website-eu-west-1-238573916854` in `eu-west-1`

**Note**: Requires AWS credentials configured locally.

## Project Structure

```
src/
├── index.html           # Home page (ford status)
├── about.html           # About page
├── chart.html           # Chart page
├── js/
│   ├── index.js        # Main status polling and DOM updates
│   └── chart.js        # Chart page initialization
├── css/
│   └── style.css       # Main stylesheet
├── images/             # Icons and assets
└── test-api/           # Development API responses
    ├── config.js       # Runtime API endpoint config
    ├── status.json     # Mock status response
    └── readings.json   # Mock historical readings

dist/                   # Build output (generated)
webpack.*.js            # Webpack configuration files
```

## Configuration

### API Endpoint

The site reads the API endpoint from `src/test-api/config.js`:

```js
window.__runtime_configuration = {
  "apiEndpoint": "https://api.dev.kenilworthford.com"
}
```

In development, this points to a test API. In production, update to the real Environment Agency endpoint.

### Webpack

- **Common config**: `webpack.common.js` (shared by dev and prod)
- **Dev config**: `webpack.dev.js` (dev server, HMR, test API copy)
- **Prod config**: `webpack.prod.js` (minification, compression, optimizations)

## Troubleshooting

### `yarn serve` doesn't reload changes

The dev server watches `src/` for changes and performs hot module reloading. If changes aren't appearing:
1. Hard refresh the browser (Cmd+Shift+R on macOS, Ctrl+Shift+R on Linux/Windows)
2. Restart the dev server: `yarn serve`
3. Check the browser console for errors

### Stale cache in browser

Clear the cache before testing:
```bash
rm -rf dist/
yarn serve
# Then hard refresh
```

### API requests failing in development

Verify `src/test-api/config.js` points to the correct endpoint, or check browser Network tab for 4xx/5xx responses.

### Permission denied errors on `yarn deploy`

Ensure AWS profile `endor` is configured in `~/.aws/credentials` and has S3 upload permissions.

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive design for mobile
- Service Worker support (PWA features)
