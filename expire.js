var config = require('./config.js');
var utility = require('./utility.js');
var Web3 = require('web3');
var request = require('request');
var async = require('async');
var commandLineArgs = require('command-line-args');

var cli = commandLineArgs([
	{ name: 'help', alias: 'h', type: Boolean },
  { name: 'armed', type: Boolean, defaultValue: false },
	{ name: 'gas', type: Number, defaultValue: 3141592 },
]);
var cli_options = cli.parse()

if (cli_options.help) {
	console.log(cli.getUsage());
} else {
	var web3 = new Web3();
	web3.eth.defaultAccount = config.eth_addr;
	web3.setProvider(new web3.providers.HttpProvider(config.eth_provider));
	utility.readFile(config.contract_market+'.bytecode', function(bytecode){
	  utility.readFile(config.contract_market+'.interface', function(abi){
	    abi = JSON.parse(abi);
	    bytecode = JSON.parse(bytecode);
	    var myContract = web3.eth.contract(abi);
	    myContract = myContract.at(config.contract_addr);

			async.eachSeries(config.contract_addrs,
				function(contract_addr, callback) {
					utility.call(web3, myContract, contract_addr, 'getMarket', [], function(result) {
				    var optionIDs = result[0];
				    var strikes = result[1];
			      var is = [];
						for (var i=0; i<optionIDs.length; i++) {
							if (strikes[i].toNumber()!=0) is.push(i);
						}
						utility.call(web3, myContract, contract_addr, 'getOptionChain', [], function(result) {
							try {
								var expiration = (new Date(result[0].toNumber()*1000)).toISOString().substring(0,10);
								var fromcur = result[1].split("/")[0];
								var tocur = result[1].split("/")[1];
								var margin = result[2].toNumber() / 1000000000000000000;
								var realityID = result[3].toNumber();
								request.get('https://www.realitykeys.com/api/v1/exchange/'+realityID+'?accept_terms_of_service=current', function(err, httpResponse, body){
									if (!err) {
										result = JSON.parse(body);
										var signed_hash = '0x'+result.signature_v2.signed_hash;
										var value = '0x'+result.signature_v2.signed_value;
										var fact_hash = '0x'+result.signature_v2.fact_hash;
										var sig_r = '0x'+result.signature_v2.sig_r;
										var sig_s = '0x'+result.signature_v2.sig_s;
										var sig_v = result.signature_v2.sig_v;
										var settlement = result.winner_value;
										if (sig_r && sig_s && sig_v && value) {
											console.log("Should expire "+expiration+", settlement:", settlement);
											var nonce = undefined;
											utility.estimateGas(web3, myContract, contract_addr, 'expire', [0, sig_v, sig_r, sig_s, value, {gas: cli_options.gas, value: 0}], config.eth_addr, config.eth_addr_pk, nonce, function(result) {
												console.log("Gas estimate:", result);
												if (cli_options.armed) {
													console.log("Expiring");
													utility.send(web3, myContract, contract_addr, 'expire', [0, sig_v, sig_r, sig_s, value, {gas: cli_options.gas, value: 0}], config.eth_addr, config.eth_addr_pk, nonce, function(result) {
														txHash = result[0];
														nonce = result[1];
														console.log(txHash);
														callback();
													});
												} else {
													callback();
												}
											});
										} else {
											console.log("Not ready to expire "+expiration);
											callback();
										}
									}
								});
							} catch (err) {
								callback();
							}
						});
				  });
				},
				function(err) {
				}
			);
		});
	});
}
