// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "./EverestToken.sol";

abstract contract BaseEverestExtension {

    EverestToken public everest;

    modifier onlyEverestToken() {
        require(msg.sender == address(everest), "Only callable by ExpeditionV2");
        _;
    }

    function _getUserEverest(address _userAdd)
        internal view
        returns (uint256)
    {
        return everest.getUserEverestOwned(_userAdd);
    }

    function updateUserEverest(uint256 _everestAmount, address _userAdd)
        external virtual;
}