//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;


interface ISummitVRFModule {
    function getRandomNumber(uint256 roundNumber) external view returns (uint256);
    function setSeedRoundEndTimestamp(uint256 _seedRoundEndTimestamp) external;
}