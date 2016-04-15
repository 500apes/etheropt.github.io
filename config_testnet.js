var config = {};

config.home_url = 'http://etheropt.github.io';
// config.home_url = 'http://localhost:8080';
config.contract_market = 'etheropt.sol';
config.contract_contracts = 'etheropt_contracts.sol';
config.contract_addrs = [];
config.contract_contracts_addr = '0x94968f0f86e5000d3d4e093a680dc01a10b3d1ea';
config.domain = undefined;
config.port = 8082;
config.eth_testnet = true;
config.eth_provider = 'http://localhost:8545';
config.eth_gas_price = 20000000000;
config.eth_addr = '0x0000000000000000000000000000000000000000';
config.eth_addr_pk = '';

try {
  global.config = config;
  module.exports = config;
} catch (err) {}
