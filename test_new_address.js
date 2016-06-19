var utility = require('./utility.js');
var keythereum = require('keythereum');
var ethUtil = require('ethereumjs-util');

var errors = 0;
var n = 0;
for (var i=0; i<1000; i++) {
  var result = utility.createAddress();
  var addr = result[0];
  var pk = result[1];
  if (!utility.verifyPrivateKey(addr, pk)) {
    errors++;
  }
  n++;
}
console.log(errors, n);
