var config = {};

config.home_url = 'http://etheropt.github.io';
// config.home_url = 'http://localhost:8080';
config.contract_market = 'etheropt.sol';
config.contract_market_addr = '0x8faae0c79d421eb80e5afd4823931541a3100a20';
config.domain = undefined;
config.port = 8081;
config.eth_testnet = true;
config.eth_provider = 'http://localhost:8545';
config.eth_addr = '0x0000000000000000000000000000000000000000';
config.eth_addr_pk = '';

try {
  global.config = config;
  module.exports = config;
} catch (err) {}
