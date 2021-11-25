// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;
import "./CartographerOasis.sol";
import "./CartographerElevation.sol";
import "./ExpeditionV2.sol";
import "./ElevationHelper.sol";
import "./SummitReferrals.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IPassthrough.sol";
import "./SummitToken.sol";
import "./libs/IUniswapV2Pair.sol";
import "./libs/IPriceOracle.sol";




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

    uint8 constant OASIS = 0;
    uint8 constant PLAINS = 1;
    uint8 constant MESA = 2;
    uint8 constant SUMMIT = 3;
    address constant burnAdd = 0x000000000000000000000000000000000000dEaD;


    SummitToken public summit;
    IUniswapV2Pair public summitLp;
    bool public enabled = false;                                                // Whether the ecosystem has been enabled for earning
    IPriceOracle priceOracle;                 

    uint256 public rolloverRewardInNativeToken = 5e18;                          // Amount of native token which will be rewarded for rolling over a round (will be converted into summit and minted)

    address public devAdd;                                                      // Treasury address, see docs for spend breakdown
    address public expedAdd;                                                    // Expedition Treasury address, intermediate address to convert to stablecoins
    address public trustedSeederAdd;                                            // Address that seeds the random number generation every 2 hours
    ElevationHelper elevationHelper;
    SummitReferrals summitReferrals;
    address[4] subCartographers;
    ExpeditionV2 expeditionV2;

    uint256 public launchTimestamp = 1641028149;                                // 2022-1-1, will be updated when summit ecosystem switched on
    uint256 public summitPerSecond;                                             // Amount of Summit minted per second to be distributed to users
    uint256 public devSummitPerSecond;                                          // Amount of Summit minted per second to the treasury
    uint256 public referralsSummitPerSecond;                                    // Amount of Summit minted per second as referral rewards

    uint16[4] public elevationPoolsCount;                                       // List of all pool identifiers (PIDs)

    mapping(address => address) public tokenPassthroughStrategy;                // Passthrough strategy of each stakable token

    uint256[4] public elevAlloc;                                                // Total allocation points of all pools at an elevation
    mapping(address => bool) public tokenAllocExistence;                        // Whether an allocation has been created for a specific token
    mapping(address => uint16) public tokenWithdrawalTax;                       // Fee for all farms of this token
    address[] tokensWithAllocation;                                             // List of Token Addresses that have been assigned an allocation
    mapping(address => uint256) public tokenAlloc;                              // A tokens underlying allocation, which is modulated for each elevation

    mapping(address => mapping(uint8 => bool)) public poolExistence;            // Whether a pool exists for a token at an elevation
    mapping(address => mapping(uint8 => bool)) public tokenElevationIsEarning;  // If a token is earning SUMMIT at a specific elevation

    mapping(address => bool) public isNativeFarmToken;
    mapping(address => mapping(address => uint256)) public nativeFarmTokenLastDepositTimestamp; // Users' last deposit timestamp for native farms

    mapping(address => mapping(address => uint256)) public tokenLastDepositTimestampForTax; // Users' last deposit timestamp for tax
    uint16 public baseMinimumWithdrawalFee = 100;
    uint256 public feeDecayDuration = 7 * 86400;
    uint256 public baseTaxResetOnDepositBP = 500;
    uint256 public nativeTaxResetOnDepositBP = 1000;

    struct UserLockedWinnings {
        uint256 winnings;
        uint256 bonusEarned;
        uint256 claimedWinnings;
    }

    uint8 public yieldLockEpochCount = 5;
    mapping(address => mapping(uint256 => UserLockedWinnings)) public userLockedWinnings;

    mapping(address => bool) public tokenIsNativeFarm;



    // ---------------------------------------
    // --   E V E N T S
    // ---------------------------------------

    event TokenAllocCreated(address indexed token, uint256 alloc);
    event TokenAllocUpdated(address indexed token, uint256 alloc);
    event PoolCreated(address indexed token, uint8 elevation);
    event PoolUpdated(address indexed token, uint8 elevation, bool live);
    event Deposit(address indexed user, address indexed token, uint8 indexed elevation, uint256 amount);
    event ClaimElevation(address indexed user, uint8 indexed elevation, uint256 totalHarvested);
    event Rollover(address indexed user, uint256 elevation);
    event RolloverReferral(address indexed user);
    event SwitchTotem(address indexed user, uint8 indexed elevation, uint8 totem);
    event Elevate(address indexed user, address indexed token, uint8 sourceElevation, uint8 targetElevation, uint256 amount);
    event Withdraw(address indexed user, address indexed token, uint8 indexed elevation, uint256 amount);
    event ClaimWinnings(address indexed user, uint256 amount);
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
    ) {
        devAdd = _devAdd;
        expedAdd = _expedAdd;
        trustedSeederAdd = _trustedSeederAdd;
    }

    /// @dev Initialize, simply setting addresses, these contracts need the Cartographer address so it must be separate from the constructor
    function initialize(
        address _summit,
        address _summitLp,
        address _ElevationHelper,
        address _SummitReferrals,
        address _CartographerOasis,
        address _CartographerPlains,
        address _CartographerMesa,
        address _CartographerSummit,
        address _expeditionV2
    )
        external
        initializer onlyOwner
    {
        require(
            _summit != address(0) &&
            _summitLp != address(0) &&
            _ElevationHelper != address(0) &&
            _SummitReferrals != address(0) &&
            _CartographerOasis != address(0) &&
            _CartographerPlains != address(0) &&
            _CartographerMesa != address(0) &&
            _CartographerSummit != address(0) &&
            _expeditionV2 != address(0),
            "Contract is zero"
        );

        summit = SummitToken(_summit);
        summitLp = IUniswapV2Pair(_summitLp);
        require(summitLp.token0() == address(_summit) || summitLp.token1() == _summit, "SUMMITLP is not SUMMIT liq pair");

        elevationHelper = ElevationHelper(_ElevationHelper);
        elevationHelper.setTrustedSeederAdd(trustedSeederAdd);
        summitReferrals = SummitReferrals(_SummitReferrals);

        subCartographers[OASIS] = _CartographerOasis;
        subCartographers[PLAINS] = _CartographerPlains;
        subCartographers[MESA] = _CartographerMesa;
        subCartographers[SUMMIT] = _CartographerSummit;

        expeditionV2 = ExpeditionV2(_expeditionV2);

        // Initialize the subCarts with the address of elevationHelper
        for (uint8 elevation = OASIS; elevation <= SUMMIT; elevation++) {
            subCartographer(elevation).initialize(_ElevationHelper, address(_summit));
        }

        // Initial value of summit minting
        setTotalSummitPerSecond(15e16);
        summit.approve(burnAdd, type(uint256).max);
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
        subCartographer(OASIS).enable(launchTimestamp);
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
        summitPerSecond = (_amount * 92 / 100) * 98 / 100;
        referralsSummitPerSecond = (_amount * 92 / 100) * 2 / 100;
        devSummitPerSecond = _amount * 8 / 100;
    }

    /// @dev Updating the emission split profile
    /// @param _staking How much is reserved for staking
    /// @param _dev How much is reserved for the treasury
    function setSummitDistributionProfile(uint256 _staking, uint256 _dev) public onlyOwner {
        // Require dev emission less than 25% of total emission
        require(_staking < 10000 && _dev < 10000 && _dev * 3 < _staking, "Invalid Distribution Profile");

        // Total amount of shares passed in is irrelevant, they are summed
        uint256 totalShares = _staking + _dev;
        // Total emission summed from component parts
        uint256 totalEmission = summitPerSecond + devSummitPerSecond + referralsSummitPerSecond;

        summitPerSecond = (totalEmission * _staking / totalShares) * 98 / 100;
        referralsSummitPerSecond = (totalEmission * _staking * totalShares) * 2 / 100;
        devSummitPerSecond = totalEmission * _dev / totalShares;
    }


    /// @dev Update price oracle
    function setPriceOracle(address _priceOracle) public onlyOwner {
        require(_priceOracle != address(0), "Missing oracle");
        priceOracle = IPriceOracle(_priceOracle);
    }






    // -----------------------------------------------------------------
    // --   M O D I F I E R S (Many are split to save contract size)
    // -----------------------------------------------------------------

    function _getTaxBP(address _userAdd, address _token)
        public view
        returns (uint16)
    {
        // Amount user expects to receive after fee taken
        uint16 tokenTax = tokenWithdrawalTax[_token];
        uint16 remainingFee = isNativeFarmToken[_token] ? uint16(0) : baseMinimumWithdrawalFee;
        uint256 timeDiff = block.timestamp - tokenLastDepositTimestampForTax[_userAdd][_token];
        if (tokenTax > baseMinimumWithdrawalFee && timeDiff < feeDecayDuration) {
            remainingFee = baseMinimumWithdrawalFee + uint16(((tokenTax - baseMinimumWithdrawalFee) * (feeDecayDuration - timeDiff) * 1e12 / feeDecayDuration) / 1e12);
        }

        return remainingFee;
    }

    function _bonusBP(address _userAdd, address _token)
        public view
        returns (uint256)
    {
        uint256 bonusBP = 0;
        uint256 nativeFarmTokenLastDepositTimestamp = nativeFarmTokenLastDepositTimestamp[_userAdd][_token];
        if (nativeFarmTokenLastDepositTimestamp > 0 && nativeFarmTokenLastDepositTimestamp + feeDecayDuration > block.timestamp) {
            uint256 timeDiff = block.timestamp - nativeFarmTokenLastDepositTimestamp > feeDecayDuration ? feeDecayDuration : block.timestamp - nativeFarmTokenLastDepositTimestamp;
            bonusBP = (700 * timeDiff * 1e12 / feeDecayDuration) / 1e12;
        }

        return bonusBP;
    }

    function _onlySubCartographer(address _subCartographer) internal view {
        require(
            _subCartographer == subCartographers[OASIS] ||
            _subCartographer == subCartographers[PLAINS] ||
            _subCartographer == subCartographers[MESA] ||
            _subCartographer == subCartographers[SUMMIT],
            "Only subCarts"
        );
    }
    modifier onlySubCartographer() {
        _onlySubCartographer(msg.sender);
        _;
    }

    
    modifier nonDuplicated(address _token, uint8 _elevation) {
        require(!poolExistence[_token][_elevation], "Duplicated");
        _;
    }

    modifier nonDuplicatedTokenAlloc(address _token) {
        require(tokenAllocExistence[_token] == false, "Duplicated token alloc");
        _;
    }
    modifier tokenAllocExists(address _token) {
        require(tokenAllocExistence[_token] == true, "Invalid token alloc");
        _;
    }
    modifier validAllocation(uint256 _allocation) {
        require(_allocation >= 0 && _allocation <= 10000, "Allocation must be <= 100X");
        _;
    }

    function _poolExists(address _token, uint8 _elevation) internal view {
        require(poolExistence[_token][_elevation], "Pool doesnt exist");

    }
    modifier poolExists(address _token, uint8 _elevation) {
        _poolExists(_token, _elevation);
        _;
    }

    // Elevation validation with min and max elevations (inclusive)
    function _validElev(uint8 _elevation, uint8 _minElev, uint8 _maxElev) internal pure {
        require(_elevation >= _minElev && _elevation <= _maxElev, "Invalid elev");
    }
    modifier isOasisOrElevation(uint8 _elevation) {
        _validElev(_elevation, OASIS, SUMMIT);
        _;
    }
    modifier isElevation(uint8 _elevation) {
        _validElev(_elevation, PLAINS, SUMMIT);
        _;
    }

    // Totem
    modifier validTotem(uint8 _elevation, uint8 _totem)  {
        require(_totem < elevationHelper.totemCount(_elevation), "Invalid totem");
        _;
    }





    // ---------------------------------------------------------------
    // --   S U B   C A R T O G R A P H E R   S E L E C T O R
    // ---------------------------------------------------------------

    function subCartographer(uint8 _elevation) internal view returns (ISubCart) {
        require(_elevation >= OASIS && _elevation <= SUMMIT, "Invalid elev");
        return ISubCart(subCartographers[_elevation]);
    }





    // ---------------------------------------
    // --   T O K E N   A L L O C A T I O N
    // ---------------------------------------


    /// @dev Number of existing pools
    function poolsCount()
        public view
        returns (uint256)
    {
        uint256 count = 0;
        for (uint8 elevation = OASIS; elevation <= SUMMIT; elevation++) {
            count += elevationPoolsCount[elevation];
        }
        return count;
    }


    /// @dev Create a new base allocation for a token. Required before a pool for that token is created
    /// @param _token Token to create allocation for
    /// @param _allocation Allocation shares awarded to token
    function createTokenAllocation(address _token, uint256 _allocation)
        public
        onlyOwner nonDuplicatedTokenAlloc(_token) validAllocation(_allocation)
    {
        // Token is marked as having an existing allocation
        tokenAllocExistence[_token] = true;
        tokensWithAllocation.push(_token);

        // Token's base allocation is set to the passed in value
        tokenAlloc[_token] = _allocation;

        emit TokenAllocCreated(_token, _allocation);
    }

    /// @dev Update the allocation for a token. This modifies existing allocations at each elevation for that token
    /// @param _token Token to update allocation for
    /// @param _allocation Updated allocation
    function setTokenAlloc(address _token, uint256 _allocation)
        public
        onlyOwner tokenAllocExists(_token)  validAllocation(_allocation)
    {
        // Update the tokens allocation at the elevations that token is active at
        for (uint8 elevation = OASIS; elevation <= SUMMIT; elevation++) {
            if (tokenElevationIsEarning[_token][elevation]) {
                elevAlloc[elevation] = elevAlloc[elevation] + _allocation - tokenAlloc[_token];
            }
        }

        // Update the token allocation
        tokenAlloc[_token] = _allocation;

        emit TokenAllocUpdated(_token, _allocation);
    }


    /// @dev Register pool at elevation as live, add to shared alloc
    /// @param _token Token of the pool
    /// @param _elevation Elevation of the pool
    /// @param _isEarning Whether token is earning SUMMIT at elevation
    function setIsTokenEarningAtElevation(address _token, uint8 _elevation, bool _isEarning)
        external
        onlySubCartographer
    {
        // Add the new allocation to the token's shared allocation and total allocation
        if (_isEarning) {
            elevAlloc[_elevation] += tokenAlloc[_token];

        // Remove the existing allocation to the token's shared allocation and total allocation
        } else {
            elevAlloc[_elevation] -= tokenAlloc[_token];
        }

        // Mark the pool as earning
        tokenElevationIsEarning[_token][_elevation] = _isEarning;
    }


    /// @dev Sets the passthrough strategy for a given token
    /// @param _token Token passthrough strategy applies to
    /// @param _passthroughStrategy Address of the new passthrough strategy
    function setTokenPassthroughStrategy(address _token, address _passthroughStrategy)
        public
        onlyOwner
    {
        // Validate that the strategy exists and tokens match
        require(_passthroughStrategy != address(0), "Passthrough strategy missing");
        require(address(IPassthrough(_passthroughStrategy).token()) == _token, "Token doesnt match passthrough strategy");

        _enactTokenPassthroughStrategy(_token, _passthroughStrategy);
    }


    /// @dev Retire passthrough strategy and return tokens to this contract
    /// @param _token Token whose passthrough strategy to remove
    function retireTokenPassthroughStrategy(address _token)
        public
        onlyOwner
    {
        console.log("Passthrough Strategy", tokenPassthroughStrategy[_token]);
        require(tokenPassthroughStrategy[_token] != address(0), "No passthrough strategy to retire");
        address retiredTokenPassthroughStrategy = tokenPassthroughStrategy[_token];
        _retireTokenPassthroughStrategy(_token);

        emit PassthroughStrategyRetired(address(_token), retiredTokenPassthroughStrategy);
    }


    function _enactTokenPassthroughStrategy(address _token, address _passthroughStrategy)
        internal
    {
        // If strategy already exists for this pool, retire from it
        _retireTokenPassthroughStrategy(_token);

        // Deposit funds into new passthrough strategy
        IPassthrough(_passthroughStrategy).token().approve(_passthroughStrategy, type(uint256).max);
        IPassthrough(_passthroughStrategy).enact();

        // Set token passthrough strategy in state
        tokenPassthroughStrategy[_token] = _passthroughStrategy;

        emit PassthroughStrategySet(address(_token), _passthroughStrategy);
    }


    /// @dev Internal functionality of retiring a passthrough strategy
    function _retireTokenPassthroughStrategy(address _token) internal {
        // Early exit if token doesn't have passthrough strategy
        if(tokenPassthroughStrategy[_token] == address(0)) return;

        IPassthrough(tokenPassthroughStrategy[_token]).retire(expedAdd, devAdd);
        tokenPassthroughStrategy[_token] = address(0);
    }





    // ---------------------------------------
    // --   P O O L   M A N A G E M E N T
    // ---------------------------------------


    /// @dev Creates a new pool for a token at a specific elevation
    /// @param _token Token to create the pool for
    /// @param _elevation The elevation to create this pool at
    /// @param _live Whether the pool is available for staking (independent of rounds / elevation constraints)
    /// @param _withUpdate Whether to update all pools during this transaction
    function add(address _token, uint8 _elevation, bool _live, bool _withUpdate)
        public
        onlyOwner tokenAllocExists(_token) isOasisOrElevation(_elevation) nonDuplicated(_token, _elevation)
    {

        // Mass update if required
        if (_withUpdate) {
            massUpdatePools();
        }

        // Get the next available pool identifier and register pool
        poolExistence[_token][_elevation] = true;
        elevationPoolsCount[_elevation] += 1;

        // Create the pool in the appropriate sub cartographer
        subCartographer(_elevation).add(_token, _live);

        emit PoolCreated(_token, _elevation);
    }


    /// @dev Update pool's live status and deposit fee
    /// @param _token Pool identifier
    /// @param _elevation Elevation of pool
    /// @param _live Whether staking is permitted on this pool
    /// @param _withUpdate whether to update all pools as part of this transaction
    function set(address _token, uint8 _elevation, bool _live, bool _withUpdate)
        public
        onlyOwner isOasisOrElevation(_elevation) poolExists(_token, _elevation)
    {
        // Mass update if required
        if (_withUpdate) {
            massUpdatePools();
        }

        // Updates the pool in the correct subcartographer
        subCartographer(_elevation).set(_token, _live);

        emit PoolUpdated(_token, _elevation, _live);
    }


    /// @dev Does what it says on the box
    function massUpdatePools() public {
        for (uint8 elevation = OASIS; elevation <= SUMMIT; elevation++) {
            subCartographer(elevation).massUpdatePools();
        }
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
        summit.mint(msg.sender, rolloverRewardInNativeToken * summitReserve / nativeReserve);
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
        subCartographer(_elevation).rollover();

        // Give SUMMIT rewards to user that executed the rollover
        rolloverRewardSummit();

        emit Rollover(msg.sender, _elevation);
    }





    // -----------------------------------------------------
    // --   S U M M I T   E M I S S I O N
    // -----------------------------------------------------


    /// @dev Returns the time elapsed between two timestamps
    function timeDiffSeconds(uint256 _from, uint256 _to) public pure returns (uint256) {
        return _to - _from;
    }

    /// @dev Returns the modulated allocation of a token at elevation, escaping early if the pool is not live
    /// @param _token Tokens allocation
    /// @param _elevation Elevation to modulate
    /// @return True allocation of the pool at elevation
    function elevationModulatedAllocation(address _token, uint8 _elevation) public view returns (uint256) {
        // Escape early if the pool is not currently earning SUMMIT
        if (!tokenElevationIsEarning[_token][_elevation]) { return 0; }

        // Fetch the modulated base allocation for the token at elevation
        return elevationHelper.elevationModulatedAllocation(tokenAlloc[_token], _elevation);
    }


    /// @dev Shares of a token at elevation
    /// (@param _token, @param _elevation) Together identify the pool to calculate
    function tokenElevationShares(address _token, uint8 _elevation) internal view returns (uint256) {
        // Escape early if the pool is not currently earning SUMMIT
        if (!poolExistence[_token][_elevation]) return 0;

        // Gas Saver: This overlaps with same line in elevationModulatedAllocation, however elevationModulatedAllocation needs to be accurate independently for the frontend
        if (!tokenElevationIsEarning[_token][_elevation]) return 0;

        return (
            subCartographer(_elevation).supply(_token) *
            elevationModulatedAllocation(_token, _elevation)
        );
    }

    /// @dev The share of the total token at elevation emission awarded to the pool
    ///      Tokens share allocation to ensure that staking at higher elevation ALWAYS has higher APY
    ///      This is done to guarantee a higher ROI at higher elevations over a long enough time span
    ///      The allocation of each pool is based on the elevation, as well as the staked supply at that elevation
    /// @param _token The token (+ elevation) to evaluate emission for
    /// @param _elevation The elevation (+ token) to evaluate emission for
    /// @return The share of emission granted to the pool, raised to 1e12
    function tokenElevationEmissionMultiplier(address _token, uint8 _elevation)
        public view
        returns (uint256)
    {
        // Shares for all elevation are summed. For each elevation the shares are calculated by:
        //   . The staked supply of the pool at elevation multiplied by
        //   . The modulated allocation of the pool at elevation
        uint256 totalTokenShares = (
            tokenElevationShares(_token, OASIS) +
            tokenElevationShares(_token, PLAINS) +
            tokenElevationShares(_token, MESA) +
            tokenElevationShares(_token, SUMMIT)
        );

        // Escape early if nothing is staked in any of the token's pools
        if (totalTokenShares == 0) { return 0; }

        // Divide the target pool (token + elevation) shares by total shares (as calculated above)
        return tokenElevationShares(_token, _elevation) * 1e12 / totalTokenShares;
    }


    /// @dev Emission multiplier of token based on its allocation
    /// @return Multiplier raised 1e12
    function tokenAllocEmissionMultiplier(address _token)
        public view
        returns (uint256)
    {
        // Sum allocation of all elevations with allocation multipliers
        uint256 tokenTotalAlloc = 0;
        uint256 totalAlloc = 0;
        for (uint8 elevation = OASIS; elevation <= SUMMIT; elevation++) {
            if (tokenElevationIsEarning[_token][elevation]) {
                tokenTotalAlloc += tokenAlloc[_token] * elevationHelper.elevationAllocMultiplier(elevation);
            }
            totalAlloc += elevAlloc[elevation] * elevationHelper.elevationAllocMultiplier(elevation);
        }

        if (totalAlloc == 0) return 0;

        return tokenTotalAlloc * 1e12 / totalAlloc;
    }


    /// @dev Uses the tokenElevationEmissionMultiplier along with timeDiff and token allocation to calculate the overall emission multiplier of the pool
    /// @param _lastRewardTimestamp Calculate the difference to determine emission event count
    /// (@param _token, @param elevation) Pool identifier for calculation
    /// @return Share of overall emission granted to the pool, raised to 1e12
    function poolEmissionMultiplier(uint256 _lastRewardTimestamp, address _token, uint8 _elevation)
        internal view
        returns (uint256)
    {
        // Calculate overall emission granted over time span, calculated by:
        //   . Time difference from last reward timestamp
        //   . Tokens allocation as a fraction of total allocation
        //   . Pool's emission multiplier
        return timeDiffSeconds(_lastRewardTimestamp, block.timestamp) * tokenAllocEmissionMultiplier(_token) * tokenElevationEmissionMultiplier(_token, _elevation) / 1e12;
    }


    /// @dev Uses poolEmissionMultiplier along with staking summit emission to calculate the pools summit emission over the time span
    /// @param _lastRewardTimestamp Used for time span
    /// (@param _token, @param _elevation) Pool identifier
    /// @return emission of SUMMIT, not raised to any power
    function poolSummitEmission(uint256 _lastRewardTimestamp, address _token, uint8 _elevation)
        external view
        onlySubCartographer
        returns (uint256)
    {
        // Escape early if no time has passed
        if (_lastRewardTimestamp == block.timestamp) { return 0; }

        // Emission multiplier multiplied by summitPerSecond, finally reducing back to true exponential
        return poolEmissionMultiplier(_lastRewardTimestamp, _token, _elevation) * summitPerSecond / 1e12;
    }


    /// @dev Mints the total emission of pool and split respectively to destinations
    /// @param _lastRewardTimestamp Used for time span
    /// (@param _token, @param _elevation) Pool identifier
    /// @return only staking SUMMIT yield component of emission, not raised to any power
    function mintPoolSummit(uint256 _lastRewardTimestamp, address _token, uint8 _elevation)
        external
        onlySubCartographer
        returns (uint256)
    {
        uint256 emissionMultiplier = poolEmissionMultiplier(_lastRewardTimestamp, _token, _elevation);

        // Mint summit to all destinations accordingly
        summit.mint(devAdd, emissionMultiplier * devSummitPerSecond / 1e12);
        summit.mint(address(summitReferrals), emissionMultiplier * referralsSummitPerSecond / 1e12);
        summit.mint(address(this), emissionMultiplier * summitPerSecond / 1e12);

        // This return value is used by pools to div shares, and doesn't need the referrals or dev components included
        return emissionMultiplier * summitPerSecond / 1e12;
    }





    // -----------------------------------------------------
    // --   S W I T C H   T O T E M
    // -----------------------------------------------------


    /// @dev All funds at an elevation share a totem. This function allows switching staked funds from one totem to another
    /// @param _elevation Elevation to switch totem on
    /// @param _totem New target totem
    function switchTotem(uint8 _elevation, uint8 _totem)
        public
        nonReentrant isElevation(_elevation) validTotem(_elevation, _totem)
    {
        // Executes the totem switch in the correct subcartographer
        subCartographer(_elevation).switchTotem(_totem, msg.sender);

        emit SwitchTotem(msg.sender, _elevation, _totem);
    }





    // -----------------------------------------------------
    // --   P O O L   I N T E R A C T I O N S
    // -----------------------------------------------------


    /// @dev Users staked amount across all elevations
    function userTokenStakedAmount(address _token)
        public
        returns (uint256)
    {
        return _userTokenStakedAmount(_token, msg.sender);
    }

    function _userTokenStakedAmount(address _token, address _userAdd)
        internal
        returns (uint256)
    {
        uint256 totalStaked = 0;
        for (uint8 elevation = OASIS; elevation <= SUMMIT; elevation++) {
            totalStaked += subCartographer(elevation).userStakedAmount(_token, _userAdd);
        }
        return totalStaked;
    }


    /// @dev Stake funds with a pool, is also used to harvest with a deposit of 0
    /// (@param _token, @param _elevation) Pool identifier
    /// @param _amount Amount to stake
    function deposit(address _token, uint8 _elevation, uint256 _amount)
        public
        nonReentrant poolExists(_token, _elevation)
    {
        // Executes the deposit in the sub cartographer
        uint256 amountAfterFee = subCartographer(_elevation)
            .deposit(
                _token,
                _amount,
                msg.sender,
                false
            );

        // native farm bonus handling
        if (isNativeFarmToken[_token]) {
            if (nativeFarmTokenLastDepositTimestamp[msg.sender][_token] == 0) {
                nativeFarmTokenLastDepositTimestamp[msg.sender][_token] == block.timestamp;
            }
        }

        // tax handling
        uint256 taxResetBP = isNativeFarmToken[_token] ? nativeTaxResetOnDepositBP : baseTaxResetOnDepositBP;
        uint256 staked = subCartographer(_elevation).userStakedAmount(_token, msg.sender);
        if (_amount > (staked * taxResetBP / 10000)) {
            tokenLastDepositTimestampForTax[msg.sender][_token] = block.timestamp;
        }

        emit Deposit(msg.sender, _token, _elevation, amountAfterFee);
    }


    /// @dev Harvest all rewards (or cross compound) of an elevation
    /// @param _elevation Elevation to harvest all rewards from
    function claimElevation(uint8 _elevation)
        public
        nonReentrant isElevation(_elevation)
    {
        // Harvest across an elevation, return total amount harvested
        uint256 totalHarvested = subCartographer(_elevation).claimElevation(msg.sender);
        
        emit ClaimElevation(msg.sender, _elevation, totalHarvested);
    }


    /// @dev Withdraw staked funds from a pool
    /// (@param _token, @param _elevation) Pool identifier
    /// @param _amount Amount to withdraw, must be > 0 and <= staked amount
    function withdraw(address _token, uint8 _elevation, uint256 _amount)
        public
        nonReentrant poolExists(_token, _elevation)
    {
        // Executes the withdrawal in the sub cartographer
        uint256 amountAfterFee = subCartographer(_elevation)
            .withdraw(
                _token,
                _amount,
                msg.sender,
                false
            );

        // native farm bonus handling
        if (isNativeFarmToken[_token]) {
            nativeFarmTokenLastDepositTimestamp[msg.sender][_token] == 0;
        }

        emit Withdraw(msg.sender, _token, _elevation, amountAfterFee);
    }


    /// @dev Validation step of Elevate into separate function
    /// @param _token Token to elevate
    /// @param _sourceElevation Elevation to withdraw from
    /// @param _targetElevation Elevation to deposit into
    /// @param _amount Amount to elevate
    function validateElevate(address _token, uint8 _sourceElevation, uint8 _targetElevation, uint256 _amount)
        internal
        nonReentrant poolExists(_token, _sourceElevation) poolExists(_token, _targetElevation)
    {
        require(_amount > 0, "Transfer non zero amount");
        require(_sourceElevation != _targetElevation, "Must change elev");
        require(
            subCartographer(_sourceElevation).isTotemSelected(msg.sender) &&
            subCartographer(_targetElevation).isTotemSelected(msg.sender),
            "Totem not selected"
        );
    }


    /// @dev Allows funds to be transferred between elevations without forcing users to pay a deposit fee
    /// @param _token Token to elevate
    /// @param _sourceElevation Elevation to withdraw from
    /// @param _targetElevation Elevation to deposit into
    /// @param _amount Amount to elevate
    function elevate(address _token, uint8 _sourceElevation, uint8 _targetElevation, uint256 _amount)
        public
    {
        validateElevate(_token, _sourceElevation, _targetElevation, _amount);

        // Withdraw {_amount} of {_token} from {_sourceElevation} pool
        uint256 elevatedAmount = subCartographer(_sourceElevation)
            .withdraw(
                _token,
                _amount,
                msg.sender,
                true
            );
        
        // Deposit withdrawn amount of {_token} from source pool {elevatedAmount} into {_targetPid} pool
        elevatedAmount = subCartographer(_targetElevation)
            .deposit(
                _token,
                elevatedAmount,
                msg.sender,
                true
            );

        emit Elevate(msg.sender, _token, _sourceElevation, _targetElevation, elevatedAmount);
    }





    // -----------------------------------------------------
    // --   Y I E L D   L O C K
    // -----------------------------------------------------

    /// @dev Update yield lock epoch count
    function setYieldLockEpochCount(uint8 _count)
        public onlyOwner
    {
        require(_count <= 12, "Invalid lock epoch count");
        yieldLockEpochCount = _count;
    }

    /// @dev Get current epoch
    function _getCurrentEpoch()
        internal view
        returns (uint256)
    {
        return block.timestamp / (3600 * 24 * 7);
    }

    /// @dev Test if epoch has matured
    function _hasEpochMatured(uint256 _epoch)
        internal view
        returns (bool)
    {
        return (_getCurrentEpoch() - _epoch) >= yieldLockEpochCount;
    }


    /// @dev Utility function to handle harvesting Summit rewards with referral rewards
    function claimWinnings(address _userAdd, address _token, uint256 _amount) external onlySubCartographer {
        uint256 bonusBP = _bonusBP(_userAdd, _token);
        uint256 amountWithBonus = _amount * (10000 + bonusBP) / 10000;

        UserLockedWinnings storage userEpochWinnings = userLockedWinnings[_userAdd][_getCurrentEpoch()];
        userEpochWinnings.winnings += amountWithBonus;
        userEpochWinnings.bonusEarned += _amount * bonusBP / 10000;

        // If the user has been referred, add the 1% bonus to that user and their referrer
        summitReferrals.addReferralRewardsIfNecessary(_userAdd, _amount);

        emit ClaimWinnings(_userAdd, amountWithBonus);
    }

    /// @dev Harvest locked winnings, 50% tax taken on early harvest
    function harvestWinnings(uint256 _epoch, uint256 _amount, bool _lockForEverest)
        public
        nonReentrant
    {
        UserLockedWinnings storage userEpochWinnings = userLockedWinnings[msg.sender][_epoch];

        // Winnings that haven't yet been claimed
        uint256 unclaimedWinnings = userEpochWinnings.winnings - userEpochWinnings.claimedWinnings;

        // Validate harvest amount
        require(_amount > 0 && _amount <= unclaimedWinnings, "Bad Harvest");

        // Harvest winnings by locking for everest in the expedition
        if (_lockForEverest) {
            expeditionV2.lockClaimableSummit(unclaimedWinnings, msg.sender);

        // Else check if epoch matured, harvest 100% if true, else harvest 50%, burn 25%, and send 25% to expedition contract to be distributed to EVEREST holders
        } else {
            bool epochMatured = _hasEpochMatured(_epoch);
            if (epochMatured) {
                IERC20(summit).safeTransfer(msg.sender, unclaimedWinnings);
            } else {
                IERC20(summit).safeTransfer(msg.sender, unclaimedWinnings / 2);
                IERC20(summit).safeTransfer(burnAdd, unclaimedWinnings / 4);
                IERC20(summit).safeTransfer(expedAdd, unclaimedWinnings / 4);
            }
        }

        userEpochWinnings.claimedWinnings += unclaimedWinnings;
    }





    // -----------------------------------------------------
    // --   T O K E N   M A N A G E M E N T
    // -----------------------------------------------------

    /// @dev Utility function for depositing tokens into passthrough strategy
    function passthroughDeposit(address _token, uint256 _amount) internal returns (uint256) {
        if (tokenPassthroughStrategy[_token] == address(0)) return _amount;
        return IPassthrough(tokenPassthroughStrategy[_token]).deposit(_amount, expedAdd, devAdd);
    }

    /// @dev Utility function for withdrawing tokens from passthrough strategy
    /// @param _token Token to withdraw from it's passthrough strategy
    /// @param _amount Amount requested to withdraw
    /// @return The true amount withdrawn from the passthrough strategy after the passthrough's fee was taken (if any)
    function passthroughWithdraw(address _token, uint256 _amount) internal returns (uint256) {
        if (tokenPassthroughStrategy[_token] == address(0)) return _amount;
        return IPassthrough(tokenPassthroughStrategy[_token]).withdraw(_amount, expedAdd, devAdd);
    }


    /// @dev Transfers funds from user on deposit
    /// @param _userAdd Depositing user
    /// @param _token Token to deposit
    /// @param _amount Deposit amount before fee
    /// @return Deposit amount
    function depositTokenManagement(address _userAdd, address _token, uint256 _amount)
        external
        onlySubCartographer
        returns (uint256)
    {
        // Transfers total deposit amount
        IERC20(_token).safeTransferFrom(_userAdd, address(this), _amount);

        // Deposit full amount to passthrough, return amount deposited
        return passthroughDeposit(_token, _amount);
    }


    /// @dev Takes the remaining withdrawal tax (difference between total withdrawn amount and the amount expected to be withdrawn after the remaining fee)
    /// @param _token Token to withdraw
    /// @param _amount Funds above the amount after remaining withdrawal fee that was returned from the passthrough strategy
    function _distributeWithdrawalTax(address _token, uint256 _amount)
        internal
    {
        IERC20(_token).safeTransfer(devAdd, _amount / 2);
        IERC20(_token).safeTransfer(expedAdd, _amount / 2);
    }

    /// @dev Transfers funds to user on withdraw
    /// @param _userAdd Withdrawing user
    /// @param _token Token to withdraw
    /// @param _amount Withdraw amount
    /// @return Amount withdrawn after fee
    function withdrawalTokenManagement(address _userAdd, address _token, uint256 _amount)
        external
        onlySubCartographer
        returns (uint256)
    {
        // Withdraw full amount from passthrough (if any), if there is a fee that isn't covered by the increase in vault value this may be less than expected full amount
        uint256 amountAfterFee = passthroughWithdraw(_token, _amount);

        // Amount user expects to receive after fee taken
        uint256 expectedWithdrawnAmount = (_amount * (10000 - _getTaxBP(_userAdd, _token))) / 10000;

        // Take any remaining fee (gap between what was actually withdrawn, and what the user expects to receive)
        if (amountAfterFee > expectedWithdrawnAmount) {
            _distributeWithdrawalTax(_token, amountAfterFee - expectedWithdrawnAmount);
            amountAfterFee = expectedWithdrawnAmount;
        }

        // Transfer funds back to user
        IERC20(_token).safeTransfer(_userAdd, amountAfterFee);

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

        summit.mint(address(summitReferrals), _amount);
    }
    
    
    
    
    
    
    // ---------------------------------------
    // --   W I T H D R A W A L   T A X
    // ---------------------------------------


    /// @dev Set the fee for a token
    function setTokenWithdrawalTax(address _token, uint16 _taxBP)
        public
        onlyOwner
    {
        // Fees will never be higher than 5%
        require(_taxBP <= 1000, "Invalid tax > 10%");
        tokenWithdrawalTax[_token] = _taxBP;
    }

    /// @dev Set the fee decaying duration
    function setFeeDecayDuration(uint256 _feeDecayDuration)
        public
        onlyOwner
    {
        feeDecayDuration = _feeDecayDuration;
    }

    /// @dev Set the minimum withdrawal fee
    function setBaseMinimumWithdrawalFee(uint16 _baseMinimumWithdrawalFee)
        public
        onlyOwner
    {
        require(_baseMinimumWithdrawalFee <= 100, "Minimum fee outside 0%-10%");
        baseMinimumWithdrawalFee = _baseMinimumWithdrawalFee;
    }

    /// @dev Set whether a token is a native farm
    function setTokenIsNativeFarm(address _token, bool _isNativeFarm)
        public
        onlyOwner
    {
        isNativeFarmToken[_token] = _isNativeFarm;
    }

    // -----------------------------------------------------
    // --   G E T T E R
    // -----------------------------------------------------

    /// @dev Get tax BP
    /// @param _userAdd user address
    /// @param _token token address
    function taxBP(address _userAdd, address _token)
        public view
        returns (uint16)
    {
        return _getTaxBP(_userAdd, _token);
    }

    /// @dev Get bonus BP
    /// @param _userAdd user address
    /// @param _token token address
    function bonusBP(address _userAdd, address _token)
        public view
        returns (uint256)
    {
        return _bonusBP(_userAdd, _token);
    }
}
