// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "../libs/ERC20Mintable.sol";

contract DummySUMMITLP is ERC20Mintable('Dummy SUMMIT LP', 'SUMMIT-XXX LP') {
    address public token0;
    address public token1;
    uint256 private reserve0;
    uint256 private reserve1;

    function setTokens(address _token0, address _token1) external {
        token0 = _token0;
        token1 = _token1;
    }

    function setReserves(uint256 _reserve0, uint256 _reserve1) external {
        reserve0 = _reserve0;
        reserve1 = _reserve1;
    }

    function getReserves() external view returns (uint256, uint256, uint256) {
        return (reserve0, reserve1, block.timestamp);
    }
}