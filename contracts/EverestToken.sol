// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "./libs/ERC20Mintable.sol";

// EverestToken, governance token of Summit DeFi
contract EverestToken is ERC20Mintable('EverestToken', 'EVEREST') {}