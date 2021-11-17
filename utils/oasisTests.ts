import { getNamedSigners } from '@nomiclabs/hardhat-ethers/dist/src/helpers';
import { expect } from 'chai'
import hre, { ethers } from 'hardhat';
import { consoleLog, depositedAfterFee, e18, EVENT, expect6FigBigNumberEquals, mineBlock, toDecimal } from '.';
import { getTimestamp, mineBlocks } from './utils';


// DEPOSIT
const standardDepositShouldSucceed = (pid: number, depositFee: number = 0) => {
    it('DEPOSIT: Standard deposit should succeed', async function() {
      const { user1 } = await getNamedSigners(hre)
      const cartographer = await ethers.getContract('Cartographer')
      const cartographerOasis = await ethers.getContract('CartographerOasis')
  
      const initialStaked = (await cartographerOasis.connect(user1).userInfo(pid, user1.address)).staked
    
      const amountAfterFee = depositedAfterFee(e18(5), depositFee)
      await expect(
          cartographer.connect(user1).deposit(pid, e18(5), 0, 1)
      ).to.emit(cartographer, EVENT.Deposit).withArgs(user1.address, pid, amountAfterFee, 0)
      
      const finalStaked = (await cartographerOasis.connect(user1).userInfo(pid, user1.address)).staked
      expect(finalStaked).to.equal(initialStaked.add(amountAfterFee))
    })
  }

const incorrectTotemDepositShouldSucceed = (pid: number, depositFee: number = 0) => {
    it('DEPOSIT: Incorrect totem deposit should succeed', async function() {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const cartographerOasis = await ethers.getContract('CartographerOasis')

        const initialStaked = (await cartographerOasis.connect(user1).userInfo(pid, user1.address)).staked

        const amountAfterFee = depositedAfterFee(e18(5), depositFee)
        await expect(
          cartographer.connect(user1).deposit(pid, e18(5), 0, 1)
        ).to.emit(cartographer, EVENT.Deposit).withArgs(user1.address, pid, amountAfterFee, 0)
          
        const userInfo = await cartographerOasis.connect(user1).userInfo(pid, user1.address)
        expect(userInfo.staked).to.equal(initialStaked.add(amountAfterFee))
      })
}


// PENDING
const pendingSUMMITShouldIncreaseEachBlock = (pid: number) => {
    it('PENDING: Users pending SUMMIT should increase each block', async function() {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
    
        const timestampBefore = await getTimestamp()
        const [pendingSummit0] = await cartographer.rewards(pid, user1.address)
        
        await mineBlock()
        
        const timestampAfter = await getTimestamp()
        const [pendingSummit1] = await cartographer.rewards(pid, user1.address)

        const allocPoint = await cartographer.elevationModulatedAllocation(pid)
        const totalAllocPoint = await cartographer.totalSharedAlloc()
        const summitPerSecond = await cartographer.summitPerSecond()
        const timestampDiff = timestampAfter - timestampBefore
        const blockPendingDiff = summitPerSecond.mul(timestampDiff).mul(allocPoint).div(totalAllocPoint)


        consoleLog({
          timestampDiff,
          pendingSummit0: toDecimal(pendingSummit0),
          pendingSummit1: toDecimal(pendingSummit1),
          blockPendingDiff: toDecimal(blockPendingDiff),
        })
        expect6FigBigNumberEquals(pendingSummit1.sub(pendingSummit0), blockPendingDiff)
    
        await mineBlocks(3)

        const [pendingSummit2] = await cartographer.rewards(pid, user1.address)
        expect6FigBigNumberEquals(pendingSummit2.sub(pendingSummit1), blockPendingDiff.mul(3))
      })
}

const pendingSUMMITRedeemedOnDeposit = (pid: number, depositFee: number = 0) => {
    it('DEPOSIT / REDEEM: User should redeem pending on further deposit', async function() {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const cartographerOasis = await ethers.getContract('CartographerOasis')

        const initialStaked = (await cartographerOasis.connect(user1).userInfo(pid, user1.address)).staked

        await expect(
          cartographer.connect(user1).deposit(pid, e18(5), 0, 0)
        ).to.emit(cartographer, EVENT.RedeemRewards)
          
        const userInfo = await cartographerOasis.connect(user1).userInfo(pid, user1.address)
        const amountAfterFee = depositedAfterFee(e18(5), depositFee)
        expect(userInfo.staked).to.equal(initialStaked.add(amountAfterFee))
      })
}

