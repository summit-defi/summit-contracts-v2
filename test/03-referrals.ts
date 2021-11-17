import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre, { ethers, network } from "hardhat";
import { e18, ERR, EVENT, EVM, getTimestamp, mineBlock, mineBlocks, PID, setTimestamp, toDecimal, ZEROADD } from "../utils";
import { oasisUnlockedFixture } from "./fixtures";

describe("Referrals", function() {
    before(async function () {
        await oasisUnlockedFixture()
    })

    // REFERRING
    it(`REFERRAL BURN: Attempting to burn before summit enabled should fail with error ${ERR.REFERRAL_BURN_NOT_AVAILABLE}`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')

        await expect(
            cartographer.connect(user1).rolloverReferral()
        ).to.be.revertedWith(ERR.REFERRAL_BURN_NOT_AVAILABLE)
    })
    it(`REFERRAL: Attempting to refer self Should fail with error "${ERR.SELF_REFERRER}"`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitReferrals = await ethers.getContract('SummitReferrals')

        await expect(
            summitReferrals.connect(user1).createReferral(user1.address)
        ).to.be.revertedWith(ERR.SELF_REFERRER)
    })
    it(`REFERRAL: Valid referral should succeed`, async function() {
        const { user1, user2 } = await getNamedSigners(hre)
        const summitReferrals = await ethers.getContract('SummitReferrals')

        await expect(
            summitReferrals.connect(user1).createReferral(user2.address)
        ).to.emit(summitReferrals, EVENT.ReferralCreated).withArgs(user2.address, user1.address)
    })
    it(`REFERRAL: Attempting to create another referral should fail with error "${ERR.ALREADY_REFERRED}"`, async function() {
        const { user1, user3 } = await getNamedSigners(hre)
        const summitReferrals = await ethers.getContract('SummitReferrals')

        await expect(
            summitReferrals.connect(user1).createReferral(user3.address)
        ).to.be.revertedWith(ERR.ALREADY_REFERRED)
    })
    it(`REFERRAL: Attempting to refer your referrer should fail with error "${ERR.RECIPROCAL_REFERRAL}"`, async function() {
        const { user1, user2 } = await getNamedSigners(hre)
        const summitReferrals = await ethers.getContract('SummitReferrals')

        await expect(
            summitReferrals.connect(user2).createReferral(user1.address)
        ).to.be.revertedWith(ERR.RECIPROCAL_REFERRAL)
    })
    it('REFERRAL: Users referrer and referral status should be correct', async function() {
        const { user2, user3 } = await getNamedSigners(hre)
        const summitReferrals = await ethers.getContract('SummitReferrals')

        expect(await summitReferrals.connect(user2).referrerOf(user2.address)).to.equal(ZEROADD)
        await summitReferrals.connect(user2).createReferral(user3.address)
        expect(await summitReferrals.connect(user2).referrerOf(user2.address)).to.equal(user3.address)
    })


    // REFERRAL REWARDS
    it('REFERRAL REWARDS: User1 and User2 should earn referral rewards on User1 reward withdraw', async function() {
        // USER1 HAS BEEN REFERRED BY USER2
        const { user1, user2 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const summitToken = await ethers.getContract('SummitToken')
        const summitReferrals = await ethers.getContract('SummitReferrals')

        await cartographer.connect(user1).deposit(PID.SUMMIT_OASIS, e18(50), 0, 0)
        await mineBlock()
        await mineBlock()
        await mineBlock()
        await mineBlock()
        await mineBlock()

        const userSummitInit = await summitToken.balanceOf(user1.address)
        await cartographer.connect(user1).deposit(PID.SUMMIT_OASIS, 0, 0, 0)
        const userSummitFinal = await summitToken.balanceOf(user1.address)
        const deltaSummit = userSummitFinal.sub(userSummitInit)
        const referralRewardAmount = deltaSummit.div(100)
                
        const pendingUser1ReferralReward = await summitReferrals.getPendingReferralRewards(user1.address)
        const pendingUser2ReferralReward = await summitReferrals.getPendingReferralRewards(user2.address)

        expect(pendingUser1ReferralReward).to.equal(referralRewardAmount)
        expect(pendingUser2ReferralReward).to.equal(referralRewardAmount)
    })
    it('REFERRAL REWARDS: User1 and User2 can withdraw the correct amount of referral rewards', async function() {
        // USER1 HAS BEEN REFERRED BY USER2
        const { user1, user2 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const summitToken = await ethers.getContract('SummitToken')
        const summitReferrals = await ethers.getContract('SummitReferrals')

        const pendingUser1ReferralReward = await summitReferrals.getPendingReferralRewards(user1.address)
        const pendingUser2ReferralReward = await summitReferrals.getPendingReferralRewards(user2.address)
        
        const user1SummitInit = await summitToken.balanceOf(user1.address)
        const user2SummitInit = await summitToken.balanceOf(user2.address)

        await summitReferrals.connect(user1).redeemReferralRewards()
        await summitReferrals.connect(user2).redeemReferralRewards()

        const user1SummitFinal = await summitToken.balanceOf(user1.address)
        const user2SummitFinal = await summitToken.balanceOf(user2.address)
        
        const deltaUser1Summit = user1SummitFinal.sub(user1SummitInit)
        const deltaUser2Summit = user2SummitFinal.sub(user2SummitInit)

        expect(pendingUser1ReferralReward).to.equal(deltaUser1Summit)
        expect(pendingUser2ReferralReward).to.equal(deltaUser2Summit)

        const pendingUser1ReferralRewardFinal = await summitReferrals.getPendingReferralRewards(user1.address)
        const pendingUser2ReferralRewardFinal = await summitReferrals.getPendingReferralRewards(user2.address)

        expect(pendingUser1ReferralRewardFinal).to.equal(0)
        expect(pendingUser2ReferralRewardFinal).to.equal(0)
    })
    it(`REFERRAL REWARDS: User3 attempting to redeem rewards should fail with error "${ERR.NO_REWARDS_TO_REDEEM}"`, async function() {
        const { user3 } = await getNamedSigners(hre)
        const summitReferrals = await ethers.getContract('SummitReferrals')

        await expect(
            summitReferrals.connect(user3).redeemReferralRewards()
        ).to.be.revertedWith(ERR.NO_REWARDS_TO_REDEEM)
    })
    it('REFERRAL BURN: Burning the rewards eliminates users rewards and sends a reward to burner', async function() {
        const { user1, user2, user3, dev } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const summitToken = await ethers.getContract('SummitToken')
        const dummySummitLpToken = await ethers.getContract('DummySUMMITLP')
        const summitReferrals = await ethers.getContract('SummitReferrals')

        // Expected reward
        const rewardInNativeToken = e18(5)
        const summitIsToken0InLp = (await dummySummitLpToken.token0()) === summitToken.address
        const [summitLpToken0Reserves, summitLpToken1Reserves] = await dummySummitLpToken.getReserves() 
        const summitInLpReserve = summitIsToken0InLp ? summitLpToken0Reserves : summitLpToken1Reserves
        const nativeInLpReserve = summitIsToken0InLp ? summitLpToken1Reserves : summitLpToken0Reserves
        const rewardInSummitToken = rewardInNativeToken.mul(summitInLpReserve).div(nativeInLpReserve)


        await summitReferrals.connect(user3).createReferral(dev.address)
        await cartographer.connect(user1).deposit(PID.SUMMIT_OASIS, e18(50), 0, 0)
        await cartographer.connect(user2).deposit(PID.SUMMIT_OASIS, e18(40), 0, 0)
        await cartographer.connect(user3).deposit(PID.SUMMIT_OASIS, e18(30), 0, 0)

        await mineBlocks(32)

        await cartographer.connect(user1).deposit(PID.SUMMIT_OASIS, e18(0), 0, 0)
        await cartographer.connect(user2).deposit(PID.SUMMIT_OASIS, e18(0), 0, 0)
        await cartographer.connect(user3).deposit(PID.SUMMIT_OASIS, e18(0), 0, 0)
        
        const user1SummitBalance = await summitToken.balanceOf(user1.address)
                
        const referralBurnTime = (await cartographer.referralBurnTimestamp()).toNumber()
        await setTimestamp(referralBurnTime)

        await expect(
            cartographer.connect(user1).rolloverReferral()
        ).to.emit(cartographer, EVENT.RolloverReferral).withArgs(user1.address)
        
        const user1SummitBalanceFinal = await summitToken.balanceOf(user1.address)
        const referralsSummitBalanceFinal = await summitToken.balanceOf(summitReferrals.address)
        const pendingUser1ReferralRewardFinal = await summitReferrals.getPendingReferralRewards(user1.address)
        const pendingUser2ReferralRewardFinal = await summitReferrals.getPendingReferralRewards(user2.address)
        const pendingUser3ReferralRewardFinal = await summitReferrals.getPendingReferralRewards(user3.address)
    
        expect(user1SummitBalanceFinal.sub(user1SummitBalance)).to.equal(rewardInSummitToken)
        expect(referralsSummitBalanceFinal).to.equal(0)
        expect(pendingUser1ReferralRewardFinal).to.equal(0)
        expect(pendingUser2ReferralRewardFinal).to.equal(0)
        expect(pendingUser3ReferralRewardFinal).to.equal(0)
    })
    it(`REFERRAL BURN: Attempting to burn before round ends should fail with error ${ERR.REFERRAL_BURN_NOT_AVAILABLE}`, async function() {
        const { user2 } = await getNamedSigners(hre)
        const summitReferrals = await ethers.getContract('SummitReferrals')
        const cartographer = await ethers.getContract('Cartographer')

        await expect(
            cartographer.connect(user2).rolloverReferral()
        ).to.be.revertedWith(ERR.REFERRAL_BURN_NOT_AVAILABLE)

        const referralBurnTime = (await cartographer.referralBurnTimestamp()).toNumber()
        await setTimestamp(referralBurnTime)
        const timestamp = await getTimestamp()

        await network.provider.send(EVM.SetNextBlockTimestamp, [Math.max(referralBurnTime, timestamp + 3)])
        await expect(
            cartographer.connect(user2).rolloverReferral()
        ).to.emit(cartographer, EVENT.RolloverReferral).withArgs(user2.address)
    })
})