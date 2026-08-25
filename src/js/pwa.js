const runtimeConfig = globalThis.__runtime_configuration || {};

const PUSH_SUBSCRIBE_ENDPOINT =
  runtimeConfig.pushSubscribeEndpoint ||
  (runtimeConfig.apiEndpoint ? `${runtimeConfig.apiEndpoint}/push/subscribe` : '');
const PUSH_PUBLIC_KEY = runtimeConfig.pushPublicKey || '';

let activeRegistration = null;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replaceAll('-', '+').replaceAll('_', '/');
  const rawData = globalThis.atob(normalized);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.codePointAt(i);
  }

  return outputArray;
}

function setPushMessage(text, isError = false) {
  const statusEl = document.getElementById('pushStatusMessage');
  if (!statusEl) return;

  statusEl.textContent = text;
  statusEl.className = isError ? 'pushStatus error' : 'pushStatus';
}

function setPushButtonState(isDisabled, text) {
  const buttonEl = document.getElementById('enablePushBtn');
  if (!buttonEl) return;

  buttonEl.disabled = isDisabled;
  if (text) {
    buttonEl.textContent = text;
  }
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser.');
  }

  if (activeRegistration) {
    return activeRegistration;
  }

  activeRegistration = await navigator.serviceWorker.register('/sw.js');
  return activeRegistration;
}

async function postSubscription(subscription) {
  if (!PUSH_SUBSCRIBE_ENDPOINT) {
    throw new Error('Missing push subscribe endpoint in runtime config.');
  }

  const response = await fetch(PUSH_SUBSCRIBE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subscription }),
  });

  if (!response.ok) {
    throw new Error(`Subscribe API failed with status ${response.status}.`);
  }
}

async function updateSubscriptionUi() {
  const buttonEl = document.getElementById('enablePushBtn');
  if (!buttonEl) return;

  if (!('serviceWorker' in navigator) || !('PushManager' in globalThis) || !('Notification' in globalThis)) {
    setPushButtonState(true, 'Push Not Supported');
    setPushMessage('Push notifications are not supported in this browser.', true);
    return;
  }

  if (!PUSH_PUBLIC_KEY) {
    setPushButtonState(true, 'Push Not Configured');
    setPushMessage('Push key missing from runtime config.', true);
    return;
  }

  try {
    const registration = await registerServiceWorker();
    const existingSubscription = await registration.pushManager.getSubscription();

    if (existingSubscription) {
      setPushButtonState(true, 'Alerts Enabled');
      setPushMessage('Push alerts already enabled.');
    } else {
      setPushButtonState(false, 'Enable Flood Alerts');
      setPushMessage('Enable alerts for ford status changes.');
    }
  } catch (error) {
    console.error('Unable to initialize push status:', error);
    setPushButtonState(true, 'Push Unavailable');
    setPushMessage('Could not initialize push service worker.', true);
  }
}

async function subscribeToPush() {
  try {
    setPushButtonState(true, 'Enabling...');
    setPushMessage('Requesting notification permission...');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setPushButtonState(false, 'Enable Flood Alerts');
      setPushMessage('Notifications blocked. Please allow notifications first.', true);
      return;
    }

    const registration = await registerServiceWorker();
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUSH_PUBLIC_KEY),
      });
    }

    await postSubscription(subscription);

    setPushButtonState(true, 'Alerts Enabled');
    setPushMessage('Flood alerts enabled on this device.');
  } catch (error) {
    console.error('Push subscription failed:', error);
    setPushButtonState(false, 'Enable Flood Alerts');
    setPushMessage(`Push setup failed: ${error.message}`, true);
  }
}

function initializePushButton() {
  const buttonEl = document.getElementById('enablePushBtn');
  if (!buttonEl) return;

  buttonEl.addEventListener('click', () => {
    subscribeToPush();
  });

  updateSubscriptionUi();
}

window.addEventListener('load', () => {
  registerServiceWorker().catch((error) => {
    console.error('Service worker registration failed:', error);
  });

  initializePushButton();
});
