$(function () {
    google.charts.load('current', {packages: ['corechart', 'line']});
});
$(function () {
  var period = 1800; //30 minute bars
  var days_data = 10; //10 days
  var start = Math.ceil(Date.now()/1000 - days_data*86400);
  var end = Math.ceil(Date.now()/1000);
  var addingPoint = false;
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
              var series = this.series[0];
              var data_points = [];
              Array.prototype.max = function() {return Math.max.apply(null, this);}
              Array.prototype.min = function() {return Math.min.apply(null, this);}
              setInterval(function () {
                if (addingPoint) {
                  series.removePoint(series.data.length-1);
                }
                data_points.push(Math.random() * 8.0);
                series.addPoint([(new Date()).getTime(), data_points[0], data_points.max(), data_points.min(), data_points[]], true, true);
                if (Date.now() - series.data[series.data.length-1].x > period*1000) {
                  addingPoint = false;
                  data_points = [];
                } else {
                  addingPoint = true;
                }
              }, 1000);
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
$(function () {
    $('body').on('click', '#address_submit', function (e) {
        e.preventDefault();
        $('#address_modal').modal('hide');
        bundle.Main.addAddress($('#address_addr').val(), $('#address_pk').val());
    });
});
$(function () {
    $('body').on('click', '#new_expiration_submit', function (e) {
        e.preventDefault();
        $('#new_expiration_modal').modal('hide');
        bundle.Main.newExpiration($('#new_expiration_date').val(),$('#new_expiration_call_strikes').val(),$('#new_expiration_put_strikes').val(),$('#new_expiration_margin').val());
    });
});
$(function () {
    $('body').on('click', '#publish_expiration_submit', function (e) {
        e.preventDefault();
        $('#publish_expiration_modal').modal('hide');
        bundle.Main.publishExpiration($('#publish_expiration_address').val());
    });
    $('body').on('click', '#disable_expiration_submit', function (e) {
        e.preventDefault();
        $('#disable_expiration_modal').modal('hide');
        bundle.Main.disableExpiration($('#disable_expiration_address').val());
    });
});
$(function () {
    $('body').on('click', '#expire_submit', function (e) {
        e.preventDefault();
        $('#expire_modal').modal('hide');
        bundle.Main.expire($('#expire_contract_addr').val());
    });
    $('#expire_modal').on('show.bs.modal', function(e) {
      $('#expire_submit').hide();
      $("#expire_message").html('<i class="fa fa-circle-o-notch fa-spin"></i>');
      var contract_addr = $(e.relatedTarget).data('contract');
      $(e.currentTarget).find('input[id="expire_contract_addr"]').val(contract_addr);
      bundle.Main.expireCheck(contract_addr, function(result){
        var ready = result[0];
        var settlement = result[1];
        if (ready) $('#expire_submit').show();
        var message = "";
        if (ready && settlement) {
          $('#expire_submit').show();
          message = "This contract is ready to expire. The settlement price is "+settlement+". Only one person needs to send the expiration transaction. If you are ready to be that person, press 'Expire.'";
        } else if (settlement) {
          message = "This contract is not ready to expire. The settlement price will be "+settlement+".";
        } else {
          message = "This contract is not ready to expire."
        }
        $("#expire_message").html(message);
      });
    });
});
$(function () {
    $('body').on('click', '#fund_submit', function (e) {
        e.preventDefault();
        $('#fund_modal').modal('hide');
        bundle.Main.fund($('#fund_amount').val(),$('#fund_contract_addr').val());
    });
    $('#fund_modal').on('show.bs.modal', function(e) {
      var contract_addr = $(e.relatedTarget).data('contract');
      $(e.currentTarget).find('input[id="fund_contract_addr"]').val(contract_addr);
    });
});
$(function () {
    $('body').on('click', '#withdraw_submit', function (e) {
        e.preventDefault();
        $('#withdraw_modal').modal('hide');
        bundle.Main.withdraw($('#withdraw_amount').val(),$('#withdraw_contract_addr').val());
    });
    $('#withdraw_modal').on('show.bs.modal', function(e) {
      var contract_addr = $(e.relatedTarget).data('contract');
      $(e.currentTarget).find('input[id="withdraw_contract_addr"]').val(contract_addr);
    });
});
function buy_margin() {
  var price = Number($('#buy_price').val());
  var size = Number($('#buy_size').val());
  var option = JSON.parse($('#buy_option').val());
  var margin = bundle.utility.roundTo(price*size,3);
  $('#buy_margin').html(margin+" eth");
  bundle.Main.draw_option_chart('buy_graph', option, price, size);
}
$(function () {
    $('body').on('click', '#buy_submit', function (e) {
        e.preventDefault();
        $('#buy_modal').modal('hide');
        bundle.Main.order($('#buy_option').val(), $('#buy_price').val(), $('#buy_size').val(), $('#buy_order').val(), $('#buy_expires').val(), $('#buy_gas').val());
    });
    $('#buy_modal').on('show.bs.modal', function(e) {
        var option = JSON.stringify($(e.relatedTarget).data('option'));
        $(e.currentTarget).find('input[id="buy_option"]').val(option);
        var order = JSON.stringify($(e.relatedTarget).data('order'));
        $(e.currentTarget).find('input[id="buy_order"]').val(order);
        var price = $(e.relatedTarget).data('price');
        $(e.currentTarget).find('input[id="buy_price"]').val(price);
        var size = $(e.relatedTarget).data('size');
        $(e.currentTarget).find('input[id="buy_size"]').val(size);
        var description = $(e.relatedTarget).data('description');
        $(e.currentTarget).find('#buy_description').html(description);
        buy_margin();
    });
});
function sell_margin() {
  var price = Number($('#sell_price').val());
  var size = Number($('#sell_size').val());
  var option = JSON.parse($('#sell_option').val());
  var margin = bundle.utility.roundTo((option.margin-price)*size,3);
  $('#sell_margin').html(margin+" eth");
  bundle.Main.draw_option_chart('sell_graph', option, price, -size);
}
$(function () {
    $('body').on('click', '#sell_submit', function (e) {
        e.preventDefault();
        $('#sell_modal').modal('hide');
        bundle.Main.order($('#sell_option').val(), $('#sell_price').val(), -$('#sell_size').val(), $('#sell_order').val(), $('#sell_expires').val(), $('#sell_gas').val());
    });
    $('#sell_modal').on('show.bs.modal', function(e) {
        var option = JSON.stringify($(e.relatedTarget).data('option'));
        $(e.currentTarget).find('input[id="sell_option"]').val(option);
        var order = JSON.stringify($(e.relatedTarget).data('order'));
        $(e.currentTarget).find('input[id="sell_order"]').val(order);
        var price = $(e.relatedTarget).data('price');
        $(e.currentTarget).find('input[id="sell_price"]').val(price);
        var size = $(e.relatedTarget).data('size');
        $(e.currentTarget).find('input[id="sell_size"]').val(size);
        var description = $(e.relatedTarget).data('description');
        $(e.currentTarget).find('#sell_description').html(description);
        sell_margin();
    });
});
$(function() {
    $('.clickable').on('click',function(){
        var effect = $(this).data('effect');
        $(this).closest('.panel')[effect]();
    });
});
$(function() {
    $('#clear-log').click(function(){
        $('#notifications').empty();
    });
});
