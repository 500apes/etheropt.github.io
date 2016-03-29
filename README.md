Etheropt
=============
[![Gitter](https://badges.gitter.im/Etherboost/etheropt.svg)](https://gitter.im/etheropt/etheropt.github.io)

Etheropt is a decentralized options exchange built on [Ethereum](https://ethereum.org/). The options you see here are vanilla call and put options on the price of Ethereum in USD as reported by [Poloniex](https://poloniex.com/exchange#btc_eth) and [Coindesk](http://www.coindesk.com/price) and verified by [Reality Keys](https://www.realitykeys.com). Etheropt has no owner. Its entire operation is described and executed by an Ethereum [smart contract](etheropt.sol). Etheropt does not make any money as the smart contract does not charge any fees -- not for trading, not for adding funds, not for withdrawing, not for anything.

Installation
----------
In order to ease interaction with the smart contract, Etheropt has a graphical user interface (GUI).

There is no installation necessary to use the GUI. Just go to the main Etheropt page ([http://etheropt.github.io](http://etheropt.github.io)) and the GUI will be running in your Web browser. You can also choose to download the GitHub repository and run the GUI locally. The GUI stores your account in the browser only and does not store anything remotely. The only remote server it interacts with is the Ethereum network.

Ethereum network
----------
The GUI can connect to the Ethereum network in one of two ways. If you have Geth running locally in RPC mode (at http://localhost:8545), Etheropt will automatically connect to it. You must run Geth with --rpc and --rpccorsdomain, like this:

```
geth --rpc console --rpccorsdomain 'http://etheropt.github.io' console
```

If you don't have Geth running locally, Etheropt will connect to the Ethereum network through the public API provided by Etherscan. You can find out whether you are connected to Geth or Etherscan at the bottom of the page.

Accounts
----------
In the bar at the top of the GUI, there is a dropdown on the far right. The first time you load the GUI, you will see it is initialized with the zero account (0x0000000000000000000000000000000000000000). You can click the dropdown and choose "Add existing account" to add your own existing Ethereum account. You will need to do this in order to add funds and make trades on Etheropt. If you are using Geth, make sure you have unlocked the appropriate account by using the "personal.unlockAccount('0x...', 'password')" command. If you are not using Geth, you will need to enter the private key associated with your account in order to send transactions via the [Etherscan API](http://etherscan.io/apis). If you need a new account to use with Etheropt, click the dropdown and choose "Create new account." You may also choose to go to [MyEtherWallet](http://www.myetherwallet.com/) and use the address and unencrypted private key it generates.

Adding / withdrawing funds
----------
In the bar at the top of the GUI, there is a "Funds" number and an "Available" number. The "Funds" number is the total amount you have deposited to Etheropt. The "Available" number is the total amount that is available to invest or withdraw. At any given time, your available funds will be equal to the funds you deposited plus the maximum possible loss you could experience from expiring options.

Click the "Funds" number and a dialog box will help you add funds. Click the "Available" number and a dialog box will help you withdraw funds.

Contracts
----------
Anyone can add an option chain by calling the addOptionChain() function. There is a limit on the number of unexpired option chains that can exist (the limit is six). Normally, it's a good idea for the person who has decided to expire an option chain (when the expiration date has passed) to create a new option chain to replace it. An option chain can contain up to 10 contracts. A contract consists of an expiration, a strike, a kind (call or put), and an underlying (ETH/USD). Note that there is a margin requirement that limits the potential upside of an option. For example, if the margin requirement is 5.0000 and you buy 10 eth worth of the 7 call expiring March 1 for 0.2000 and ETH/USD settles at 13.0000, your net profit will be 10 eth * (-0.2000 + min(5.0000, 13.0000 - 7.0000)) = 48 eth. If the settlement value is below the strike, your net profit will be 10 eth * (-0.2000) = -2 eth.

Market makers
----------
The order book for Etheropt is maintained in a distributed fashion by a collection of market makers who are responsible for making markets and maintaining an order book of resting orders. Anyone can become a market maker by running [market_maker.js](market_maker.js) using node.js. When run with the --armed parameter, this file will send a transaction to the smart contract indicating that the user wishes to become a market maker. The smart contract can handle at most six market makers. If there are already six market makers, someone can only become a market maker if the balance in his account exceeds the smallest balance of the other market makers, in which case he will replace the market maker with the smallest balance.

A market maker is responsible for making markets, maintaining an order book of resting orders, and publishing this data via a small server. The [market_maker.js](market_maker.js) script does all of this automatically. The market making strategy currently makes markets as wide as possible. Individuals are free to modify the script and provide tighter markets.

Placing orders
----------
The GUI queries the market makers and shows the best bid and offer for each option. To place an order, simply click the buy or sell button next to the contract and enter the size and price you wish to trade. Every contract shows your current position under "My position." If you place an order that doesn't immediately cross with the tightest resting order, the order will be broadcast to all of the market makers. The order will then rest on the order book until it expires or someone trades with it. By default, orders sent from the GUI will expire in 10 blocks (approximately two minutes).

The GUI will only send an order if you have enough funds to cover it. If the order can partially match against a resting order, the partial cross will be sent to the smart contract to trade and the remaining order will rest on the book. For example, if you want to buy 10 eth worth of an option but there is only 5 eth offered, 5 eth will match and the remaining 5 eth will rest on the order book. Similarly, resting orders can be filled in pieces because the smart contract records the portion of an order that has already traded. For example, if you have a resting order to buy 10 eth worth of an option, it can be filled by two counterparties each selling 5 eth of the order.

Every order resting on the order book (whether submitted by a market maker or through the GUI) consists of an option, a price, a size, an expiration block number, an order ID, and a signature. When the smart contract processes an order match, it will verify that the signature is valid, the order has not expired, there is enough unfilled volume in the order, and both users have enough available funds to cover the trade. If these things are true, the smart contract will record the trade.

An advantage of the distributed market maker system is that transactions with the smart contract are only necessary when crossing trades. The transaction fee (Ethereum gas fee) is paid by the person who crosses the trade and not by the person who creates the resting order. This is similar to the maker/taker fee model used by some centralized exchanges.

Cash usage and expiration
----------
Etheropt keeps track of your cash usage for each expiration. When you buy an option, your cash usage becomes more negative. When you sell an option, your cash usage becomes more positive. For example, if you buy 10 eth worth of the 5 call expiring March 1 for 0.2000, your cash usage decreases by 2 eth. If you sell the option, your cash usage increases by 2 eth.

The contracts belonging to an expiration must be manually expired using the smart contract's expire function. Anyone can do this using the [expire.js](expire.js) script, or one person can do it for everyone.

It is worth noting how exactly expiration works. For example, if you buy 10 eth worth of the 5 call expiring March 1 for 0.2000, your cash usage becomes -2 eth and your position is 10 eth. If ETH/USD expires at 6.0000, your funds change by 10 eth * (-0.2000 + (6.0000 - 5.0000)) = 8 eth. If ETH/USD expires below the strike, your funds change by 10 eth * (-0.2000) = -2 eth. Similarly, if you are short the option, your funds will change by -8 eth if ETH/USD expires at 6.0000 and +2 eth if ETH/USD expires below the strike.

The smart contract
----------
The Solidity code for the smart contract can be found in the GitHub repository at [etheropt.sol](etheropt.sol). It has been compiled and deployed to the Ethereum network. You are encouraged to read and understand it yourself. You may even want to write your own code to generate transactions to send to the smart contract instead of using the GUI. The contract's functions are listed below.

* **Market()**: This function initializes the contract. It doesn't do anything special.

* **addFunds()**: This function adds the sent value to the user's account.

* **withdrawFunds(uint amount)**: This function withdraws the specified amount from the user's account and cancels all the user's outstanding orders. If the user doesn't have enough available funds to cover the withdrawal, then no withdrawal takes place.

* **getFunds(address user, bool onlyAvailable) constant returns(int)**: This function gets the total sum of all deposits less withdrawals in the user's account. If the onlyAvailable flag is true, it adds in the maximum possible loss so that it will return the total available funds.

* **getFundsAndAvailable(address user) constant returns(int, int)**: This function gets the funds and available funds in the user's account.

* **marketMaker(string server)**: This function can be called to establish the user as a market maker. Note that there can only be six market makers. If there are already six market makers, the new market maker must have a higher balance than the market maker with the lowest balance. In this case, the new market maker will replace the market maker with the lowest balance.

* **getMarketMakers() constant returns(string, string, string, string, string, string)**: This function returns the market makers.

* **getMarketMakerFunds() constant returns(int, int, int, int, int, int)**: This function returns the balances of the market makers. It can be used to determine the minimum balance required to become a market maker.

* **getOptionChain(uint optionChainID) constant returns (uint, string, uint, uint, bytes32, address)**: This function returns the expiration (timestamp), underlying, margin, Reality Keys ID, Reality Keys fact hash, and Reality Keys address of the given option chain.

* **expire(uint accountID, uint optionChainID, uint8 v, bytes32 r, bytes32 s, bytes32 value)**: This function expires the specified option chain if the provided signature is valid. If the accountID is 0, it expires all accounts. If the accountID is greater than zero, then it expires just the specified account (and marks it as expired).

* **getMoneyness(int strike, uint settlement, uint margin) constant returns(int)**: This function takes the strike (put is negative), settlement, and margin (all these values are scaled by 1000000000000000000) and returns the moneyness (also scaled by 1000000000000000000), taking into account the margin.

* **addOptionChain(uint expiration, string underlying, uint margin, uint realityID, bytes32 factHash, bytes32 ethAddr, int[] strikes)**: This function adds an option chain, which consists of an expiration, an underlying, a margin amount, a Reality Keys ID, a Reality Keys fact hash, a Reality Keys address, and a collection of strikes (calls are positive, puts are negative). There is a limit on the number of option chains that can be created (the limit is six). Once that limit is met, new option chains can only be created if they can replace ones that are expired or have no positions. There is also a limit on the number of strikes an option chain can contain (the limit is 10).

* **orderMatch(uint optionChainID, uint optionID, uint price, int size, uint orderID, uint blockExpires, address addr, uint8 v, bytes32 r, bytes32 s, int matchSize)**: This function matches an order. It will fail if there isn't enough size left in the order to match the trade, if either user doesn't have enough funds to cover the trade, if the order has expired, or if the signature is invalid. If the trade can cross, the users' positions will be updated to reflect the trade.

* **orderMatchTest(uint optionChainID, uint optionID, uint price, int size, uint orderID, uint blockExpires, address addr, address sender, int matchSize) constant returns(bool)**: This function is a convenience function to test all of the failure conditions in the orderMatch function except for the signature check.

* **getMaxLossAfterTrade(address user, uint optionChainID, uint optionID, int positionChange, int cashChange) constant returns(int)**: This function returns the user's maximum possible loss after doing the specified trade.

* **min(uint a, uint b) constant returns(uint)**: This function returns the minimum of two numbers.

Tests
----------
Install mocha and then run
```
mocha test.js
```
