$(function(){
  $('#twitter').tweecool({
    username: 'Etheropt',
    limit: 10,
    profile_image: false,
  });
});
$(function () {
  google.charts.load('current', {packages: ['corechart', 'line']});
  google.charts.setOnLoadCallback(function() {
    bundle.Main.draw_option_chart('buy_call', {strike: 12.5, kind: 'Call', margin: 5.0}, 1.5, 100.0);
    bundle.Main.draw_option_chart('sell_call', {strike: 12.5, kind: 'Call', margin: 5.0}, 1.5, -100.0);
    bundle.Main.draw_option_chart('buy_put', {strike: 8.5, kind: 'Put', margin: 5.0}, 0.5, 10.0);
    bundle.Main.draw_option_chart('sell_put', {strike: 8.5, kind: 'Put', margin: 5.0}, 0.5, -10.0);
  });
});
$(function() {
  ((window.gitter = {}).chat = {}).options = {
    room: 'etheropt/etheropt.github.io'
  };
})
$(function () {
  var period = 1800; //30 minute bars
  var days_data = 10; //10 days
  var start = Math.ceil(Date.now()/1000 - days_data*86400);
  var end = Math.ceil(Date.now()/1000);
  Highcharts.setOptions({
    global: {timezoneOffset: (new Date()).getTimezoneOffset()}
  });
  $.getJSON('http://api.coindesk.com/v1/bpi/currentprice/USD.json', function(result) {
    var btc = result.bpi.USD.rate;
    $.getJSON('https://poloniex.com/public?command=returnChartData&currencyPair=BTC_ETH&start='+start+'&end='+end+'&period='+period, function(eth) {
      var data = eth.map(function(x){return [x["date"]*1000, x["open"]*btc, x["high"]*btc, x["low"]*btc, x["close"]*btc]});

      $('#chart').highcharts('StockChart', {
        title: {
          text: 'ETH/USD'
        },
        exporting: {
          enabled: false
        },
        chart : {
          events : {
            load : function () {
              var new_point_interval = 30;
              var chart = this;
              var series = this.series[0];
              var data_points = [];
              var updating_point = false;
              Array.prototype.max = function() {return Math.max.apply(null, this);}
              Array.prototype.min = function() {return Math.min.apply(null, this);}
              function new_point() {
                $.getJSON('https://poloniex.com/public?command=returnTicker', function(result) {
      						var eth_btc = result.BTC_ETH.last;
                  $.getJSON('http://api.coindesk.com/v1/bpi/currentprice/USD.json', function(result) {
        						var btc_usd = result.bpi.USD.rate;
                    var data_point = eth_btc * btc_usd;
                    chart.setTitle({text: "ETH/USD "+data_point.toFixed(2)});
                    data_points.push(data_point);
                    if (updating_point) {
                      series.data[series.data.length-1].update([(new Date()).getTime(), data_points[0], data_points.max(), data_points.min(), data_points[data_points.length-1]], true, true);
                    } else {
                      series.addPoint([(new Date()).getTime(), data_points[0], data_points.max(), data_points.min(), data_points[data_points.length-1]], true, true);
                    }
                    if (Date.now() - series.data[series.data.length-1].x > period*1000) {
                      updating_point = false;
                      data_points = [];
                    } else {
                      updating_point = true;
                    }
                    setTimeout(function () {
                      new_point();
                    }, new_point_interval*1000);
          				});
        				});
              }
              new_point();
            }
          }
        },
        rangeSelector: {
          buttons : [{type: 'day', count: 1, text: '1D'}, {type: 'day', count: 5, text: '5D'}, {type: 'all', count: 1, text: 'All'}],
          selected: 0,
          inputEnabled: false
        },
        series: [{name: 'ETH/USD', type: 'candlestick', data : data, tooltip: {valueDecimals: 2}}]
      });
    });
  });
});
