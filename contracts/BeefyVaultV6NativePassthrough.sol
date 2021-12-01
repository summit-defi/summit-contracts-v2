// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IPassthrough.sol";

interface IBeefyVault {
    function available() external view returns (uint256);
    function getPricePerFullShare() external view returns (uint256);
    function depositAll() external;
    function deposit(uint _amount) external;
    function withdrawAll() external;
    function withdraw(uint _shares) external;
    function want() external returns (IERC20);
}


contract BeefyVaultV6NativePassthrough is IPassthrough {
    using SafeERC20 for IERC20;
    using Address for address;


    address public cartographer;
    address public vault;
    IERC20 public passthroughToken;
    uint256 public balance;


    constructor(
        address _cartographer,
        address _vault,
        IERC20 _token
    ) {
        require(_cartographer != address(0), "Cartographer missing");
        require(_vault != address(0), "Vault missing");
        require(address(_token) != address(0), "Passthrough token missing");
        require(address(_token) == address(IBeefyVault(_vault).want()), "Vault token doesnt match");

        cartographer = _cartographer;
        vault = _vault;
        passthroughToken = _token;

        passthroughToken.approve(vault, type(uint256).max);
    }


    modifier onlyCartographer() {
        require(msg.sender == cartographer, "Only cartographer");
        _;
    }

    /// @dev Getter of passthroughToken
    function token() external view override returns (IERC20) {
        return passthroughToken;
    }



    /// @dev Getter of passthroughToken balance held in the vault
    function vaultBalance() public view returns (uint256) {
        return IERC20(vault).balanceOf(address(this)) * IBeefyVault(vault).getPricePerFullShare() / 1e18;
    }

    /// @dev Enact this passthrough strategy
    function enact()
        external override
        onlyCartographer
    {
        uint256 cartographerBalance = passthroughToken.balanceOf(cartographer);
        passthroughToken.safeTransferFrom(cartographer, address(this), cartographerBalance);
        IBeefyVault(vault).depositAll();
        balance = cartographerBalance;
    }


    /// @dev Deposit the amount of passthrough token in contract to the vault and update balance
    function deposit(uint256 _amount, address, address)
        external override
        onlyCartographer
        returns (uint256)
    {
        // Transfer funds from cartographer to this contract
        uint256 cartographerBalance = passthroughToken.balanceOf(cartographer);
        passthroughToken.safeTransferFrom(cartographer, address(this), cartographerBalance);

        // Deposit all passthroughTokens into vault, track deposited change during transaction
        uint256 balanceInit = vaultBalance();
        IBeefyVault(vault).depositAll();
        uint256 balanceFinal = vaultBalance();

        // True amount deposited into vault
        uint256 trueDepositedAmount = balanceFinal - balanceInit;

        // Add min(trueDepositedAmount, _amount) to running vaulted balance. They should usually match, if _amount is less, some fee taken by passthrough target 
        uint256 minDepositedAmount = trueDepositedAmount > _amount ? _amount : trueDepositedAmount;
        balance += minDepositedAmount;

        return minDepositedAmount;
    }

    function distributeRemainingBalance(address _expeditionTreasuryAdd, address _treasuryAdd) internal {
        uint256 toDistribute = passthroughToken.balanceOf(address(this));

        if (toDistribute == 0) return;

        passthroughToken.safeTransfer(_expeditionTreasuryAdd, toDistribute * 92 / 100);
        passthroughToken.safeTransfer(_treasuryAdd, toDistribute * 8 / 100);
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
        // Remove user's withdraw amount from the running vault balance
        balance -= _amount;

        // The amount of passthroughTokens available to be withdrawn
        uint256 tokensAvailableForWithdraw = vaultBalance() - balance;

        // Use the price per full share to calculate the shares available to withdraw
        uint256 sharesAvailableForWithdraw = (tokensAvailableForWithdraw * 1e18) / IBeefyVault(vault).getPricePerFullShare();

        // Withdraw users shares and additional rewards tokens and track true passthroughToken amount withdrawn during transaction
        uint256 passthroughTokenBalanceInit = passthroughToken.balanceOf(address(this));
        IBeefyVault(vault).withdraw(sharesAvailableForWithdraw);
        uint256 passthroughTokenBalanceFinal = passthroughToken.balanceOf(address(this));
        uint256 trueWithdrawnAmount = passthroughTokenBalanceFinal - passthroughTokenBalanceInit;

        // If amount withdrawn covers users withdraw amount, return the users withdraw amount, else return the amount that was withdrawn after a fee was taken
        uint256 usersTrueWithdrawnAmount = trueWithdrawnAmount > _amount ? _amount : trueWithdrawnAmount;

        // Transfer user's withdrawn amount back to cartographer
        passthroughToken.safeTransfer(cartographer, usersTrueWithdrawnAmount);

        // Distribute remaining rewards in this contract
        distributeRemainingBalance(_expeditionTreasuryAdd, _treasuryAdd);

        return usersTrueWithdrawnAmount;
    }

    function retire(address _expeditionTreasuryAdd, address _treasuryAdd)
        external override
        onlyCartographer
    {
        // Withdraw all from the vault
        uint256 sharesBalance = IERC20(vault).balanceOf(address(this));
        if (sharesBalance > 0) {
            IBeefyVault(vault).withdrawAll();
        }
        
        uint256 tokenBalance = passthroughToken.balanceOf(address(this));

        // Return collective user's amount back to cartographer
        uint256 usersWithdrawn = tokenBalance > balance ? balance : tokenBalance;
        passthroughToken.safeTransfer(cartographer, usersWithdrawn);

        // Reset user's value in vault
        balance = 0;

        // Distribute the remaining rewards in this contract
        distributeRemainingBalance(_expeditionTreasuryAdd, _treasuryAdd);
    }
}