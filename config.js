var config = {};

config.home_url = 'http://etheropt.github.io';
// config.home_url = 'http://localhost:8080';
config.contract_market = 'etheropt.sol';
config.contract_addrs = [
  '0x73cbe96839b723bc913d10ba32b58fc476988a36',
  '0x0096800019bf4eca0bed5a714a553ecf844884c5',
  '0xb35abc849d143014f354486879bae428d696ab3b',
  '0x78798676a4b40b4650f9e8c07350a29953d5d933',
  '0xa3d4d7df3988d48c48728787cb5910a8a4cc4d26',
];
config.contract_addr = config.contract_addrs[0];
config.domain = undefined;
config.port = 8081;
config.eth_testnet = false;
config.eth_provider = 'http://localhost:8545';
config.eth_gas_price = 20000000000;
config.eth_addr = '0x0000000000000000000000000000000000000000';
config.eth_addr_pk = '';

try {
  global.config = config;
  module.exports = config;
} catch (err) {}
