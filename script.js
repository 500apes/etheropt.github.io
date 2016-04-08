$(function () {
  google.charts.load('current', {packages: ['corechart', 'line']});
});
$(function () {
    $('body').on('click', '#address_submit', function (e) {
        e.preventDefault();
        $('#address_modal').modal('hide');
        bundle.Main.addAddress($('#address_addr').val(), $('#address_pk').val());
    });
});
$(function () {
    $('body').on('click', '#fund_submit', function (e) {
        e.preventDefault();
        $('#fund_modal').modal('hide');
        bundle.Main.fund($('#fund_amount').val(),$('#fund_contract_addr').val());
    });
    $('#fund_modal').on('show.bs.modal', function(e) {
      var option = $(e.relatedTarget).data('contract');
      $(e.currentTarget).find('input[id="fund_contract_addr"]').val(option);
    });
});
$(function () {
    $('body').on('click', '#withdraw_submit', function (e) {
        e.preventDefault();
        $('#withdraw_modal').modal('hide');
        bundle.Main.withdraw($('#withdraw_amount').val(),$('#withdraw_contract_addr').val());
    });
    $('#withdraw_modal').on('show.bs.modal', function(e) {
      var option = $(e.relatedTarget).data('contract');
      $(e.currentTarget).find('input[id="withdraw_contract_addr"]').val(option);
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
