// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "./Cartographer.sol";
import "./ElevationHelper.sol";
import "./ISubCart.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";


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
--   Y I E L D   G A M B L I N G   E X P L A N A T I O N
---------------------------------------------------------------------------------------------

Funds are staked in elevation farms, and the resulting yield is risked to earn a higher yield multiplier
The staked funds are safe from risk, and cannot ever be lost

STAKING:
    . 3 tiers exist: 2K - plains / 5K - mesa / 10K - summit
    . Each tier has a set of TOTEMs
    . Users select a totem to represent them at the 'multiplying table', shared by all pools at that elevation
    . Funds are staked / withdrawn in the same way as traditional pools / farms, represented by their selected totem
    . Over time, a user's BET builds up as traditional staking does
    . Instead of the staking yield being immediately available, it is risked against the yields of other stakers
    . BETs build over the duration of a ROUND
    . The summed BETs of all users is considered the POT for that round

ROUNDS:
    . Each tier has a different round duration: 2 hours - plains / 4 hours - mesa / 10 hours - summit
    . At the end of each round, the round is ROLLED OVER
    . The ROLLOVER selects a TOTEM as the winner for that round
    . All users represented by that TOTEM are considered winners of that round
    . The winning TOTEM wins the entire pot
    . Winning users split the whole pot, effectively earning the staking rewards of the other users
    . Winnings vest over the duration of the next round
    

    


---------------------------------------------------------------------------------------------
--   Y I E L D   G A M B L I N G   C A L C U L A T I O N S   O V E R V I E W
---------------------------------------------------------------------------------------------



POOL:
    . At the end of each round, during the 'rollover' process, the following is saved in `poolRoundInfo` to be used in user's winnings calculations:
        - endAccSummitPerShare - the accSummitPerShare when the round ended
        - winningsMultiplier - how much each user's yield reward is multiplied by: (pool roundRewards) / (pool winning totem roundRewards)
        - precomputedFullRoundMult - (the change in accSummitPerShare over the whole round) * (winningsMultiplier)


USER:
    . The user's funds can be left in a pool over multiple rounds without any interaction
    . On the fly calculation of all previous rounds winnings (if any) must be fast and efficient
    

    . Any user interaction with a pool updates the following in UserInfo:
        - user.prevInteractedRound - Marks that the current round is the user last interaction with this pool
        - user.staked - Amount staked in the pool
        - user.roundDebt - The current accSummitPerShare, used to calculate the rewards earned by the user from the current mid-round point, to the end of the round
        - user.roundRew - The user may interact with the same round multiple times without losing any existing farmed rewards, this stores any accumulated rewards that have built up mid round, and is increased with each subsequent round interaction in the same round
    

*/

