// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";

/**
 * THIS IS AN EXAMPLE CONTRACT WHICH USES HARDCODED VALUES FOR CLARITY.
 * PLEASE DO NOT USE THIS CODE IN PRODUCTION.
 */

/**
 * Request testnet LINK and ETH here: https://faucets.chain.link/
 * Find information on LINK Token Contracts and get the latest ETH and LINK faucets here: https://docs.chain.link/docs/link-token-contracts/
 */
 
contract ChainlinkVRF is Ownable, VRFConsumerBase {
    
    bytes32 internal keyHash;
    uint256 internal fee;
    
    uint256 public randomResult;
    
    /**
     * Constructor inherits VRFConsumerBase
     * @param _vrfCoordinator address of VRFCoordinator contract
     * @param _linkToken address of LINK token contract
     * @param _fee address of LINK token contract
     * @param _keyHash address of LINK token contract
    */     
    constructor(address _vrfCoordinator, address _linkToken, bytes32 _keyHash, uint256 _fee) 
        VRFConsumerBase(
            _vrfCoordinator, // VRF Coordinator
            _linkToken  // LINK Token
        )
    {
        keyHash = _keyHash;
        fee = _fee; // 0.1 LINK (Varies by network)
    }
    
    /** 
     * Requests randomness 
     */
    function getRandomNumber() public returns (bytes32 requestId) {
        require(LINK.balanceOf(address(this)) >= fee, "Not enough LINK - fill contract with faucet");
        return requestRandomness(keyHash, fee);
    }

    /**
     * Callback function used by VRF Coordinator
     */
    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
        randomResult = randomness;
    }

    function withdrawLink() external onlyOwner {
        LINK.transfer(msg.sender, LINK.balanceOf(address(this)));
    }
}
