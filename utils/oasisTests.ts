import { BigNumber } from '@ethersproject/bignumber';
import { getNamedSigners } from '@nomiclabs/hardhat-ethers/dist/src/helpers';
import { expect } from 'chai'
import hre, { ethers } from 'hardhat';
import { cartographerGet, cartographerMethod, cartographerSynth, consoleLog, Contracts, depositedAfterFee, e18, EVENT, expect6FigBigNumberEquals, getSubCartographer, mineBlock, OASIS, promiseSequenceMap, subCartGet, subCartMethod, toDecimal } from '.';
import { getContract, getSummitReferrals, getSummitToken } from './contracts';
import { summitLockingGet } from './summitLockingUtils';
import { userPromiseSequenceMap, userPromiseSequenceReduce } from './users';
import { e12, getExpectedDistributionsOnClaim, getTimestamp, mineBlocks, tokenAmountAfterDepositFee } from './utils';


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
        const harvestable0 = await subCartGet.poolClaimableRewards(token.address, OASIS, user1.address)
        
        await mineBlock()
        
        const timestampAfter = await getTimestamp()
        const harvestable1 = await subCartGet.poolClaimableRewards(token.address, OASIS, user1.address)

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

        const harvestable2 = await subCartGet.poolClaimableRewards(token.address, OASIS, user1.address)
        expect6FigBigNumberEquals(harvestable2.sub(harvestable1), summitFarm3SecondEmission)
      })
}

const pendingSUMMITRedeemedOnDeposit = (tokenName: string, depositFee: number = 0) => {
    it('DEPOSIT / CLAIM: User should claim pending rewards on further deposit', async function() {
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
    it('CLAIM: Claiming rewards transfers correct amount to summitLocking', async function() {
      const { user1, dev } = await getNamedSigners(hre)
      const token = await getContract(tokenName)
      const summitReferrals = await getSummitReferrals()


      const userClaimedInit = await summitLockingGet.getUserCurrentEpochHarvestableWinnings(user1.address)
      const referralSummitInit = await token.balanceOf(summitReferrals.address)
      const devSummitInit = await token.balanceOf(dev.address)

      await mineBlocks(5)

      const expectedRewards = (await subCartGet.poolClaimableRewards(token.address, OASIS, user1.address))
        .add(await cartographerSynth.farmSummitEmissionOverDuration(token.address, OASIS, 1))
      const {
        referralExpected,
        treasuryExpected
      } = getExpectedDistributionsOnClaim(expectedRewards)

      await cartographerMethod.claimSingleFarm({
        user: user1,
        tokenAddress: token.address,
        elevation: OASIS,
      })

      const userClaimedFinal = await summitLockingGet.getUserCurrentEpochHarvestableWinnings(user1.address)
      const referralSummitFinal = await token.balanceOf(summitReferrals.address)
      const devSummitFinal = await token.balanceOf(dev.address)

      consoleLog({
        user: `${toDecimal(userClaimedInit)} --> ${toDecimal(userClaimedFinal)}: Δ ${toDecimal(userClaimedFinal.sub(userClaimedInit))}`,
        dev: `${toDecimal(devSummitInit)} --> ${toDecimal(devSummitFinal)}: Δ ${toDecimal(devSummitFinal.sub(devSummitInit))}`,
        referral: `${toDecimal(referralSummitInit)} --> ${toDecimal(referralSummitFinal)}: Δ ${toDecimal(referralSummitFinal.sub(referralSummitInit))}`,
      })

      expect6FigBigNumberEquals(userClaimedFinal, userClaimedInit.add(expectedRewards))
      expect6FigBigNumberEquals(referralSummitFinal, referralSummitInit.add(referralExpected))
      expect6FigBigNumberEquals(devSummitFinal, devSummitInit.add(treasuryExpected))
    })
}


// WITHDRAW
const pendingSUMMITRedeemedOnWithdrawal = (tokenName: string) => {
  it('WITHDRAW / CLAIM: User should claim pending rewards on withdraw', async function() {
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

        await promiseSequenceMap(
          txs,
          async (tx, txIndex) => {
            const args = {
              user: tx.user,
              tokenAddress: token.address,
              elevation: OASIS,
              amount: tx.amount,
            }
            const depositFee = await cartographerGet.getTokenDepositFee(token.address)
            if (tx.deposit) {
              await cartographerMethod.deposit(args)
            } else {
              await cartographerMethod.withdraw(args)
            }
            const expectedLpSupply = tx.deposit ?
              lpSupply.add(tokenAmountAfterDepositFee(tx.amount, depositFee)) :
              lpSupply.sub(tx.amount) // Don't use withdrawal tax since full amount will be pulled from lp Supply

            lpSupply = (await subCartGet.poolInfo(token.address, OASIS)).supply

            console.log({
              txIndex,
              deposit: tx.deposit,
              lpSupply: toDecimal(lpSupply),
              expectedSupply: toDecimal(expectedLpSupply),
            })
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
          async (user) => await subCartGet.poolClaimableRewards(token.address, OASIS, user.address)
        )

        await mineBlocks(3)

        const usersHarvestableFinal = await userPromiseSequenceMap(
          async (user) => await subCartGet.poolClaimableRewards(token.address, OASIS, user.address)
        )

        const usersHarvestableDelta = await userPromiseSequenceMap(
          async (_user, userIndex) => usersHarvestableFinal[userIndex].sub(usersHarvestableInit[userIndex])
        )

        const totalDelta = await userPromiseSequenceReduce(
          (acc, _, userIndex) => acc.add(usersHarvestableDelta[userIndex]),
          e18(0),
        )

        await userPromiseSequenceMap(
          async (_, userIndex) => await expect(usersStaked[userIndex].mul(e12(1)).div(totalStaked)).to.equal(usersHarvestableDelta[userIndex].mul(e12(1)).div(totalDelta))
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
