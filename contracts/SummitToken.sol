// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "./libs/ERC20Mintable.sol";
import "./PresetPausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract SummitToken is ERC20Mintable('SummitToken', 'SUMMIT'), ReentrancyGuard, PresetPausable, Initializable {
    using SafeERC20 for IERC20;

    IERC20 public oldSummit;
    uint256 constant swapRatio = 1000;
    address constant burnAdd = 0x000000000000000000000000000000000000dEaD;

    event SummitTokenSwap(address indexed user, uint256 oldSummitAmount, uint256 newSummitAmount);

    function initialize(address _oldSummit)
        public
        initializer onlyOwner
    {
        require(_oldSummit != address(0), "Missing Old Summit");
        oldSummit = IERC20(_oldSummit);
    }

    /// @dev Token swap from V1 token
    function tokenSwap(uint256 _amount)
        public whenNotPaused
        nonReentrant
    {
        require(address(oldSummit) != address(0), "Old SUMMIT not set");
        require(_amount <= oldSummit.balanceOf(msg.sender), "Not enough SUMMIT");
        
        oldSummit.safeTransferFrom(msg.sender, address(this), _amount);
        oldSummit.safeTransfer(burnAdd, _amount);

        uint256 newSummitAmount = _amount * swapRatio / 10000;
        _mint(msg.sender, newSummitAmount);

        emit SummitTokenSwap(msg.sender, _amount, newSummitAmount);
    }
}
