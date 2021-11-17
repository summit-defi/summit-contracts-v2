// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "./Cartographer.sol";
import "./ISubCart.sol";
import "./SummitToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";


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
--   O A S I S   E X P L A N A T I O N
---------------------------------------------------------------------------------------------


The OASIS is the safest of the elevations.
OASIS pools exactly mirror standard yield farming experiences of other projects.
OASIS pools guarantee yield, and no multiplying or risk takes place at this elevation.
The OASIS does not have totems in the contract, however in the frontend funds staked in the OASIS are represented by the OTTER.

*/
contract CartographerOasis is ISubCart, Ownable, Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    


    // ---------------------------------------
    // --   V A R I A B L E S
    // ---------------------------------------

    Cartographer cartographer;
    uint256 public launchTimestamp = 1641028149;                        // 2022-1-1, will be updated when summit ecosystem switched on
    
    struct UserInfo {
        uint256 debt;                                                   // Debt is (accSummitPerShare * staked) at time of staking and is used in the calculation of yield.
        uint256 staked;                                                 // The amount a user invests in an OASIS pool
    }

    struct OasisPoolInfo {
        uint16 pid;                                                     // Pool identifier
        IERC20 token;                                                   // Reward token yielded by the pool
        uint256 supply;                                                 // Running total of the amount of tokens staked in the pool
        bool live;                                                      // Turns on and off the pool
        uint256 lastRewardTimestamp;                                    // Latest timestamp that SUMMIT distribution occurred
        uint256 accSummitPerShare;                                      // Accumulated SUMMIT per share, raised to 1e12
        uint16 feeBP;                                                   // Fee of the pool, 1% taken on withdraw, remainder on deposit
    }


    uint8 constant OASIS = 0;                                           // Named constant to make reusable elevation functions easier to parse visually
    uint16[] public oasisPIDs;                                          // List of all pools in the oasis
    mapping(uint16 => bool) public pidExistence;                        // Whether a specific pool identifier exists in the oasis
    mapping(IERC20 => bool) public poolExistence;                       // Whether a pool exists for a token at the oasis
    mapping(uint16 => OasisPoolInfo) public oasisPoolInfo;              // Pool info for each oasis pool
    mapping(uint16 => mapping(address => UserInfo)) public userInfo;    // Users running staking information
    
    





    // ---------------------------------------
    // --  A D M I N I S T R A T I O N
    // ---------------------------------------


    /// @dev Constructor simply setting address of the cartographer
    constructor(address _Cartographer)
        public
    {
        require(_Cartographer != address(0), "Cartographer required");
        cartographer = Cartographer(_Cartographer);
    }

    /// @dev Unused initializer as part of the SubCartographer interface
    function initialize(address _ElevationHelper, address, address) external override initializer onlyCartographer {}

    /// @dev Enables the Summit ecosystem with a timestamp, called by the Cartographer
    function enable(uint256 _launchTimestamp)
        external override
        onlyCartographer
    {
        launchTimestamp = _launchTimestamp;
    }
    





    // -----------------------------------------------------------------
    // --   M O D I F I E R S (Many are split to save contract size)
    // -----------------------------------------------------------------

    modifier onlyCartographer() {
        require(msg.sender == address(cartographer), "Only cartographer");
        _;
    }
    modifier validUserAdd(address userAdd) {
        require(userAdd != address(0), "User not 0");
        _;
    }
    modifier nonDuplicated(uint16 _pid, IERC20 _token) {
        require(pidExistence[_pid] == false && poolExistence[_token] == false, "duplicated!");
        _;
    }
    modifier poolExists(uint16 _pid) {
        require(pidExistence[_pid], "Pool doesnt exist");
        _;
    }
    




    // ---------------------------------------
    // --   U T I L S (inlined for brevity)
    // ---------------------------------------
    

    function supply(uint16 _pid) external view override returns (uint256) {
        return oasisPoolInfo[_pid].supply;
    }
    function token(uint16 _pid, bool) external view override returns (IERC20) {
        return oasisPoolInfo[_pid].token;
    }
    function depositFee(uint16 _pid) external view override returns (uint256) {
        return oasisPoolInfo[_pid].feeBP;
    }
    function isEarning(uint16 _pid) external view override returns (bool) {
        return oasisPoolInfo[_pid].live;
    }
    function selectedTotem(uint8, address) external view override returns (uint8) {
        return 0;
    }



    // ---------------------------------------
    // --   P O O L   M A N A G E M E N T
    // ---------------------------------------


    /// @dev Registers pool everywhere needed
    /// @param _pid Pool identifier
    /// @param _token Token to register with
    /// @param _live Whether pool is enabled at time of creation
    function registerPool(uint16 _pid, IERC20 _token, bool _live) internal {
        // Marks token as enabled at elevation, and adds token allocation to token's shared allocation and total allocation
        if (_live) cartographer.setIsTokenEarningAtElevation(_token, OASIS, true);

        // Add pid to lookup list for iterative functions
        oasisPIDs.push(_pid);

        // Prevent duplicate pools for a single token
        poolExistence[_token] = true;

        // Used to verify if pool exists in other functions
        pidExistence[_pid] = true;
    }


    /// @dev Creates a pool at the oasis
    /// @param _pid Pool identifier selected by cartographer
    /// @param _live Whether the pool is enabled initially
    /// @param _token Token yielded by pool
    /// @param _feeBP Deposit fee taken
    function add(uint16 _pid, uint8,  bool _live, IERC20 _token, uint16 _feeBP)
        external override
        onlyCartographer nonDuplicated(_pid, _token)
    {
        // Register pid and token where needed
        registerPool(_pid, _token, _live);

        // Create the initial state of the pool
        oasisPoolInfo[_pid] = OasisPoolInfo({
            pid: _pid,
            token: _token,
            supply: 0,
            live: _live,
            accSummitPerShare: 0,
            lastRewardTimestamp: block.timestamp,
            feeBP: _feeBP
        });
    }

    
    /// @dev Unused expedition functionality
    function addExpedition(uint16, bool, uint256, IERC20, uint256, uint256) external override onlyCartographer {}

    
    /// @dev Update a given pools deposit or live status
    /// @param _pid Pool identifier
    /// @param _live If pool is available for staking
    /// @param _feeBP Deposit fee of pool
    function set(uint16 _pid, bool _live, uint16 _feeBP)
        external override
        onlyCartographer poolExists(_pid)
    {
        OasisPoolInfo storage pool = oasisPoolInfo[_pid];
        updatePool(_pid);

        // If live status of pool changes, update cartographer allocations
        if (pool.live != _live) cartographer.setIsTokenEarningAtElevation(pool.token, OASIS, _live);

        // Update internal pool states
        pool.live = _live;
        pool.feeBP = _feeBP;
    }


    /// @dev Update all pools to current timestamp before other pool management transactions
    function massUpdatePools()
        external override
        onlyCartographer
    {
        for (uint16 i = 0; i < oasisPIDs.length; i++) {
            updatePool(oasisPIDs[i]);
        }
    }
    

    /// @dev Bring reward variables of given pool current
    /// @param _pid Pool identifier to update
    function updatePool(uint16 _pid)
        public
        poolExists(_pid)
    {
        OasisPoolInfo storage pool = oasisPoolInfo[_pid];

        // Early exit if pool already current
        if (pool.lastRewardTimestamp == block.timestamp) { return; }

        // Early exit if pool not launched, has 0 supply, or isn't live.
        // Still update last rewarded timestamp to prevent over emitting on first block on return to live
        if (block.timestamp < launchTimestamp || pool.supply == 0 || !pool.live) {
            pool.lastRewardTimestamp = block.timestamp;
            return;
        }

        // Ensure that pool doesn't earn rewards from before summit ecosystem launched
        if (pool.lastRewardTimestamp < launchTimestamp) {
            pool.lastRewardTimestamp = launchTimestamp;
        }

        // Mint Summit according to pool allocation and token share in pool, retrieve amount of summit minted for staking
        uint256 summitReward = cartographer.mintPoolSummit(pool.lastRewardTimestamp, pool.token, OASIS);

        // Update accSummitPerShare with the amount of staking summit minted.
        pool.accSummitPerShare = pool.accSummitPerShare + (summitReward * 1e12 / pool.supply);

        // Bring last reward timestamp current
        pool.lastRewardTimestamp = block.timestamp;
    }
    




    // ---------------------------------------
    // --   P O O L   R E W A R D S
    // ---------------------------------------


    /// @dev Fetch guaranteed yield rewards of the pool
    /// @param _pid Pool to fetch rewards from
    /// @param _userAdd User requesting rewards info
    /// @return (
    ///     harvestableRewards - Amount of Summit available to harvest
    ///     vestingWinnings - Not applicable in OASIS
    ///     vestingDuration - Not applicable in OASIS
    ///     vestingStart - Not applicable in OASIS
    /// )
    function rewards(uint16 _pid, address _userAdd)
        external view override
        poolExists(_pid) validUserAdd(_userAdd)
    returns (uint256, uint256, uint256, uint256) {
        OasisPoolInfo storage pool = oasisPoolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_userAdd];

        // Temporary accSummitPerShare to bring rewards current if last reward timestamp is behind current timestamp
        uint256 accSummitPerShare = pool.accSummitPerShare;

        // Bring current if last reward timestamp is in past
        if (block.timestamp > launchTimestamp && block.timestamp > pool.lastRewardTimestamp && pool.supply != 0 && pool.live) {

            // Fetch the pool's summit yield emission to bring current
            uint256 poolSummitEmission = cartographer.poolSummitEmission(
                pool.lastRewardTimestamp < launchTimestamp ? launchTimestamp : pool.lastRewardTimestamp,
                pool.token,
                OASIS);

            // Recalculate accSummitPerShare with additional yield emission included
            accSummitPerShare = accSummitPerShare + (poolSummitEmission * 1e12 / pool.supply);
        }

        // Return harvestableRewards, other rewards variables are not applicable in the OASIS
        return ((user.staked * accSummitPerShare / 1e12) - user.debt, 0, 0, 0);
    }






    // ------------------------------------------------------------------
    // --   Y I E L D    G A M B L I N G   S T U B S
    // ------------------------------------------------------------------
    

    function hypotheticalRewards(uint16, address) external view override returns (uint256, uint256) { return (uint256(0), 0); }
    function rollover(uint8) external override {}
    function switchTotem(uint8, uint8, address) external override {}
    function isTotemInUse(uint8, address) external view override returns (bool) {}





    // -----------------------------------------------------
    // --   P O O L   I N T E R A C T I O N S
    // -----------------------------------------------------


    /// @dev Harvest any available rewards, and return that amount to be deposited in SUMMIT pool at same elevation
    /// @param _harvestPid Pool to harvest and cross compound rewards from
    /// @param _summitPid Pool to cross compound from
    /// @param _userAdd User requesting cross compound
    /// @return Amount cross compounded
    function crossCompound(uint16 _harvestPid, uint16 _summitPid, uint8, address _userAdd)
        external override
        nonReentrant onlyCartographer poolExists(_harvestPid) poolExists(_summitPid) validUserAdd(_userAdd)
        returns (uint256)
    {
        // HARVEST REWARDS
        OasisPoolInfo storage harvestPool = oasisPoolInfo[_harvestPid];
        OasisPoolInfo storage summitPool = oasisPoolInfo[_summitPid];
        UserInfo storage harvestUser = userInfo[_harvestPid][_userAdd];
        UserInfo storage summitUser = userInfo[_summitPid][_userAdd];
        
        updatePool(harvestPool.pid);

        // Calculate harvestable rewards
        uint256 harvestable = ((harvestUser.staked * harvestPool.accSummitPerShare) / 1e12) - harvestUser.debt;
        require(harvestable > 0, "Nothing to cross compound");

        // Update users debt to prevent double dipping
        harvestUser.debt = harvestUser.staked * harvestPool.accSummitPerShare / 1e12;

        // Deposit harvestable into summit pool at this elevation
        return unifiedDeposit(summitPool, summitUser, harvestable, _userAdd, true);
    }

    /// @dev Stub for oasis (can have more than 12 active pools at oasis so no way to harvest all)
    function harvestElevation(uint8, uint16, address) external override returns (uint256) {}

    /// @dev Stake funds in an OASIS pool
    /// @param _pid Pool to stake in
    /// @param _amount Amount to stake
    /// @param _userAdd User wanting to stake
    /// @return Amount deposited after deposit fee taken
    function deposit(uint16 _pid, uint256 _amount, uint256, uint8, address _userAdd)
        external override
        nonReentrant onlyCartographer poolExists(_pid) validUserAdd(_userAdd)
        returns (uint256, uint256)
    {
        OasisPoolInfo storage pool = oasisPoolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_userAdd];

        // Used shared deposit functionality with elevateDeposit
        return (unifiedDeposit(pool, user, _amount, _userAdd, false), 0);
    }


    /// @dev Elevate funds to the OASIS through the elevate pipeline
    /// @param _pid Pool to deposit funds in
    /// @param _amount Amount to elevate to OASIS
    /// @param _userAdd User elevating funds
    /// @return Amount deposited after fee taken
    function elevateDeposit(uint16 _pid, uint256 _amount, address, uint8, address _userAdd)
        external override
        nonReentrant onlyCartographer poolExists(_pid) validUserAdd(_userAdd)
        returns (uint256)
    {
        OasisPoolInfo storage pool = oasisPoolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_userAdd];   

        // Use shared deposit functionality with standard deposit 
        return unifiedDeposit(pool, user, _amount, _userAdd, true);
    }


    /// @dev Internal shared deposit functionality for elevate or standard deposit
    /// @param pool OasisPoolInfo of pool to deposit into
    /// @param user UserInfo of depositing user
    /// @param _amount Amount to deposit
    /// @param _userAdd User address
    /// @param _isInternalTransfer Flag to switch off certain functionality if transfer is exclusively within summit ecosystem
    /// @return Amount deposited after fee taken
    function unifiedDeposit(OasisPoolInfo storage pool, UserInfo storage user, uint256 _amount, address _userAdd, bool _isInternalTransfer)
        internal
        returns (uint256)
    {
        updatePool(pool.pid);

        // If user has previous amount staked, then harvest the rewards of that staked amount
        if (user.staked > 0) {
            // Calculate pending rewards for user
            uint256 harvestable = (user.staked * pool.accSummitPerShare / 1e12) - user.debt;
            // If user has harvestable rewards, redeem them
            if (harvestable > 0) {
                cartographer.redeemRewards(_userAdd, harvestable);
            }
        }

        uint256 amountAfterFee = _amount;

        // Handle taking fees and adding to running supply if amount depositing is non zero
        if (_amount > 0) {

            // Only move tokens (and take fee) on external transactions
            if (!_isInternalTransfer) {
                amountAfterFee = cartographer.depositTokenManagement(_userAdd, pool.token, pool.feeBP, _amount, 0);
            }
            
            // Increment running pool supply with amount after fee taken
            pool.supply += amountAfterFee;
        }
        
        // Update user info with new staked value, and calculate new debt
        user.staked += amountAfterFee;
        user.debt = user.staked * pool.accSummitPerShare / 1e12;

        // Return amount staked after fee        
        return amountAfterFee;
    }


    /// @dev Withdraw staked funds from pool
    /// @param _pid Pool to withdraw from
    /// @param _amount Amount to withdraw
    /// @param _userAdd User withdrawing
    /// @return True amount withdrawn
    function withdraw(uint16 _pid, uint256 _amount, uint256, address _userAdd)
        external override
        nonReentrant onlyCartographer poolExists(_pid) validUserAdd(_userAdd)
        returns (uint256, uint256)
    {
        UserInfo storage user = userInfo[_pid][_userAdd];
        OasisPoolInfo storage pool = oasisPoolInfo[_pid];

        // Validate amount attempting to withdraw
        require(_amount > 0 && user.staked >= _amount, "Bad withdrawal");
        
        // Shared functionality withdraw with elevateWithdraw
        return (unifiedWithdraw(pool,  user, _amount, _userAdd, false), 0);
    }


    /// @dev Withdraw staked funds to elevate them to another elevation
    /// @param _pid Pool to elevate funds from
    /// @param _amount Amount of funds to elevate
    /// @param _userAdd User elevating
    /// @return Amount withdrawn to be elevated
    function elevateWithdraw(uint16 _pid, uint256 _amount, address, address _userAdd)
        external override
        nonReentrant onlyCartographer poolExists(_pid) validUserAdd(_userAdd)
        returns (uint256)
    {
        UserInfo storage user = userInfo[_pid][_userAdd];       
        OasisPoolInfo storage pool = oasisPoolInfo[_pid];

        // Validate the amount to elevate
        require(_amount > 0 && user.staked >= _amount, "Bad transfer");

        // Shared withdraw functionality with standard withdraw
        return unifiedWithdraw(pool, user, _amount, _userAdd, true);
    }

    
    /// @dev Withdraw functionality shared between standardWithdraw and elevateWithdraw
    /// @param pool OasisPoolInfo of pool to withdraw from
    /// @param user UserInfo of withdrawing user
    /// @param _amount Amount to withdraw
    /// @param _userAdd User address
    /// @param _isInternalTransfer Flag to switch off certain functionality for elevate withdraw
    /// @return Amount withdrawn
    function unifiedWithdraw(OasisPoolInfo storage pool, UserInfo storage user, uint256 _amount, address _userAdd, bool _isInternalTransfer)
        internal
        returns (uint256)
    {
        updatePool(pool.pid);

        // Check harvestable rewards and withdraw if applicable
        uint256 harvestable = (user.staked * pool.accSummitPerShare / 1e12) - user.debt;
        if (harvestable > 0) {
            cartographer.redeemRewards(_userAdd, harvestable);
        }

        // Update pool running supply total with amount withdrawn
        pool.supply -= _amount;   

        // Update user's staked and debt     
        user.staked -= _amount;
        user.debt = user.staked * pool.accSummitPerShare / 1e12;
        

        // Signal cartographer to perform withdrawal function if not elevating funds
        // Elevated funds remain in the cartographer, or in the passthrough target, so no need to withdraw from anywhere as they would be immediately re-deposited
        uint256 amountAfterFee = _amount;
        if (!_isInternalTransfer) {
            amountAfterFee = cartographer.withdrawalTokenManagement(_userAdd, pool.token, pool.feeBP, _amount, 0);
        }

        // Return amount withdrawn
        return amountAfterFee;
    }
}
