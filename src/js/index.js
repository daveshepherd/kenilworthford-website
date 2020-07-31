import moment from 'moment';
import $ from 'jquery';

window.jQuery = $;
window.$ = $;

let readingsApi = `${window.__runtime_configuration.apiEndpoint}/status`;
if (process.env.NODE_ENV !== 'production') {
  readingsApi = 'https://api.dev.kenilworthford.com/status';
}

function updateStatus() {
  jQuery(document).ready(function () {
    $.getJSON(readingsApi, function (result) {
      const fordDepth = result.depth;
      const dateTime = moment(result.lastUpdate).fromNow();

      $('#fordHeight').text(`Depth: ${fordDepth.toFixed(2)}m`);
      $('#lastUpdated').text(dateTime);

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
    })
  });
  setTimeout(updateStatus, 15 * 60000);
};

updateStatus();
