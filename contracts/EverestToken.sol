// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "./libs/ERC20Mintable.sol";
import "./BaseEverestExtension.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";


// EverestToken, governance token of Summit DeFi
contract EverestToken is ERC20('EverestToken', 'EVEREST'), Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    // ---------------------------------------
    // --   V A R I A B L E S
    // ---------------------------------------

    IERC20 public summit;

    bool public panic = false;

    uint256 public minLockTime = 3600 * 24 * 7;
    uint256 public maxLockTime = 3600 * 24 * 365;
    uint256 public minEverestLockMult = 1000;
    uint256 public maxEverestLockMult = 10000;

    uint256 public lockTimeRequiredForTaxlessSummitWithdraw = 3600 * 24 * 7;
    uint256 public lockTimeRequiredForClaimableSummitLock = 3600 * 24 * 30;

    uint256 public totalSummitLocked;
    uint256 public weightedAvgSummitLockDurations;

    struct UserEverestInfo {
        address userAdd;

        uint256 everestOwned;
        uint256 everestLockMultiplier;
        uint256 lockDuration;
        uint256 lockRelease;
        uint256 summitLocked;
    }
    mapping(address => UserEverestInfo) public userEverestInfo;

    // Other contracts that hook into the user's amount of everest, max 3 extensions
    // Will be used for the DAO, as well as everest pools in the future
    EnumerableSet.AddressSet everestExtensions;


    constructor(address _summit) {
        require(_summit != address(0), "SummitToken missing");
        summit = IERC20(_summit);
    }
    
    
    // ---------------------------------------
    // --   E V E N T S
    // ---------------------------------------

    event SummitLocked(address indexed user, uint256 _summitLocked, uint256 _lockDuration, uint256 _everestAwarded);
    event LockDurationIncreased(address indexed user, uint256 _lockDuration, uint256 _additionalEverestAwarded);
    event LockedSummitIncreased(address indexed user, bool indexed _increasedWithClaimableWinnings, uint256 _summitLocked, uint256 _everestAwarded);
    event LockedSummitWithdrawn(address indexed user, uint256 _summitRemoved, uint256 _everestBurned);
    event PanicFundsRecovered(address indexed user, uint256 _summitRecovered);

    event SetMinLockTime(uint256 _lockTimeDays);
    event SetMaxLockTime(uint256 _lockTimeDays);
    event SetMinEverestLockMult(uint256 _lockMult);
    event SetMaxEverestLockMult(uint256 _lockMult);
    event SetLockTimeRequiredForTaxlessSummitWithdraw(uint256 _lockTimeDays);
    event SetLockTimeRequiredForLockedSummitDeposit(uint256 _lockTimeDays);
    event SetPanic(bool _panic);




    // ------------------------------------------------------
    // --   M O D I F I E R S 
    // ------------------------------------------------------

    modifier validLockDuration(uint256 _lockDuration) {
        require (_lockDuration >= minLockTime && _lockDuration <= maxLockTime, "Invalid lock duration");
        _;
    }
    modifier userNotAlreadyLockingSummit() {
        require (userEverestInfo[msg.sender].everestOwned == 0, "Already locking summit");
        _;
    }
    modifier userLockDurationSatisfied() {
        require(userEverestInfo[msg.sender].lockRelease != 0, "User doesnt have a lock release");
        require(block.timestamp >= userEverestInfo[msg.sender].lockRelease, "Lock still in effect");
        _;
    }
    modifier userEverestInfoExists() {
        require(userEverestInfo[msg.sender].userAdd != address(0), "User doesnt exist");
        _;
    }
    modifier userOwnsEverest() {
        require (userEverestInfo[msg.sender].everestOwned > 0, "Must own everest");
        _;
    }
    modifier validEverestAmountToBurn(uint256 _everestAmount) {
        require (_everestAmount > 0 && _everestAmount <= userEverestInfo[msg.sender].everestOwned, "Bad withdraw");
        _;
    }
    function _validUserAdd(address _userAdd) internal pure {
        require(_userAdd != address(0), "User address is zero");
    }
    modifier validUserAdd(address _userAdd) {
        _validUserAdd(_userAdd);
        _;
    }
    modifier onlyPanic() {
        require(panic, "Not in panic");
        _;
    }
    modifier notPanic() {
        require(!panic, "Not available during panic");
        _;
    }


    // ---------------------------------------
    // --   A D J U S T M E N T S
    // ---------------------------------------



    function setMinLockTime(uint256 _lockTimeDays) public onlyOwner {
        require(_lockTimeDays <= maxLockTime && _lockTimeDays >= 1 && _lockTimeDays <= 30, "Invalid minimum lock time (1-30 days)");
        minLockTime = _lockTimeDays * 24 * 365;
        emit SetMinLockTime(_lockTimeDays);
    }
    function setMaxLockTime(uint256 _lockTimeDays) public onlyOwner {
        require(_lockTimeDays >= minLockTime && _lockTimeDays >= 7 && _lockTimeDays <= 730, "Invalid maximum lock time (7-730 days)");
        maxLockTime = _lockTimeDays * 24 * 365;
        emit SetMaxLockTime(_lockTimeDays);
    }
    function setMinEverestLockMult(uint256 _lockMult) public onlyOwner {
        require(_lockMult >= 100 && _lockMult <= 50000, "Invalid lock mult");
        minEverestLockMult = _lockMult;
        emit SetMinEverestLockMult(_lockMult);
    }
    function setMaxEverestLockMult(uint256 _lockMult) public onlyOwner {
        require(_lockMult >= 100 && _lockMult <= 50000, "Invalid lock mult");
        maxEverestLockMult = _lockMult;
        emit SetMaxEverestLockMult(_lockMult);
    }
    function setLockTimeRequiredForTaxlessSummitWithdraw(uint256 _lockTimeDays) public onlyOwner {
        require(_lockTimeDays >= minLockTime && _lockTimeDays <= maxLockTime && _lockTimeDays >= 1 && _lockTimeDays <= 30, "Invalid taxless summit lock time (1-30 days)");
        lockTimeRequiredForTaxlessSummitWithdraw = _lockTimeDays;
        emit SetLockTimeRequiredForTaxlessSummitWithdraw(_lockTimeDays);
    }
    function setLockTimeRequiredForLockedSummitDeposit(uint256 _lockTimeDays) public onlyOwner {
        require(_lockTimeDays >= minLockTime && _lockTimeDays <= maxLockTime && _lockTimeDays >= 1 && _lockTimeDays <= 90, "Invalid locked summit lock time (1-90 days)");
        lockTimeRequiredForClaimableSummitLock = _lockTimeDays;
        emit SetLockTimeRequiredForLockedSummitDeposit(_lockTimeDays);
    }





    // ------------------------------------------------------------
    // --   F U N C T I O N A L I T Y
    // ------------------------------------------------------------


    /// @dev Update the average lock duration
    function _updateAvgSummitLockDuration(uint256 _amount, uint256 _lockDuration, bool _isLocking)
        internal
    {
        // The weighted average of the change being applied
        uint256 deltaWeightedAvg = _amount * _lockDuration;

        // Update the lock multiplier and the total amount locked
        if (_isLocking) {
            totalSummitLocked += _amount;
            weightedAvgSummitLockDurations += deltaWeightedAvg;
        } else {
            totalSummitLocked -= _amount;
            weightedAvgSummitLockDurations -= deltaWeightedAvg;
        }
    }
    function avgSummitLockDuration()
        public view
        returns (uint256)
    {
        // Early escape if div/0
        if (totalSummitLocked == 0) return 0;

        // Return the average from the weighted average lock duration 
        return weightedAvgSummitLockDurations / totalSummitLocked;
    }

    /// @dev Lock period multiplier
    function _lockDurationMultiplier(uint256 _lockDuration)
        internal view
        returns (uint256)
    {
        return (((_lockDuration - minLockTime) * (maxEverestLockMult - minEverestLockMult) * 1e12) /
            (maxLockTime - minLockTime) /
            1e12) +
            minEverestLockMult;
    }

    /// @dev Transfer everest to the burn address.
    function _burnEverest(address _userAdd, uint256 _everestAmount)
        internal
    {
        IERC20(address(this)).safeTransferFrom(_userAdd, address(this), _everestAmount);
        _burn(address(this), _everestAmount);
    }

    function _getOrCreateUserEverestInfo(address _userAdd)
        internal
        returns (UserEverestInfo storage)
    {
        UserEverestInfo storage everestInfo = userEverestInfo[_userAdd];
        everestInfo.userAdd = _userAdd;
        return everestInfo;
    }

    /// @dev Lock Summit for a duration and earn everest
    /// @param _summitAmount Amount of SUMMIT to deposit
    /// @param _lockDuration Duration the SUMMIT will be locked for
    function lockSummit(uint256 _summitAmount, uint256 _lockDuration)
        public
        nonReentrant notPanic userNotAlreadyLockingSummit validLockDuration(_lockDuration)
    {
        // Validate and deposit user's SUMMIT
        require(_summitAmount <= summit.balanceOf(msg.sender), "Exceeds balance");
        if (_summitAmount > 0) {    
            summit.safeTransferFrom(msg.sender, address(this), _summitAmount);
        }

        // Calculate the lock multiplier and EVEREST award
        uint256 everestLockMultiplier = _lockDurationMultiplier(_lockDuration);
        uint256 everestAward = (_summitAmount * everestLockMultiplier) / 10000;
        
        // Mint EVEREST to the user's wallet
        _mint(msg.sender, everestAward);

        // Create and initialize the user's everestInfo
        UserEverestInfo storage everestInfo = _getOrCreateUserEverestInfo(msg.sender);
        everestInfo.everestOwned = everestAward;
        everestInfo.everestLockMultiplier = everestLockMultiplier;
        everestInfo.lockRelease = block.timestamp + _lockDuration;
        everestInfo.lockDuration = _lockDuration;
        everestInfo.summitLocked = _summitAmount;

        // Update average lock duration with new summit locked
        _updateAvgSummitLockDuration(_summitAmount, _lockDuration, true);

        // Update the EVEREST in the expedition
        _updateEverestExtensionsUserEverestOwned(everestInfo);

        emit SummitLocked(msg.sender, _summitAmount, _lockDuration, everestAward);
    }


    /// @dev Increase the lock duration of user's locked SUMMIT
    function increaseLockDuration(uint256 _lockDuration)
        public
        nonReentrant notPanic userEverestInfoExists userOwnsEverest
    {
        uint256 additionalEverestAward = _increaseLockDuration(_lockDuration, msg.sender);
        emit LockDurationIncreased(msg.sender, _lockDuration, additionalEverestAward);
    }
    function _increaseLockDuration(uint256 _lockDuration, address _userAdd)
        internal
        returns (uint256)
    {
        UserEverestInfo storage everestInfo = userEverestInfo[_userAdd];
        require(_lockDuration >= everestInfo.lockDuration, "Lock duration must strictly increase");

        // Update average lock duration by removing existing lock duration, and adding new duration
        _updateAvgSummitLockDuration(everestInfo.summitLocked, everestInfo.lockDuration, false);
        _updateAvgSummitLockDuration(everestInfo.summitLocked, _lockDuration, true);

        // Calculate and validate the new everest lock multiplier
        uint256 everestLockMultiplier = _lockDurationMultiplier(_lockDuration);
        require(everestLockMultiplier >= everestInfo.everestLockMultiplier, "New lock duration must be greater");

        // Calculate the additional EVEREST awarded by the extended lock duration
        uint256 additionalEverestAward = ((everestInfo.summitLocked * everestLockMultiplier) / 10000) - everestInfo.everestOwned;

        // Increase the lock release
        uint256 lockRelease = block.timestamp + _lockDuration;

        // Mint EVEREST to the user's address
        _mint(_userAdd, additionalEverestAward);

        // Update the user's running state
        everestInfo.everestOwned += additionalEverestAward;
        everestInfo.everestLockMultiplier = everestLockMultiplier;
        everestInfo.lockRelease = lockRelease;
        everestInfo.lockDuration = _lockDuration;

        // Update the expedition with the user's new EVEREST amount
        _updateEverestExtensionsUserEverestOwned(everestInfo);

        return additionalEverestAward;
    }


    /// @dev Internal locked SUMMIT amount increase, returns the extra EVEREST earned by the increased lock duration
    function _increaseLockedSummit(uint256 _summitAmount, UserEverestInfo storage everestInfo, address _summitOriginAdd)
        internal
        returns (uint256)
    {
        // Validate and deposit user's funds
        require(_summitAmount <= summit.balanceOf(_summitOriginAdd), "Exceeds balance");
        if (_summitAmount > 0) {
            summit.safeTransferFrom(_summitOriginAdd, address(this), _summitAmount);
        }

        // Calculate the extra EVEREST that is awarded by the deposited SUMMIT
        uint256 additionalEverestAward = (_summitAmount * everestInfo.everestLockMultiplier) / 10000;
        
        // Mint EVEREST to the user's address
        _mint(everestInfo.userAdd, additionalEverestAward);

        // Increase running balances of EVEREST and SUMMIT
        everestInfo.everestOwned += additionalEverestAward;
        everestInfo.summitLocked += _summitAmount;

        // Update average lock duration with new summit locked
        _updateAvgSummitLockDuration(_summitAmount, everestInfo.lockDuration, true);

        // Update the expedition with the users new EVEREST info
        _updateEverestExtensionsUserEverestOwned(everestInfo);

        return additionalEverestAward;
    }

    /// @dev Increase the duration of already locked SUMMIT, exit early if user is already locked for a longer duration
    function _increaseLockReleaseOnClaimableLocked(UserEverestInfo storage everestInfo, uint256 _lockDuration)
        internal
        returns (uint256)
    {
        // Early escape if lock release already satisfies requirement
        if ((block.timestamp + _lockDuration) <= everestInfo.lockRelease) return 0;

        // Update lock release and return the extra EVEREST that is earned by this extension
        return _increaseLockDuration(_lockDuration, everestInfo.userAdd);
    }

    /// @dev Lock additional summit and extend duration to arbitrary duration
    function lockAndExtendLockDuration(uint256 _summitAmount, uint256 _lockDuration, address _userAdd)
        public
        nonReentrant notPanic userEverestInfoExists userOwnsEverest
    {
        UserEverestInfo storage everestInfo = userEverestInfo[_userAdd];

        // Increase the lock duration of the current locked SUMMIT
        uint256 additionalEverestAward = _increaseLockReleaseOnClaimableLocked(everestInfo, _lockDuration);

        // Increase the amount of locked summit by {_summitAmount} and increase the EVEREST award
        additionalEverestAward += _increaseLockedSummit(
            _summitAmount,
            everestInfo,
            msg.sender
        );
        
        emit LockedSummitIncreased(msg.sender, true, _summitAmount, additionalEverestAward);
    }

    /// @dev Increase the users Locked Summit and earn everest
    function increaseLockedSummit(uint256 _summitAmount)
        public
        nonReentrant notPanic userEverestInfoExists userOwnsEverest
    {
        uint256 additionalEverestAward = _increaseLockedSummit(
            _summitAmount,
            userEverestInfo[msg.sender],
            msg.sender
        );

        emit LockedSummitIncreased(msg.sender, false, _summitAmount, additionalEverestAward);
    }

    /// @dev Decrease the Summit and burn everest
    function withdrawLockedSummit(uint256 _everestAmount)
        public
        nonReentrant notPanic userEverestInfoExists userOwnsEverest userLockDurationSatisfied validEverestAmountToBurn(_everestAmount)
    {
        UserEverestInfo storage everestInfo = userEverestInfo[msg.sender];
        require (_everestAmount <= everestInfo.everestOwned, "Bad withdraw");

        uint256 summitToWithdraw = _everestAmount * 10000 / everestInfo.everestLockMultiplier;

        everestInfo.everestOwned -= _everestAmount;
        everestInfo.summitLocked -= summitToWithdraw;

        // Update average summit lock duration with removed summit
        _updateAvgSummitLockDuration(summitToWithdraw, everestInfo.lockDuration, false);

        summit.safeTransfer(msg.sender, summitToWithdraw);
        _burnEverest(msg.sender, _everestAmount);

        _updateEverestExtensionsUserEverestOwned(everestInfo);

        emit LockedSummitWithdrawn(msg.sender, summitToWithdraw, _everestAmount);
    }

    
    
    
    
    
    // ----------------------------------------------------------------------
    // --   E V E R E S T   E X T E N S I O N S
    // ----------------------------------------------------------------------



    /// @dev Add an everest extension
    function addEverestExtension(address _extension)
        public
        onlyOwner
    {
        require(_extension != address(0), "Missing extension");
        require(everestExtensions.length() < 3, "Max extension cap reached");
        everestExtensions.add(_extension);
    }

    /// @dev Remove an everest extension
    function removeEverestExtension(address _extension)
        public
        onlyOwner
    {
        require(_extension != address(0), "Missing extension");
        require(everestExtensions.contains(_extension), "Extension not added");
        everestExtensions.remove(_extension);
    }

    /// @dev Get user everest owned
    function getUserEverestOwned(address _userAdd)
        public view
        returns (uint256)
    {
        return userEverestInfo[_userAdd].everestOwned;
    }

    function _updateEverestExtensionsUserEverestOwned(UserEverestInfo storage user)
        internal
    {
        // Iterate through and update each extension with the user's everest amount
        for (uint8 extensionIndex = 0; extensionIndex < everestExtensions.length(); extensionIndex++) {
            BaseEverestExtension(everestExtensions.at(extensionIndex)).updateUserEverest(user.everestOwned, user.userAdd);
        }
    }





    // -------------------------------------
    // --   P A N I C
    // -------------------------------------



    /// @dev Turn on or off panic mode
    function setPanic(bool _panic)
        public
        onlyOwner
    {
        panic = _panic;
        emit SetPanic(_panic);
    }


    /// @dev Panic recover locked SUMMIT if something has gone wrong
    function panicRecoverFunds()
        public
        nonReentrant userEverestInfoExists onlyPanic
    {
        UserEverestInfo storage everestInfo = userEverestInfo[msg.sender];

        uint256 recoverableSummit = everestInfo.summitLocked;
        summit.safeTransfer(msg.sender, recoverableSummit);

        everestInfo.userAdd = address(0);
        everestInfo.everestOwned = 0;
        everestInfo.summitLocked = 0;
        everestInfo.lockRelease = 0;
        everestInfo.lockDuration = 0;
        everestInfo.everestLockMultiplier = 0;

        emit PanicFundsRecovered(msg.sender, recoverableSummit);
    }

}