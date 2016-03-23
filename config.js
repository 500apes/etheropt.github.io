var config = {};

config.home_url = 'http://etheropt.github.io';
config.home_url = 'http://localhost:8080';
config.contract_market = 'market.sol';
config.contract_market_addr = '0xa53a97035d0fe849ece2c14c74c7a468413426da';
config.domain = undefined;
config.port = 8081;
config.eth_testnet = true;
config.eth_provider = 'http://localhost:8546';
config.eth_addr = '0x0000000000000000000000000000000000000000';
config.eth_addr_pk = '';

try {
  global.config = config;
  module.exports = config;
} catch (err) {}
