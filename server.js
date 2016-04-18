var config = (typeof(global.config) == 'undefined' && typeof(config) == 'undefined') ? require('./config.js') : global.config;
var utility = require('./utility.js');
var http = require('http');
var natUpnp = require('nat-upnp');
var os = require('os');
var async = require('async');
var express = require('express');
var body_parser = require('body-parser');
var Web3 = require('web3');
var request = require('request');
var commandLineArgs = require('command-line-args');
var sha256 = require('js-sha256').sha256;
require('datejs');

function Server(domain, port, url, punch, eth_addr, armed, pricer_data_fn, pricer_fn) {
	//self
	var self = this;

	//config
	this.domain = domain;
	this.port = port;
  this.eth_addr = eth_addr;
  this.armed = armed;
  this.pricer_data_fn = pricer_data_fn;
  this.pricer_fn = pricer_fn;

  //data
  this.options = [];
  this.pricer_data = undefined;
  this.received_orders = [];
  this.mm_orders = [];
	this.events_hash = {};
	this.events = [];

	//upnp punch
	if (this.domain==undefined) {
		var client = natUpnp.createClient();
		client.timeout = 1000000;
		//get local ip
		var ifaces = os.networkInterfaces();
		var ips = [];
		for (ifname in ifaces) {
		  for (i in ifaces[ifname]) {
		    var iface = ifaces[ifname][i];
		    if ('IPv4' === iface.family && iface.internal == false) {
		      ips.push(iface.address)
		    }
		  }
		}
		var ip = ips[0];
		//upnp punch the port
		if (punch) {
			client.portMapping(
	      {
	  			public: { host: '', port: self.port },
	  			private: { host: ip, port: self.port },
	  			protocol: 'tcp',
	  			ttl: 0,
	  			description: 'Etheropt'
			  },
	      function(err) {
			  }
	    );
			//get external ip
			client.externalIp(function(err, ip) {
				self.domain = ip;
				self.url = url ? url : 'http://'+self.domain+':'+self.port;
				console.log(self.url);
			});
		} else {
			this.domain = ip;
			this.url = url ? url : 'http://'+this.domain+':'+this.port;
			console.log(this.url);
		}
	} else {
		this.url = url ? url : 'http://'+this.domain+':'+this.port;
		console.log(this.url);
	}

  this.app = express();
	this.app.use(body_parser.json());
	this.app.use(body_parser.urlencoded({ extended: true }));
  this.server = http.Server(this.app);
	this.server.timeout = 1000*10;
	this.server.listen(this.port);

	//web3
	web3 = new Web3();
	web3.eth.defaultAccount = config.eth_addr;
	web3.setProvider(new web3.providers.HttpProvider(config.eth_provider));

	//get contracts
	var myContract = undefined;
	utility.readFile(config.contract_contracts+'.bytecode', function(bytecode){
	  utility.readFile(config.contract_contracts+'.interface', function(abi){
	    abi = JSON.parse(abi);
	    bytecode = JSON.parse(bytecode);
	    var contractsContract = web3.eth.contract(abi);
	    contractsContract = contractsContract.at(config.contract_contracts_addr);
	    utility.call(web3, contractsContract, config.contract_contracts_addr, 'getContracts', [], function(result) {
	      if (result) {
	        config.contract_addrs = result.filter(function(x){return x!='0x0000000000000000000000000000000000000000'}).getUnique();
	        utility.readFile(config.contract_market+'.bytecode', function(bytecode){
	          utility.readFile(config.contract_market+'.interface', function(abi){
	            abi = JSON.parse(abi);
	            bytecode = JSON.parse(bytecode);
	            myContract = web3.eth.contract(abi);
	            myContract = myContract.at(config.contract_addr);
							//get
							self.app.get('/:contract', function(req, res) {
								var contract = req.params.contract;
								res.setHeader('Access-Control-Allow-Origin', '*');
								res.writeHead(200);
								res.end(JSON.stringify(self.mm_orders.concat(self.received_orders).filter(function(x){return x.contract_addr==contract})));
							});
							//post
							self.app.post('/', function(req, res) {
								res.setHeader('Access-Control-Allow-Origin', '*');
								utility.blockNumber(web3, function(blockNumber) {
									try {
										var new_orders = req.body.orders;
										async.each(new_orders, function(order, callback_each) {
											var condensed = utility.pack([order.optionID, order.price, order.size, order.orderID, order.blockExpires], [256, 256, 256, 256, 256]);
											var hash = '0x'+sha256(new Buffer(condensed,'hex'));
											var verified = utility.verify(web3, order.addr, order.v, order.r, order.s, order.hash);
											utility.call(web3, myContract, order.contract_addr, 'getFunds', [order.addr, false], function(result) {
												if (result) {
													var balance = result.toNumber();
													utility.call(web3, myContract, order.contract_addr, 'getMaxLossAfterTrade', [order.addr, order.optionID, order.size, -order.size*order.price], function(result) {
														if (result) {
															balance = balance + result.toNumber();
															if (blockNumber<=order.blockExpires && verified && hash==order.hash && balance>=0) {
																self.received_orders.push(order);
															}
															callback_each(null);
														} else {
															callback_each(null);
														}
													});
												} else {
													callback_each(null);
												}
											});
										});
									} catch(err) {
										console.log(err);
									}
								});
								res.writeHead(200);
								res.end(undefined);
							});

							//publish server address
							var nonce = undefined;
							config.contract_addrs.forEach(function(contract_addr){
								utility.call(web3, myContract, contract_addr, 'getMarketMakers', [], function(result) {
									if (result) {
										var market_makers = result;
										utility.call(web3, myContract, contract_addr, 'getMarketMakerFunds', [], function(result) {
											if (result) {
												var min_funds = result.map(function(x){return x.toNumber()}).min();
												utility.call(web3, myContract, contract_addr, 'getFundsAndAvailable', [eth_addr], function(result) {
													if (result) {
														var funds = result[0].toNumber();
														async.whilst(
															function() { return self.url==undefined; },
															function(callback) { setTimeout(function () { callback(null); }, 1000); },
															function(err) {
																if (market_makers.indexOf(self.url)<0 && funds>=min_funds && this.options.filter(function(x){return x.contract_addr==contract_addr}).length>0) {
																	console.log('Need to announce server to blockchain.');
																	if (self.armed) {
																		utility.send(web3, myContract, contract_addr, 'marketMaker', [self.url, {gas: 3141592, value: 0}], self.eth_addr, undefined, nonce, function(result) {
																			txHash = result[0];
																			nonce = result[1];
																			console.log(txHash);
																		});
																	} else {
																		console.log('To send the transaction, run with the --armed flag.');
																	}
																}
															}
														);
													}
												});
											}
										});
									}
								});
							});

							//pricing data loop
							async.forever(
								function(next) {
									self.pricer_data_fn(self.pricer_data, function(pricer_data){
										self.pricer_data = pricer_data;
										setTimeout(function () { next(); }, 1*1000);
									});
								},
								function(err) {
									console.log(err);
								}
							);

							//load log
							async.each(config.contract_addrs,
								function(contract_addr, callback_each){
									utility.logs(web3, myContract, contract_addr, 0, 'latest', function(event) {
										event.tx_link = 'http://'+(config.eth_testnet ? 'morden' : 'live')+'.ether.camp/transaction/'+event.transactionHash;
										self.events_hash[event.transactionHash+event.logIndex] = event;
										var events_list = Object.values(self.events_hash);
										events_list.sort(function(a,b){ return a.blockNumber*1000+a.transactionIndex>b.blockNumber*1000+b.transactionIndex ? -1 : 1 });
										self.events = events_list;
									});
									callback_each();
								},
								function (err) {
								}
							);

							//market info and pricing loop
							async.forever(
								function(next) {
									//market info
									async.map(config.contract_addrs,
										function(contract_addr, callback) {
											utility.call(web3, myContract, contract_addr, 'getOptionChain', [], function(result) {
												if (result) {
													var expiration = (new Date(result[0].toNumber()*1000)).toISOString().substring(0,10);
													var fromcur = result[1].split("/")[0];
													var tocur = result[1].split("/")[1];
													var margin = result[2].toNumber() / 1000000000000000000;
													var realityID = result[3].toNumber();
													var optionChainDescription = {expiration: expiration, fromcur: fromcur, tocur: tocur, margin: margin, realityID: realityID};
													utility.call(web3, myContract, contract_addr, 'getMarket', [config.eth_addr], function(result) {
														if (result) {
															var optionIDs = result[0];
															var strikes = result[1];
															var positions = result[2];
															var cashes = result[3];
															var is = [];
															for (var i=0; i<optionIDs.length; i++) {
																if (strikes[i].toNumber()!=0) is.push(i);
															}
															async.map(is,
																function(i, callback_map) {
																	var optionID = optionIDs[i].toNumber();
																	var strike = strikes[i].toNumber() / 1000000000000000000;
																	var cash = cashes[i].toNumber() / 1000000000000000000;
																	var position = positions[i].toNumber();
																	var option = Object();
																	if (strike>0) {
																		option.kind = 'Call';
																	} else {
																		option.kind = 'Put';
																	}
																	option.strike = Math.abs(strike);
																	option.optionID = optionID;
																	option.cash = cash;
																	option.position = position;
																	option.contract_addr = contract_addr;
																	async.whilst(
																		function () { return optionChainDescription==undefined },
																		function (callback) {
																				setTimeout(function () {
																						callback(null);
																				}, 1000);
																		},
																		function (err) {
																			option.expiration = optionChainDescription.expiration;
																			option.fromcur = optionChainDescription.fromcur;
																			option.tocur = optionChainDescription.tocur;
																			option.margin = optionChainDescription.margin;
																			callback_map(null, option);
																		}
																	);
																},
																function(err, options) {
																	callback(null, options);
																}
															);
														} else {
															callback(null, []);
														}
													});
												} else {
													callback(null, []);
												}
											});
										},
										function(err, options){
											options = options.reduce(function(a, b) {return a.concat(b);}, []);
											options.sort(function(a,b){ return a.expiration+(a.strike+10000000).toFixed(3).toString()+(a.kind=='Put' ? '0' : '1')<b.expiration+(b.strike+10000000).toFixed(3).toString()+(b.kind=='Put' ? '0' : '1') ? -1 : 1 });
											self.options = options;
											//pricing
											async.reduce(config.contract_addrs, {},
												function(memo, contract_addr, callback_reduce){
													utility.call(web3, myContract, contract_addr, 'getFundsAndAvailable', [self.eth_addr], function(result) {
														if (result) {
															var funds = result[0].toString();
															var fundsAvailable = result[1].toString();
															memo[contract_addr] = {funds: funds, fundsAvailable: fundsAvailable};
															callback_reduce(null, memo)
														} else {
															callback_reduce(null, memo);
														}
													});
												},
												function(err, funds_data){
													var today = Date.now();
													utility.blockNumber(web3, function(blockNumber) {
														var orderID = utility.getRandomInt(0,Math.pow(2,64));
														var nonce = undefined;
														async.map(self.options,
															function(option, callback) {
																var expiration = Date.parse(option.expiration+" 00:00:00 UTC");
																var t_days = (expiration - today)/86400000.0;
																var t = t_days / 365.0;
																var result = self.pricer_fn(option, self.pricer_data, funds_data, self.events);
																if (result) {
																	console.log(option.expiration, option.kind, option.strike, ((result.buy_price)+" ("+(utility.weiToEth(result.buy_size))+" eth) @ "+(result.sell_price)+" ("+(utility.weiToEth(result.sell_size))+" eth)"));
																	var buy_price = result.buy_price * 1000000000000000000;
																	var sell_price = result.sell_price * 1000000000000000000;
																	var buy_size = result.buy_size;
																	var sell_size = result.sell_size;
																	var blockExpires = blockNumber + result.expires;

																	var orders = [];

																	var condensed = utility.pack([option.optionID, buy_price, buy_size, orderID, blockExpires], [256, 256, 256, 256, 256]);
																	var hash = sha256(new Buffer(condensed,'hex'));
																	utility.sign(web3, self.eth_addr, hash, undefined, function(sig){
																		if (sig) {
																			orders.push({contract_addr: option.contract_addr, optionID: option.optionID, price: buy_price, size: buy_size, orderID: orderID, blockExpires: blockExpires, addr: self.eth_addr, v: sig.v, r: sig.r, s: sig.s, hash: '0x'+hash});
																		} else {
																			console.log("Failed to sign order.");
																			orders.push(undefined);
																		}
																	});

																	var condensed = utility.pack([option.optionID, sell_price, -sell_size, orderID, blockExpires], [256, 256, 256, 256, 256]);
																	var hash = sha256(new Buffer(condensed,'hex'));
																	utility.sign(web3, self.eth_addr, hash, undefined, function(sig) {
																		if (sig) {
																			orders.push({contract_addr: option.contract_addr, optionID: option.optionID, price: sell_price, size: -sell_size, orderID: orderID, blockExpires: blockExpires, addr: self.eth_addr, v: sig.v, r: sig.r, s: sig.s, hash: '0x'+hash});
																		} else {
																			console.log("Failed to sign order.");
																			orders.push(undefined);
																		}
																	});

																	async.until(
																		function() { return orders.length==2; },
																		function(callback_until) { setTimeout(function () { callback_until(null); }, 1000); },
																		function(err) {
																			callback(null, orders.filter(function(x){return x!=undefined}));
																		}
																	);
																} else {
																	callback(null, []);
																}
															},
															function(err, mm_orders) {
																var mm_orders = mm_orders.reduce(function(a, b) {return a.concat(b);}, []);
																var new_mm_orders = [];
																mm_orders.forEach(function(mm_order){
																	var existing_orders = self.mm_orders.filter(function(x){return x.contract==mm_order.contract && x.optionID==mm_order.optionID && utility.math_sign(x.size)==utility.math_sign(mm_order.size)});
																	if (existing_orders.length==1 && blockNumber+5<=existing_orders[0].blockExpires && existing_orders[0].buy_price==mm_order.buy_price && existing_orders[0].sell_price==mm_order.sell_price && existing_orders[0].buy_size==mm_order.buy_size && existing_orders[0].sell_size==mm_order.sell_size) {
																		new_mm_orders.push(existing_orders[0]);
																	} else {
																		new_mm_orders.push(mm_order);
																	}
																});
																self.mm_orders = new_mm_orders;
																self.received_orders = self.received_orders.filter(function(order){return blockNumber<=order.blockExpires;});
																setTimeout(function () { next(); }, 1*1000);
															}
														);
													});
												}
											);
										}
									);
								},
								function(err) {
									console.log(err);
								}
							);
	          });
	        });
	      }
	    });
	  });
	});
}

module.exports = {Server: Server}
