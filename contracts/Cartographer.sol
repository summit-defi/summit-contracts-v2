// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
import "./CartographerOasis.sol";
import "./CartographerElevation.sol";
import "./ElevationHelper.sol";
import "./SummitReferrals.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IPassthrough.sol";
import "./SummitToken.sol";
import "./libs/ILiquidityPair.sol";


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
--   S U M M I T   E C O S Y S T E M
---------------------------------------------------------------------------------------------


The Cartographer is the anchor of the summit ecosystem
The Cartographer is also the owner of the SUMMIT token


Features of the Summit Ecosystem
    - Cross pool compounding (Compound your winnings, even if they're not from the SUMMIT pool. Cross pool compounding vesting winnings locks them from withdrawl for the remainder of the round)
    - Standard Yield Farming (oasis farms mirror standard farms)

    - Yield Multiplying (yield is put into a pot, which allows winning of other user's yield reward)
    - Multiple elevations (2X elevation, 5X elevation, 10X elevation)
    - Shared token allocation (reward allocation is split by elevation multiplier and amount staked at elevation, to guarantee more rewards at higher elevation)
    - Reward vesting (No large dumps of SUMMIT token on wins)
    - Elevating (Deposit once, update strategy without paying fee)

    - Passthrough Strategy (to fund expeditions, on oasis and elevation farms)
    - Expedition (weekly drawings for summit holders to earn stablecoins and other high value tokens)

    - Random number generation immune to Block Withholding Attack through open source webserver
    - Stopwatch functionality through open source webserver
    
    - Referrals (
        . No limit to number of users referred
        . 1% bonus of each referred user's SUMMIT rewards
        . 1% bonus of own SUMMIT rewards if you have been referred
      )
    - Automatic unclaimed referral rewards burns

*/

contract Cartographer is Ownable, Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;



    // ---------------------------------------
    // --   V A R I A B L E S
    // ---------------------------------------

    SummitToken public summit;
    ILiquidityPair public summitLp;
    bool public enabled = false;                                                // Whether the ecosystem has been enabled for earning

    uint256 public rolloverRewardInNativeToken = 5e18;                          // Amount of native token which will be rewarded for rolling over a round (will be converted into summit and minted)

    address public devAdd;                                                      // Treasury address, see docs for spend breakdown
    address public expedAdd;                                                    // Expedition Treasury address, intermediate address to convert to stablecoins
    address public trustedSeederAdd;                                            // Address that seeds the random number generation every 2 hours
    ElevationHelper elevationHelper;
    SummitReferrals summitReferrals;
    ISubCart cartographerOasis;
    ISubCart cartographerElevation;

    uint8 constant OASIS = 0;
    uint8 constant TWOTHOUSAND = 1;
    uint8 constant FIVETHOUSAND = 2;
    uint8 constant TENTHOUSAND = 3;

    uint256 public launchTimestamp = 1641028149;                                // 2022-1-1, will be updated when summit ecosystem switched on
    uint256 public summitPerSecond;                                             // Amount of Summit minted per second to be distributed to users
    uint256 public devSummitPerSecond;                                          // Amount of Summit minted per second to the treasury
    uint256 public referralsSummitPerSecond;                                    // Amount of Summit minted per second as referral rewards

    uint16[] public poolIds;                                                    // List of all pool identifiers (PIDs)
    mapping(uint16 => uint8) public poolElevation;                              // Elevation map for each pool

    mapping(IERC20 => address) public tokenPassthroughStrategy;                 // Passthrough strategy of each stakable token

    uint256 public totalSharedAlloc = 0;                                        // Total allocation points: sum of all allocation points in all pools.
    mapping(IERC20 => bool) public tokenAllocExistence;                         // Whether an allocation has been created for a specific token
    address[] tokensWithAllocation;                                             // List of Token Addresses that have been assigned an allocation
    mapping(IERC20 => uint256) public tokenBaseAlloc;                           // A tokens underlying allocation, which is modulated for each elevation
    mapping(IERC20 => uint256) public tokenSharedAlloc;                         // Sum of the tokens modulated allocations across enabled elevations

    mapping(IERC20 => mapping(uint8 => uint16)) public tokenElevationPid;       // Pool identifier for a token at an elevation
    mapping(IERC20 => mapping(uint8 => bool)) public tokenElevationIsEarning;   // If a token is earning SUMMIT at a specific elevation






    // ---------------------------------------
    // --   E V E N T S
    // ---------------------------------------

    event TokenAllocCreated(address indexed token, uint256 alloc);
    event TokenAllocUpdated(address indexed token, uint256 alloc);
    event PoolCreated(uint16 indexed pid, uint8 elevation, address token);
    event PoolUpdated(uint16 indexed pid, bool live, uint256 depositFee, uint256 elevation);
    event CrossCompound(address indexed user, uint16 indexed harvestPid, uint16 indexed crossCompoundPid, uint256 amount);
    event Deposit(address indexed user, uint16 indexed pid, uint256 amount);
    event HarvestElevation(address indexed user, uint8 indexed elevation, bool crossCompound, uint256 totalHarvested);
    event Rollover(address indexed user, uint256 elevation);
    event RolloverReferral(address indexed user);
    event SwitchTotem(address indexed user, uint8 indexed elevation, uint8 totem);
    event Elevate(address indexed user, uint16 indexed currentPid, uint16 indexed newPid, uint8 totem, uint256 amount);
    event Withdraw(address indexed user, uint16 indexed pid, uint256 amount);
    event RedeemRewards(address indexed user, uint256 amount);
    event SetExpeditionTreasuryAddress(address indexed user, address indexed newAddress);
    event SetTreasuryAddress(address indexed user, address indexed newAddress);
    event SetTrustedSeederAddress(address indexed user, address indexed newAddress);
    event PassthroughStrategySet(address indexed token, address indexed passthroughStrategy);
    event PassthroughStrategyRetired(address indexed token, address indexed passthroughStrategy);






    // ---------------------------------------
    // --  A D M I N I S T R A T I O N
    // ---------------------------------------


    /// @dev Constructor simply setting addresses on creation
    constructor(
        address _devAdd,
        address _expedAdd,
        address _trustedSeederAdd
    ) public {
        devAdd = _devAdd;
        expedAdd = _expedAdd;
        trustedSeederAdd = _trustedSeederAdd;

        // The first PID is left empty
        poolIds.push(0);
    }

    /// @dev Initialize, simply setting addresses, these contracts need the Cartographer address so it must be separate from the constructor
    function initialize(
        SummitToken _summit,
        ILiquidityPair _summitLp,
        address _ElevationHelper,
        address _SummitReferrals,
        address _CartographerOasis,
        address _CartographerElevation
    )
        external
        initializer onlyOwner
    {
        require(
            address(_summit) != address(0) &&
            address(_summitLp) != address(0) &&
            _ElevationHelper != address(0) &&
            _SummitReferrals != address(0) &&
            _CartographerOasis != address(0) &&
            _CartographerElevation != address(0),
            "Contract is zero"
        );
        require(_summitLp.token0() == address(_summit) || _summitLp.token1() == address(_summit), "SUMMITLP is not SUMMIT liq pair");

        summit = _summit;
        summitLp = _summitLp;

        elevationHelper = ElevationHelper(_ElevationHelper);
        elevationHelper.setTrustedSeederAdd(trustedSeederAdd);
        summitReferrals = SummitReferrals(_SummitReferrals);
        cartographerOasis = ISubCart(_CartographerOasis);
        cartographerElevation = ISubCart(_CartographerElevation);

        // Initialize the subCarts with the address of elevationHelper
        cartographerElevation.initialize(address(elevationHelper), address(_summit), address(_summitLp));

        // Initial value of summit minting
        setTotalSummitPerSecond(25e16);
    }


    /// @dev Enabling the summit ecosystem with the true summit token, turning on farming
    function enable() external onlyOwner {
        // Prevent multiple instances of enabling
        require(!enabled, "Already enabled");
        enabled = true;

        // Setting and propagating the true summit address and launch timestamp
        launchTimestamp = block.timestamp;
        elevationHelper.enable(launchTimestamp);
        summitReferrals.enable(address(summit));
        cartographerOasis.enable(launchTimestamp);
    }


    /// @dev Updating the dev address, can only be called by the current dev address
    /// @param _devAdd New dev address
    function setDevAdd(address _devAdd) public {
        require(_devAdd != address(0), "Missing address");
        require(msg.sender == devAdd, "Forbidden");

        devAdd = _devAdd;
        emit SetTreasuryAddress(msg.sender, _devAdd);
    }


    /// @dev Updating the expedition accumulator address
    /// @param _expedAdd New expedition accumulator address
    function setExpedAdd(address _expedAdd) public onlyOwner {
        require(_expedAdd != address(0), "Missing address");
        expedAdd = _expedAdd;
        emit SetExpeditionTreasuryAddress(msg.sender, _expedAdd);
    }

    /// @dev Update the amount of native token equivalent to reward for rolling over a round
    function setRolloverRewardInNativeToken(uint256 _reward) public onlyOwner {
        require(_reward < 10e18, "Exceeds max reward");
        rolloverRewardInNativeToken = _reward;
    }

    /// @dev Updating the trusted seeder address, can only be called by the owner
    /// @param _trustedSeederAdd New trustedSeeder address
    function setTrustedSeederAdd(address _trustedSeederAdd) public onlyOwner {
        require(_trustedSeederAdd != address(0), "Missing address");

        trustedSeederAdd = _trustedSeederAdd;
        elevationHelper.setTrustedSeederAdd(_trustedSeederAdd);
        emit SetTrustedSeederAddress(msg.sender, _trustedSeederAdd);
    }

    /// @dev Updating the total emission of the ecosystem
    /// @param _amount New total emission
    function setTotalSummitPerSecond(uint256 _amount) public onlyOwner {
        // Require non-zero and less than 1 SUMMIT per second
        require(_amount > 0 && _amount < 1e18, "Invalid emission");

        // New total emission is split into its component parts to save computation costs later
        // 92% goes to staking rewards, of which 2% goes to referrals
        summitPerSecond = _amount.mul(92).div(100).mul(98).div(100);
        referralsSummitPerSecond = _amount.mul(92).div(100).mul(2).div(100);
        devSummitPerSecond = _amount.mul(8).div(100);
    }

    /// @dev Updating the emission split profile
    /// @param _staking How much is reserved for staking
    /// @param _dev How much is reserved for the devs
    function setSummitDistributionProfile(uint256 _staking, uint256 _dev) public onlyOwner {
        // Require dev emission less than 25% of total emission
        require(_staking < 10000 && _dev < 10000 && _dev.mul(3) < _staking, "Invalid Distribution Profile");

        // Total amount of shares passed in is irrelevant, they are summed
        uint256 totalShares = _staking.add(_dev);
        // Total emission summed from component parts
        uint256 totalEmission = summitPerSecond.add(devSummitPerSecond).add(referralsSummitPerSecond);

        summitPerSecond = totalEmission.mul(_staking).div(totalShares).mul(98).div(100);
        referralsSummitPerSecond = totalEmission.mul(_staking).div(totalShares).mul(2).div(100);
        devSummitPerSecond = totalEmission.mul(_dev).div(totalShares);
    }






    // -----------------------------------------------------------------
    // --   M O D I F I E R S (Many are split to save contract size)
    // -----------------------------------------------------------------

    function _onlySubCartographer(address _add) internal view {
        require(_add == address(cartographerOasis) || _add == address(cartographerElevation), "Only subCarts");
    }
    modifier onlySubCartographer() {
        _onlySubCartographer(msg.sender);
        _;
    }

    function _nonDuplicated(IERC20 _token, uint8 _elevation) internal view {
        require(tokenElevationPid[_token][_elevation] == 0, "Duplicated");
    }
    modifier nonDuplicated(IERC20 _token, uint8 _elevation) {
        _nonDuplicated(_token, _elevation);
        _;
    }

    modifier nonDuplicatedTokenAlloc(IERC20 _token) {
        require(tokenAllocExistence[_token] == false, "Duplicated token alloc");
        _;
    }
    modifier tokenAllocExists(IERC20 _token) {
        require(tokenAllocExistence[_token] == true, "Invalid token alloc");
        _;
    }
    modifier validAllocation(uint256 _allocation) {
        require(_allocation >= 0 && _allocation <= 10000, "Allocation must be <= 100X");
        _;
    }

    function _poolExists(uint16 _pid) internal view {
        require(_pid > 0 && _pid < poolIds.length, "Pool doesnt exist");

    }
    modifier poolExists(uint16 _pid) {
        _poolExists(_pid);
        _;
    }

    // Elevation validation with min and max elevations (inclusive)
    function _validElev(uint8 _elevation, uint8 _minElev, uint8 _maxElev) internal pure {
        require(_elevation >= _minElev && _elevation <= _maxElev, "Invalid elev");
    }
    modifier isOasisOrElevation(uint8 _elevation) {
        _validElev(_elevation, 0, 3);
        _;
    }
    modifier isElevation(uint8 _elevation) {
        _validElev(_elevation, 1, 3);
        _;
    }





    // ---------------------------------------
    // --   U T I L S (inlined for brevity)
    // ---------------------------------------

    /// @dev Total number of pools
    function poolsCount() external view returns (uint256) {
        return poolIds.length;
    }

    /// @dev Amount staked in a pool
    function stakedSupply(uint16 _pid) public view poolExists(_pid) returns (uint256) {
        return subCartographer(poolElevation[_pid]).supply(_pid);
    }

    /// @dev Token of a pool
    /// @param _pid Pool of token
    function token(uint16 _pid) public view returns (IERC20) {
        return subCartographer(poolElevation[_pid]).token(_pid);
    }

    /// @dev Deposit fee of a pool
    function depositFee(uint16 _pid) public view poolExists(_pid) returns (uint256) {
        return subCartographer(poolElevation[_pid]).depositFee(_pid);
    }

    /// @dev Whether a pool is earning SUMMIT or not
    function isEarning(uint16 _pid) public view returns (bool) {
        return subCartographer(poolElevation[_pid]).isEarning(_pid);
    }

    /// @dev A users totem information at an elevation
    /// @return (
    ///     totemInUse - Whether the user has any funds staked with a totem
    ///     selectedTotem - The totem the user has selected
    /// )
    function userTotem(uint8 _elevation, address _userAdd) public view returns (bool, uint8) {
        return (
            subCartographer(_elevation).isTotemInUse(_elevation, _userAdd),
            subCartographer(_elevation).selectedTotem(_elevation, _userAdd)
        );
    }

    /// @dev Timestamp when a round of an elevation ends
    function roundEndTimestamp(uint8 _elevation) public view isElevation(_elevation) returns(uint256) {
        return elevationHelper.roundEndTimestamp(_elevation);
    }





    // ---------------------------------------------------------------
    // --   S U B   C A R T O G R A P H E R   S E L E C T O R
    // ---------------------------------------------------------------

    function subCartographer(uint8 _elevation) internal view returns (ISubCart) {
        require(_elevation >= 0 && _elevation <= 4, "Invalid elev");
        return _elevation == 0 ?
            cartographerOasis :
            cartographerElevation;
    }





    // ---------------------------------------
    // --   T O K E N   A L L O C A T I O N
    // ---------------------------------------


    /// @dev Create a new base allocation for a token. Required before a pool for that token is created
    /// @param _token Token to create allocation for
    /// @param _allocation Allocation shares awarded to token
    function createTokenAllocation(IERC20 _token, uint256 _allocation)
        public
        onlyOwner nonDuplicatedTokenAlloc(_token) validAllocation(_allocation)
    {
        // Token is marked as having an existing allocation
        tokenAllocExistence[_token] = true;
        tokensWithAllocation.push(address(_token));

        // Token's base allocation is set to the passed in value
        tokenBaseAlloc[_token] = _allocation;

        // Creating an allocation happens before any pools are created, so the shared allocation is 0 at present
        // No shared allocation needs to be added to the total allocation yet
        tokenSharedAlloc[_token] = 0;

        emit TokenAllocCreated(address(_token), _allocation);
    }

    /// @dev Update the allocation for a token. This modifies existing allocations for that token
    /// @param _token Token to update allocation for
    /// @param _allocation Updated allocation
    function setTokenSharedAlloc(IERC20 _token, uint256 _allocation)
        public
        onlyOwner tokenAllocExists(_token)  validAllocation(_allocation)
    {
        // Recalculates the total shared allocation for the token
        //   Each elevation may already be live, so the shared allocation is the sum of the modulated base allocation at each live elevation
        uint256 updatedSharedAlloc = _allocation.mul(
            (tokenElevationIsEarning[_token][OASIS] ? 100 : 0) +
            (tokenElevationIsEarning[_token][TWOTHOUSAND] ? 110 : 0) +
            (tokenElevationIsEarning[_token][FIVETHOUSAND] ? 125 : 0) +
            (tokenElevationIsEarning[_token][TENTHOUSAND] ? 150 : 0)
        );

        // The current shared allocation of the token is removed from the total allocation across all tokens
        // The new shared allocation is then added back in
        totalSharedAlloc = totalSharedAlloc.sub(tokenSharedAlloc[_token]).add(updatedSharedAlloc);

        // Base and shared allocations are updated
        tokenSharedAlloc[_token] = updatedSharedAlloc;
        tokenBaseAlloc[_token] = _allocation;
        emit TokenAllocUpdated(address(_token), _allocation);
    }


    /// @dev Register pool at elevation as live, add to shared alloc
    /// @param _token Token of the pool
    /// @param _elevation Elevation of the pool
    /// @param _isEarning Whether token is earning SUMMIT at elevation
    function setIsTokenEarningAtElevation(IERC20 _token, uint8 _elevation, bool _isEarning)
        external
        onlySubCartographer
    {
        // Fetches the modulated allocation for this token at elevation
        uint256 modAllocPoint = elevationHelper.elevationModulatedAllocation(tokenBaseAlloc[_token], _elevation);

        // Add / Remove the new allocation to the token's shared allocation
        tokenSharedAlloc[_token] = tokenSharedAlloc[_token]
            .add(_isEarning ? modAllocPoint : 0)
            .sub(_isEarning ? 0 : modAllocPoint);

        // Add / Remove the new allocation to the total shared allocation
        totalSharedAlloc = totalSharedAlloc
            .add(_isEarning ? modAllocPoint : 0)
            .sub(_isEarning ? 0 : modAllocPoint);

        // Mark the pool as earning
        tokenElevationIsEarning[_token][_elevation] = _isEarning;
    }


    /// @dev Sets the passthrough strategy for a given token
    /// @param _token Token passthrough strategy applies to
    /// @param _passthroughStrategy Address of the new passthrough strategy
    function setTokenPassthroughStrategy(IERC20 _token, address _passthroughStrategy)
        public
        onlyOwner
    {
        // Validate that the strategy exists and tokens match
        require(_passthroughStrategy != address(0), "Passthrough strategy missing");
        require(address(IPassthrough(_passthroughStrategy).token()) == address(_token), "Token doesnt match passthrough strategy");

        _enactTokenPassthroughStrategy(_token, _passthroughStrategy);
    }


    /// @dev Retire passthrough strategy and return tokens to this contract
    /// @param _token Token whose passthrough strategy to remove
    function retireTokenPassthroughStrategy(IERC20 _token)
        public
        onlyOwner
    {
        require(tokenPassthroughStrategy[_token] != address(0), "No passthrough strategy to retire");
        address retiredTokenPassthroughStrategy = tokenPassthroughStrategy[_token];
        _retireTokenPassthroughStrategy(_token);

        emit PassthroughStrategyRetired(address(_token), retiredTokenPassthroughStrategy);
    }


    function _enactTokenPassthroughStrategy(IERC20 _token, address _passthroughStrategy)
        internal
    {
        // If strategy already exists for this pool, retire from it
        _retireTokenPassthroughStrategy(_token);

        // Deposit funds into new passthrough strategy
        IPassthrough(_passthroughStrategy).token().approve(_passthroughStrategy, uint256(-1));
        IPassthrough(_passthroughStrategy).enact();

        // Set token passthrough strategy in state
        tokenPassthroughStrategy[_token] = _passthroughStrategy;

        emit PassthroughStrategySet(address(_token), _passthroughStrategy);
    }


    /// @dev Internal functionality of retiring a passthrough strategy
    function _retireTokenPassthroughStrategy(IERC20 _token) internal {
        // Early exit if token doesn't have passthrough strategy
        if(tokenPassthroughStrategy[_token] == address(0)) return;

        IPassthrough(tokenPassthroughStrategy[_token]).retire(expedAdd, devAdd);
        tokenPassthroughStrategy[_token] = address(0);
    }





    // ---------------------------------------
    // --   P O O L   M A N A G E M E N T
    // ---------------------------------------


    /// @dev Registers all existences of a pool (inlined for brevity)
    /// @param _token Token of pool
    /// @param _elevation Elevation of pool
    /// @return Pid of newly registered pool
    function registerPool(IERC20 _token, uint8 _elevation) internal returns (uint16) {
        uint16 pid = uint16(poolIds.length);
        poolIds.push(pid);
        poolElevation[pid] = _elevation;
        tokenElevationPid[_token][_elevation] = pid;
        return pid;
    }


    /// @dev Creates a new pool for a token at a specific elevation
    /// @param _token Token to create the pool for
    /// @param _elevation The elevation to create this pool at
    /// @param _live Whether the pool is available for staking (independent of rounds / elevation constraints)
    /// @param _feeBP Fee for pool, max 1% is reserved for withdraw, rest is taken on deposit
    /// @param _withUpdate Whether to update all pools during this transaction
    function add(IERC20 _token, uint8 _elevation, bool _live, uint16 _feeBP, bool _withUpdate)
        public
        onlyOwner tokenAllocExists(_token) isOasisOrElevation(_elevation) nonDuplicated(_token, _elevation)
    {
        // Deposit fees will never be higher than 4%
        require(_feeBP <= 400, "Invalid fee");

        // Mass update if required
        if (_withUpdate) {
            massUpdatePools();
        }

        // Get the next available pool identifier and register pool
        uint16 pid = registerPool(_token, _elevation);

        // Create the pool in the appropriate sub cartographer
        subCartographer(_elevation).add(pid, _elevation, _live, _token, _feeBP);

        emit PoolCreated(pid, _elevation, address(_token));
    }


    /// @dev Update pool's live status and deposit fee
    /// @param _pid Pool identifier
    /// @param _live Whether staking is permitted on this pool
    /// @param _feeBP Percentage fee on deposit / withdrawal
    /// @param _withUpdate whether to update all pools as part of this transaction
    function set(uint16 _pid, bool _live, uint16 _feeBP, bool _withUpdate)
        public
        onlyOwner isOasisOrElevation(poolElevation[_pid]) poolExists(_pid)
    {
        require(_feeBP <= 400, "Invalid fee");

        // Mass update if required
        if (_withUpdate) {
            massUpdatePools();
        }

        // Updates the pool in the correct subcartographer
        // If the pool's live status changes, it will be funneled back to the cartographer in <enable|disabled>TokenAtElevation above
        subCartographer(poolElevation[_pid]).set(_pid, _live, _feeBP);

        emit PoolUpdated(_pid, _live, _feeBP, poolElevation[_pid]);
    }


    /// @dev Does what it says on the box
    function massUpdatePools() public {
        cartographerOasis.massUpdatePools();
        cartographerElevation.massUpdatePools();
    }





    // ---------------------------------------
    // --   P O O L   R E W A R D S
    // ---------------------------------------


    /// @dev The rewards breakdown earned by users in a given pool
    /// @param _pid Pool to check
    /// @param _userAdd User to check
    /// @return (
    ///     harvestableWinnings - Winnings the user has available to withdraw
    ///     vestingWinnings - Winnings the user has available to withdraw
    ///     vestingDuration - Total duration of the vesting period (used mostly for testing, not needed for frontend)
    ///     vestingStart - When the current vesting period started (used mostly for testing, not needed for frontend)
    /// )
    function rewards(uint16 _pid, address _userAdd)
        public view
        poolExists(_pid)
        returns (uint256, uint256, uint256, uint256)
    {
        return subCartographer(poolElevation[_pid]).rewards(_pid, _userAdd);
    }


    /// @dev The hypothetical rewards, and the hypothetical winnings from a given pool
    /// @param _pid Pool to check
    /// @param _userAdd User to check
    /// @return (
    ///     hypotheticalYield - The yield from staking, which has been risked during the current round
    ///     hypotheticalWinnings - If the user were to win the round, what their winnings would be based on:
    ///         . user's staking yield
    ///         . staking yield of each totem over the round
    ///         . staking yield of the entire pool over the round
    /// )
    function hypotheticalRewards(uint16 _pid, address _userAdd)
        public view
        poolExists(_pid)
        returns (uint256, uint256)
    {
        return subCartographer(poolElevation[_pid]).hypotheticalRewards(_pid, _userAdd);
    }





    // ------------------------------------------------------------------
    // --   R O L L O V E R   E L E V A T I O N   R O U N D
    // ------------------------------------------------------------------


    /// @dev Summit amount given as reward for rollover
    function rolloverRewardSummit() internal {
        (uint256 reserve0, uint256 reserve1,) = summitLp.getReserves();
        uint256 summitReserve = summitLp.token0() == address(summit) ? reserve0 : reserve1;
        uint256 nativeReserve = summitLp.token0() == address(summit) ? reserve1 : reserve0;
        if (rolloverRewardInNativeToken == 0 || nativeReserve == 0) return;
        summit.mintTo(msg.sender, rolloverRewardInNativeToken.mul(summitReserve).div(nativeReserve));
    }


    /// @dev Rolling over a round for an elevation and selecting winning totem.
    ///      Called by the webservice, but can also be called manually by any user (as failsafe)
    /// @param _elevation Elevation to rollover
    function rollover(uint8 _elevation)
        public
        isElevation(_elevation)
    {
        // Ensure that the elevation is ready to be rolled over, ensures only a single user can perform the rollover
        elevationHelper.validateRolloverAvailable(_elevation);

        // Selects the winning totem for the round, storing it in the elevationHelper contract
        elevationHelper.selectWinningTotem(_elevation);

        // Update the round index in the elevationHelper, effectively starting the next round of play
        elevationHelper.rolloverElevation(_elevation);

        // Rollover active pools at the elevation
        subCartographer(_elevation).rollover(_elevation);

        // Give SUMMIT rewards to user that executed the rollover
        rolloverRewardSummit();

        emit Rollover(msg.sender, _elevation);
    }





    // -----------------------------------------------------
    // --   S U M M I T   E M I S S I O N
    // -----------------------------------------------------


    /// @dev Returns the time elapsed between two timestamps
    function timeDiffSeconds(uint256 _from, uint256 _to) public pure returns (uint256) {
        return _to.sub(_from);
    }

    /// @dev Returns the modulated allocation of a token at elevation, escaping early if the pool is not live
    /// @param _pid Pool identifier
    /// @return True allocation of the pool at elevation
    function elevationModulatedAllocation(uint16 _pid) public view returns (uint256) {
        // Escape early if the pool is not currently earning SUMMIT
        if (!isEarning(_pid)) { return 0; }

        // Fetch the modulated base allocation for the token at elevation
        return elevationHelper.elevationModulatedAllocation(tokenBaseAlloc[token(_pid)], poolElevation[_pid]);
    }


    /// @dev Shares of a token at elevation
    /// (@param _token, @param _elevation) Together identify the pool to calculate
    function tokenElevationShares(IERC20 _token, uint8 _elevation) internal view returns (uint256) {
        // Escape early if the pool is not currently earning SUMMIT
        if (tokenElevationPid[_token][_elevation] == 0) return 0;

        // Gas Saver: This overlaps with same line in elevationModulatedAllocation, however elevationModulatedAllocation needs to be accurate independently for the frontend
        if (!isEarning(tokenElevationPid[_token][_elevation])) return 0;

        return stakedSupply(tokenElevationPid[_token][_elevation])
            .mul(elevationModulatedAllocation(tokenElevationPid[_token][_elevation]));
    }

    /// @dev The share of the total token at elevation emission awarded to the pool
    ///      Tokens share allocation to ensure that staking at higher elevation ALWAYS has higher APY
    ///      This is done to guarantee a higher ROI at higher elevations over a long enough time span
    ///      The allocation of each pool is based on the elevation, as well as the staked supply at that elevation
    /// @param _token The token (+ elevation) to evaluate emission for
    /// @param _elevation The elevation (+ token) to evaluate emission for
    /// @return The share of emission granted to the pool, raised to 1e12
    function tokenElevationEmissionMultiplier(IERC20 _token, uint8 _elevation)
        public view
        returns (uint256)
    {
        // Shares for all elevation are summed. For each elevation the shares are calculated by:
        //   . The staked supply of the pool at elevation multiplied by
        //   . The modulated allocation of the pool at elevation
        uint256 totalTokenShares = tokenElevationShares(_token, OASIS)
            .add(tokenElevationShares(_token, TWOTHOUSAND))
            .add(tokenElevationShares(_token, FIVETHOUSAND))
            .add(tokenElevationShares(_token, TENTHOUSAND));

        // Escape early if nothing is staked in any of the token's pools
        if (totalTokenShares == 0) { return 0; }

        // Divide the target pool (token + elevation) shares by total shares (as calculated above)
        return tokenElevationShares(_token, _elevation).mul(1e12).div(totalTokenShares);
    }


    /// @dev Uses the tokenElevationEmissionMultiplier along with timeDiff and token allocation to calculate the overall emission multiplier of the pool
    /// @param _lastRewardTimestamp Calculate the difference to determine emission event count
    /// (@param _token, @param elevation) Pool identifier for calculation
    /// @return Share of overall emission granted to the pool, raised to 1e12
    function poolEmissionMultiplier(uint256 _lastRewardTimestamp, IERC20 _token, uint8 _elevation)
        internal view
        returns (uint256)
    {
        // Escape early if no total allocation exists
        if (totalSharedAlloc == 0) { return 0; }

        // Calculate overall emission granted over time span, calculated by:
        //   . Time difference from last reward timestamp
        //   . Tokens allocation as a fraction of total allocation
        //   . Pool's emission multiplier
        return timeDiffSeconds(_lastRewardTimestamp, block.timestamp).mul(1e12)
            .mul(tokenSharedAlloc[_token]).div(totalSharedAlloc)
            .mul(tokenElevationEmissionMultiplier(_token, _elevation)).div(1e12);
    }


    /// @dev Uses poolEmissionMultiplier along with staking summit emission to calculate the pools summit emission over the time span
    /// @param _lastRewardTimestamp Used for time span
    /// (@param _token, @param _elevation) Pool identifier
    /// @return emission of SUMMIT, not raised to any power
    function poolSummitEmission(uint256 _lastRewardTimestamp, IERC20 _token, uint8 _elevation)
        external view
        onlySubCartographer
        returns (uint256)
    {
        // Escape early if no time has passed
        if (_lastRewardTimestamp == block.timestamp) { return 0; }

        // Emission multiplier multiplied by summitPerSecond, finally reducing back to true exponential
        return poolEmissionMultiplier(_lastRewardTimestamp, _token, _elevation)
            .mul(summitPerSecond).div(1e12);
    }


    /// @dev Mints the total emission of pool and split respectively to destinations
    /// @param _lastRewardTimestamp Used for time span
    /// (@param _token, @param _elevation) Pool identifier
    /// @return only staking SUMMIT yield component of emission, not raised to any power
    function mintPoolSummit(uint256 _lastRewardTimestamp, IERC20 _token, uint8 _elevation)
        external
        onlySubCartographer
        returns (uint256)
    {
        uint256 emissionMultiplier = poolEmissionMultiplier(_lastRewardTimestamp, _token, _elevation);

        // Mint summit to all destinations accordingly
        summit.mintTo(devAdd, emissionMultiplier.mul(devSummitPerSecond).div(1e12));
        summit.mintTo(address(summitReferrals), emissionMultiplier.mul(referralsSummitPerSecond).div(1e12));
        summit.mintTo(address(this), emissionMultiplier.mul(summitPerSecond).div(1e12));

        // This return value is used by pools to divy shares, and doesn't need the referrals or dev components included
        return emissionMultiplier.mul(summitPerSecond).div(1e12);
    }





    // -----------------------------------------------------
    // --   S W I T C H   T O T E M
    // -----------------------------------------------------


    /// @dev All funds at an elevation share a totem. This function allows switching staked funds from one totem to another
    /// @param _elevation Elevation to switch totem on
    /// @param _totem New target totem
    function switchTotem(uint8 _elevation, uint8 _totem)
        public
        nonReentrant isElevation(_elevation)
    {
        // Totem must be less than the totem count of the elevation
        require(_totem < elevationHelper.totemCount(_elevation), "Invalid totem");

        // Executes the totem switch in the correct subcartographer
        subCartographer(_elevation).switchTotem(_elevation, _totem, msg.sender);

        emit SwitchTotem(msg.sender, _elevation, _totem);
    }





    // -----------------------------------------------------
    // --   P O O L   I N T E R A C T I O N S
    // -----------------------------------------------------


    /// @dev Helper function for getting the cross compound pool pid for a given elevation
    function getCrossCompoundPid(uint8 _elevation) internal view returns (uint16) {
        require(tokenElevationPid[summit][_elevation] != 0, "No cross compound target found");
        require(token(tokenElevationPid[summit][_elevation]) == summit, "Cross compound pool must be SUMMIT");
        return tokenElevationPid[summit][_elevation];
    }


    /// @dev Stake funds with a pool, is also used to harvest with a deposit of 0
    /// @param _pid Pool identifier
    /// @param _amount Amount to stake
    /// @param _totem Totem to deposit with, must match existing totem if anything staked at the elevation already
    function deposit(uint16 _pid, uint256 _amount, uint8 _totem)
        public
        nonReentrant poolExists(_pid)
    {
        // Validates that the totem is available at the elevation
        uint8 elevation = poolElevation[_pid];
        require(elevation == OASIS || _totem < elevationHelper.totemCount(poolElevation[_pid]), "Invalid totem");

        // Executes the deposit in the sub cartographer
        uint256 amountAfterFee = subCartographer(elevation).deposit(_pid, _amount, _totem, msg.sender);

        emit Deposit(msg.sender, _pid, amountAfterFee);
    }


    /// @dev Harvest all rewards (or cross compound) of an elevation
    /// @param _elevation Elevation to harvest all rewards from
    /// @param _crossCompound Whether to harvest rewards directly into SUMMIT farm at {_elevation}
    function harvestElevation(uint8 _elevation, bool _crossCompound)
        public
        nonReentrant
    {
        // Ensure only being called on elevation farms
        _validElev(_elevation, 1, 3);

        // Get cross compound pid if attempting to cross compound
        uint16 crossCompoundPid = _crossCompound ? getCrossCompoundPid(_elevation) : 0;

        // Harvest across an elevation, return total amount harvested
        uint256 totalHarvested = subCartographer(_elevation).harvestElevation(_elevation, crossCompoundPid, msg.sender);
        
        emit HarvestElevation(msg.sender, _elevation, _crossCompound, totalHarvested);
    }


    /// @dev Withdraw staked funds from a pool
    /// @param _pid Pool identifier
    /// @param _amount Amount to withdraw, must be > 0 and <= staked amount
    function withdraw(uint16 _pid, uint256 _amount)
        public
        nonReentrant poolExists(_pid)
    {
        // Executes the withdrawal in the sub cartographer
        uint256 amountAfterFee = subCartographer(poolElevation[_pid]).withdraw(_pid, _amount, msg.sender);

        emit Withdraw(msg.sender, _pid, amountAfterFee);
    }


    /// @dev Validation step of Elevate into separate function
    function validateElevate(uint16 _sourcePid, uint16 _targetPid, uint256 _amount, IERC20 _token, uint8 _totem)
        internal
        nonReentrant poolExists(_sourcePid) poolExists(_targetPid)
    {
        // Validate that at least some amount is being elevated
        require(_amount > 0, "Transfer non zero amount");

        // Elevating funds must change elevation
        require(poolElevation[_sourcePid] != poolElevation[_targetPid], "Must change elev");

        // Validate target totem exists at elevation
        require(_totem < elevationHelper.totemCount(poolElevation[_targetPid]), "Invalid totem");

        // Validate deposit token
        (bool totemInUse, uint8 selectedTotem) = userTotem(poolElevation[_targetPid], msg.sender);
        require(!totemInUse || selectedTotem == _totem, "Cant switch totem during elevate");

        // Validate pools share same token
        require(token(_sourcePid) == token(_targetPid), "Different token");
    }


    /// @dev Allows funds to be transferred between elevations without forcing users to pay a deposit fee
    /// @param _sourcePid Current pool to withdraw funds from
    /// @param _targetPid Pool to then deposit these funds into
    /// @param _amount Amount of funds to transfer across elevations, must be > 0
    /// @param _token Token to be elevated
    /// @param _totem Totem to deposit funds into in new pool
    function elevate(uint16 _sourcePid, uint16 _targetPid, uint256 _amount, IERC20 _token, uint8 _totem)
        public
    {
        validateElevate(_sourcePid, _targetPid, _amount, _token, _totem);

        // Withdraw {_amount} of {_token} to {_sourcePid} pool
        uint256 elevatedAmount = subCartographer(poolElevation[_sourcePid])
            .elevateWithdraw(
                _sourcePid,
                _amount,
                address(_token),
                msg.sender
            );
        
        // Deposit withdrawn amount of {_token} from source pool {elevatedAmount} into {_targetPid} pool
        elevatedAmount = subCartographer(poolElevation[_targetPid])
            .elevateDeposit(
                _targetPid,
                elevatedAmount,
                address(_token),
                _totem,
                msg.sender
            );

        emit Elevate(msg.sender, _sourcePid, _targetPid, _totem, elevatedAmount);
    }





    // -----------------------------------------------------
    // --   T O K E N   M A N A G E M E N T
    // -----------------------------------------------------

    /// @dev Utility function for depositing tokens into passthrough strategy
    function passthroughDeposit(IERC20 _token, uint256 _amount) internal returns (uint256) {
        if (tokenPassthroughStrategy[_token] == address(0)) return _amount;
        return IPassthrough(tokenPassthroughStrategy[_token]).deposit(_amount, expedAdd, devAdd);
    }

    /// @dev Utility function for withdrawing tokens from passthrough strategy
    /// @param _token Token to withdraw from it's passthrough strategy
    /// @param _amount Amount requested to withdraw
    /// @return The true amount withdrawn from the passthrough strategy after the passthrough's fee was taken (if any)
    function passthroughWithdraw(IERC20 _token, uint256 _amount) internal returns (uint256) {
        if (tokenPassthroughStrategy[_token] == address(0)) return _amount;
        return IPassthrough(tokenPassthroughStrategy[_token]).withdraw(_amount, expedAdd, devAdd);
    }

    /// @dev Utility function to transfer Summit
    function safeSummitTransfer(address _to, uint256 _amount) internal {
        uint256 summitBal = summit.balanceOf(address(this));
        bool transferSuccess = false;
        if (_amount > summitBal) {
            transferSuccess = summit.transfer(_to, summitBal);
        } else {
            transferSuccess = summit.transfer(_to, _amount);
        }
        require(transferSuccess, "SafeSummitTransfer: failed");
    }


    /// @dev Utility function to handle harvesting Summit rewards with referral rewards
    function redeemRewards(address _userAdd, uint256 _amount) external onlySubCartographer {
        // Transfers rewards to user
        safeSummitTransfer(_userAdd, _amount);

        // If the user has been referred, add the 1% bonus to that user and their referrer
        summitReferrals.addReferralRewardsIfNecessary(_userAdd, _amount);

        emit RedeemRewards(_userAdd, _amount);
    }


    /// @dev Takes the deposit fee where applicable
    /// @param _token Token to take fee out of
    /// @param _feeBP Fee to take
    /// @param _amount Deposit amount to take fee from
    /// @return Amount deposited after fee
    function takeDepositFee(IERC20 _token, uint256 _feeBP, uint256 _amount)
        internal
        returns (uint256)
    {
        uint256 trueFee = _feeBP <= 50 ? 0 : _feeBP - 50;
        if (trueFee == 0) return _amount;

        // Calculate deposit fee
        uint256 _depositFee = _amount.mul(trueFee).div(10000);

        // Half of deposit fee is sent to expedition accumulator, other half sent to devs
        uint256 _depositFeeHalf = _depositFee.div(2);
        _token.safeTransfer(expedAdd, _depositFeeHalf);
        _token.safeTransfer(devAdd, _depositFeeHalf);
        return _amount.sub(_depositFee);
    }


    /// @dev Transfers funds from user on deposit
    /// @param _userAdd Depositing user
    /// @param _token Token to deposit
    /// @param _feeBP Deposit fee if applicable
    /// @param _amount Deposit amount before fee
    /// @return Deposit amount after fee
    function depositTokenManagement(address _userAdd, IERC20 _token, uint256 _feeBP, uint256 _amount)
        external
        onlySubCartographer
        returns (uint256)
    {
        // Transfers total deposit amount
        _token.safeTransferFrom(_userAdd, address(this), _amount);

        // Takes deposit fee within cartographer if no passthrough strategy
        uint256 amountAfterFee = takeDepositFee(_token, _feeBP, _amount);

        // Deposits into passthrough target, if there are any passthrough strategy fees (shouldn't be any), they are taken
        amountAfterFee = passthroughDeposit(_token, amountAfterFee);


        return amountAfterFee;
    }


    /// @dev Takes the remaining withdrawal fee (difference between total withdrawn amount and the amount expected to be withdrawn after the remaining fee)
    /// @param _token Token to withdraw
    /// @param _amount Funds above the amount after remaining withdrawal fee that was returned from the passthrough strategy
    function takeWithdrawFeeAmount(IERC20 _token, uint256 _amount)
        internal
    {
        _token.safeTransfer(devAdd, _amount.div(2));
        _token.safeTransfer(expedAdd, _amount.div(2));
    }

    /// @dev Transfers funds to user on withdraw
    /// @param _userAdd Withdrawing user
    /// @param _token Token to withdraw
    /// @param _feeBP The overall pool fee, 1% of which is taken on withdrawal
    /// @param _amount Withdraw amount
    /// @return Amount withdrawn after fee
    function withdrawalTokenManagement(address _userAdd, IERC20 _token, uint256 _feeBP, uint256 _amount)
        external
        onlySubCartographer
        returns (uint256)
    {
        // Withdraw full amount from passthrough (if any), if there is a fee that isn't covered by the increase in vault value this may be less than expected full amount
        uint256 amountAfterFee = passthroughWithdraw(_token, _amount);

        // Amount user expects to receive after fee taken
        uint256 remainingFee = _feeBP > 50 ? 50 : _feeBP;
        uint256 expectedWithdrawnAmount = _amount.mul(uint256(10000).sub(remainingFee)).div(10000);

        // Take any remaining fee (gap between what was actually withdrawn, and what the user expects to receive)
        if (amountAfterFee > expectedWithdrawnAmount) {
            takeWithdrawFeeAmount(_token, amountAfterFee.sub(expectedWithdrawnAmount));
            amountAfterFee = expectedWithdrawnAmount;
        }

        // Transfer funds back to user
        _token.safeTransfer(_userAdd, amountAfterFee);

        return amountAfterFee;
    }





    // -----------------------------------------------------
    // --   R E F E R R A L S
    // -----------------------------------------------------


    /// @dev Roll over referral round and burn unclaimed referral rewards
    function rolloverReferral()
        public
    {
        // Validate that a referral burn is unlocked
        elevationHelper.validateReferralBurnAvailable();

        // Burn unclaimed rewards and rollover round
        summitReferrals.burnUnclaimedReferralRewardsAndRolloverRound(msg.sender);

        // Rollover round number in elevation helper
        elevationHelper.rolloverReferralBurn();

        // Give SUMMIT rewards to user that executed the rollover
        rolloverRewardSummit();

        emit RolloverReferral(msg.sender);
    }

    /// @dev Referral burn timestamp for frontend
    function referralBurnTimestamp() public view returns(uint256) {
        return elevationHelper.referralBurnTimestamp();
    }

    /// @dev Safety hatch for referral reward round rollover burning needed summit
    function referralRewardsMintSafetyHatch(uint256 _amount) public {
        // Only callable by summitReferrals contract
        require(msg.sender == address(summitReferrals), "Only Summit Referrals");
        require(_amount > 0, "Non zero");

        summit.mintTo(address(summitReferrals), _amount);
    }
}
