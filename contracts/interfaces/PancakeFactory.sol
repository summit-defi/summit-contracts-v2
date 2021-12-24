// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import './IPancakeFactory.sol';

contract PancakeFactory is IPancakeFactory {
    function createPair(address tokenA, address) external pure override returns (address pair) {
        return tokenA; // WRONG: just needed for abi
    }
    function getPair(address tokenA, address) external pure override returns (address pair) {
        return tokenA; // WRONG: just needed for abi
    }
}