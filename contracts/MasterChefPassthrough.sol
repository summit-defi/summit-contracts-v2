// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IPassthrough.sol";


struct PoolInfo {
    IERC20 lpToken;          
    uint256 allocPoint;      
    uint256 lastRewardBlock; 
    uint256 accCakePerShare;
}

struct UserInfo {
    uint256 amount;
    uint256 rewardDebt;
}


interface IMasterChef {
    function deposit(uint256 _pid, uint256 _amount) external;
    function withdraw(uint256 _pid, uint256 _amount) external;
    function poolInfo(uint256 _pid) external view returns (PoolInfo memory);
    function userInfo(uint256 _pid, address _user) external view returns (UserInfo memory);
}


contract MasterChefPassthrough is IPassthrough, Ownable {
    using SafeERC20 for IERC20;
    using Address for address;

    address public cartographer;
    address public masterChef;
    uint256 public masterChefPid;

    IERC20 public passthroughToken;
    IERC20 public rewardToken;

    constructor(
        address _cartographer,
        address _masterChef,
        uint256 _masterChefPid,
        IERC20 _token,
        IERC20 _rewardToken
    ) {
        require(_cartographer != address(0), "Cartographer missing");
        require(_masterChef != address(0), "MasterChef missing");
        require(address(_token) != address(0), "Passthrough token missing");
        require(address(_rewardToken) != address(0), "Reward token missing");

        PoolInfo memory chefPool = IMasterChef(_masterChef).poolInfo(_masterChefPid);
        require(address(chefPool.lpToken) == address(_token), "Pool must match passthrough token");


        cartographer = _cartographer;
        masterChef = _masterChef;
        masterChefPid = _masterChefPid;
        passthroughToken = _token;
        rewardToken = _rewardToken;

        passthroughToken.approve(masterChef, type(uint).max);
    }


    modifier onlyCartographer() {
        require(msg.sender == cartographer, "Only cartographer");
        _;
    }

    /// @dev Getter of passthroughToken
    function token() external view override returns (IERC20) {
        return passthroughToken;
    }


    /// @dev Getter of balance staked in masterChef
    function balance() public view returns (uint256) {
        return IMasterChef(masterChef).userInfo(masterChefPid, address(this)).amount;
    }


    function distributeRewards(address _expeditionTreasuryAdd, address _treasuryAdd) internal {
        uint256 toDistribute = rewardToken.balanceOf(address(this));

        // Early exit if nothing to distribute
        if (toDistribute == 0) return;

        rewardToken.safeTransfer(_expeditionTreasuryAdd, toDistribute * 92 / 100);
        rewardToken.safeTransfer(_treasuryAdd, toDistribute * 8 / 100);
    }


    /// @dev Enact this passthrough strategy
    function enact()
        external override
        onlyCartographer
    {
        uint256 cartographerBalance = passthroughToken.balanceOf(cartographer);
        passthroughToken.safeTransferFrom(cartographer, address(this), cartographerBalance);
        IMasterChef(masterChef).deposit(masterChefPid, cartographerBalance);
    }


    /// @dev Deposit the amount of passthrough token in contract to the masterChef and take deposit fee, distribute any fees / rewards that are harvested
    /// @param _amount Amount the user is attempting to deposit
    /// @param _expeditionTreasuryAdd Expedition accumulator
    /// @param _treasuryAdd Dev fund accumulator
    function deposit(uint256 _amount, address _expeditionTreasuryAdd, address _treasuryAdd)
        external override
        onlyCartographer
        returns (uint256)
    {
        uint256 cartographerBalance = passthroughToken.balanceOf(cartographer);
        passthroughToken.safeTransferFrom(cartographer, address(this), cartographerBalance);

        // Deposit user's amount into masterChef
        uint256 balanceInit = balance();
        IMasterChef(masterChef).deposit(masterChefPid, _amount);
        uint256 balanceFinal = balance();

        // True amount deposited in masterChef
        uint256 trueDepositedAmount = balanceFinal - balanceInit;

        distributeRewards(_expeditionTreasuryAdd, _treasuryAdd);

        return trueDepositedAmount;
    }


    /// @dev Withdraw passthrough token back to cartographer, send any extra rewards to accumulator addresses
    /// @param _amount Amount to withdraw for user
    /// @param _expeditionTreasuryAdd Address of expedition accumulator
    /// @param _treasuryAdd Address of dev fund accumulator
    function withdraw(uint256 _amount, address _expeditionTreasuryAdd, address _treasuryAdd)
        external override
        onlyCartographer
        returns (uint256)
    {
        uint256 balanceInit = balance();
        IMasterChef(masterChef).withdraw(masterChefPid, _amount);
        uint256 balanceFinal = balance();

        // True amount withdrawn from masterChef
        uint256 withdrawnAmount = balanceInit - balanceFinal;

        // Return withdrawn amount back to cartographer
        passthroughToken.safeTransfer(cartographer, withdrawnAmount);
        
        // Distribute the remaining rewards in this contract
        distributeRewards(_expeditionTreasuryAdd, _treasuryAdd);

        return withdrawnAmount;
    }

    /// @dev Retire this passthrough strategy, send all user's funds back to cartographer and distribute any rewards
    /// @param _expeditionTreasuryAdd Address of expedition accumulator
    /// @param _treasuryAdd Address of the dev fund accumulator
    function retire(address _expeditionTreasuryAdd, address _treasuryAdd)
        external override
        onlyCartographer
    {
        uint256 stakedAmount = balance();

        // Withdraw all from the masterChef
        IMasterChef(masterChef).withdraw(masterChefPid, stakedAmount);

        // Return collective user's amount back to cartographer
        passthroughToken.safeTransfer(cartographer, stakedAmount);

        // Distribute the remaining rewards in this contract
        distributeRewards(_expeditionTreasuryAdd, _treasuryAdd);
    }
}