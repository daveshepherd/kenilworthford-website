const NOT_FLOODED_MAX_DEPTH = 1.18;
const PASSABLE_MAX_DEPTH = 1.22;
const WELL_OVER_THE_PAVEMENT = 1.732;

function updateStatus() {
    jQuery(document).ready(function () {
        $.getJSON("https://environment.data.gov.uk/flood-monitoring/data/readings?latest", function (json) {
            let record = json.items.filter((item) => {
                return item['@id'].startsWith('http://environment.data.gov.uk/flood-monitoring/data/readings/2627-level-stage-i-15_min-mASD/');
            })
            const fordDepth = record[0].value;
            const dateTime = Date.parse(record[0].dateTime);
            $('#fordHeight').text(`The ford is about ${fordDepth.toFixed(2)}m`);
            $('#lastUpdated').text(`Recorded ${jQuery.timeago(dateTime)}`);

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
