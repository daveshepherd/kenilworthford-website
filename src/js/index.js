// Native JavaScript replacement using Intl.RelativeTimeFormat
function formatTimeAgo(date) {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diffMs = Date.now() - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffDay > 0) return rtf.format(-diffDay, 'day');
  if (diffHour > 0) return rtf.format(-diffHour, 'hour');
  if (diffMin > 0) return rtf.format(-diffMin, 'minute');
  return rtf.format(-diffSec, 'second');
}

// Native fetch replacement for $.getJSON
function getJSON(url, callback) {
  fetch(url)
    .then(response => response.json())
    .then(data => callback(data))
    .catch(error => console.error('Error fetching data:', error));
}

const HOUR = 3600000;
const UPDATE_INTERVAL = 15 * 60000; // 15 minutes
const STALE_THRESHOLD = 5 * 60000; // 5 minutes - when to consider data stale on tab focus
const AGGRESSIVE_THROTTLE_THRESHOLD = 30 * 60000; // 30 minutes - detect aggressive throttling
const HEARTBEAT_INTERVAL = 30000; // 30 seconds - check if we're still alive
const EXTREME_STALE_THRESHOLD = 60 * 60000; // 1 hour - definitely needs refresh

let readingsApi = `${window.__runtime_configuration.apiEndpoint}/status`;
let updateTimer = null;
let heartbeatTimer = null;
let lastUpdateTime = 0;
let lastVisibilityChange = Date.now();
let backgroundStartTime = null;
let isBackgrounded = false;
let lastHeartbeat = Date.now();
let consecutiveFailedHeartbeats = 0;

