// Lazy load Highcharts to reduce initial bundle size
// This eliminates the webpack size warning and improves performance

// Use native fetch instead of Highcharts.getJSON
function getJSON(url, callback) {
  fetch(url)
    .then(response => response.json())
    .then(data => callback(data))
    .catch(error => console.error('Error fetching chart data:', error));
}

// Show loading state while chart library loads
function showLoadingState() {
  const container = document.getElementById('container');
  if (container) {
    container.innerHTML = '<div style="text-align: center; padding: 50px; color: #666;">📊 Loading chart...</div>';
  }
}

// Initialize chart with lazy-loaded Highcharts
async function initializeChart() {
  try {
    showLoadingState();
    
    // Dynamically import Highcharts core
    const HighchartsModule = await import('highcharts/highstock');
    const Highcharts = HighchartsModule.default;
    
    // Import and initialize modules
    const [exportingModule, exportDataModule] = await Promise.all([
      import('highcharts/modules/exporting'),
      import('highcharts/modules/export-data')
    ]);
    
    // Initialize modules - handle different export patterns
    if (exportingModule.default && typeof exportingModule.default === 'function') {
      exportingModule.default(Highcharts);
    }
    if (exportDataModule.default && typeof exportDataModule.default === 'function') {
      exportDataModule.default(Highcharts);
    }
    
    // Configure global options
    Highcharts.setOptions({
      lang: {
        thousandsSep: ",",
      },
      time: {
        useUTC: false,
      },
    });
    
    // Load and render chart data
    loadChartData(Highcharts);
    
  } catch (error) {
    console.error('Error loading chart library:', error);
    const container = document.getElementById('container');
    if (container) {
      container.innerHTML = '<div style="text-align: center; padding: 50px; color: #d32f2f;">❌ Error loading chart</div>';
    }
  }
}

// Load chart data and render
function loadChartData(Highcharts) {
  const NOT_FLOODED_MAX_DEPTH = 1.23;
  const PASSABLE_MAX_DEPTH = 1.22;
  const WELL_OVER_THE_PAVEMENT = 1.732;
  
  let chartApi = `${window.__runtime_configuration.apiEndpoint}/chart`;
  
  getJSON(chartApi, function (data) {
    // Calculate max depth for chart scaling
    let maxDepth = Math.max.apply(
      Math,
      data.map(function (o) {
        return o[1];
      })
    );
    
    // Create the stock chart
    Highcharts.stockChart("container", {
      chart: {
        height: 400,
      },
      rangeSelector: {
        buttons: [
          {
            type: "day",
            count: 1,
            text: "1d",
          },
          {
            type: "week",
            count: 1,
            text: "1w",
          },
          {
            type: "month",
            count: 1,
            text: "1m",
          },
          {
            type: "month",
            count: 6,
            text: "6m",
          },
          {
            type: "year",
            count: 1,
            text: "1y",
          },
          {
            type: "all",
            text: "All",
          },
        ],
        inputDateFormat: "%d/%m/%Y",
        selected: 1,
      },
      exporting: {
        csv: {
          dateFormat: "%d/%m/%Y %H:%M:%S",
        },
      },
      responsive: {
        rules: [
          {
            condition: {
              maxWidth: 500,
            },
            chartOptions: {
              chart: {
                height: 300,
              },
              rangeSelector: {
                inputEnabled: false,
              },
              navigator: {
                enabled: false,
              },
              subtitle: {
                text: null,
              },
            },
          },
        ],
      },
      series: [
        {
          name: "Depth (m)",
          data: data,
          tooltip: {
            valueDecimals: 2,
          },
        },
      ],
      xAxis: {
        ordinal: false,
        type: "datetime",
      },
      yAxis: {
        max: maxDepth,
        plotLines: [
          {
            color: "orange",
            dashStyle: "dash",
            label: {
              text: "Flooding possible",
              align: "left",
              y: 12,
              x: 0,
            },
            value: NOT_FLOODED_MAX_DEPTH,
          },
        ],
      },
    });
  });
}

// Initialize chart when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeChart);
} else {
  initializeChart();
}
