# Kenilworth Ford Website

Static website build for the Kenilworth Ford status site.

## Prerequisites

- Node.js 18+ recommended
- Yarn 1.x

If you are on an older Node/OpenSSL combination and hit crypto errors while running webpack, use:

```bash
export NODE_OPTIONS=--openssl-legacy-provider
```

## Install

```bash
yarn
```

## Local Development

Start the webpack dev server:

```bash
yarn serve
```

Then open:

- http://localhost:8080

To create a local development build without running the server:

```bash
yarn build-dev
```

## Production Build

```bash
yarn build
```

Important notes:

- `yarn build` runs `yarn version --patch` first, so it increments the package version.
- The `preversion` hook requires a clean git working tree.
- Build output is written to `dist/`.

After building, open `dist/index.html` in a browser.

## Deploy

Deploy to production S3:

```bash
yarn deploy
```

This command:

- runs a production build
- uploads files using `scripts/deploy-prod.js`
- uses AWS profile `endor`
- uploads to `prod-kenilworthford-website-eu-west-1-238573916854` in `eu-west-1`

## Push Notifications

See `PUSH_NOTIFICATIONS.md` for:

- runtime config keys
- VAPID key generation
- backend subscription API contract
- test send script usage
