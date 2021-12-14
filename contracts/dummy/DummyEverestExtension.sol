// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "../BaseEverestExtension.sol";


// Testing contract for the Everest Extension functionality

contract DummyEverestExtension is BaseEverestExtension {

    mapping(address => uint256) public userEverest;

    constructor(address _everest) {
        require(_everest != address(0), "Missing EverestToken");
        everest = EverestToken(_everest);
    }

    function joinDummyExtension()
        public
    {
        userEverest[msg.sender] = _getUserEverest(msg.sender);
    }

    function updateUserEverest(uint256 _everestAmount, address _userAdd)
        external override
        onlyEverestToken
    {
        userEverest[_userAdd] = _everestAmount;
    }
}