// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;
pragma experimental ABIEncoderV2;

import "./interfaces/IPassthrough.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";


interface IYieldWolfStrategy {
    function stakeToken() external view returns (address);

    function sharesTotal() external view returns (uint256);

    // function earn(address _bountyHunter) external returns (uint256);

    // function deposit(uint256 _depositAmount) external returns (uint256);

    // function withdraw(
    //     uint256 _withdrawAmount,
    //     address _withdrawTo,
    //     address _bountyHunter,
    //     uint256 _ruleFeeAmount
    // ) external returns (uint256);

    // function router() external view returns (address);

    // function token0() external view returns (address);

    // function token1() external view returns (address);

    function totalStakeTokens() external view returns (uint256);

    // function setSwapRouterEnabled(bool _enabled) external;

    // function setSwapPath(
    //     address _token0,
    //     address _token1,
    //     address[] calldata _path
    // ) external;

    // function setExtraEarnTokens(address[] calldata _extraEarnTokens) external;
}

struct PoolInfo {
    IERC20 stakeToken;          
    IYieldWolfStrategy strategy;
}

struct UserInfo {
    uint256 shares;
}


interface IYieldWolf {
    function deposit(uint256 _pid, uint256 _amount) external;
    function withdraw(uint256 _pid, uint256 _amount) external;
    function poolInfo(uint256 _pid) external view returns (PoolInfo memory);
    function userInfo(uint256 _pid, address _user) external view returns (UserInfo memory);
    function stakedTokens(uint256 _pid, address _user) external view returns (uint256);
}


