//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface ISubCart {
    function initialize(uint8 _elevation, address _elevationHelper, address _summit) external;
    function enable(uint256 _launchTimestamp) external;
    function add(address _token, bool _live) external;
    function set(address _token, bool _live) external;
    function massUpdatePools() external;

    function rollover() external;

    function rewards(address _token, address _userAdd) external view returns (uint256, uint256, uint256, uint256);
    function hypotheticalRewards(address _token, address _userAdd) external view returns (uint256, uint256);

    function switchTotem(uint8 _totem, address _userAdd) external;
    function isTotemSelected(address _userAdd) external view returns (bool);
    
    function harvestElevation(bool _crossCompound, address _userAdd) external returns (uint256);
    function deposit(address _token, uint256 _amount, address _userAdd) external returns (uint256);
    function elevateDeposit(address _token, uint256, address) external returns (uint256);
    function emergencyWithdraw(address _token, address) external returns (uint256);
    function withdraw(address _token, uint256 _amount, address _userAdd) external returns (uint256);
    function elevateWithdraw(address _token, uint256 _amount, address _userAdd) external returns (uint256);
 
    function supply(address) external view returns (uint256);
    function isEarning(address) external view returns (bool);
    function selectedTotem(address) external view returns (uint8);
}