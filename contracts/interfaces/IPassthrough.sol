// SPDX-License-Identifier: MIT

pragma solidity 0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/// @dev Passthrough is an interface to send tokens to another contract and use the reward token in the Summit ecocystem
interface IPassthrough {
    function token() external view returns (IERC20);
    function enact() external;
    function deposit(uint256, address, address) external returns (uint256);
    function withdraw(uint256, address, address) external returns (uint256);
    function retire(address, address) external;
}