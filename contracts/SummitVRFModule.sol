//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/ISummitVRFModule.sol";



/*
---------------------------------------------------------------------------------------------
--   S U M M I T . D E F I
---------------------------------------------------------------------------------------------


Summit is highly experimental.
It has been crafted to bring a new flavor to the defi world.
We hope you enjoy the Summit.defi experience.
If you find any bugs in these contracts, please claim the bounty (see docs)


Created with love by Architect and the Summit team





---------------------------------------------------------------------------------------------
--   C U S T O M V R F
---------------------------------------------------------------------------------------------


It is also responsible for requesting and receiving the trusted seeds, as well as their decrypted versions after the future block is mined


RANDOM NUMBER GENERATION
    . Webservice queries `nextSeedRoundAvailable` every 5 seconds
    . When true received
    . Webservice creates a random seed, seals it with the trustedSeeder address, and sends it to `receiveSealedSeed`
    . When the futureBlockNumber set in `receiveSealedSeed` is mined, `futureBlockMined` will return true
    . Webservice sends the original unsealed seed to `receiveUnsealedSeed`
*/

contract SummitVRFModule is Ownable, ISummitVRFModule {
    // ---------------------------------------
    // --   V A R I A B L E S
    // ---------------------------------------
    
    address public cartographer;                                            // Allows cartographer to act as secondary owner-ish
    address public trustedSeeder;                                           // Submits trusted sealed seed when round locks 60 before round end
    address public elevationHelper;                                         // ElevationHelper address
    
    uint256 constant baseRoundDuration = 3600;                              // Duration (seconds) of the smallest round chunk

    uint256 seedRoundEndTimestamp;                                          // Timestamp the first seed round ends
    uint256 seedRoundDurationMult = 2;
    uint256 seedRound = 0;                                                  // The sealed seed is generated at the top of every hour
    mapping(uint256 => bytes32) sealedSeed;                                 // Sealed seed for each seed round, provided by trusted seeder webservice                                              
    mapping(uint256 => bytes32) unsealedSeed;                               // Sealed seed for each seed round, provided by trusted seeder webservice                                              
    mapping(uint256 => uint256) futureBlockNumber;                          // Future block number for each seed round
    mapping(uint256 => bytes32) futureBlockHash;                            // Future block hash for each seed round


    // ---------------------------------------
    // --   M O D I F I E R S
    // ---------------------------------------

    modifier onlyCartographer() {
        require(msg.sender == cartographer, "Only cartographer");
        _;
    }
    modifier onlyElevationHelper() {
        require(msg.sender != address(0), "ElevationHelper not defined");
        require(msg.sender == elevationHelper, "Only elevationHelper");
        _;
    }
    modifier onlyTrustedSeeder() {
        require(msg.sender == trustedSeeder, "Only trusted seeder");
        _;
    }

    
    // ---------------------------------------
    // --   I N I T I A L I Z A T I O N
    // ---------------------------------------

    /// @dev Creates SummitVRFModule contract with cartographer as owner of certain functionality
    /// @param _cartographer Address of main Cartographer contract
    constructor(address _cartographer)
        onlyOwner
    {
        require(_cartographer != address(0), "Cartographer missing");
        cartographer = _cartographer;
    }


    /// @dev Set elevationHelper
    /// @param _elevationHelper Address of ElevationHelper contract
    function setElevationHelper (address _elevationHelper)
        public onlyOwner
    {
        require(_elevationHelper != address(0), "ElevationHelper missing");
        elevationHelper = _elevationHelper;
    }


    /// @dev Update trusted seeder
    /// @param _trustedSeeder Address of trustedSeeder
    function setTrustedSeederAdd(address _trustedSeeder) public override onlyCartographer {
        require(_trustedSeeder != address(0), "Trusted seeder missing");
        trustedSeeder = _trustedSeeder;
    }
    

    /// @dev Update seedRoundEndTimestamp
    /// @param _seedRoundEndTimestamp amount of seedRoundEndTimestamp
    function setSeedRoundEndTimestamp(uint256 _seedRoundEndTimestamp) public override onlyElevationHelper {
        seedRoundEndTimestamp = _seedRoundEndTimestamp;
    }
    

    

    // ------------------------------------------------------------------
    // --   R A N D O M N E S S   S E E D I N G
    // ------------------------------------------------------------------


    // Flow of seeding:
    // Webservice queries `nextSeedRoundAvailable` every 5 seconds
    // When true received
    // Webservice creates a random seed, seals it with the trustedSeeder address, and sends it to `receiveSealedSeed`
    // When the futureBlockNumber set in `receiveSealedSeed` is mined, `futureBlockMined` will return true
    // Webservice sends the original unsealed seed to `receiveUnsealedSeed`


    /// @dev Whether the future block has been mined, allowing the unencrypted seed to be received
    function futureBlockMined() public view returns (bool) {
        return sealedSeed[seedRound] != "" &&
            block.number > futureBlockNumber[seedRound] &&
            unsealedSeed[seedRound] == "";
    }


    /// @dev Seed round locked
    function nextSeedRoundAvailable() public view returns (bool) {
        return block.timestamp >= seedRoundEndTimestamp;
    }


    /// @dev Get random number
    function getRandomNumber(uint256 roundNumber) public view override returns (uint256) {
        return uint256(keccak256(abi.encode(roundNumber, unsealedSeed[seedRound], futureBlockHash[seedRound])));
    }


    /// @dev When an elevation reaches the lockout phase 60s before rollover, the sealedseed webserver will send a seed
    /// If the webserver goes down (99.99% uptime, 3 outages of 1H each over 3 years) the randomness is still secure, and is only vulnerable to a single round of withheld block attack
    /// @param _sealedSeed random.org backed sealed seed from the trusted address, run by an autonomous webserver
    function receiveSealedSeed(bytes32 _sealedSeed)
        public
        onlyTrustedSeeder
    {
        require(nextSeedRoundAvailable(), "Already sealed seeded");

        // Increment seed round and set next seed round end timestamp
        seedRound += 1;
        seedRoundEndTimestamp += (baseRoundDuration * seedRoundDurationMult);

        // Store new sealed seed for next round of round rollovers
        sealedSeed[seedRound] = _sealedSeed;
        futureBlockNumber[seedRound] = block.number + 1;
    }


    /// @dev Receives the unencrypted seed after the future block has been mined
    /// @param _unsealedSeed Unencrypted seed
    function receiveUnsealedSeed(bytes32 _unsealedSeed)
        public
        onlyTrustedSeeder
    {
        require(unsealedSeed[seedRound] == "", "Already unsealed seeded");
        require(futureBlockMined(), "Future block not reached");
        require(keccak256(abi.encodePacked(_unsealedSeed, msg.sender)) == sealedSeed[seedRound], "Unsealed seed does not match");
        unsealedSeed[seedRound] = _unsealedSeed;
        futureBlockHash[seedRound] = blockhash(futureBlockNumber[seedRound]);
    }
}