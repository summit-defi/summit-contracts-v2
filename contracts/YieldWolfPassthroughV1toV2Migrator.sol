// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;
pragma experimental ABIEncoderV2;

import "./interfaces/IPassthrough.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";


/*
    Starts the migration process from V1 to V2, extracts and stores tokens that are available initially
    Full migration requires multiple followup iterations to extract all tokens from yield wolf ACMasterChef
    
    Each iteration:
        . `setTokenPassthroughStrategy` to Original Yield Wolf Passthrough contract
        
        . This will 'retire' the previous passthrough strategy (which is the same as the enacting strategy)
        . The `shares` amount will be withdrawn from the YieldWolf Vault
        . 1e12 tokens are sent back to the cartographer, the rest are distributed to the Summit treasuries
        
        . This will then 'enact' the strategy again, but with a token balance of 1e12

    At the end of the initial + iterative migration:
        . Migrated funds will be transferred back into the cartographer from the Summit treasuries
        . `finalizeMigration` will be called on this contract, sending the tokens back to the cartographer

    Finally:
        . Enact will be called on the V2 YieldWolfPassthrough
        . All funds will be pulled through into the YieldWolf Vault
        . Users funds will have been recovered, and the user experience completely untouched
*/ 

contract YieldWolfPassthroughV1toV2Migrator is IPassthrough, Ownable {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using Address for address;

    address public cartographer;
    IERC20 public passthroughToken;

    constructor(
        address _cartographer,
        address,
        uint256,
        IERC20 _token
    ) {
        require(_cartographer != address(0), "Cartographer missing");
        require(address(_token) != address(0), "Passthrough token missing");

        cartographer = _cartographer;
        passthroughToken = _token;
    }


    modifier onlyCartographer() {
        require(msg.sender == cartographer, "Only cartographer");
        _;
    }

    /// @dev Getter of passthroughToken
    function token() external view override returns (IERC20) {
        return passthroughToken;
    }


    /// @dev Finalize migration (send all funds back to cartographer)
    function finalizeMigration() public onlyOwner {
        uint256 balance = passthroughToken.balanceOf(address(this));
        passthroughToken.safeTransfer(cartographer, balance);
    }


    /// @dev Pulls all tokens from cartographer into this contract, to be held until finalization
    function enact()
        external override
        onlyCartographer
    {
        uint256 cartographerBalance = passthroughToken.balanceOf(cartographer);
        passthroughToken.safeTransferFrom(cartographer, address(this), cartographerBalance);
    }


    /// @dev If a deposit happens during migration, it will be absorbed into this contract and sent back to cartographer during finalization
    function deposit(uint256 _amount, address, address, address)
        external override
        onlyCartographer
        returns (uint256)
    {
        uint256 cartographerBalance = passthroughToken.balanceOf(cartographer);
        passthroughToken.safeTransferFrom(cartographer, address(this), cartographerBalance);

        return _amount;
    }


    /// @dev Withdraw during the migration will succeed normally if there are enough funds to cover, will fail otherwise
    /// @param _amount Amount to withdraw for user
    function withdraw(uint256 _amount, address, address, address)
        external override
        onlyCartographer
        returns (uint256)
    {
        uint256 balance = passthroughToken.balanceOf(address(this));
        require (_amount <= balance, "Not enough funds to cover withdrawal during migration");

        passthroughToken.safeTransfer(cartographer, _amount);

        return _amount;
    }

    /// @dev Retire this passthrough strategy
    ///   This contract will still hold the full balance of the migrating funds so that it can be used for multiple iterations of the migration
    ///   A tiny amount of tokens are sent back to cartographer to be used during enact of V1 Yield Wolf Passthrough
    function retire(address, address, address)
        external override
        onlyCartographer
    {
        passthroughToken.safeTransfer(cartographer, 1e12);
    }
}