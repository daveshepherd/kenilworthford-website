import $ from 'jquery';

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

const HOUR = 3600000

window.jQuery = $;
window.$ = $;

let readingsApi = `${window.__runtime_configuration.apiEndpoint}/status`;

function updateStatus() {
  jQuery(document).ready(function () {
    $.getJSON(readingsApi, function (result) {
      const fordDepth = result.depth;
      const dateTime = formatTimeAgo(result.lastUpdate);

      $('#fordHeight').text(`Depth: ${fordDepth.toFixed(2)}m`);
      $('#lastUpdated').text(dateTime);

      if ((new Date()).getTime() - (new Date(result.lastUpdate)).getTime() > HOUR * 3) {
        $('#siteStatus').text('Sorry, there are no recent readings available from the Environment Agency.');
        $('#fordStatus').text('Unavailable');
        $('#statusPanel').attr('class', 'statusPanel unavailable');
      } else {
        $('#siteStatus').text('');
        if (result.state === 'impassable') {
          $('#fordStatus').text('Yes');
          $('#statusPanel').attr('class', 'statusPanel danger');
        } else if (result.state === 'flooded') {
          $('#fordStatus').text('Yes');
          $('#statusPanel').attr('class', 'statusPanel warning');
        } else {
          $('#fordStatus').text('No');
          $('#statusPanel').attr('class', 'statusPanel ok');
        }
        if (result.direction === 'rising') {
          $('#statusIcon').html('<i class="material-icons directionIcon rising">trending_up</i>');
        } else if (result.direction === 'falling') {
          $('#statusIcon').html('<i class="material-icons directionIcon falling">trending_down</i>');
        } else {
          $('#statusIcon').empty();
        }
      }
    })
  });
  setTimeout(updateStatus, 15 * 60000);
};

updateStatus();
