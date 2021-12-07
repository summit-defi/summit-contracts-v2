//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;


interface ISummitRNGModule {
    function getRandomNumber(uint8 elevation, uint256 roundNumber) external view returns (uint256);
    function setSeedRoundEndTimestamp(uint256 _seedRoundEndTimestamp) external;
}