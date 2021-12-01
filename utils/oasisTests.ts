import { BigNumber } from '@ethersproject/bignumber';
import { getNamedSigners } from '@nomiclabs/hardhat-ethers/dist/src/helpers';
import { expect } from 'chai'
import hre, { ethers } from 'hardhat';
import { cartographerMethod, cartographerSynth, consoleLog, Contracts, depositedAfterFee, e18, EVENT, expect6FigBigNumberEquals, getSubCartographer, mineBlock, OASIS, promiseSequenceMap, subCartGet, subCartMethod, toDecimal } from '.';
import { getContract, getSummitReferrals, getSummitToken } from './contracts';
import { userPromiseSequenceMap, userPromiseSequenceReduce } from './users';
import { e12, getTimestamp, mineBlocks } from './utils';


// DEPOSIT
const standardDepositShouldSucceed = (tokenName: string, depositFee: number = 0) => {
  it('DEPOSIT: Standard deposit should succeed', async function() {
    const { user1 } = await getNamedSigners(hre)
    const token = await ethers.getContract(tokenName)

    const initialStaked = (await subCartGet.userInfo(token.address, OASIS, user1.address)).staked
  
    const amountAfterFee = depositedAfterFee(e18(5), depositFee)
    await cartographerMethod.deposit({
      user: user1,
      tokenAddress: token.address,
      elevation: OASIS,
      amount: e18(5),
    })
    
    const finalStaked = (await subCartGet.userInfo(token.address, OASIS, user1.address)).staked
    expect(finalStaked).to.equal(initialStaked.add(amountAfterFee))
  })
}


// PENDING
const pendingSUMMITShouldIncreaseEachBlock = (tokenName: string) => {
    it('PENDING: Users pending SUMMIT should increase each block', async function() {
        const { user1 } = await getNamedSigners(hre)
        const token = await getContract(tokenName)
    
        const timestampBefore = await getTimestamp()
        const harvestable0 = (await subCartGet.rewards(token.address, OASIS, user1.address)).harvestable
        
        await mineBlock()
        
        const timestampAfter = await getTimestamp()
        const harvestable1 = (await subCartGet.rewards(token.address, OASIS, user1.address)).harvestable

        const summitFarm1SecondEmission = await cartographerSynth.farmSummitEmissionOverDuration(
          token.address,
          OASIS,
          timestampAfter - timestampBefore,
        )

        consoleLog({
          pendingSummit0: toDecimal(harvestable0),
          pendingSummit1: toDecimal(harvestable1),
          summitFarm1SecondEmission: toDecimal(summitFarm1SecondEmission),
        })

        expect6FigBigNumberEquals(harvestable1.sub(harvestable0), summitFarm1SecondEmission)
    
        await mineBlocks(3)

        const timestampFinal = await getTimestamp()

        const summitFarm3SecondEmission = await cartographerSynth.farmSummitEmissionOverDuration(
          token.address,
          OASIS,
          timestampFinal - timestampAfter,
        )

        const harvestable2 = (await subCartGet.rewards(token.address, OASIS, user1.address)).harvestable
        expect6FigBigNumberEquals(harvestable2.sub(harvestable1), summitFarm3SecondEmission)
      })
}

const pendingSUMMITRedeemedOnDeposit = (tokenName: string, depositFee: number = 0) => {
    it('DEPOSIT / REDEEM: User should redeem pending on further deposit', async function() {
        const { user1 } = await getNamedSigners(hre)
        const token = await getContract(tokenName)

        const initialStaked = (await subCartGet.userInfo(token.address, OASIS, user1.address)).staked

        await cartographerMethod.claimSingleFarm({
          user: user1,
          tokenAddress: token.address,
          elevation: OASIS,
        })
          
        const finalStaked = (await subCartGet.userInfo(token.address, OASIS, user1.address)).staked
        expect(finalStaked).to.equal(initialStaked)
      })
}

const redeemTransfersCorrectSUMMITToAddresses = (tokenName: string) => {
    it('REDEEM: Redeeming rewards transfers correct amount to addresses', async function() {
      const { user1, dev} = await getNamedSigners(hre)
      const token = await getContract(tokenName)
      const summitReferrals = await getSummitReferrals()


      const userSummitInit = await token.balanceOf(user1.address)
      const referralSummitInit = await token.balanceOf(summitReferrals.address)
      const devSummitInit = await token.balanceOf(dev.address)

      await mineBlocks(5)

      const expectedRewards = (await subCartGet.rewards(token.address, OASIS, user1.address)).harvestable
        .add(await cartographerSynth.farmSummitEmissionOverDuration(token.address, OASIS, 1))
      const totalSummitPending = expectedRewards.div(98).mul(100).div(92).mul(100)
      const referralPending = totalSummitPending.mul(92).div(100).mul(2).div(100)
      const devPending = totalSummitPending.mul(8).div(100)

      await cartographerMethod.claimSingleFarm({
        user: user1,
        tokenAddress: token.address,
        elevation: OASIS,
      })

      const userSummitFinal = await token.balanceOf(user1.address)
      const referralSummitFinal = await token.balanceOf(summitReferrals.address)
      const devSummitFinal = await token.balanceOf(dev.address)

      consoleLog({
        user: `${toDecimal(userSummitInit)} --> ${toDecimal(userSummitFinal)}: Δ ${toDecimal(userSummitFinal.sub(userSummitInit))}`,
        dev: `${toDecimal(devSummitInit)} --> ${toDecimal(devSummitFinal)}: Δ ${toDecimal(devSummitFinal.sub(devSummitInit))}`,
        referral: `${toDecimal(referralSummitInit)} --> ${toDecimal(referralSummitFinal)}: Δ ${toDecimal(referralSummitFinal.sub(referralSummitInit))}`,
      })

      expect6FigBigNumberEquals(userSummitFinal, userSummitInit.add(expectedRewards))
      expect6FigBigNumberEquals(referralSummitFinal, referralSummitInit.add(referralPending))
      expect6FigBigNumberEquals(devSummitFinal, devSummitInit.add(devPending))
    })
}


