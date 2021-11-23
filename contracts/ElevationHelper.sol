//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";


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
--   E L E V A T I O N   H E L P E R
---------------------------------------------------------------------------------------------


ElevationHelper.sol handles shared functionality between the elevations / expedition
It is also responsible for requesting and receiving the trusted seeds, as well as their decrypted versions after the future block is mined
Handles the allocation multiplier for each elevation
Handles the duration of each round


RANDOM NUMBER GENERATION
    . Webservice queries `nextSeedRoundAvailable` every 5 seconds
    . When true received
    . Webservice creates a random seed, seals it with the trustedSeeder address, and sends it to `receiveSealedSeed`
    . When the futureBlockNumber set in `receiveSealedSeed` is mined, `futureBlockMined` will return true
    . Webservice sends the original unsealed seed to `receiveUnsealedSeed`


*/

contract ElevationHelper is Ownable {
    // ---------------------------------------
    // --   V A R I A B L E S
    // ---------------------------------------

    address public cartographer;                                            // Allows cartographer to act as secondary owner-ish
    address public trustedSeeder;                                           // Submits trusted sealed seed when round locks 60 before round end

    // Constants for elevation comparisons
    uint8 constant OASIS = 0;
    uint8 constant TWOTHOUSAND = 1;
    uint8 constant FIVETHOUSAND = 2;
    uint8 constant TENTHOUSAND = 3;
    uint8 constant EXPEDITION = 4;
    uint8 constant roundEndLockoutDuration = 120;

    
    uint16[5] public allocMultiplier = [100, 110, 125, 150, 100];            // Alloc point multipliers for each elevation    
    uint16[5] public pendingAllocMultiplier = [100, 110, 125, 150, 100];     // Pending alloc point multipliers for each elevation, updated at end of round for elevation, instantly for oasis   
    uint8[5] public totemCount = [1, 2, 5, 10, 2];                          // Number of totems at each elevation

    
    uint256 constant baseRoundDuration = 3600;                              // Duration (seconds) of the smallest round chunk
    uint256[5] public durationMult = [0, 2, 2, 2, 24];                      // Number of round chunks for each elevation
    uint256[5] public pendingDurationMult = [0, 2, 2, 2, 24];               // Duration mult that takes effect at the end of the round

    uint256[5] public unlockTimestamp;                                      // Time at which each elevation unlocks to the public
    uint256[5] public roundNumber;                                          // Current round of each elevation
    uint256[5] public roundEndTimestamp;                                    // Time at which each elevation's current round ends
    mapping(uint256 => uint256) public expeditionDeityDivider;                // Higher / lower integer for each expedition round

    mapping(uint8 => mapping(uint256 => uint256)) public totemWinsAccum;    // Accumulator of the total number of wins for each totem
    mapping(uint8 => mapping(uint256 => uint8)) public winningTotem;        // The specific winning totem for each elevation round


    uint256 constant referralDurationMult = 24 * 7;                         // Round chunk multiplier for the unclaimed referral rewards burn
    uint256 public referralRound;                                           // Incrementor of the referral round
    uint256 public referralBurnTimestamp;                                   // Time at which burning unclaimed referral rewards becomes available


    uint256 seedRoundEndTimestamp;                                          // Timestamp the first seed round ends
    uint256 seedRoundDurationMult = 2;
    uint256 seedRound = 0;                                                  // The sealed seed is generated at the top of every hour
    mapping(uint256 => bytes32) sealedSeed;                                 // Sealed seed for each seed round, provided by trusted seeder webservice                                              
    mapping(uint256 => bytes32) unsealedSeed;                               // Sealed seed for each seed round, provided by trusted seeder webservice                                              
    mapping(uint256 => uint256) futureBlockNumber;                          // Future block number for each seed round
    mapping(uint256 => bytes32) futureBlockHash;                            // Future block hash for each seed round






    // ---------------------------------------
    // --   E V E N T S
    // ---------------------------------------

    event SetTrustedSeederAdd(address indexed user, address indexed newAddress);
    event WinningTotemSelected(uint8 indexed elevation, uint256 indexed round, uint8 indexed totem);
    event DeityDividerSelected(uint256 indexed expeditionRound, uint256 indexed deityDivider);



    
    // ---------------------------------------
    // --   I N I T I A L I Z A T I O N
    // ---------------------------------------

    /// @dev Creates ElevationHelper contract with cartographer as owner of certain functionality
    /// @param _cartographer Address of main Cartographer contract
    constructor(address _cartographer)
        onlyOwner
    {
        require(_cartographer != address(0), "Cartographer missing");
        cartographer = _cartographer;
    }

    /// @dev Turns on the Summit ecosystem across all contracts
    /// @param _enableTimestamp Timestamp at which Summit was enabled, used to set unlock points for each elevation
    function enable(uint256 _enableTimestamp)
        external
        onlyCartographer
    {
        // The next top of hour from the enable timestamp
        uint256 nextHourTimestamp = _enableTimestamp + (3600 - (_enableTimestamp % 3600));

        // Setting when each elevation of the ecosystem unlocks
        unlockTimestamp = [
            nextHourTimestamp,                       // Oasis - throwaway
            nextHourTimestamp + 1 days,              // Plains
            nextHourTimestamp + 3 days,              // Mesa
            nextHourTimestamp + 5 days,              // Summit
            nextHourTimestamp + 7 days               // Expedition
        ];

        // The first 'round' ends when the elevation unlocks
        roundEndTimestamp = unlockTimestamp;
        
        // Timestamp the first unclaimed referral rewards burn becomes available
        referralBurnTimestamp = nextHourTimestamp + 7 days;    

        // Timestamp of the first seed round starting
        seedRoundEndTimestamp = nextHourTimestamp - roundEndLockoutDuration;
    }


    /// @dev Update trusted seeder
    function setTrustedSeederAdd(address _trustedSeeder) external onlyCartographer {
        require(_trustedSeeder != address(0), "Trusted seeder missing");
        trustedSeeder = _trustedSeeder;

        emit SetTrustedSeederAdd(msg.sender, _trustedSeeder);
    }
    




    // ---------------------------------------
    // --   M O D I F I E R S
    // ---------------------------------------

    modifier onlyCartographer() {
        require(msg.sender == cartographer, "Only cartographer");
        _;
    }
    modifier onlyTrustedSeeder() {
        require(msg.sender == trustedSeeder, "Only trusted seeder");
        _;
    }
    modifier allElevations(uint8 _elevation) {
        require(_elevation <= EXPEDITION, "Bad elevation");
        _;
    }
    modifier elevationOrExpedition(uint8 _elevation) {
        require(_elevation >= TWOTHOUSAND && _elevation <= EXPEDITION, "Bad elevation");
        _;
    }
    





    // ---------------------------------------
    // --   U T I L S (inlined for brevity)
    // ---------------------------------------


    /// @dev Allocation multiplier of an elevation
    /// @param _elevation Desired elevation
    function elevationAllocMultiplier(uint8 _elevation) public view returns (uint256) {
        return uint256(allocMultiplier[_elevation]);
    }
    
    /// @dev Duration of elevation round in seconds
    /// @param _elevation Desired elevation
    function roundDurationSeconds(uint8 _elevation) public view returns (uint256) {
        return durationMult[_elevation] * baseRoundDuration;
    }

    /// @dev Current round of the expedition
    function currentExpeditionRound() public view returns (uint256) {
        return roundNumber[EXPEDITION];
    }

    /// @dev Deity divider (random offset which skews chances of each deity winning) of the current expedition round
    function currentDeityDivider() public view returns (uint256) {
        return expeditionDeityDivider[currentExpeditionRound()];
    }

    /// @dev Modifies a given alloc point with the multiplier of that elevation, used to set a single allocation for a token while each elevation is set automatically
    /// @param _allocPoint Base alloc point to modify
    /// @param _elevation Fetcher for the elevation multiplier
    function elevationModulatedAllocation(uint256 _allocPoint, uint8 _elevation) external view allElevations(_elevation) returns (uint256) {
        return _allocPoint * allocMultiplier[_elevation];
    }

    /// @dev Checks whether elevation is is yet to be unlocked for farming
    /// @param _elevation Which elevation to check
    function elevationLocked(uint8 _elevation) external view returns (bool) {
        console.log("ElevationLocked", _elevation, unlockTimestamp[_elevation], block.timestamp <= unlockTimestamp[_elevation]);
        return block.timestamp <= unlockTimestamp[_elevation];
    }

    /// @dev Checks whether elevation is locked due to round ending in next {roundEndLockoutDuration} seconds
    /// @param _elevation Which elevation to check
    function endOfRoundLockoutActive(uint8 _elevation) external view returns (bool) {
        console.log("Lockout?", _elevation, block.timestamp, roundEndTimestamp[_elevation]);
        if (roundEndTimestamp[_elevation] == 0) return false;
        return block.timestamp >= (roundEndTimestamp[_elevation] - roundEndLockoutDuration);
    }

    /// @dev The next round available for a new pool to unlock at. Used to add pools but not start them until the next rollover
    /// @param _elevation Which elevation to check
    function nextRound(uint8 _elevation) external view returns (uint256) {
        return block.timestamp <= unlockTimestamp[_elevation] ? 1 : (roundNumber[_elevation] + 1);
    }

    /// @dev Whether a round has ended
    /// @param _elevation Which elevation to check
    function roundEnded(uint8 _elevation) internal view returns (bool) {
        return block.timestamp >= roundEndTimestamp[_elevation];
    }

    /// @dev Seconds remaining in round of elevation
    /// @param _elevation Which elevation to check time remaining of
    function timeRemainingInRound(uint8 _elevation) public view returns (uint256) {
        return roundEnded(_elevation) ? 0 : roundEndTimestamp[_elevation] - block.timestamp;
    }

    /// @dev Getter of fractional amount of round remaining
    /// @param _elevation Which elevation to check progress of
    /// @return Fraction raised to 1e12
    function fractionRoundRemaining(uint8 _elevation) external view returns (uint256) {
        return timeRemainingInRound(_elevation) * 1e12 / roundDurationSeconds(_elevation);
    }

    /// @dev Getter of fractional progress through round
    /// @param _elevation Which elevation to check progress of
    /// @return Fraction raised to 1e12
    function fractionRoundComplete(uint8 _elevation) external view returns (uint256) {
        return ((roundDurationSeconds(_elevation) - timeRemainingInRound(_elevation)) * 1e12) / roundDurationSeconds(_elevation);
    }

    /// @dev Start timestamp of current round
    /// @param _elevation Which elevation to check
    function currentRoundStartTime(uint8 _elevation) external view returns(uint256) {
        return roundEndTimestamp[_elevation] - roundDurationSeconds(_elevation);
    }

    /// @dev Time remaining until next available referral burn event
    function referralBurnTimeRemaining() external view returns (uint256) {
        return referralBurnTimestamp - block.timestamp;
    }

    /// @dev Validate unclaimed referral rewards available for burning
    function validateReferralBurnAvailable() external view {
        require(block.timestamp >= referralBurnTimestamp, "Referral burn not available");
    }




    
    // ------------------------------------------------------------------
    // --   P A R A M E T E R S
    // ------------------------------------------------------------------


    /// @dev Update round duration mult of an elevation
    function setElevationRoundDurationMult(uint8 _elevation, uint8 _mult)
        public
        onlyOwner elevationOrExpedition(_elevation)
    {
        require(_mult > 0, "Duration mult must be non zero");
        pendingDurationMult[_elevation] = _mult;
    }


    /// @dev Update emissions multiplier of an elevation
    function setElevationAllocMultiplier(uint8 _elevation, uint8 _allocMultiplier)
        public
        onlyOwner allElevations(_elevation)
    {
        require(_allocMultiplier <= 300, "Multiplier cannot exceed 3X");
        pendingAllocMultiplier[_elevation] = _allocMultiplier;
        if (_elevation == OASIS) {
            allocMultiplier[_elevation] = _allocMultiplier;
        }
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


    /// @dev Seed round locked
    function nextSeedRoundAvailable() public view returns (bool) {
        return block.timestamp >= seedRoundEndTimestamp;
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


    /// @dev Whether the future block has been mined, allowing the unencrypted seed to be received
    function futureBlockMined() public view returns (bool) {
        return sealedSeed[seedRound] != "" &&
            block.number > futureBlockNumber[seedRound] &&
            unsealedSeed[seedRound] == "";
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


    


    // ------------------------------------------------------------------
    // --   R O L L O V E R   E L E V A T I O N   R O U N D
    // ------------------------------------------------------------------


    /// @dev Validates that the selected elevation is able to be rolled over
    /// @param _elevation Which elevation is attempting to be rolled over
    function validateRolloverAvailable(uint8 _elevation)
        external view
    {
        // Elevation must be unlocked for round to rollover
        require(block.timestamp >= unlockTimestamp[_elevation], "Elevation locked");
        // Rollover only becomes available after the round has ended, if timestamp is before roundEnd, the round has already been rolled over and its end timestamp pushed into the future
        require(block.timestamp >= roundEndTimestamp[_elevation], "Round already rolled over");
    }


    /// @dev Uses the seed and future block number to generate a random number, which is then used to select the winning totem and if necessary the next deity divider
    /// @param _elevation Which elevation to select winner for
    function selectWinningTotem(uint8 _elevation)
        external
        onlyCartographer elevationOrExpedition(_elevation)
    {
        // No winning totem should be selected for round 0, which takes place when the elevation is locked
        if (roundNumber[_elevation] == 0) { return; }

        // Create the random number from the future block hash and newly unsealed seed
        uint256 rand = uint256(keccak256(abi.encode(roundNumber[_elevation], unsealedSeed[seedRound], futureBlockHash[seedRound])));

        // Uses the random number to select the winning totem
        uint8 winner = chooseWinningTotem(_elevation, rand);

        // Updates data with the winning totem
        markWinningTotem(_elevation, winner);

        // If necessary, uses the random number to generate the next deity divider for expeditions
        if (_elevation == EXPEDITION)
            setNextDeityDivider(rand);
    }


    /// @dev Final step in the rollover pipeline, incrementing the round numbers to bring current
    /// @param _elevation Which elevation is being updated
    function rolloverElevation(uint8 _elevation)
        external
        onlyCartographer
    {
        // Incrementing round number, does not need to be adjusted with overflown rounds
        roundNumber[_elevation] += 1;

        // Failsafe to cover multiple rounds needing to be rolled over if no user rolled them over previously (almost impossible, but just in case)
        uint256 overflownRounds = ((block.timestamp - roundEndTimestamp[_elevation]) / roundDurationSeconds(_elevation));
        
        // Brings current with any extra overflown rounds
        roundEndTimestamp[_elevation] += roundDurationSeconds(_elevation) * overflownRounds;

        // Updates round duration if necessary
        if (pendingDurationMult[_elevation] != durationMult[_elevation]) {
            durationMult[_elevation] = pendingDurationMult[_elevation];
        }

        // Adds the duration of the current round (updated if necessary) to the current round end timestamp
        roundEndTimestamp[_elevation] += roundDurationSeconds(_elevation);

        // Updates elevation allocation multiplier if necessary
        if (pendingAllocMultiplier[_elevation] != allocMultiplier[_elevation]) {
            allocMultiplier[_elevation] = pendingAllocMultiplier[_elevation];
        }
    }


    /// @dev Simple modulo on generated random number to choose the winning totem (inlined for brevity)
    /// @param _elevation Which elevation the winner will be selected for
    /// @param _rand The generated random number to select with
    function chooseWinningTotem(uint8 _elevation, uint256 _rand) internal view returns (uint8) {
        if (_elevation == EXPEDITION)
            return (_rand % 100) < currentDeityDivider() ? 0 : 1;
        return uint8(_rand % totemCount[_elevation]);
    }


    /// @dev Stores selected winning totem (inlined for brevity)
    /// @param _elevation Elevation to store at
    /// @param _winner Selected winning totem
    function markWinningTotem(uint8 _elevation, uint8 _winner) internal {
        totemWinsAccum[_elevation][_winner] += 1;
        winningTotem[_elevation][roundNumber[_elevation]] = _winner;   

        emit WinningTotemSelected(_elevation, roundNumber[_elevation], _winner);
    }


    /// @dev Sets random deity divider (50 - 90) for next expedition round (inlined for brevity)
    /// @param _rand Same rand that chose winner
    function setNextDeityDivider(uint256 _rand) internal {
        // Number between 50 - 90 based on previous round winning number, helps to balance the divider between the deities
        uint256 expedSelector = (_rand % 100);
        uint256 divider = 50 + ((expedSelector * 40) / 100);
        expeditionDeityDivider[currentExpeditionRound() + 1] = divider;

        emit DeityDividerSelected(currentExpeditionRound() + 1, divider);
    }
    


    // ------------------------------------------------------------------
    // --   R O L L O V E R   R E F E R R A L   B U R N
    // ------------------------------------------------------------------
    
    /// @dev Rollover referral burn round
    function rolloverReferralBurn() external  onlyCartographer {
        referralRound += 1;
        referralBurnTimestamp += baseRoundDuration * referralDurationMult;
    }


    
    
    // ------------------------------------------------------------------
    // --   F R O N T E N D
    // ------------------------------------------------------------------
    
    /// @dev Fetcher of historical data for past winning totems
    /// @param _elevation Which elevation to check historical winners of
    /// @return Array of 20 values, first 10 of which are win count accumulators for each totem, last 10 of which are winners of previous 10 rounds of play
    function historicalWinningTotems(uint8 _elevation) public view allElevations(_elevation) returns (uint256[20] memory) {

        // Early escape OASIS winners, as they don't exist
        if (_elevation == OASIS) {
            return [uint256(0), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        }

        uint256 round = roundNumber[_elevation];
        return [
            totemWinsAccum[_elevation][0],
            totemWinsAccum[_elevation][1],
            totemWinsAccum[_elevation][2],
            totemWinsAccum[_elevation][3],
            totemWinsAccum[_elevation][4],
            totemWinsAccum[_elevation][5],
            totemWinsAccum[_elevation][6],
            totemWinsAccum[_elevation][7],
            totemWinsAccum[_elevation][8],
            totemWinsAccum[_elevation][9],
            winningTotem[_elevation][round - 1],
            winningTotem[_elevation][round - 2],
            winningTotem[_elevation][round - 3],
            winningTotem[_elevation][round - 4],
            winningTotem[_elevation][round - 5],
            winningTotem[_elevation][round - 6],
            winningTotem[_elevation][round - 7],
            winningTotem[_elevation][round - 8],
            winningTotem[_elevation][round - 9],
            winningTotem[_elevation][round - 10]
        ];
    }
}