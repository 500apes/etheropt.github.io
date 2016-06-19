var Web3 = require('web3');
var utility = require('./utility.js');
var request = require('request');
var sha256 = require('js-sha256').sha256;
require('datejs');
var async = (typeof(window) === 'undefined') ? require('async') : require('async/dist/async.min.js');

function Main() {
}
Main.alertInfo = function(message) {
  $('#notifications-container').css('display', 'block');
  $('#notifications').prepend($('<p>' + message + '</p>').hide().fadeIn(2000));
  console.log(message);
}
Main.alertTxHash = function(txHash) {
  if (txHash) {
    Main.alertInfo('You just created an Ethereum transaction. Track its progress here: <a href="http://'+(config.eth_testnet ? 'testnet.' : '')+'etherscan.io/tx/'+txHash+'" target="_blank">'+txHash+'</a>.');
  } else {
    Main.alertInfo('You tried to send an Ethereum transaction but there was an error. Check the Javascript console for details.');
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
  addrs = [config.eth_addr];
  pks = [config.eth_addr_pk];
  selectedAddr = 0;
  nonce = undefined;
  market_makers = {};
  browser_orders = [];
  Main.refresh();
}
Main.createAddress = function() {
  var newAddress = utility.createAddress();
  var addr = newAddress[0];
  var pk = newAddress[1];
  Main.addAddress(addr, pk);
  Main.alertInfo('You just created an Ethereum address: '+addr+'.');
}
Main.deleteAddress = function() {
  addrs.splice(selectedAddr, 1);
  pks.splice(selectedAddr, 1);
  selectedAddr = 0;
  nonce = undefined;
  market_makers = {};
  browser_orders = [];
  Main.refresh();
}
Main.selectAddress = function(i) {
  selectedAddr = i;
  nonce = undefined;
  market_makers = {};
  browser_orders = [];
  Main.refresh();
}
Main.addAddress = function(addr, pk) {
  if (addr.slice(0,2)!='0x') addr = '0x'+addr;
  if (pk.slice(0,2)=='0x') pk = pk.slice(2);
  addr = utility.toChecksumAddress(addr);
  if (pk!=undefined && pk!='' && !utility.verifyPrivateKey(addr, pk)) {
    console.log(addr);
    console.log(pk);
    Main.alertInfo('For account '+addr+', the private key is invalid.');
  } else if (!web3.isAddress(addr)) {
    Main.alertInfo('The specified address, '+addr+', is invalid.');
  } else {
    addrs.push(addr);
    pks.push(pk);
    selectedAddr = addrs.length-1;
    nonce = undefined;
    market_makers = {};
    browser_orders = [];
    Main.refresh();
  }
}
Main.showPrivateKey = function() {
  var addr = addrs[selectedAddr];
  var pk = pks[selectedAddr];
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
  utility.blockNumber(web3, function(blockNumber) {
    //process orders
    browser_orders = browser_orders.filter(function(browser_order){return blockNumber<browser_order.blockNumber+browser_order.expires && browser_order.size!=0});
    async.eachSeries(browser_orders,
      function(browser_order, callback_browser_order) {
        if (blockNumber>=browser_order.last_updated+browser_order.update) {
          browser_order.last_updated = blockNumber;
          //update option
          browser_order.option = options_cache.filter(function(option){return option.contract_addr == browser_order.option.contract_addr && option.optionID == browser_order.option.optionID})[0];
          if (browser_order.position_lock!=undefined) {
            browser_order.size -= (browser_order.option.position-browser_order.position_lock); //update remaining size based on change in position
          }
          browser_order.position_lock = browser_order.option.position;
          if ((browser_order.price_above==undefined || price>browser_order.price_above) && (browser_order.price_below==undefined || price<browser_order.price_below) && (Date.now()-price_updated<30*1000)) {
            browser_order.price_tied = browser_order.price;
            if (browser_order.tie!=undefined && browser_order.delta!=undefined) {
              browser_order.price_tied = browser_order.price + browser_order.delta * 1000000000000000000 * (price - browser_order.tie);
            }
            //market maker order
            if (browser_order.market_maker) {
              var market_maker = market_makers[browser_order.market_maker];
              if (market_maker) {
                var theo = 0;
                for (var i=0; i<market_maker.pdf.length; i++) {
                  theo += (browser_order.option.kind=='Call' ? Math.max(0,Math.min(browser_order.option.margin, market_maker.pdf[i][0]-browser_order.option.strike)) : Math.max(0,Math.min(browser_order.option.margin, browser_order.option.strike-market_maker.pdf[i][0]))) * market_maker.pdf[i][1];
                }
                if (browser_order.size>0) {
                  browser_order.size = market_maker.size;
                  browser_order.price = utility.roundTo(Math.max(0,theo-market_maker.width/2),2)*1000000000000000000;
                } else {
                  browser_order.size = -market_maker.size;
                  browser_order.price = utility.roundTo(Math.max(0,theo+market_maker.width/2),2)*1000000000000000000;
                }
                browser_order.price_tied = browser_order.price;
              } else {
                browser_order.size = 0;
              }
            }
            //send the remainder of the order to rest on the order book
            function send_to_order_book() {
              if (browser_order.size-cumulative_match_size!=0) {
                browser_order.price_tied = utility.roundToNearest(browser_order.price_tied, 1000000);
                utility.blockNumber(web3, function(blockNumber) {
                  var orderID = utility.getRandomInt(0,Math.pow(2,64));
                  var blockExpires = blockNumber + browser_order.update;
                  var condensed = utility.pack([browser_order.option.optionID, browser_order.price_tied, browser_order.size-cumulative_match_size, orderID, blockExpires], [256, 256, 256, 256, 256]);
                  var hash = sha256(new Buffer(condensed,'hex'));
                  utility.sign(web3, addrs[selectedAddr], hash, pks[selectedAddr], function(sig) {
                    if (!sig) {
                      Main.alertInfo('You tried sending an order to the order book, but it could not be signed.');
                      callback_browser_order();
                    } else {
                      var order = {contract_addr: browser_order.option.contract_addr, optionID: browser_order.option.optionID, price: browser_order.price_tied, size: browser_order.size-cumulative_match_size, orderID: orderID, blockExpires: blockExpires, addr: addrs[selectedAddr], v: sig.v, r: sig.r, s: sig.s, hash: '0x'+hash};
                      condensed = utility.pack([order.optionID, order.price, order.size, order.orderID, order.blockExpires], [256, 256, 256, 256, 256]);
                      hash = '0x'+sha256(new Buffer(condensed,'hex'));
                      var verified = utility.verify(web3, order.addr.toLowerCase(), order.v, order.r, order.s, order.hash);
                      utility.call(web3, myContract, browser_order.option.contract_addr, 'getFunds', [order.addr, false], function(result) {
                        var balance = result.toNumber();
                        utility.call(web3, myContract, browser_order.option.contract_addr, 'getMaxLossAfterTrade', [order.addr, order.optionID, order.size, -order.size*order.price], function(result) {
                          balance = balance + result.toNumber();
                          if (!verified) {
                            Main.alertInfo('You tried sending an order to the order book, but signature verification failed.');
                            callback_browser_order();
                          } else if (balance<=0) {
                            Main.alertInfo('You tried sending an order to the order book, but you do not have enough funds to place your order. You need to add '+(utility.weiToEth(-balance))+' eth to your account to cover this trade. ');
                            callback_browser_order();
                          } else if (blockNumber<=order.blockExpires && verified && hash==order.hash && balance>=0) {
                            async.each(browser_order.option.market_makers,
                              function(market_maker, callback_market_maker) {
                                request.post(market_maker, {form:{orders: [order]}}, function(err, httpResponse, body) {
                                  callback_market_maker();
                                });
                              },
                              function(err) {
                                //finished sending order to order book
                                callback_browser_order();
                              }
                            );
                          } else {
                            callback_browser_order();
                          }
                        });
                      });
                    }
                  });
                });
              } else {
                callback_browser_order();
              }
            }
            //match against existing orders
            var cumulative_match_size = 0;
            if (browser_order.post_only==false) { //as long as post_only isn't set
              var match_orders = browser_order.size>0 ? browser_order.option.sell_orders : browser_order.option.buy_orders;
              async.each(match_orders,
                function(match_order, callback_match_order) {
                  if ((browser_order.size>0 && browser_order.price_tied>=match_order.order.price) || (browser_order.size<0 && browser_order.price_tied<=match_order.order.price)) {
                    var match_size = 0;
                    if (Math.abs(cumulative_match_size)>=Math.abs(browser_order.size)) {
                      //we've attempted to match enough size already
                    } else if (Math.abs(browser_order.size-cumulative_match_size)>=Math.abs(match_order.size)) { //the order is bigger than the match order
                      match_size = -match_order.order.size;
                    } else { //the match order covers the order
                      match_size = browser_order.size-cumulative_match_size;
                    }
                    if (match_size!=0) {
                      cumulative_match_size += match_size; //let's assume the order will go through
                      var deposit = utility.ethToWei(0);
                      utility.call(web3, myContract, browser_order.option.contract_addr, 'orderMatchTest', [match_order.order.optionID, match_order.order.price, match_order.order.size, match_order.order.orderID, match_order.order.blockExpires, match_order.order.addr, addrs[selectedAddr], deposit, match_size], function(test) {
                        if (test && blockNumber<match_order.order.blockExpires-1) {
                          utility.send(web3, myContract, browser_order.option.contract_addr, 'orderMatch', [match_order.order.optionID, match_order.order.price, match_order.order.size, match_order.order.orderID, match_order.order.blockExpires, match_order.order.addr, match_order.order.v, match_order.order.r, match_order.order.s, match_size, {gas: browser_order.gas, value: deposit}], addrs[selectedAddr], pks[selectedAddr], nonce, function(result) {
                            txHash = result[0];
                            nonce = result[1];
                            Main.alertInfo('Some of your order ('+utility.weiToEth(Math.abs(match_size))+' eth) was sent to the blockchain to match against a resting order.');
                            Main.alertTxHash(txHash);
                            callback_match_order();
                          });
                        } else {
                          Main.alertInfo('You tried to match against a resting order but the order match failed. This can be because the order expired or traded already, or either you or the counterparty do not have enough funds to cover the trade.');
                          callback_match_order();
                        }
                      });
                    } else {
                      callback_match_order();
                    }
                  } else {
                    callback_match_order();
                  }
                },
                function(err) {
                  send_to_order_book();
                }
              );
            } else {
              send_to_order_book();
            }
          }
        } else {
          callback_browser_order();
        }
      },
      function(err) {
        //update display
        new EJS({url: config.home_url+'/'+'orders_table.ejs'}).update('orders', {orders: browser_orders, utility: utility, blockNumber: blockNumber});
        callback();
      }
    );
  });
}
Main.order = function(option, price, size, expires, update, gas, price_above, price_below, delta, tie, post_only) {
  option = JSON.parse(option);
  size = utility.ethToWei(size);
  price = price * 1000000000000000000;
  gas = Number(gas);
  expires = Number(expires);
  update = Number(update);
  price_above = price_above ? Number(price_above) : undefined;
  price_below = price_below ? Number(price_below) : undefined;
  delta = delta ? Number(delta) : undefined;
  tie = tie ? Number(tie) : undefined;
  post_only = post_only=='true' ? true : false;
  utility.blockNumber(web3, function(blockNumber) {
    var order = {option: option, price: price, size: size, expires: expires, update: update, gas: gas, price_above: price_above, price_below: price_below, delta: delta, tie: tie, post_only: post_only, blockNumber: blockNumber, last_updated: 0};
    browser_orders.push(order);
    Main.refresh();
  });
}
Main.marketMakeStart = function(contract_addr, pdf, size, width, post_only) {
  utility.blockNumber(web3, function(blockNumber) {
    size = utility.ethToWei(size);
    pdf = JSON.parse(pdf);
    width = Number(width);
    post_only = post_only=='true' ? true : false;
    market_makers[contract_addr] = {pdf: pdf, size: size, contract_addr: contract_addr, width: width};
    browser_orders = browser_orders.filter(function(browser_order){return browser_order.market_maker!=contract_addr});
    options_cache.filter(function(option) {return option.contract_addr==contract_addr}).forEach(function(option) {
      var order_buy = {market_maker: contract_addr, option: option, price: undefined, size: 1, expires: 1000000, update: 5, gas: 1000000, price_above: undefined, price_below: undefined, delta: undefined, tie: undefined, post_only: post_only, blockNumber: blockNumber, last_updated: 0};
      browser_orders.push(order_buy);
      var order_sell = {market_maker: contract_addr, option: option, price: undefined, size: -1, expires: 1000000, update: 5, gas: 1000000, price_above: undefined, price_below: undefined, delta: undefined, tie: undefined, post_only: post_only, blockNumber: blockNumber, last_updated: 0};
      browser_orders.push(order_sell);
    });
    Main.processOrders(function(){});
  });
}
Main.marketMakeStop = function(contract_addr) {
  delete market_makers[contract_addr];
  browser_orders = browser_orders.filter(function(browser_order){return browser_order.market_maker!=contract_addr});
}
Main.fund = function(amount, contract_addr) {
  utility.send(web3, myContract, contract_addr, 'addFunds', [{gas: 200000, value: utility.ethToWei(amount)}], addrs[selectedAddr], pks[selectedAddr], nonce, function(result) {
    txHash = result[0];
    nonce = result[1];
    Main.alertTxHash(txHash);
  });
}
Main.withdraw = function(amount, contract_addr) {
  amount = utility.ethToWei(amount);
  utility.call(web3, myContract, contract_addr, 'getFundsAndAvailable', [addrs[selectedAddr]], function(result) {
    if (result) {
      var fundsAvailable = result[1].toNumber();
      if (amount>fundsAvailable) amount = fundsAvailable;
    }
    if (amount>0) {
      utility.send(web3, myContract, contract_addr, 'withdrawFunds', [amount, {gas: 300000, value: 0}], addrs[selectedAddr], pks[selectedAddr], nonce, function(result) {
        txHash = result[0];
        nonce = result[1];
        Main.alertTxHash(txHash);
      });
    }
  });
}
Main.expireCheck = function(contract_addr, callback) {
  var first_option = options_cache.filter(function(x){return x.contract_addr==contract_addr})[0]
  var realityID = first_option.realityID;
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
      var machine_settlement = result.machine_resolution_value;
      if (sig_r && sig_s && sig_v && value) {
        callback([true, settlement]);
      } else if (machine_settlement) {
        callback([false, machine_settlement]);
      } else if (settlement) {
        callback([false, settlement]);
      } else {
        callback([false, undefined]);
      }
    }
  });
}
Main.expire = function(contract_addr) {
  var first_option = options_cache.filter(function(x){return x.contract_addr==contract_addr})[0]
  var realityID = first_option.realityID;
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
        Main.alertInfo("Expiring "+first_option.expiration+" using settlement price: "+settlement);
        utility.send(web3, myContract, contract_addr, 'expire', [0, sig_v, sig_r, sig_s, value, {gas: 1000000, value: 0}], addrs[selectedAddr], pks[selectedAddr], nonce, function(result) {
          txHash = result[0];
          nonce = result[1];
          Main.alertTxHash(txHash);
        });
      }
    }
  });
}
Main.publishExpiration = function(address) {
  utility.send(web3, contractsContract, config.contract_contracts_addr, 'newContract', [address, {gas: 300000, value: 0}], addrs[selectedAddr], pks[selectedAddr], nonce, function(result) {
    txHash = result[0];
    nonce = result[1];
    Main.alertTxHash(txHash);
  });
}
Main.disableExpiration = function(address) {
  utility.send(web3, contractsContract, config.contract_contracts_addr, 'disableContract', [address, {gas: 300000, value: 0}], addrs[selectedAddr], pks[selectedAddr], nonce, function(result) {
    txHash = result[0];
    nonce = result[1];
    Main.alertTxHash(txHash);
  });
}
Main.newExpiration = function(date, calls, puts, margin) {
  var fromcur = "ETH";
  var tocur = "USD";
  margin = Number(margin);
  var expiration = date;
  var expiration_timestamp = Date.parse(expiration+" 00:00:00 +0000").getTime()/1000;
  var strikes = calls.split(",").map(function(x){return Number(x)}).slice(0,5).concat(puts.split(",").map(function(x){return -Number(x)}).slice(0,5));
  strikes.sort(function(a,b){return Math.abs(b)>Math.abs(a) ? -1 : (Math.abs(b)==Math.abs(a) ? (a>b ? -1 : 1) : 1)});
  request.post('https://www.realitykeys.com/api/v1/exchange/new', {form: {fromcur: fromcur, tocur: tocur, settlement_date: expiration, objection_period_secs: '86400', accept_terms_of_service: 'current', use_existing: '1'}}, function(err, httpResponse, body){
    if (!err) {
      result = JSON.parse(body);
      var realityID = result.id;
      var factHash = '0x'+result.signature_v2.fact_hash;
      var ethAddr = '0x'+result.signature_v2.ethereum_address;
      var original_strikes = strikes;
      var scaled_strikes = strikes.map(function(strike) { return strike*1000000000000000000 });
      var scaled_margin = margin*1000000000000000000;
      Main.alertInfo("You are creating a new contract. This will involve two transactions. After the first one is confirmed, the second one will be sent. Please be patient.");
      utility.send(web3, myContract, undefined, 'constructor', [expiration_timestamp, fromcur+"/"+tocur, scaled_margin, realityID, factHash, ethAddr, scaled_strikes, {from: addrs[selectedAddr], data: bytecode, gas: 4712388, gasPrice: config.eth_gas_price}], addrs[selectedAddr], pks[selectedAddr], nonce, function(result) {
        if(result) {
          txHash = result[0];
          nonce = result[1];
          Main.alertTxHash(txHash);
          var address = undefined;
          async.whilst(
              function () { return address==undefined; },
              function (callback_whilst) {
                  setTimeout(function () {
                    utility.txReceipt(web3, txHash, function(receipt) {
                      if (receipt) {
                        address = receipt.contractAddress;
                      }
                      console.log("Waiting for contract creation to complete.");
                      callback_whilst(null);
                    });
                  }, 10*1000);
              },
              function (err) {
                Main.alertInfo("Here is the new contract address: "+address+". We will now send a transaction to the contract that keeps track of expirations so that the new expiration will show up on Etheropt.");
                //notify contracts contract of new contract
                utility.send(web3, contractsContract, config.contract_contracts_addr, 'newContract', [address, {gas: 300000, value: 0}], addrs[selectedAddr], pks[selectedAddr], nonce, function(result) {
                  txHash = result[0];
                  nonce = result[1];
                  Main.alertTxHash(txHash);
                });
              }
          );
        }
      });
    }
  });
}
Main.connectionTest = function() {
  if (connection) return connection;
  connection = {connection: 'Proxy', provider: 'http://'+(config.eth_testnet ? 'testnet.' : '')+'etherscan.io', testnet: config.eth_testnet};
  try {
    if (web3.currentProvider) {
      web3.eth.getBalance('0x0000000000000000000000000000000000000000');
      connection = {connection: 'Geth', provider: config.eth_provider, testnet: config.eth_testnet};
    }
  } catch(err) {
    web3.setProvider(undefined);
  }
  new EJS({url: config.home_url+'/'+'connection_description.ejs'}).update('connection', {connection: connection});
  Main.popovers();
  return connection;
}
Main.loadAddresses = function() {
  if (Main.connectionTest().connection=='Geth') {
    $('#pk_div').hide();
  }
  if (addrs.length<=0 || addrs.length!=pks.length) {
    addrs = [config.eth_addr];
    pks = [config.eth_addr_pk];
    selectedAddr = 0;
  }
  async.map(addrs,
    function(addr, callback) {
      utility.getBalance(web3, addr, function(balance) {
        callback(null, {addr: addr, balance: balance});
      });
    },
    function(err, addresses) {
      new EJS({url: config.home_url+'/'+'addresses.ejs'}).update('addresses', {addresses: addresses, selectedAddr: selectedAddr});
    }
  );
}
Main.displayMarket = function(callback) {
  if (contracts_cache && options_cache) {
    contracts_cache.sort(function(a,b){return (options_cache.filter(function(x){return x.contract_addr==a.contract_addr}).length==0 ? "2020-01-01" : options_cache.filter(function(x){return x.contract_addr==a.contract_addr})[0].expiration) > (options_cache.filter(function(x){return x.contract_addr==b.contract_addr}).length==0 ? "2020-01-01" : options_cache.filter(function(x){return x.contract_addr==b.contract_addr})[0].expiration) ? 1 : -1});
    contracts_cache.forEach(function(contract){
      var filtered_options = options_cache.filter(function(x){return x.contract_addr==contract.contract_addr});
      var item = {
        type: 'component',
        componentName: 'layout',
        isClosable: false,
        title: filtered_options.length>0 ? filtered_options[0].expiration : contract.contract_addr.slice(0,12)+'...',
        componentState: { id: 'contract', type: 'ejs', data: {contract: contract} }
      };
      myLayout.root.contentItems[0].contentItems[0].contentItems[0].addChild( item );
      new EJS({url: config.home_url+'/'+'contract_nav.ejs'}).update(contract.contract_addr+'_nav', {contract: contract, options: options_cache});
      new EJS({url: config.home_url+'/'+'contract_prices.ejs'}).update(contract.contract_addr+'_prices', {contract: contract, options: options_cache, addr: addrs[selectedAddr]});
      myLayout.root.contentItems[0].contentItems[0].contentItems[0].setActiveContentItem(myLayout.root.contentItems[0].contentItems[0].contentItems[0].contentItems[1]);
    });
    $('#market-spinner').hide();
    Main.tooltips();
    if (callback) callback();
  } else {
    $('#market-spinner').show();
    Main.loadContractsFunds(function(contracts){
      contracts_cache = contracts;
      Main.loadOptions(function(options){
        options_cache = options;
        Main.loadPrices(options_cache, function(options){
          options_cache = options;
          Main.displayMarket();
          Main.loadLog(events_cache, function(events){
            events_cache = events;
            if (callback) callback();
          });
        });
      });
    });
  }
}
Main.loadPrices = function(options, callback) {
  async.reduce(config.contract_addrs, [],
    function(memo, contract_addr, callback_reduce){
      var options_filtered = options.filter(function(x){return x.contract_addr==contract_addr})
      if (options_filtered.length>0) {

        if (options_filtered[0].timer) clearInterval(options_filtered[0].timer);
        options_filtered[0].last_updated = Date.now();
        options_filtered[0].timer = setInterval(function () {
          function pad(val) {return val > 9 ? val : "0" + val;}
          var sec = Math.ceil((Date.now() - options_filtered[0].last_updated) / 1000);
          if ($('#'+contract_addr+"_updated").length) {
            $('#'+contract_addr+"_updated")[0].innerHTML = (pad(parseInt(sec / 60, 10)))+":"+(pad(++sec % 60));
          }
        }, 1000);

        var market_makers = options_filtered[0].market_makers;
        async.reduce(market_makers, [],
          function(memo, market_maker, callback_reduce) {
            request.get(market_maker+'/'+contract_addr, {timeout: 2500}, function(err, httpResponse, body) {
              try {
                callback_reduce(null, memo.concat(JSON.parse(body)));
              } catch (err) {
                callback_reduce(null, memo);
              }
            });
          },
          function(err, markets){
            callback_reduce(null, memo.concat(markets));
          }
        );
      } else {
        callback_reduce(null, memo);
      }
    },
    function(err, markets){
      async.map(options,
        function(option, callback_map){
          var orders = markets.filter(function(x){return x.contract_addr==option.contract_addr && x.optionID==option.optionID});
          orders = orders.map(function(x){return {size: Math.abs(x.size), price: x.price/1000000000000000000, order: x}});
          var new_buy_orders = {};
          var new_sell_orders = {};
          for (var i=0; i<orders.length; i++) {
            if (orders[i].order.size>0) new_buy_orders[orders[i].order.orderID] = orders[i];
            if (orders[i].order.size<0) new_sell_orders[orders[i].order.orderID] = orders[i];
          }
          option.buy_orders = Object.values(new_buy_orders);
          option.sell_orders = Object.values(new_sell_orders);
          option.buy_orders.sort(function(a, b) {return b.price > a.price ? 1 : (b.price == a.price ? (b.size > a.size ? 1 : -1) : -1)});
          option.sell_orders.sort(function(a, b) {return b.price < a.price ? 1 : (b.price == a.price ? (b.size > a.size ? 1 : -1) : -1)});
          callback_map(null, option);
        },
        function(err, options){
          callback(options);
        }
      );
    }
  );
}
Main.loadPositions = function(options_original, callback) {
  async.map(config.contract_addrs,
    function(contract_addr, callback) {
      utility.call(web3, myContract, contract_addr, 'getMarket', [addrs[selectedAddr]], function(result) {
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
              var cash = cashes[i].toNumber() / 1000000000000000000;
              var position = positions[i].toNumber();
              var option = {cash: cash, position: position, optionID: optionIDs[i], contract_addr: contract_addr};
              callback_map(null, option);
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
      async.map(options_original,
        function(option, callback_map) {
          for (var i=0; i<options.length; i++) {
            if (options[i].contract_addr==option.contract_addr && options[i].optionID==option.optionID) {
              option.position = options[i].position;
              option.cash = options[i].cash;
              return callback_map(null, option);
            }
          }
          callback_map(null, option);
        },
        function(err, options) {
          callback(options);
        }
      );
    }
  );
}
Main.loadLog = function(events, callback) {
  async.eachSeries(config.contract_addrs,
    function(contract_addr, callback_each){
      utility.logs(web3, myContract, contract_addr, 0, 'latest', function(event) {
        event.tx_link = 'http://'+(config.eth_testnet ? 'testnet.' : '')+'etherscan.io/tx/'+event.transactionHash;
        events[event.transactionHash+event.logIndex] = event;
        Main.refresh();
      });
      callback_each();
    },
    function (err) {
      callback(events);
    }
  );
}
Main.loadContractsFunds = function(callback) {
  async.map(config.contract_addrs,
    function(contract_addr, callback) {
      utility.call(web3, myContract, contract_addr, 'getFundsAndAvailable', [addrs[selectedAddr]], function(result) {
        if (result) {
          var funds = result[0].toString();
          var fundsAvailable = result[1].toString();
          var contract_link = 'http://'+(config.eth_testnet ? 'testnet.' : '')+'etherscan.io/address/'+contract_addr;
          callback(null, {contract_addr: contract_addr, contract_link: contract_link, funds: funds, fundsAvailable: fundsAvailable});
        } else {
          callback(null, undefined);
        }
      });
    },
    function(err, contracts) {
      contracts = contracts.filter(function(x){return x!=undefined});
      callback(contracts);
    }
  );
}
Main.loadOptions = function(callback) {
  async.mapSeries(config.contract_addrs,
    function(contract_addr, callback) {
      utility.call(web3, myContract, contract_addr, 'getOptionChain', [], function(result) {
        if (result) {
          var expiration = (new Date(result[0].toNumber()*1000)).toISOString().substring(0,10);
          var fromcur = result[1].split("/")[0];
          var tocur = result[1].split("/")[1];
          var margin = result[2].toNumber() / 1000000000000000000.0;
          var realityID = result[3].toNumber();
          utility.call(web3, myContract, contract_addr, 'getMarket', [addrs[selectedAddr]], function(result) {
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
              utility.call(web3, myContract, contract_addr, 'getMarketMakers', [], function(result) {
                if (result) {
                  var market_makers = result ? result.filter(function(x){return x!=''}) : [];
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
                      option.market_makers = market_makers;
                      option.expiration = optionChainDescription.expiration;
                      option.fromcur = optionChainDescription.fromcur;
                      option.tocur = optionChainDescription.tocur;
                      option.margin = optionChainDescription.margin;
                      option.realityID = realityID;
                      callback_map(null, option);
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
        } else {
          callback(null, []);
        }
      });
    },
    function(err, options) {
      options = options.reduce(function(a, b) {return a.concat(b);}, []);
      options.sort(function(a,b){ return a.expiration+(a.strike+10000000).toFixed(3).toString()+(a.kind=='Put' ? '0' : '1')<b.expiration+(b.strike+10000000).toFixed(3).toString()+(b.kind=='Put' ? '0' : '1') ? -1 : 1 });
      callback(options);
    }
  );
}
Main.draw_chart = function(element, title, data_rows, x_label, y_label, columns) {
  var data = new google.visualization.DataTable();
  data.addColumn('number', x_label);
  columns.forEach(function(column){
    data.addColumn(column);
  });
  data.addRows(data_rows);
  var options = {
    hAxis: {title: x_label},
    vAxis: {title: y_label},
    legend: {position: 'none'},
    enableInteractivity: true,
    title: title
  };
  var chart = new google.visualization.LineChart(document.getElementById(element));
  chart.draw(data, options);
}
Main.draw_option_chart = function(element, option, price, size) {
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
    Main.draw_chart(element, action+" "+Math.abs(size)+" eth of the "+option.strike+" Call "+" for "+price, data, "ETH/USD price", "Net profit (eth)", [{type: 'number', role: null}, {type: 'string', role: 'annotation'}, {type: 'string', role: 'annotationText'}]);
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
    Main.draw_chart(element, action+" "+Math.abs(size)+" eth of the "+option.strike+" Put "+" for "+price, data, "ETH/USD price", "Net profit (eth)", [{type: 'number', role: null}, {type: 'string', role: 'annotation'}, {type: 'string', role: 'annotationText'}]);
  }
}
Main.updatePrice = function(callback) {
  $.getJSON('https://poloniex.com/public?command=returnTicker', function(result) {
    var eth_btc = result.BTC_ETH.last;
    $.getJSON('https://api.coindesk.com/v1/bpi/currentprice/USD.json', function(result) {
      var btc_usd = result.bpi.USD.rate;
      price = Number(eth_btc * btc_usd);
      price_updated = Date.now();
      callback();
    });
  });
}
Main.getPrice = function() {
  return price;
}
Main.refresh = function() {
  if (!refreshing || Date.now()-last_refresh>60*1000) {
    refreshing = true;
    Main.createCookie("user", JSON.stringify({"addrs": addrs, "pks": pks, "selectedAddr": selectedAddr}), 999);
    Main.connectionTest();
    Main.loadAddresses();
    var events = Object.values(events_cache);
    events.sort(function(a,b){ return a.blockNumber*1000+a.transactionIndex>b.blockNumber*1000+b.transactionIndex ? -1 : 1 });
    new EJS({url: config.home_url+'/'+'events_table.ejs'}).update('events', {events: events, options: options_cache});
    Main.updatePrice(function(){
      Main.loadContractsFunds(function(contracts){
        contracts_cache = contracts;
        Main.loadPositions(options_cache, function(options){
          options_cache = options;
          Main.processOrders(function(){
            Main.loadPrices(options_cache, function(options) {
              options_cache = options;
              contracts_cache.forEach(function(contract){
                new EJS({url: config.home_url+'/'+'contract_nav.ejs'}).update(contract.contract_addr+'_nav', {contract: contract, options: options_cache});
                new EJS({url: config.home_url+'/'+'contract_prices.ejs'}).update(contract.contract_addr+'_prices', {contract: contract, options: options_cache, addr: addrs[selectedAddr]});
              });
              refreshing = false;
              last_refresh = Date.now();
            });
          });
        });
      });
    });
  }
}
Main.init = function() {
  Main.createCookie("user", JSON.stringify({"addrs": addrs, "pks": pks, "selectedAddr": selectedAddr}), 999);
  Main.connectionTest();
  Main.loadAddresses();
  Main.displayMarket(function(){
    function mainLoop() {
      Main.refresh();
      setTimeout(mainLoop, 10*1000);
    }
    mainLoop();
  });
}

//globals
var addrs = [config.eth_addr];
var pks = [config.eth_addr_pk];
var selectedAddr = 0;
var cookie = Main.readCookie("user");
if (cookie) {
  cookie = JSON.parse(cookie);
  addrs = cookie["addrs"];
  pks = cookie["pks"];
  selectedAddr = cookie["selectedAddr"];
}
var connection = undefined;
var nonce = undefined;
var events_cache = {};
var contracts_cache = undefined;
var options_cache = undefined;
var browser_orders = [];
var market_makers = {};
var refreshing = false;
var last_refresh = Date.now();
var price = undefined;
var price_updated = Date.now();
//web3
var web3 = new Web3();
web3.eth.defaultAccount = config.eth_addr;
web3.setProvider(new web3.providers.HttpProvider(config.eth_provider));

//get contracts
var contractsContract = undefined;
var myContract = undefined;
var bytecode = undefined;
var abi = undefined;
utility.readFile(config.contract_contracts+'.bytecode', function(result){
  bytecode = JSON.parse(result);
  utility.readFile(config.contract_contracts+'.interface', function(result){
    abi = JSON.parse(result);
    contractsContract = web3.eth.contract(abi);
    contractsContract = contractsContract.at(config.contract_contracts_addr);
    utility.call(web3, contractsContract, config.contract_contracts_addr, 'getContracts', [], function(result) {
      if (result) {
        config.contract_addrs = result.filter(function(x){return x!='0x0000000000000000000000000000000000000000'}).getUnique();
        utility.readFile(config.contract_market+'.bytecode', function(result){
          bytecode = JSON.parse(result);
          utility.readFile(config.contract_market+'.interface', function(result){
            abi = JSON.parse(result);
            myContract = web3.eth.contract(abi);
            myContract = myContract.at(config.contract_addr);
            Main.init(); //iniital load
          });
        });
      }
    });
  });
});

module.exports = {Main: Main, utility: utility};
