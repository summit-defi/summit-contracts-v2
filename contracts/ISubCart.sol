//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface ISubCart {
    function initialize(address _elevationHelper, address _summit) external;
    function enable(uint256 _launchTimestamp) external;
    function add(address _token, bool _live) external;
    function set(address _token, bool _live) external;
    function massUpdatePools() external;

    function rollover() external;

    function switchTotem(uint8 _totem, address _userAdd, bool _crossCompound) external;
    function harvestElevation(address _userAdd, bool _crossCompound) external returns (uint256);
    function deposit(address _token, uint256 _amount, address _userAdd, bool _crossCompound, bool _isElevate) external returns (uint256);
    function emergencyWithdraw(address _token, address _userAdd) external returns (uint256);
    function withdraw(address _token, uint256 _amount, address _userAdd, bool _crossCompound, bool _isElevate) external returns (uint256);
 
    function supply(address _token) external view returns (uint256);
    function selectedTotem(address _userAdd) external view returns (uint8);
    function isTotemSelected(address _userAdd) external view returns (bool);
}