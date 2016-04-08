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
	var web3 = new Web3();
	web3.eth.defaultAccount = config.eth_addr;
	web3.setProvider(new web3.providers.HttpProvider(config.eth_provider));
	var source = fs.readFileSync(config.contract_market,{ encoding: 'utf8' });
	var compiled = web3.eth.compile.solidity(source);
	var bytecode = compiled.Etheropt.code;
	var abi = compiled.Etheropt.info.abiDefinition;
	var myContract = web3.eth.contract(abi);
	utility.writeFile(config.contract_market+'.bytecode', JSON.stringify(bytecode));
	utility.writeFile(config.contract_market+'.interface', JSON.stringify(abi));
	console.log('Instead of running this file, use https://chriseth.github.io/browser-solidity/ to compile the contract and paste the interface in '+config.contract_market+'.interface and the bytecode in quotes in '+config.contract_market+'.bytecode.');
}
