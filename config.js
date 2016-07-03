var config = {};

config.homeURL = 'https://etheropt.github.io';
// config.homeURL = 'http://localhost:8080';
config.contractMarket = 'etheropt.sol';
config.contractContracts = 'etheropt_contracts.sol';
config.contractAddrs = [];
config.contractContractsAddr = '0x9eea10abd08519d7a2cc3734ff8bb38e1de35446';
config.domain = undefined;
config.port = 8082;
config.url = undefined;
config.ethTestnet = false;
config.ethProvider = 'http://localhost:8545';
config.ethGasPrice = 20000000000;
config.ethAddr = '0x0000000000000000000000000000000000000000';
config.ethAddrPrivateKey = '';
config.gitterHost = 'https://api.gitter.im';
config.gitterToken = 'fab13af0884785b1876c813dddc1727c573326f5';
config.gitterRoomID = '5776ec9ac2f0db084a2105c2';

try {
  global.config = config;
  module.exports = config;
} catch (err) {}
