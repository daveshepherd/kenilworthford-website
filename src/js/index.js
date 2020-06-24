import moment from 'moment';
import $ from 'jquery';

window.jQuery = $;
window.$ = $;

const NOT_FLOODED_MAX_DEPTH = 1.18;
const PASSABLE_WARNING_DEPTH = 1.22;
const PASSABLE_MAX_DEPTH = 1.25;
const WELL_OVER_THE_PAVEMENT = 1.730;

let readingsApi = 'https://api.kenilworthford.com/status';
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

      if (fordDepth >= WELL_OVER_THE_PAVEMENT) {
        $('#fordStatus').text(`Definitely - bring a snorkel`);
        $('#fordStatus').css({
          backgroundColor: 'red'
        });
      } else if (fordDepth >= PASSABLE_MAX_DEPTH) {
        $('#fordStatus').text(`Yes - it's probably too high, find another route`);
        $('#fordStatus').css({
          backgroundColor: 'red'
        });
      } else if (fordDepth >= NOT_FLOODED_MAX_DEPTH) {
        $('#fordStatus').text(`Yes - the ford is flooded, but it's not too deep yet`);
        $('#fordStatus').css({
          backgroundColor: 'orange'
        });
      } else {
        $('#fordStatus').text(`No`);
        $('#fordStatus').css({
          backgroundColor: 'green'
        });
      }
    })
  });
  setTimeout(updateStatus, 15 * 60000);
};

updateStatus();
