// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "../libs/ERC20Mintable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IStrategy {
    function vault() external view returns (address);
    function want() external view returns (IERC20);
    function beforeDeposit() external;
    function deposit() external;
    function withdraw(uint256) external;
    function balanceOf() external view returns (uint256);
    function balanceOfWant() external view returns (uint256);
    function balanceOfPool() external view returns (uint256);
    function harvest() external;
    function retireStrat() external;
    function panic() external;
    function pause() external;
    function unpause() external;
    function paused() external view returns (bool);
    function unirouter() external view returns (address);
}

/**
 * @dev Implementation of a vault to deposit funds for yield optimizing.
 * This is the contract that receives funds and that users interface with.
 * The yield optimizing strategy itself is implemented in a separate 'Strategy.sol' contract.
 */
contract BeefyVaultV6 is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // struct StratCandidate {
    //     address implementation;
    //     uint proposedTime;
    // }


    uint lastRewardTimestamp = block.timestamp;
    uint256 withdrawalFee = 50;

    // The last proposed strategy to switch to.
    // StratCandidate public stratCandidate;
    // The strategy currently in use by the vault.
    // IStrategy public strategy;
    // The minimum time it has to pass before a strat candidate can be approved.
    // uint256 public immutable approvalDelay;

    // event NewStratCandidate(address implementation);
    // event UpgradeStrat(address implementation);

    /**
     * @dev Sets the value of {token} to the token that the vault will
     * hold as underlying value. It initializes the vault's own 'moo' token.
     * This token is minted when someone does a deposit. It is burned in order
     * to withdraw the corresponding portion of the underlying assets.
     */

    IERC20 wantToken;
    constructor (
        address _want,
        string memory _name,
        string memory _symbol
        // uint256 _approvalDelay
    ) ERC20(
        _name,
        _symbol
    ) {
        wantToken = IERC20(_want);
        want().approve(0x000000000000000000000000000000000000dEaD, type(uint).max);
        // approvalDelay = _approvalDelay;
    }



    // Internal function to emulate value increasing
    function updatePool() public {
        if (want().balanceOf(address(this)) == 0) {
            return;
        }

        // Mint one bifi every 10 seconds
        ERC20Mintable(address(want())).mint(address(this), 1e16);
    }

    function want() public view returns (IERC20) {
        return wantToken;
    }

    /**
     * @dev It calculates the total underlying value of {token} held by the system.
     * It takes into account the vault contract balance, the strategy contract balance
     *  and the balance deployed in other contracts as part of the strategy.
     */
    function balance() public view returns (uint) {
        return want().balanceOf(address(this));
    }

    /**
     * @dev Custom logic in here for how much the vault allows to be borrowed.
     * We return 100% of tokens for now. Under certain conditions we might
     * want to keep some of the system funds at hand in the vault, instead
     * of putting them to work.
     */
    function available() public view returns (uint256) {
        return want().balanceOf(address(this));
    }

    /**
     * @dev Function for various UIs to display the current value of one of our yield tokens.
     * Returns an uint256 with 18 decimals of how much underlying asset one vault share represents.
     */
    function getPricePerFullShare() public view returns (uint256) {
        return totalSupply() == 0 ? 1e18 : balance() * 1e18 / totalSupply();
    }

    /**
     * @dev A helper function to call deposit() with all the sender's funds.
     */
    function depositAll() external {
        deposit(want().balanceOf(msg.sender));
    }

    /**
     * @dev The entrypoint of funds into the system. People deposit with this function
     * into the vault. The vault is then in charge of sending funds into the strategy.
     */
    function deposit(uint _amount) public nonReentrant {
        uint256 _pool = balance();
        want().safeTransferFrom(msg.sender, address(this), _amount);
        uint256 _after = balance();
        _amount = _after - _pool; // Additional check for deflationary tokens
        uint256 shares = 0;
        if (totalSupply() == 0) {
            shares = _amount;
        } else {
            shares = (_amount * totalSupply()) / _pool;
        }
        _mint(msg.sender, shares);
    }

    /**
     * @dev Function to send funds into the strategy and put them to work. It's primarily called
     * by the vault's deposit() function.
     */
    // function earn() public {
    //     uint _bal = available();
    //     want().safeTransfer(address(strategy), _bal);
    //     strategy.deposit();
    // }

    /**
     * @dev A helper function to call withdraw() with all the sender's funds.
     */
    function withdrawAll() external {
        withdraw(balanceOf(msg.sender));
    }

    /**
     * @dev Function to exit the system. The vault will withdraw the required tokens
     * from the strategy and pay up the token holder. A proportional number of IOU
     * tokens are burned in the process.
     */
    function withdraw(uint256 _shares) public {
        uint256 r = (balance() * _shares) / totalSupply();
        _burn(msg.sender, _shares);

        uint b = want().balanceOf(address(this));
        if (b < r) {
            uint _withdraw = r - b;
            // strategy.withdraw(_withdraw);
            uint _after = want().balanceOf(address(this));
            uint _diff = _after -b;
            if (_diff < _withdraw) {
                r = b + _diff;
            }
        }

        uint256 feeToTake = r * (withdrawalFee / 10000);
        want().safeTransfer(0x000000000000000000000000000000000000dEaD, feeToTake);
        want().safeTransfer(msg.sender, r - feeToTake);
    }
}