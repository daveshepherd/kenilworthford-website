#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const webpush = require('web-push');

function parseArgs(argv) {
  const args = {};

  for (let i = 2; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith('--')) continue;

    const key = part.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  const subscriptionPath = args.subscription;
  const subject = process.env.VAPID_SUBJECT || args.subject || 'mailto:alerts@kenilworthford.com';
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subscriptionPath) {
    throw new Error('Missing --subscription path to JSON file.');
  }

  if (!publicKey || !privateKey) {
    throw new Error('Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars first.');
  }

  const fullPath = path.resolve(subscriptionPath);
  const subscription = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const payload = {
    title: args.title || 'Kenilworth Ford alert',
    body: args.body || 'Water level changed. Tap to open status page.',
    url: args.url || '/',
    icon: args.icon || '',
    badge: args.badge || '',
  };

  await webpush.sendNotification(subscription, JSON.stringify(payload));
  console.log('Push notification sent.');
}

main().catch((error) => {
  console.error('Failed to send push notification:', error.message);
  process.exit(1);
});
