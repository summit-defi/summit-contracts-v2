import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { e18, ERR, EVENT, expect6FigBigNumberEquals, mineBlock, oasisTests, PID, toDecimal, POOL_FEE, passthroughTests, consoleLog } from "../utils";
import { oasisUnlockedFixture, poolsFixture } from "./fixtures";


describe("OASIS Pools", function() {
  describe('- Pre Summit Enabled', async function() {
    before(async function () {
      await poolsFixture()
    })

    it(`DEPOSIT: Deposit before summit enabled should succeed`, async function() {
      const { user1 } = await getNamedSigners(hre)
      const cartographer = await ethers.getContract('Cartographer')

      await expect(
          cartographer.connect(user1).deposit(PID.SUMMIT_OASIS, e18(5), 0, 0)
      ).to.emit(cartographer, EVENT.Deposit)
    })
  })

  describe('- Summit Enabled', async function () {
    before(async function () {
      await oasisUnlockedFixture()
    })

  
    // DEPOSIT
    it(`DEPOSIT: Incorrect pid should fail with error "${ERR.POOL_DOESNT_EXIST}"`, async function() {
      const { user1 } = await getNamedSigners(hre)
      const cartographer = await ethers.getContract('Cartographer')

      await expect(
          cartographer.connect(user1).deposit(20, e18(5), 0, 0)
      ).to.be.revertedWith(ERR.POOL_DOESNT_EXIST)
    })
    

    oasisTests.standardDepositShouldSucceed(PID.SUMMIT_OASIS)
    oasisTests.incorrectTotemDepositShouldSucceed(PID.SUMMIT_OASIS)

  
    // PENDING
    oasisTests.pendingSUMMITShouldIncreaseEachBlock(PID.SUMMIT_OASIS)
    oasisTests.pendingSUMMITRedeemedOnDeposit(PID.SUMMIT_OASIS)
    oasisTests.redeemTransfersCorrectSUMMITToAddresses(PID.SUMMIT_OASIS)


    // WITHDRAW
    it(`WITHDRAW: Withdrawing 0 should fail with error ${ERR.BAD_WITHDRAWAL}`, async function() {
      const { user1 } = await getNamedSigners(hre)
      const cartographer = await ethers.getContract('Cartographer')
      await expect(
        cartographer.connect(user1).withdraw(PID.SUMMIT_OASIS, 0, 0)
      ).to.be.revertedWith(ERR.BAD_WITHDRAWAL)
    })
    it(`WITHDRAW: Withdrawing with nothing deposited should fail with error ${ERR.BAD_WITHDRAWAL}`, async function() {
      const { user2 } = await getNamedSigners(hre)
      const cartographer = await ethers.getContract('Cartographer')
      await expect(
        cartographer.connect(user2).withdraw(PID.SUMMIT_OASIS, e18(5), 0)
      ).to.be.revertedWith(ERR.BAD_WITHDRAWAL)
    })
    it(`WITHDRAW: Withdrawing amount higher than staked should fail with error ${ERR.BAD_WITHDRAWAL}`, async function() {
      const { user1 } = await getNamedSigners(hre)
      const cartographer = await ethers.getContract('Cartographer')
      await expect(
        cartographer.connect(user1).withdraw(PID.SUMMIT_OASIS, e18(100), 0)
      ).to.be.revertedWith(ERR.BAD_WITHDRAWAL)
    })
    it(`WITHDRAW: Withdrawing from a pool that doesnt exist should fail with error ${ERR.POOL_DOESNT_EXIST}`, async function() {
      const { user1 } = await getNamedSigners(hre)
      const cartographer = await ethers.getContract('Cartographer')
      await expect(
        cartographer.connect(user1).withdraw(20, e18(1), 0)
      ).to.be.revertedWith(ERR.POOL_DOESNT_EXIST)
    })
    
    oasisTests.pendingSUMMITRedeemedOnWithdrawal(PID.SUMMIT_OASIS)


    // RUNNING LP SUPPLY
    oasisTests.lpSupplyUpdatesWithDepositsAndWithdrawals(PID.SUMMIT_OASIS)


    // DEPOSIT FEE
    it('DEPOSITFEE: Deposit fee should be taken correctly', async function() {
      const { user1, dev, exped } = await getNamedSigners(hre)
      const cartographer = await ethers.getContract('Cartographer')
      const cartographerOasis = await ethers.getContract('CartographerOasis')
      const dummyCakeToken = await ethers.getContract('DummyCAKE');

      const amount = e18(500)
      const depositFeeAmount = amount.mul(POOL_FEE.DUMMY_CAKE_OASIS - POOL_FEE.FEE_TAKEN_DURING_WITHDRAW).div('10000')
      const depositFeeHalf = depositFeeAmount.div('2')
      const depositAfterFee = amount.sub(depositFeeAmount)

      const userBalance = await dummyCakeToken.balanceOf(user1.address);
      const devBalance = await dummyCakeToken.balanceOf(dev.address);
      const expedBalance = await dummyCakeToken.balanceOf(exped.address);
      const cartographerBalance = await dummyCakeToken.balanceOf(cartographer.address);
  
      await expect(
          cartographer.connect(user1).deposit(PID.DUMMY_CAKE_OASIS, amount, 0, 0)
      ).to.emit(cartographer, EVENT.Deposit).withArgs(user1.address, PID.DUMMY_CAKE_OASIS, depositAfterFee, 0)
      
      const userInfo = await cartographerOasis.connect(user1).userInfo(PID.DUMMY_CAKE_OASIS, user1.address)
      consoleLog({ staked: toDecimal(userInfo.staked) })
      expect(userInfo.staked).to.equal(depositAfterFee)

      const userBalanceFinal = await dummyCakeToken.balanceOf(user1.address);
      const devBalanceFinal = await dummyCakeToken.balanceOf(dev.address);
      const expedBalanceFinal = await dummyCakeToken.balanceOf(exped.address);
      const cartographerBalanceFinal = await dummyCakeToken.balanceOf(cartographer.address);

      consoleLog({
          user: `${toDecimal(userBalance)} --> ${toDecimal(userBalanceFinal)}`,
          dev: `${toDecimal(devBalance)} --> ${toDecimal(devBalanceFinal)}`,
          exped: `${toDecimal(expedBalance)} --> ${toDecimal(expedBalanceFinal)}`,
          cartographerOasis: `${toDecimal(cartographerBalance)} --> ${toDecimal(cartographerBalanceFinal)}`,
      })

      expect(userBalanceFinal).to.equal(userBalance.sub(amount))
      expect(devBalanceFinal).to.equal(devBalance.add(depositFeeHalf))
      expect(expedBalanceFinal).to.equal(expedBalance.add(depositFeeHalf))
      expect(cartographerBalanceFinal).to.equal(cartographerBalance.add(depositAfterFee))
    })

    it('WITHDRAWFEE: Withdraw fee should be taken correctly', async function() {
      const { user1, dev, exped } = await getNamedSigners(hre)
      const cartographer = await ethers.getContract('Cartographer')
      const cartographerOasis = await ethers.getContract('CartographerOasis')
      const dummyCakeToken = await ethers.getContract('DummyCAKE');

      const amount = e18(500).sub(e18(500).mul(POOL_FEE.DUMMY_CAKE_OASIS - POOL_FEE.FEE_TAKEN_DURING_WITHDRAW).div(10000))
      const withdrawFeeAmount = amount.mul(POOL_FEE.FEE_TAKEN_DURING_WITHDRAW).div('10000')
      const withdrawFeeHalf = withdrawFeeAmount.div('2')
      const withdrawAfterFee = amount.sub(withdrawFeeAmount)

      const userBalance = await dummyCakeToken.balanceOf(user1.address);
      const devBalance = await dummyCakeToken.balanceOf(dev.address);
      const expedBalance = await dummyCakeToken.balanceOf(exped.address);
      const cartographerBalance = await dummyCakeToken.balanceOf(cartographer.address);

      consoleLog({
        amount: toDecimal(amount),
        withdrawFeeAmount: toDecimal(withdrawFeeAmount),
        withdrawFeeHalf: toDecimal(withdrawFeeHalf),
        withdrawAfterFee: toDecimal(withdrawAfterFee),
      })
  
      await expect(
          cartographer.connect(user1).withdraw(PID.DUMMY_CAKE_OASIS, amount, 0)
      ).to.emit(cartographer, EVENT.Withdraw).withArgs(user1.address, PID.DUMMY_CAKE_OASIS, withdrawAfterFee, 0)
      
      const userInfo = await cartographerOasis.connect(user1).userInfo(PID.DUMMY_CAKE_OASIS, user1.address)
      consoleLog({ staked: toDecimal(userInfo.staked) })
      expect(userInfo.staked).to.equal(0)

      const userBalanceFinal = await dummyCakeToken.balanceOf(user1.address);
      const devBalanceFinal = await dummyCakeToken.balanceOf(dev.address);
      const expedBalanceFinal = await dummyCakeToken.balanceOf(exped.address);
      const cartographerBalanceFinal = await dummyCakeToken.balanceOf(cartographer.address);

      consoleLog({
          user: `${toDecimal(userBalance)} --> ${toDecimal(userBalanceFinal)}`,
          dev: `${toDecimal(devBalance)} --> ${toDecimal(devBalanceFinal)}`,
          exped: `${toDecimal(expedBalance)} --> ${toDecimal(expedBalanceFinal)}`,
          cartographerOasis: `${toDecimal(cartographerBalance)} --> ${toDecimal(cartographerBalanceFinal)}`,
      })

      expect(userBalanceFinal).to.equal(userBalance.add(withdrawAfterFee))
      expect(devBalanceFinal).to.equal(devBalance.add(withdrawFeeHalf))
      expect(expedBalanceFinal).to.equal(expedBalance.add(withdrawFeeHalf))
      expect(cartographerBalanceFinal).to.equal(cartographerBalance.sub(amount))
    })

    // REWARDS UPDATING AND SPLITTING
    oasisTests.rewardsCorrectlyDistributed(PID.SUMMIT_OASIS)


    // ALLOCPOINT
    it('ALLOCPOINT: Only owner can update alloc points', async function () {
      const { dev, user1 } = await getNamedSigners(hre)
      const cartographer = await ethers.getContract('Cartographer')
      const summitToken = await ethers.getContract('SummitToken')

      await expect(
        cartographer.connect(user1).setTokenSharedAlloc(summitToken.address, 2000)
      ).to.be.revertedWith(ERR.NON_OWNER)

      await expect(
        cartographer.connect(dev).setTokenSharedAlloc(summitToken.address, 2000)
      ).to.emit(cartographer, EVENT.TokenAllocUpdated).withArgs(summitToken.address, 2000)
    })
    it('ALLOCPOINT: Updated alloc points is reflected in cartographer', async function () {
      const { user1 } = await getNamedSigners(hre)
      const cartographer = await ethers.getContract('Cartographer')

      const allocPoint = await cartographer.elevationModulatedAllocation(PID.SUMMIT_OASIS)
      const totalAllocPoint = await cartographer.connect(user1).totalSharedAlloc()

      expect(allocPoint).to.equal(200000)
      expect(totalAllocPoint).to.equal(225000)
    })
    it('ALLOCPOINT: Rewards change based on allocpoint share', async function () {
      const { dev, user1 } = await getNamedSigners(hre)
      const cartographer = await ethers.getContract('Cartographer')
      const cartographerOasis = await ethers.getContract('CartographerOasis')

      // Checks that the rewards before and after alloc point update scale correctly
      await cartographer.connect(dev).set(PID.SUMMIT_OASIS, 400, 0, true)

      const allocPoint400 = await cartographer.elevationModulatedAllocation(PID.SUMMIT_OASIS)
      const totalAllocPoint400 = await cartographer.connect(user1).totalSharedAlloc()
      await mineBlock()
      const [pendingInit] = await cartographer.rewards(PID.SUMMIT_OASIS, user1.address)
      
      await cartographer.connect(dev).set(PID.SUMMIT_OASIS, 25, 0, true)      
      const [pending400] = await cartographer.rewards(PID.SUMMIT_OASIS, user1.address)
      const delta400 = pending400.sub(pendingInit)
      const scaledDelta400 = delta400.div(allocPoint400).mul(totalAllocPoint400)

      await mineBlock()
      const [pending25] = await cartographer.rewards(PID.SUMMIT_OASIS, user1.address)
      const delta25 = pending25.sub(pending400)
      const allocPoint25 = await cartographer.elevationModulatedAllocation(PID.SUMMIT_OASIS)
      const totalAllocPoint25 = await cartographer.connect(user1).totalSharedAlloc()
      const scaledDelta25 = delta25.div(allocPoint25).mul(totalAllocPoint25)

      expect6FigBigNumberEquals(scaledDelta400, scaledDelta25)
    })
    it('ALLOCPOINT: No rewards are earned on 0 alloc point', async function () {
      const { dev, user1 } = await getNamedSigners(hre)
      const cartographer = await ethers.getContract('Cartographer')
      const cartographerOasis = await ethers.getContract('CartographerOasis')

      // Checks that the rewards before and after alloc point update scale correctly
      await cartographer.connect(dev).set(PID.SUMMIT_OASIS, 0, 0, true)

      const allocPoint0 = await cartographer.elevationModulatedAllocation(PID.SUMMIT_OASIS)
      expect (allocPoint0).to.equal(0)

      await mineBlock()
      const [pendingInit] = await cartographer.rewards(PID.SUMMIT_OASIS, user1.address)
      await mineBlock()
      const [pending0] = await cartographer.rewards(PID.SUMMIT_OASIS, user1.address)
      const delta0 = pending0.sub(pendingInit)

      expect(delta0).to.equal(0)
    })
  })

  describe('- Oasis Passthrough Staking', async function() {
    before(async function() {
        await oasisUnlockedFixture()
    })
    passthroughTests.vaultTests(PID.DUMMY_BIFI_OASIS, POOL_FEE.DUMMY_BIFI_OASIS)
    passthroughTests.switchPassthroughStrategyVaultToMasterChef(PID.DUMMY_BIFI_OASIS, POOL_FEE.DUMMY_BIFI_OASIS)
    passthroughTests.masterChefTests(PID.DUMMY_BIFI_OASIS, POOL_FEE.DUMMY_BIFI_OASIS)
    passthroughTests.switchPassthroughStrategyMasterChefToVault(PID.DUMMY_BIFI_OASIS)
  })
})

