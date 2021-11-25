// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "./ElevationHelper.sol";
import "./SummitToken.sol";
import "./EverestToken.sol";
import "./ISubCart.sol";
import "./SummitLocking.sol";
import "./libs/IUniswapV2Pair.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
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


    // ---------------------------------------
    // --   V A R I A B L E S
    // ---------------------------------------


    address constant burnAdd = 0x000000000000000000000000000000000000dEaD;

    SummitToken public summit;
    EverestToken public everest;
    ElevationHelper elevationHelper;
    SummitLocking public summitLocking;
    uint8 constant EXPEDITION = 4;

    bool panicReleaseLockedSummit = false;

    bool expeditionInitialized = false;
    uint256 rolledOverRounds;


    uint256 public minLockTime = 3600 * 24 * 3;
    uint256 public maxLockTime = 3600 * 24 * 365;
    uint256 public lockTimeRequiredForTaxlessSummitWithdraw = 3600 * 24 * 7;
    uint256 public lockTimeRequiredForClaimableSummitLock = 3600 * 24 * 30;
    uint256 public minEverestLockMult = 1000;
    uint256 public maxEverestLockMult = 10000;
    uint256 public expeditionDeityWinningsMult = 120;
    uint256 public expeditionRunwayRounds = 60;

    struct UserEverestInfo {
        address userAdd;

        uint256 everestOwned;
        uint256 everestLockMultiplier;
        uint256 lockRelease;
        uint256 summitLocked;

        uint8 deity;
        bool deitySelected;
        uint256 deitySelectionRound;
        uint8 safetyFactor;
        bool safetyFactorSelected;
    }

    
    struct UserExpeditionInfo {
        bool entered;
        uint256 prevInteractedRound;

        uint256 safeSupply;
        uint256 deitiedSupply;

        uint256 summitSafeWinningsDebt;
        uint256 rewardsSafeWinningsDebt;
        uint256 summitDeityWinningsDebt;
        uint256 rewardsDeityWinningsDebt;
    }

    mapping(address => UserEverestInfo) public userEverestInfo;

    IERC20 expeditionRewardToken;

    struct ExpeditionBasket {
        uint256 summit;
        uint256 rewards;
    }

    struct ExpeditionInfo {
        bool launched;                                      // If the start round of the pool has passed and it is open for betting
        bool live;                                          // If the pool is manually enabled / disabled

        uint256 roundsRemaining;                           // Number of rounds of this expedition to run.

        uint256 safeSupply;
        uint256 deitiedSupply;
        uint256[2] deitySupply;                       // Running total of combined equivalent SUMMIT in each deity to calculate rewards

        ExpeditionBasket roundEmission;         // The amount of Reward token for each round
        ExpeditionBasket emissionsRemaining;     // Remaining rewards to be earned
        ExpeditionBasket markedForDist;         // Rewards marked to be distributed but not yet withdrawn by users.
        ExpeditionBasket distributed;           // Total rewards distribution amount
        ExpeditionBasket safeWinningsMult;      // Guaranteed winnings regardless of deity selected
        ExpeditionBasket[2] deityWinningsMult;  // Running winnings per share for each deity, increased at round end
    }

    ExpeditionInfo public expeditionInfo;        // Expedition info
    mapping(address => UserExpeditionInfo) public userExpeditionInfo;        // Users running staked information







    // ---------------------------------------
    // --   E V E N T S
    // ---------------------------------------

    event SummitLocked(address indexed user, uint256 _summitLocked, uint256 _lockPeriod, uint256 _everestAwarded);
    event LockDurationIncreased(address indexed user, uint256 _lockPeriod, uint256 _additionalEverestAwarded);
    event LockedSummitIncreased(address indexed user, bool indexed _increasedWithClaimableWinnings, uint256 _summitLocked, uint256 _everestAwarded);
    event LockedSummitRemoved(address indexed user, uint256 _summitRemoved, uint256 _everestBurned);

    event UserJoinedExpedition(address indexed user, address indexed exped, uint8 _deity, uint8 _safetyFactor, uint256 _everestOwned);
    event UserHarvestedExpedition(address indexed user, address indexed exped, uint256 _summitHarvested, uint256 _rewardsHarvested);

    event ExpeditionInitialized();
    event ExpeditionExtended(address indexed token, uint256 _rewardAmount, uint256 _rounds);
    event ExpeditionRestarted(address indexed token, uint256 _rewardAmount, uint256 _rounds);
    event SetSummitLpEverestIncentiveMult(address indexed user, uint256 indexed newIncentiveMultiplier);
    





    // ---------------------------------------
    // --  A D M I N I S T R A T I O N
    // ---------------------------------------


    /// @dev Constructor, setting address of cartographer
    constructor(
        address _summit,
         address _everest,
         address _elevationHelper,
         address _expeditionRewardToken,
         address _summitLocking
    ) {
        require(_summit != address(0), "Summit required");
        require(_everest != address(0), "Everest required");
        require(_elevationHelper != address(0), "Elevation Helper Required");
        require(_expeditionRewardToken != address(0), "Reward Token Required");
        require(_summitLocking != address(0), "SummitLocking Required");
        summit = SummitToken(_summit);
        everest = EverestToken(_everest);
        elevationHelper = ElevationHelper(_elevationHelper);
        everest.approve(burnAdd, type(uint256).max);
        expeditionRewardToken = IERC20(_expeditionRewardToken);
        summitLocking = SummitLocking(_summitLocking);

        rolledOverRounds = elevationHelper.roundNumber(EXPEDITION);
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


    function supply()
        public view
        returns (uint256, uint256, uint256, uint256)
    {
        return (
            expeditionInfo.safeSupply,
            expeditionInfo.deitiedSupply,
            expeditionInfo.deitySupply[0],
            expeditionInfo.deitySupply[1]
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
    function remainingRewards()
        public view
        returns (uint256, uint256)
    {
        return (
            expeditionInfo.emissionsRemaining.summit,
            expeditionInfo.emissionsRemaining.rewards
        );
    }




    // ---------------------------------------
    // --   A D J U S T M E N T S
    // ---------------------------------------



    function setMinLockTime(uint256 _lockTimeDays) public onlyOwner {
        require(_lockTimeDays <= maxLockTime && _lockTimeDays >= 1 && _lockTimeDays <= 30, "Invalid minimum lock time (1-30 days)");
        minLockTime = _lockTimeDays * 24 * 365;
    }
    function setMaxLockTime(uint256 _lockTimeDays) public onlyOwner {
        require(_lockTimeDays >= minLockTime && _lockTimeDays >= 7 && _lockTimeDays <= 730, "Invalid maximum lock time (7-730 days)");
        maxLockTime = _lockTimeDays * 24 * 365;
    }
    function setLockTimeRequiredForTaxlessSummitWithdraw(uint256 _lockTimeDays) public onlyOwner {
        require(_lockTimeDays >= minLockTime && _lockTimeDays <= maxLockTime && _lockTimeDays >= 1 && _lockTimeDays <= 30, "Invalid taxless summit lock time (1-30 days)");
        lockTimeRequiredForTaxlessSummitWithdraw = _lockTimeDays;
    }
    function setLockTimeRequiredForLockedSummitDeposit(uint256 _lockTimeDays) public onlyOwner {
        require(_lockTimeDays >= minLockTime && _lockTimeDays <= maxLockTime && _lockTimeDays >= 1 && _lockTimeDays <= 90, "Invalid locked summit lock time (1-90 days)");
        lockTimeRequiredForClaimableSummitLock = _lockTimeDays;
    }
    function setMinEverestLockMult(uint256 _lockMult) public onlyOwner {
        require(_lockMult >= 100 && _lockMult <= 50000, "Invalid lock mult");
        minEverestLockMult = _lockMult;
    }
    function setMaxEverestLockMult(uint256 _lockMult) public onlyOwner {
        require(_lockMult >= 100 && _lockMult <= 50000, "Invalid lock mult");
        maxEverestLockMult = _lockMult;
    }
    function setExpeditionDeityWinningsMult(uint256 _deityWinningsMult) public onlyOwner {
        require(_deityWinningsMult >= 100 && _deityWinningsMult <= 500, "Invalid runway rounds (7-90)");
        expeditionDeityWinningsMult = _deityWinningsMult;
    }
    function setExpeditionRunwayRounds(uint256 _runwayRounds) public onlyOwner {
        require(_runwayRounds >= 7 && _runwayRounds <= 90, "Invalid runway rounds (7-90)");
        expeditionRunwayRounds = _runwayRounds;
    }





    // ---------------------------------------
    // --   P O O L   M A N A G E M E N T
    // ---------------------------------------


    /// @dev Recalculate and set expedition emissions
    function _recalculateExpeditionEmissions()
        internal
    {
        uint256 summitFund = summit.balanceOf(address(this)) - expeditionInfo.markedForDist.summit;
        uint256 rewardsFund = expeditionRewardToken.balanceOf(address(this)) - expeditionInfo.markedForDist.rewards;

        expeditionInfo.roundsRemaining = summitFund == 0 && rewardsFund == 0 ? 0 : expeditionRunwayRounds;

        expeditionInfo.emissionsRemaining.summit = summitFund;
        expeditionInfo.roundEmission.summit = expeditionInfo.roundsRemaining == 0 ? 0 : summitFund / expeditionRunwayRounds;

        expeditionInfo.emissionsRemaining.rewards = rewardsFund;
        expeditionInfo.roundEmission.rewards = expeditionInfo.roundsRemaining == 0 ? 0 : rewardsFund / expeditionRunwayRounds;
    }

    /// @dev Initializes the expedition
    function initializeExpedition()
        public
        onlyOwner
    {
        require(!expeditionInitialized, "Expedition not initialized");
        expeditionInitialized = true;

        ExpeditionBasket memory emptyBasket = ExpeditionBasket({
            summit: 0,
            rewards: 0
        });

        ExpeditionBasket[2] memory emptyDeityWinningsMult;
        emptyDeityWinningsMult[0] = emptyBasket;
        emptyDeityWinningsMult[1] = emptyBasket;

        expeditionInfo.live =  true;

        _recalculateExpeditionEmissions();

        emit ExpeditionInitialized();
    }

    /// @dev Add funds to the expedition
    function addExpeditionFunds(address _token, uint256 _amount)
        public nonReentrant
    {
        require (_token == address(summit) || _token == address(expeditionRewardToken), "Invalid token to add to expedition");
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        _recalculateExpeditionEmissions();
    }

    /// @dev Turn off an expedition
    function disableExpedition()
        public
        onlyOwner
    {
        require(expeditionInfo.live, "Expedition already disabled");
        expeditionInfo.live = false;
    }

    /// @dev Turn on a turned off expedition
    function enableExpedition()
        public
        onlyOwner
    {
        require(!expeditionInfo.live, "Expedition already enabled");
        expeditionInfo.live = true;
    }



    // ---------------------------------------
    // --   P O O L   R E W A R D S
    // ---------------------------------------
    
    function rewards(address _userAdd)
        public view
        validUserAdd(_userAdd)
        returns (uint256, uint256)
    {
        // Calculate and return the harvestable winnings for this expedition
        return _harvestableWinnings(userEverestInfo[_userAdd], userExpeditionInfo[_userAdd]);
    }


    function _calculateEmissionMultipliers()
        internal view
        returns (uint256, uint256, uint256, uint256)
    {
        // Total Supply of the expedition
        uint256 totalExpedSupply = expeditionInfo.deitiedSupply + expeditionInfo.safeSupply;
        if (totalExpedSupply == 0) return (0, 0, 0, 0);

        // Calculate safe winnings multiplier or escape if div/0
        uint256 summitSafeEmission = (expeditionInfo.roundEmission.summit * 1e18 * expeditionInfo.safeSupply) / totalExpedSupply;
        uint256 rewardSafeEmission = (expeditionInfo.roundEmission.rewards * 1e18 * expeditionInfo.safeSupply) / totalExpedSupply;

        // Calculate winning deity's winnings multiplier or escape if div/0
        uint256 summitDeitiedEmission = (expeditionInfo.roundEmission.summit * 1e18 * expeditionInfo.deitiedSupply) / totalExpedSupply;
        uint256 rewardDeitiedEmission = (expeditionInfo.roundEmission.rewards * 1e18 * expeditionInfo.deitiedSupply) / totalExpedSupply;

        return (
            summitSafeEmission,
            rewardSafeEmission,
            summitDeitiedEmission,
            rewardDeitiedEmission
        );
    }


    /// @dev User's staked amount, and how much they will win with that stake amount
    /// @param _userAdd User to check
    /// @return (
    ///     guaranteedSummitYield
    ///     guaranteedRewardsYield
    ///     deitiedSummitYield
    ///     deitiedRewardYield
    /// )
    function hypotheticalRewards(address _userAdd)
        public view
        validUserAdd(_userAdd)
        returns (uint256, uint256, uint256, uint256)
    {
        UserEverestInfo storage everestInfo = userEverestInfo[_userAdd];


        if (!expeditionInfo.live) return (0, 0, 0, 0);

        uint256 userSafeEverest = _getUserSafeEverest(everestInfo, everestInfo.safetyFactor);
        uint256 userDeitiedEverest = _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor);

        (uint256 summitSafeEmissionMultE18, uint256 rewardsSafeEmissionMultE18, uint256 summitDeitiedEmissionMultE18, uint256 rewardsDeitiedEmissionMultE18) = _calculateEmissionMultipliers();

        return(
            expeditionInfo.safeSupply == 0 ? 0 : ((summitSafeEmissionMultE18 * userSafeEverest) / expeditionInfo.safeSupply) / 1e18,
            expeditionInfo.safeSupply == 0 ? 0 : ((rewardsSafeEmissionMultE18 * userSafeEverest) / expeditionInfo.safeSupply) / 1e18,
            expeditionInfo.deitySupply[everestInfo.deity] == 0 ? 0 : ((summitDeitiedEmissionMultE18 * userDeitiedEverest) / expeditionInfo.deitySupply[everestInfo.deity]) / 1e18,
            expeditionInfo.deitySupply[everestInfo.deity] == 0 ? 0 : ((rewardsDeitiedEmissionMultE18 * userDeitiedEverest) / expeditionInfo.deitySupply[everestInfo.deity]) / 1e18
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

        _rolloverExpedition(currRound);

        rolledOverRounds = currRound;
    }


    /// @dev Roll over a single expedition
    /// @param _currRound Current round
    function _rolloverExpedition(uint256 _currRound)
        internal
    {
        if (!expeditionInfo.live) return;

        uint8 winningDeity = elevationHelper.winningTotem(EXPEDITION, _currRound - 1);

        // Calculate emission multipliers
        (uint256 summitSafeEmissionMultE18, uint256 rewardsSafeEmissionMultE18, uint256 summitDeitiedEmissionMultE18, uint256 rewardsDeitiedEmissionMultE18) = _calculateEmissionMultipliers();

        // Mark current round's emission to be distributed
        expeditionInfo.markedForDist.summit += (summitSafeEmissionMultE18 + summitDeitiedEmissionMultE18) / 1e18;
        expeditionInfo.markedForDist.rewards += (rewardsSafeEmissionMultE18 + rewardsDeitiedEmissionMultE18) / 1e18;
        expeditionInfo.distributed.summit += (summitSafeEmissionMultE18 + summitDeitiedEmissionMultE18) / 1e18;
        expeditionInfo.distributed.rewards += (rewardsSafeEmissionMultE18 + rewardsDeitiedEmissionMultE18) / 1e18;

        // Update the guaranteed emissions mults
        if (expeditionInfo.safeSupply > 0) {
            expeditionInfo.safeWinningsMult.summit += summitSafeEmissionMultE18 / expeditionInfo.safeSupply;
            expeditionInfo.safeWinningsMult.rewards += rewardsSafeEmissionMultE18 / expeditionInfo.safeSupply;
        }
        // Update winning deity's running winnings mult
        if (expeditionInfo.deitySupply[winningDeity] > 0) {
            expeditionInfo.deityWinningsMult[winningDeity].summit += summitDeitiedEmissionMultE18 / expeditionInfo.deitySupply[winningDeity];
            expeditionInfo.deityWinningsMult[winningDeity].rewards += rewardsDeitiedEmissionMultE18 / expeditionInfo.deitySupply[winningDeity];
        }
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
        return everestInfo.everestOwned * ((100 - _safetyFactor) / 100) * (expeditionDeityWinningsMult / 100);
    }

    /// @dev Calculation of winnings that are available to be harvested
    /// @param everestInfo everestInfo
    /// @param userExpedInfo UserExpedInfo
    /// @return Total winnings for a user, including vesting on previous round's winnings (if any)
    function _harvestableWinnings(UserEverestInfo storage everestInfo, UserExpeditionInfo storage userExpedInfo)
        internal view
        returns (uint256, uint256)
    {
        uint256 currRound = elevationHelper.roundNumber(EXPEDITION);

        // Escape early if no previous round exists with available winnings
        if (!expeditionInfo.launched) return (0, 0);

        // If user interacted in current round, no winnings available
        if (userExpedInfo.prevInteractedRound == currRound) return (0, 0);

        uint256 safeEverest = _getUserSafeEverest(everestInfo, everestInfo.safetyFactor);
        uint256 deitiedEverest = _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor);

        return (
            ((safeEverest * (expeditionInfo.safeWinningsMult.summit - userExpedInfo.summitSafeWinningsDebt)) / 1e18) +
            ((deitiedEverest * (expeditionInfo.deityWinningsMult[everestInfo.deity].summit - userExpedInfo.summitDeityWinningsDebt)) / 1e18),
            ((safeEverest * (expeditionInfo.safeWinningsMult.rewards - userExpedInfo.rewardsSafeWinningsDebt)) / 1e18) +
            ((deitiedEverest * (expeditionInfo.deityWinningsMult[everestInfo.deity].rewards - userExpedInfo.rewardsDeityWinningsDebt)) / 1e18)
        );
    }
    


    

    // ------------------------------------------------------------
    // --   U S E R   I N T E R A C T I O N S
    // ------------------------------------------------------------


    /// @dev Update the users round interaction
    /// @param everestInfo User's everest info
    /// @param userExpedInfo User's expedition info
    function _updateUserRoundInteraction(UserEverestInfo storage everestInfo, UserExpeditionInfo storage userExpedInfo)
        internal
    {
        uint256 currRound = elevationHelper.roundNumber(EXPEDITION);

        userExpedInfo.safeSupply = _getUserSafeEverest(everestInfo, everestInfo.safetyFactor);
        userExpedInfo.deitiedSupply = _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor);

        // Acc winnings per share of user's deity of both SUMMIT token and SUMMIT LP
        userExpedInfo.summitSafeWinningsDebt = expeditionInfo.safeWinningsMult.summit;
        userExpedInfo.rewardsSafeWinningsDebt = expeditionInfo.safeWinningsMult.rewards;
        userExpedInfo.summitDeityWinningsDebt = expeditionInfo.deityWinningsMult[everestInfo.deity].summit;
        userExpedInfo.rewardsDeityWinningsDebt = expeditionInfo.deityWinningsMult[everestInfo.deity].rewards;

        // Update the user's previous interacted round to be this round
        userExpedInfo.prevInteractedRound = currRound;
    }



    // ------------------------------------------------------------
    // --   E V E R E S T
    // ------------------------------------------------------------

    /// @dev Lock period multiplier
    function _lockPeriodMultiplier(uint256 _lockPeriod)
        internal view
        returns (uint256)
    {
        return (((_lockPeriod - minLockTime) * (maxEverestLockMult - minEverestLockMult) * 1e12) /
            (maxLockTime - minLockTime) /
            1e12) +
            minEverestLockMult;
    }

    /// @dev Transfer everest to the burn address.
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

    /// @dev Lock Summit for a duration and earn everest
    /// @param _summitAmount Amount of SUMMIT to deposit
    /// @param _lockPeriod Duration the SUMMIT will be locked for
    function lockSummit(uint256 _summitAmount, uint256 _lockPeriod)
        public
        nonReentrant userNotAlreadyLockingSummit validLockPeriod(_lockPeriod)
    {
        // Validate and deposit user's SUMMIT
        require(_summitAmount <= IERC20(summit).balanceOf(msg.sender), "Exceeds balance");
        if (_summitAmount > 0) {    
            IERC20(summit).safeTransferFrom(msg.sender, address(this), _summitAmount);
        }

        // Calculate the lock multiplier and EVEREST award
        uint256 everestLockMultiplier = _lockPeriodMultiplier(_lockPeriod);
        uint256 everestAward = (_summitAmount * everestLockMultiplier) / 10000;
        
        // Mint EVEREST to the user's wallet
        everest.mint(msg.sender, everestAward);

        // Create and initialize the user's everestInfo
        UserEverestInfo storage everestInfo = _getOrCreateUserEverestInfo(msg.sender);
        everestInfo.everestOwned = everestAward;
        everestInfo.everestLockMultiplier = everestLockMultiplier;
        everestInfo.lockRelease = block.timestamp + _lockPeriod;
        everestInfo.summitLocked = _summitAmount;

        // Update the EVEREST in the expedition
        _updateExpeditionInteraction(everestInfo);

        emit SummitLocked(msg.sender, _summitAmount, _lockPeriod, everestAward);
    }


    /// @dev Increase the lock duration of user's locked SUMMIT
    function increaseLockDuration(uint256 _lockPeriod)
        public
        nonReentrant userEverestInfoExists userOwnsEverest
    {
        uint256 additionalEverestAward = _increaseLockDuration(_lockPeriod, msg.sender);
        emit LockDurationIncreased(msg.sender, _lockPeriod, additionalEverestAward);
    }
    function _increaseLockDuration(uint256 _lockPeriod, address _userAdd)
        internal
        returns (uint256)
    {
        UserEverestInfo storage everestInfo = userEverestInfo[_userAdd];

        // Calculate and validate the new everest lock multiplier
        uint256 everestLockMultiplier = _lockPeriodMultiplier(_lockPeriod);
        require(everestLockMultiplier > everestInfo.everestLockMultiplier, "New lock period must be greater");

        // Calculate the additional EVEREST awarded by the extended lock duration
        uint256 additionalEverestAward = ((everestInfo.summitLocked * everestLockMultiplier) / 10000) - everestInfo.everestOwned;

        // Increase the lock release
        uint256 lockRelease = block.timestamp + _lockPeriod;

        // Mint EVEREST to the user's address
        everest.mint(msg.sender, additionalEverestAward);

        // Update the user's running state
        everestInfo.everestOwned += additionalEverestAward;
        everestInfo.everestLockMultiplier = everestLockMultiplier;
        everestInfo.lockRelease = lockRelease;

        // Update the expedition with the user's new EVEREST amount
        _updateExpeditionInteraction(everestInfo);

        return additionalEverestAward;
    }


    /// @dev Internal locked SUMMIT amount increase, returns the extra EVEREST earned by the increased lock duration
    function _increaseLockedSummit(uint256 _summitAmount, UserEverestInfo storage everestInfo, address _summitOriginAdd)
        internal
        returns (uint256)
    {
        // Validate and deposit user's funds
        require(_summitAmount <= IERC20(summit).balanceOf(_summitOriginAdd), "Exceeds balance");
        if (_summitAmount > 0) {
            IERC20(summit).safeTransferFrom(_summitOriginAdd, address(this), _summitAmount);
        }

        // Calculate the extra EVEREST that is awarded by the deposited SUMMIT
        uint256 additionalEverestAward = (_summitAmount * everestInfo.everestLockMultiplier) / 10000;
        
        // Mint EVEREST to the user's address
        everest.mint(everestInfo.userAdd, additionalEverestAward);

        // Increase running balances of EVEREST and SUMMIT
        everestInfo.everestOwned += additionalEverestAward;
        everestInfo.summitLocked += _summitAmount;

        // Update the expedition with the users new EVEREST info
        _updateExpeditionInteraction(everestInfo);

        return additionalEverestAward;
    }

    /// @dev Increase the duration of already locked SUMMIT to 30 days, exit early if user is already locked for longer than 30 days
    function _increaseLockReleaseOnClaimableLocked(UserEverestInfo storage everestInfo)
        internal
        returns (uint256)
    {
        // Early escape if lock release already satisfies requirement
        if (block.timestamp + lockTimeRequiredForClaimableSummitLock <= everestInfo.lockRelease) return 0;

        // Update lock release and return the extra EVEREST that is earned by this extension
        return _increaseLockDuration(lockTimeRequiredForClaimableSummitLock, everestInfo.userAdd);
    }

    /// @dev Exchange Summit for Everest, extend lock duration to 30 days (used by SummitLocking.sol)
    function lockClaimableSummit(uint256 _summitAmount, address _userAdd)
        external
        nonReentrant userEverestInfoExists userOwnsEverest
    {
        UserEverestInfo storage everestInfo = userEverestInfo[_userAdd];

        // Increase the lock duration of the current locked SUMMIT
        uint256 additionalEverestAward = _increaseLockReleaseOnClaimableLocked(everestInfo);

        // Increase the amount of locked summit by {_summitAmount} and increase the EVEREST award
        additionalEverestAward += _increaseLockedSummit(
            _summitAmount,
            everestInfo,
            msg.sender
        );
        
        emit LockedSummitIncreased(msg.sender, true, _summitAmount, additionalEverestAward);
    }

    /// @dev Increase the users Locked Summit and earn everest
    function increaseLockedSummit(uint256 _summitAmount)
        public
        nonReentrant userEverestInfoExists userOwnsEverest
    {
        uint256 additionalEverestAward = _increaseLockedSummit(
            _summitAmount,
            userEverestInfo[msg.sender],
            msg.sender
        );

        emit LockedSummitIncreased(msg.sender, false, _summitAmount, additionalEverestAward);
    }

    /// @dev Decrease the Summit and burn everest
    function decreaseLockedSummit(uint256 _everestAmount)
        public
        nonReentrant userEverestInfoExists userOwnsEverest userLockPeriodSatisfied validEverestAmountToBurn(_everestAmount)
    {
        UserEverestInfo storage everestInfo = userEverestInfo[msg.sender];

        uint256 percWithdrawing = (_everestAmount * 1e12) / everestInfo.everestOwned;
        uint256 summitToWithdraw = (everestInfo.summitLocked * percWithdrawing) / 1e12;

        everestInfo.everestOwned -= _everestAmount;
        everestInfo.summitLocked -= summitToWithdraw;

        IERC20(summit).safeTransfer(msg.sender, summitToWithdraw);
        _burnEverest(msg.sender, _everestAmount);

        _updateExpeditionInteraction(everestInfo);

        emit LockedSummitRemoved(msg.sender, summitToWithdraw, _everestAmount);
    }


    /// @dev Panic recover locked SUMMIT if something has gone wrong
    function panicRecoverFunds()
        public
        nonReentrant userEverestInfoExists
    {
        require(panicReleaseLockedSummit, "Not in panic mode");

        UserEverestInfo storage everestInfo = userEverestInfo[msg.sender];

        IERC20(summit).safeTransfer(msg.sender, everestInfo.summitLocked);

        everestInfo.userAdd = address(0);
        everestInfo.everestOwned = 0;
        everestInfo.summitLocked = 0;
        everestInfo.lockRelease = 0;
        everestInfo.everestLockMultiplier = 0;
        everestInfo.deity = 0;
        everestInfo.deitySelected = false;
        everestInfo.deitySelectionRound = 0;
        everestInfo.safetyFactor = 0;
        everestInfo.safetyFactorSelected = false;
    }



    // ------------------------------------------------------------
    // --   E X P E D   H E L P E R S
    // ------------------------------------------------------------

    function _harvestExpedition(UserEverestInfo storage everestInfo, UserExpeditionInfo storage userExpedInfo)
        internal
        returns (uint256, uint256)
    {
        // Get calculated harvestable winnings
        (uint256 summitWinnings, uint256 rewardsWinnings) = _harvestableWinnings(everestInfo, userExpedInfo);

        // Early escape if no winnings available to harvest;
        if ((summitWinnings + rewardsWinnings) == 0) return (0, 0);
    
        // Claim SUMMIT winnings (lock for 30 days)
        IERC20(summit).safeTransfer(address(summitLocking), summitWinnings);
        summitLocking.addLockedWinnings(summitWinnings, 0, everestInfo.userAdd);

        // Transfer rewards to user
        expeditionRewardToken.safeTransfer(everestInfo.userAdd, rewardsWinnings);

        // Mark harvested winnings as withdrawn
        expeditionInfo.markedForDist.summit -= summitWinnings;
        expeditionInfo.markedForDist.rewards -= rewardsWinnings;

        return (summitWinnings, rewardsWinnings);
    }



    // ----------------------------------------------------------------------
    // --  E X P E D   D I R E C T   I N T E R A C T I O N S
    // ----------------------------------------------------------------------


    /// @dev Select a user's deity, update the expedition's deities with the switched funds
    function selectDeity(uint8 _deity)
        public
        nonReentrant validDeity(_deity) expeditionInteractionsAvailable
    {
        UserEverestInfo storage everestInfo = _getOrCreateUserEverestInfo(msg.sender);

        // Early exit if deity is same as current
        require(!everestInfo.deitySelected || everestInfo.deity != _deity, "Deity must be different");

        // Iterate through expeditions and switch deity for each user staked with
        _selectExpeditionDeity(
            everestInfo,
            _deity
        );

        // Update user deity in state
        everestInfo.deity = _deity;
        everestInfo.deitySelected = true;
        everestInfo.deitySelectionRound = elevationHelper.roundNumber(EXPEDITION);
    }


    /// @dev Change the safety factor of a user
    function selectSafetyFactor(uint8 _safetyFactor)
        public
        nonReentrant validSafetyFactor(_safetyFactor) expeditionInteractionsAvailable
    {
        UserEverestInfo storage everestInfo = _getOrCreateUserEverestInfo(msg.sender);

        // Early exit if safety factor is the same
        require(!everestInfo.safetyFactorSelected || everestInfo.safetyFactor != _safetyFactor, "SafetyFactor must be different");

        // Update user's safety factor in the Expedition
        _selectExpeditionSafetyFactor(
            everestInfo,
            _safetyFactor
        );

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
        userEverestInfoExists userOwnsEverest userIsEligibleToJoinExpedition expeditionInteractionsAvailable
    {
        UserEverestInfo storage everestInfo = userEverestInfo[msg.sender];
        UserExpeditionInfo storage userExpedInfo = userExpeditionInfo[msg.sender];        

        // Mark user interacting with this expedition to the user's expeditions slot
        require(!userExpedInfo.entered, "Already entered");
        userExpedInfo.entered = true;

        // Add users everest to exped supplies at current risk rate
        expeditionInfo.safeSupply += _getUserSafeEverest(everestInfo, everestInfo.safetyFactor);
        expeditionInfo.deitiedSupply += _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor);
        expeditionInfo.deitySupply[everestInfo.deity] += _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor);

        // Update the user's round interaction with updated info
        _updateUserRoundInteraction(everestInfo, userExpedInfo);

        emit UserJoinedExpedition(msg.sender, _token, everestInfo.deity, everestInfo.safetyFactor, everestInfo.everestOwned);
    }

    function harvestExpedition(address _token)
        public
        nonReentrant userEverestInfoExists userOwnsEverest expeditionInteractionsAvailable
    {
        UserEverestInfo storage everestInfo = userEverestInfo[msg.sender];
        UserExpeditionInfo storage userExpedInfo = userExpeditionInfo[msg.sender];        

        (uint256 summitHarvested, uint256 rewardsHarvested) = _harvestExpedition(everestInfo, userExpedInfo);
        _updateUserRoundInteraction(everestInfo, userExpedInfo);

        emit UserHarvestedExpedition(msg.sender, _token, summitHarvested, rewardsHarvested);
    }



    // ----------------------------------------------------------------------
    // --   U S E R   I N T E R A C T I N G   E X P E D S   U P D A T E S
    // ----------------------------------------------------------------------


    


    /// @dev Switch users funds (if any staked) to the new deity
    /// @param everestInfo User's everest info
    /// @param _newDeity Deity the user is leaving
    function _selectExpeditionDeity(UserEverestInfo storage everestInfo, uint8 _newDeity)
        internal
    {
        UserExpeditionInfo storage userExpedInfo = userExpeditionInfo[everestInfo.userAdd];

        // Harvest any winnings in this expedition
        _harvestExpedition(everestInfo, userExpedInfo);
        
        // Update user's interaction in this expedition
        _updateUserRoundInteraction(everestInfo, userExpedInfo);
        
        // Transfer deitied everest from previous deity to new deity
        expeditionInfo.deitySupply[everestInfo.deity] -= _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor);
        expeditionInfo.deitySupply[_newDeity] += _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor);
    }


    /// @dev Switch users funds (if any staked) to the new deity
    /// @param everestInfo User's everest info
    /// @param _newSafetyFactor New safety factor of user
    function _selectExpeditionSafetyFactor(UserEverestInfo storage everestInfo, uint8 _newSafetyFactor)
        internal
    {
        UserExpeditionInfo storage userExpedInfo = userExpeditionInfo[everestInfo.userAdd];

        // Harvest any winnings in this expedition
        _harvestExpedition(everestInfo, userExpedInfo);
        
        // Update user's interaction in this expedition
        _updateUserRoundInteraction(everestInfo, userExpedInfo);

        // Override updated safe supply and deitied supply from updateUserRoundInteraction
        userExpedInfo.safeSupply = _getUserSafeEverest(everestInfo, _newSafetyFactor);
        userExpedInfo.deitiedSupply = _getUserDeitiedEverest(everestInfo, _newSafetyFactor);
        
        // Remove safe and deitied everest from existing supply states
        expeditionInfo.safeSupply = expeditionInfo.safeSupply - _getUserSafeEverest(everestInfo, everestInfo.safetyFactor) + _getUserSafeEverest(everestInfo, _newSafetyFactor);
        expeditionInfo.deitiedSupply = expeditionInfo.deitiedSupply - _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor) + _getUserDeitiedEverest(everestInfo, _newSafetyFactor);
        expeditionInfo.deitySupply[everestInfo.deity] = expeditionInfo.deitySupply[everestInfo.deity] - _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor) + _getUserDeitiedEverest(everestInfo, _newSafetyFactor);
    }
    

    function updateExpeditionInteraction()
        public
        userEverestInfoExists userOwnsEverest expeditionInteractionsAvailable
    {
        _updateExpeditionInteraction(userEverestInfo[msg.sender]);
    }

    function _updateExpeditionInteraction(UserEverestInfo storage everestInfo)
        internal
    {
        UserExpeditionInfo storage userExpedInfo = userExpeditionInfo[everestInfo.userAdd];        

        // Early exit if user hasn't entered expedition
        if (!userExpeditionInfo[everestInfo.userAdd].entered) return;

        // Harvest winnings from expedition
        _harvestExpedition(everestInfo, userExpedInfo);

        // Remove user's existing supplies from expedition, add new supplies
        expeditionInfo.safeSupply = expeditionInfo.safeSupply - userExpedInfo.safeSupply + _getUserSafeEverest(everestInfo, everestInfo.safetyFactor);
        expeditionInfo.deitiedSupply = expeditionInfo.deitiedSupply - userExpedInfo.deitiedSupply + _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor);
        expeditionInfo.deitySupply[everestInfo.deity] = expeditionInfo.deitySupply[everestInfo.deity] - userExpedInfo.deitiedSupply + _getUserDeitiedEverest(everestInfo, everestInfo.safetyFactor);

        _updateUserRoundInteraction(everestInfo, userExpedInfo);
    }


    /// @dev If a problem exists in the Expedition or with Everest, allow users to withdraw their SUMMIT unconditionally (PANIC)
    function panicReleaseLocking(bool _releaseLockedSummit)
        public
        onlyOwner
    {
        panicReleaseLockedSummit = _releaseLockedSummit;
    }
}
