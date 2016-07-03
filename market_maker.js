var config = require('./config_testnet.js');
var server = require('./server.js');
var utility = require('./common/utility.js');
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
	{ name: 'ethAddr', type: String, defaultValue: config.ethAddr }
]);
var cliOptions = cli.parse()

if (cliOptions.help) {
	console.log(cli.getUsage());
} else {
	var server = new server.Server(cliOptions.ethAddr, cliOptions.armed,
    function (existingPricerData, callback) {
      callback();
    },
    function(option, pricerData, fundsData, events) {
			var today = Date.now();
			var expiration = Date.parse(option.expiration+" 00:00:00 +0000");
			var tDays = (expiration - today)/86400000.0;
			var t = tDays / 365.0;

			if (t<=0) return undefined;

      var buyPrice = 0.0001;
      var sellPrice = option.margin;
      var buySize = utility.ethToWei(1);
      var sellSize = utility.ethToWei(1);
      var expires = 10; //in blocks
      return {buyPrice: buyPrice, sellPrice: sellPrice, buySize: buySize, sellSize: sellSize, expires: expires};
    }
  );
}
