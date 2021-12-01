// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "../libs/ERC20Mintable.sol";

// SummitToken with Governance.
contract DummyNativeToken is ERC20Mintable('Dummy Native Token', 'NATIVE') {}