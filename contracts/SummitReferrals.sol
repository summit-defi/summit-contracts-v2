// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "./Cartographer.sol";
import "./SummitToken.sol";

contract SummitReferrals {
    address public cartographer;
    SummitToken public summit;
    address constant burnAdd = 0x000000000000000000000000000000000000dEaD;
    
    constructor(address _cartographer) public {
        require(_cartographer != address(0), "Cart required");
        cartographer = _cartographer;
    }
    
    function enable(address _summit) external onlyCartographer {
        summit = SummitToken(_summit);
        summit.approve(burnAdd, 1e50);
    }

    // REFERRALS
    uint256 roundIndex = 0; 
    mapping(address => address) public referrerOf;
    mapping(uint256 => mapping(address => uint256)) public pendingReferralRewards;
    mapping(address => uint256) public totalReferralRewards;


    // EVENTS
    event ReferralCreated(address indexed referrerAddress, address indexed refereeAddress);
    event ReferralRewardsRedeemed(address indexed referrerAddress, uint256 amount);
    event UnclaimedReferralRewardsBurned(address indexed burner, uint256 indexed round, uint256 amount);

    function createReferral(address referrerAddress) public {
        require(referrerAddress != msg.sender, "Cant refer yourself");
        require(referrerOf[msg.sender] == address(0), "Already been referred");
        require(referrerOf[referrerAddress] != msg.sender, "No reciprocal referrals");
        require(referrerOf[referrerOf[referrerAddress]] != msg.sender, "No 3 user cyclical referrals");
        referrerOf[msg.sender] = referrerAddress;
        emit ReferralCreated(referrerAddress, msg.sender);
    }  

    modifier onlyCartographer() {
        require(msg.sender == cartographer, "Only Cartographer can call function" );
        _;
    }
    function addReferralRewardsIfNecessary(address referee, uint256 amount) external onlyCartographer {
        if (referrerOf[referee] == address(0)) { return; }
        uint256 additionalReward = amount.div(100);
        pendingReferralRewards[roundIndex][referrerOf[referee]] += additionalReward;
        pendingReferralRewards[roundIndex][referee] += additionalReward;
        totalReferralRewards[referrerOf[referee]] += additionalReward;
        totalReferralRewards[referee] += additionalReward;
    }
    
    function getReferralRound() external view returns(uint256) {
        return roundIndex;
    }

    // Called after burn button pressed with correct code and tokens burned
    function burnUnclaimedReferralRewardsAndRolloverRound(address burner) external onlyCartographer {
        uint256 burnAmount = summit.balanceOf(address(this));

        if (burnAmount > 0) {
            summit.transfer(burnAdd, burnAmount);
        }
        
        roundIndex += 1;

        emit UnclaimedReferralRewardsBurned(burner, roundIndex - 1, burnAmount);
    }

    // To be called after rewards redeemed in Cartographer
    function redeemReferralRewards() public {
        require(pendingReferralRewards[roundIndex][msg.sender] > 0, "No referral rewards to redeem");
        uint256 toBeRedeemed = pendingReferralRewards[roundIndex][msg.sender];

        // Safety hatch if required summit has recently been burned, followed by a user harvesting rewards
        if (toBeRedeemed > summit.balanceOf(address(this))) {
            Cartographer(cartographer).referralRewardsMintSafetyHatch(toBeRedeemed);
        }

        safeSummitTransfer(msg.sender, toBeRedeemed);
        pendingReferralRewards[roundIndex][msg.sender] = 0;

        emit ReferralRewardsRedeemed(msg.sender, toBeRedeemed);
    }
    
    function getReferralRewardsToBeBurned() public view returns (uint256) {
        return summit.balanceOf(address(this));
    }

    function getPendingReferralRewards(address user) public view returns (uint256) {
        return pendingReferralRewards[roundIndex][user];
    }


    // UTIL
    function safeSummitTransfer(address _to, uint256 _amount) internal {
        uint256 summitBal = summit.balanceOf(address(this));
        bool transferSuccess = false;
        if (_amount > summitBal) {
            transferSuccess = summit.transfer(_to, summitBal);
        } else {
            transferSuccess = summit.transfer(_to, _amount);
        }
        require(transferSuccess, "SafeSummitTransfer: failed");
    }    
}