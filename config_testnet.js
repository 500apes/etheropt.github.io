var config = {};

config.home_url = 'http://etheropt.github.io';
config.home_url = 'http://localhost:8080';
config.contract_market = 'etheropt.sol';
config.contract_addrs = [
  '0xc410dd2b4f77fc765537ba2676a645a6f12a7922',
  '0xdbfaaab8145e56d2127935a34888099e025dfb5f',
];
config.contract_addr = config.contract_addrs[0];
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
