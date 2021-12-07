// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "./Cartographer.sol";
import "./interfaces/ISubCart.sol";
import "./SummitToken.sol";
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
--   O A S I S   E X P L A N A T I O N
---------------------------------------------------------------------------------------------


The OASIS is the safest of the elevations.
OASIS pools exactly mirror standard yield farming experiences of other projects.
OASIS pools guarantee yield, and no multiplying or risk takes place at this elevation.
The OASIS does not have totems in the contract, however in the frontend funds staked in the OASIS are represented by the OTTER.

*/
contract CartographerOasis is ISubCart, Ownable, Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;


    // ---------------------------------------
    // --   V A R I A B L E S
    // ---------------------------------------

    Cartographer public cartographer;
    uint256 public launchTimestamp = 1641028149;                        // 2022-1-1, will be updated when summit ecosystem switched on
    uint8 constant OASIS = 0;                                           // Named constant to make reusable elevation functions easier to parse visually
    address public summitTokenAddress;
    
    struct UserInfo {
        uint256 debt;                                                   // Debt is (accSummitPerShare * staked) at time of staking and is used in the calculation of yield.
        uint256 staked;                                                 // The amount a user invests in an OASIS pool
    }

    mapping(address => EnumerableSet.AddressSet) userInteractingPools;

    struct OasisPoolInfo {
        address token;                                                   // Reward token yielded by the pool

        uint256 supply;                                                 // Running total of the amount of tokens staked in the pool
        bool live;                                                      // Turns on and off the pool
        uint256 lastRewardTimestamp;                                    // Latest timestamp that SUMMIT distribution occurred
        uint256 accSummitPerShare;                                      // Accumulated SUMMIT per share, raised to 1e12
    }

    EnumerableSet.AddressSet poolTokens;

    mapping(address => OasisPoolInfo) public poolInfo;              // Pool info for each oasis pool
    mapping(address => mapping(address => UserInfo)) public userInfo;    // Users running staking information
    
    





    // ---------------------------------------
    // --  A D M I N I S T R A T I O N
    // ---------------------------------------


    /// @dev Constructor simply setting address of the cartographer
    constructor(address _Cartographer)
    {
        require(_Cartographer != address(0), "Cartographer required");
        cartographer = Cartographer(_Cartographer);
    }

    /// @dev Unused initializer as part of the SubCartographer interface
    function initialize(address, address _summitTokenAddress)
        external override
        initializer onlyCartographer
    {
        require(_summitTokenAddress != address(0), "SummitToken is zero");
        summitTokenAddress = _summitTokenAddress;
    }

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
    modifier nonDuplicated(address _token) {
        require(!poolTokens.contains(_token), "duplicated!");
        _;
    }
    modifier poolExists(address _token) {
        require(poolTokens.contains(_token), "Pool doesnt exist");
        _;
    }
    




    // ---------------------------------------
    // --   U T I L S (inlined for brevity)
    // ---------------------------------------
    

    function supply(address _token) external view override returns (uint256) {
        return poolInfo[_token].supply;
    }
    function selectedTotem(address) external pure override returns (uint8) {
        return 0;
    }
    function isTotemSelected(address) external pure override returns (bool) {
        return true;
    }
    function userStakedAmount(address _token, address _userAdd) external view override returns (uint256) {
        return userInfo[_token][_userAdd].staked;
    }

    function getUserInteractingPools(address _userAdd) public view returns (address[] memory) {
        address[] memory pools = new address[](userInteractingPools[_userAdd].length());
        for (uint16 index = 0; index < userInteractingPools[_userAdd].length(); index++) {
            pools[index] = userInteractingPools[_userAdd].at(index);
        }
        return pools;
    }
    function getPools() public view returns (address[] memory) {
        address[] memory pools = new address[](poolTokens.length());
        for (uint16 index = 0; index < poolTokens.length(); index++) {
            pools[index] = poolTokens.at(index);
        }
        return pools;
    }



    // ---------------------------------------
    // --   P O O L   M A N A G E M E N T
    // ---------------------------------------


    /// @dev Registers pool everywhere needed
    /// @param _token Token to register with
    /// @param _live Whether pool is enabled at time of creation
    function registerPool(address _token, bool _live) internal {
        // Marks token as enabled at elevation, and adds token allocation to token's shared allocation and total allocation
        if (_live) cartographer.setIsTokenEarningAtElevation(_token, OASIS, true);

        // Add token to poolTokens
        poolTokens.add(_token);
    }


    /// @dev Creates a pool at the oasis
    /// @param _token Pool token
    /// @param _live Whether the pool is enabled initially
    function add(address _token,  bool _live)
        external override
        onlyCartographer nonDuplicated(_token)
    {
        // Register pid and token where needed
        registerPool(_token, _live);

        // Create the initial state of the pool
        poolInfo[_token] = OasisPoolInfo({
            token: _token,

            supply: 0,
            live: _live,
            accSummitPerShare: 0,
            lastRewardTimestamp: block.timestamp
        });
    }

    
    /// @dev Update a given pools deposit or live status
    /// @param _token Pool token identifier
    /// @param _live If pool is available for staking
    function set(address _token, bool _live)
        external override
        onlyCartographer poolExists(_token)
    {
        OasisPoolInfo storage pool = poolInfo[_token];
        updatePool(_token);

        // If live status of pool changes, update cartographer allocations
        if (pool.live != _live) cartographer.setIsTokenEarningAtElevation(pool.token, OASIS, _live);

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
    /// @param _token Pool identifier to update
    function updatePool(address _token)
        public
        poolExists(_token)
    {
        OasisPoolInfo storage pool = poolInfo[_token];

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
            return;
        }

        // Mint Summit according to pool allocation and token share in pool, retrieve amount of summit minted for staking
        uint256 summitReward = cartographer.poolSummitEmission(pool.lastRewardTimestamp, pool.token, OASIS);

        // Update accSummitPerShare with the amount of staking summit minted.
        pool.accSummitPerShare = pool.accSummitPerShare + (summitReward * 1e12 / pool.supply);

        // Bring last reward timestamp current
        pool.lastRewardTimestamp = block.timestamp;
    }
    




    // ---------------------------------------
    // --   P O O L   R E W A R D S
    // ---------------------------------------


    /// @dev Fetch guaranteed yield rewards of the pool
    /// @param _token Pool to fetch rewards from
    /// @param _userAdd User requesting rewards info
    /// @return (
    ///     claimableRewards - Amount of Summit available to Claim
    ///     vestingWinnings - Not applicable in OASIS
    ///     vestingDuration - Not applicable in OASIS
    ///     vestingStart - Not applicable in OASIS
    /// )
    function rewards(address _token, address _userAdd)
        public view
        poolExists(_token) validUserAdd(_userAdd)
    returns (uint256, uint256, uint256, uint256) {
        OasisPoolInfo storage pool = poolInfo[_token];
        UserInfo storage user = userInfo[_token][_userAdd];

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

        // Return claimableRewards, other rewards variables are not applicable in the OASIS
        return ((user.staked * accSummitPerShare / 1e12) - user.debt, 0, 0, 0);
    }






    // ------------------------------------------------------------------
    // --   Y I E L D    G A M B L I N G   S T U B S
    // ------------------------------------------------------------------
    

    function hypotheticalRewards(address, address) public pure returns (uint256, uint256) { return (uint256(0), 0); }
    function rollover() external override {}
    function switchTotem(uint8, address) external override {}




    // -----------------------------------------------------
    // --   P O O L   I N T E R A C T I O N S
    // -----------------------------------------------------


    /// @dev Increments or decrements user's pools at elevation staked, and adds to  / removes from users list of staked pools
    function _markUserInteractingWithPool(address _token, address _userAdd, bool _interacting) internal {
        require(!_interacting || userInteractingPools[_userAdd].length() < 12, "Staked pool cap (12) reached");

        if (_interacting) {
            userInteractingPools[_userAdd].add(_token);
        } else {
            userInteractingPools[_userAdd].remove(_token);
        }
    }
    function userInteractingWithPool(address _token, address _userAdd) public view poolExists(_token) returns (bool) {
        return userInteractingPools[_userAdd].contains(_token);
    }

    /// @dev Claim an entire elevation
    /// @param _userAdd User Claiming
    function claimElevation(address _userAdd)
        external override
        validUserAdd(_userAdd) onlyCartographer
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
        
        return claimable;
    }

    /// @dev Stake funds in an OASIS pool
    /// @param _token Pool to stake in
    /// @param _amount Amount to stake
    /// @param _userAdd User wanting to stake
    /// @param _isElevate Whether this is the deposit half of an elevate tx
    /// @return Amount deposited after deposit fee taken
    function deposit(address _token, uint256 _amount, address _userAdd, bool _isElevate)
        external override
        nonReentrant onlyCartographer poolExists(_token) validUserAdd(_userAdd)
        returns (uint256)
    {
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
        nonReentrant onlyCartographer poolExists(_token) validUserAdd(_userAdd)
        returns (uint256)
    {
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




    /// @dev Shared Claim functionality with cross compounding built in
    /// @param pool OasisPoolInfo of pool to withdraw from
    /// @param user UserInfo of withdrawing user
    /// @param _userAdd User address
    /// @return Amount claimable
    function _unifiedClaim(OasisPoolInfo storage pool, UserInfo storage user, address _userAdd)
        internal
        returns (uint256)
    {
        updatePool(pool.token);

        // Check claimable rewards and withdraw if applicable
        uint256 claimable = (user.staked * pool.accSummitPerShare / 1e12) - user.debt;

        // Claim rewards
        if (claimable > 0) {
            cartographer.claimWinnings(_userAdd, pool.token, claimable);
        }

        // Set debt, may be overwritten in subsequent deposit / withdraw, but may not so it needs to be set here
        user.debt = user.staked * pool.accSummitPerShare / 1e12;

        // Return amount Claimed / claimable
        return claimable;
    }


    /// @dev Internal shared deposit functionality for elevate or standard deposit
    /// @param pool OasisPoolInfo of pool to deposit into
    /// @param user UserInfo of depositing user
    /// @param _amount Amount to deposit
    /// @param _userAdd User address
    /// @param _isInternalTransfer Flag to switch off certain functionality if transfer is exclusively within summit ecosystem
    /// @return Amount deposited after fee taken
    function _unifiedDeposit(OasisPoolInfo storage pool, UserInfo storage user, uint256 _amount, address _userAdd, bool _isInternalTransfer)
        internal
        returns (uint256)
    {
        updatePool(pool.token);

        uint256 amountAfterFee = _amount;

        // Handle taking fees and adding to running supply if amount depositing is non zero
        if (_amount > 0) {

            // Only move tokens (and take fee) on external transactions
            if (!_isInternalTransfer) {
                amountAfterFee = cartographer.depositTokenManagement(_userAdd, pool.token, _amount);
            }
            
            // Increment running pool supply with amount after fee taken
            pool.supply += amountAfterFee;
        }
        
        // Update user info with new staked value, and calculate new debt
        user.staked += amountAfterFee;
        user.debt = user.staked * pool.accSummitPerShare / 1e12;

        // If the user is interacting with this pool after the meat of the transaction completes
        _markUserInteractingWithPool(pool.token, _userAdd, user.staked > 0);

        // Return amount staked after fee        
        return amountAfterFee;
    }

    
    /// @dev Withdraw functionality shared between standardWithdraw and elevateWithdraw
    /// @param pool OasisPoolInfo of pool to withdraw from
    /// @param user UserInfo of withdrawing user
    /// @param _amount Amount to withdraw
    /// @param _userAdd User address
    /// @param _isInternalTransfer Flag to switch off certain functionality for elevate withdraw
    /// @param _isEmergencyWithdraw Whether the withdraw should have minimum effects
    /// @return Amount withdrawn
    function _unifiedWithdraw(OasisPoolInfo storage pool, UserInfo storage user, uint256 _amount, address _userAdd, bool _isInternalTransfer, bool _isEmergencyWithdraw)
        internal
        returns (uint256)
    {
        // Validate amount attempting to withdraw
        require(_amount > 0 && user.staked >= _amount, "Bad withdrawal");

        if (!_isEmergencyWithdraw) {
            updatePool(pool.token);
        }

        // Signal cartographer to perform withdrawal function if not elevating funds
        // Elevated funds remain in the cartographer, or in the passthrough target, so no need to withdraw from anywhere as they would be immediately re-deposited
        uint256 amountAfterFee = _amount;
        if (!_isInternalTransfer) {
            amountAfterFee = cartographer.withdrawalTokenManagement(_userAdd, pool.token, _amount);
        }

        // Update pool running supply total with amount withdrawn
        pool.supply -= _amount;

        // Update user's staked and debt     
        user.staked -= _amount;
        user.debt = user.staked * pool.accSummitPerShare / 1e12;

        // If the user is interacting with this pool after the meat of the transaction completes
        _markUserInteractingWithPool(pool.token, _userAdd, user.staked > 0);

        // Return amount withdrawn
        return amountAfterFee;
    }
}
