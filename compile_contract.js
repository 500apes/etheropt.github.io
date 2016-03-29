var config = require('./config.js');
var utility = require('./utility.js');
var fs = require('fs');
var Web3 = require('web3');
var commandLineArgs = require('command-line-args');
var sha256 = require('js-sha256').sha256;
require('datejs');

var cli = commandLineArgs([
	{ name: 'help', alias: 'h', type: Boolean },
  { name: 'armed', type: Boolean, defaultValue: false }
]);
var cli_options = cli.parse()

if (cli_options.help) {
	console.log(cli.getUsage());
} else {
	console.log('Use https://chriseth.github.io/browser-solidity/ to compile the contract instead of running with --armed. Then you can verify it with etherscan and etherchain.');
	var web3 = new Web3();
	web3.setProvider(new web3.providers.HttpProvider(config.eth_provider));
	var source = fs.readFileSync(config.contract_market,{ encoding: 'utf8' });
	var compiled = web3.eth.compile.solidity(source);
	utility.writeFile(config.contract_market+'.compiled', JSON.stringify(compiled));
	var code = compiled.Etheropt.code;
	var abi = compiled.Etheropt.info.abiDefinition;
	web3.eth.defaultAccount = config.eth_addr;
	var myContract = web3.eth.contract(abi);
	if (cli_options.armed) {
		myContract.new(config.eth_addr, {data: code, gas: 3141592}, function (err, contract) {
			if(err) {
				console.error(err);
			} else if(contract.address){
				console.log(contract.address);
			}
		});
	}
}
