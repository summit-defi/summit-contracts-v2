// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "./ElevationHelper.sol";
import "./SummitToken.sol";
import "./EverestToken.sol";
import "./ISubCart.sol";
import "./libs/ILiquidityPair.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "hardhat/console.sol";

/*
---------------------------------------------------------------------------------------------
--   S U M M I T . D E F I
---------------------------------------------------------------------------------------------


Summit is highly experimental.
It has been crafted to bring a new flavor to the defi world.
We hope you enjoy the Summit.defi experience.
If you find any bugs in these contracts, please claim the bounty on immunefi.com


Created with love by Architect and the Summit team





---------------------------------------------------------------------------------------------
--   E X P E D I T I O N   E X P L A N A T I O N
---------------------------------------------------------------------------------------------


Expeditions offer a reward for holders of Summit.
Stake SUMMIT or SUMMIT LP (see MULTI-STAKING) in an expedition for a chance to win stablecoins and other high value tokens.
Expedition pots build during the week from passthrough staking rewards and deposit fees

Deposits open 24 hours before a round closes, at which point deposits are locked, and the winner chosen
After each round, the next round begins immediately (if the expedition hasn't ended)

Expeditions take place on the weekends, and each have 3 rounds (FRI / SAT / SUN)
Two DEITIES decide the fate of each round:


DEITIES (COSMIC BULL vs COSMIC BEAR):
    . Each round has a different chance of succeeding, between 50 - 90%
    . If the expedition succeeds, COSMIC BULL earns the pot, else COSMIC BEAR steals it
    
    . COSMIC BULL is a safer deity, always has a higher chance of winning
    . Users are more likely to stake with the safer deity so it's pot will be higher, thus the winnings per SUMMIT staked lower

    . COSMIC BEAR is riskier, with a smaller chance of winning, potentially as low as 10%
    . Users are less likely to steak with BULL as it may be outside their risk tolerance to shoot for a small % chance of win

    . Thus BEAR will usually have less staked, making it both riskier, and more rewarding on win

    . The SUMMIT team expect that because switching between DEITIES is both free and unlimited,
        users will collectively 'arbitrage' the two deities based on the chance of success.

    . For example, if a round's chance of success is 75%, we expect 75% of the staked funds in the pool to be with BULL (safer)
        though this is by no means guaranteed


MULTI-STAKING
    . Users can stake both their SUMMIT token and SUMMIT LP token in an expedition
    . This prevents users from needing to break and re-make their LP for every expedition
    . SUMMIT and SUMMIT LP can be staked simultaneously
    . Both SUMMIT and SUMMIT LP can be elevated into and out of the Expedition
    . The equivalent amount of SUMMIT within the staked SUMMIT LP is treated as the SUMMIT token, and can earn winnings
    . The equivalent amount of SUMMIT in staked SUMMIT LP is determined from the SUMMIT LP pair directly
    . We have also added summitLpEverestIncentiveMult (between 1X - 2X) which can increase the equivalent amount of SUMMIT in SUMMIT LP (updated on a 72 hour timelock)
    . summitLpEverestIncentiveMult will be updated to ensure users are willing to stake their SUMMIT LP rather than break it (this may never be necessary and will be actively monitored)

WINNINGS:
    . The round reward is split amongst all members of the winning DEITY, based on their percentage of the total amount staked in that deity
    . Calculations section omitted because it is simply division
    . Users may exit the pool at any time without fee
    . Users are not forced to collect their winnings between rounds, and are entered into the next round automatically (same deity) if they do not exit


*/



