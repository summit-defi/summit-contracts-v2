// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;
import "./SummitToken.sol";
import "./CartographerOasis.sol";
import "./CartographerElevation.sol";
import "./EverestToken.sol";
import "./ElevationHelper.sol";
import "./SummitGlacier.sol";
import "./PresetPausable.sol";
import "./libs/SummitMath.sol";
import "./interfaces/ISubCart.sol";
import "./interfaces/IPassthrough.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
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
    - Elevating (Deposit once, update strategy without paying tax)

    - Passthrough Strategy (to fund expeditions, on oasis and elevation farms)
    - Expedition (weekly drawings for summit holders to earn stablecoins and other high value tokens)

    - Random number generation immune to Block Withholding Attack through open source webserver
    - Stopwatch functionality through open source webserver
*/

contract Cartographer is Ownable, Initializable, ReentrancyGuard, PresetPausable {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;


    // ---------------------------------------
    // --   V A R I A B L E S
    // ---------------------------------------

    uint8 constant OASIS = 0;
    uint8 constant PLAINS = 1;
    uint8 constant MESA = 2;
    uint8 constant SUMMIT = 3;

    SummitToken public summit;
    bool public enabled = false;                                                // Whether the ecosystem has been enabled for earning

    uint256 public rolloverReward = 0e18;                                       // Amount of SUMMIT which will be rewarded for rolling over a round

    address public treasuryAdd;                                                 // Treasury address, see docs for spend breakdown
    address public lpGeneratorAdd;                                              // Address that accumulates funds that will be converted into LP
    address public expeditionTreasuryAdd;                                       // Expedition Treasury address, intermediate address to convert to stablecoins
    ElevationHelper public elevationHelper;
    address[4] public subCartographers;
    EverestToken public everest;
    SummitGlacier public summitGlacier;

    uint256 public summitPerSecond = 5e16;                                      // Amount of Summit minted per second to be distributed to users
    uint256 public treasurySummitBP = 2000;                                     // Amount of Summit minted per second to the treasury

    uint16[4] public elevationPoolsCount;                                       // List of all pool identifiers (PIDs)

    mapping(address => address) public tokenPassthroughStrategy;                // Passthrough strategy of each stakable token

    uint256[4] public elevAlloc;                                                // Total allocation points of all pools at an elevation
    EnumerableSet.AddressSet tokensWithAlloc;                                   // List of tokens with an allocation set
    mapping(address => uint16) public tokenDepositFee;                          // Deposit fee for all farms of this token
    mapping(address => uint16) public tokenWithdrawalTax;                       // Tax for all farms of this token
    mapping(address => uint256) public tokenAlloc;                              // A tokens underlying allocation, which is modulated for each elevation

    mapping(address => mapping(uint8 => bool)) public poolExistence;            // Whether a pool exists for a token at an elevation
    mapping(address => mapping(uint8 => bool)) public tokenElevationIsEarning;  // If a token is earning SUMMIT at a specific elevation

    mapping(address => bool) public isNativeFarmToken;
    
    // First {taxDecayDuration} days from the last withdraw timestamp, no bonus builds. 7 days after that it builds by 1% each day
    // Any withdraw resets the bonus to 0% but starts building immediately, which sets the last withdraw timestamp to (current timestamp - {taxDecayDuration})
    mapping(address => mapping(address => uint256)) public tokenLastWithdrawTimestampForBonus; // Users' last withdraw timestamp for farm emission bonus
    uint256 public maxBonusBP = 700;

    mapping(address => mapping(address => uint256)) public tokenLastDepositTimestampForTax; // Users' last deposit timestamp for tax
    uint16 public baseMinimumWithdrawalTax = 100;
    uint256 public taxDecayDuration = 7 * 86400;
    uint256 constant public taxResetOnDepositBP = 500;



    // ---------------------------------------
    // --   E V E N T S
    // ---------------------------------------

    event SetTokenAllocation(address indexed token, uint256 alloc);
    event PoolCreated(address indexed token, uint8 elevation);
    event PoolUpdated(address indexed token, uint8 elevation, bool live);
    event Deposit(address indexed user, address indexed token, uint8 indexed elevation, uint256 amount);
    event ClaimElevation(address indexed user, uint8 indexed elevation, uint256 totalClaimed);
    event Rollover(address indexed user, uint256 elevation);
    event SwitchTotem(address indexed user, uint8 indexed elevation, uint8 totem);
    event Elevate(address indexed user, address indexed token, uint8 sourceElevation, uint8 targetElevation, uint256 amount);
    event EmergencyWithdraw(address indexed user, address indexed token, uint8 indexed elevation, uint256 amount);
    event Withdraw(address indexed user, address indexed token, uint8 indexed elevation, uint256 amount);
    event ElevateAndLockStakedSummit(address indexed user, uint8 indexed elevation, uint256 amount);
    event ClaimWinnings(address indexed user, uint256 amount);
    event SetExpeditionTreasuryAddress(address indexed user, address indexed newAddress);
    event SetTreasuryAddress(address indexed user, address indexed newAddress);
    event SetLpGeneratorAddress(address indexed user, address indexed newAddress);
    event PassthroughStrategySet(address indexed token, address indexed passthroughStrategy);
    event PassthroughStrategyRetired(address indexed token, address indexed passthroughStrategy);

    event SetTokenDepositFee(address indexed _token, uint16 _feeBP);
    event SetTokenWithdrawTax(address indexed _token, uint16 _taxBP);
    event SetTaxDecayDuration(uint256 _taxDecayDuration);
    event SetBaseMinimumWithdrawalTax(uint16 _baseMinimumWithdrawalTax);
    event SetTokenIsNativeFarm(address indexed _token, bool _isNativeFarm);
    event SetMaxBonusBP(uint256 _maxBonusBP);
    event SummitOwnershipTransferred(address indexed _summitOwner);
    event SetRolloverReward(uint256 _reward);
    event SetTotalSummitPerSecond(uint256 _amount);
    event SetSummitDistributionBPs(uint256 _treasuryBP);






    // ---------------------------------------
    // --  A D M I N I S T R A T I O N
    // ---------------------------------------


    /// @dev Constructor simply setting addresses on creation
    constructor(
        address _treasuryAdd,
        address _expeditionTreasuryAdd,
        address _lpGeneratorAdd
    ) {
        require(_treasuryAdd != address(0), "Missing Treasury");
        require(_expeditionTreasuryAdd != address(0), "Missing Exped Treasury");
        require(_lpGeneratorAdd != address(0), "Missing Lp Generator Add");
        treasuryAdd = _treasuryAdd;
        expeditionTreasuryAdd = _expeditionTreasuryAdd;
        lpGeneratorAdd = _lpGeneratorAdd;
    }

    /// @dev Initialize, simply setting addresses, these contracts need the Cartographer address so it must be separate from the constructor
    function initialize(
        address _summit,
        address _ElevationHelper,
        address _CartographerOasis,
        address _CartographerPlains,
        address _CartographerMesa,
        address _CartographerSummit,
        address _everest,
        address _summitGlacier
    )
        external
        initializer onlyOwner
    {
        require(
            _summit != address(0) &&
            _ElevationHelper != address(0) &&
            _CartographerOasis != address(0) &&
            _CartographerPlains != address(0) &&
            _CartographerMesa != address(0) &&
            _CartographerSummit != address(0) &&
            _everest != address(0) &&
            _summitGlacier != address(0),
            "Contract is zero"
        );

        summit = SummitToken(_summit);

        elevationHelper = ElevationHelper(_ElevationHelper);

        subCartographers[OASIS] = _CartographerOasis;
        subCartographers[PLAINS] = _CartographerPlains;
        subCartographers[MESA] = _CartographerMesa;
        subCartographers[SUMMIT] = _CartographerSummit;

        everest = EverestToken(_everest);
        summit.approve(_everest, type(uint256).max);
        summitGlacier = SummitGlacier(_summitGlacier);

        // Initialize the subCarts with the address of elevationHelper
        for (uint8 elevation = OASIS; elevation <= SUMMIT; elevation++) {
            _subCartographer(elevation).initialize(_ElevationHelper, address(_summit));
        }
    }


    /// @dev Enabling the summit ecosystem with the true summit token, turning on farming
    function enable() external onlyOwner {
        // Prevent multiple instances of enabling
        require(!enabled, "Already enabled");
        enabled = true;

        // Setting and propagating the true summit address and launch timestamp
        elevationHelper.enable(block.timestamp);
        _subCartographer(OASIS).enable(block.timestamp);
    }

    /// @dev Transferring Summit Ownership - Huge timelock
    function migrateSummitOwnership(address _summitOwner)
        public
        onlyOwner
    {
        require(_summitOwner != address(0), "Missing Summit Owner");
        summit.transferOwnership(_summitOwner);
        emit SummitOwnershipTransferred(_summitOwner);
    }


    /// @dev Updating the dev address, can only be called by the current dev address
    /// @param _treasuryAdd New dev address
    function setTreasuryAdd(address _treasuryAdd) public {
        require(_treasuryAdd != address(0), "Missing address");
        require(msg.sender == treasuryAdd, "Forbidden");

        treasuryAdd = _treasuryAdd;
        emit SetTreasuryAddress(msg.sender, _treasuryAdd);
    }


    /// @dev Updating the expedition accumulator address
    /// @param _expeditionTreasuryAdd New expedition accumulator address
    function setExpeditionTreasuryAdd(address _expeditionTreasuryAdd) public onlyOwner {
        require(_expeditionTreasuryAdd != address(0), "Missing address");
        expeditionTreasuryAdd = _expeditionTreasuryAdd;
        emit SetExpeditionTreasuryAddress(msg.sender, _expeditionTreasuryAdd);
    }


    /// @dev Updating the LP Generator address
    /// @param _lpGeneratorAdd New lp Generator address
    function setLpGeneratorAdd(address _lpGeneratorAdd) public onlyOwner {
        require(_lpGeneratorAdd != address(0), "Missing address");
        lpGeneratorAdd = _lpGeneratorAdd;
        emit SetLpGeneratorAddress(msg.sender, _lpGeneratorAdd);
    }

    /// @dev Update the amount of native token equivalent to reward for rolling over a round
    function setRolloverReward(uint256 _reward) public onlyOwner {
        require(_reward < 10e18, "Exceeds max reward");
        rolloverReward = _reward;
        emit SetRolloverReward(_reward);
    }

    /// @dev Updating the total emission of the ecosystem
    /// @param _amount New total emission
    function setTotalSummitPerSecond(uint256 _amount) public onlyOwner {
        // Must be less than 1 SUMMIT per second
        require(_amount < 1e18, "Invalid emission");
        summitPerSecond = _amount;
        emit SetTotalSummitPerSecond(_amount);
    }

    /// @dev Updating the emission split profile
    /// @param _treasuryBP How much extra is minted for the treasury
    function setSummitDistributionBPs(uint256 _treasuryBP) public onlyOwner {
        // Require dev emission less than 25% of total emission
        require(_treasuryBP <= 250, "Invalid Distributions");
        treasurySummitBP = _treasuryBP;
        emit SetSummitDistributionBPs(_treasuryBP);
    }






    // -----------------------------------------------------------------
    // --   M O D I F I E R S (Many are split to save contract size)
    // -----------------------------------------------------------------

    function _onlySubCartographer(address _isSubCartographer) internal view {
        require(
            _isSubCartographer == subCartographers[OASIS] ||
            _isSubCartographer == subCartographers[PLAINS] ||
            _isSubCartographer == subCartographers[MESA] ||
            _isSubCartographer == subCartographers[SUMMIT],
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
        require(!tokensWithAlloc.contains(_token), "Duplicated token alloc");
        _;
    }
    modifier tokenAllocExists(address _token) {
        require(tokensWithAlloc.contains(_token), "Invalid token alloc");
        _;
    }
    modifier validAllocation(uint256 _allocation) {
        require(_allocation <= 10000, "Allocation must be <= 100X");
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

    function _subCartographer(uint8 _elevation) internal view returns (ISubCart) {
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


    /// @dev List of tokens with a set allocation
    function tokensWithAllocation()
        public view
        returns (address[] memory)
    {
        return tokensWithAlloc.values();
    }


    /// @dev Create / Update the allocation for a token. This modifies existing allocations at each elevation for that token
    /// @param _token Token to update allocation for
    /// @param _allocation Updated allocation
    function setTokenAllocation(address _token, uint256 _allocation)
        public
        onlyOwner validAllocation(_allocation)
    {
        // Token is marked as having an existing allocation
        tokensWithAlloc.add(_token);

        // Update the tokens allocation at the elevations that token is active at
        for (uint8 elevation = OASIS; elevation <= SUMMIT; elevation++) {
            if (tokenElevationIsEarning[_token][elevation]) {
                elevAlloc[elevation] = elevAlloc[elevation] + _allocation - tokenAlloc[_token];
            }
        }

        // Update the token allocation
        tokenAlloc[_token] = _allocation;

        emit SetTokenAllocation(_token, _allocation);
    }


    /// @dev Register pool at elevation as live, add to shared alloc
    /// @param _token Token of the pool
    /// @param _elevation Elevation of the pool
    /// @param _isEarning Whether token is earning SUMMIT at elevation
    function setIsTokenEarningAtElevation(address _token, uint8 _elevation, bool _isEarning)
        external
        onlySubCartographer
    {
        // Early escape if token earning is already up to date
        if (tokenElevationIsEarning[_token][_elevation] == _isEarning) return;

        // Add the new allocation to the token's shared allocation and total allocation
        if (_isEarning) {
            elevAlloc[_elevation] += tokenAlloc[_token];

        // Remove the existing allocation to the token's shared allocation and total allocation
        } else {
            elevAlloc[_elevation] -= tokenAlloc[_token];
        }

        // Mark the token-elevation earning
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

        IPassthrough(tokenPassthroughStrategy[_token]).retire(expeditionTreasuryAdd, treasuryAdd, lpGeneratorAdd);
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
        _subCartographer(_elevation).add(_token, _live);

        emit PoolCreated(_token, _elevation);
    }


    /// @dev Update pool's live status and deposit tax
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
        _subCartographer(_elevation).set(_token, _live);

        emit PoolUpdated(_token, _elevation, _live);
    }


    /// @dev Does what it says on the box
    function massUpdatePools() public {
        for (uint8 elevation = OASIS; elevation <= SUMMIT; elevation++) {
            _subCartographer(elevation).massUpdatePools();
        }
    }





    // ------------------------------------------------------------------
    // --   R O L L O V E R   E L E V A T I O N   R O U N D
    // ------------------------------------------------------------------



    /// @dev Rolling over a round for an elevation and selecting winning totem.
    ///      Called by the webservice, but can also be called manually by any user (as failsafe)
    /// @param _elevation Elevation to rollover
    function rollover(uint8 _elevation)
        public whenNotPaused
        nonReentrant isElevation(_elevation)
    {
        // Ensure that the elevation is ready to be rolled over, ensures only a single user can perform the rollover
        elevationHelper.validateRolloverAvailable(_elevation);

        // Selects the winning totem for the round, storing it in the elevationHelper contract
        elevationHelper.selectWinningTotem(_elevation);

        // Update the round index in the elevationHelper, effectively starting the next round of play
        elevationHelper.rolloverElevation(_elevation);

        // Rollover active pools at the elevation
        _subCartographer(_elevation).rollover();

        // Give SUMMIT rewards to user that executed the rollover
        summit.mint(msg.sender, rolloverReward);

        emit Rollover(msg.sender, _elevation);
    }





    // -----------------------------------------------------
    // --   S U M M I T   E M I S S I O N
    // -----------------------------------------------------
    

    /// @dev Returns the modulated allocation of a token at elevation, escaping early if the pool is not live
    /// @param _token Tokens allocation
    /// @param _elevation Elevation to modulate
    /// @return True allocation of the pool at elevation
    function elevationModulatedAllocation(address _token, uint8 _elevation) public view returns (uint256) {
        // Escape early if the pool is not currently earning SUMMIT
        if (!tokenElevationIsEarning[_token][_elevation]) return 0;

        // Fetch the modulated base allocation for the token at elevation
        return elevationHelper.elevationModulatedAllocation(tokenAlloc[_token], _elevation);
    }


    /// @dev Shares of a token at elevation
    /// (@param _token, @param _elevation) Together identify the pool to calculate
    function _tokenElevationShares(address _token, uint8 _elevation) internal view returns (uint256) {
        // Escape early if the pool doesn't exist or is not currently earning SUMMIT
        if (!poolExistence[_token][_elevation] || !tokenElevationIsEarning[_token][_elevation]) return 0;

        return (
            _subCartographer(_elevation).supply(_token) *
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
            _tokenElevationShares(_token, OASIS) +
            _tokenElevationShares(_token, PLAINS) +
            _tokenElevationShares(_token, MESA) +
            _tokenElevationShares(_token, SUMMIT)
        );

        // Escape early if nothing is staked in any of the token's pools
        if (totalTokenShares == 0) return 0;

        // Divide the target pool (token + elevation) shares by total shares (as calculated above)
        return _tokenElevationShares(_token, _elevation) * 1e12 / totalTokenShares;
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
    function _poolEmissionMultiplier(uint256 _lastRewardTimestamp, address _token, uint8 _elevation)
        internal view
        returns (uint256)
    {
        // Calculate overall emission granted over time span, calculated by:
        //   . Time difference from last reward timestamp
        //   . Tokens allocation as a fraction of total allocation
        //   . Pool's emission multiplier
        return (block.timestamp - _lastRewardTimestamp) * tokenAllocEmissionMultiplier(_token) * tokenElevationEmissionMultiplier(_token, _elevation) / 1e12;
    }


    /// @dev Uses _poolEmissionMultiplier along with staking summit emission to calculate the pools summit emission over the time span
    /// @param _lastRewardTimestamp Used for time span
    /// (@param _token, @param _elevation) Pool identifier
    /// @return emission of SUMMIT, not raised to any power
    function poolSummitEmission(uint256 _lastRewardTimestamp, address _token, uint8 _elevation)
        external view
        onlySubCartographer
        returns (uint256)
    {
        // Escape early if no time has passed
        if (block.timestamp <= _lastRewardTimestamp) { return 0; }

        // Emission multiplier multiplied by summitPerSecond, finally reducing back to true exponential
        return _poolEmissionMultiplier(_lastRewardTimestamp, _token, _elevation) * summitPerSecond / 1e12;
    }





    // -----------------------------------------------------
    // --   S W I T C H   T O T E M
    // -----------------------------------------------------


    /// @dev All funds at an elevation share a totem. This function allows switching staked funds from one totem to another
    /// @param _elevation Elevation to switch totem on
    /// @param _totem New target totem
    function switchTotem(uint8 _elevation, uint8 _totem)
        public whenNotPaused
        nonReentrant isElevation(_elevation) validTotem(_elevation, _totem)
    {
        // Executes the totem switch in the correct subcartographer
        _subCartographer(_elevation).switchTotem(_totem, msg.sender);

        emit SwitchTotem(msg.sender, _elevation, _totem);
    }





    // -----------------------------------------------------
    // --   P O O L   I N T E R A C T I O N S
    // -----------------------------------------------------


    /// @dev Get the user's tax for a token
    /// @param _userAdd user address
    /// @param _token token address
    function taxBP(address _userAdd, address _token)
        public view
        returns (uint16)
    {
        return _getTaxBP(_userAdd, _token);
    }
    function _getTaxBP(address _userAdd, address _token)
        public view
        returns (uint16)
    {
        uint256 lastDepositTimestampForTax = tokenLastDepositTimestampForTax[_userAdd][_token];

        uint256 tokenTax = uint256(tokenWithdrawalTax[_token]);
        uint256 tokenMinTax = isNativeFarmToken[_token] ? 0 : baseMinimumWithdrawalTax;

        // Early exit if min tax is greater than tax of this token
        if (tokenMinTax >= tokenTax) return uint16(tokenMinTax);

        return uint16(SummitMath.scaledValue(
            block.timestamp,
            lastDepositTimestampForTax, lastDepositTimestampForTax + taxDecayDuration,
            tokenTax, tokenMinTax
        ));
    }


    /// @dev Get bonus BP
    /// @param _userAdd user address
    /// @param _token token address
    function bonusBP(address _userAdd, address _token)
        public view
        returns (uint16)
    {
        return _getBonusBP(_userAdd, _token);
    }
    function _getBonusBP(address _userAdd, address _token)
        public view
        returns (uint16)
    {
        uint256 lastWithdrawTimestamp = tokenLastWithdrawTimestampForBonus[_userAdd][_token];

        // Early exit if last Withdraw Timestamp hasn't ever been ste
        if (lastWithdrawTimestamp == 0) return 0;

        return uint16(SummitMath.scaledValue(
            block.timestamp,
            lastWithdrawTimestamp + taxDecayDuration, lastWithdrawTimestamp + (taxDecayDuration * 2),
            0, maxBonusBP
        ));
    }


    /// @dev Users staked amount across all elevations
    /// @param _token Token to determine user's staked amount of
    function userTokenStakedAmount(address _userAdd, address _token)
        public view
        returns (uint256)
    {
        return _userTokenStakedAmount(_token, _userAdd);
    }

    function _userTokenStakedAmount(address _token, address _userAdd)
        internal view
        returns (uint256)
    {
        uint256 totalStaked = 0;
        for (uint8 elevation = OASIS; elevation <= SUMMIT; elevation++) {
            totalStaked += _subCartographer(elevation).userStakedAmount(_token, _userAdd);
        }
        return totalStaked;
    }


    /// @dev Stake funds with a pool, is also used to claim a single farm with a deposit amount of 0
    /// (@param _token, @param _elevation) Pool identifier
    /// @param _amount Amount to stake
    function deposit(address _token, uint8 _elevation, uint256 _amount)
        public whenNotPaused
        nonReentrant poolExists(_token, _elevation)
    {
        // Executes the deposit in the sub cartographer
        uint256 amountAfterTax = _subCartographer(_elevation)
            .deposit(
                _token,
                _amount,
                msg.sender,
                false
            );

        // Set initial value of token last withdraw timestamp (for bonus) if it hasn't already been set
        if (tokenLastWithdrawTimestampForBonus[msg.sender][_token] == 0) {
            tokenLastWithdrawTimestampForBonus[msg.sender][_token] = block.timestamp;
        }

        // Reset tax timestamp if user is depositing greater than {taxResetOnDepositBP}% of current staked amount
        if (_amount > (_userTokenStakedAmount(_token, msg.sender) * taxResetOnDepositBP / 10000)) {
            tokenLastDepositTimestampForTax[msg.sender][_token] = block.timestamp;
        }

        emit Deposit(msg.sender, _token, _elevation, amountAfterTax);
    }


    /// @dev Claim all rewards (or cross compound) of an elevation
    /// @param _elevation Elevation to claim all rewards from
    function claimElevation(uint8 _elevation)
        public whenNotPaused
        nonReentrant isOasisOrElevation(_elevation)
    {
        // Harvest across an elevation, return total amount claimed
        uint256 totalClaimed = _subCartographer(_elevation).claimElevation(msg.sender);
        
        emit ClaimElevation(msg.sender, _elevation, totalClaimed);
    }


    /// @dev Withdraw staked funds from a pool
    /// (@param _token, @param _elevation) Pool identifier
    function emergencyWithdraw(address _token, uint8 _elevation)
        public
        nonReentrant poolExists(_token, _elevation)
    {
        // Executes the withdrawal in the sub cartographer
        uint256 amountAfterTax = _subCartographer(_elevation)
            .emergencyWithdraw(
                _token,
                msg.sender
            );

        // Farm bonus handling, sets the last withdraw timestamp to 7 days ago (tax decay duration) to begin earning bonuses immediately
        // Update to the max of (current last withdraw timestamp, current timestamp - 7 days), which ensures the first 7 days are never building bonus
        tokenLastWithdrawTimestampForBonus[msg.sender][_token] = Math.max(
            tokenLastWithdrawTimestampForBonus[msg.sender][_token],
            block.timestamp - taxDecayDuration
        );

        emit EmergencyWithdraw(msg.sender, _token, _elevation, amountAfterTax);
    }


    /// @dev Withdraw staked funds from a pool
    /// (@param _token, @param _elevation) Pool identifier
    /// @param _amount Amount to withdraw, must be > 0 and <= staked amount
    function withdraw(address _token, uint8 _elevation, uint256 _amount)
        public whenNotPaused
        nonReentrant poolExists(_token, _elevation)
    {
        // Executes the withdrawal in the sub cartographer
        uint256 amountAfterTax = _subCartographer(_elevation)
            .withdraw(
                _token,
                _amount,
                msg.sender,
                false
            );

        // Farm bonus handling, sets the last withdraw timestamp to 7 days ago (tax decay duration) to begin earning bonuses immediately
        // Update to the max of (current last withdraw timestamp, current timestamp - 7 days), which ensures the first 7 days are never building bonus
        tokenLastWithdrawTimestampForBonus[msg.sender][_token] = Math.max(
            tokenLastWithdrawTimestampForBonus[msg.sender][_token],
            block.timestamp - taxDecayDuration
        );

        emit Withdraw(msg.sender, _token, _elevation, amountAfterTax);
    }


    /// @dev Elevate SUMMIT from the Elevation farms to the Expedition without paying any withdrawal tax
    /// @param _elevation Elevation to elevate from
    /// @param _amount Amount of SUMMIT to elevate
    function elevateAndLockStakedSummit(uint8 _elevation, uint256 _amount)
        public whenNotPaused
        nonReentrant poolExists(address(summit), _elevation)
    {
        require(_amount > 0, "Elevate non zero amount");

        // Withdraw {_amount} of {_token} from {_elevation} pool
        uint256 elevatedAmount = _subCartographer(_elevation)
            .withdraw(
                address(summit),
                _amount,
                msg.sender,
                true
            );

        // Lock withdrawn SUMMIT for EVEREST
        everest.lockAndExtendLockDuration(
            elevatedAmount,
            everest.minLockTime(),
            msg.sender
        );

        emit ElevateAndLockStakedSummit(msg.sender, _elevation, _amount);
    }


    /// @dev Validation step of Elevate into separate function
    /// @param _token Token to elevate
    /// @param _sourceElevation Elevation to withdraw from
    /// @param _targetElevation Elevation to deposit into
    /// @param _amount Amount to elevate
    function _validateElevate(address _token, uint8 _sourceElevation, uint8 _targetElevation, uint256 _amount)
        internal view
        poolExists(_token, _sourceElevation) poolExists(_token, _targetElevation)
    {
        require(_amount > 0, "Transfer non zero amount");
        require(_sourceElevation != _targetElevation, "Must change elev");
        require(
            _subCartographer(_sourceElevation).isTotemSelected(msg.sender) &&
            _subCartographer(_targetElevation).isTotemSelected(msg.sender),
            "Totem not selected"
        );
    }


    /// @dev Allows funds to be transferred between elevations without forcing users to pay a deposit tax
    /// @param _token Token to elevate
    /// @param _sourceElevation Elevation to withdraw from
    /// @param _targetElevation Elevation to deposit into
    /// @param _amount Amount to elevate
    function elevate(address _token, uint8 _sourceElevation, uint8 _targetElevation, uint256 _amount)
        public whenNotPaused
        nonReentrant
    {
        _validateElevate(_token, _sourceElevation, _targetElevation, _amount);

        // Withdraw {_amount} of {_token} from {_sourceElevation} pool
        uint256 elevatedAmount = _subCartographer(_sourceElevation)
            .withdraw(
                _token,
                _amount,
                msg.sender,
                true
            );
        
        // Deposit withdrawn amount of {_token} from source pool {elevatedAmount} into {_targetPid} pool
        elevatedAmount = _subCartographer(_targetElevation)
            .deposit(
                _token,
                elevatedAmount,
                msg.sender,
                true
            );

        emit Elevate(msg.sender, _token, _sourceElevation, _targetElevation, elevatedAmount);
    }





    // -----------------------------------------------------
    // --   Y I E L D   L O C K I N G
    // -----------------------------------------------------


    /// @dev Utility function to handle claiming Summit rewards with bonuses
    /// @return Claimed amount with bonuses included
    function claimWinnings(address _userAdd, address _token, uint256 _amount)
        external whenNotPaused
        onlySubCartographer
        returns (uint256)
    {
        uint256 tokenBonusBP = _getBonusBP(_userAdd, _token);
        uint256 bonusWinnings = _amount * tokenBonusBP / 10000;
        uint256 totalWinnings = _amount + bonusWinnings;

        // Mint Summit user has won, and additional mints for distribution
        summit.mint(address(summitGlacier), totalWinnings);
        summit.mint(treasuryAdd, totalWinnings * treasurySummitBP / 10000);

        // Send users claimable winnings to SummitGlacier.sol
        summitGlacier.addLockedWinnings(totalWinnings, bonusWinnings, _userAdd);

        emit ClaimWinnings(_userAdd, totalWinnings);

        return totalWinnings;
    }



    // -----------------------------------------------------
    // --   T O K E N   M A N A G E M E N T
    // -----------------------------------------------------

    /// @dev Utility function for depositing tokens into passthrough strategy
    function _passthroughDeposit(address _token, uint256 _amount) internal returns (uint256) {
        if (tokenPassthroughStrategy[_token] == address(0)) return _amount;
        return IPassthrough(tokenPassthroughStrategy[_token]).deposit(_amount, expeditionTreasuryAdd, treasuryAdd, lpGeneratorAdd);
    }

    /// @dev Utility function for withdrawing tokens from passthrough strategy
    /// @param _token Token to withdraw from it's passthrough strategy
    /// @param _amount Amount requested to withdraw
    /// @return The true amount withdrawn from the passthrough strategy after the passthrough's tax was taken (if any)
    function _passthroughWithdraw(address _token, uint256 _amount) internal returns (uint256) {
        if (tokenPassthroughStrategy[_token] == address(0)) return _amount;
        return IPassthrough(tokenPassthroughStrategy[_token]).withdraw(_amount, expeditionTreasuryAdd, treasuryAdd, lpGeneratorAdd);
    }


    /// @dev Transfers funds from user on deposit
    /// @param _userAdd Depositing user
    /// @param _token Token to deposit
    /// @param _amount Deposit amount before tax
    /// @return Deposit amount
    function depositTokenManagement(address _userAdd, address _token, uint256 _amount)
        external whenNotPaused
        onlySubCartographer
        returns (uint256)
    {
        // Transfers total deposit amount
        IERC20(_token).safeTransferFrom(_userAdd, address(this), _amount);

        // Take and distribute deposit fee
        uint256 amountAfterFee = _amount;
        if (tokenDepositFee[_token] > 0) {
            amountAfterFee = _amount * (10000 - tokenDepositFee[_token]) / 10000;
            _distributeTaxesAndFees(_token, _amount * tokenDepositFee[_token] / 10000);
        }

        // Deposit full amount to passthrough, return amount deposited
        return _passthroughDeposit(_token, amountAfterFee);
    }


    /// @dev Takes the remaining withdrawal tax (difference between total withdrawn amount and the amount expected to be withdrawn after the remaining tax)
    /// @param _token Token to withdraw
    /// @param _amount Funds above the amount after remaining withdrawal tax that was returned from the passthrough strategy
    function _distributeTaxesAndFees(address _token, uint256 _amount)
        internal
    {
        IERC20(_token).safeTransfer(treasuryAdd, _amount / 2);
        IERC20(_token).safeTransfer(expeditionTreasuryAdd, _amount / 2);
    }

    /// @dev Transfers funds to user on withdraw
    /// @param _userAdd Withdrawing user
    /// @param _token Token to withdraw
    /// @param _amount Withdraw amount
    /// @return Amount withdrawn after tax
    function withdrawalTokenManagement(address _userAdd, address _token, uint256 _amount)
        external
        onlySubCartographer
        returns (uint256)
    {
        // Withdraw full amount from passthrough (if any), if there is a tax that isn't covered by the increase in vault value this may be less than expected full amount
        uint256 amountAfterTax = _passthroughWithdraw(_token, _amount);

        // Amount user expects to receive after tax taken
        uint256 expectedWithdrawnAmount = (_amount * (10000 - _getTaxBP(_userAdd, _token))) / 10000;

        // Take any remaining tax (gap between what was actually withdrawn, and what the user expects to receive)
        if (amountAfterTax > expectedWithdrawnAmount) {
            _distributeTaxesAndFees(_token, amountAfterTax - expectedWithdrawnAmount);
            amountAfterTax = expectedWithdrawnAmount;
        }

        // Transfer funds back to user
        IERC20(_token).safeTransfer(_userAdd, amountAfterTax);

        return amountAfterTax;
    }
    
    
    
    
    
    
    // ---------------------------------------
    // --   W I T H D R A W A L   T A X
    // ---------------------------------------


    /// @dev Set the tax for a token
    function setTokenDepositFee(address _token, uint16 _feeBP)
        public
        onlyOwner
    {
        // Deposit fee will never be higher than 4%
        require(_feeBP <= 400, "Invalid fee > 4%");
        tokenDepositFee[_token] = _feeBP;
        emit SetTokenDepositFee(_token, _feeBP);
    }


    /// @dev Set the tax for a token
    function setTokenWithdrawTax(address _token, uint16 _taxBP)
        public
        onlyOwner
    {
        // Taxes will never be higher than 10%
        require(_taxBP <= 1000, "Invalid tax > 10%");
        tokenWithdrawalTax[_token] = _taxBP;
        emit SetTokenWithdrawTax(_token, _taxBP);
    }

    /// @dev Set the tax decaying duration
    function setTaxDecayDuration(uint256 _taxDecayDuration)
        public
        onlyOwner
    {
        require(_taxDecayDuration <= 14 days, "Invalid duration > 14d");
        taxDecayDuration = _taxDecayDuration;
        emit SetTaxDecayDuration(_taxDecayDuration);
    }

    /// @dev Set the minimum withdrawal tax
    function setBaseMinimumWithdrawalTax(uint16 _baseMinimumWithdrawalTax)
        public
        onlyOwner
    {
        require(_baseMinimumWithdrawalTax <= 1000, "Minimum tax outside 0%-10%");
        baseMinimumWithdrawalTax = _baseMinimumWithdrawalTax;
        emit SetBaseMinimumWithdrawalTax(_baseMinimumWithdrawalTax);
    }

    /// @dev Set whether a token is a native farm
    function setTokenIsNativeFarm(address _token, bool _isNativeFarm)
        public
        onlyOwner
    {
        isNativeFarmToken[_token] = _isNativeFarm;
        emit SetTokenIsNativeFarm(_token, _isNativeFarm);
    }

    /// @dev Set the maximum bonus BP for native farms
    function setMaxBonusBP(uint256 _maxBonusBP)
        public
        onlyOwner
    {
        require(_maxBonusBP <= 1000, "Max bonus is 10%");
        maxBonusBP = _maxBonusBP;
        emit SetMaxBonusBP(_maxBonusBP);
    }
}
