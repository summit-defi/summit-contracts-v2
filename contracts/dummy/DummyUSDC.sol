// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "../libs/DummyERC20Mintable.sol";

// SummitToken with Governance.
contract DummyUSDC is DummyERC20Mintable('Dummy USDC', 'USDC') {
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}