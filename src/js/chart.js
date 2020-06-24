import Highcharts from 'highcharts/highstock';
import addData from 'highcharts/modules/data';
import addExporting from 'highcharts/modules/exporting';
import addExportData from 'highcharts/modules/export-data';

addData(Highcharts);
addExporting(Highcharts);
addExportData(Highcharts);

const NOT_FLOODED_MAX_DEPTH = 1.18;
const PASSABLE_MAX_DEPTH = 1.22;
const WELL_OVER_THE_PAVEMENT = 1.732;

let chartApi = 'https://api.kenilworthford.com/chart';
if (process.env.NODE_ENV !== 'production') {
  chartApi = 'https://api.dev.kenilworthford.com/chart';
}

Highcharts.getJSON(
  chartApi,
  function (data) {
    Highcharts.stockChart('container', {
      chart: {
        height: 400
      },
      rangeSelector: {
        buttons: [{
          type: 'day',
          count: 1,
          text: '1d'
        }, {
          type: 'week',
          count: 1,
          text: '1w'
        }, {
          type: 'month',
          count: 1,
          text: '1m'
        }, {
          type: 'month',
          count: 6,
          text: '6m'
        }, {
          type: 'year',
          count: 1,
          text: '1y'
        }, {
          type: 'all',
          text: 'All'
        }],
        inputDateFormat: '%d/%m/%Y',
        selected: 1
      },
      responsive: {
        rules: [{
          condition: {
            maxWidth: 500
          },
          chartOptions: {
            chart: {
              height: 300
            },
            rangeSelector: {
              inputEnabled: false,
            },
            navigator: {
              enabled: false
            },
            subtitle: {
              text: null
            },
          }
        }]
      },
      series: [{
        name: 'Depth (m)',
        data: data,
        tooltip: {
          valueDecimals: 2
        }
      }],
      yAxis: {
        plotLines: [{
          color: 'orange',
          dashStyle: 'dash',
          label: {
            text: 'Flooding possible',
            align: 'right',
            y: 12,
            x: 0
          },
          value: NOT_FLOODED_MAX_DEPTH
        }],
      }
    });
  });