const redeemTransfersCorrectSUMMITToAddresses = (pid: number) => {
    it('REDEEM: Redeeming rewards transfers correct amount to addresses', async function() {
      const { user1, dev} = await getNamedSigners(hre)
      const cartographer = await ethers.getContract('Cartographer')
      const summitToken = await ethers.getContract('SummitToken')
      const summitReferrals = await ethers.getContract('SummitReferrals')

      await cartographer.connect(user1).deposit(pid, 0, 0, 0)
      const userSummit = await summitToken.balanceOf(user1.address)
      const referralSummit = await summitToken.balanceOf(summitReferrals.address)
      const devSummit = await summitToken.balanceOf(dev.address)

      await mineBlock()

      // The prev mine will generate rewards, the following deposit will also generate rewards, so this pending must be doubled
      const rewardsPending = (await cartographer.rewards(pid, user1.address))[0].mul('2')
      const totalSummitPending = rewardsPending.div(98).mul(100).div(92).mul(100)
      const referralPending = totalSummitPending.mul(92).div(100).mul(2).div(100)
      const devPending = totalSummitPending.mul(8).div(100)
      await cartographer.connect(user1).deposit(pid, 0, 0, 0)
      
      const userSummitFinal = await summitToken.balanceOf(user1.address)
      const referralSummitFinal = await summitToken.balanceOf(summitReferrals.address)
      const devSummitFinal = await summitToken.balanceOf(dev.address)

      consoleLog({
        user: `${toDecimal(userSummit)} --> ${toDecimal(userSummitFinal)}: Δ ${toDecimal(userSummitFinal.sub(userSummit))}`,
        dev: `${toDecimal(devSummit)} --> ${toDecimal(devSummitFinal)}: Δ ${toDecimal(devSummitFinal.sub(devSummit))}`,
        referral: `${toDecimal(referralSummit)} --> ${toDecimal(referralSummitFinal)}: Δ ${toDecimal(referralSummitFinal.sub(referralSummit))}`,
      })

      expect6FigBigNumberEquals(userSummitFinal, userSummit.add(rewardsPending))
      expect6FigBigNumberEquals(referralSummitFinal, referralSummit.add(referralPending))
      expect6FigBigNumberEquals(devSummitFinal, devSummit.add(devPending))
    })
}


