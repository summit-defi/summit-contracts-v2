// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// EverestToken, governance token of Summit DeFi
contract EverestToken is ERC20('EverestToken', 'EVEREST'), Ownable {

    /// @notice Creates `_amount` token to `_to`. Must only be called by the owner (MasterChef).
    function mintTo(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }
}