contract ExpeditionV2 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;


    // ---------------------------------------
    // --   V A R I A B L E S
    // ---------------------------------------


    address constant burnAdd = 0x000000000000000000000000000000000000dEaD;

    SummitToken public summit;
    ILiquidityPair public summitLp;
    ElevationHelper elevationHelper;
    EverestToken public everest;
    uint8 constant EXPEDITION = 4;

    uint256 rolledOverRounds;


    uint256 public summitLpEverestIncentiveMult = 200;      // If SUMMIT LP in Expedition isn't incentivised enough for users to stake LP instead of breaking before depositing SUMMIT token itself, this can be updated
    // TODO: add setter for this
    uint256 public minLockTime = 3600 * 24;
    uint256 public maxLockTime = 3600 * 24 * 365;
    uint256 public minEverestLockMult = 1000;
    // TODO: add setter for this
    uint256 public maxEverestLockMult = 10000;
    // TODO: Add setter
    uint256 public expeditionRiskedEverestWinningsMult = 120;
    // TODO: Add setter
    mapping(address => uint256) public totalDistributed;

    struct UserEverestInfo {
        address userAdd;

        uint256 everestOwned;
        uint256 everestLockMultiplier;
        uint256 lockRelease;
        uint256 summitLocked;
        uint256 summitLpLocked;

        uint8 deity;
        bool deitySelected;
        uint8 safetyFactor;
        bool safetyFactorSelected;
    }

    
    struct UserExpeditionInfo {
        bool entered;
        uint256 prevInteractedRound;

        uint256 safeSupply;
        uint256 deitiedSupply;

        uint256 safeEarningsDebt;
        uint256 deityWinningsDebt;
    }

    mapping(address => EnumerableSet.AddressSet) userInteractingExpeds;

    mapping(address => UserEverestInfo) public userEverestInfo;

    struct ExpeditionInfo {
        bool launched;                                      // If the start round of the pool has passed and it is open for betting
        bool live;                                          // If the pool is manually enabled / disabled
        bool active;                                        // Whether the pool should be rolled over at end of round
        IERC20 token;                                       // Address of Reward token to be distributed.
        uint256 roundEmission;                              // The amount of Reward token for each round
        uint256 totalRoundsCount;                           // Number of rounds of this expedition to run.
        uint256 totalRewardAmount;                          // Total amount of reward token to be distributed over 7 days.
        uint256 rewardsMarkedForDist;                       // Rewards marked to be distributed but not yet withdrawn by users.

        uint256 startRound;                                 // The first round of the pool

        uint256 safeSupply;
        uint256 deitiedSupply;
        uint256[2] deitySupply;                       // Running total of combined equivalent SUMMIT in each deity to calculate rewards

        uint256 safeEarningsMult;                         // Guaranteed earnings that are earned each round (safetyFactor everest) 
        uint256[2] deityWinningsMult;                // Running winnings per share for each deity, increased at round end with snapshot of SUMMIT LP incentive multiplier and SUMMIT token to SUMMIT LP ratio
    }


    address[] public expeditionTokens;                                         // List of all expeditions for indexing
    mapping(address => bool) public expeditionExistence;                           // If an expedition exists for a reward token
    mapping(address => ExpeditionInfo) public expeditionInfo;        // Expedition info
    mapping(address => mapping(address => UserExpeditionInfo)) public userExpeditionInfo;        // Users running staked information

    // An expedition becomes active as soon as it becomes live (whether it is launched or not)
    // However when an expedition is turned off, it will only be marked as inactive at the end of the current round so that it is still included in end of round rollover
    uint256 public activeExpedsCount;    // Number Expeds active at an elevation (only concerned about expedition.live, not launched)
    EnumerableSet.AddressSet private activeExpeds;






    // ---------------------------------------
    // --   E V E N T S
    // ---------------------------------------

    event SummitLocked(address indexed user, uint256 _summitLocked, uint256 _lpLocked, uint256 _lockPeriod, uint256 _everestAwarded);
    event LockedSummitIncreased(address indexed user, uint256 _summitLocked, uint256 _lpLocked, uint256 _everestAwarded);
    event LockedSummitRemoved(address indexed user, uint256 _summitRemoved, uint256 _lpRemoved, uint256 _everestBurned);

    event UserJoinedExpedition(address indexed user, address indexed exped, uint8 _deity, uint8 _safetyFactor, uint256 _everestOwned);
    event UserHarvestedExpedition(address indexed user, address indexed exped, uint256 _rewardsHarvested, bool _exitedDuringHarvest);

    event ExpeditionCreated(address indexed token, uint256 _rewardAmount, uint256 _rounds);
    event ExpeditionExtended(address indexed token, uint256 _rewardAmount, uint256 _rounds);
    event ExpeditionRestarted(address indexed token, uint256 _rewardAmount, uint256 _rounds);
    event SetSummitLpEverestIncentiveMult(address indexed user, uint256 indexed newIncentiveMultiplier);
    





    // ---------------------------------------
    // --  A D M I N I S T R A T I O N
    // ---------------------------------------


    /// @dev Constructor, setting address of cartographer
    constructor(address _summit, address _summitLp, address _everest, address _elevationHelper) {
        require(_summit != address(0), "Summit required");
        require(_summitLp != address(0), "Summit Lp required");
        require(_everest != address(0), "Everest required");
        require(_elevationHelper != address(0), "Elevation Helper Required");
        summit = SummitToken(_summit);
        summitLp = ILiquidityPair(_summitLp);
        everest = EverestToken(_everest);
        elevationHelper = ElevationHelper(_elevationHelper);
        everest.approve(burnAdd, type(uint256).max);

        rolledOverRounds = elevationHelper.roundNumber(EXPEDITION);
    }

    /// @dev Updating the SUMMIT LP in expedition incentive multiplier
    ///      WILL BE GIVEN A 72 HOUR SPECIFIC DELAY IN TIMELOCK (OWNER OF CARTOGRAPHER)
    /// @param _newIncentive New incentivization multiplier
    function setSummitLpEverestIncentiveMult(uint256 _newIncentive) public onlyOwner {
        require(_newIncentive >= 100 && _newIncentive <= 400, "Incentive multiplier must be between 1x and 4x");
        summitLpEverestIncentiveMult = _newIncentive;
        emit SetSummitLpEverestIncentiveMult(msg.sender, _newIncentive);
    }






    // ------------------------------------------------------
    // --   M O D I F I E R S 
    // ------------------------------------------------------

    modifier validLockPeriod(uint256 _lockPeriod) {
        require (_lockPeriod >= minLockTime && _lockPeriod <= maxLockTime, "Invalid lock period");
        _;
    }
    modifier userNotAlreadyLockingSummit() {
        require (userEverestInfo[msg.sender].everestOwned == 0, "Already locking summit");
        _;
    }
    modifier userLockPeriodSatisfied() {
        require(userEverestInfo[msg.sender].lockRelease != 0, "User doesnt have a lock release");
        require(block.timestamp >= userEverestInfo[msg.sender].lockRelease, "Lock period still in effect");
        _;
    }
    modifier userEverestInfoExists() {
        require(userEverestInfo[msg.sender].userAdd != address(0), "User doesnt exist");
        _;
    }
    modifier userOwnsEverest() {
        require (userEverestInfo[msg.sender].everestOwned > 0, "Must own everest");
        _;
    }
    modifier validEverestAmountToBurn(uint256 _everestAmount) {
        console.log("Valid Everest Amount", _everestAmount, _everestAmount > 0, _everestAmount <= userEverestInfo[msg.sender].everestOwned);
        require (_everestAmount > 0 && _everestAmount <= userEverestInfo[msg.sender].everestOwned, "Bad withdraw");
        _;
    }
    modifier validSafetyFactor(uint8 _safetyFactor) {
        require(_safetyFactor >= 0 && _safetyFactor <= 100, "Invalid safety factor");
        _;
    }
    function _validUserAdd(address _userAdd) internal pure {
        require(_userAdd != address(0), "User address is zero");
    }
    modifier validUserAdd(address _userAdd) {
        _validUserAdd(_userAdd);
        _;
    }
    modifier nonDuplicated(address _token) {
        require(!expeditionExistence[_token], "Duplicated");
        _;
    }
    function _expeditionExists(address _token) internal view {
        require(expeditionExistence[_token], "Pool doesnt exist");
    }
    modifier expeditionExists(address _token) {
        _expeditionExists(_token);
        _;
    }
    modifier expeditionExistsAndActive(address _token) {
        console.log("Expedition Exists", _token, expeditionExistence[_token]);
        require(expeditionExistence[_token], "Expedition doesnt exist");
        require(expeditionInfo[_token].launched, "Expedition not active");
        _;
    }
    modifier validDeity(uint8 deity) {
        require(deity < 2, "Invalid deity");
        _;
    }
    modifier expeditionInteractionsAvailable() {
        require(!elevationHelper.endOfRoundLockoutActive(EXPEDITION), "Elev locked until rollover");
        _;
    }
    modifier userIsEligibleToJoinExpedition() {
        require(userEverestInfo[msg.sender].deitySelected, "No deity selected");
        require(userEverestInfo[msg.sender].safetyFactorSelected, "No safety factor selected");
        _;
    }
    modifier elevationHelperRoundRolledOver() {
        require(elevationHelper.roundNumber(EXPEDITION) > rolledOverRounds, "Elev helper must be rolled over first");
        _;
    }
    




    // ---------------------------------------
    // --   U T I L S (inlined for brevity)
    // ---------------------------------------
    

    function expeditionsCount()
        public view
        returns (uint256)
    {
        return expeditionTokens.length;
    }
    function supply(address _token)
        public view
        expeditionExists(_token)
        returns (uint256, uint256, uint256, uint256)
    {
        return (
            expeditionInfo[_token].safeSupply,
            expeditionInfo[_token].deitiedSupply,
            expeditionInfo[_token].deitySupply[0],
            expeditionInfo[_token].deitySupply[1]
        );
    }
    function selectedDeity(address _userAdd)
        public view
        returns (uint8)
    {
        return userEverestInfo[_userAdd].deity;
    }

    /// @dev Divider is random number 50 - 90 that sets the random chance of each of the deities winning the round
    function currentDeityDivider()
        public view
        returns (uint256)
    {
        return elevationHelper.currentDeityDivider();
    }


    /// @dev The amount of reward token that exists to be rewarded by an expedition
    /// @param _token Expedition reward token
    function remainingRewards(address _token)
        public view
        expeditionExists(_token)
        returns (uint256)
    {
        ExpeditionInfo storage pool = expeditionInfo[_token];

        // Exit early if pool not launched yet
        if (!pool.launched) return pool.totalRewardAmount;

        // Total expedition runtime so far
        uint256 currRound = elevationHelper.roundNumber(EXPEDITION);
        uint256 roundsCompleted = currRound - pool.startRound;

        // Return total emissions allocated to users so far
        return pool.totalRewardAmount - (roundsCompleted * pool.roundEmission);
    }





    // ---------------------------------------
    // --   P O O L   M A N A G E M E N T
    // ---------------------------------------


    /// @dev Registers pool everywhere needed
    /// @param _token Token to register with
    function _registerExpedition(address _token)
        internal
    {
        expeditionExistence[_token] = true;
        expeditionTokens.push(_token);
    }

    function _markExpeditionActive(ExpeditionInfo storage pool, bool _active)
        internal
    {
        if (pool.active == _active) return;

        require(!_active || activeExpeds.length() < 24, "Too many active expeditions");

        pool.active = _active;
        if (_active) {
            activeExpeds.add(address(pool.token));
        } else {
            activeExpeds.remove(address(pool.token));
        }
    }

    function getActiveExpeditions()
        public view
        returns (address[24] memory)
    {
        address[24] memory expeds;
        for (uint16 index = 0; index < activeExpeds.length(); index++) {
            expeds[index] = activeExpeds.at(index);
        }
        return expeds;
    }

    /// @dev Creates a expedition
    /// @param _token Token yielded by expedition
    /// @param _live Whether the pool is enabled initially
    /// @param _rewardAmount Total reward token to be distributed over duration of pool, divided evenly between each round
    /// @param _rounds Number of rounds for this expedition to run
    function addExpedition(address _token, bool _live, uint256 _rewardAmount, uint256 _rounds)
        public
        onlyOwner nonDuplicated(_token)
    {
        // Ensure that this contract has enough reward token to cover the entire duration of the expedition
        require(IERC20(_token).balanceOf(address(this)) >= _rewardAmount, "Must have funds to cover expedition");

        _registerExpedition(_token);

        // Create the initial state of the expedition
        expeditionInfo[_token] = ExpeditionInfo({
            launched: false,
            live: _live,
            active: false, // Will be made active in add active expedition below if _live is true
            token: IERC20(_token),
            totalRoundsCount: _rounds,
            totalRewardAmount: _rewardAmount,
            roundEmission: _rewardAmount / _rounds,
            rewardsMarkedForDist: 0,
            startRound: elevationHelper.nextRound(EXPEDITION),

            safeSupply: 0,
            deitiedSupply: 0,
            deitySupply: [uint256(0), 0],

            safeEarningsMult: 0,
            deityWinningsMult: [uint256(0), 0]
        });

        if (_live) _markExpeditionActive(expeditionInfo[_token], true);

        emit ExpeditionCreated(_token, _rewardAmount, _rounds);
    }

    /// @dev Turn off an expedition
    function disableExpedition(address _token)
        public
        onlyOwner expeditionExistsAndActive(_token)
    {
        ExpeditionInfo storage pool = expeditionInfo[_token];
        require(pool.live, "Pool already disabled");
        pool.live = false;
        // Removing this pool from the active list will happen at the round rollover, this ensures it is still rolled over
    }

    /// @dev Turn on a turned off expedition
    function enableExpedition(address _token)
        public
        onlyOwner expeditionExistsAndActive(_token)
    {
        ExpeditionInfo storage pool = expeditionInfo[_token];
        require(!pool.live, "Expedition already enabled");
        pool.live = true;
        _markExpeditionActive(pool, true); // Will be early exited if pool.active is already true, meaning this exped was disabled this round
    }


    /// @dev Extend a currently running expedition pool
    /// @param _token Expedition reward token
    /// @param _additionalRewardAmount Additional reward token to distribute over extended rounds
    /// @param _additionalRounds Number of rounds to add to the expedition
    function extendExpedition(address _token, uint256 _additionalRewardAmount, uint256 _additionalRounds)
        public
        onlyOwner expeditionExistsAndActive(_token)
    {
        ExpeditionInfo storage pool = expeditionInfo[_token];
        require(pool.live, "Expedition disabled");

        // Number of rounds of current expedition already completed
        uint256 currRound = elevationHelper.roundNumber(EXPEDITION);
        uint256 roundsCompleted = currRound - pool.startRound;

        // Calculate the amount of rewards remaining to be distributed over the remaining expedition rounds
        uint256 rewardsRemaining = pool.totalRewardAmount - (roundsCompleted * pool.roundEmission);

        // The total rewards after adding new additional rewards
        uint256 rewardsRemainingWithAdditional = rewardsRemaining + _additionalRewardAmount;

        // Ensure that the cartographerExpedition contract has enough reward token to cover what remains to be distributed, as well as full reward amount of next expedition
        uint256 unmarkedRewards = pool.token.balanceOf(address(this)) - pool.rewardsMarkedForDist;
        require(unmarkedRewards > rewardsRemainingWithAdditional, "Must have funds to cover expedition");
        
        // Total rounds remaining with the extra rounds added
        console.log("Rounds Remaining", pool.totalRoundsCount, _additionalRounds, roundsCompleted);
        uint256 roundsRemaining = pool.totalRoundsCount + _additionalRounds - roundsCompleted;

        // Calculate the new reward emission per block
        uint256 newRoundEmission = rewardsRemainingWithAdditional / roundsRemaining;

        // Update expedition state variables
        pool.totalRewardAmount += _additionalRewardAmount;
        pool.totalRoundsCount += _additionalRounds;
        pool.roundEmission = newRoundEmission;

        emit ExpeditionExtended(address(pool.token), pool.totalRewardAmount, pool.totalRoundsCount);
    }


    /// @dev Restart an expedition that has finished. Essentially creating a new elevation from scratch with a already used token
    /// @param _token Expedition to restart
    /// @param _rewardAmount Amount of reward token to distribute over full duration of all rounds
    /// @param _rounds Rounds to add to the expedition
    function restartExpedition(address _token, uint256 _rewardAmount, uint256 _rounds)
        public
        onlyOwner expeditionExists(_token)
    {
        ExpeditionInfo storage pool = expeditionInfo[_token];
        require(!pool.launched, "Expedition already running");

        // Ensure that the cartographerExpedition contract has enough reward token to cover what remains to be distributed, as well as full reward amount of next expedition
        uint256 unmarkedRewards = pool.token.balanceOf(address(this)) - pool.rewardsMarkedForDist;
        require(unmarkedRewards >= _rewardAmount, "Must have funds to cover expedition");

        // Set state variables of restarted expedition
        pool.launched = false;
        pool.live = true;
        pool.active = false;
        pool.totalRoundsCount = _rounds;
        pool.totalRewardAmount = _rewardAmount;
        pool.roundEmission = _rewardAmount / _rounds;
        pool.startRound = elevationHelper.nextRound(EXPEDITION);

        _markExpeditionActive(pool, true);

        emit ExpeditionRestarted(address(pool.token), pool.totalRewardAmount, pool.totalRoundsCount);
    }



    // ---------------------------------------
    // --   P O O L   R E W A R D S
    // ---------------------------------------
    
    function rewards(address _token, address _userAdd)
        public view
        expeditionExists(_token) validUserAdd(_userAdd)
        returns (uint256)
    {
        // Calculate and return the harvestable winnings for this expedition
        return _harvestableWinnings(expeditionInfo[_token], userEverestInfo[_userAdd], userExpeditionInfo[_token][_userAdd]);
    }


    /// @dev User's staked amount, and how much they will win with that stake amount
    /// @param _token Expedition to check
    /// @param _userAdd User to check
    /// @return (
    ///     guaranteedYield - Users amount they are guaranteed to earn based on their safetyFactor
    ///     riskedYield - Amount in reward token the user has put up for risk
    /// )
    function hypotheticalRewards(address _token, address _userAdd)
        public view
        expeditionExists(_token) validUserAdd(_userAdd)
        returns (uint256, uint256)
    {
        ExpeditionInfo storage exped = expeditionInfo[_token];
        UserEverestInfo storage everestInfo = userEverestInfo[_userAdd];


        if (!exped.active) return (0, 0);

        uint256 userSafeEverest = _getUserSafeEverest(everestInfo, everestInfo.safetyFactor);
        uint256 userDeitiedEverest = _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor);

        // Total Supply of the expedition
        uint256 totalExpedSupply = exped.deitiedSupply + exped.safeSupply;

        // Calculate safe winnings multiplier or escape if div/0
        uint256 expectedSafeEmission = totalExpedSupply == 0 ? 0 : (exped.roundEmission * 1e18 * exped.safeSupply) / totalExpedSupply;

        // Calculate winning deity's winnings multiplier or escape if div/0
        uint256 expectedDeitiedEmission = totalExpedSupply == 0 ? 0 : (exped.roundEmission * 1e18 * exped.deitiedSupply) / totalExpedSupply;

        return(
            ((expectedSafeEmission * userSafeEverest) / exped.safeSupply) / 1e18,
            ((expectedDeitiedEmission * userDeitiedEverest) / exped.deitySupply[everestInfo.deity]) / 1e18
        );
    }




    // ------------------------------------------------------------------
    // --   R O L L O V E R   E L E V A T I O N   R O U N D
    // ------------------------------------------------------------------
    
    
    /// @dev Rolling over all expeditions
    ///      Expeditions set to open (expedition.startRound == nextRound) are enabled
    ///      Expeditions set to end are disabled
    function rollover()
        public
        elevationHelperRoundRolledOver()
    {
        uint256 currRound = elevationHelper.roundNumber(EXPEDITION);

        // Update and rollover all active pools
        for (uint16 index = 0; index < activeExpeds.length(); index++) {
            _rolloverExpedition(activeExpeds.at(index), currRound);
        }

        rolledOverRounds = currRound;
    }


    /// @dev Roll over a single expedition
    /// @param _token Expedition to roll over
    /// @param _currRound Current round
    function _rolloverExpedition(address _token, uint256 _currRound)
        internal
    {
        ExpeditionInfo storage exped = expeditionInfo[_token];

        if (!exped.live || (_currRound >= (exped.startRound + exped.totalRoundsCount))) {
            console.log("Unlaunch Expedition", _token, _currRound);
            exped.launched = false;
            _markExpeditionActive(exped, false);
        }
        
        else if (_currRound >= exped.startRound && !exped.launched) {
            console.log("Launch Expedition", _token, _currRound);
            exped.launched = true;
            return;
        }

        uint8 winningDeity = elevationHelper.winningTotem(EXPEDITION, _currRound - 1);

        // Total Supply of the expedition
        uint256 totalExpedSupply = exped.deitiedSupply + exped.safeSupply;

        // Calculate safe winnings multiplier or escape if div/0
        uint256 safeEmission = totalExpedSupply == 0 ? 0 : (exped.roundEmission * 1e18 * exped.safeSupply) / totalExpedSupply;

        // Calculate winning deity's winnings multiplier or escape if div/0
        uint256 deitiedEmission = totalExpedSupply == 0 ? 0 : (exped.roundEmission * 1e18 * exped.deitiedSupply) / totalExpedSupply;

        // Mark current round's emission to be distributed
        exped.rewardsMarkedForDist += (safeEmission + deitiedEmission) / 1e18;
        totalDistributed[address(exped.token)] += (safeEmission + deitiedEmission) / 1e18;

        // Update winning deity's running winnings mult
        exped.safeEarningsMult += safeEmission == 0 ? 0 : (safeEmission / exped.safeSupply);
        exped.deityWinningsMult[winningDeity] += (deitiedEmission == 0 || exped.deitySupply[winningDeity] == 0) ? 0 : deitiedEmission / exped.deitySupply[winningDeity];
    }
    


    

    // ------------------------------------------------------------
    // --   W I N N I N G S   C A L C U L A T I O N S 
    // ------------------------------------------------------------


    /// @dev User's 'safe' everest that is guaranteed to earn
    function _getUserSafeEverest(UserEverestInfo storage everestInfo, uint8 _safetyFactor)
        internal view
        returns (uint256)
    {
        return everestInfo.everestOwned * _safetyFactor / 100;
    }
    /// @dev User's total everest in the pot
    function _getUserDeitiedEverest(UserEverestInfo storage everestInfo, uint8 _safetyFactor)
        internal view
        returns (uint256)
    {
        return everestInfo.everestOwned * ((100 - _safetyFactor) / 100) * (expeditionRiskedEverestWinningsMult / 100);
    }

    /// @dev Calculation of winnings that are available to be harvested
    /// @param pool Pool info
    /// @param everestInfo everestInfo
    /// @param userExpedInfo UserExpedInfo
    /// @return Total winnings for a user, including vesting on previous round's winnings (if any)
    function _harvestableWinnings(ExpeditionInfo storage pool, UserEverestInfo storage everestInfo, UserExpeditionInfo storage userExpedInfo)
        internal view
        returns (uint256)
    {
        uint256 currRound = elevationHelper.roundNumber(EXPEDITION);

        // Escape early if no previous round exists with available winnings
        if (currRound <= pool.startRound) return 0;

        // If user interacted in current round, no winnings available
        if (userExpedInfo.prevInteractedRound == currRound) return 0;

        uint256 safeEverest = _getUserSafeEverest(everestInfo, everestInfo.safetyFactor);
        uint256 deitiedEverest = _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor);

        return (
            ((safeEverest * (pool.safeEarningsMult - userExpedInfo.safeEarningsDebt)) / 1e18) +
            ((deitiedEverest * (pool.deityWinningsMult[everestInfo.deity] - userExpedInfo.deityWinningsDebt)) / 1e18)
        );
    }
    


    

    // ------------------------------------------------------------
    // --   U S E R   I N T E R A C T I O N S
    // ------------------------------------------------------------


    /// @dev Update the users round interaction
    /// @param exped Pool info with winnings mult
    /// @param everestInfo User's everest info
    /// @param userExpedInfo User's expedition info
    function _updateUserRoundInteraction(ExpeditionInfo storage exped, UserEverestInfo storage everestInfo, UserExpeditionInfo storage userExpedInfo)
        internal
    {
        uint256 currRound = elevationHelper.roundNumber(EXPEDITION);

        userExpedInfo.safeSupply = _getUserSafeEverest(everestInfo, everestInfo.safetyFactor);
        userExpedInfo.deitiedSupply = _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor);

        // Acc winnings per share of user's deity of both SUMMIT token and SUMMIT LP
        userExpedInfo.safeEarningsDebt = exped.safeEarningsMult;
        userExpedInfo.deityWinningsDebt = exped.deityWinningsMult[everestInfo.deity];

        // Update the user's previous interacted round to be this round
        userExpedInfo.prevInteractedRound = currRound;
    }

    
    /// @dev Increments or decrements user's pools at elevation staked, and adds to  / removes from users list of staked pools
    function _markUserInteractingWithExped(ExpeditionInfo storage exped, UserEverestInfo storage everestInfo, bool _interacting)
        internal
    {
        require(!_interacting || userInteractingExpeds[everestInfo.userAdd].length() < 12, "Staked exped cap (12) reached");

        if (_interacting) {
            userInteractingExpeds[everestInfo.userAdd].add(address(exped.token));
        } else {
            userInteractingExpeds[everestInfo.userAdd].remove(address(exped.token));
        }
    }



    // ------------------------------------------------------------
    // --   E V E R E S T
    // ------------------------------------------------------------
    

    /// @dev Equivalent amount of SUMMIT in an amount of SUMMIT LP
    ///      This amount is pulled directly from the SUMMIT LP token's internal data
    ///      As well as the incentiveMultiplier if required
    function _equivalentSUMMITInLp(uint256 _amount)
        internal view
        returns (uint256)
    {
        if (summitLp.totalSupply() == 0) return 0;
        (uint256 reserve0, uint256 reserve1,) = summitLp.getReserves();
        uint256 summitReserve = summitLp.token0() == address(summit) ? reserve0 : reserve1;
        return ((_amount * summitReserve * summitLpEverestIncentiveMult) / 100) / summitLp.totalSupply();
    }


    /// @dev Combined equivalent SUMMIT from a SUMMIT LP and SUMMIT token source
    function _combinedEquivalentSUMMIT(uint256 _summitAmount, uint256 _lpAmount)
        internal view
        returns (uint256)
    {
        return _summitAmount + _equivalentSUMMITInLp(_lpAmount);
    }

    /// @dev Lock period multiplier
    function _lockPeriodMultiplier(uint256 _lockPeriod)
        internal view
        returns (uint256)
    {
        return ((((_lockPeriod - minLockTime) * 1e12) / (maxLockTime - minLockTime)) * (maxEverestLockMult - minEverestLockMult) / 1e12) + minEverestLockMult;
    }

    /// @dev Calculate lock awarded Everest
    function calcBaseEverestAward(uint256 _summitAmount, uint256 _lpAmount)
        internal view
        returns (uint256)
    {
        // 1e23 scaling factor creates a base 1 million EVEREST
        return _combinedEquivalentSUMMIT(_summitAmount, _lpAmount) * 1e23 / summit.totalSupply();
    }

    function _burnEverest(address _userAdd, uint256 _everestAmount)
        internal
    {
        IERC20(everest).safeTransferFrom(_userAdd, address(this), _everestAmount);
        IERC20(everest).safeTransfer(burnAdd, _everestAmount);
    }

    function _getOrCreateUserEverestInfo(address _userAdd)
        internal
        returns (UserEverestInfo storage)
    {
        UserEverestInfo storage everestInfo = userEverestInfo[_userAdd];
        everestInfo.userAdd = _userAdd;
        return everestInfo;
    }

    /// @dev Lock Summit or SummitLP and earn everest
    function lockSummit(uint256 _summitAmount, uint256 _lpAmount, uint256 _lockPeriod)
        public
        nonReentrant userNotAlreadyLockingSummit validLockPeriod(_lockPeriod)
    {
        require(_summitAmount <= IERC20(summit).balanceOf(msg.sender) && _lpAmount <= IERC20(summitLp).balanceOf(msg.sender), "Exceeds balance");

        uint256 everestLockMultiplier = _lockPeriodMultiplier(_lockPeriod);
        uint256 baseEverestAward = calcBaseEverestAward(_summitAmount, _lpAmount);
        uint256 initialEverestAward = (baseEverestAward * everestLockMultiplier) / 1000;
        uint256 lockRelease = block.timestamp + _lockPeriod;

        if (_summitAmount > 0) {
            IERC20(summit).safeTransferFrom(msg.sender, address(this), _summitAmount);
        }
        if (_lpAmount > 0) {
            IERC20(summitLp).safeTransferFrom(msg.sender, address(this), _lpAmount);        
        }
        everest.mintTo(msg.sender, initialEverestAward);

        UserEverestInfo storage everestInfo = _getOrCreateUserEverestInfo(msg.sender);

        everestInfo.everestOwned = initialEverestAward;
        everestInfo.everestLockMultiplier = everestLockMultiplier;
        everestInfo.lockRelease = lockRelease;
        everestInfo.summitLocked = _summitAmount;
        everestInfo.summitLpLocked = _lpAmount;

        _updateInteractingExpeditions(everestInfo);

        emit SummitLocked(msg.sender, _summitAmount, _lpAmount, _lockPeriod, initialEverestAward);
    }

    /// @dev Increase the Locked Summit or SummitLP and earn everest
    function increaseLockedSummit(uint256 _summitAmount, uint256 _lpAmount)
        public
        nonReentrant userEverestInfoExists userOwnsEverest
    {
        require(_summitAmount <= IERC20(summit).balanceOf(msg.sender) && _lpAmount <= IERC20(summitLp).balanceOf(msg.sender), "Exceeds balance");

        UserEverestInfo storage everestInfo = userEverestInfo[msg.sender];

        uint256 baseEverestAward = calcBaseEverestAward(_summitAmount, _lpAmount);
        uint256 additionalEverestAward = (baseEverestAward * everestInfo.everestLockMultiplier) / 1000;

        if (_summitAmount > 0) {
            IERC20(summit).safeTransferFrom(msg.sender, address(this), _summitAmount);
        }
        if (_lpAmount > 0) {
            IERC20(summitLp).safeTransferFrom(msg.sender, address(this), _lpAmount);        
        }
        everest.mintTo(msg.sender, additionalEverestAward);

        everestInfo.everestOwned += additionalEverestAward;
        everestInfo.summitLocked += _summitAmount;
        everestInfo.summitLpLocked += _lpAmount;

        _updateInteractingExpeditions(everestInfo);

        emit LockedSummitIncreased(msg.sender, _summitAmount, _lpAmount, additionalEverestAward);
    }

    /// @dev Decrease the Summit or SummitLP and burn everest
    function decreaseLockedSummit(uint256 _everestAmount)
        public
        nonReentrant userEverestInfoExists userOwnsEverest userLockPeriodSatisfied validEverestAmountToBurn(_everestAmount)
    {
        UserEverestInfo storage everestInfo = userEverestInfo[msg.sender];

        uint256 percWithdrawing = (_everestAmount * 1e12) / everestInfo.everestOwned;
        uint256 summitToWithdraw = (everestInfo.summitLocked * percWithdrawing) / 1e12;
        uint256 summitLpToWithdraw = (everestInfo.summitLpLocked * percWithdrawing) / 1e12;

        everestInfo.everestOwned -= _everestAmount;
        everestInfo.summitLocked -= summitToWithdraw;
        everestInfo.summitLpLocked -= summitLpToWithdraw;

        IERC20(summit).safeTransfer(msg.sender, summitToWithdraw);
        IERC20(summitLp).safeTransfer(msg.sender, summitLpToWithdraw);        
        _burnEverest(msg.sender, _everestAmount);

        _updateInteractingExpeditions(everestInfo);

        emit LockedSummitRemoved(msg.sender, summitToWithdraw, summitLpToWithdraw, _everestAmount);
    }



    // ------------------------------------------------------------
    // --   E X P E D   H E L P E R S
    // ------------------------------------------------------------

    function _harvestExpedition(ExpeditionInfo storage exped, UserEverestInfo storage everestInfo, UserExpeditionInfo storage userExpedInfo)
        internal
        returns (uint256)
    {
        // Get calculated harvestable winnings
        uint256 winnings = _harvestableWinnings(exped, everestInfo, userExpedInfo);

        // Early escape if no winnings available to harvest;
        if (winnings == 0) return 0;
    
        // Transfer winnings to user
        exped.token.safeTransfer(everestInfo.userAdd, winnings);

        // Mark harvested winnings as withdrawn
        exped.rewardsMarkedForDist -= winnings;

        return winnings;
    }
    
    function _exitExpeditionIfNecessary(ExpeditionInfo storage exped, UserEverestInfo storage everestInfo, UserExpeditionInfo storage userExpedInfo)
        internal
        returns (bool)
    {
        if (!exped.active || everestInfo.everestOwned == 0) {
            _exitExpedition(exped, everestInfo, userExpedInfo);
        }

        return !exped.active || everestInfo.everestOwned == 0;
    }

    function _exitExpedition(ExpeditionInfo storage exped, UserEverestInfo storage everestInfo, UserExpeditionInfo storage userExpedInfo)
        internal
    {
        userExpedInfo.entered = false;
        _markUserInteractingWithExped(exped, everestInfo, false);
    }



    // ----------------------------------------------------------------------
    // --  E X P E D   D I R E C T   I N T E R A C T I O N S
    // ----------------------------------------------------------------------


    /// @dev All expeditions share a deity. This function allows switching staked funds from one deity to another
    /// @param _deity New target deity
    function selectDeity(uint8 _deity)
        public
        nonReentrant validDeity(_deity) expeditionInteractionsAvailable
    {
        UserEverestInfo storage everestInfo = _getOrCreateUserEverestInfo(msg.sender);

        // Early exit if deity is same as current
        require(!everestInfo.deitySelected || everestInfo.deity != _deity, "Deity must be different");

        // Iterate through expeditions and switch deity for each user staked with
        for (uint16 index = 0; index < userInteractingExpeds[everestInfo.userAdd].length(); index++) {
            _selectDeityForExpedition(
                userInteractingExpeds[everestInfo.userAdd].at(index),
                everestInfo,
                _deity
            );
        }

        // Update user deity in state
        everestInfo.deity = _deity;
        everestInfo.deitySelected = true;
    }


    /// @dev Change the safety factor of a user
    function selectSafetyFactor(uint8 _safetyFactor)
        public
        nonReentrant validSafetyFactor(_safetyFactor) expeditionInteractionsAvailable
    {
        UserEverestInfo storage everestInfo = _getOrCreateUserEverestInfo(msg.sender);

        // Early exit if safety factor is the same
        require(!everestInfo.safetyFactorSelected || everestInfo.safetyFactor != _safetyFactor, "SafetyFactor must be different");

        // Iterate through expeditions and update safety factor for each user staked with
        for (uint16 index = 0; index < userInteractingExpeds[everestInfo.userAdd].length(); index++) {
            _selectSafetyFactorForExpedition(
                userInteractingExpeds[everestInfo.userAdd].at(index),
                everestInfo,
                _safetyFactor
            );
        }

        // Update safety factor in state
        everestInfo.safetyFactor = _safetyFactor;
        everestInfo.safetyFactorSelected = true;
    }


    function userSatisfiesExpeditionRequirements()
        public view
        returns (bool, bool, bool)
    {
        return (
            userEverestInfo[msg.sender].everestOwned > 0,
            userEverestInfo[msg.sender].deitySelected,
            userEverestInfo[msg.sender].safetyFactorSelected
        );
    }    

    function joinExpedition(address _token)
        public
        userEverestInfoExists expeditionExistsAndActive(_token) userOwnsEverest userIsEligibleToJoinExpedition expeditionInteractionsAvailable
    {
        ExpeditionInfo storage exped = expeditionInfo[_token];
        UserEverestInfo storage everestInfo = userEverestInfo[msg.sender];
        UserExpeditionInfo storage userExpedInfo = userExpeditionInfo[_token][msg.sender];        

        // Mark user interacting with this expedition to the user's expeditions slot
        require(!userExpedInfo.entered, "Already entered");
        userExpedInfo.entered = true;
        _markUserInteractingWithExped(exped, everestInfo, true);

        // Add users everest to exped supplies at current risk rate
        exped.safeSupply += _getUserSafeEverest(everestInfo, everestInfo.safetyFactor);
        exped.deitiedSupply += _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor);
        exped.deitySupply[everestInfo.deity] += _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor);

        // Update the user's round interaction with updated info
        _updateUserRoundInteraction(exped, everestInfo, userExpedInfo);

        emit UserJoinedExpedition(msg.sender, _token, everestInfo.deity, everestInfo.safetyFactor, everestInfo.everestOwned);
    }

    function harvestExpedition(address _token)
        public
        userEverestInfoExists expeditionExists(_token) userOwnsEverest expeditionInteractionsAvailable
    {
        ExpeditionInfo storage exped = expeditionInfo[_token];
        UserEverestInfo storage everestInfo = userEverestInfo[msg.sender];
        UserExpeditionInfo storage userExpedInfo = userExpeditionInfo[_token][msg.sender];        

        uint256 rewardsHarvested = _harvestExpedition(exped, everestInfo, userExpedInfo);
        _updateUserRoundInteraction(exped, everestInfo, userExpedInfo);
        bool exitedOnHarvest = _exitExpeditionIfNecessary(exped, everestInfo, userExpedInfo);

        emit UserHarvestedExpedition(msg.sender, _token, rewardsHarvested, exitedOnHarvest);
    }



    // ----------------------------------------------------------------------
    // --   U S E R   I N T E R A C T I N G   E X P E D S   U P D A T E S
    // ----------------------------------------------------------------------


    


    /// @dev Switch users funds (if any staked) to the new deity
    /// @param _token Expedition identifier
    /// @param everestInfo User's everest info
    /// @param _newDeity Deity the user is leaving
    function _selectDeityForExpedition(address _token, UserEverestInfo storage everestInfo, uint8 _newDeity)
        internal
    {
        ExpeditionInfo storage exped = expeditionInfo[_token];
        UserExpeditionInfo storage userExpedInfo = userExpeditionInfo[_token][everestInfo.userAdd];

        // Harvest any winnings in this expedition
        _harvestExpedition(exped, everestInfo, userExpedInfo);
        
        // Update user's interaction in this expedition
        _updateUserRoundInteraction(exped, everestInfo, userExpedInfo);
        
        // Transfer deitied everest from previous deity to new deity
        exped.deitySupply[everestInfo.deity] -= _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor);
        exped.deitySupply[_newDeity] += _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor);
    }


    /// @dev Switch users funds (if any staked) to the new deity
    /// @param _token Expedition identifier
    /// @param everestInfo User's everest info
    /// @param _newSafetyFactor New safety factor of user
    function _selectSafetyFactorForExpedition(address _token, UserEverestInfo storage everestInfo, uint8 _newSafetyFactor)
        internal
    {
        ExpeditionInfo storage exped = expeditionInfo[_token];
        UserExpeditionInfo storage userExpedInfo = userExpeditionInfo[_token][everestInfo.userAdd];

        // Harvest any winnings in this expedition
        _harvestExpedition(exped, everestInfo, userExpedInfo);
        
        // Update user's interaction in this expedition
        _updateUserRoundInteraction(exped, everestInfo, userExpedInfo);

        // Override updated safe supply and deitied supply from updateUserRoundInteraction
        userExpedInfo.safeSupply = _getUserSafeEverest(everestInfo, _newSafetyFactor);
        userExpedInfo.deitiedSupply = _getUserDeitiedEverest(everestInfo, _newSafetyFactor);
        
        // Remove safe and deitied everest from existing supply states
        exped.safeSupply = exped.safeSupply - _getUserSafeEverest(everestInfo, everestInfo.safetyFactor) + _getUserSafeEverest(everestInfo, _newSafetyFactor);
        exped.deitiedSupply = exped.deitiedSupply - _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor) + _getUserDeitiedEverest(everestInfo, _newSafetyFactor);
        exped.deitySupply[everestInfo.deity] = exped.deitySupply[everestInfo.deity] - _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor) + _getUserDeitiedEverest(everestInfo, _newSafetyFactor);
    }
    

    function updateInteractingExpeditions()
        public
        userEverestInfoExists userOwnsEverest expeditionInteractionsAvailable
    {
        _updateInteractingExpeditions(userEverestInfo[msg.sender]);
    }

    function _updateInteractingExpeditions(UserEverestInfo storage everestInfo)
        internal
    {
        // Iterate through and update each with user everest info
        for (uint16 index = 0; index < userInteractingExpeds[everestInfo.userAdd].length(); index++) {
            _updateInteractingExpedition(
                userInteractingExpeds[everestInfo.userAdd].at(index),
                everestInfo
            );
        }
    }

    function _updateInteractingExpedition(address _token, UserEverestInfo storage everestInfo)
        internal
    {
        ExpeditionInfo storage exped = expeditionInfo[_token];
        UserExpeditionInfo storage userExpedInfo = userExpeditionInfo[_token][everestInfo.userAdd];        

        // Harvest winnings from expedition
        _harvestExpedition(exped, everestInfo, userExpedInfo);

        // Remove user's existing supplies from expedition, add new supplies
        exped.safeSupply = exped.safeSupply - userExpedInfo.safeSupply + _getUserSafeEverest(everestInfo, everestInfo.safetyFactor);
        exped.deitiedSupply = exped.deitiedSupply - userExpedInfo.deitiedSupply + _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor);
        exped.deitySupply[everestInfo.deity] = exped.deitySupply[everestInfo.deity] - userExpedInfo.deitiedSupply + _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor);

        _updateUserRoundInteraction(exped, everestInfo, userExpedInfo);
        _exitExpeditionIfNecessary(exped, everestInfo, userExpedInfo);
    }

}



// TODO: Retirement strategy

