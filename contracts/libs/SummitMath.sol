// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

library SummitMath {

    function scaledValue(uint256 scalar, uint256 minBound, uint256 maxBound, uint256 minResult, uint256 maxResult)
        internal pure
        returns (uint256)
    {
        require(minBound <= maxBound, "Invalid scaling range");
        if (minResult == maxResult) return minResult;
        if (scalar <= minBound) return minResult;
        if (scalar >= maxBound) return maxResult;
        if (maxResult > minResult) {
            return (((scalar - minBound) * (maxResult - minResult) * 1e12) / (maxBound - minBound) / 1e12) + minResult;
        }
        return (((maxBound - scalar) * (minResult - maxResult) * 1e12) / (maxBound - minBound) / 1e12) + maxResult;
    }
}