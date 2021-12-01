// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "./ExpeditionV2.sol";

abstract contract BaseEverestExtension {

    ExpeditionV2 public expeditionV2;

    modifier onlyExpeditionV2() {
        require(msg.sender == address(expeditionV2), "Only callable by ExpeditionV2");
        _;
    }

    function getUserEverest(address _userAdd)
        internal view
        returns (uint256)
    {
        return expeditionV2.getUserEverestOwned(_userAdd);
    }

    function updateUserEverest(uint256 _everestAmount, address _userAdd)
        external virtual;
}