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

let readingsApi = `${window.__runtime_configuration.apiEndpoint}/status`;
let updateTimer = null;
let lastUpdateTime = 0;
let lastVisibilityChange = Date.now();
let backgroundStartTime = null;
let isBackgrounded = false;

// Fetch and update status data
function fetchStatus() {
  getJSON(readingsApi, function (result) {
    lastUpdateTime = Date.now();
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
    
    // Check if we need to refresh data
    const timeSinceUpdate = now - lastUpdateTime;
    const shouldRefresh = timeSinceUpdate > STALE_THRESHOLD || 
                         backgroundDuration > AGGRESSIVE_THROTTLE_THRESHOLD ||
                         wasBackgrounded; // Always refresh when coming back from background
    
    if (shouldRefresh) {
      console.log('Refreshing data - stale for', Math.round(timeSinceUpdate / 1000), 's, backgrounded for', Math.round(backgroundDuration / 1000), 's');
      fetchStatus();
    } else {
      console.log('Data is fresh, not refreshing');
    }
    
    // Resume regular updates
    scheduleNextUpdate();
  }
}

// Additional focus/blur handlers for better mobile support
function handleWindowFocus() {
  const now = Date.now();
  const timeSinceUpdate = now - lastUpdateTime;
  
  // If we haven't updated recently or if visibility API missed the background state
  if (timeSinceUpdate > STALE_THRESHOLD || isBackgrounded) {
    console.log('Window focused, refreshing data (timeSinceUpdate:', Math.round(timeSinceUpdate / 1000), 's)');
    fetchStatus();
    scheduleNextUpdate();
    
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
  
  // Mouse/touch interaction can indicate the user is back
  document.addEventListener('mousedown', function() {
    const timeSinceUpdate = Date.now() - lastUpdateTime;
    if (timeSinceUpdate > STALE_THRESHOLD) {
      console.log('User interaction detected, checking for stale data');
      fetchStatus();
    }
  });
  
  document.addEventListener('touchstart', function() {
    const timeSinceUpdate = Date.now() - lastUpdateTime;
    if (timeSinceUpdate > STALE_THRESHOLD) {
      console.log('Touch detected, checking for stale data');
      fetchStatus();
    }
  });
  
  // Initial fetch when page loads
  document.addEventListener('DOMContentLoaded', function () {
    fetchStatus();
    scheduleNextUpdate();
  });
}

// Start the system
initializeStatus();
