Etheropt
=============
[![Gitter](https://badges.gitter.im/Etherboost/etheropt.svg)](https://gitter.im/etheropt/etheropt.github.io)

Etheropt is a decentralized options exchange built on [Ethereum](https://ethereum.org/). The options you see here are vanilla call and put options on the price of Ethereum in USD as reported by [Poloniex](https://poloniex.com/exchange#btc_eth) and [Coindesk](http://www.coindesk.com/price) and verified by [Reality Keys](https://www.realitykeys.com). Etheropt has no owner. Its entire operation is described and executed by an Ethereum [smart contract](etheropt.sol). Etheropt does not make any money as the smart contract does not charge any fees -- not for trading, not for adding funds, not for withdrawing, not for anything.

This document is meant to serve as a technical guide to Etheropt. The main Etheropt page ([http://etheropt.github.io](https://etheropt.github.io)) has a series of how-to guides tailored to first-time users of the Etheropt GUI. Some of that information is reiterated here.

Installation
----------
In order to ease interaction with the smart contract, Etheropt has a graphical user interface (GUI).

There is no installation necessary to use the GUI. Just go to the main Etheropt page ([http://etheropt.github.io](https://etheropt.github.io)) and the GUI will be running in your Web browser. You can also choose to download the GitHub repository and run the GUI locally. The GUI stores your account in the browser only and does not store anything remotely. The only remote servers it interacts with are the Ethereum network (through Geth or through a Web proxy), and Gitter (for the order book).

Ethereum network
----------
The GUI can connect to the Ethereum network in one of two ways. If you have Geth running locally in RPC mode (at http://localhost:8545), Etheropt will automatically connect to it. You must run Geth with --rpc and --rpccorsdomain, like this:

```
geth --rpc --rpccorsdomain 'https://etheropt.github.io' console
```

If you don't have Geth running locally, Etheropt will connect to the Ethereum network through the public API provided by Etherscan. You can find out whether you are connected to Geth or Etherscan at the bottom of the page.

Accounts
----------
At the top of the GUI, there is a dropdown on the far right. The first time you load the GUI, you will see it is initialized with the zero account (0x0000000000000000000000000000000000000000). You can click the dropdown and choose "Add existing account" to add your own existing Ethereum account. You will need to do this in order to add funds and make trades on Etheropt. If you are using Geth, make sure you have unlocked the appropriate account by using the "personal.unlockAccount('0x...', 'password')" command. If you are not using Geth, you will need to enter the private key associated with your account in order to send transactions via the [Etherscan API](http://etherscan.io/apis). If you need a new account to use with Etheropt, click the dropdown and choose "Create new account." You may also choose to go to [MyEtherWallet](http://www.myetherwallet.com/) and use the address and unencrypted private key it generates.

Adding / withdrawing funds
----------
Each expiration has its own smart contract. You can click one of the expiration tabs. For each expiration, you will see a "Funds" number and an "Available" number. The "Funds" number is the total amount you have deposited to Etheropt. The "Available" number is the total amount that is available to invest or withdraw. At any given time, your available funds will be equal to the funds you deposited plus the maximum possible loss you could experience from expiring options.

Click the "Funds" button and a dialog box will help you add funds. Click the "Available" button and a dialog box will help you withdraw funds.

Option contracts
----------
Etheropt consists of a series of smart contracts. Each Etheropt smart contract is initialized with a single expiration consisting of an underlying (ETH/USD) and a series of options (for example, the 10 call, the 10 put, the 11 call, and the 11 put). There is a limit on the number of options that can exist in a single Etheropt smart contract (the limit is 20). If you want to see a new expiration listed, raise your hand on Gitter, Twitter, or reddit. Note that there is an in-the-money limit that caps the potential upside of an option. In the smart contract source code, this is called "margin." For example, if the in-the-money limit is 5.0000 and you buy 10 eth worth of the 7 call expiring March 1 for 0.2000 and ETH/USD settles at 13.0000, your net profit will be 10 eth * (-0.2000 + min(5.0000, 13.0000 - 7.0000)) = 48 eth. If the settlement value is below the strike, your net profit will be 10 eth * (-0.2000) = -2 eth.

Order book
----------
The order book Etheropt is stored in a Gitter chat room.

Placing orders
----------
The GUI queries the order book and shows the best bid and offer for each option. To place an order, simply click the buy or sell button next to the contract and enter the size and price you wish to trade. Every contract shows your current position under "My position." If you place an order that doesn't immediately cross with the tightest resting order, the order will be broadcast to the order book. The order will then rest on the order book until it expires or someone trades with it. By default, orders sent from the GUI will expire in 10 blocks (approximately two minutes).

The GUI will only send an order if you have enough funds to cover it. If the order can partially match against a resting order, the partial cross will be sent to the smart contract to trade and the remaining order will rest on the book. For example, if you want to buy 10 eth worth of an option but there is only 5 eth offered, 5 eth will match and the remaining 5 eth will rest on the order book. Similarly, resting orders can be filled in pieces because the smart contract records the portion of an order that has already traded. For example, if you have a resting order to buy 10 eth worth of an option, it can be filled by two counterparties each selling 5 eth of the order.

Every order resting on the order book consists of an option, a price, a size, an expiration block number, an order ID, and a signature. When the smart contract processes an order match, it will verify that the signature is valid, the order has not expired, there is enough unfilled volume in the order, and both users have enough available funds to cover the trade. If these things are true, the smart contract will record the trade.

An advantage of the offchain order book is that transactions with the smart contract are only necessary when crossing trades. The transaction fee (Ethereum gas fee) is paid by the person who crosses the trade and not by the person who creates the resting order. This is similar to the maker/taker fee model used by some centralized exchanges.

Cash usage and expiration
----------
Etheropt keeps track of your cash usage for each expiration. When you buy an option, your cash usage becomes more negative. When you sell an option, your cash usage becomes more positive. For example, if you buy 10 eth worth of the 5 call expiring March 1 for 0.2000, your cash usage decreases by 2 eth. If you sell the option, your cash usage increases by 2 eth.

The contracts belonging to an expiration must be manually expired using the smart contract's expire function. Anyone can do this through the GUI.

It is worth noting how exactly expiration works. For example, if you buy 10 eth worth of the 5 call expiring March 1 for 0.2000, your cash usage becomes -2 eth and your position is 10 eth. If ETH/USD expires at 6.0000, your funds change by 10 eth * (-0.2000 + (6.0000 - 5.0000)) = 8 eth. If ETH/USD expires below the strike, your funds change by 10 eth * (-0.2000) = -2 eth. Similarly, if you are short the option, your funds will change by -8 eth if ETH/USD expires at 6.0000 and +2 eth if ETH/USD expires below the strike.

The smart contract
----------
The Solidity code for the smart contract can be found in the GitHub repository at [etheropt.sol](etheropt.sol). It has been compiled and deployed to the Ethereum network. You are encouraged to read and understand it yourself. You may even want to write your own code to generate transactions to send to the smart contract instead of using the GUI. The contract's functions are listed below.

* **Market(uint expiration_, string underlying_, uint margin_, uint realityID_, bytes32 factHash_, address ethAddr_, int[] strikes_)**: This function initializes the smart contract with an expiration, underlying, margin amount, Reality Keys ID, Reality Keys fact hash, Reality Keys address, and list of strikes (use positive numbers for calls, negative numbers for puts). The limit on the number of strikes is 20.

* **addFunds()**: This function adds the sent value to the user's account.

* **withdrawFunds(uint amount)**: This function withdraws the specified amount from the user's account and cancels all the user's outstanding orders. If the user doesn't have enough available funds to cover the withdrawal, then no withdrawal takes place.

* **getFunds(address user, bool onlyAvailable) constant returns(int)**: This function gets the total sum of all deposits less withdrawals in the user's account. If the onlyAvailable flag is true, it adds in the maximum possible loss so that it will return the total available funds.

* **getFundsAndAvailable(address user) constant returns(int, int)**: This function gets the funds and available funds in the user's account.

* **marketMaker(string server)**: Deprecated.

* **getMarketMakers() constant returns(string, string, string, string, string, string)**: Deprecated.

* **getMarketMakerFunds() constant returns(int, int, int, int, int, int)**: Deprecated.

* **getOptionChain() constant returns (uint, string, uint, uint, bytes32, address)**: This function returns the expiration (timestamp), underlying, margin, Reality Keys ID, Reality Keys fact hash, and Reality Keys address.

* **expire(uint accountID, uint8 v, bytes32 r, bytes32 s, bytes32 value)**: This function expires the option chain if the provided signature is valid. If the accountID is 0, it expires all accounts. If the accountID is greater than zero, then it expires just the specified account (and marks it as expired). Expiration also returns funds to the users so that they don't have to manually withdraw after expiration.

* **getMoneyness(int strike, uint settlement, uint margin) constant returns(int)**: This function takes the strike (put is negative), settlement, and margin (all these values are scaled by 1000000000000000000) and returns the moneyness (also scaled by 1000000000000000000), taking into account the margin.

* **orderMatch(uint optionID, uint price, int size, uint orderID, uint blockExpires, address addr, uint8 v, bytes32 r, bytes32 s, int matchSize)**: This function matches an order. It will fail if there isn't enough size left in the order to match the trade, if either user doesn't have enough funds to cover the trade, if the order has expired, or if the signature is invalid. If the trade can cross, the users' positions will be updated to reflect the trade. Before attempting to match the trade, this function will add any sent value to the sender's account (so you can add funds and place an order at the same time). This value will be added to the user's account regardless of whether the order match succeeds.

* **orderMatchTest(uint optionID, uint price, int size, uint orderID, uint blockExpires, address addr, address sender, uint value, int matchSize) constant returns(bool)**: This function is a convenience function to test all of the failure conditions in the orderMatch function except for the signature check. The value represents the value that will be sent with the order match in order to fund the sender's account.

* **getMaxLossAfterTrade(address user, uint optionID, int positionChange, int cashChange) constant returns(int)**: This function returns the user's maximum possible loss after doing the specified trade.

* **min(uint a, uint b) constant returns(uint)**: This function returns the minimum of two numbers.

Tests
----------
Install mocha and then run
```
mocha test
```