// Heartbeat system to detect when timers have been completely suspended
function startHeartbeat() {
  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    const timeSinceLastHeartbeat = now - lastHeartbeat;
    
    // If more than 2x the heartbeat interval has passed, we were likely suspended
    if (timeSinceLastHeartbeat > HEARTBEAT_INTERVAL * 2) {
      consecutiveFailedHeartbeats++;
      console.log('Heartbeat suspension detected:', Math.round(timeSinceLastHeartbeat / 1000), 'seconds');
      
      // If we've been suspended, force a status refresh
      const timeSinceUpdate = now - lastUpdateTime;
      if (timeSinceUpdate > STALE_THRESHOLD) {
        console.log('Forcing refresh due to heartbeat suspension');
        fetchStatus();
      }
    } else {
      consecutiveFailedHeartbeats = 0;
    }
    
    lastHeartbeat = now;
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// Enhanced data freshness check
function isDataFresh() {
  const now = Date.now();
  const timeSinceUpdate = now - lastUpdateTime;
  
  // Consider data stale if:
  // 1. More than STALE_THRESHOLD has passed, OR
  // 2. We've had failed heartbeats (indicating suspension), OR
  // 3. It's been over an hour (extreme case)
  return timeSinceUpdate <= STALE_THRESHOLD && 
         consecutiveFailedHeartbeats === 0 && 
         timeSinceUpdate <= EXTREME_STALE_THRESHOLD;
}

// Force refresh with logging
function forceRefreshWithIndicator(reason = '') {
  console.log('Forcing refresh:', reason);
  fetchStatus();
}

// Fetch and update status data
function fetchStatus() {
  getJSON(readingsApi, function (result) {
    lastUpdateTime = Date.now();
    consecutiveFailedHeartbeats = 0; // Reset on successful update
    updateStatusDisplay(result);
  });
}

// Update the DOM with status data
function updateStatusDisplay(result) {
  const fordDepth = result.depth;
  const dateTime = formatTimeAgo(result.lastUpdate);

  document.getElementById('fordHeight').textContent = `Depth: ${fordDepth.toFixed(2)}m`;
  document.getElementById('lastUpdated').textContent = dateTime;

  if ((new Date()).getTime() - (new Date(result.lastUpdate)).getTime() > HOUR * 3) {
    document.getElementById('siteStatus').textContent = 'Sorry, there are no recent readings available from the Environment Agency.';
    document.getElementById('fordStatus').textContent = 'Unavailable';
    document.getElementById('statusPanel').className = 'statusPanel unavailable';
  } else {
    document.getElementById('siteStatus').textContent = '';
    if (result.state === 'impassable') {
      document.getElementById('fordStatus').textContent = 'Yes';
      document.getElementById('statusPanel').className = 'statusPanel danger';
    } else if (result.state === 'flooded') {
      document.getElementById('fordStatus').textContent = 'Yes';
      document.getElementById('statusPanel').className = 'statusPanel warning';
    } else {
      document.getElementById('fordStatus').textContent = 'No';
      document.getElementById('statusPanel').className = 'statusPanel ok';
    }
    if (result.direction === 'rising') {
      document.getElementById('statusIcon').innerHTML = '<i class="material-icons directionIcon rising">trending_up</i>';
    } else if (result.direction === 'falling') {
      document.getElementById('statusIcon').innerHTML = '<i class="material-icons directionIcon falling">trending_down</i>';
    } else {
      document.getElementById('statusIcon').innerHTML = '';
    }
  }
}

// Schedule the next update with throttling detection
function scheduleNextUpdate() {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(() => {
    // Check if we've been throttled before executing
    checkTimerThrottling();
    
    if (!document.hidden && !isBackgrounded) {
      fetchStatus();
    }
    scheduleNextUpdate();
  }, UPDATE_INTERVAL);
}

// Handle page visibility changes (tab switching)
function handleVisibilityChange() {
  const now = Date.now();
  
  if (document.hidden) {
    // Tab is now hidden
    isBackgrounded = true;
    backgroundStartTime = now;
    clearTimeout(updateTimer);
    stopHeartbeat();
    console.log('Tab backgrounded at', new Date(now).toLocaleTimeString());
  } else {
    // Tab is now visible
    const wasBackgrounded = isBackgrounded;
    const backgroundDuration = backgroundStartTime ? now - backgroundStartTime : 0;
    
    isBackgrounded = false;
    backgroundStartTime = null;
    lastVisibilityChange = now;
    
    if (wasBackgrounded) {
      console.log('Tab foregrounded after', Math.round(backgroundDuration / 1000), 'seconds');
    }
    
    // Always refresh when coming back from background on mobile (aggressive approach)
    const timeSinceUpdate = now - lastUpdateTime;
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const shouldRefresh = !isDataFresh() || 
                         wasBackgrounded || 
                         backgroundDuration > STALE_THRESHOLD ||
                         (isMobile && backgroundDuration > 60000); // 1 minute on mobile
    
    if (shouldRefresh) {
      const reason = `stale for ${Math.round(timeSinceUpdate / 1000)}s, backgrounded for ${Math.round(backgroundDuration / 1000)}s`;
      forceRefreshWithIndicator(reason);
    } else {
      fetchStatus(); // Still refresh, just without the visual indicator
    }
    
    // Resume regular updates and heartbeat
    scheduleNextUpdate();
    startHeartbeat();
  }
}

// Additional focus/blur handlers for better mobile support
function handleWindowFocus() {
  const now = Date.now();
  const timeSinceUpdate = now - lastUpdateTime;
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Be more aggressive on mobile - always refresh if it's been more than 2 minutes
  const mobileThreshold = isMobile ? 2 * 60000 : STALE_THRESHOLD;
  
  if (timeSinceUpdate > mobileThreshold || isBackgrounded || !isDataFresh()) {
    const reason = `window focus - stale for ${Math.round(timeSinceUpdate / 1000)}s (mobile: ${isMobile})`;
    console.log('Window focused, forcing refresh:', reason);
    forceRefreshWithIndicator(reason);
    scheduleNextUpdate();
    startHeartbeat();
    
    // Reset background state
    isBackgrounded = false;
    backgroundStartTime = null;
  }
}

function handleWindowBlur() {
  console.log('Window blurred');
  isBackgrounded = true;
  backgroundStartTime = Date.now();
  clearTimeout(updateTimer);
  stopHeartbeat();
}

// Detect if timers have been throttled (mobile Safari, Chrome background tabs)
function checkTimerThrottling() {
  const now = Date.now();
  const expectedInterval = UPDATE_INTERVAL;
  const actualInterval = now - lastVisibilityChange;
  
  // If our timer is running but we're way behind schedule, we might be throttled
  if (!document.hidden && !isBackgrounded && actualInterval > expectedInterval * 2) {
    console.log('Timer throttling detected, forcing refresh');
    fetchStatus();
    scheduleNextUpdate();
  }
  
  lastVisibilityChange = now;
}

// Initialize the status system
function initializeStatus() {
  // Set up page visibility listener for tab switching
  if (typeof document.hidden !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
  
  // Additional focus/blur listeners for better mobile and desktop support
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('blur', handleWindowBlur);
  
  // Page focus/blur for iOS Safari compatibility
  window.addEventListener('pageshow', handleWindowFocus);
  window.addEventListener('pagehide', handleWindowBlur);
  
  // More aggressive interaction detection for mobile
  const interactionEvents = ['mousedown', 'touchstart', 'click', 'scroll', 'keydown'];
  let lastInteraction = Date.now();
  
  interactionEvents.forEach(eventType => {
    document.addEventListener(eventType, function() {
      const now = Date.now();
      const timeSinceUpdate = now - lastUpdateTime;
      const timeSinceLastInteraction = now - lastInteraction;
      
      // Only check if it's been a while since last interaction (avoid spam)
      if (timeSinceLastInteraction > 5000) {
        lastInteraction = now;
        
        if (!isDataFresh()) {
          const reason = `${eventType} interaction - data stale for ${Math.round(timeSinceUpdate / 1000)}s`;
          console.log('User interaction detected:', reason);
          forceRefreshWithIndicator(reason);
        }
      }
    }, { passive: true });
  });
  
  // Network change detection (mobile switching between wifi/cellular)
  if ('onLine' in navigator) {
    window.addEventListener('online', function() {
      console.log('Network reconnected');
      if (!isDataFresh()) {
        forceRefreshWithIndicator('network reconnected');
      }
    });
  }
  
  // Initial fetch when page loads
  document.addEventListener('DOMContentLoaded', function () {
    fetchStatus();
    scheduleNextUpdate();
    startHeartbeat();
  });
}

// Start the system
initializeStatus();
