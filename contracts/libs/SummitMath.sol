// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

library SummitMath {

    function scaledValue(uint256 scalar, uint256 minBound, uint256 maxBound, uint256 minResult, uint256 maxResult)
        internal pure
        returns (uint256)
    {
        require (minBound <= maxBound, "Invalid scaling range");
        if (scalar <= minBound) return minResult;
        if (scalar >= maxBound) return maxResult;
        return (((scalar - minBound) * (maxResult - minResult) * 1e12) / (maxBound - minBound) / 1e12) + minResult;
    }
}