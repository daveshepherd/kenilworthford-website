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

let readingsApi = `${window.__runtime_configuration.apiEndpoint}/status`;
let updateTimer = null;
let lastUpdateTime = 0;

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

// Schedule the next update
function scheduleNextUpdate() {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(() => {
    fetchStatus();
    scheduleNextUpdate();
  }, UPDATE_INTERVAL);
}

// Handle page visibility changes (tab switching)
function handleVisibilityChange() {
  if (document.hidden) {
    // Tab is now hidden - clear the timer to save resources
    clearTimeout(updateTimer);
  } else {
    // Tab is now visible - check if data is stale
    const timeSinceUpdate = Date.now() - lastUpdateTime;
    
    if (timeSinceUpdate > STALE_THRESHOLD) {
      // Data is stale, fetch immediately
      console.log('Tab refocused, refreshing stale data...');
      fetchStatus();
    } else {
      // Data is still fresh, just update the display (time ago text)
      console.log('Tab refocused, data is still fresh');
    }
    
    // Resume regular updates
    scheduleNextUpdate();
  }
}

// Initialize the status system
function initializeStatus() {
  // Set up page visibility listener for tab switching
  if (typeof document.hidden !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
  
  // Initial fetch when page loads
  document.addEventListener('DOMContentLoaded', function () {
    fetchStatus();
    scheduleNextUpdate();
  });
}

// Start the system
initializeStatus();
