// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "./SummitToken.sol";
import "./Cartographer.sol";
import "./ExpeditionV2.sol";
import "./EverestToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";


contract SummitLocking is Ownable, Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    SummitToken public summit;
    EverestToken public everest;
    Cartographer public cartographer;
    ExpeditionV2 public expeditionV2;

    bool public panicFundsReleased = false;
    uint256 public constant epochDuration = 3600 * 24 * 7;
    address constant burnAdd = 0x000000000000000000000000000000000000dEaD;

    struct UserLockedWinnings {
        uint256 winnings;
        uint256 bonusEarned;
        uint256 claimedWinnings;
    }

    uint8 public yieldLockEpochCount = 5;

    mapping(address => EnumerableSet.UintSet) userInteractingEpochs;    // List of epochs the user is interacting with (to help with frontend / user info)
    mapping(address => mapping(uint256 => UserLockedWinnings)) public userLockedWinnings;
    mapping(address => uint256) public userLifetimeWinnings;            // Public value for user information
    mapping(address => uint256) public userLifetimeBonusWinnings;       // Public value for user information

    event WinningsLocked(address indexed _userAdd, uint256 _lockedWinnings, uint256 _bonusWinnings);
    event WinningsHarvested(address indexed _userAdd, uint256 _epoch, uint256 _harvestedWinnings, bool _lockForEverest);

    function initialize(
        address _summit,
        address _everest,
        address _cartographer,
        address _expeditionV2
    ) public onlyOwner {
        require(_summit != address(0), "Missing SummitToken");
        require(_everest != address(0), "Missing EverestToken");
        require(_cartographer != address(0), "Missing Cartographer");
        require(_expeditionV2 != address(0), "Missing ExpeditionV2");
        summit = SummitToken(_summit);
        everest = EverestToken(_everest);
        cartographer = Cartographer(_cartographer);
        expeditionV2 = ExpeditionV2(_expeditionV2);
    }


    function panicSetFundsRelease(bool _release)
        public
        onlyOwner
    {
        panicFundsReleased = _release;
    }


    // MODIFIERS


    modifier onlyCartographerOrExpedition() {
        require(msg.sender == address(cartographer) || msg.sender == address(expeditionV2), "Only cartographer or expedition");
        _;
    }


    // PUBLIC

    function getCurrentEpoch()
        public view
        returns (uint256)
    {
        return block.timestamp / epochDuration;
    }

    /// @dev Return if an epoch has matured
    function hasEpochMatured(uint256 _epoch)
        internal view
        returns (bool)
    {
        return (getCurrentEpoch() - _epoch) >= yieldLockEpochCount;
    }


    // FUNCTIONALITY


    /// @dev Update yield lock epoch count
    function setYieldLockEpochCount(uint8 _count)
        public onlyOwner
    {
        require(_count <= 12, "Invalid lock epoch count");
        yieldLockEpochCount = _count;
    }

    function addLockedWinnings(uint256 _lockedWinnings, uint256 _bonusWinnings, address _userAdd)
        external
        onlyCartographerOrExpedition
    {
        uint256 currentEpoch = getCurrentEpoch();
        UserLockedWinnings storage userEpochWinnings = userLockedWinnings[_userAdd][currentEpoch];
        userEpochWinnings.winnings += _lockedWinnings;
        userLifetimeWinnings[_userAdd] += _lockedWinnings;
        userEpochWinnings.bonusEarned += _bonusWinnings;
        userLifetimeBonusWinnings[_userAdd] += _bonusWinnings;
        userInteractingEpochs[_userAdd].add(currentEpoch);

        emit WinningsLocked(_userAdd, _lockedWinnings, _bonusWinnings);
    }

    /// @dev Harvest locked winnings, 50% tax taken on early harvest
    function harvestWinnings(uint256 _epoch, uint256 _amount, bool _lockForEverest)
        public
        nonReentrant
    {
        UserLockedWinnings storage userEpochWinnings = userLockedWinnings[msg.sender][_epoch];

        // Winnings that haven't yet been claimed
        uint256 unclaimedWinnings = userEpochWinnings.winnings - userEpochWinnings.claimedWinnings;

        // Validate harvest amount
        require(_amount > 0 && _amount <= unclaimedWinnings, "Bad Harvest");

        // Harvest winnings by locking for everest in the expedition
        if (_lockForEverest) {
            everest.lockAndExtendLockDuration(
                _amount,
                everest.lockTimeRequiredForClaimableSummitLock(),
                msg.sender
            );

        // Else check if epoch matured, harvest 100% if true, else harvest 50%, burn 25%, and send 25% to expedition contract to be distributed to EVEREST holders
        } else {
            bool epochMatured = hasEpochMatured(_epoch);
            if (panicFundsReleased || epochMatured) {
                IERC20(summit).safeTransfer(msg.sender, _amount);
            } else {
                IERC20(summit).safeTransfer(msg.sender, _amount / 2);
                IERC20(summit).safeTransfer(burnAdd, _amount / 4);
                IERC20(summit).safeTransfer(cartographer.expeditionTreasuryAdd(), _amount / 4);
            }
        }

        userEpochWinnings.claimedWinnings += _amount;

        if ((userEpochWinnings.winnings - userEpochWinnings.claimedWinnings) == 0) {
            userInteractingEpochs[msg.sender].remove(_epoch);
        }

        emit WinningsHarvested(msg.sender, _epoch, _amount, _lockForEverest);
    }
} 