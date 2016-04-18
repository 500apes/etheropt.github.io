var config = require('./config_testnet.js');
var server = require('./server.js');
var utility = require('./utility.js');
var Web3 = require('web3');
var request = require('request');
var async = require('async');
var gaussian = require('gaussian');
var commandLineArgs = require('command-line-args');
var sha256 = require('js-sha256').sha256;
require('datejs');

var cli = commandLineArgs([
	{ name: 'help', alias: 'h', type: Boolean },
  { name: 'armed', type: Boolean, defaultValue: false },
	{ name: 'domain', type: String, defaultValue: config.domain },
  { name: 'port', type: String, defaultValue: config.port },
	{ name: 'punch', type: Boolean, defaultValue: true },
	{ name: 'eth_addr', type: String, defaultValue: config.eth_addr }
]);
var cli_options = cli.parse()

if (cli_options.help) {
	console.log(cli.getUsage());
} else {
	var server = new server.Server(cli_options.domain, cli_options.port, cli_options.punch, cli_options.eth_addr, cli_options.armed,
    function (existing_pricer_data, callback) {
      callback();
    },
    function(option, pricer_data, funds_data, events) {
			var today = Date.now();
			var expiration = Date.parse(option.expiration+" 00:00:00 +0000");
			var t_days = (expiration - today)/86400000.0;
			var t = t_days / 365.0;

			if (t<=0) return undefined;

      var buy_price = 0.0001;
      var sell_price = option.margin;
      var buy_size = utility.ethToWei(1);
      var sell_size = utility.ethToWei(1);
      var expires = 10; //in blocks
      return {buy_price: buy_price, sell_price: sell_price, buy_size: buy_size, sell_size: sell_size, expires: expires};
    }
  );
}
