var configs = {};

//mainnet
configs["1"] = {
  homeURL: 'https://etheropt.github.io',
  // homeURL: 'http://localhost:8080',
  contractMarket: 'etheropt.sol',
  contractContracts: 'etheropt_contracts.sol',
  contractAddrs: [],
  contractContractsAddr: '0x9eea10abd08519d7a2cc3734ff8bb38e1de35446',
  domain: undefined,
  port: 8082,
  url: undefined,
  ethTestnet: false,
  ethProvider: 'http://localhost:8545',
  ethGasPrice: 20000000000,
  ethAddr: '0x0000000000000000000000000000000000000000',
  ethAddrPrivateKey: '',
  gitterHost: 'https://api.gitter.im',
  gitterStream: 'stream.gitter.im',
  gitterToken: 'fab13af0884785b1876c813dddc1727c573326f5',
  gitterRoomID: '5776ec9ac2f0db084a2105c2',
  userCookie: 'Etheropt',
  eventsCacheCookie: 'Etheropt_eventsCache'
};

//testnet
configs["2"] = {
  homeURL: 'https://etheropt.github.io',
  // homeURL: 'http://localhost:8080',
  contractMarket: 'etheropt.sol',
  contractContracts: 'etheropt_contracts.sol',
  contractAddrs: [],
  contractContractsAddr: '0x94968f0f86e5000d3d4e093a680dc01a10b3d1ea',
  domain: undefined,
  port: 8082,
  url: undefined,
  ethTestnet: true,
  ethProvider: 'http://localhost:8545',
  ethGasPrice: 20000000000,
  ethAddr: '0x0000000000000000000000000000000000000000',
  ethAddrPrivateKey: '',
  gitterHost: 'https://api.gitter.im',
  gitterStream: 'stream.gitter.im',
  gitterToken: 'fab13af0884785b1876c813dddc1727c573326f5',
  gitterRoomID: '5776ec9ac2f0db084a2105c2',
  userCookie: 'Etheropt_testnet',
  eventsCacheCookie: 'Etheropt_eventsCache_testnet'
};

//default config
var config = configs["1"]; //mainnet

try {
  global.config = config;
  global.configs = configs;
  module.exports = config;
} catch (err) {}