contract CartographerElevation is ISubCart, Ownable, Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;



    // ---------------------------------------
    // --   V A R I A B L E S
    // ---------------------------------------

    Cartographer cartographer;
    ElevationHelper elevationHelper;
    uint8 public elevation;
    bool public elevationEnabled; // TODO: Setter
    address public summitTokenAddress;


    struct UserInfo {
        // Yield Multiplying
        uint256 prevInteractedRound;                // Round the user last made a deposit / withdrawal / claim
        uint256 staked;                             // The amount of token the user has in the pool
        uint256 roundDebt;                          // Used to calculate user's first interacted round reward
        uint256 roundRew;                           // Running sum of user's rewards earned in current round

        uint256 winningsDebt;                       // AccWinnings of user's totem at time of deposit
        uint256 lastDepositTimestamp;               // Last timestamp user deposits fund into pool
    }

    struct UserElevationInfo {
        address userAdd;

        uint8 totem;
        bool totemSelected;
        uint256 totemSelectionRound;
    }
    
    mapping(address => EnumerableSet.AddressSet) userInteractingPools;
    
    struct RoundInfo {                              
        uint256 endAccSummitPerShare;               // The accSummitPerShare at the end of the round, used for back calculations
        uint256 winningsMultiplier;                 // Rewards multiplier: TOTAL POOL STAKED / WINNING TOTEM STAKED
        uint256 precomputedFullRoundMult;           // Gas optimization for back calculation: accSummitPerShare over round multiplied by winnings multiplier
    }

    struct ElevationPoolInfo {
        address token;                               // Address of reward token contract
        
        bool launched;                              // If the start round of the pool has passed and it is open for staking / rewards
        bool live;                                  // If the pool is running, in lieu of allocPoint
        bool active;                                // Whether the pool is active, used to keep pool alive until round rollover

        uint256 supply;                             // Running total of the token amount staked in this pool at elevation
        uint256 lastRewardTimestamp;                // Last timestamp that SUMMIT distribution occurs.
        uint256 accSummitPerShare;                  // Accumulated SUMMIT per share, raised 1e12. See below.

        uint256[] totemSupplies;                    // Running total of LP in each totem to calculate rewards
        uint256 roundRewards;                       // Rewards of entire pool accum over round
        uint256[] totemRoundRewards;                // Rewards of each totem accum over round

        uint256[] totemRunningPrecomputedMult;      // Running winnings per share for each totem
    }

    
    EnumerableSet.AddressSet private poolTokens;
    EnumerableSet.AddressSet private activePools;

    mapping(address => ElevationPoolInfo) public poolInfo;              // Pool info for each elevation pool
    mapping(address => mapping(uint256 => RoundInfo)) public poolRoundInfo;      // The round end information for each round of each pool
    mapping(uint256 => uint256) public roundWinningsMult; // The historical winning multipliers of an elevation
    mapping(address => mapping(address => UserInfo)) public userInfo;            // Users running staking / vesting information
    mapping(address => UserElevationInfo) public userElevationInfo;// User's totem info at each elevation









    // ---------------------------------------
    // --  A D M I N I S T R A T I O N
    // ---------------------------------------


    /// @dev Constructor, setting address of cartographer
    constructor(address _Cartographer, uint8 _elevation)
    {
        require(_Cartographer != address(0), "Cartographer required");
        require(_elevation >= 1 && _elevation <= 3, "Invalid elevation");
        cartographer = Cartographer(_Cartographer);
        elevation = _elevation;
    }


    /// @dev Set address of ElevationHelper during initialization
    function initialize(address _ElevationHelper, address _summitTokenAddress)
        external override
        initializer onlyCartographer
    {
        require(_ElevationHelper != address(0), "Contract is zero");
        require(_summitTokenAddress != address(0), "SummitToken is zero");
        elevationHelper = ElevationHelper(_ElevationHelper);
        summitTokenAddress = _summitTokenAddress;
    }

    /// @dev Unused enable summit stub
    function enable(uint256) external override {}
    





    // ------------------------------------------------------
    // --   M O D I F I E R S 
    // ------------------------------------------------------

    function _onlyCartographer() internal view {
        require(msg.sender == address(cartographer), "Only cartographer");
    }
    modifier onlyCartographer() {
        _onlyCartographer();
        _;
    }
    function _totemSelected(address _userAdd) internal view returns (bool) {
        return userElevationInfo[_userAdd].totemSelected;
    }
    modifier userHasSelectedTotem(address _userAdd) {
        require(_totemSelected(_userAdd), "Totem must be selected");
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
        require(!poolTokens.contains(_token), "Duplicated");
        _;
    }
    modifier validTotem(uint8 _totem) {
        require(_totem < elevationHelper.totemCount(elevation), "Invalid totem");
        _;
    }
    modifier elevationTotemSelectionAvailable() {
        require(!elevationHelper.endOfRoundLockoutActive(elevation) || elevationHelper.elevationLocked(elevation), "Totem selection locked");
        _;
    }
    function _elevationInteractionsAvailable() internal view {
        require(!elevationHelper.endOfRoundLockoutActive(elevation), "Elev locked until rollover");
    }
    modifier elevationInteractionsAvailable() {
        _elevationInteractionsAvailable();
        _;
    }
    function _poolExists(address _token) internal view {
        require(poolTokens.contains(_token), "Pool doesnt exist");
    }
    modifier poolExists(address _token) {
        _poolExists(_token);
        _;
    }
    modifier poolExistsAndLaunched(address _token) {
        console.log("Pool Exists and Launched", poolTokens.contains(_token), poolInfo[_token].launched);
        require(poolTokens.contains(_token), "Pool doesnt exist");
        require(poolInfo[_token].launched, "Pool not launched yet");
        _;
    }
    




    // ---------------------------------------
    // --   U T I L S (inlined for brevity)
    // ---------------------------------------
    

    function supply(address _token) external view override returns (uint256) {
        return poolInfo[_token].supply;
    }
    function _getUserTotem(address _userAdd) internal view returns (uint8) {
        return userElevationInfo[_userAdd].totem;
    }
    function selectedTotem(address _userAdd) external view override returns (uint8) {
        return _getUserTotem(_userAdd);
    }
    function isTotemSelected(address _userAdd) external view override returns (bool) {
        return _totemSelected(_userAdd);
    }
    
    function totemSupplies(address _token) public view poolExists(_token) returns (uint256[10] memory) {
        ElevationPoolInfo storage pool = poolInfo[_token];
        return [
            elevation >= 1 ? pool.totemSupplies[0] : 0,
            elevation >= 1 ? pool.totemSupplies[1] : 0,
            elevation >= 2 ? pool.totemSupplies[2] : 0,
            elevation >= 2 ? pool.totemSupplies[3] : 0,
            elevation >= 2 ? pool.totemSupplies[4] : 0,
            elevation >= 3 ? pool.totemSupplies[5] : 0,
            elevation >= 3 ? pool.totemSupplies[6] : 0,
            elevation >= 3 ? pool.totemSupplies[7] : 0,
            elevation >= 3 ? pool.totemSupplies[8] : 0,
            elevation >= 3 ? pool.totemSupplies[9] : 0
        ];
    }


    /// @dev Calculate the emission to bring the selected pool current
    function emissionToBringPoolCurrent(ElevationPoolInfo memory pool) internal view returns (uint256) {
        // Early escape if pool is already up to date or not live
        if (block.timestamp == pool.lastRewardTimestamp || pool.supply == 0 || !pool.live || !pool.launched) return 0;
        
        // Get the (soon to be) awarded summit emission for this pool over the timespan that would bring current
        return cartographer.poolSummitEmission(pool.lastRewardTimestamp, pool.token, elevation);
    }


    /// @dev Calculates up to date pool round rewards and totem round rewards with pool's emission
    /// @param _token Pool identifier
    /// @return Up to date versions of round rewards.
    ///         [poolRoundRewards, ...totemRoundRewards 1 - 10]
    function totemRoundRewards(address _token)
        public view
        poolExists(_token)
        returns (uint256[11] memory)
    {
        ElevationPoolInfo storage pool = poolInfo[_token];
        uint8 totemCount = elevationHelper.totemCount(elevation);

        // Gets emission that would bring the pool current from last reward timestamp
        uint256 emissionToBringCurrent = emissionToBringPoolCurrent(pool);

        // Create return array
        uint256[11] memory finalTotemRewards;

        // Add total emission to bring current to pool round rewards
        finalTotemRewards[0] = pool.roundRewards + emissionToBringCurrent;

        // For each totem, increase round rewards proportionally to amount staked in that totem compared to full pool's amount staked
        for (uint8 i = 0; i < 10; i++) {

            // If totem out of range for elevation, return 0
            if (i >= totemCount)
                finalTotemRewards[i + 1] = 0;

            // If pool or totem doesn't have anything staked, the totem's round rewards won't change with the new emission
            else if (pool.supply == 0 || pool.totemSupplies[i] == 0)
                finalTotemRewards[i + 1] = pool.totemRoundRewards[i];

            // Increase the totem's round rewards with a proportional amount of the new emission
            else
                finalTotemRewards[i + 1] = pool.totemRoundRewards[i] + (emissionToBringCurrent * pool.totemSupplies[i] / pool.supply);
        }

        // Return up to date round rewards
        return finalTotemRewards;
    }
    




    // ---------------------------------------
    // --   P O O L   M A N A G E M E N T
    // ---------------------------------------

    function _markPoolActive(ElevationPoolInfo storage pool, bool _active)
        internal
    {
        if (pool.active == _active) return;

        require(!_active || (activePools.length() < 24), "Too many active pools");

        pool.active = _active;
        if (_active) {
            activePools.add(pool.token);
        } else {
            activePools.remove(pool.token);
        }
    }


    /// @dev Creates a new elevation yield multiplying pool
    /// @param _token Token of the pool (also identifier)
    /// @param _live Whether the pool is enabled initially
    /// @param _token Token yielded by pool
    function add(address _token, bool _live)
        external override
        onlyCartographer nonDuplicated(_token)
    {
        // Register pool token
        poolTokens.add(_token);

        // Create the initial state of the elevation pool
        poolInfo[_token] = ElevationPoolInfo({
            token: _token,

            launched: false,
            live: _live,
            active: false, // Will be made active in the add active pool below if _live is true

            supply: 0,
            accSummitPerShare : 0,
            lastRewardTimestamp : block.timestamp,

            totemSupplies : new uint256[](elevationHelper.totemCount(elevation)),
            roundRewards : 0,
            totemRoundRewards : new uint256[](elevationHelper.totemCount(elevation)),

            totemRunningPrecomputedMult: new uint256[](elevationHelper.totemCount(elevation))
        });

        if (_live) _markPoolActive(poolInfo[_token], true);
    }
    
    
    /// @dev Update a given pools deposit or live status
    /// @param _token Pool token
    /// @param _live If pool is available for staking
    function set(address _token, bool _live)
        external override
        onlyCartographer poolExists(_token)
    {
        ElevationPoolInfo storage pool = poolInfo[_token];
        updatePool(_token);

        // If live status changes
        if (pool.live != _live) {
            // If pool is already launched when live status changes, update cartographer allocations
            if (pool.launched) cartographer.setIsTokenEarningAtElevation(pool.token, elevation, _live);

            // If pool is becoming live and isn't already active, add to active pools list
            if (_live && !pool.active) _markPoolActive(pool, true);
            // Else pool is becoming inactive, which will be reflected at the end of the round in pool rollover function
        }

        // Update internal pool states
        pool.live = _live;
    }


    /// @dev Update all pools to current timestamp before other pool management transactions
    function massUpdatePools()
        external override
        onlyCartographer
    {
        for (uint16 index = 0; index < poolTokens.length(); index++) {
            updatePool(poolTokens.at(index));
        }
    }


    /// @dev Bring reward variables of given pool current
    /// @param _token Pool token
    function updatePool(address _token)
        public
        poolExists(_token)
    {
        ElevationPoolInfo storage pool = poolInfo[_token];

        // Early exit if the pool is already current
        if (pool.lastRewardTimestamp == block.timestamp) return;

        // Early exit if pool not launched, not live, or supply is 0
        // Timestamp still updated before exit to prevent over emission on return to live
        if (!pool.launched || pool.supply == 0 || !pool.live) {
            pool.lastRewardTimestamp = block.timestamp;
            return;
        }

        // Mint Summit according to time delta, pools token share and elevation, and tokens allocation share
        uint256 summitReward = cartographer.mintPoolSummit(pool.lastRewardTimestamp, pool.token, elevation);

        // Update accSummitPerShare with amount of summit minted for pool
        pool.accSummitPerShare += summitReward * 1e12 / pool.supply;
        
        // Update the overall pool summit rewards for the round (used in winnings multiplier at end of round)
        pool.roundRewards += summitReward;

        // Update each totem's summit rewards for the round (used in winnings multiplier at end of round)
        for (uint8 i = 0; i < pool.totemRoundRewards.length; i++) {
            pool.totemRoundRewards[i] += summitReward * pool.totemSupplies[i] / pool.supply;
        }     

        // Update last reward timestamp   
        pool.lastRewardTimestamp = block.timestamp;
    }
    




    // ---------------------------------------
    // --   P O O L   R E W A R D S
    // ---------------------------------------


    /// @dev Fetch claimable yield rewards amount of the pool
    /// @param _token Pool token to fetch rewards from
    /// @param _userAdd User requesting rewards info
    /// @return claimableRewards - Amount of Summit available to claim
    function claimableRewards(address _token, address _userAdd)
        public view
        onlyCartographer poolExists(_token) validUserAdd(_userAdd)
        returns (uint256)
    {
        ElevationPoolInfo storage pool = poolInfo[_token];
        UserInfo storage user = userInfo[_token][_userAdd];

        // Return claimable winnings
        return _claimableWinnings(pool, user, _userAdd);
    }



    /// @dev The hypothetical rewards, and the hypothetical winnings from a given pool
    /// @param _token Pool token to check
    /// @param _userAdd User to check
    /// @return (
    ///     hypotheticalYield - The yield from staking, which has been risked during the current round
    ///     hypotheticalWinnings - If the user were to win the round, what their winnings would be based on:
    ///         . user's staking yield
    ///         . staking yield of each totem over the round
    ///         . staking yield of the entire pool over the round
    /// )
    function hypotheticalRewards(address _token, address _userAdd)
        public view
        poolExists(_token) validUserAdd(_userAdd)
        returns (uint256, uint256)
    {
        ElevationPoolInfo memory pool = poolInfo[_token];
        UserInfo storage user = userInfo[_token][_userAdd];

        // Allows hypothetical rewards calls to succeed even if the user isn't staked - frontend optimization
        if (user.staked == 0) return (0, 0);

        uint8 totem = _getUserTotem(_userAdd);
        
        // Calculate current accSummitPerShare, and the emission to bring the pool current
        (uint256 accSummitPerShare, uint256 emissionToBringCurrent) = liveAccSummitPerShare(pool);

        // Get hypothetical yield (what the user would have earned if this was standard staking) with brought current accSummitPerShare
        uint256 yield = hypotheticalYield(pool, user, accSummitPerShare);

        // Calculate current roundRewards and totemRoundRewards with the emission to bring current
        // User totem round rewards are the round rewards of the user's selected totem
        (uint256 roundRewards, uint256 userTotemRoundRewards) = liveRoundRewards(_token, totem, emissionToBringCurrent);

        // Escape early to prevent div by 0 if no yield exists
        if (yield == 0 || userTotemRoundRewards == 0) return (0, 0);

        // Return hypotheticalYield, hypotheticalWinnings
        return (
            yield,
            userTotemRoundRewards > 0 ? (yield * roundRewards / userTotemRoundRewards) : yield
        );
    }


    /// @dev Calculates the accSummitPerShare if the pool was brought current and awarded summit emissions
    /// @param pool Elevation pool
    /// @return (
    ///     liveAccSummitPerShare - What the current accSummitPerShare of the pool would be if brought current
    ///     summitEmission - The awarded emission to the pool that would bring it current
    /// )
    function liveAccSummitPerShare(ElevationPoolInfo memory pool)
        internal view
        returns (uint256, uint256)
    {
        // Calculate emission to bring the pool up to date
        uint256 emissionToBringCurrent = emissionToBringPoolCurrent(pool);

        // Calculate the new accSummitPerShare with the emission to bring current, and return both values
        return (pool.accSummitPerShare + (emissionToBringCurrent * 1e12 / pool.supply), emissionToBringCurrent);
    }


    /// @dev The staking rewards that would be earned during the current round under standard staking conditions
    /// @param pool Pool info
    /// @param user User info
    /// @param accSummitPerShare Is brought current before call
    function hypotheticalYield(ElevationPoolInfo memory pool, UserInfo storage user, uint256 accSummitPerShare)
        internal view
        returns (uint256)
    {
        uint256 currRound = elevationHelper.roundNumber(elevation);
        return user.prevInteractedRound == currRound ?

            // Change in accSummitPerShare from current timestamp to users previous interaction timestamp (factored into user.roundDebt)
            (user.staked * accSummitPerShare / 1e12) - user.roundDebt + user.roundRew :

            // Change in accSummitPerShare from current timestamp to beginning of round's timestamp (stored in previous round's endAccRewPerShare)
            user.staked * (accSummitPerShare - poolRoundInfo[pool.token][currRound - 1].endAccSummitPerShare) / 1e12;
    }


    /// @dev Brings the pool's round rewards, and the user's selected totem's round rewards current
    ///      Round rewards are the total amount of yield generated by a pool over the duration of a round
    ///      totemRoundRewards is the total amount of yield generated by the funds staked in each totem of the pool
    /// @param _token Pool token identifier
    /// @param _totem User's selected totem to bring current
    /// @param _emissionToBringCurrent The emission that would be granted if the pool was brought current, used to increment the round rewards of the pool and each totem
    /// @return (
    ///     liveRoundRewards - The brought current round rewards of the pool
    ///     liveUserTotemRoundRewards - The brought current round rewards of the user's selected totem
    /// )
    function liveRoundRewards(address _token, uint8 _totem, uint256 _emissionToBringCurrent)
        internal view
        poolExists(_token)
        returns (uint256, uint256)
    {
        ElevationPoolInfo storage pool = poolInfo[_token];

        return (
            // Round rewards with the total emission to bring current added
            pool.roundRewards + _emissionToBringCurrent,

            // Calculate user's totem's round rewards
            pool.supply == 0 || pool.totemSupplies[_totem] == 0 ? 
                
                // Early exit with current round rewards of user's totem if pool or user's totem has 0 supply (would cause div/0 error)
                pool.totemRoundRewards[_totem] :

                // Add the proportion of total emission that would be granted to the user's selected totem to that totem's round rewards
                // Proportion of total emission earned by each totem is (totem's staked supply / pool's staked supply)
                pool.totemRoundRewards[_totem] + (((_emissionToBringCurrent * 1e12 * pool.totemSupplies[_totem]) / pool.supply) / 1e12)
        );
    }





    // ------------------------------------------------------------------
    // --   R O L L O V E R   E L E V A T I O N   R O U N D
    // ------------------------------------------------------------------
    
    
    /// @dev Sums the total rewards and winning totem rewards from each pool and determines the elevations winnings multiplier, then rolling over all active pools
    function rollover()
        external override
        onlyCartographer
    {
        uint256 currRound = elevationHelper.roundNumber(elevation);
        uint8 winningTotem = elevationHelper.winningTotem(elevation, currRound - 1);


        // Iterate through active pools of elevation, sum total rewards earned (all totems), and winning totems's rewards
        uint256 elevTotalRewards = 0;
        uint256 winningTotemRewards = 0;
        for (uint16 index = 0; index < activePools.length(); index++) {
            // Bring pool current
            updatePool(activePools.at(index));

            // Add round rewards of pool and winning totem to elevation round reward accumulators
            elevTotalRewards += poolInfo[activePools.at(index)].roundRewards;
            winningTotemRewards += poolInfo[activePools.at(index)].totemRoundRewards[winningTotem];
        }

        // Calculate the winnings multiplier of the round that just ended from the combined reward amounts
        uint256 elevWinningsMult = winningTotemRewards == 0 ? 0 : elevTotalRewards * 1e12 / winningTotemRewards;
        roundWinningsMult[currRound - 1] = elevWinningsMult;

        // Update and rollover all active pools
        for (uint16 index = 0; index < activePools.length(); index++) {
            // Rollover Pool
            rolloverPool(activePools.at(index), currRound - 1, elevWinningsMult);
        }
    }
    
    
    /// @dev Roll over a single pool and create a new poolRoundInfo entry
    /// @param _token Pool to roll over
    /// @param _prevRound Round index of the round that just ended
    /// @param _winningsMultiplier Winnings mult of the winning totem based on rewards of entire elevation
    function rolloverPool(address _token, uint256 _prevRound, uint256 _winningsMultiplier)
        internal
    {
        ElevationPoolInfo storage pool = poolInfo[_token];

        // Remove pool from active pool list if it has been marked for removal
        if (!pool.live && pool.active) _markPoolActive(pool, false);

        // Launch pool if it hasn't been, early exit since it has no earned rewards before launch
        if (!pool.launched) {
            pool.launched = true;
            if (pool.live) cartographer.setIsTokenEarningAtElevation(pool.token, elevation, true);
            return;
        }

        // The change in accSummitPerShare from the end of the previous round to the end of the current round
        uint256 deltaAccSummitPerShare = pool.accSummitPerShare - poolRoundInfo[_token][_prevRound - 1].endAccSummitPerShare;

        // Add Winnings to multiplier of winning totem
        pool.totemRunningPrecomputedMult[elevationHelper.winningTotem(elevation, _prevRound - 1)] += deltaAccSummitPerShare * _winningsMultiplier / 1e12;

        // Adding a new entry to the pool's poolRoundInfo for the most recently closed round
        poolRoundInfo[_token][_prevRound] = RoundInfo({
            endAccSummitPerShare: pool.accSummitPerShare,
            winningsMultiplier: _winningsMultiplier,
            precomputedFullRoundMult: deltaAccSummitPerShare * _winningsMultiplier / 1e12
        });

        // Resetting round reward accumulators to begin accumulating over the next round
        pool.roundRewards = 0;
        pool.totemRoundRewards = new uint256[](elevationHelper.totemCount(elevation));
    }
    


    

    // ------------------------------------------------------------
    // --   W I N N I N G S   C A L C U L A T I O N S 
    // ------------------------------------------------------------


    /// @dev Totem precomputed multiplier for a pool round
    /// @param pool Pool info
    /// @param _totem Totem to determine winnings change
    /// @param _roundIndex Round to determine delta for
    function totemPrecomputedMultForRound(ElevationPoolInfo storage pool, uint8 _totem, uint256 _roundIndex)
        internal view
        returns (uint256)
    {
        // Early escape if round lost
        if (_totem != elevationHelper.winningTotem(elevation, _roundIndex)) return 0;

        // Round won, so poolRoundInfo delta is for requested totem
        return poolRoundInfo[pool.token][_roundIndex].precomputedFullRoundMult;
    }
    
    
    /// @dev Calculation of round rewards of the first round interacted
    /// @param user Users staking info
    /// @param round Passed in instead of used inline in this function to prevent stack too deep error
    /// @param _totem Totem to determine if round was won and winnings warranted
    /// @return Winnings from round
    function userFirstInteractedRoundWinnings(UserInfo storage user, RoundInfo memory round, uint8 _totem)
        internal view
        returns (uint256)
    {
        if (_totem != elevationHelper.winningTotem(elevation, user.prevInteractedRound)) return 0;

        return ((user.staked * round.endAccSummitPerShare / 1e12) - user.roundDebt + user.roundRew) * round.winningsMultiplier / 1e12;
    }


    /// @dev Calculation of winnings that are available to be claimed
    /// @param pool Pool info
    /// @param user UserInfo
    /// @param _userAdd User's address passed through for win check
    /// @return Total claimable winnings for a user, including vesting on previous round's winnings (if any)
    function _claimableWinnings(ElevationPoolInfo storage pool, UserInfo storage user, address _userAdd)
        internal view
        returns (uint256)
    {
        uint256 currRound = elevationHelper.roundNumber(elevation);
        uint256 claimable = 0;

        // Exit early if no previous round exists to have winnings
        if (!pool.launched) return claimable;

        // If user interacted in current round, any claimable winnings will come only from reVestedWinnings from previous round
        if (user.prevInteractedRound == currRound) return claimable;

        uint8 totem = _getUserTotem(_userAdd);

        // Get winnings from first user interacted round if it was won
        claimable += userFirstInteractedRoundWinnings(user, poolRoundInfo[pool.token][user.prevInteractedRound], totem);

        // Escape early if user interacted during previous round
        if (user.prevInteractedRound == currRound - 1) return claimable;

        // Add multiple rounds of precomputed mult delta for all rounds between first interacted and most recent round
        claimable += user.staked * (pool.totemRunningPrecomputedMult[totem] - user.winningsDebt) / 1e12;

        return claimable;
    }
    


    

    // ------------------------------------------------------------
    // --   W I N N I N G S   I N T E R A C T I O N S
    // ------------------------------------------------------------
    
    /// @dev Emergency Withdraw reset user
    /// @param pool Pool info
    /// @param _userAdd USer's address used for redeeming rewards and checking for if rounds won
    function _emergencyWithdrawResetUser(ElevationPoolInfo storage pool, address _userAdd) internal {
        userInfo[pool.token][_userAdd] = UserInfo({
            roundRew: 0,
            staked: 0,
            roundDebt: 0,
            winningsDebt: 0,
            prevInteractedRound: 0
        });
    }
    
    /// @dev Claim any available winnings, and 
    /// @param pool Pool info
    /// @param user User info
    /// @param _userAdd USer's address used for redeeming rewards and checking for if rounds won
    function _claimWinnings(ElevationPoolInfo storage pool, UserInfo storage user, address _userAdd)
        internal
        returns (uint256)
    {
        // Get user's winnings available for claim
        uint256 claimable = _claimableWinnings(pool, user, _userAdd);

        // Claim winnings if any available
        if (claimable > 0) {
            cartographer.claimWinnings(_userAdd, claimable);
        }

        return claimable;
    }


    /// @dev Update the users round interaction
    /// @param pool Pool info
    /// @param user User info
    /// @param _totem Users selected totem
    /// @param _amount Amount depositing / withdrawing
    /// @param _isDeposit Flag to differentiate deposit / withdraw
    function _updateUserRoundInteraction(ElevationPoolInfo storage pool, UserInfo storage user, uint8 _totem, uint256 _amount, bool _isDeposit)
        internal
    {
        uint256 currRound = elevationHelper.roundNumber(elevation);

        // User already interacted this round, update the current round reward by adding staking rewards between two interactions this round
        if (user.prevInteractedRound == currRound) {
            user.roundRew += (user.staked * pool.accSummitPerShare / 1e12) - user.roundDebt;

        // User has no staked value, create a fresh round reward
        } else if (user.staked == 0) {
            user.roundRew = 0;

        // User interacted in some previous round, create a fresh round reward based on the current staked amount's staking rewards from the beginning of this round to the current point
        } else {
            // The accSummitPerShare at the beginning of this round. This is known to exist because a user has already interacted in a previous round
            uint256 roundStartAccSummitPerShare = poolRoundInfo[pool.token][currRound - 1].endAccSummitPerShare;

            // Round rew is the current staked amount * delta accSummitPerShare from the beginning of the round until now
            user.roundRew = user.staked * (pool.accSummitPerShare - roundStartAccSummitPerShare) / 1e12;
        }
        
        // Update the user's staked amount with either the deposit or withdraw amount
        if (_isDeposit) user.staked += _amount;
        else user.staked -= _amount;
        
        // Fresh calculation of round debt from the new staked amount
        user.roundDebt = user.staked * pool.accSummitPerShare / 1e12;

        // Acc Winnings Per Share of the user's totem
        user.winningsDebt = pool.totemRunningPrecomputedMult[_totem];

        // Update the user's previous interacted round to be this round
        user.prevInteractedRound = currRound;
    }

    


    

    // ------------------------------------------------------------
    // --   E L E V A T I O N   T O T E M S
    // ------------------------------------------------------------


    /// @dev Increments or decrements user's pools at elevation staked, and adds to  / removes from users list of staked pools
    function _markUserInteractingWithPool(address _token, address _userAdd, bool _interacting) internal {
        require(!_interacting || userInteractingPools[_userAdd].length() < 12, "Staked pool cap (12) reached");

        if (_interacting) {
            userInteractingPools[_userAdd].add(_token);
        } else {
            userInteractingPools[_userAdd].remove(_token);
        }
    }
    
    
    /// @dev All funds at an elevation share a totem. This function allows switching staked funds from one totem to another
    /// @param _totem New target totem
    /// @param _userAdd User requesting switch
    function switchTotem(uint8 _totem, address _userAdd)
        external override
        nonReentrant onlyCartographer validTotem(_totem) validUserAdd(_userAdd) elevationTotemSelectionAvailable
    {
        uint8 prevTotem = _getUserTotem(_userAdd);

        // Early exit if totem is same as current
        require(!_totemSelected(_userAdd) || prevTotem != _totem, "Totem must be different");

        // Iterate through pools the user is interacting with and update totem
        uint256 claimable = 0;
        for (uint8 index = 0; index < userInteractingPools[_userAdd].length(); index++) {
            claimable += switchTotemForPool(userInteractingPools[_userAdd].at(index), prevTotem, _totem, _userAdd);
        }

        // Update user's totem in state
        userElevationInfo[_userAdd].totem = _totem;
        userElevationInfo[_userAdd].totemSelected = true;
        userElevationInfo[_userAdd].totemSelectionRound = elevationHelper.roundNumber(elevation);
    }


    /// @dev Switch users funds (if any staked) to the new totem
    /// @param _token Pool identifier
    /// @param _prevTotem Totem the user is leaving
    /// @param _newTotem Totem the user is moving to
    /// @param _userAdd User doing the switch
    function switchTotemForPool(address _token, uint8 _prevTotem, uint8 _newTotem, address _userAdd)
        internal
        returns (uint256)
    {
        UserInfo storage user = userInfo[_token][_userAdd];
        ElevationPoolInfo storage pool = poolInfo[_token];

        uint256 claimable = _unifiedClaim(
            pool,
            user,
            _userAdd
        );

        // Transfer supply and round rewards from previous totem to new totem
        pool.totemSupplies[_prevTotem] -= user.staked;
        pool.totemSupplies[_newTotem] += user.staked;
        pool.totemRoundRewards[_prevTotem] -= user.roundRew;
        pool.totemRoundRewards[_newTotem] += user.roundRew;

        return claimable;
    }
    


    

    // ------------------------------------------------------------
    // --   P O O L   I N T E R A C T I O N S
    // ------------------------------------------------------------


    /// @dev User interacting with pool getter
    /// User.staked checks if the user has any funds in the pool
    /// User.roundRew will only be > 0 after an interaction if the user has any rewards contributed to the pot during a round
    /// If any of the 3 are true, then the user still has interactions other than 'deposit' that can be meaningfully called on the pool
    /// User.reVestAmt will only be > 0 if the user has any remaining amount of winnings that can be withdrawn
    /// User.reVestAmt will only be > 0 if the user has any remaining amount of winnings that can be withdrawn
    /// This is used to keep `userElevInteractingPools` up to date for switchTotem and claimElevation
    /// This is also used on the frontend (through public wrapper) to boost the sort order of pools the user is interacting with
    function _userInteractingWithPool(UserInfo storage user)
        internal view
        returns (bool)
    {
        return (user.staked + user.roundRew + user.reVestAmt) > 0;
    }
    function userInteractingWithPool(address _token, address _userAdd) public view poolExists(_token) returns (bool) {
        return userInteractingPools[_userAdd].contains(_token);
    }



    /// @dev Claim an entire elevation's winnings
    /// @param _userAdd User claiming
    function claimElevation(address _userAdd)
        external override
        validUserAdd(_userAdd) elevationInteractionsAvailable onlyCartographer
        returns (uint256)
    {

        // Claim rewards of users active pools
        uint256 claimable = 0;

        // Iterate through pools the user is interacting, get claimable amount, update pool
        for (uint8 index = 0; index < userInteractingPools[_userAdd].length(); index++) {
            // Claim winnings
            claimable += _unifiedClaim(
                poolInfo[userInteractingPools[_userAdd].at(index)],
                userInfo[userInteractingPools[_userAdd].at(index)][_userAdd],
                _userAdd
            );
        }

        // Claim available winnings
        if (claimable > 0) {
            cartographer.claimRewards(_userAdd, claimable);
        }
        
        return claimable;
    }

    
    /// @dev Wrapper around cartographer token management on deposit
    function _depositTokenManagement(address _token, uint256 _amount, address _userAdd)
        internal
        returns (uint256)
    {
        return cartographer.depositTokenManagement(_userAdd, _token, _amount);
    }

    function _depositValidate(address _token, address _userAdd)
        internal view
        userHasSelectedTotem(_userAdd) poolExistsAndLaunched(_token) validUserAdd(_userAdd) elevationInteractionsAvailable
    { return; }

    
    /// @dev Stake funds in a yield multiplying elevation pool
    /// @param _token Pool to stake in
    /// @param _amount Amount to stake
    /// @param _userAdd User wanting to stake
    /// @param _isElevate Whether this is the deposit half of an elevate tx
    /// @return Amount deposited after deposit fee taken
    function deposit(address _token, uint256 _amount, address _userAdd, bool _isElevate)
        external override
        nonReentrant onlyCartographer
        returns (uint256)
    {
        // User has selected their totem, pool exists, user is valid, elevation is open for interactions
        _depositValidate(_token, _userAdd);

        // Claim earnings from pool
        _unifiedClaim(
            poolInfo[_token],
            userInfo[_token][_userAdd],
            _userAdd
        );

        // Deposit amount into pool
        return _unifiedDeposit(
            poolInfo[_token],
            userInfo[_token][_userAdd],
            _amount,
            _userAdd,
            _isElevate
        );
    }


    /// @dev Emergency withdraw without rewards
    /// @param _token Pool to emergency withdraw from
    /// @param _userAdd User emergency withdrawing
    /// @return Amount emergency withdrawn
    function emergencyWithdraw(address _token, address _userAdd)
        external override
        nonReentrant onlyCartographer poolExists(_token) validUserAdd(_userAdd)
        returns (uint256)
    {
        return _unifiedWithdraw(
            poolInfo[_token],
            userInfo[_token][_userAdd],
            userInfo[_token][_userAdd].staked,
            _userAdd,
            false,
            true
        );
    }


    /// @dev Withdraw staked funds from pool
    /// @param _token Pool to withdraw from
    /// @param _amount Amount to withdraw
    /// @param _userAdd User withdrawing
    /// @param _isElevate Whether this is the withdraw half of an elevate tx
    /// @return True amount withdrawn
    function withdraw(address _token, uint256 _amount, address _userAdd, bool _isElevate)
        external override
        nonReentrant onlyCartographer poolExists(_token) validUserAdd(_userAdd) elevationInteractionsAvailable
        returns (uint256)
    {
        // Claim earnings from pool
        _unifiedClaim(
            poolInfo[_token],
            userInfo[_token][_userAdd],
            _userAdd
        );

        // Withdraw amount from pool
        return _unifiedWithdraw(
            poolInfo[_token],
            userInfo[_token][_userAdd],
            _amount,
            _userAdd,
            _isElevate,
            false
        );
    }


    /// @dev Claim winnings from a pool
    /// @param pool ElevationPoolInfo of pool to withdraw from
    /// @param user UserInfo of withdrawing user
    /// @param _userAdd User address
    /// @return Amount claimable
    function _unifiedClaim(ElevationPoolInfo storage pool, UserInfo storage user, address _userAdd)
        internal
        returns (uint256)
    {
        updatePool(pool.token);

        // Get claimable amount or claim available winnings
        uint256 claimable = _claimWinnings(pool, user, _userAdd);

        // Update the users round interaction, may be updated again in the same tx, but must be updated here to maintain state
        _updateUserRoundInteraction(pool, user, _getUserTotem(_userAdd), 0, true);

        // Update users pool interaction status, may be updated again in the same tx, but must be updated here to maintain state
        _markUserInteractingWithPool(pool.token, _userAdd, _userInteractingWithPool(user));

        // Return amount claimed / claimable
        return claimable;
    }


    /// @dev Internal shared deposit functionality for elevate or standard deposit
    /// @param pool Pool info of pool to deposit into
    /// @param user UserInfo of depositing user
    /// @param _amount Amount to deposit
    /// @param _userAdd User address
    /// @param _isInternalTransfer Flag to switch off certain functionality for elevate deposit
    /// @return Amount deposited after fee taken
    function _unifiedDeposit(ElevationPoolInfo storage pool, UserInfo storage user, uint256 _amount, address _userAdd, bool _isInternalTransfer)
        internal
        returns (uint256)
    {
        updatePool(pool.token);
        uint8 totem = _getUserTotem(_userAdd);

        uint256 amountAfterFee = _amount;

        // Take deposit fee and add to running supplies if amount is non zero
        if (_amount > 0) {

            // Only take deposit fee on standard deposit
            if (!_isInternalTransfer)
                amountAfterFee = _depositTokenManagement(pool.token, _amount, _userAdd);

            // Adding staked amount to running supply accumulators
            pool.totemSupplies[totem] += amountAfterFee;
            pool.supply += amountAfterFee;
        }
        
        // Update / create users interaction with the pool
        _updateUserRoundInteraction(pool, user, totem, amountAfterFee, true);

        // Update users pool interaction status
        _markUserInteractingWithPool(pool.token, _userAdd, _userInteractingWithPool(user));

        // Return true amount deposited in pool
        return amountAfterFee;
    }


    /// @dev Withdraw functionality shared between standardWithdraw and elevateWithdraw
    /// @param pool Pool to withdraw from
    /// @param user UserInfo of withdrawing user
    /// @param _amount Amount to withdraw
    /// @param _userAdd User address
    /// @param _isInternalTransfer Flag to switch off certain functionality for elevate withdraw
    /// @param _isEmergencyWithdraw Flag to bypass emissions
    /// @return Amount withdrawn
    function _unifiedWithdraw(ElevationPoolInfo storage pool, UserInfo storage user, uint256 _amount, address _userAdd, bool _isInternalTransfer, bool _isEmergencyWithdraw)
        internal
        returns (uint256)
    {
        // Validate amount attempting to withdraw
        require(_amount > 0 && user.staked >= _amount, "Bad withdrawal");
        
        updatePool(pool.token);
        uint8 totem = _getUserTotem(_userAdd);

        // Amount to attempt to withdraw
        uint256 amount = _amount; 

        if (_isEmergencyWithdraw) {
            // Withdraw full staked balance
            amount = user.staked;

            // Reset user back to base state
            _emergencyWithdrawResetUser(pool, _userAdd);
        } else {

            // Update the users interaction in the pool
            _updateUserRoundInteraction(pool, user, totem, amount, false);
        }
        
        // Signal cartographer to perform withdrawal function if not elevating funds
        // Elevated funds remain in the cartographer, or in the passthrough target, so no need to withdraw from anywhere as they would be immediately re-deposited
        uint256 amountAfterFee = amount;
        if (!_isInternalTransfer) {
            amountAfterFee = cartographer.withdrawalTokenManagement(_userAdd, pool.token, amount);
        }

        // Remove withdrawn amount from pool's running supply accumulators
        pool.totemSupplies[totem] -= amount;
        pool.supply -= amount;

        // If the user is interacting with this pool after the meat of the transaction completes
        _markUserInteractingWithPool(pool.token, _userAdd, _userInteractingWithPool(user));

        // Return amount withdraw
        return amountAfterFee;
    }
}
