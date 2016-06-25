var config = (typeof(global.config) == 'undefined' && typeof(config) == 'undefined') ? require('./config.js') : global.config;
var utility = require('./common/utility.js');
var http = require('http');
var natUpnp = require('nat-upnp');
var os = require('os');
var async = require('async');
var express = require('express');
var bodyParser = require('body-parser');
var Web3 = require('web3');
var request = require('request');
var commandLineArgs = require('command-line-args');
var sha256 = require('js-sha256').sha256;
require('datejs');

function Server(domain, port, url, punch, ethAddr, armed, pricerDataFn, pricerFn) {
	//self
	var self = this;

	//config
	this.domain = domain;
	this.port = port;
  this.ethAddr = ethAddr;
  this.armed = armed;
  this.pricerDataFn = pricerDataFn;
  this.pricerFn = pricerFn;

  //data
  this.options = [];
  this.pricerData = undefined;
  this.receivedOrders = [];
  this.mmOrders = [];
	this.eventsHash = {};

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
	this.app.use(bodyParser.json());
	this.app.use(bodyParser.urlencoded({ extended: true }));
  this.server = http.Server(this.app);
	this.server.timeout = 1000*10;
	this.server.listen(this.port);

	//web3
	web3 = new Web3();
	web3.eth.defaultAccount = config.ethAddr;
	web3.setProvider(new web3.providers.HttpProvider(config.ethProvider));

	//get contracts
	var myContract = undefined;
	utility.readFile(config.contractContracts+'.bytecode', function(err, bytecode){
	  utility.readFile(config.contractContracts+'.interface', function(err, abi){
	    abi = JSON.parse(abi);
	    bytecode = JSON.parse(bytecode);
	    var contractsContract = web3.eth.contract(abi);
	    contractsContract = contractsContract.at(config.contractContractsAddr);
	    utility.call(web3, contractsContract, config.contractContractsAddr, 'getContracts', [], function(err, result) {
	      if (result) {
	        config.contractAddrs = result.filter(function(x){return x!='0x0000000000000000000000000000000000000000'}).getUnique();
	        utility.readFile(config.contractMarket+'.bytecode', function(err, bytecode){
	          utility.readFile(config.contractMarket+'.interface', function(err, abi){
	            abi = JSON.parse(abi);
	            bytecode = JSON.parse(bytecode);
	            myContract = web3.eth.contract(abi);
	            myContract = myContract.at(config.contractAddr);
							//get
							self.app.get('/:contract', function(req, res) {
								var contract = req.params.contract;
								res.setHeader('Access-Control-Allow-Origin', '*');
								res.writeHead(200);
								res.end(JSON.stringify(self.mmOrders.concat(self.receivedOrders).filter(function(x){return x.contractAddr==contract})));
							});
							//post
							self.app.post('/', function(req, res) {
								res.setHeader('Access-Control-Allow-Origin', '*');
								console.log(req.body);
								utility.blockNumber(web3, function(err, blockNumber) {
									try {
										var ordersNew = req.body.orders;
										async.each(ordersNew, function(order, callbackEach) {
											var condensed = utility.pack([order.optionID, order.price, order.size, order.orderID, order.blockExpires], [256, 256, 256, 256, 256]);
											console.log([order.optionID, order.price, order.size, order.orderID, order.blockExpires]);
											console.log(condensed);
											var hash = '0x'+sha256(new Buffer(condensed,'hex'));
											var verified = utility.verify(web3, order.addr, order.v, order.r, order.s, order.hash);
											utility.call(web3, myContract, order.contractAddr, 'getFunds', [order.addr, false], function(err, result) {
												if (result) {
													var balance = result.toNumber();
													utility.call(web3, myContract, order.contractAddr, 'getMaxLossAfterTrade', [order.addr, order.optionID, order.size, -order.size*order.price], function(err, result) {
														if (result) {
															balance = balance + result.toNumber();
															if (blockNumber<=order.blockExpires && verified && hash==order.hash && balance>=0) {
																self.receivedOrders.push(order);
															}
															callbackEach(null);
														} else {
															callbackEach(null);
														}
													});
												} else {
													callbackEach(null);
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
							config.contractAddrs.forEach(function(contractAddr){
								utility.call(web3, myContract, contractAddr, 'getMarketMakers', [], function(err, result) {
									if (result) {
										var market_makers = result;
										utility.call(web3, myContract, contractAddr, 'getMarketMakerFunds', [], function(err, result) {
											if (result) {
												var min_funds = result.map(function(x){return x.toNumber()}).min();
												utility.call(web3, myContract, contractAddr, 'getFundsAndAvailable', [ethAddr], function(err, result) {
													if (result) {
														var funds = result[0].toNumber();
														async.whilst(
															function() { return self.url==undefined; },
															function(callback) { setTimeout(function () { callback(null); }, 1000); },
															function(err) {
																if (market_makers.indexOf(self.url)<0 && funds>=min_funds) {
																	console.log('Need to announce server to blockchain.');
																	if (self.armed) {
																		utility.send(web3, myContract, contractAddr, 'marketMaker', [self.url, {gas: 3141592, value: 0}], self.ethAddr, undefined, nonce, function(err, result) {
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
									self.pricerDataFn(self.pricerData, function(pricerData){
										self.pricerData = pricerData;
										setTimeout(function () { next(); }, 1*1000);
									});
								},
								function(err) {
									console.log(err);
								}
							);

							//load log
							async.eachSeries(config.contractAddrs,
								function(contractAddr, callbackEach){
									utility.logs(web3, myContract, contractAddr, 0, 'latest', function(err, event) {
										event.txLink = 'http://'+(config.ethTestnet ? 'testnet.' : '')+'etherscan.io/tx/'+event.transactionHash;
										self.eventsHash[event.transactionHash+event.logIndex] = event;
									});
									callbackEach();
								},
								function (err) {
								}
							);

							//market info and pricing loop
							async.forever(
								function(next) {
									//market info
									async.map(config.contractAddrs,
										function(contractAddr, callback) {
											utility.call(web3, myContract, contractAddr, 'getOptionChain', [], function(err, result) {
												if (result) {
													var expiration = (new Date(result[0].toNumber()*1000)).toISOString().substring(0,10);
													var fromcur = result[1].split("/")[0];
													var tocur = result[1].split("/")[1];
													var margin = result[2].toNumber() / 1000000000000000000;
													var realityID = result[3].toNumber();
													var optionChainDescription = {expiration: expiration, fromcur: fromcur, tocur: tocur, margin: margin, realityID: realityID};
													utility.call(web3, myContract, contractAddr, 'getMarket', [config.ethAddr], function(err, result) {
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
																	option.contractAddr = contractAddr;
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
											async.reduce(config.contractAddrs, {},
												function(memo, contractAddr, callback_reduce){
													utility.call(web3, myContract, contractAddr, 'getFundsAndAvailable', [self.ethAddr], function(err, result) {
														if (result) {
															var funds = result[0].toString();
															var fundsAvailable = result[1].toString();
															memo[contractAddr] = {funds: funds, fundsAvailable: fundsAvailable};
															callback_reduce(null, memo)
														} else {
															callback_reduce(null, memo);
														}
													});
												},
												function(err, fundsData){
													var events = Object.values(self.eventsHash);
													events.sort(function(a,b){ return b.blockNumber-a.blockNumber || b.transactionIndex-a.transactionIndex });
													var today = Date.now();
													utility.blockNumber(web3, function(err, blockNumber) {
														var orderID = utility.getRandomInt(0,Math.pow(2,64));
														var nonce = undefined;
														async.map(self.options,
															function(option, callback) {
																var expiration = Date.parse(option.expiration+" 00:00:00 UTC");
																var t_days = (expiration - today)/86400000.0;
																var t = t_days / 365.0;
																var result = self.pricerFn(option, self.pricerData, fundsData, events);
																if (result) {
																	console.log(option.expiration, option.kind, option.strike, ((result.buyPrice)+" ("+(utility.weiToEth(result.buySize))+" eth) @ "+(result.sellPrice)+" ("+(utility.weiToEth(result.sellSize))+" eth)"));
																	var buyPrice = result.buyPrice * 1000000000000000000;
																	var sellPrice = result.sellPrice * 1000000000000000000;
																	var buySize = result.buySize;
																	var sellSize = result.sellSize;
																	var blockExpires = blockNumber + result.expires;

																	var orders = [];

																	var condensed = utility.pack([option.optionID, buyPrice, buySize, orderID, blockExpires], [256, 256, 256, 256, 256]);
																	var hash = sha256(new Buffer(condensed,'hex'));
																	utility.sign(web3, self.ethAddr, hash, undefined, function(err, sig){
																		if (!err) {
																			var order = {contractAddr: option.contractAddr, optionID: option.optionID, price: buyPrice, size: buySize, orderID: orderID, blockExpires: blockExpires, addr: self.ethAddr, v: sig.v, r: sig.r, s: sig.s, hash: '0x'+hash};
																			utility.call(web3, myContract, order.contractAddr, 'getMaxLossAfterTrade', [order.addr, order.optionID, order.size, -order.size*order.price], function(err, result) {
																				if (result && Number(fundsData[order.contractAddr].funds) + Number(result.toString())>=0) {
																					orders.push(order);
																				} else {
																					console.log("Need more funds for this order.");
																					orders.push(undefined);
																				}
																			});
																		} else {
																			console.log("Failed to sign order.");
																			orders.push(undefined);
																		}
																	});

																	var condensed = utility.pack([option.optionID, sellPrice, -sellSize, orderID, blockExpires], [256, 256, 256, 256, 256]);
																	var hash = sha256(new Buffer(condensed,'hex'));
																	utility.sign(web3, self.ethAddr, hash, undefined, function(err, sig) {
																		if (!err) {
																			var order = {contractAddr: option.contractAddr, optionID: option.optionID, price: sellPrice, size: -sellSize, orderID: orderID, blockExpires: blockExpires, addr: self.ethAddr, v: sig.v, r: sig.r, s: sig.s, hash: '0x'+hash};
																			utility.call(web3, myContract, order.contractAddr, 'getMaxLossAfterTrade', [order.addr, order.optionID, order.size, -order.size*order.price], function(err, result) {
																				if (result && Number(fundsData[order.contractAddr].funds) + Number(result.toString())>=0) {
																					orders.push(order);
																				} else {
																					console.log("Need more funds for this order.");
																					orders.push(undefined);
																				}
																			});
																		} else {
																			console.log("Failed to sign order.");
																			orders.push(undefined);
																		}
																	});

																	async.until(
																		function() { return orders.length==2; },
																		function(callbackUntil) { setTimeout(function () { callbackUntil(null); }, 1000); },
																		function(err) {
																			callback(null, orders.filter(function(x){return x!=undefined}));
																		}
																	);
																} else {
																	callback(null, []);
																}
															},
															function(err, mmOrders) {
																var mmOrders = mmOrders.reduce(function(a, b) {return a.concat(b);}, []);
																var mmOrdersNew = [];
																mmOrders.forEach(function(mmOrder){
																	var existing_orders = self.mmOrders.filter(function(x){return x.contract==mmOrder.contract && x.optionID==mmOrder.optionID && Math.sign(x.size)==Math.sign(mmOrder.size)});
																	if (existing_orders.length==1 && blockNumber+5<=existing_orders[0].blockExpires && existing_orders[0].buyPrice==mmOrder.buyPrice && existing_orders[0].sellPrice==mmOrder.sellPrice && existing_orders[0].buySize==mmOrder.buySize && existing_orders[0].sellSize==mmOrder.sellSize) {
																		mmOrdersNew.push(existing_orders[0]);
																	} else {
																		mmOrdersNew.push(mmOrder);
																	}
																});
																self.mmOrders = mmOrdersNew;
																self.receivedOrders = self.receivedOrders.filter(function(order){return blockNumber<=order.blockExpires;});
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
