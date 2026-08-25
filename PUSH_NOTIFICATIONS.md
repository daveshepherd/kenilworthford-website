# Push Notifications Setup

This project now includes client push subscription flow and a custom service worker with push handlers.

## 1) Runtime Config

Add these keys to your runtime `config.js` in each environment:

```js
window.__runtime_configuration = {
  apiEndpoint: "https://api.dev.kenilworthford.com",
  pushSubscribeEndpoint: "https://api.dev.kenilworthford.com/push/subscribe",
  pushPublicKey: "<YOUR_VAPID_PUBLIC_KEY>"
};
```

Notes:
- `pushPublicKey` is VAPID public key only (safe in browser).
- Keep VAPID private key server-side only.

## 2) Generate VAPID Keys

```bash
yarn push:keys
```

Copy output into secure backend config.

## 3) Backend Subscribe Endpoint Contract

Endpoint:

- `POST /push/subscribe`

Request body:

```json
{
  "subscription": {
    "endpoint": "https://...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

Response:

- `200` or `201` on success.

Recommended storage fields:
- endpoint
- p256dh
- auth
- createdAt
- lastSeenAt
- topic/user metadata (optional)

## 4) Send Notifications from Backend

Use `web-push` in backend service:

- Set VAPID details once
- Send payload JSON `{ title, body, url, icon, badge }`
- Remove stale subscriptions on `404` / `410`

## 5) Local Send Test Script

After capturing one valid subscription JSON to file:

```bash
VAPID_PUBLIC_KEY=... \
VAPID_PRIVATE_KEY=... \
yarn push:test --subscription ./subscription.json --title "Test" --body "Ford update" --url "/"
```

## 6) CloudFront/Lambda@Edge Routing

Ensure default behavior rewrite covers root PWA files:
- `/`
- `/manifest.webmanifest`
- `/sw.js`
- `/offline.html`
- `/about.html`
- `/chart.html`

Icons now served from `/VERSION/assets/...`, so they use your `/assets/` behavior directly.
