//SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface ISubCart {
    function initialize(address, address, address) external;
    function enable(uint256) external;
    function add(uint16, uint8, bool, IERC20, uint16) external;
    function addExpedition(uint16, bool, uint256, IERC20, uint256, uint256) external;
    function set(uint16, bool, uint16) external;
    function massUpdatePools() external;

    function rollover(uint8) external;

    function rewards(uint16, address) external view returns (uint256, uint256, uint256, uint256);
    function hypotheticalRewards(uint16, address) external view returns (uint256, uint256);

    function switchTotem(uint8, uint8, address) external;
    function isTotemSelected(uint8, address) external view returns (bool);
    
    function deposit(uint16, uint256, address) external returns (uint256);
    function harvestElevation(uint8, uint16, address) external returns (uint256);
    function elevateDeposit(uint16, uint256, address) external returns (uint256);
    function emergencyWithdraw(uint16, address) external returns (uint256);
    function withdraw(uint16, uint256, address) external returns (uint256);
    function elevateWithdraw(uint16, uint256, address, address) external returns (uint256);
 
    function supply(uint16) external view returns (uint256);
    function token(uint16) external view returns (IERC20);
    function depositFee(uint16) external view returns (uint256);
    function isEarning(uint16) external view returns (bool);
    function selectedTotem(uint8, address) external view returns (uint8);
}