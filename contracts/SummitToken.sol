// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "./libs/ERC20Mintable.sol";
import "./PresetPausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract SummitToken is ERC20Mintable('SummitToken', 'SUMMIT') {}
