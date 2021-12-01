//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;


interface ISummitVRFModule {
    function futureBlockMined() external view returns (bool);
    function nextSeedRoundAvailable() external view returns (bool);
    function getRandomNumber(uint256 roundNumber) external view returns (uint256);

    function setElevationHelper (address _elevationHelper) external;
    function setTrustedSeederAdd(address _trustedSeeder) external;
    function setSeedRoundEndTimestamp(uint256 _seedRoundEndTimestamp) external;  

    function receiveSealedSeed(bytes32 _sealedSeed) external;
    function receiveUnsealedSeed(bytes32 _unsealedSeed) external;
}