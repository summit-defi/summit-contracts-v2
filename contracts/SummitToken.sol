// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "./libs/ERC20Mintable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SummitToken is ERC20Mintable('SummitToken', 'SUMMIT'), ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 constant oldSummit = IERC20(0x8F9bCCB6Dd999148Da1808aC290F2274b13D7994);
    uint256 constant swapRatio = 1000;
    address constant burnAdd = 0x000000000000000000000000000000000000dEaD;

    event SummitTokenSwap(address indexed user, uint256 oldSummitAmount, uint256 newSummitAmount);

    /// @dev Token swap from V1 token
    function tokenSwap(uint256 _amount)
        public
        nonReentrant
    {
        require(oldSummit.balanceOf(msg.sender) >= _amount, "Not enough SUMMIT");
        
        oldSummit.safeTransferFrom(msg.sender, address(this), _amount);
        oldSummit.safeTransfer(burnAdd, _amount);

        uint256 newSummitAmount = _amount * swapRatio / 10000;
        mint(msg.sender, newSummitAmount);

        emit SummitTokenSwap(msg.sender, _amount, newSummitAmount);
    }
}
