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

function Server(domain, port, eth_addr, armed, pricer_data_fn, pricer_fn) {
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
  this.received_orders = [];
  this.mm_orders = [];

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
			self.url = 'http://'+self.domain+':'+self.port;
		});
	} else {
		this.url = 'http://'+this.domain+':'+this.port;
	}

  this.app = express();
	this.app.use(body_parser.json());
	this.app.use(body_parser.urlencoded({ extended: true }));
  this.server = http.Server(this.app);
	this.server.timeout = 1000*10;
	this.server.listen(this.port);
  this.app.get('/', function(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.writeHead(200);
    res.end(JSON.stringify(self.mm_orders.concat(self.received_orders)));
	});
  this.app.post('/', function(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    var blockNumber = web3.eth.blockNumber;
    try {
      var new_orders = req.body.orders;
      new_orders = new_orders.filter(function(order){
        var condensed = utility.pack([order.optionChainID, order.optionID, order.price, order.size, order.orderID, order.blockExpires], [256, 256, 256, 256, 256, 256]);
        var hash = '0x'+sha256(new Buffer(condensed,'hex'));
        var verified = utility.verify(web3, order.addr, order.v, order.r, order.s, order.hash);
        return blockNumber<=order.blockExpires && verified && hash==order.hash;
      });
      self.received_orders = self.received_orders.concat(new_orders);
    } catch(err) {
      console.log(err);
    }
    res.writeHead(200);
    res.end(undefined);
	});

  web3 = new Web3();
  web3.setProvider(new web3.providers.HttpProvider(config.eth_provider));
	utility.readFile(config.contract_market+'.compiled', function(result){
	  var compiled = JSON.parse(result);
	  var code = compiled.Market.code;
	  var abi = compiled.Market.info.abiDefinition;
	  web3.eth.defaultAccount = config.eth_addr;
	  var myContract = web3.eth.contract(abi);
	  myContract = myContract.at(config.contract_market_addr);

		//publish server address
		utility.proxyCall(web3, myContract, config.contract_market_addr, 'getMarketMakers', [], function(result) {
			var market_makers = result;
			utility.proxyCall(web3, myContract, config.contract_market_addr, 'getMarketMakerFunds', [], function(result) {
				var min_funds = result.map(function(x){return x.toNumber()}).min();
				utility.proxyCall(web3, myContract, config.contract_market_addr, 'getFundsAndAvailable', [], function(result) {
					var funds = result[0].toNumber();
					async.whilst(
						function() { return self.url==undefined; },
						function(callback) { setTimeout(function () { callback(null); }, 1000); },
						function(err) {
							if (market_makers.indexOf(self.url)<0 && funds>=min_funds) {
								console.log('Need to announce server to blockchain.');
								var nonce = undefined;
								if (self.armed) {
									utility.proxySend(web3, myContract, config.contract_market_addr, 'marketMaker', [self.url, {gas: 3141592, value: 0}], self.eth_addr, undefined, nonce, function(result) {
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
				});
			});
		});

		//market maker loop
		async.forever(
			function(next) {
				var blockNumber = web3.eth.blockNumber;
				var orderID = utility.getRandomInt(0,Math.pow(2,64));
        var nonce = undefined;
				utility.proxyCall(web3, myContract, config.contract_market_addr, 'getMarket', [], function(result) {
	        var optionIDs = result[0];
	        var strikes = result[1];
	        var positions = result[2];
	        var cashes = result[3];
	        var is = [];
	        var optionChainIDs = [];
	        for (var i=0; i<optionIDs.length; i++) {
	          if (strikes[i]!=0) {
	            is.push(i);
	            var optionChainID = Math.floor(optionIDs[i].toNumber() / 1000);
	            if (optionChainIDs.indexOf(optionChainID)<0) {
	              optionChainIDs.push(optionChainID);
	            }
	          }
	        }
	        var optionChainDescriptions = {};
	        optionChainIDs.forEach(function(optionChainID) {
	          utility.proxyCall(web3, myContract, config.contract_market_addr, 'getOptionChain', [optionChainID], function(result) {
	            var expiration = (new Date(result[0].toNumber()*1000)).toISOString().substring(0,10);
	            var fromcur = result[1].split("/")[0];
	            var tocur = result[1].split("/")[1];
	            var margin = result[2].toNumber() / 1000000000000000000;
							var realityID = result[3].toNumber();
							optionChainDescription = {expiration: expiration, fromcur: fromcur, tocur: tocur, margin: margin, realityID: realityID};
	            optionChainDescriptions[optionChainID] = optionChainDescription;
	          });
	        });
          async.map(is,
            function(i, callback_map) {
              var optionChainID = Math.floor(optionIDs[i].toNumber() / 1000);
              var optionID = optionIDs[i].toNumber() % 1000;
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
              option.optionChainID = optionChainID;
              option.optionID = optionID;
              option.cash = cash;
              option.position = position;
              async.whilst(
                function () { return !(optionChainID in optionChainDescriptions) },
                function (callback) {
                    setTimeout(function () {
                        callback(null);
                    }, 1000);
                },
                function (err) {
                  option.expiration = optionChainDescriptions[optionChainID].expiration;
                  option.fromcur = optionChainDescriptions[optionChainID].fromcur;
                  option.tocur = optionChainDescriptions[optionChainID].tocur;
                  option.margin = optionChainDescriptions[optionChainID].margin;
                  callback_map(null, option);
                }
              );
            },
            function(err, options) {
              options.sort(function(a,b){ return a.expiration+(a.strike+10000000).toFixed(3).toString()+a.kind<b.expiration+(b.strike+10000000).toFixed(3).toString()+b.kind ? -1 : 1 });
              self.pricer_data_fn(function(pricer_data){
                var today = Date.now();
  							var nonce = undefined;
  							async.map(options,
                  function(option, callback) {
    								var expiration = Date.parse(option.expiration+" 00:00:00 UTC");
    								var t_days = (expiration - today)/86400000.0;
    								var t = t_days / 365.0;
    								if (t>0) {
                      console.log(option.expiration, option.kind, option.strike);

                      var result = self.pricer_fn(option, pricer_data);
                      var buy_price = result.buy_price * 1000000000000000000;
                      var sell_price = result.sell_price * 1000000000000000000;
                      var buy_size = result.buy_size;
                      var sell_size = result.sell_size;
                      var blockExpires = blockNumber + result.expires;

                      var orders = [];

                      var condensed = utility.pack([option.optionChainID, option.optionID, buy_price, buy_size, orderID, blockExpires], [256, 256, 256, 256, 256, 256]);
                      var hash = sha256(new Buffer(condensed,'hex'));
                      utility.sign(web3, self.eth_addr, hash, undefined, function(sig){
                        orders.push({optionChainID: option.optionChainID, optionID: option.optionID, price: buy_price, size: buy_size, orderID: orderID, blockExpires: blockExpires, addr: self.eth_addr, v: sig.v, r: sig.r, s: sig.s, hash: '0x'+hash});
                      });

                      var condensed = utility.pack([option.optionChainID, option.optionID, sell_price, -sell_size, orderID, blockExpires], [256, 256, 256, 256, 256, 256]);
                      var hash = sha256(new Buffer(condensed,'hex'));
                      utility.sign(web3, self.eth_addr, hash, undefined, function(sig) {
                        orders.push({optionChainID: option.optionChainID, optionID: option.optionID, price: sell_price, size: -sell_size, orderID: orderID, blockExpires: blockExpires, addr: self.eth_addr, v: sig.v, r: sig.r, s: sig.s, hash: '0x'+hash});
                      });

                      async.until(
            						function() { return orders.length==2; },
            						function(callback_until) { setTimeout(function () { callback_until(null); }, 1000); },
            						function(err) {
                          callback(null, orders);
                        }
                      );
    								}
  							  },
                  function(err, mm_orders) {
                    self.mm_orders = mm_orders.reduce(function(a, b) {return a.concat(b);}, []);
                    self.received_orders = self.received_orders.filter(function(order){return blockNumber<=order.blockExpires;});
                    setTimeout(function () { next(); }, 30*1000);
                  }
                );
              });
            }
          );
	      });
			},
			function(err) {
				console.log(err);
			}
		);
	});
}

module.exports = {Server: Server}