contract YieldWolfPassthroughV1 is IPassthrough, Ownable {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using Address for address;

    address public cartographer;
    IYieldWolf public yieldWolf;
    uint256 public yieldWolfPid;

    IERC20 public passthroughToken;
    uint256 public balance;

    // 99% of the time this will be an empty array, In the rare case it isn't, the extra earn tokens will be distributed automatically
    EnumerableSet.AddressSet extraEarnTokens;

    constructor(
        address _cartographer,
        address _yieldWolf,
        uint256 _yieldWolfPid,
        IERC20 _token
    ) {
        require(_cartographer != address(0), "Cartographer missing");
        require(_yieldWolf != address(0), "YieldWolf missing");
        require(address(_token) != address(0), "Passthrough token missing");

        PoolInfo memory yieldWolfPool = IYieldWolf(_yieldWolf).poolInfo(_yieldWolfPid);
        require(address(yieldWolfPool.stakeToken) == address(_token), "Pool must match passthrough token");


        cartographer = _cartographer;
        yieldWolf = IYieldWolf(_yieldWolf);
        yieldWolfPid = _yieldWolfPid;
        passthroughToken = _token;

        passthroughToken.approve(address(yieldWolf), type(uint).max);
    }


    modifier onlyCartographer() {
        require(msg.sender == cartographer, "Only cartographer");
        _;
    }

    /// @dev Getter of passthroughToken
    function token() external view override returns (IERC20) {
        return passthroughToken;
    }

    /// @dev Management of extra earn tokens
    function getExtraEarnTokens() public view returns (address[] memory) {
        return extraEarnTokens.values();
    }
    function addExtraEarnToken(address _extraEarnToken) public onlyOwner {
        require(_extraEarnToken != address(0), "Missing extra earn token");
        extraEarnTokens.add(_extraEarnToken);
    }
    function removeExtraEarnToken(address _extraEarnToken) public onlyOwner {
        // require(extraEarnTokens.contains(_extraEarnToken), "Extra earn token not in list");
        extraEarnTokens.remove(_extraEarnToken);
    }

    /// @dev Gets the value of each share in the underlying passthrough token
    function getPricePerFullShare() public view returns (uint256) {
        uint256 vaultTotalShares = yieldWolf.poolInfo(yieldWolfPid).strategy.sharesTotal();
        return vaultTotalShares == 0 ?
            1e18 :
            yieldWolf.poolInfo(yieldWolfPid).strategy.totalStakeTokens() * 1e18 / vaultTotalShares;
    }


    /// @dev Getter of balance staked in yieldWolf
    function vaultBalance() public view returns (uint256) {
        return yieldWolf.userInfo(yieldWolfPid, address(this)).shares * getPricePerFullShare() / 1e18;
    }


    function distributeRemainingBalance(address _expeditionTreasuryAdd, address _treasuryAdd, address _lpGeneratorAdd) internal {
        distributeToken(passthroughToken, _expeditionTreasuryAdd, _treasuryAdd, _lpGeneratorAdd);

        for (uint256 index = 0; index < extraEarnTokens.length(); index++) {
            distributeToken(IERC20(extraEarnTokens.at(index)), _expeditionTreasuryAdd, _treasuryAdd, _lpGeneratorAdd);
        }
    }

    function distributeToken(IERC20 distToken, address _expeditionTreasuryAdd, address _treasuryAdd, address _lpGeneratorAdd) internal {
        uint256 toDistribute = distToken.balanceOf(address(this));
        if (toDistribute == 0) return;

        distToken.safeTransfer(_expeditionTreasuryAdd, toDistribute * 60 / 100);
        distToken.safeTransfer(_treasuryAdd, toDistribute * 20 / 100);
        distToken.safeTransfer(_lpGeneratorAdd, toDistribute * 20 / 100);
    }


    /// @dev Enact this passthrough strategy
    function enact()
        external override
        onlyCartographer
    {
        uint256 cartographerBalance = passthroughToken.balanceOf(cartographer);
        passthroughToken.safeTransferFrom(cartographer, address(this), cartographerBalance);
        yieldWolf.deposit(yieldWolfPid, cartographerBalance);
        balance = cartographerBalance;
    }


    /// @dev Deposit the amount of passthrough token in contract to the yieldWolf and take deposit fee, distribute any fees / rewards that are harvested
    function deposit(uint256 _amount, address, address, address)
        external override
        onlyCartographer
        returns (uint256)
    {
        uint256 cartographerBalance = passthroughToken.balanceOf(cartographer);
        passthroughToken.safeTransferFrom(cartographer, address(this), cartographerBalance);

        // Deposit user's amount into yieldWolf
        uint256 balanceInit = vaultBalance();
        yieldWolf.deposit(yieldWolfPid, _amount);
        uint256 balanceFinal = vaultBalance();

        // True amount deposited in yieldWolf
        uint256 trueDepositedAmount = balanceFinal - balanceInit;

        // Add min(trueDepositedAmount, _amount) to running vaulted balance. They should usually match, if _amount is less, some fee taken by passthrough target
        uint256 minDepositedAmount = trueDepositedAmount > _amount ? _amount : trueDepositedAmount;
        balance += minDepositedAmount;

        return minDepositedAmount;
    }


    /// @dev Withdraw passthrough token back to cartographer, send any extra rewards to accumulator addresses
    /// @param _amount Amount to withdraw for user
    /// @param _expeditionTreasuryAdd Address of expedition accumulator
    /// @param _treasuryAdd Address of dev fund accumulator
    function withdraw(uint256 _amount, address _expeditionTreasuryAdd, address _treasuryAdd, address _lpGeneratorAdd)
        external override
        onlyCartographer
        returns (uint256)
    {
        // Remove user's withdraw amount from the running vault balance
        balance -= _amount;

        // The amount of passthroughTokens available to be withdrawn
        uint256 tokensAvailableForWithdraw = vaultBalance() - balance;

        // Use the price per full share to calculate the shares available to withdraw
        uint256 sharesAvailableForWithdraw = (tokensAvailableForWithdraw * 1e18) / getPricePerFullShare();

        // Withdraw users shares and additional rewards tokens and track true passthroughToken amount withdrawn during transaction
        uint256 passthroughTokenBalanceInit = passthroughToken.balanceOf(address(this));
        yieldWolf.withdraw(yieldWolfPid, sharesAvailableForWithdraw);
        uint256 passthroughTokenBalanceFinal = passthroughToken.balanceOf(address(this));
        uint256 trueWithdrawnAmount = passthroughTokenBalanceFinal - passthroughTokenBalanceInit;

        // If amount withdrawn covers users withdraw amount, return the users withdraw amount, else return the amount that was withdrawn after a fee was taken
        uint256 usersTrueWithdrawnAmount = trueWithdrawnAmount > _amount ? _amount : trueWithdrawnAmount;

        // Transfer user's withdrawn amount back to cartographer
        passthroughToken.safeTransfer(cartographer, usersTrueWithdrawnAmount);

        // Distribute remaining rewards in this contract
        distributeRemainingBalance(_expeditionTreasuryAdd, _treasuryAdd, _lpGeneratorAdd);

        return usersTrueWithdrawnAmount;
    }

    /// @dev Retire this passthrough strategy, send all user's funds back to cartographer and distribute any rewards
    /// @param _expeditionTreasuryAdd Address of expedition accumulator
    /// @param _treasuryAdd Address of the dev fund accumulator
    function retire(address _expeditionTreasuryAdd, address _treasuryAdd, address _lpGeneratorAdd)
        external override
        onlyCartographer
    {
        // Withdraw all from the vault
        uint256 sharesBalance = yieldWolf.userInfo(yieldWolfPid, address(this)).shares;
        if (sharesBalance > 0) {
            yieldWolf.withdraw(yieldWolfPid, sharesBalance);
        }
        
        uint256 tokenBalance = passthroughToken.balanceOf(address(this));

        // Return collective user's amount back to cartographer
        uint256 usersWithdrawn = tokenBalance > balance ? balance : tokenBalance;
        passthroughToken.safeTransfer(cartographer, usersWithdrawn);


        // Reset user's value in vault
        balance = 0;

        // Distribute the remaining rewards in this contract
        distributeRemainingBalance(_expeditionTreasuryAdd, _treasuryAdd, _lpGeneratorAdd);
    }
}