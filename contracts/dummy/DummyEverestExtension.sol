// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "../BaseEverestExtension.sol";


// Testing contract for the Everest Extension functionality

contract DummyEverestExtension is BaseEverestExtension {

    mapping(address => uint256) public userEverest;

    function joinDummyExtension()
        public
    {
        userEverest[msg.sender] = getUserEverest(msg.sender);
    }

    function updateUserEverest(uint256 _everestAmount, address _userAdd)
        external override
        onlyExpeditionV2
    {
        userEverest[_userAdd] = _everestAmount;
    }
}