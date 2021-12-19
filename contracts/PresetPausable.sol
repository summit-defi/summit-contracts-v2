// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract PresetPausable is AccessControlEnumerable, Pausable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(PAUSER_ROLE, msg.sender);
    }

    function pause() public virtual {
        require(hasRole(PAUSER_ROLE, msg.sender), "ERC20PresetMinterPauser: must have pauser role to pause");
        _pause();
    }

    function unpause() public virtual {
        require(hasRole(PAUSER_ROLE, msg.sender), "ERC20PresetMinterPauser: must have pauser role to unpause");
        _unpause();
    }
}