// WITHDRAW
const pendingSUMMITRedeemedOnWithdrawal = (tokenName: string) => {
  it('WITHDRAW / REDEEM: User should redeem pending on withdraw', async function() {
      const { user1 } = await getNamedSigners(hre)
      const token = await getContract(tokenName)

      const initialStaked = (await subCartGet.userInfo(token.address, OASIS, user1.address)).staked

      await cartographerMethod.withdraw({
        user: user1,
        tokenAddress: token.address,
        elevation: OASIS,
        amount: initialStaked.div(3),
      })

      const midStaked = (await subCartGet.userInfo(token.address, OASIS, user1.address)).staked
      expect6FigBigNumberEquals(midStaked, initialStaked.sub(initialStaked.div(3)))

      await cartographerMethod.withdraw({
        user: user1,
        tokenAddress: token.address,
        elevation: OASIS,
        amount: midStaked,
      })

      const finalStaked = (await subCartGet.userInfo(token.address, OASIS, user1.address)).staked
      expect(finalStaked).to.equal(0)
  })
}


  // RUNNING LP SUPPLY
  const lpSupplyUpdatesWithDepositsAndWithdrawals = (tokenName: string, depositFee: number = 0) => {
    it('LPSUPPLY: Should increase and decrease with deposits and withdrawals', async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        const token = await getContract(tokenName)

        const txs = [
          { deposit: true, user: user1, amount: e18(5) },
          { deposit: false, user: user1, amount: e18(3) },
          { deposit: true, user: user2, amount: e18(15) },
          { deposit: false, user: user2, amount: e18(8.5) },
          { deposit: true, user: user3, amount: e18(1.25) },
          { deposit: false, user: user1, amount: e18(1.2) },
          { deposit: true, user: user2, amount: e18(5.85) },
          { deposit: false, user: user2, amount: e18(2.8) },
          { deposit: true, user: user3, amount: e18(5.25) },
        ]

        let lpSupply = (await subCartGet.poolInfo(token.address, OASIS)).supply
        const feeMult = (10000 - depositFee) / 10000

        await promiseSequenceMap(
          txs,
          async (tx) => {
            const args = {
              user: tx.user,
              tokenAddress: token.address,
              elevation: OASIS,
              amount: tx.amount,
            }
            await tx.deposit ? cartographerMethod.deposit(args) : cartographerMethod.withdraw(args)
            const expectedLpSupply = tx.deposit ?
              lpSupply.add(tx.amount.mul(feeMult)) :
              lpSupply.sub(tx.amount.mul(feeMult))

            lpSupply = (await subCartGet.poolInfo(token.address, OASIS)).supply
            expect(expectedLpSupply).to.equal(lpSupply)
          }
        )
    })
}


  // REWARDS UPDATING AND SPLITTING
  const rewardsCorrectlyDistributed = (tokenName: string) => {
      it('REWARDS: Rewards are correctly distributed among pool members', async function() {
        const token = await getContract(tokenName)

        const usersStaked = await userPromiseSequenceMap(
          async (user) => (await subCartGet.userInfo(token.address, OASIS, user.address)).staked
        )

        const totalStaked = usersStaked[0]
          .add(usersStaked[1])
          .add(usersStaked[2])

        const lpSupply = (await subCartGet.poolInfo(token.address, OASIS)).supply
        expect(lpSupply).to.equal(totalStaked)

        await subCartMethod.updatePool(token.address, OASIS)

        const usersHarvestableInit = await userPromiseSequenceMap(
          async (user) => (await subCartGet.rewards(token.address, OASIS, user.address)).harvestable
        )

        await mineBlocks(3)

        const usersHarvestableFinal = await userPromiseSequenceMap(
          async (user) => (await subCartGet.rewards(token.address, OASIS, user.address)).harvestable
        )

        const usersHarvestableDelta = await userPromiseSequenceMap(
          async (_user, userIndex) => usersHarvestableFinal[userIndex].sub(usersHarvestableInit[userIndex])
        )

        const totalDelta = await userPromiseSequenceReduce(
          (acc, _, userIndex) => acc.add(usersHarvestableDelta[userIndex]),
          e18(0),
        )

        await userPromiseSequenceMap(
          async (_, userIndex) => expect(usersStaked[userIndex].mul(e12(1)).div(totalStaked)).to.equal(usersHarvestableDelta[userIndex].mul(e12(1)).div(totalDelta))
        )
    })
}

export const oasisTests = {
    standardDepositShouldSucceed,

    pendingSUMMITShouldIncreaseEachBlock,
    pendingSUMMITRedeemedOnDeposit,
    redeemTransfersCorrectSUMMITToAddresses,

    pendingSUMMITRedeemedOnWithdrawal,

    lpSupplyUpdatesWithDepositsAndWithdrawals,

    rewardsCorrectlyDistributed,
}
