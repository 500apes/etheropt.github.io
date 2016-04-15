contract EtheroptContracts {

  struct Contract {
    address addr;
    bool active;
  }
  mapping(uint => Contract) contracts;
  uint public numContracts = 0;
  mapping(address => uint) contractIDs; //starts at 1

  function newContract(address addr) {
    if (msg.value>0) throw;
    numContracts++;
    contracts[numContracts].addr = addr;
    contracts[numContracts].active = true;
    contractIDs[addr] = numContracts;
  }

  function getContracts() constant returns(address[]) {
    address[] memory addrs = new address[](20);
    uint z = 0;
    for (uint i=numContracts; i>0 && z<20; i--) {
      if (contracts[i].active == true) {
        addrs[z] = contracts[i].addr;
        z++;
      }
    }
    return addrs;
  }

  function disableContract(address addr) {
    if (msg.value>0) throw;
    contracts[contractIDs[addr]].active = false;
  }

}