// WITHDRAW
const pendingSUMMITRedeemedOnWithdrawal = (pid: number) => {
  it('WITHDRAW / REDEEM: User should redeem pending on withdraw', async function() {
      const { user1 } = await getNamedSigners(hre)
      const cartographer = await ethers.getContract('Cartographer')
      const cartographerOasis = await ethers.getContract('CartographerOasis')

      const initialStaked = (await cartographerOasis.connect(user1).userInfo(pid, user1.address)).staked

      await expect(
          cartographer.connect(user1).withdraw(pid, initialStaked.div('3'), 0)
      ).to.emit(cartographer, EVENT.RedeemRewards)

      const userInfo = await cartographerOasis.connect(user1).userInfo(pid, user1.address)
      expect6FigBigNumberEquals(userInfo.staked, initialStaked.sub(initialStaked.div('3')))

      const remainingStaked = (await cartographerOasis.connect(user1).userInfo(pid, user1.address)).staked
      await cartographer.connect(user1).withdraw(pid, remainingStaked, 0)

      const userInfo2 = await cartographerOasis.connect(user1).userInfo(pid, user1.address)
      expect(userInfo2.staked).to.equal(0)
  })
}


  // RUNNING LP SUPPLY
  const lpSupplyUpdatesWithDepositsAndWithdrawals = (pid: number, depositFee: number = 0) => {
    it('LPSUPPLY: Should increase and decrease with deposits and withdrawals', async function() {
        const {
            user1,
            user2,
            user3,
        } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const cartographerOasis = await ethers.getContract('CartographerOasis')

        const lpSupplyBefore = (await cartographerOasis.connect(user1).oasisPoolInfo(pid)).supply

        const feeMult = (10000 - depositFee) / 10000
        await cartographer.connect(user1).deposit(pid, e18(5), 0, 0)
        await cartographer.connect(user1).withdraw(pid, e18(3), 0)
        await cartographer.connect(user2).deposit(pid, e18(15), 0, 0)
        await cartographer.connect(user2).withdraw(pid, e18(8.5), 0)
        await cartographer.connect(user3).deposit(pid, e18(1.25), 0, 0)
        const lpSupplyAfter = lpSupplyBefore.add(e18((5 * feeMult) - 3 + (15 * feeMult) - 8.5 + (1.25 * feeMult)))
        const trueLpSupplyAfter = (await cartographerOasis.connect(user1).oasisPoolInfo(pid)).supply
        expect6FigBigNumberEquals(trueLpSupplyAfter, lpSupplyAfter)

        await cartographer.connect(user1).withdraw(pid, e18(1.2), 0)
        await cartographer.connect(user2).deposit(pid, e18(5.85), 0, 0)
        await cartographer.connect(user2).withdraw(pid, e18(2.8), 0)
        await cartographer.connect(user3).deposit(pid, e18(5.25), 0, 0)
        const lpSupplyFinal = lpSupplyAfter.add(e18(-1.2 + (5.85 * feeMult) - 2.8 + (5.25 * feeMult)))
        const trueLpSupplyFinal = (await cartographerOasis.connect(user1).oasisPoolInfo(pid)).supply
        expect6FigBigNumberEquals(trueLpSupplyFinal, lpSupplyFinal)
    })
}


  // REWARDS UPDATING AND SPLITTING
  const rewardsCorrectlyDistributed = (pid: number) => {
      it('REWARDS: Rewards are correctly distributed among pool members', async function() {
        const {
            user1,
            user2,
            user3,
        } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const cartographerOasis = await ethers.getContract('CartographerOasis')

        const user1Staked = (await cartographerOasis.connect(user1).userInfo(pid, user1.address)).staked
        const user2Staked = (await cartographerOasis.connect(user1).userInfo(pid, user2.address)).staked
        const user3Staked = (await cartographerOasis.connect(user1).userInfo(pid, user3.address)).staked
        const totalStaked = user1Staked.add(user2Staked).add(user3Staked)
        const lpSupply = (await cartographerOasis.connect(user1).oasisPoolInfo(pid)).supply
        expect(lpSupply).to.be.equal(totalStaked)

        await cartographerOasis.updatePool(pid)
        const [user1Pending] = await cartographer.rewards(pid, user1.address)
        const [user2Pending] = await cartographer.rewards(pid, user2.address)
        const [user3Pending] = await cartographer.rewards(pid, user3.address)

        await mineBlock()
        await mineBlock()
        await mineBlock()

        const [user1PendingFinal] = await cartographer.rewards(pid, user1.address)
        const [user2PendingFinal] = await cartographer.rewards(pid, user2.address)
        const [user3PendingFinal] = await cartographer.rewards(pid, user3.address)

        const user1Delta = user1PendingFinal.sub(user1Pending)
        const user2Delta = user2PendingFinal.sub(user2Pending)
        const user3Delta = user3PendingFinal.sub(user3Pending)
        const totalDelta = user1Delta.add(user2Delta).add(user3Delta)      

        expect(user1Staked.mul('1000000').div(totalStaked)).to.equal(user1Delta.mul('1000000').div(totalDelta))
        expect(user2Staked.mul('1000000').div(totalStaked)).to.equal(user2Delta.mul('1000000').div(totalDelta))
        expect(user3Staked.mul('1000000').div(totalStaked)).to.equal(user3Delta.mul('1000000').div(totalDelta))
    })
}

export const oasisTests = {
    standardDepositShouldSucceed,
    incorrectTotemDepositShouldSucceed,

    pendingSUMMITShouldIncreaseEachBlock,
    pendingSUMMITRedeemedOnDeposit,
    redeemTransfersCorrectSUMMITToAddresses,

    pendingSUMMITRedeemedOnWithdrawal,

    lpSupplyUpdatesWithDepositsAndWithdrawals,

    rewardsCorrectlyDistributed,
}