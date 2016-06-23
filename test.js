var config = require('./config.js');
var utility = require('./utility.js');
var Web3 = require('web3');
var assert = require('assert');
var TestRPC = require('ethereumjs-testrpc');
var fs = require('fs');
var sha256 = require('js-sha256').sha256;
var async = require('async');
var BigNumber = require('bignumber.js');
var utils = require('web3/lib/utils/utils.js');
var coder = require('web3/lib/solidity/coder.js');

var logger = {
  log: function(message) {
    // console.log(message);
  }
};

describe("Test", function(done) {
  this.timeout(240*1000);
  var web3 = new Web3();
  var port = 12345;
  var server;
  var accounts;
  var compiled;
  var myContract;
  var bytecode;
  var abi;
  var contract_addr;
  var expiration = 1457676000;
  var symbol = "ETH/USD";
  var margin = Number(utility.ethToWei(5));
  var realityID = 7573;
  var factHash = '0x4c28f2fecb85003b84f3e93ae89d97925f217e5151aafe46d01d2a7434b481aa';
  var ethAddr = '0x6fde387af081c37d9ffa762b49d340e6ae213395';
  var strikes = [11, -11, 11.5, -11.5, 12, -12, 12.5, -12.5, 13, -13];
  strikes = strikes.map(function(x){return Number(utility.ethToWei(x))});

  before("Initialize TestRPC server", function(done) {
    server = TestRPC.server(logger);
    server.listen(port, function() {
      config.eth_provider = "http://localhost:" + port;
      config.eth_gas_cost = 20000000000;
      web3.setProvider(new Web3.providers.HttpProvider("http://localhost:" + port));
      done();
    });
  });

  before("Initialize accounts", function(done) {
    web3.eth.getAccounts(function(err, accs) {
      assert.equal(err, undefined);
      assert.equal(err, undefined);
      accounts = accs;
      config.eth_addr = accounts[0];
      done();
    });
  });

  after("Shutdown server", function(done) {
    server.close(done);
  });

  describe("Contract scenario", function() {
      var initialTransaction;
      it("Should add the contract to the network", function(done) {
        utility.readFile(config.contract_market+'.bytecode', function(bytecode){
          utility.readFile(config.contract_market+'.interface', function(abi){
            abi = JSON.parse(abi);
            bytecode = JSON.parse(bytecode);
            myContract = web3.eth.contract(abi);
            var options = {};
            var arguments = [expiration, symbol, margin, realityID, factHash, ethAddr, strikes, {from: config.eth_addr, data: bytecode, gas: 4712388}];
            var args = Array.prototype.slice.call(arguments);
            var last = args[args.length - 1];
            if (utils.isObject(last) && !utils.isArray(last)) {
                options = args.pop();
            }
            function encodeConstructorParams(abi, params) {
                return abi.filter(function (json) {
                    return json.type === 'constructor' && json.inputs.length === params.length;
                }).map(function (json) {
                    return json.inputs.map(function (input) {
                        return input.type;
                    });
                }).map(function (types) {
                    return coder.encodeParams(types, params);
                })[0] || '';
            }
            var bytes = encodeConstructorParams(abi, args);
            options.data += bytes;
            web3.eth.sendTransaction(
              options,
              function(err, result) {
                assert.equal(err, undefined);
                //You are probably getting this error because ethereumjs-testrpc's block gas limit is too small (it hasn't been upgraded to the homestead block limit). Change line 95 of node_modules/ethereumjs-testrpc/lib/blockchain.js to block.header.gasLimit = '0x47e7c4';
                initialTransaction = result;
                assert.deepEqual(initialTransaction.length, 66);
                done();
              }
            );
          });
        });
      });
      it("Should verify the transaction", function(done) {
        web3.eth.getTransactionReceipt(initialTransaction, function(err, receipt) {
          assert.equal(err, undefined);
          contract_addr = receipt.contractAddress;
          myContract = myContract.at(contract_addr);
          assert.notEqual(receipt, null, "Transaction receipt shouldn't be null");
          assert.notEqual(contract_addr, null, "Transaction did not create a contract");
          done();
        });
      });
      it("Should verify there's code at the address", function(done) {
        web3.eth.getCode(contract_addr, function(err, result) {
          assert.equal(err, undefined);
          assert.notEqual(result, null);
          assert.notEqual(result, "0x0");
          done();
        });
      });
      it("Should add and withdraw some funds", function(done) {
        var funds = utility.ethToWei(1500);
        var withdraw = utility.ethToWei(500);
        utility.testSend(web3, myContract, contract_addr, 'addFunds', [{gas: 1000000, value: funds}], accounts[0], undefined, 0, function(err, result) {
          assert.equal(err, undefined);
          utility.testSend(web3, myContract, contract_addr, 'withdrawFunds', [withdraw, {gas: 1000000, value: 0}], accounts[0], undefined, 0, function(err, result) {
            assert.equal(err, undefined);
            utility.testCall(web3, myContract, contract_addr, 'getFundsAndAvailable', [accounts[0]], function(err, result) {
              assert.equal(err, undefined);
              assert.equal(result[0].toNumber() != funds-withdraw || result[1].toNumber() != funds-withdraw, false);
              utility.testSend(web3, myContract, contract_addr, 'addFunds', [{gas: 1000000, value: funds}], accounts[1], undefined, 0, function(err, result) {
                assert.equal(err, undefined);
                utility.testCall(web3, myContract, contract_addr, 'getFundsAndAvailable', [accounts[1]], function(err, result) {
                  assert.equal(err, undefined);
                  assert.equal(result[0].toNumber() != funds || result[1].toNumber() != funds, false);
                  done();
                });
              });
            });
          });
        });
      });
      it("Should become a market maker", function(done) {
        var funds = utility.ethToWei(1000);
        var server = "http://localhost:8081";
        utility.testSend(web3, myContract, contract_addr, 'marketMaker', [server, {gas: 1000000, value: 0}], accounts[0], undefined, 0, function(err, result) {
          assert.equal(err, undefined);
          utility.testCall(web3, myContract, contract_addr, 'getMarketMakers', [], function(err, result) {
            assert.equal(err, undefined);
            assert.equal(result.equals([server, "", "", "", ""]), false);
            utility.testCall(web3, myContract, contract_addr, 'getMarketMakerFunds', [], function(err, result) {
              assert.equal(err, undefined);
              assert.equal(result.equals([funds, 0, 0, 0, 0]), false);
              done();
            });
          });
        });
      });
      it("Should check option chain", function(done) {
        utility.testCall(web3, myContract, contract_addr, 'getMarket', [accounts[0]], function(err, result) {
          assert.equal(err, undefined);
          assert.equal(!result[0].slice(0,10).map(function(x){return x.toNumber()}).equals([0,1,2,3,4,5,6,7,8,9]), false);
          assert.equal(!result[1].slice(0,10).map(function(x){return x.toNumber()}).equals(strikes), false);
          assert.equal(!result[2].slice(0,10).map(function(x){return x.toNumber()}).equals([0,0,0,0,0,0,0,0,0,0]), false);
          assert.equal(!result[3].slice(0,10).map(function(x){return x.toNumber()}).equals([0,0,0,0,0,0,0,0,0,0]), false);
          done();
        });
      });
      it("Should execute some trades", function(done) {
        function makeTrade(trade, callback) {
          var optionID = trade.optionID ? trade.optionID : 0;
          var orderAccount = accounts[0];
          var counterpartyAccount = accounts[1];
          var orderID = utility.getRandomInt(0,Math.pow(2,64));
          var blockExpires = 10;
          var price = trade.price ? trade.price : utility.ethToWei(0.50000);
          var size = trade.size ? trade.size : utility.ethToWei(1.0000);
          var matchSize = trade.matchSize ? trade.matchSize : utility.ethToWei(-0.50000);
          utility.testCall(web3, myContract, contract_addr, 'getMarket', [orderAccount], function(err, result) {
            assert.equal(err, undefined);
            var initialPosition = result[2];
            var initialCash = result[3];
            web3.eth.getBlockNumber(function(err, blockNumber) {
              assert.equal(err, undefined);
              blockExpires = blockNumber + blockExpires;
              var option = {optionID: optionID};
              var condensed = utility.pack([option.optionID, price, size, orderID, blockExpires], [256, 256, 256, 256, 256]);
              var hash = sha256(new Buffer(condensed,'hex'));
              utility.sign(web3, orderAccount, hash, undefined, function(sig) {
                if (!sig) callback("Signature failed");
                var order = {optionID: option.optionID, price: price, size: size, orderID: orderID, blockExpires: blockExpires, addr: orderAccount, v: sig.v, r: sig.r, s: sig.s, hash: '0x'+hash};
                utility.testCall(web3, myContract, contract_addr, 'orderMatchTest', [order.optionID, order.price, order.size, order.orderID, order.blockExpires, order.addr, counterpartyAccount, 0, matchSize], function(err, result) {
                  if (!result) callback("Order match failure");
                  utility.testSend(web3, myContract, contract_addr, 'orderMatch', [order.optionID, order.price, order.size, order.orderID, order.blockExpires, order.addr, order.v, order.r, order.s, matchSize, {gas: 4000000, value: 0}], counterpartyAccount, undefined, 0, function(err, result) {
                    assert.equal(err, undefined);
                    utility.testCall(web3, myContract, contract_addr, 'getMarket', [orderAccount], function(err, result) {
                      assert.equal(err, undefined);
                      var finalPosition = result[2];
                      var finalCash = result[3];
                      if (finalPosition[optionID].sub(initialPosition[optionID])!=-matchSize) callback("Position match failure");
                      callback();
                    });
                  });
                });
              });
            });
          });
        }
        var trades = [];
        for (var i=0; i<4; i++) {
          var size = utility.roundTo(Math.random(),4);
          var price = utility.roundTo(Math.random(),4);
          var matchSize = -size;
          var optionID = Math.floor(Math.random()*10);
          trades.push({optionID: optionID, price: utility.ethToWei(price), size: utility.ethToWei(size), matchSize: utility.ethToWei(matchSize)});
        }
        trades.push({optionID: 0, price: utility.ethToWei(1.000), size: utility.ethToWei(1.000), matchSize: utility.ethToWei(-1.000)});
        trades.push({optionID: 7, price: utility.ethToWei(1.000), size: utility.ethToWei(-1.000), matchSize: utility.ethToWei(1.000)});
        async.eachSeries(trades, function(trade, callback_each) {
          makeTrade(trade, function(err) {
            if (err) {
              callback_each(err);
            } else {
              callback_each();
            }
          });
        }, function(err){
          assert.equal(err, undefined);
          done();
        });
      });
      it("Should check position sums", function(done) {
        utility.testCall(web3, myContract, contract_addr, 'getMarket', [accounts[0]], function(err, result) {
          assert.equal(err, undefined);
          var positions1 = result[2];
          var cashes1 = result[3];
          utility.testCall(web3, myContract, contract_addr, 'getMarket', [accounts[1]], function(err, result) {
            assert.equal(err, undefined);
            var positions2 = result[2];
            var cashes2 = result[3];
            for (var i=0; i<positions1.length; i++) {
              assert.equal(positions1[i].toNumber()+positions2[i].toNumber()!=0, false);
              assert.equal(cashes1[i].toNumber()+cashes2[i].toNumber()!=0, false);
            }
            done();
          });
        });
      });
      it("Should check available funds", function(done) {
        utility.testCall(web3, myContract, contract_addr, 'getFundsAndAvailable', [accounts[0]], function(err, result) {
          assert.equal(err, undefined);
          var funds = result[0].toNumber();
          var available = result[1].toNumber();
          utility.testCall(web3, myContract, contract_addr, 'getMarket', [accounts[0]], function(err, result) {
            assert.equal(err, undefined);
            var strikes = result[1].map(function(x){return x.toNumber()});
            var positions = result[2].map(function(x){return x.toNumber()});
            var cashes = result[3].map(function(x){return x.toNumber()});
            utility.testCall(web3, myContract, contract_addr, 'getOptionChain', [], function(err, result) {
              var margin = result[2].toNumber();
              var realityID = result[3];
              var factHash = result[4];
              var ethAddr = result[5];
              var maxLoss = undefined;
              for (var i=0; i<strikes.length; i++) {
                //on the strike
                var loss = cashes[0] / 1000000000000000000;
                var settlement = Math.abs(strikes[i]);
                for (var j=0; j<strikes.length; j++) {
                  if (strikes[j]>0 && settlement>strikes[j]) {
                    loss = loss + positions[j] * Math.min(margin, settlement - strikes[j]) / 1000000000000000000;
                  } else if (strikes[j]<0 && settlement<-strikes[j]) {
                    loss = loss + positions[j] * Math.min(margin, -strikes[j] - settlement) / 1000000000000000000;
                  }
                }
                if (maxLoss==undefined || loss<maxLoss) {
                  maxLoss = loss;
                }
                //margin away from the strike in the in the money direction
                loss = cashes[0] / 1000000000000000000;
                settlement = strikes[i]>0 ? strikes[i]+margin : Math.max(0,-strikes[i]-margin);
                for (var j=0; j<strikes.length; j++) {
                  if (strikes[j]>0 && settlement>strikes[j]) {
                    loss = loss + positions[j] * Math.min(margin, settlement - strikes[j]) / 1000000000000000000;
                  } else if (strikes[j]<0 && settlement<-strikes[j]) {
                    loss = loss + positions[j] * Math.min(margin, -strikes[j] - settlement) / 1000000000000000000;
                  }
                }
                if (maxLoss==undefined || loss<maxLoss) {
                  maxLoss = loss;
                }
              }
              assert.equal(available != funds + maxLoss, false);
              done();
            });
          });
        });
      });
      it("Should expire", function(done) {
        utility.testCall(web3, myContract, contract_addr, 'getOptionChain', [], function(err, result) {
          var margin = result[2];
          var realityID = result[3];
          var factHash = result[4];
          var ethAddr = result[5];
          var r = '0x76f6018a8c182f7da65c2cd0a9c10c20c1636d5c95dc0f3645671d3d71ef926f';
          var s = '0xb644a2bec11216221a403fe20f868a8aa18c49feb30b1e64ee4b398f15fcf694';
          var v = 28;
          var value = '0x0000000000000000000000000000000000000000000000009d140d4cd91b0000';
          utility.testCall(web3, myContract, contract_addr, 'getFundsAndAvailable', [accounts[0]], function(err, result) {
            assert.equal(err, undefined);
            var funds = result[0];
            var available = result[0];
            utility.testCall(web3, myContract, contract_addr, 'getMarket', [accounts[0]], function(err, result) {
              assert.equal(err, undefined);
              var strikes = result[1];
              var positions = result[2];
              var cashes = result[3];
              var expectedFundChange = funds.add(cashes[0].divToInt(1000000000000000000));
              var settlement = new BigNumber(utility.hex_to_dec(value));
              for (var i=0; i<strikes.length; i++) {
                if (strikes[i].gt(new BigNumber(0)) && settlement.gt(strikes[i])) {
                  if (margin.gt(settlement.sub(strikes[i]))) {
                    expectedFundChange = expectedFundChange.add(positions[i].mul(settlement.sub(strikes[i])).divToInt(1000000000000000000));
                  } else {
                    expectedFundChange = expectedFundChange.add(positions[i].mul(margin).divToInt(1000000000000000000));
                  }
                } else if (strikes[i].lt(new BigNumber(0)) && settlement.lt(strikes[i].neg())) {
                  if (margin.gt(strikes[i].neg().sub(settlement))) {
                    expectedFundChange = expectedFundChange.add(positions[i].mul(strikes[i].neg().sub(settlement)).divToInt(1000000000000000000));
                  } else {
                    expectedFundChange = expectedFundChange.add(positions[i].mul(margin).divToInt(1000000000000000000));
                  }
                }
              }
              web3.eth.getBalance(accounts[0], function(err, result) {
                assert.equal(err, undefined);
                var balanceBefore = result;
                utility.testSend(web3, myContract, contract_addr, 'expire', [0, v, r, s, value, {gas: 4000000, value: 0}], accounts[1], undefined, 0, function(err, result) {
                  assert.equal(err, undefined);
                  utility.testCall(web3, myContract, contract_addr, 'getFundsAndAvailable', [accounts[0]], function(err, result) {
                    assert.equal(err, undefined);
                    var funds = result[0].toNumber();
                    var available = result[0].toNumber();
                    assert.equal(funds!=0 || available!=0, false);
                    web3.eth.getBalance(accounts[0], function(err, result) {
                      assert.equal(err, undefined);
                      var balanceAfter = result;
                      assert.equal(utility.roundTo(Number(utility.weiToEth(balanceAfter.sub(balanceBefore).toNumber())),6)!=utility.roundTo(Number(utility.weiToEth(expectedFundChange)),6), false);
                      done();
                    });
                  });
                });
              });
            });
          });
        });
      });
      it("Should check option chain now expired", function(done) {
        utility.testCall(web3, myContract, contract_addr, 'getMarket', [accounts[0]], function(err, result) {
          assert.equal(err, undefined);
          var strikes = result[1].map(function(x){return x.toNumber()});
          var positions = result[2].map(function(x){return x.toNumber()});
          var cashes = result[3].map(function(x){return x.toNumber()});
          assert.equal(strikes.filter(function(x){return x!=0}).length>0 || positions.filter(function(x){return x!=0}).length>0 || cashes.filter(function(x){return x!=0}).length>0, false);
          done();
        });
      });
      it("Should check that contract balance is now zero", function(done){
        web3.eth.getBalance(contract_addr, function(err, result) {
          assert.equal(err, undefined);
          if (result.toNumber()!=0) done("Contract balance should be zero");
          done();
        });
      });
  });

});
