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

var addr = '0x76a43315b5e2b16111d1cc8c9fbc377efd432dff';
var pk = '380ae32194195544f5ba569243fd4bd2c9eb7932a383fb06a6bf6007308161a0';
console.log(utility.verifyPrivateKey(addr, pk));
