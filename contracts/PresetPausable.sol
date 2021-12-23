// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract PresetPausable is AccessControl {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bool public paused;

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(PAUSER_ROLE, msg.sender);
        paused = false;
    }

    event Paused(address account);
    event Unpaused(address account);

    function _whenNotPaused() internal view {
        require(!paused, "Pausable: paused");
    }
    modifier whenNotPaused() {
        _whenNotPaused();
        _;
    }
    
    modifier whenPaused() {
        require(paused, "Pausable: not paused");
        _;
    }

    function pause() public virtual whenNotPaused {
        require(hasRole(PAUSER_ROLE, msg.sender), "Must have pauser role");
        paused = true;
        emit Paused(_msgSender());
    }

    function unpause() public virtual whenPaused {
        require(hasRole(PAUSER_ROLE, msg.sender), "Must have pauser role");
        paused = false;
        emit Unpaused(_msgSender());
    }
}
