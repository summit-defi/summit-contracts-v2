// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "./ElevationHelper.sol";
import "./SummitToken.sol";
import "./EverestToken.sol";
import "./interfaces/ISubCart.sol";
import "./SummitLocking.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./BaseEverestExtension.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/*
---------------------------------------------------------------------------------------------
--   S U M M I T . D E F I
---------------------------------------------------------------------------------------------


Summit is highly experimental.
It has been crafted to bring a new flavor to the defi world.
We hope you enjoy the Summit.defi experience.
If you find any bugs in these contracts, please claim the bounty on immunefi.com


Created with love by Architect and the Summit team





---------------------------------------------------------------------------------------------
--   E X P E D I T I O N   E X P L A N A T I O N
---------------------------------------------------------------------------------------------


Expeditions offer a reward for holders of Summit.
Stake SUMMIT or SUMMIT LP (see MULTI-STAKING) in an expedition for a chance to win stablecoins and other high value tokens.
Expedition pots build during the week from passthrough staking usdc and deposit fees

Deposits open 24 hours before a round closes, at which point deposits are locked, and the winner chosen
After each round, the next round begins immediately (if the expedition hasn't ended)

Expeditions take place on the weekends, and each have 3 rounds (FRI / SAT / SUN)
Two DEITIES decide the fate of each round:


DEITIES (COSMIC BULL vs COSMIC BEAR):
    . Each round has a different chance of succeeding, between 50 - 90%
    . If the expedition succeeds, COSMIC BULL earns the pot, else COSMIC BEAR steals it
    
    . COSMIC BULL is a safer deity, always has a higher chance of winning
    . Users are more likely to stake with the safer deity so it's pot will be higher, thus the winnings per SUMMIT staked lower

    . COSMIC BEAR is riskier, with a smaller chance of winning, potentially as low as 10%
    . Users are less likely to stake with BULL as it may be outside their risk tolerance to shoot for a small % chance of win

    . Thus BEAR will usually have less staked, making it both riskier, and more rewarding on win

    . The SUMMIT team expect that because switching between DEITIES is both free and unlimited,
        users will collectively 'arbitrage' the two deities based on the chance of success.

    . For example, if a round's chance of success is 75%, we expect 75% of the staked funds in the pool to be with BULL (safer)
        though this is by no means guaranteed


MULTI-STAKING
    . Users can stake both their SUMMIT token and SUMMIT LP token in an expedition
    . This prevents users from needing to break and re-make their LP for every expedition
    . SUMMIT and SUMMIT LP can be staked simultaneously
    . Both SUMMIT and SUMMIT LP can be elevated into and out of the Expedition
    . The equivalent amount of SUMMIT within the staked SUMMIT LP is treated as the SUMMIT token, and can earn winnings
    . The equivalent amount of SUMMIT in staked SUMMIT LP is determined from the SUMMIT LP pair directly
    . We have also added summitLpEverestIncentiveMult (between 1X - 2X) which can increase the equivalent amount of SUMMIT in SUMMIT LP (updated on a 72 hour timelock)
    . summitLpEverestIncentiveMult will be updated to ensure users are willing to stake their SUMMIT LP rather than break it (this may never be necessary and will be actively monitored)

WINNINGS:
    . The round reward is split amongst all members of the winning DEITY, based on their percentage of the total amount staked in that deity
    . Calculations section omitted because it is simply division
    . Users may exit the pool at any time without fee
    . Users are not forced to collect their winnings between rounds, and are entered into the next round automatically (same deity) if they do not exit


*/



contract ExpeditionV2 is Ownable, Initializable, ReentrancyGuard, BaseEverestExtension {
    using SafeERC20 for IERC20;

    // ---------------------------------------
    // --   V A R I A B L E S
    // ---------------------------------------

    SummitToken public summit;
    ElevationHelper elevationHelper;
    SummitLocking public summitLocking;
    uint8 constant EXPEDITION = 4;

    uint256 public expeditionDeityWinningsMult = 125;
    uint256 public expeditionRunwayRounds = 30;
    
    struct UserTokenInteraction {
        uint256 safeDebt;
        uint256 deityDebt;
        uint256 lifetimeWinnings;
    }
    struct UserExpeditionInfo {
        address userAdd;

        // Entry Requirements
        uint256 everestOwned;
        uint8 deity;
        bool deitySelected;
        uint256 deitySelectionRound;
        uint8 safetyFactor;
        bool safetyFactorSelected;

        // Expedition Interaction
        bool entered;
        uint256 prevInteractedRound;

        uint256 safeSupply;
        uint256 deitiedSupply;

        UserTokenInteraction summit;
        UserTokenInteraction usdc;
    }
    mapping(address => UserExpeditionInfo) public userExpeditionInfo;        // Users running staked information

    struct ExpeditionToken {
        IERC20 token;
        uint256 roundEmission;
        uint256 emissionsRemaining;
        uint256 markedForDist;
        uint256 distributed;
        uint256 safeMult;
        uint256[2] deityMult;
    }
    struct ExpeditionEverestSupplies {
        uint256 safe;
        uint256 deitied;
        uint256[2] deity;
    }
    struct ExpeditionInfo {
        bool live;                          // If the pool is manually enabled / disabled
        bool launched;

        uint256 roundsRemaining;            // Number of rounds of this expedition to run.

        ExpeditionEverestSupplies supplies;

        ExpeditionToken summit;
        ExpeditionToken usdc;
    }
    ExpeditionInfo public expeditionInfo;   // Expedition info

    



    // ---------------------------------------
    // --   E V E N T S
    // ---------------------------------------

    event UserJoinedExpedition(address indexed user, uint8 _deity, uint8 _safetyFactor, uint256 _everestOwned);
    event UserHarvestedExpedition(address indexed user, uint256 _summitHarvested, uint256 _usdcHarvested);

    event ExpeditionInitialized(address _usdcTokenAddress, address _elevationHelper);
    event ExpeditionEmissionsRecalculated(uint256 _roundsRemaining, uint256 _summitEmissionPerRound, uint256 _usdcEmissionPerRound);
    event ExpeditionFundsAdded(address indexed token, uint256 _amount);
    event ExpeditionDisabled();
    event ExpeditionEnabled();
    event Rollover(address indexed user);
    event DeitySelected(address indexed user, uint8 _deity, uint256 _deitySelectionRound);
    event SafetyFactorSelected(address indexed user, uint8 _safetyFactor);

    event SetExpeditionDeityWinningsMult(uint256 _deityMult);
    event SetExpeditionRunwayRounds(uint256 _runwayRounds);
    





    // ---------------------------------------
    // --  A D M I N I S T R A T I O N
    // ---------------------------------------


    /// @dev Constructor, setting address of cartographer
    constructor(
        address _summit,
        address _everest,
        address _summitLocking
    ) {
        require(_summit != address(0), "Summit required");
        require(_everest != address(0), "Everest required");
        require(_summitLocking != address(0), "SummitLocking Required");
        summit = SummitToken(_summit);
        everest = EverestToken(_everest);
        summitLocking = SummitLocking(_summitLocking);
    }


    /// @dev Initializes the expedition
    function initialize(address _usdcTokenAddress, address _elevationHelper)
        public
        initializer onlyOwner
    {
        require(_usdcTokenAddress != address(0), "USDC token missing");
        require(_elevationHelper != address(0), "Elevation Helper missing");

        // Initialize expedition itself
        expeditionInfo.summit.token = IERC20(address(summit));
        expeditionInfo.usdc.token = IERC20(_usdcTokenAddress);

        expeditionInfo.live = true;

        _recalculateExpeditionEmissions();

        // Initialize Elevation Helper
        elevationHelper = ElevationHelper(_elevationHelper);

        emit ExpeditionInitialized(_usdcTokenAddress, _elevationHelper);
    }






    // ------------------------------------------------------
    // --   M O D I F I E R S 
    // ------------------------------------------------------

    modifier validSafetyFactor(uint8 _safetyFactor) {
        require(_safetyFactor >= 0 && _safetyFactor <= 100, "Invalid safety factor");
        _;
    }
    function _validUserAdd(address _userAdd) internal pure {
        require(_userAdd != address(0), "User address is zero");
    }
    modifier validUserAdd(address _userAdd) {
        _validUserAdd(_userAdd);
        _;
    }
    modifier validDeity(uint8 deity) {
        require(deity < 2, "Invalid deity");
        _;
    }
    modifier expeditionInteractionsAvailable() {
        require(!elevationHelper.endOfRoundLockoutActive(EXPEDITION), "Elev locked until rollover");
        _;
    }
    modifier userOwnsEverest() {
        require(userExpeditionInfo[msg.sender].everestOwned > 0, "Must own everest");
        _;
    }
    modifier userIsEligibleToJoinExpedition() {
        require(userExpeditionInfo[msg.sender].deitySelected, "No deity selected");
        require(userExpeditionInfo[msg.sender].safetyFactorSelected, "No safety factor selected");
        _;
    }
    




    // ---------------------------------------
    // --   U T I L S (inlined for brevity)
    // ---------------------------------------


    function supply()
        public view
        returns (uint256, uint256, uint256, uint256)
    {
        return (
            expeditionInfo.supplies.safe,
            expeditionInfo.supplies.deitied,
            expeditionInfo.supplies.deity[0],
            expeditionInfo.supplies.deity[1]
        );
    }
    
    function selectedDeity(address _userAdd)
        public view
        returns (uint8)
    {
        return userExpeditionInfo[_userAdd].deity;
    }

    /// @dev Divider is random number 50 - 90 that sets the random chance of each of the deities winning the round
    function currentDeityDivider()
        public view
        returns (uint256)
    {
        return elevationHelper.currentDeityDivider();
    }


    /// @dev The amount of reward token that exists to be rewarded by an expedition
    function remainingRewards()
        public view
        returns (uint256, uint256)
    {
        return (
            expeditionInfo.summit.emissionsRemaining,
            expeditionInfo.usdc.emissionsRemaining
        );
    }




    // ---------------------------------------
    // --   A D J U S T M E N T S
    // ---------------------------------------


    
    function setExpeditionDeityWinningsMult(uint256 _deityMult) public onlyOwner {
        require(_deityMult >= 100 && _deityMult <= 500, "Invalid deity mult (1X-5X)");
        expeditionDeityWinningsMult = _deityMult;
        emit SetExpeditionDeityWinningsMult(_deityMult);
    }
    function setExpeditionRunwayRounds(uint256 _runwayRounds) public onlyOwner {
        require(_runwayRounds >= 7 && _runwayRounds <= 90, "Invalid runway rounds (7-90)");
        expeditionRunwayRounds = _runwayRounds;
        emit SetExpeditionRunwayRounds(_runwayRounds);
    }





    // ---------------------------------------
    // --   E X P E D   M A N A G E M E N T
    // ---------------------------------------


    /// @dev Recalculate and set emissions of single reward token
    /// @return Whether this token has some emissions
    function _recalculateExpeditionTokenEmissions(ExpeditionToken storage expedToken)
        internal
        returns (bool)
    {
        uint256 fund = expedToken.token.balanceOf(address(this)) - expedToken.markedForDist;

        expedToken.emissionsRemaining = fund;
        expedToken.roundEmission = fund == 0 ? 0 : fund / expeditionRunwayRounds;

        return fund > 0;
    }


    /// @dev Recalculate and set expedition emissions
    function _recalculateExpeditionEmissions()
        internal
    {
        bool summitFundNonZero = _recalculateExpeditionTokenEmissions(expeditionInfo.summit);
        bool usdcFundNonZero = _recalculateExpeditionTokenEmissions(expeditionInfo.usdc);
        expeditionInfo.roundsRemaining = (summitFundNonZero || usdcFundNonZero) ? expeditionRunwayRounds : 0;
    }
    function recalculateExpeditionEmissions()
        public onlyOwner
    {
        _recalculateExpeditionEmissions();
        emit ExpeditionEmissionsRecalculated(expeditionInfo.roundsRemaining, expeditionInfo.summit.roundEmission, expeditionInfo.usdc.roundEmission);
    }

    /// @dev Add funds to the expedition
    function addExpeditionFunds(address _token, uint256 _amount)
        public nonReentrant
    {
        require (_token == address(expeditionInfo.summit.token) || _token == address(expeditionInfo.usdc.token), "Invalid token to add to expedition");
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        _recalculateExpeditionEmissions();

        emit ExpeditionFundsAdded(_token, _amount);
    }

    /// @dev Turn off an expedition
    function disableExpedition()
        public
        onlyOwner
    {
        require(expeditionInfo.live, "Expedition already disabled");
        expeditionInfo.live = false;

        emit ExpeditionDisabled();
    }

    /// @dev Turn on a turned off expedition
    function enableExpedition()
        public
        onlyOwner
    {
        require(!expeditionInfo.live, "Expedition already enabled");
        expeditionInfo.live = true;

        emit ExpeditionEnabled();
    }



    // ---------------------------------------
    // --   P O O L   R E W A R D S
    // ---------------------------------------
    
    function rewards(address _userAdd)
        public view
        validUserAdd(_userAdd)
        returns (uint256, uint256)
    {
        // Calculate and return the harvestable winnings for this expedition
        return _harvestableWinnings(userExpeditionInfo[_userAdd]);
    }


    function _calculateEmissionMultipliers()
        internal view
        returns (uint256, uint256, uint256, uint256)
    {
        // Total Supply of the expedition
        uint256 deitiedSupplyWithBonus = expeditionInfo.supplies.deitied * expeditionDeityWinningsMult / 100;
        uint256 totalExpedSupply = deitiedSupplyWithBonus + expeditionInfo.supplies.safe;
        if (totalExpedSupply == 0) return (0, 0, 0, 0);

        // Calculate safe winnings multiplier or escape if div/0
        uint256 summitSafeEmission = (expeditionInfo.summit.roundEmission * 1e18 * expeditionInfo.supplies.safe) / totalExpedSupply;
        uint256 rewardSafeEmission = (expeditionInfo.usdc.roundEmission * 1e18 * expeditionInfo.supplies.safe) / totalExpedSupply;

        // Calculate winning deity's winnings multiplier or escape if div/0
        uint256 summitDeitiedEmission = (expeditionInfo.summit.roundEmission * 1e18 * deitiedSupplyWithBonus) / totalExpedSupply;
        uint256 rewardDeitiedEmission = (expeditionInfo.usdc.roundEmission * 1e18 * deitiedSupplyWithBonus) / totalExpedSupply;

        return (
            summitSafeEmission,
            rewardSafeEmission,
            summitDeitiedEmission,
            rewardDeitiedEmission
        );
    }


    /// @dev User's staked amount, and how much they will win with that stake amount
    /// @param _userAdd User to check
    /// @return (
    ///     guaranteedSummitYield
    ///     guaranteedUSDCYield
    ///     deitiedSummitYield
    ///     deitiedUSDCYield
    /// )
    function potentialWinnings(address _userAdd)
        public view
        validUserAdd(_userAdd)
        returns (uint256, uint256, uint256, uint256)
    {
        UserExpeditionInfo storage user = userExpeditionInfo[_userAdd];

        if (!user.entered || !expeditionInfo.live || !expeditionInfo.launched) return (0, 0, 0, 0);

        uint256 userSafeEverest = _getUserSafeEverest(user, user.safetyFactor);
        uint256 userDeitiedEverest = _getUserDeitiedEverest(user, user.safetyFactor);

        (uint256 summitSafeEmissionMultE18, uint256 usdcSafeEmissionMultE18, uint256 summitDeitiedEmissionMultE18, uint256 usdcDeitiedEmissionMultE18) = _calculateEmissionMultipliers();

        return(
            expeditionInfo.supplies.safe == 0 ? 0 : ((summitSafeEmissionMultE18 * userSafeEverest) / expeditionInfo.supplies.safe) / 1e18,
            expeditionInfo.supplies.safe == 0 ? 0 : ((usdcSafeEmissionMultE18 * userSafeEverest) / expeditionInfo.supplies.safe) / 1e18,
            expeditionInfo.supplies.deity[user.deity] == 0 ? 0 : ((summitDeitiedEmissionMultE18 * userDeitiedEverest) / expeditionInfo.supplies.deity[user.deity]) / 1e18,
            expeditionInfo.supplies.deity[user.deity] == 0 ? 0 : ((usdcDeitiedEmissionMultE18 * userDeitiedEverest) / expeditionInfo.supplies.deity[user.deity]) / 1e18
        );
    }




    // ------------------------------------------------------------------
    // --   R O L L O V E R   E L E V A T I O N   R O U N D
    // ------------------------------------------------------------------
    
    
    /// @dev Rolling over all expeditions
    ///      Expeditions set to open (expedition.startRound == nextRound) are enabled
    ///      Expeditions set to end are disabled
    function rollover()
        public
    {
        // Ensure that the expedition is ready to be rolled over, ensures only a single user can perform the rollover
        elevationHelper.validateRolloverAvailable(EXPEDITION);

        // Selects the winning totem for the round, storing it in the elevationHelper contract
        elevationHelper.selectWinningTotem(EXPEDITION);

        // Update the round index in the elevationHelper, effectively starting the next round of play
        elevationHelper.rolloverElevation(EXPEDITION);

        uint256 currRound = elevationHelper.roundNumber(EXPEDITION);

        _rolloverExpedition(currRound);

        emit Rollover(msg.sender);
    }


    /// @dev Roll over a single expedition
    /// @param _currRound Current round
    function _rolloverExpedition(uint256 _currRound)
        internal
    {
        if (!expeditionInfo.live) return;

        if (!expeditionInfo.launched) {
            expeditionInfo.launched = true;
            return;
        }

        uint8 winningDeity = elevationHelper.winningTotem(EXPEDITION, _currRound - 1);

        // Calculate emission multipliers
        (uint256 summitSafeEmissionMultE18, uint256 usdcSafeEmissionMultE18, uint256 summitDeitiedEmissionMultE18, uint256 usdcDeitiedEmissionMultE18) = _calculateEmissionMultipliers();

        // Mark current round's emission to be distributed
        expeditionInfo.summit.markedForDist += (summitSafeEmissionMultE18 + summitDeitiedEmissionMultE18) / 1e18;
        expeditionInfo.usdc.markedForDist += (usdcSafeEmissionMultE18 + usdcDeitiedEmissionMultE18) / 1e18;
        expeditionInfo.summit.distributed += (summitSafeEmissionMultE18 + summitDeitiedEmissionMultE18) / 1e18;
        expeditionInfo.usdc.distributed += (usdcSafeEmissionMultE18 + usdcDeitiedEmissionMultE18) / 1e18;

        // Update the guaranteed emissions mults
        if (expeditionInfo.supplies.safe > 0) {
            expeditionInfo.summit.safeMult += summitSafeEmissionMultE18 / expeditionInfo.supplies.safe;
            expeditionInfo.usdc.safeMult += usdcSafeEmissionMultE18 / expeditionInfo.supplies.safe;
        }
        // Update winning deity's running winnings mult
        if (expeditionInfo.supplies.deity[winningDeity] > 0) {
            expeditionInfo.summit.deityMult[winningDeity] += summitDeitiedEmissionMultE18 / expeditionInfo.supplies.deity[winningDeity];
            expeditionInfo.usdc.deityMult[winningDeity] += usdcDeitiedEmissionMultE18 / expeditionInfo.supplies.deity[winningDeity];
        }

        expeditionInfo.roundsRemaining -= 1;
    }
    


    

    // ------------------------------------------------------------
    // --   W I N N I N G S   C A L C U L A T I O N S 
    // ------------------------------------------------------------


    /// @dev User's 'safe' everest that is guaranteed to earn
    function _getUserSafeEverest(UserExpeditionInfo storage user, uint8 _safetyFactor)
        internal view
        returns (uint256)
    {
        return user.everestOwned * _safetyFactor / 100;
    }
    /// @dev User's total everest in the pot
    function _getUserDeitiedEverest(UserExpeditionInfo storage user, uint8 _safetyFactor)
        internal view
        returns (uint256)
    {
        return user.everestOwned * (100 - _safetyFactor) / 100;
    }

    /// @dev Calculation of winnings that are available to be harvested
    /// @return Total winnings for a user, including vesting on previous round's winnings (if any)
    function _harvestableWinnings(UserExpeditionInfo storage user)
        internal view
        returns (uint256, uint256)
    {
        uint256 currRound = elevationHelper.roundNumber(EXPEDITION);

        // If user interacted in current round, no winnings available
        if (!user.entered || user.prevInteractedRound == currRound) return (0, 0);

        uint256 safeEverest = _getUserSafeEverest(user, user.safetyFactor);
        uint256 deitiedEverest = _getUserDeitiedEverest(user, user.safetyFactor);

        return (
            ((safeEverest * (expeditionInfo.summit.safeMult - user.summit.safeDebt)) / 1e18) +
            ((deitiedEverest * (expeditionInfo.summit.deityMult[user.deity] - user.summit.deityDebt)) / 1e18),
            ((safeEverest * (expeditionInfo.usdc.safeMult - user.usdc.safeDebt)) / 1e18) +
            ((deitiedEverest * (expeditionInfo.usdc.deityMult[user.deity] - user.usdc.deityDebt)) / 1e18)
        );
    }
    


    

    // ------------------------------------------------------------
    // --   U S E R   I N T E R A C T I O N S
    // ------------------------------------------------------------


    /// @dev Update the users round interaction
    function _updateUserRoundInteraction(UserExpeditionInfo storage user)
        internal
    {
        uint256 currRound = elevationHelper.roundNumber(EXPEDITION);

        user.safeSupply = _getUserSafeEverest(user, user.safetyFactor);
        user.deitiedSupply = _getUserDeitiedEverest(user, user.safetyFactor);

        // Acc winnings per share of user's deity of both SUMMIT token and USDC token
        user.summit.safeDebt = expeditionInfo.summit.safeMult;
        user.usdc.safeDebt = expeditionInfo.usdc.safeMult;
        user.summit.deityDebt = expeditionInfo.summit.deityMult[user.deity];
        user.usdc.deityDebt = expeditionInfo.usdc.deityMult[user.deity];

        // Update the user's previous interacted round to be this round
        user.prevInteractedRound = currRound;
    }



    // ------------------------------------------------------------
    // --   E X P E D   H E L P E R S
    // ------------------------------------------------------------

    function _harvestExpedition(UserExpeditionInfo storage user)
        internal
        returns (uint256, uint256)
    {
        // Get calculated harvestable winnings
        (uint256 summitWinnings, uint256 usdcWinnings) = _harvestableWinnings(user);

        // Handle SUMMIT winnings
        if (summitWinnings > 0) {
            user.summit.lifetimeWinnings += summitWinnings;

            // Claim SUMMIT winnings (lock for 30 days)
            expeditionInfo.summit.token.safeTransfer(address(summitLocking), summitWinnings);
            summitLocking.addLockedWinnings(summitWinnings, 0, user.userAdd);
            expeditionInfo.summit.markedForDist -= summitWinnings;
        }

        // Transfer USDC winnings to user
        if (usdcWinnings > 0) {
            user.usdc.lifetimeWinnings += usdcWinnings;
            expeditionInfo.usdc.token.safeTransfer(user.userAdd, usdcWinnings);
            expeditionInfo.usdc.markedForDist -= usdcWinnings;
        }

        return (summitWinnings, usdcWinnings);
    }





    // ---------------------------------------
    // --   E V E R E S T
    // ---------------------------------------


    function syncEverestAmount()
        public
        nonReentrant
    {
        _updateUserEverestAmount(
            msg.sender,
            _getUserEverest(msg.sender)
        );
    }


    function updateUserEverest(uint256 _everestAmount, address _userAdd)
        external override
        onlyEverestToken
    {
        _updateUserEverestAmount(
            _userAdd,
            _everestAmount
        );
    }

    function _updateUserEverestAmount(address _userAdd, uint256 _everestAmount)
        internal
    {
        UserExpeditionInfo storage user = _getOrCreateUserInfo(_userAdd);

        // Harvest winnings from expedition
        _harvestExpedition(user);

        // Save user's existing safe and deitied everest supplies
        uint256 existingSafeSupply = _getUserSafeEverest(user, user.safetyFactor);
        uint256 existingDeitiedSupply = _getUserDeitiedEverest(user, user.safetyFactor);

        // Update user's owned everest amount
        user.everestOwned = _everestAmount;

        // Update user
        _updateUserRoundInteraction(user);

        // Remove user's existing supplies from expedition, add new supplies
        if (user.entered) {
            expeditionInfo.supplies.safe = expeditionInfo.supplies.safe - existingSafeSupply + _getUserSafeEverest(user, user.safetyFactor);
            expeditionInfo.supplies.deitied = expeditionInfo.supplies.deitied - existingDeitiedSupply + _getUserDeitiedEverest(user, user.safetyFactor);
            expeditionInfo.supplies.deity[user.deity] = expeditionInfo.supplies.deity[user.deity] - existingDeitiedSupply + _getUserDeitiedEverest(user, user.safetyFactor);
        }
    }



    // ----------------------------------------------------------------------
    // --  E X P E D   D I R E C T   I N T E R A C T I O N S
    // ----------------------------------------------------------------------


    function _getOrCreateUserInfo(address _userAdd)
        internal
        returns (UserExpeditionInfo storage)
    {
        UserExpeditionInfo storage user = userExpeditionInfo[_userAdd];
        user.userAdd = _userAdd;
        return user;
    }


    /// @dev Select a user's deity, update the expedition's deities with the switched funds
    function selectDeity(uint8 _newDeity)
        public
        nonReentrant validDeity(_newDeity) expeditionInteractionsAvailable
    {
        UserExpeditionInfo storage user = _getOrCreateUserInfo(msg.sender);

        // Early exit if deity is same as current
        require(!user.deitySelected || user.deity != _newDeity, "Deity must be different");

        // Harvest any winnings in this expedition
        _harvestExpedition(user);

        // Update user deity in state
        user.deity = _newDeity;
        user.deitySelected = true;
        user.deitySelectionRound = elevationHelper.roundNumber(EXPEDITION);
        
        // Update user's interaction in this expedition
        _updateUserRoundInteraction(user);
        
        // Transfer deitied everest from previous deity to new deity
        if (user.entered) {
            expeditionInfo.supplies.deity[user.deity] -= user.deitiedSupply;
            expeditionInfo.supplies.deity[_newDeity] += user.deitiedSupply;
        }

        emit DeitySelected(msg.sender, _newDeity, user.deitySelectionRound);
    }


    /// @dev Change the safety factor of a user
    function selectSafetyFactor(uint8 _newSafetyFactor)
        public
        nonReentrant validSafetyFactor(_newSafetyFactor) expeditionInteractionsAvailable
    {
        UserExpeditionInfo storage user = _getOrCreateUserInfo(msg.sender);

        // Early exit if safety factor is the same
        require(!user.safetyFactorSelected || user.safetyFactor != _newSafetyFactor, "SafetyFactor must be different");

        // Harvest any winnings in this expedition
        _harvestExpedition(user);

        // Store existing supplies to update expedition supplies
        uint256 existingSafeSupply = user.safeSupply;
        uint256 existingDeitiedSupply = user.deitiedSupply;

        // Update safety factor in user state
        user.safetyFactor = _newSafetyFactor;
        user.safetyFactorSelected = true;
        
        // Update user's interaction in this expedition
        _updateUserRoundInteraction(user);

        // Remove safe and deitied everest from existing supply states
        if (user.entered) {
            expeditionInfo.supplies.safe = expeditionInfo.supplies.safe - existingSafeSupply + user.safeSupply;
            expeditionInfo.supplies.deitied = expeditionInfo.supplies.deitied - existingDeitiedSupply + user.deitiedSupply;
            expeditionInfo.supplies.deity[user.deity] = expeditionInfo.supplies.deity[user.deity] - existingDeitiedSupply + user.deitiedSupply;
        }

        emit SafetyFactorSelected(msg.sender, _newSafetyFactor);
    }


    function userSatisfiesExpeditionRequirements(address _userAdd)
        public view
        returns (bool, bool, bool)
    {
        return (
            userExpeditionInfo[_userAdd].everestOwned > 0,
            userExpeditionInfo[_userAdd].deitySelected,
            userExpeditionInfo[_userAdd].safetyFactorSelected
        );
    }

    function joinExpedition()
        public
        userOwnsEverest userIsEligibleToJoinExpedition expeditionInteractionsAvailable
    {
        UserExpeditionInfo storage user = userExpeditionInfo[msg.sender];        

        // Mark user interacting with this expedition to the user's expeditions slot
        require(!user.entered, "Already entered");
        user.entered = true;

        // Update the user's round interaction with updated info
        _updateUserRoundInteraction(user);

        // Add users everest to exped supplies at current risk rate
        expeditionInfo.supplies.safe += user.safeSupply;
        expeditionInfo.supplies.deitied += user.deitiedSupply;
        expeditionInfo.supplies.deity[user.deity] += user.deitiedSupply;

        emit UserJoinedExpedition(msg.sender, user.deity, user.safetyFactor, user.everestOwned);
    }

    function harvestExpedition()
        public
        nonReentrant userOwnsEverest expeditionInteractionsAvailable
    {
        UserExpeditionInfo storage user = userExpeditionInfo[msg.sender];        
        require(user.entered, "Must be entered to harvest");

        (uint256 summitHarvested, uint256 usdcHarvested) = _harvestExpedition(user);
        _updateUserRoundInteraction(user);

        emit UserHarvestedExpedition(msg.sender, summitHarvested, usdcHarvested);
    }
}
