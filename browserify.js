var Web3 = require('web3');
var utility = require('./common/utility.js');
var request = require('request');
var sha256 = require('js-sha256').sha256;
var BigNumber = require('bignumber.js');
require('datejs');
var async = (typeof(window) === 'undefined') ? require('async') : require('async/dist/async.min.js');

function Main() {
}
Main.alertInfo = function(message) {
  $('#notifications-container').css('display', 'block');
  $('#notifications').prepend($('<p>' + message + '</p>').hide().fadeIn(2000));
  console.log(message);
}
Main.alertTxResult = function(err, result) {
  if (result.txHash) {
    Main.alertInfo('You just created an Ethereum transaction. Track its progress here: <a href="http://'+(config.ethTestnet ? 'testnet.' : '')+'etherscan.io/tx/'+result.txHash+'" target="_blank">'+result.txHash+'</a>.');
  } else {
    Main.alertInfo('You tried to send an Ethereum transaction but there was an error: '+err);
  }
}
Main.tooltip = function(message) {
  return '<a href="#" data-toggle="tooltip" data-placement="bottom" title="'+message+'"><i class="fa fa-question-circle fa-lg"></i></a>';
}
Main.tooltips = function() {
  $(function () {
    $('[data-toggle="tooltip"]').tooltip()
  });
}
Main.popovers = function() {
  $(function () {
    $('[data-toggle="popover"]').popover()
  });
}
Main.createCookie = function(name,value,days) {
  if (localStorage) {
    localStorage.setItem(name, value);
  } else {
    if (days) {
      var date = new Date();
      date.setTime(date.getTime()+(days*24*60*60*1000));
      var expires = "; expires="+date.toGMTString();
    }
    else var expires = "";
    document.cookie = name+"="+value+expires+"; path=/";
  }
}
Main.readCookie = function(name) {
  if (localStorage) {
    return localStorage.getItem(name);
  } else {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
      var c = ca[i];
      while (c.charAt(0)==' ') c = c.substring(1,c.length);
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
  }
}
Main.eraseCookie = function(name) {
  if (localStorage) {
    localStorage.removeItem(name);
  } else {
    createCookie(name,"",-1);
  }
}
Main.logout = function() {
  addrs = [config.ethAddr];
  pks = [config.ethAddrPrivateKey];
  selectedAccount = 0;
  nonce = undefined;
  marketMakers = {};
  browserOrders = [];
  Main.refresh(function(){});
}
Main.createAccount = function() {
  var newAccount = utility.createAccount();
  var addr = newAccount.address;
  var pk = newAccount.privateKey;
  Main.addAccount(addr, pk);
  Main.alertInfo('You just created an Ethereum account: '+addr+'.');
}
Main.deleteAccount = function() {
  addrs.splice(selectedAccount, 1);
  pks.splice(selectedAccount, 1);
  selectedAccount = 0;
  nonce = undefined;
  marketMakers = {};
  browserOrders = [];
  Main.refresh(function(){});
}
Main.selectAccount = function(i) {
  selectedAccount = i;
  nonce = undefined;
  marketMakers = {};
  browserOrders = [];
  Main.refresh(function(){});
}
Main.addAccount = function(addr, pk) {
  if (addr.slice(0,2)!='0x') addr = '0x'+addr;
  if (pk.slice(0,2)=='0x') pk = pk.slice(2);
  addr = utility.toChecksumAddress(addr);
  if (pk!=undefined && pk!='' && !utility.verifyPrivateKey(addr, pk)) {
    Main.alertInfo('For account '+addr+', the private key is invalid.');
  } else if (!web3.isAddress(addr)) {
    Main.alertInfo('The specified account, '+addr+', is invalid.');
  } else {
    addrs.push(addr);
    pks.push(pk);
    selectedAccount = addrs.length-1;
    nonce = undefined;
    marketMakers = {};
    browserOrders = [];
    Main.refresh(function(){});
  }
}
Main.showPrivateKey = function() {
  var addr = addrs[selectedAccount];
  var pk = pks[selectedAccount];
  if (pk==undefined || pk=='') {
    Main.alertInfo('For account '+addr+', there is no private key available. You can still transact if you are connected to Geth and the account is unlocked.');
  } else {
    Main.alertInfo('For account '+addr+', the private key is '+pk+'.');
  }
}
Main.shapeshift_click = function(a,e) {
  e.preventDefault();
  var link=a.href;
  window.open(link,'1418115287605','width=700,height=500,toolbar=0,menubar=0,location=0,status=1,scrollbars=1,resizable=0,left=0,top=0');
  return false;
}
Main.processOrders = function(callback) {
  utility.blockNumber(web3, function(err, blockNumber) {
    //process orders
    browserOrders = browserOrders.filter(function(browserOrder){return blockNumber<browserOrder.blockNumber+browserOrder.expires && browserOrder.size!=0});
    async.eachSeries(browserOrders,
      function(browserOrder, callbackBrowserOrder) {
        if (blockNumber>=browserOrder.lastUpdated+browserOrder.update) {
          browserOrder.lastUpdated = blockNumber;
          //update option
          browserOrder.option = optionsCache.filter(function(option){return option.contractAddr == browserOrder.option.contractAddr && option.optionID == browserOrder.option.optionID})[0];
          if (browserOrder.positionLock!=undefined) {
            browserOrder.size -= (browserOrder.option.position-browserOrder.positionLock); //update remaining size based on change in position
          }
          browserOrder.positionLock = browserOrder.option.position;
          if ((browserOrder.priceAbove==undefined || price>browserOrder.priceAbove) && (browserOrder.priceBelow==undefined || price<browserOrder.priceBelow) && (Date.now()-priceUpdated<30*1000)) {
            browserOrder.priceTied = browserOrder.price;
            if (browserOrder.tie!=undefined && browserOrder.delta!=undefined) {
              browserOrder.priceTied = browserOrder.price + browserOrder.delta * 1000000000000000000 * (price - browserOrder.tie);
            }
            //market maker order
            if (browserOrder.marketMaker) {
              var marketMaker = marketMakers[browserOrder.marketMaker];
              if (marketMaker) {
                var theo = 0;
                for (var i=0; i<marketMaker.pdf.length; i++) {
                  theo += (browserOrder.option.kind=='Call' ? Math.max(0,Math.min(browserOrder.option.margin, marketMaker.pdf[i][0]-browserOrder.option.strike)) : Math.max(0,Math.min(browserOrder.option.margin, browserOrder.option.strike-marketMaker.pdf[i][0]))) * marketMaker.pdf[i][1];
                }
                if (browserOrder.size>0) {
                  browserOrder.size = marketMaker.size;
                  browserOrder.price = (Math.max(0,theo-marketMaker.width/2)).toFixed(2)*1000000000000000000;
                } else {
                  browserOrder.size = -marketMaker.size;
                  browserOrder.price = (Math.max(0,theo+marketMaker.width/2)).toFixed(2)*1000000000000000000;
                }
                browserOrder.priceTied = browserOrder.price;
              } else {
                browserOrder.size = 0;
              }
            }
            //send the remainder of the order to rest on the order book
            function sendToOrderBook() {
              if (browserOrder.size-cumulativeMatchSize!=0) {
                browserOrder.priceTied = utility.roundToNearest(browserOrder.priceTied, 1000000);
                utility.blockNumber(web3, function(err, blockNumber) {
                  var orderID = utility.getRandomInt(0,Math.pow(2,32));
                  var blockExpires = blockNumber + browserOrder.update;
                  var condensed = utility.pack([browserOrder.option.optionID, browserOrder.priceTied, browserOrder.size-cumulativeMatchSize, orderID, blockExpires], [256, 256, 256, 256, 256]);
                  var hash = sha256(new Buffer(condensed,'hex'));
                  utility.sign(web3, addrs[selectedAccount], hash, pks[selectedAccount], function(err, sig) {
                    if (sig) {
                      var order = {contractAddr: browserOrder.option.contractAddr, optionID: browserOrder.option.optionID, price: browserOrder.priceTied, size: browserOrder.size-cumulativeMatchSize, orderID: orderID, blockExpires: blockExpires, addr: addrs[selectedAccount], v: sig.v, r: sig.r, s: sig.s, hash: '0x'+hash};
                      condensed = utility.pack([order.optionID, order.price, order.size, order.orderID, order.blockExpires], [256, 256, 256, 256, 256]);
                      hash = '0x'+sha256(new Buffer(condensed,'hex'));
                      var verified = utility.verify(web3, order.addr, order.v, order.r, order.s, order.hash);
                      utility.call(web3, myContract, browserOrder.option.contractAddr, 'getFunds', [order.addr, false], function(err, result) {
                        var balance = result.toNumber();
                        utility.call(web3, myContract, browserOrder.option.contractAddr, 'getMaxLossAfterTrade', [order.addr, order.optionID, order.size, -order.size*order.price], function(err, result) {
                          balance = balance + result.toNumber();
                          if (!verified) {
                            Main.alertInfo('You tried sending an order to the order book, but signature verification failed.');
                            callbackBrowserOrder();
                          } else if (balance<=0) {
                            Main.alertInfo('You tried sending an order to the order book, but you do not have enough funds to place your order. You need to add '+(utility.weiToEth(-balance))+' eth to your account to cover this trade. ');
                            callbackBrowserOrder();
                          } else if (blockNumber<=order.blockExpires && verified && hash==order.hash && balance>=0) {
                            utility.postGitterMessage(JSON.stringify(order), function(err, result){
                              if (!err) {
                                Main.alertInfo('You sent an order to the order book!');
                              } else {
                                Main.alertInfo('You tried sending an order to the order book but there was an error.');
                              }
                              callbackBrowserOrder();
                            });
                          } else {
                            callbackBrowserOrder();
                          }
                        });
                      });
                    } else {
                      Main.alertInfo('You tried sending an order to the order book, but it could not be signed.');
                      console.log(err);
                      callbackBrowserOrder();
                    }
                  });
                });
              } else {
                callbackBrowserOrder();
              }
            }
            //match against existing orders
            var cumulativeMatchSize = 0;
            if (browserOrder.postOnly==false) { //as long as postOnly isn't set
              var matchOrders = browserOrder.size>0 ? browserOrder.option.sellOrders : browserOrder.option.buyOrders;
              async.each(matchOrders,
                function(matchOrder, callbackMatchOrder) {
                  if ((browserOrder.size>0 && browserOrder.priceTied>=matchOrder.order.price) || (browserOrder.size<0 && browserOrder.priceTied<=matchOrder.order.price)) {
                    var matchSize = 0;
                    if (Math.abs(cumulativeMatchSize)>=Math.abs(browserOrder.size)) {
                      //we've attempted to match enough size already
                    } else if (Math.abs(browserOrder.size-cumulativeMatchSize)>=Math.abs(matchOrder.size)) { //the order is bigger than the match order
                      matchSize = -matchOrder.order.size;
                    } else { //the match order covers the order
                      matchSize = browserOrder.size-cumulativeMatchSize;
                    }
                    if (matchSize!=0) {
                      cumulativeMatchSize += matchSize; //let's assume the order will go through
                      var deposit = utility.ethToWei(0);
                      utility.call(web3, myContract, browserOrder.option.contractAddr, 'orderMatchTest', [matchOrder.order.optionID, matchOrder.order.price, matchOrder.order.size, matchOrder.order.orderID, matchOrder.order.blockExpires, matchOrder.order.addr, addrs[selectedAccount], deposit, matchSize], function(err, result) {
                        if (result && blockNumber<matchOrder.order.blockExpires-1) {
                          utility.send(web3, myContract, browserOrder.option.contractAddr, 'orderMatch', [matchOrder.order.optionID, matchOrder.order.price, matchOrder.order.size, matchOrder.order.orderID, matchOrder.order.blockExpires, matchOrder.order.addr, matchOrder.order.v, matchOrder.order.r, matchOrder.order.s, matchSize, {gas: browserOrder.gas, value: deposit}], addrs[selectedAccount], pks[selectedAccount], nonce, function(err, result) {
                            txHash = result.txHash;
                            nonce = result.nonce;
                            Main.alertInfo('Some of your order ('+utility.weiToEth(Math.abs(matchSize))+' eth) was sent to the blockchain to match against a resting order.');
                            Main.alertTxResult(err, result);
                            callbackMatchOrder();
                          });
                        } else {
                          Main.alertInfo('You tried to match against a resting order but the order match failed. This can be because the order expired or traded already, or either you or the counterparty do not have enough funds to cover the trade.');
                          callbackMatchOrder();
                        }
                      });
                    } else {
                      callbackMatchOrder();
                    }
                  } else {
                    callbackMatchOrder();
                  }
                },
                function(err) {
                  sendToOrderBook();
                }
              );
            } else {
              sendToOrderBook();
            }
          }
        } else {
          callbackBrowserOrder();
        }
      },
      function(err) {
        //update display
        new EJS({url: config.homeURL+'/'+'orders_table.ejs'}).update('orders', {orders: browserOrders, utility: utility, blockNumber: blockNumber});
        callback();
      }
    );
  });
}
Main.order = function(option, price, size, expires, update, gas, priceAbove, priceBelow, delta, tie, postOnly) {
  option = JSON.parse(option);
  size = utility.ethToWei(size);
  price = price * 1000000000000000000;
  gas = Number(gas);
  expires = Number(expires);
  update = Number(update);
  priceAbove = priceAbove ? Number(priceAbove) : undefined;
  priceBelow = priceBelow ? Number(priceBelow) : undefined;
  delta = delta ? Number(delta) : undefined;
  tie = tie ? Number(tie) : undefined;
  postOnly = postOnly=='true' ? true : false;
  utility.blockNumber(web3, function(err, blockNumber) {
    var order = {option: option, price: price, size: size, expires: expires, update: update, gas: gas, priceAbove: priceAbove, priceBelow: priceBelow, delta: delta, tie: tie, postOnly: postOnly, blockNumber: blockNumber, lastUpdated: 0};
    browserOrders.push(order);
    Main.refresh(function(){});
  });
}
Main.marketMakeStart = function(contractAddr, pdf, size, width, postOnly) {
  utility.blockNumber(web3, function(err, blockNumber) {
    size = utility.ethToWei(size);
    pdf = JSON.parse(pdf);
    width = Number(width);
    postOnly = postOnly=='true' ? true : false;
    marketMakers[contractAddr] = {pdf: pdf, size: size, contractAddr: contractAddr, width: width};
    browserOrders = browserOrders.filter(function(browserOrder){return browserOrder.marketMaker!=contractAddr});
    optionsCache.filter(function(option) {return option.contractAddr==contractAddr}).forEach(function(option) {
      var orderBuy = {marketMaker: contractAddr, option: option, price: undefined, size: 1, expires: 1000000, update: 5, gas: 1000000, priceAbove: undefined, priceBelow: undefined, delta: undefined, tie: undefined, postOnly: postOnly, blockNumber: blockNumber, lastUpdated: 0};
      browserOrders.push(orderBuy);
      var orderSell = {marketMaker: contractAddr, option: option, price: undefined, size: -1, expires: 1000000, update: 5, gas: 1000000, priceAbove: undefined, priceBelow: undefined, delta: undefined, tie: undefined, postOnly: postOnly, blockNumber: blockNumber, lastUpdated: 0};
      browserOrders.push(orderSell);
    });
    Main.processOrders(function(){});
  });
}
Main.marketMakeStop = function(contractAddr) {
  delete marketMakers[contractAddr];
  browserOrders = browserOrders.filter(function(browserOrder){return browserOrder.marketMaker!=contractAddr});
}
Main.fund = function(amount, contractAddr) {
  amount = utility.ethToWei(amount);
  utility.send(web3, myContract, contractAddr, 'addFunds', [{gas: 200000, value: amount}], addrs[selectedAccount], pks[selectedAccount], nonce, function(err, result) {
    txHash = result.txHash;
    nonce = result.nonce;
    Main.alertTxResult(err, result);
  });
}
Main.withdraw = function(amount, contractAddr) {
  amount = utility.ethToWei(amount);
  utility.call(web3, myContract, contractAddr, 'getFundsAndAvailable', [addrs[selectedAccount]], function(err, result) {
    if (!err) {
      var fundsAvailable = result[1].toNumber();
      if (amount>fundsAvailable) amount = fundsAvailable;
    }
    if (amount>0) {
      utility.send(web3, myContract, contractAddr, 'withdrawFunds', [amount, {gas: 300000, value: 0}], addrs[selectedAccount], pks[selectedAccount], nonce, function(err, result) {
        txHash = result.txHash;
        nonce = result.nonce;
        Main.alertTxResult(err, result);
      });
    }
  });
}
Main.expireCheck = function(contractAddr, callback) {
  var firstOption = optionsCache.filter(function(x){return x.contractAddr==contractAddr})[0]
  var realityID = firstOption.realityID;
  request.get('https://www.realitykeys.com/api/v1/exchange/'+realityID+'?accept_terms_of_service=current', function(err, httpResponse, body){
    if (!err) {
      result = JSON.parse(body);
      var signedHash = '0x'+result.signature_v2.signed_hash;
      var value = '0x'+result.signature_v2.signed_value;
      var factHash = '0x'+result.signature_v2.fact_hash;
      var sigR = '0x'+result.signature_v2.sig_r;
      var sigS = '0x'+result.signature_v2.sig_s;
      var sigV = result.signature_v2.sig_v;
      var settlement = result.winner_value;
      var machineSettlement = result.machine_resolution_value;
      if (sigR && sigS && sigV && value) {
        callback([true, settlement]);
      } else if (machineSettlement) {
        callback([false, machineSettlement]);
      } else if (settlement) {
        callback([false, settlement]);
      } else {
        callback([false, undefined]);
      }
    }
  });
}
Main.expire = function(contractAddr) {
  var firstOption = optionsCache.filter(function(x){return x.contractAddr==contractAddr})[0]
  var realityID = firstOption.realityID;
  request.get('https://www.realitykeys.com/api/v1/exchange/'+realityID+'?accept_terms_of_service=current', function(err, httpResponse, body){
    if (!err) {
      result = JSON.parse(body);
      var signedHash = '0x'+result.signature_v2.signed_hash;
      var value = '0x'+result.signature_v2.signed_value;
      var factHash = '0x'+result.signature_v2.fact_hash;
      var sigR = '0x'+result.signature_v2.sig_r;
      var sigS = '0x'+result.signature_v2.sig_s;
      var sigV = result.signature_v2.sig_v;
      var settlement = result.winner_value;
      if (sigR && sigS && sigV && value) {
        Main.alertInfo("Expiring "+firstOption.expiration+" using settlement price: "+settlement);
        utility.send(web3, myContract, contractAddr, 'expire', [0, sigV, sigR, sigS, value, {gas: 1000000, value: 0}], addrs[selectedAccount], pks[selectedAccount], nonce, function(err, result) {
          txHash = result.txHash;
          nonce = result.nonce;
          Main.alertTxResult(err, result);
        });
      }
    }
  });
}
Main.publishExpiration = function(address) {
  utility.send(web3, contractsContract, config.contractContractsAddr, 'newContract', [address, {gas: 300000, value: 0}], addrs[selectedAccount], pks[selectedAccount], nonce, function(err, esult) {
    txHash = result.txHash;
    nonce = result.nonce;
    Main.alertTxResult(err, result);
  });
}
Main.disableExpiration = function(address) {
  utility.send(web3, contractsContract, config.contractContractsAddr, 'disableContract', [address, {gas: 300000, value: 0}], addrs[selectedAccount], pks[selectedAccount], nonce, function(err, result) {
    txHash = result.txHash;
    nonce = result.nonce;
    Main.alertTxResult(err, result);
  });
}
Main.newExpiration = function(date, calls, puts, margin) {
  var fromcur = "ETH";
  var tocur = "USD";
  margin = Number(margin);
  var expiration = date;
  var expirationTimestamp = Date.parse(expiration+" 00:00:00 +0000").getTime()/1000;
  var strikes = calls.split(",").map(function(x){return Number(x)}).slice(0,5).concat(puts.split(",").map(function(x){return -Number(x)}).slice(0,5));
  strikes.sort(function(a,b){ return Math.abs(a)-Math.abs(b) || a-b });
  request.post('https://www.realitykeys.com/api/v1/exchange/new', {form: {fromcur: fromcur, tocur: tocur, settlement_date: expiration, objection_period_secs: '86400', accept_terms_of_service: 'current', use_existing: '1'}}, function(err, httpResponse, body){
    if (!err) {
      result = JSON.parse(body);
      var realityID = result.id;
      var factHash = '0x'+result.signature_v2.fact_hash;
      var ethAddr = '0x'+result.signature_v2.ethereum_address;
      var originalStrikes = strikes;
      var scaledStrikes = strikes.map(function(strike) { return strike*1000000000000000000 });
      var scaledMargin = margin*1000000000000000000;
      Main.alertInfo("You are creating a new contract. This will involve two transactions. After the first one is confirmed, the second one will be sent. Please be patient.");
      utility.readFile(config.contractMarket+'.bytecode', function(err, bytecode){
        bytecode = JSON.parse(bytecode);
        utility.send(web3, myContract, undefined, 'constructor', [expirationTimestamp, fromcur+"/"+tocur, scaledMargin, realityID, factHash, ethAddr, scaledStrikes, {from: addrs[selectedAccount], data: bytecode, gas: 4712388, gasPrice: config.ethGasPrice}], addrs[selectedAccount], pks[selectedAccount], nonce, function(err, result) {
          if(result) {
            txHash = result.txHash;
            nonce = result.nonce;
            Main.alertTxResult(err, result);
            var address = undefined;
            async.whilst(
                function () { return address==undefined; },
                function (callbackWhilst) {
                    setTimeout(function () {
                      utility.txReceipt(web3, txHash, function(err, receipt) {
                        if (receipt) {
                          address = receipt.contractAddress;
                        }
                        console.log("Waiting for contract creation to complete.");
                        callbackWhilst(null);
                      });
                    }, 10*1000);
                },
                function (err) {
                  Main.alertInfo("Here is the new contract address: "+address+". We will now send a transaction to the contract that keeps track of expirations so that the new expiration will show up on Etheropt.");
                  //notify contracts contract of new contract
                  utility.send(web3, contractsContract, config.contractContractsAddr, 'newContract', [address, {gas: 300000, value: 0}], addrs[selectedAccount], pks[selectedAccount], nonce, function(err, result) {
                    txHash = result.txHash;
                    nonce = result.nonce;
                    Main.alertTxResult(err, result);
                  });
                }
            );
          }
        });
      });
    }
  });
}
Main.connectionTest = function() {
  if (connection) return connection;
  connection = {connection: 'Proxy', provider: 'http://'+(config.ethTestnet ? 'testnet.' : '')+'etherscan.io', testnet: config.ethTestnet};
  try {
    if (web3.currentProvider) {
      web3.eth.coinbase;
      connection = {connection: 'Geth', provider: config.ethProvider, testnet: config.ethTestnet};
    }
  } catch(err) {
    web3.setProvider(undefined);
  }
  new EJS({url: config.homeURL+'/'+'connection_description.ejs'}).update('connection', {connection: connection});
  Main.popovers();
  return connection;
}
Main.loadAccounts = function(callback) {
  if (Main.connectionTest().connection=='Geth') {
    $('#pk_div').hide();
  }
  if (addrs.length<=0 || addrs.length!=pks.length) {
    addrs = [config.ethAddr];
    pks = [config.ethAddrPrivateKey];
    selectedAccount = 0;
  }
  async.map(addrs,
    function(addr, callback) {
      utility.getBalance(web3, addr, function(err, balance) {
        callback(null, {addr: addr, balance: balance});
      });
    },
    function(err, addresses) {
      new EJS({url: config.homeURL+'/'+'addresses.ejs'}).update('addresses', {addresses: addresses, selectedAccount: selectedAccount});
      callback();
    }
  );
}
Main.displayMarket = function(callback) {
  if (contractsCache && optionsCache) {
    contractsCache.sort(function(a,b){return new Date(optionsCache.filter(function(x){return x.contractAddr==a.contractAddr}).length==0 ? "2020-01-01" : optionsCache.filter(function(x){return x.contractAddr==a.contractAddr})[0].expiration) - new Date(optionsCache.filter(function(x){return x.contractAddr==b.contractAddr}).length==0 ? "2020-01-01" : optionsCache.filter(function(x){return x.contractAddr==b.contractAddr})[0].expiration)});
    contractsCache.forEach(function(contract){
      var optionsFiltered = optionsCache.filter(function(x){return x.contractAddr==contract.contractAddr});
      var item = {
        type: 'component',
        componentName: 'layout',
        isClosable: false,
        title: optionsFiltered.length>0 ? optionsFiltered[0].expiration : contract.contractAddr.slice(0,12)+'...',
        componentState: { id: 'contract', type: 'ejs', data: {contract: contract} }
      };
      myLayout.root.contentItems[0].contentItems[0].contentItems[0].addChild( item );
      new EJS({url: config.homeURL+'/'+'contract_nav.ejs'}).update(contract.contractAddr+'_nav', {contract: contract, options: optionsCache});
      new EJS({url: config.homeURL+'/'+'contract_prices.ejs'}).update(contract.contractAddr+'_prices', {contract: contract, options: optionsCache, addr: addrs[selectedAccount]});
      myLayout.root.contentItems[0].contentItems[0].contentItems[0].setActiveContentItem(myLayout.root.contentItems[0].contentItems[0].contentItems[0].contentItems[1]);
    });
    $('#market-spinner').hide();
    Main.tooltips();
    if (callback) callback();
  } else {
    $('#market-spinner').show();
    Main.loadAccounts(function(){});
    Main.loadContractsFunds(function(){
      Main.loadOptions(function(){
        Main.loadPrices(function(){
          Main.loadLog(function(){
            Main.displayMarket(function(){
              if (callback) callback();
            });
          });
        });
      });
    });
  }
}
Main.loadPrices = function(callback) {
  utility.blockNumber(web3, function(err, blockNumber) {
    var orders = [];
    var expectedKeys = JSON.stringify(['addr','blockExpires','contractAddr','hash','optionID','orderID','price','r','s','size','v']);
    Object.keys(gitterMessagesCache).forEach(function(id) {
      var message = JSON.parse(JSON.stringify(gitterMessagesCache[id]));
      if (typeof(message)=='object' && JSON.stringify(Object.keys(message).sort())==expectedKeys) {
        message.id = id;
        if (!deadOrders[id]) {
          orders.push(message);
        }
      }
    });
    async.map(optionsCache,
      function(option, callbackMap){
        var ordersFiltered = orders.filter(function(x){return x.contractAddr==option.contractAddr && x.optionID==option.optionID});
        ordersFiltered = ordersFiltered.map(function(x){return {size: Math.abs(x.size), price: x.price/1000000000000000000, order: x}});
        var newBuyOrders = [];
        var newSellOrders = [];
        async.filter(ordersFiltered,
          function(order, callbackFilter) {
            order = order.order;
            if (blockNumber<order.blockExpires) {
              var condensed = utility.pack([order.optionID, order.price, order.size, order.orderID, order.blockExpires], [256, 256, 256, 256, 256]);
              var hash = '0x'+sha256(new Buffer(condensed,'hex'));
              var verified = false;
              try {
                var verified = utility.verify(web3, order.addr, order.v, order.r, order.s, order.hash);
              } catch(err) {
                console.log(err);
              }
              utility.call(web3, myContract, order.contractAddr, 'getFunds', [order.addr, false], function(err, result) {
                var balance = result.toNumber();
                utility.call(web3, myContract, order.contractAddr, 'getMaxLossAfterTrade', [order.addr, order.optionID, order.size, -order.size*order.price], function(err, result) {
                  balance = balance + result.toNumber();
                  if (verified && hash==order.hash && balance>=0) {
                    callbackFilter(true);
                  } else {
                    deadOrders[order.id] = true;
                    callbackFilter(false);
                  }
                });
              });
            } else {
              deadOrders[order.id] = true;
              callbackFilter(false);
            }
          },
          function(ordersValid) {
            for (var i=0; i<ordersValid.length; i++) {
              var order = ordersValid[i];
              if (order.order.size>0) newBuyOrders.push(order);
              if (order.order.size<0) newSellOrders.push(order);
            }
            option.buyOrders = newBuyOrders;
            option.sellOrders = newSellOrders;
            option.buyOrders.sort(function(a,b){return b.price - a.price || b.size - a.size || a.id - b.id});
            option.sellOrders.sort(function(a,b){return a.price - b.price || b.size - a.size || a.id - b.id});
            callbackMap(null, option);
          }
        );
      },
      function(err, options){
        //update last updated timer
        config.contractAddrs.forEach(function(contractAddr){
          var optionsFiltered = optionsCache ? optionsCache.filter(function(x){return x.contractAddr==contractAddr}) : [];
          if (optionsFiltered.length>0) {
            if (optionsFiltered[0].timer) clearInterval(optionsFiltered[0].timer);
            optionsFiltered[0].lastUpdated = Date.now();
            optionsFiltered[0].timer = setInterval(function () {
              function pad(val) {return val > 9 ? val : "0" + val;}
              var sec = Math.ceil((Date.now() - optionsFiltered[0].lastUpdated) / 1000);
              if ($('#'+contractAddr+"_updated").length) {
                $('#'+contractAddr+"_updated")[0].innerHTML = (pad(parseInt(sec / 60, 10)))+":"+(pad(++sec % 60));
              }
            }, 1000);
          }
        });
        //update cache
        optionsCache = options;
        callback();
      }
    );
  });
}
Main.loadPositions = function(callback) {
  async.map(config.contractAddrs,
    function(contractAddr, callback) {
      utility.call(web3, myContract, contractAddr, 'getMarket', [addrs[selectedAccount]], function(err, result) {
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
            function(i, callbackMap) {
              var cash = cashes[i].toNumber() / 1000000000000000000;
              var position = positions[i].toNumber();
              var option = {cash: cash, position: position, optionID: optionIDs[i], contractAddr: contractAddr};
              callbackMap(null, option);
            },
            function(err, options) {
              callback(null, options);
            }
          );
        } else {
          callback(null, []);
        }
      });
    },
    function(err, options) {
      options = options.reduce(function(a, b) {return a.concat(b);}, []);
      async.map(optionsCache,
        function(option, callbackMap) {
          for (var i=0; i<options.length; i++) {
            if (options[i].contractAddr==option.contractAddr && options[i].optionID==option.optionID) {
              option.position = options[i].position;
              option.cash = options[i].cash;
              return callbackMap(null, option);
            }
          }
          callbackMap(null, option);
        },
        function(err, options) {
          optionsCache = options;
          callback();
        }
      );
    }
  );
}
Main.loadLog = function(callback) {
  var cookie = Main.readCookie(config.eventsCacheCookie);
  if (cookie) eventsCache = JSON.parse(cookie);
  utility.blockNumber(web3, function(err, blockNumber) {
    var startBlock = 0;
    // startBlock = blockNumber-15000;
    for (id in eventsCache) {
      var event = eventsCache[id];
      if (event.blockNumber>startBlock) {
        startBlock = event.blockNumber;
      }
      for (arg in event.args) {
        if (typeof(event.args[arg])=='string' && event.args[arg].slice(0,2)!='0x' && /^(\d|\-)+$/.test(event.args[arg])) {
          event.args[arg] = new BigNumber(event.args[arg]);
        }
      }
    }
    async.eachSeries(config.contractAddrs,
      function(contractAddr, callbackEach){
        utility.logs(web3, myContract, contractAddr, startBlock, 'latest', function(err, event) {
          event.txLink = 'http://'+(config.ethTestnet ? 'testnet.' : '')+'etherscan.io/tx/'+event.transactionHash;
          eventsCache[event.transactionHash+event.logIndex] = event;
          Main.createCookie(config.eventsCacheCookie, JSON.stringify(eventsCache), 999);
          //we'll refresh enough that we don't need to update any gui here
        });
        callbackEach();
      },
      function (err) {
        callback();
      }
    );
  });
}
Main.loadContractsFunds = function(callback) {
  async.map(config.contractAddrs,
    function(contractAddr, callback) {
      utility.call(web3, myContract, contractAddr, 'getFundsAndAvailable', [addrs[selectedAccount]], function(err, result) {
        if (result) {
          var funds = result[0].toString();
          var fundsAvailable = result[1].toString();
          var contractLink = 'http://'+(config.ethTestnet ? 'testnet.' : '')+'etherscan.io/address/'+contractAddr;
          callback(null, {contractAddr: contractAddr, contractLink: contractLink, funds: funds, fundsAvailable: fundsAvailable});
        } else {
          callback(null, undefined);
        }
      });
    },
    function(err, contracts) {
      contractsCache = contracts.filter(function(x){return x!=undefined});
      callback();
    }
  );
}
Main.loadOptions = function(callback) {
  //Note: loadOptions loads everything it can about options and should be called less frequently. loadPositions loads just positions.
  async.mapSeries(config.contractAddrs,
    function(contractAddr, callback) {
      utility.call(web3, myContract, contractAddr, 'getOptionChain', [], function(err, result) {
        if (result) {
          var expiration = (new Date(result[0].toNumber()*1000)).toISOString().substring(0,10);
          var fromcur = result[1].split("/")[0];
          var tocur = result[1].split("/")[1];
          var margin = result[2].toNumber() / 1000000000000000000.0;
          var realityID = result[3].toNumber();
          utility.call(web3, myContract, contractAddr, 'getMarket', [addrs[selectedAccount]], function(err, result) {
            if (result) {
              var optionIDs = result[0];
              var strikes = result[1];
              var positions = result[2];
              var cashes = result[3];
              var is = [];
              for (var i=0; i<optionIDs.length; i++) {
                if (strikes[i].toNumber()!=0) is.push(i);
              }
              var optionChainDescription = {expiration: expiration, fromcur: fromcur, tocur: tocur, margin: margin, realityID: realityID};
              async.map(is,
                function(i, callbackMap) {
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
                  option.expiration = optionChainDescription.expiration;
                  option.fromcur = optionChainDescription.fromcur;
                  option.tocur = optionChainDescription.tocur;
                  option.margin = optionChainDescription.margin;
                  option.realityID = realityID;
                  callbackMap(null, option);
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
    function(err, options) {
      options = options.reduce(function(a, b) {return a.concat(b);}, []);
      options.sort(function(a,b){ return a.expiration-b.expiration || a.strike-b.strike || a.kind-b.kind});
      optionsCache = options;
      callback();
    }
  );
}
Main.drawChart = function(element, title, dataRows, xLabel, yLabel, columns) {
  var data = new google.visualization.DataTable();
  data.addColumn('number', xLabel);
  columns.forEach(function(column){
    data.addColumn(column);
  });
  data.addRows(dataRows);
  var options = {
    hAxis: {title: xLabel},
    vAxis: {title: yLabel},
    legend: {position: 'none'},
    enableInteractivity: true,
    title: title
  };
  var chart = new google.visualization.LineChart(document.getElementById(element));
  chart.draw(data, options);
}
Main.drawOptionChart = function(element, option, price, size) {
  if (option.kind=='Call') {
    var data = [];
    data.push([Math.max(option.strike-option.margin*1,0),size*(-price),null,null]);
    var label = size>0 ? 'Max loss' : 'Max profit';
    data.push([option.strike,size*(-price),label,label]);
    for (var x = option.strike; x<option.strike+option.margin; x+=option.margin/20.0) {
      data.push([x,size*(-price+(x-option.strike)),null,null]);
    }
    label = size<0 ? 'Max loss' : 'Max profit';
    data.push([option.strike+option.margin,size*(-price+option.margin),label,label]);
    data.push([option.strike+2*option.margin,size*(-price+option.margin),null,null]);
    var action = size>0 ? 'Buy' : 'Sell';
    Main.drawChart(element, action+" "+Math.abs(size)+" eth of the "+option.strike+" Call "+" for "+price, data, "ETH/USD price", "Net profit (eth)", [{type: 'number', role: null}, {type: 'string', role: 'annotation'}, {type: 'string', role: 'annotationText'}]);
  } else if (option.kind=='Put') {
    var data = [];
    data.push([Math.max(option.strike-option.margin*2,0),size*(-price+option.margin),null,null]);
    var label = size<0 ? 'Max loss' : 'Max profit';
    data.push([option.strike-option.margin,size*(-price+option.margin),label,label]);
    for (var x = option.strike-option.margin; x<option.strike; x+=option.margin/20.0) {
      data.push([x,size*(-price+(option.strike-x)),null,null]);
    }
    label = size>0 ? 'Max loss' : 'Max profit';
    data.push([option.strike,size*(-price),label,label]);
    data.push([option.strike+1*option.margin,size*(-price),null,null]);
    var action = size>0 ? 'Buy' : 'Sell';
    Main.drawChart(element, action+" "+Math.abs(size)+" eth of the "+option.strike+" Put "+" for "+price, data, "ETH/USD price", "Net profit (eth)", [{type: 'number', role: null}, {type: 'string', role: 'annotation'}, {type: 'string', role: 'annotationText'}]);
  }
}
Main.updatePrice = function(callback) {
  $.getJSON('https://poloniex.com/public?command=returnTicker', function(result) {
    var ethBTC = result.BTC_ETH.last;
    $.getJSON('https://api.coindesk.com/v1/bpi/currentprice/USD.json', function(result) {
      var btcUSD = result.bpi.USD.rate;
      price = Number(ethBTC * btcUSD);
      priceUpdated = Date.now();
      callback();
    });
  });
}
Main.getPrice = function() {
  return price;
}
Main.getGitterMessages = function(callback) {
  utility.getGitterMessages(gitterMessagesCache, function(err, result){
    if (!err) {
      gitterMessagesCache = result.gitterMessages;
      if (result.newMessagesFound>0) {
        Main.displayEvents(function(){});
      }
    }
    callback();
  });
}
Main.displayEvents = function(callback) {
  var events = Object.values(eventsCache);
  events.sort(function(a,b){ return b.blockNumber-a.blockNumber || b.transactionIndex-a.transactionIndex });
  new EJS({url: config.homeURL+'/'+'events_table.ejs'}).update('events', {events: events, options: optionsCache});
  callback();
}
Main.displayPrices = function(callback) {
  contractsCache.forEach(function(contract){
    new EJS({url: config.homeURL+'/'+'contract_nav.ejs'}).update(contract.contractAddr+'_nav', {contract: contract, options: optionsCache});
    new EJS({url: config.homeURL+'/'+'contract_prices.ejs'}).update(contract.contractAddr+'_prices', {contract: contract, options: optionsCache, addr: addrs[selectedAccount]});
  });
  callback();
}
Main.refresh = function(callback) {
  if (refreshing<=0 || Date.now()-lastRefresh>60*1000) {
    refreshing = 4;
    Main.createCookie(config.userCookie, JSON.stringify({"addrs": addrs, "pks": pks, "selectedAccount": selectedAccount}), 999);
    Main.connectionTest();
    Main.loadAccounts(function() {
      refreshing--;
    });
    Main.displayEvents(function() {
      refreshing--;
    });
    Main.updatePrice(function(){
      Main.processOrders(function(){
        refreshing--;
      });
    });
    Main.getGitterMessages(function() {
      Main.loadContractsFunds(function(){
        Main.loadPositions(function(){
          Main.loadPrices(function() {
            Main.displayPrices(function() {
              refreshing--;
              lastRefresh = Date.now();
              callback();
            });
          });
        });
      });
    });
  } else {
    callback();
  }
}
Main.init = function() {
  Main.createCookie(config.userCookie, JSON.stringify({"addrs": addrs, "pks": pks, "selectedAccount": selectedAccount}), 999);
  Main.connectionTest();
  Main.displayMarket(function(){
    function mainLoop() {
      Main.refresh(function(){
        setTimeout(mainLoop, 15*1000);
      });
    }
    mainLoop();
  });
}

//globals
var contractsContract = undefined;
var myContract = undefined;
var addrs;
var pks;
var selectedAccount = 0;
var connection = undefined;
var nonce = undefined;
var eventsCache = {};
var contractsCache = undefined;
var optionsCache = undefined;
var browserOrders = [];
var marketMakers = {};
var deadOrders = {};
var refreshing = 0;
var lastRefresh = Date.now();
var price = undefined;
var priceUpdated = Date.now();
var gitterMessagesCache = {};
//web3
if(typeof web3 !== 'undefined' && typeof Web3 !== 'undefined') {
    web3 = new Web3(web3.currentProvider);
} else if (typeof Web3 !== 'undefined') {
    web3 = new Web3(new Web3.providers.HttpProvider(config.ethProvider));
} else if(typeof web3 == 'undefined' && typeof Web3 == 'undefined') {
}

web3.version.getNetwork(function(error, version){
  //check mainnet vs testnet
  if (version in configs) config = configs[version];
  //default addr, pk
  addrs = [config.ethAddr];
  pks = [config.ethAddrPrivateKey];
  //get cookie
  var cookie = Main.readCookie(config.userCookie);
  if (cookie) {
    cookie = JSON.parse(cookie);
    addrs = cookie["addrs"];
    pks = cookie["pks"];
    if (cookie["selectedAccount"]) {
      selectedAccount = cookie["selectedAccount"];
    }
  }
  //get accounts
  web3.eth.defaultAccount = config.ethAddr;
  web3.eth.getAccounts(function(e,accounts){
    if (!e) {
      accounts.forEach(function(addr){
        if(addrs.indexOf(addr)<0) {
          addrs.push(addr);
          pks.push(undefined);
        }
      });
    }
  });
  //load contract
  utility.loadContract(web3, config.contractContracts, config.contractContractsAddr, function(err, contract){
    contractsContract = contract;
    utility.call(web3, contractsContract, config.contractContractsAddr, 'getContracts', [], function(err, result) {
      if (result) {
        config.contractAddrs = result.filter(function(x){return x!='0x0000000000000000000000000000000000000000'}).getUnique();
        utility.loadContract(web3, config.contractMarket, undefined, function(err, contract){
          myContract = contract;
          Main.init();
        });
      }
    });
  });
});


module.exports = {Main: Main, utility: utility};
