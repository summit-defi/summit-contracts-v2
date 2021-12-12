import { BigNumber } from '@ethersproject/bignumber';
import { getNamedSigners } from '@nomiclabs/hardhat-ethers/dist/src/helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai'
import { Contract } from 'ethers';
import hre, { ethers } from 'hardhat';
import { cartographerMethod, cartographerSynth, consoleLog, depositedAfterFee, e18, elevationHelperGet, ERR, EVENT, getCartographer, getContract, getTotemCount, getUserTotems, mineBlock, rolloverRound, rolloverRoundUntilLosingTotem, rolloverRoundUntilWinningTotem, subCartGet, subCartMethod, toDecimal } from '.';
import { TOTEM_COUNT } from './constants';
import { userPromiseSequenceMap, userPromiseSequenceReduce, usersHypotheticalRewards, usersRewards, usersStaked } from './users';
import { e12, expect6FigBigNumberEquals, expect6FigBigNumberAllEqual, expectBigNumberArraysEqual, expectBigNumberGreaterThan, expectBigNumberLessThan, mineBlocks, stringifyBigNumberArray, getTimestamp, mineBlockWithTimestamp, increaseTimestampAndMine, e0, e6 } from './utils';



const getHistoricalTotemStats = async (elevationHelper: Contract, elevation: number): Promise<BigNumber[][]> => {
  const historicalWinningTotems = await elevationHelper.historicalWinningTotems(elevation)
  const poolWinCounters = historicalWinningTotems.slice(0, 10)
  const last5Winners = historicalWinningTotems.slice(10)
  return [poolWinCounters, last5Winners]
}

const switchTotemIfNecessary = async (user: SignerWithAddress, elevation: number, totem: number, revertErr?: string) => {
  await cartographerMethod.switchTotem({
    user,
    elevation,
    totem,
    revertErr
  })
}



// TOTEM TESTS
const totemTests = (tokenName: string, elevation: number) => {
  it('TOTEM: Users should be able to select a totem')
}


// DEPOSIT
const standardDepositShouldSucceed = (tokenName: string, elevation: number) => {
  it('DEPOSIT: Standard deposit should succeed', async function() {
    const { user1 } = await getNamedSigners(hre)
    const token = await getContract(tokenName)
    const userTotems = await getUserTotems()
    switchTotemIfNecessary(user1, elevation, userTotems[user1.address])

    const initialStaked = (await subCartGet.userInfo(token.address, elevation, user1.address)).staked

    const amount = e18(5)
    await cartographerMethod.deposit({
      user: user1,
      tokenAddress: token.address,
      elevation,
      amount,
    })

    const finalStaked = (await subCartGet.userInfo(token.address, elevation, user1.address)).staked

    expect(finalStaked).to.equal(initialStaked.add(amount))
  })
}
const depositShouldUpdatePoolAndTotemInfo = (tokenName: string, elevation: number) => {
  it('DEPOSIT: Deposit should update pool and totem info', async function() {
    const { user1, user2, user3 } = await getNamedSigners(hre)
    const token = await getContract(tokenName)

    switchTotemIfNecessary(user1, elevation, 0)
    switchTotemIfNecessary(user2, elevation, 0)
    switchTotemIfNecessary(user3, elevation, 1)


    const { supply: supplyInit, totemSupplies: totemSuppliesInit } = await subCartGet.poolInfo(token.address, elevation)

    const usersStakedInit = await usersStaked(token.address, elevation)

    const depositAmounts = {
      [user1.address]: e18(5),
      [user2.address]: e18(2),
      [user3.address]: e18(6),
    }
    const totalTotem0Deposit = depositAmounts[user1.address].add(depositAmounts[user2.address])
    const totalTotem1Deposit = depositAmounts[user3.address]
    const totalDeposit = await userPromiseSequenceReduce((total, user) => total.add(depositAmounts[user.address]), e18(0))

    const fee = 0
    const totalTotem0DepositAfterFee = depositedAfterFee(totalTotem0Deposit, fee)
    const totalTotem1DepositAfterFee = depositedAfterFee(totalTotem1Deposit, fee)
    const totalDepositAfterFee = depositedAfterFee(totalDeposit, fee)

    await userPromiseSequenceMap(
      async (user) => {
        await cartographerMethod.deposit({
          user,
          tokenAddress: token.address,
          elevation,
          amount: depositAmounts[user.address]
        })
      }
    )

    const { supply: supplyFinal, totemSupplies: totemSuppliesFinal } = await subCartGet.poolInfo(token.address, elevation)


    const usersStakedFinal = await usersStaked(token.address, elevation)


    expect(totemSuppliesFinal[0].sub(totemSuppliesInit[0])).to.equal(totalTotem0DepositAfterFee)
    expect(totemSuppliesFinal[1].sub(totemSuppliesInit[0])).to.equal(totalTotem1DepositAfterFee)
    expect(supplyFinal.sub(supplyInit)).to.equal(totalDepositAfterFee)

    await userPromiseSequenceMap(
      async (user, userIndex) => expect(usersStakedFinal[userIndex].sub(usersStakedInit[userIndex])).to.equal(depositedAfterFee(depositAmounts[user.address], fee))
    )
  })
}


// PENDING CURR ROUND
const elevationPoolRewardsShouldIncreaseEachBlock = (tokenName: string, elevation: number) => {
  it('PENDING: Elevation pool struct rewards should increase each block', async function() {
    const { dev, user1, user2, user3 } = await getNamedSigners(hre)
    const token = await getContract(tokenName)

    const depositAmounts = {
      [user1.address]: e18(5),
      [user2.address]: e18(2),
      [user3.address]: e18(6),
    }

    await userPromiseSequenceMap(
      async (user) => {
        await cartographerMethod.deposit({
          user,
          tokenAddress: token.address,
          elevation,
          amount: depositAmounts[user.address]
        })
      }
    )

    const {
      supply: supplyInit,
      totemSupplies: totemSuppliesInit,
      roundRewards: roundRewardsInit,
      totemRoundRewards: totemRoundRewardsInit,
    } = await subCartGet.poolInfo(token.address, elevation)

    await mineBlocks(3)
    await subCartMethod.updatePool(token.address, elevation)

    const {
      supply: supplyFinal,
      totemSupplies: totemSuppliesFinal,
      roundRewards: roundRewardsFinal,
      totemRoundRewards: totemRoundRewardsFinal,
    } = await subCartGet.poolInfo(token.address, elevation)


    const totem0RoundRewardsDelta = totemRoundRewardsFinal[0].sub(totemRoundRewardsInit[0])
    const totem1RoundRewardsDelta = totemRoundRewardsFinal[1].sub(totemRoundRewardsInit[1])
    const roundRewardsDelta = roundRewardsFinal.sub(roundRewardsInit)

    consoleLog({
      roundRewards: `${toDecimal(roundRewardsInit)} --> ${toDecimal(roundRewardsFinal)}`,
      totem0RoundRewards: `${toDecimal(totemRoundRewardsInit[0])} --> ${toDecimal(totemRoundRewardsFinal[0])}`,
      totem1RoundRewards: `${toDecimal(totemRoundRewardsInit[1])} --> ${toDecimal(totemRoundRewardsFinal[1])}`,
    })

    expect6FigBigNumberEquals(roundRewardsDelta, totem0RoundRewardsDelta.add(totem1RoundRewardsDelta))

    const farmBlockEmission = await cartographerSynth.farmSummitEmissionOneBlock(token.address, elevation)

    const totem0ScaledRewards = totem0RoundRewardsDelta.mul(e12(1)).div(totemSuppliesInit[0])
    const totem1ScaledRewards = totem1RoundRewardsDelta.mul(e12(1)).div(totemSuppliesInit[1])
    consoleLog({
      0: `${toDecimal(totem0RoundRewardsDelta)}, ${toDecimal(totemSuppliesInit[0])}, ${totem0ScaledRewards}`,
      1: `${toDecimal(totem1RoundRewardsDelta)}, ${toDecimal(totemSuppliesInit[1])}, ${totem1ScaledRewards}`,
      2: toDecimal(roundRewardsDelta),
      3: toDecimal(farmBlockEmission.mul('4')),
    })
    expect6FigBigNumberEquals(roundRewardsDelta, farmBlockEmission.mul(4))
    expect6FigBigNumberEquals(totem0ScaledRewards, totem1ScaledRewards)
  })
  it('PENDING: Users hypothetical rewards should increase each block proportionally', async function() {
    const { user1, user2, user3 } = await getNamedSigners(hre)
    const token = await getContract(tokenName)

    const usersStakedAmt = await usersStaked(token.address, elevation)
    const usersHypotheticalRewardsInit = await usersHypotheticalRewards(token.address, elevation)

    const {
      roundRewards: roundRewardsInit,
      totemRoundRewards: totemRoundRewardsInit,
    } = await subCartGet.poolInfo(token.address, elevation)

    consoleLog({
      roundRewards: toDecimal(roundRewardsInit),
      totem0RoundRewards: toDecimal(totemRoundRewardsInit[0]),
      totem1RoundRewards: toDecimal(totemRoundRewardsInit[1]),
      user1: `${toDecimal(usersHypotheticalRewardsInit[0].potentialWinnings)}, ${toDecimal(usersHypotheticalRewardsInit[0].contributedYield)}`,
      user2: `${toDecimal(usersHypotheticalRewardsInit[1].potentialWinnings)}, ${toDecimal(usersHypotheticalRewardsInit[1].contributedYield)}`,
      user3: `${toDecimal(usersHypotheticalRewardsInit[2].potentialWinnings)}, ${toDecimal(usersHypotheticalRewardsInit[2].contributedYield)}`,
    })


    await userPromiseSequenceMap(
      async (_user, userIndex) => expect(usersHypotheticalRewardsInit[userIndex].potentialWinnings).to.equal(usersHypotheticalRewardsInit[userIndex].contributedYield.mul(roundRewardsInit).div(totemRoundRewardsInit[userIndex]))
    )


    await mineBlocks(3)
    await subCartMethod.updatePool(token.address, elevation)

    // Users hypothetical winnings are calculated correctly
    const usersHypotheticalRewardsFinal = await usersHypotheticalRewards(token.address, elevation)
    const {
      roundRewards: roundRewardsFinal,
      totemRoundRewards: totemRoundRewardsFinal,
    } = await subCartGet.poolInfo(token.address, elevation)

    await userPromiseSequenceMap(
      async (_user, userIndex) => expect(usersHypotheticalRewardsFinal[userIndex].potentialWinnings).to.equal(usersHypotheticalRewardsFinal[userIndex].contributedYield.mul(roundRewardsFinal).div(totemRoundRewardsFinal[userIndex]))
    )


    // Sum of users rewards in each totem is reflected in totem total, and sum of all totems is reflected in pool total
    const usersHypotheticalRewardsDelta = await userPromiseSequenceMap(
      async (_user, userIndex) => usersHypotheticalRewardsFinal[userIndex].contributedYield.sub(usersHypotheticalRewardsInit[userIndex].contributedYield)
    )
    const roundRewardsDelta = roundRewardsFinal.sub(roundRewardsInit)
    const totem0RoundRewardsDelta = totemRoundRewardsFinal[0].sub(totemRoundRewardsInit[0])
    const totem1RoundRewardsDelta = totemRoundRewardsFinal[1].sub(totemRoundRewardsInit[1])

    expect6FigBigNumberEquals(totem0RoundRewardsDelta, usersHypotheticalRewardsDelta[0].add(usersHypotheticalRewardsDelta[1]))
    expect6FigBigNumberEquals(totem1RoundRewardsDelta, usersHypotheticalRewardsDelta[2])
    expect6FigBigNumberEquals(roundRewardsDelta, totem0RoundRewardsDelta.add(totem1RoundRewardsDelta))

    // User's rewards scale proportionally to their staked amount
    const usersHypotheticalPendingScaled = await userPromiseSequenceMap(
      async (_user, userIndex) => usersHypotheticalRewardsDelta[userIndex].mul(e12(1)).div(usersStakedAmt[userIndex])
    )

    expect6FigBigNumberAllEqual([
      usersHypotheticalPendingScaled[0],
      usersHypotheticalPendingScaled[1],
      usersHypotheticalPendingScaled[2],
    ])
  })
}


// PENDING INTER ROUND
const vestedWinningsIncreaseOverDurationOfRound = (tokenName: string, elevation: number) => {
  it('VESTING: Winnings vest over duration of round', async function() {
    // const { dev, user1, user3 } = await getNamedSigners(hre)
    // const token = await getContract(tokenName)

    // const roundDuration = await elevationHelperGet.roundDurationSeconds(elevation)
    // const quarterRoundDuration = roundDuration / 4

    // await rolloverRound(elevation)

    // const roundNumber = await elevationHelperGet.roundNumber(elevation)
    // const prevRound = roundNumber - 1

    // const prevWinningTotem = await elevationHelperGet.winningTotem(elevation, prevRound)
    // const winningUser = prevWinningTotem === 0 ? user1 : user3
    // const {
    //   harvestable: harvestable0,
    //   vesting: vesting0,
    //   vestDuration: vestDuration0,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)

    // consoleLog({
    //   PERC_THROUGH_ROUND: `${((roundDuration - vestDuration0.toNumber()) * 100) / roundDuration}%`,
    //   harvestableRewards: toDecimal(harvestable0),
    //   vesting: toDecimal(vesting0),
    //   vestDurationSeconds: vestDuration0.toString(),
    //   timestamp: await getTimestamp(),
    //   quarterRoundDuration,
    // })

    // await increaseTimestampAndMine(quarterRoundDuration)

    // const {
    //   harvestable: harvestable1,
    //   vesting: vesting1,
    //   vestDuration: vestDuration1,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)


    // consoleLog({
    //   PERC_THROUGH_ROUND: `${((roundDuration - vestDuration1.toNumber()) * 100) / roundDuration}%`,
    //   harvestableRewards: toDecimal(harvestable1),
    //   vesting: toDecimal(vesting1),
    //   vestDurationSeconds: vestDuration1.toString(),
    //   timestamp: await getTimestamp(),
    // })

    // expectBigNumberGreaterThan(harvestable1, harvestable0)
    // expectBigNumberLessThan(vesting1, vesting0)


    // await increaseTimestampAndMine(quarterRoundDuration)

    // const {
    //   harvestable: harvestable2,
    //   vesting: vesting2,
    //   vestDuration: vestDuration2,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)

    // consoleLog({
    //   PERC_THROUGH_ROUND: `${((roundDuration - vestDuration2.toNumber()) * 100) / roundDuration}%`,
    //   harvestableRewards: toDecimal(harvestable2),
    //   vesting: toDecimal(vesting2),
    //   vestDurationSeconds: vestDuration2.toString(),
    //   timestamp: await getTimestamp(),
    // })

    // expectBigNumberGreaterThan(harvestable2, harvestable1)
    // expectBigNumberLessThan(vesting2, vesting1)


    // await increaseTimestampAndMine(quarterRoundDuration)

    // const {
    //   harvestable: harvestable3,
    //   vesting: vesting3,
    //   vestDuration: vestDuration3,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)

    // consoleLog({
    //   PERC_THROUGH_ROUND: `${((roundDuration - vestDuration3.toNumber()) * 100) / roundDuration}%`,
    //   harvestableRewards: toDecimal(harvestable3),
    //   vesting: toDecimal(vesting3),
    //   vestDurationSeconds: vestDuration3.toString(),
    //   timestamp: await getTimestamp(),
    // })

    // expectBigNumberGreaterThan(harvestable3, harvestable2)
    // expectBigNumberLessThan(vesting3, vesting2)


    // await increaseTimestampAndMine(quarterRoundDuration)

    // const {
    //   harvestable: harvestable4,
    //   vesting: vesting4,
    //   vestDuration: vestDuration4,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)

    // consoleLog({
    //   PERC_THROUGH_ROUND: `${((roundDuration - vestDuration4.toNumber()) * 100) / roundDuration}%`,
    //   harvestableRewards: toDecimal(harvestable4),
    //   vesting: toDecimal(vesting4),
    //   vestDurationSeconds: vestDuration4.toString(),
    //   timestamp: await getTimestamp(),
    // })

    // expectBigNumberGreaterThan(harvestable4, harvestable3)
    // expectBigNumberLessThan(vesting4, vesting3)
  })
}
const winningsMatchHypotheticalWinnings = (tokenName: string, elevation: number) => {
  it('WINNINGS: Winnings match hypothetical winnings before round end', async function() {
    const { dev, user1, user2, user3 } = await getNamedSigners(hre)
    const token = await getContract(tokenName)

    await subCartMethod.updatePool(token.address, elevation)

    const usersHypotheticalRewardsInit = await usersHypotheticalRewards(token.address, elevation)

    await subCartMethod.updatePool(token.address, elevation)

    const timestampBegin = await getTimestamp()

    const usersHypotheticalRewardsFinal = await usersHypotheticalRewards(token.address, elevation)

    const usersHypotheticalWinningsDelta = await userPromiseSequenceMap(
      async (_user, userIndex) => usersHypotheticalRewardsFinal[userIndex].potentialWinnings.sub(usersHypotheticalRewardsInit[userIndex].potentialWinnings)
    )

    const usersRewardsInit = await usersRewards(token.address, elevation)

    await rolloverRound(elevation)

    const prevWinningTotem = await elevationHelperGet.prevWinningTotem(elevation)

    const usersRewardsFinal = await usersRewards(token.address, elevation)

    const usersRewardsDelta = await userPromiseSequenceMap(
      async (user, userIndex) => usersRewardsFinal[userIndex].harvestable
        .add(usersRewardsFinal[userIndex].vesting)
        .sub(usersRewardsInit[userIndex].harvestable)
        .sub(usersRewardsInit[userIndex].vesting)
    )

    const timestampEnd = await getTimestamp()
    const timestampDelta = timestampEnd - timestampBegin

    if (prevWinningTotem == 0) {
      expect6FigBigNumberEquals(usersRewardsDelta[0], usersHypotheticalRewardsFinal[0].harvestable.add(usersHypotheticalWinningsDelta[0].mul(timestampDelta)))
      expect6FigBigNumberEquals(usersRewardsDelta[0], usersHypotheticalRewardsFinal[0].harvestable.add(usersHypotheticalWinningsDelta[0].mul(timestampDelta)))
    } else {
      expect6FigBigNumberEquals(usersRewardsDelta[0], usersHypotheticalRewardsFinal[0].harvestable.add(usersHypotheticalWinningsDelta[0].mul(timestampDelta)))
    }
  })
}
const withdrawingVestedWinningsRevestsRemaining = (tokenName: string, elevation: number) => {
  it('VESTING: Withdrawing partially vesting winnings re-vests remaining', async function() {
    // const { user1, user3 } = await getNamedSigners(hre)
    // const token = await getContract(tokenName)

    // const prevWinningTotem = await elevationHelperGet.prevWinningTotem(elevation)
    // const roundDuration = await elevationHelperGet.roundDurationSeconds(elevation)
    // const quarterRoundDuration = roundDuration / 4

    // await increaseTimestampAndMine(quarterRoundDuration)
    // await subCartMethod.updatePool(token.address, elevation)

    // const winningUser = prevWinningTotem === 0 ? user1 : user3

    // const {
    //   harvestable: harvestable0
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)

    // await subCartMethod.updatePool(token.address, elevation)

    // const {
    //   harvestable: harvestableInit,
    //   vesting: vestingInit,
    //   vestDuration: vestDurationInit,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)

    // const availBlockDelta = harvestableInit.sub(harvestable0);
    // const balanceInit = await token.balanceOf(winningUser.address)

    // await cartographerMethod.claimSingleFarm({
    //   user: winningUser,
    //   tokenAddress: token.address,
    //   elevation,
    // })

    // const {
    //   harvestable: harvestableFinal,
    //   vesting: vestingFinal,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)
    // const balanceFinal = await token.balanceOf(winningUser.address)

    // expect6FigBigNumberEquals(balanceFinal.sub(balanceInit), harvestableInit.add(availBlockDelta))
    // expect(harvestableFinal).to.equal(0)
    // expect6FigBigNumberEquals(vestingInit.sub(vestingFinal), vestingInit.div(vestDurationInit))
  })
  it('VESTING: Re-vested winnings increase over duration of vesting', async function() {
    // const { dev, user1, user3 } = await getNamedSigners(hre)
    // const token = await getContract(tokenName)

    // await rolloverRound(elevation)

    // const winningTotem = await elevationHelperGet.prevWinningTotem(elevation)
    // const roundStart = await elevationHelperGet.currentRoundStartTime(elevation)

    // const winningUser = winningTotem === 0 ? user1 : user3

    // await subCartMethod.updatePool(token.address, elevation)

    // const {
    //   harvestable: harvestable0,
    //   vesting: vesting0,
    //   vestStart: vestStart0,
    //   vestDuration: vestDuration0,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)
    // const totalAmount0 = harvestable0.add(vesting0)
    // const vestAmtToDurRatio0 = vesting0.div(vestDuration0)

    // const quarterVestingDuration = vestDuration0.div(4).toNumber() + 1

    // await increaseTimestampAndMine(quarterVestingDuration)
    // await subCartMethod.updatePool(token.address, elevation)

    // const {
    //   harvestable: harvestable1,
    //   vesting: vesting1,
    //   vestStart: vestStart1,
    //   vestDuration: vestDuration1,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)
    // expect(vestStart0).to.equal(vestStart1)

    // const totalAmount1 = harvestable1.add(vesting1)
    // const vestAmtToDurRatio1 = vesting1.div(vestDuration1)

    // await increaseTimestampAndMine(quarterVestingDuration)
    // await subCartMethod.updatePool(token.address, elevation)

    // const {
    //   harvestable: harvestable2,
    //   vesting: vesting2,
    //   vestStart: vestStart2,
    //   vestDuration: vestDuration2,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)
    // const totalAmount2 = harvestable2.add(vesting2)
    // const vestAmtToDurRatio2 = vesting2.div(vestDuration2)

    // await increaseTimestampAndMine(quarterVestingDuration)
    // await subCartMethod.updatePool(token.address, elevation)

    // const {
    //   harvestable: harvestable3,
    //   vesting: vesting3,
    //   vestStart: vestStart3,
    //   vestDuration: vestDuration3,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)
    // const totalAmount3 = harvestable3.add(vesting3)
    // const vestAmtToDurRatio3 = vesting3.div(vestDuration3)

    // await increaseTimestampAndMine(quarterVestingDuration)
    // await subCartMethod.updatePool(token.address, elevation)

    // const {
    //   harvestable: harvestable4,
    //   vesting: vesting4,
    //   vestStart: vestStart4,
    //   vestDuration: vestDuration4,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)
    // expect(vestStart4).to.equal(roundStart)

    // await rolloverRound(elevation)

    // const {
    //   harvestable: harvestable5,
    //   vesting: vesting5,
    //   vestStart: vestStart5,
    //   vestDuration: vestDuration5,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)
    // const oneBlockVestAmount = vestDuration5.gt(0) ? vesting5.div(vestDuration5) : vestDuration5
    // const totalAmount4 = harvestable4.add(vesting4)

    // consoleLog({
    //   totalAmount0: toDecimal(totalAmount0),
    //   totalAmount1: toDecimal(totalAmount1),
    //   totalAmount2: toDecimal(totalAmount2),
    //   totalAmount3: toDecimal(totalAmount3),
    //   totalAmount4: toDecimal(totalAmount4),
    //   harvestable4: toDecimal(harvestable4),
    //   vesting4: toDecimal(vesting4),
    // })

    // expect6FigBigNumberAllEqual([totalAmount0, totalAmount1, totalAmount2, totalAmount3, totalAmount4, harvestable4])
    // expect6FigBigNumberAllEqual([vestAmtToDurRatio0, vestAmtToDurRatio1, vestAmtToDurRatio2, vestAmtToDurRatio3])

    // const balanceInit = await token.balanceOf(winningUser.address)


    // await cartographerMethod.claimSingleFarm({
    //   user: winningUser,
    //   tokenAddress: token.address,
    //   elevation,
    // })

    // const balanceFinal = await token.balanceOf(winningUser.address)
    // expect6FigBigNumberEquals(balanceFinal.sub(balanceInit), harvestable5.add(oneBlockVestAmount))
  })
}
const winningsVestAndAccumulateOverMultipleRounds = (tokenName: string, elevation: number) => {
  it('VESTING: Vest and accumulate over multiple rounds', async function() {
    // const { user1, user3 } = await getNamedSigners(hre)
    // const token = await getContract(tokenName)

    // await rolloverRound(elevation)

    // const prevWinningTotem = await elevationHelperGet.prevWinningTotem(elevation)
    // const winningUser = prevWinningTotem === 0 ? user1 : user3
    // const {
    //   harvestable: harvestable0,
    //   vesting: vesting0,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)
    // await mineBlock()

    // const {
    //   harvestable: harvestable1,
    //   vesting: vesting1,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)
    // consoleLog({
    //   harvestable: `${toDecimal(harvestable0)} --> ${toDecimal(harvestable1)}`,
    //   vesting: `${toDecimal(vesting0)} --> ${toDecimal(vesting1)}`,
    // })
    // expectBigNumberGreaterThan(harvestable1, harvestable0)
    // expectBigNumberLessThan(vesting1, vesting0)
    // expect6FigBigNumberEquals(harvestable0.add(vesting0), harvestable1.add(vesting1))

    // await rolloverRoundUntilWinningTotem(elevation, prevWinningTotem)

    // await mineBlock()
    // const {
    //   harvestable: harvestable2,
    //   vesting: vesting2,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)
    // await mineBlock()
    // const {
    //   harvestable: harvestable3,
    //   vesting: vesting3,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)
    // consoleLog({
    //   harvestable: `${toDecimal(harvestable2)} --> ${toDecimal(harvestable3)}`,
    //   vesting: `${toDecimal(vesting2)} --> ${toDecimal(vesting3)}`,
    // })
    // expectBigNumberGreaterThan(harvestable3, harvestable2)
    // expectBigNumberLessThan(vesting3, vesting2)
    // expect6FigBigNumberEquals(harvestable2.add(vesting2), harvestable3.add(vesting3))

    // await rolloverRoundUntilWinningTotem(elevation, prevWinningTotem)

    // await mineBlock()
    // const {
    //   harvestable: harvestable4,
    //   vesting: vesting4,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)
    // await mineBlock()
    // const {
    //   harvestable: harvestable5,
    //   vesting: vesting5,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)
    // expectBigNumberGreaterThan(harvestable5, harvestable4)
    // expectBigNumberLessThan(vesting5, vesting4)
    // expect6FigBigNumberEquals(harvestable4.add(vesting4), harvestable5.add(vesting5))

    // await rolloverRoundUntilLosingTotem(elevation, prevWinningTotem)

    // const {
    //   harvestable: harvestable6,
    //   vesting: vesting6,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)
    // expect(vesting6).to.equal(0)

    // await cartographerMethod.claimSingleFarm({
    //   user: winningUser,
    //   tokenAddress: token.address,
    //   elevation,
    // })

    // const {
    //   harvestable: harvestable7,
    //   vesting: vesting7,
    // } = await subCartGet.claimableRewards(token.address, elevation, winningUser.address)
    // consoleLog({
    //   harvestable6: toDecimal(harvestable6),
    //   vesting6: toDecimal(vesting6),
    //   harvestable7: toDecimal(harvestable7),
    //   vesting7: toDecimal(vesting7),
    // })
    // expect(harvestable7).to.equal(0)
    // expect(vesting7).to.equal(0)
  })
}

const rolloverMultipleRounds = (tokenName: string, elevation: number) => {
  it('ROLLOVER: Rolling over multiple rounds yields correct rewards', async function() {
    // const { user1, user3 } = await getNamedSigners(hre)
    // const token = await getContract(tokenName)

    // await rolloverRound(elevation)

    // // DETERMINE FULL ROUND ROLLOVER BASELINE
    // let totem0baselineSet = false
    // let totem1baselineSet = false

    // let user1BaselineAvailRewardsInit
    // let user1BaselineVestingRewardsInit
    // let user3BaselineAvailRewardsInit
    // let user3BaselineVestingRewardsInit

    // let user1BaselineWinDelta
    // let user3BaselineWinDelta

    // while (!totem1baselineSet || !totem0baselineSet) {
    //   if (!totem0baselineSet) {
    //     const {
    //       harvestable: u1harvestable,
    //       vesting: u1vesting,
    //     } = await subCartGet.claimableRewards(token.address, elevation, user1.address)
    //     user1BaselineAvailRewardsInit = u1harvestable
    //     user1BaselineVestingRewardsInit = u1vesting
    //   }

    //   if (!totem1baselineSet) {
    //     const {
    //       harvestable: u3harvestable,
    //       vesting: u3vesting,
    //     } = await subCartGet.claimableRewards(token.address, elevation, user3.address)
    //     user3BaselineAvailRewardsInit = u3harvestable
    //     user3BaselineVestingRewardsInit = u3vesting
    //   }

    //   await rolloverRound(elevation)
    //   const winningTotem = await elevationHelperGet.prevWinningTotem(elevation)

    //   if (!totem0baselineSet && winningTotem === 0) {
    //     const {
    //       harvestable: user1BaselineAvailRewardsMid,
    //       vesting: user1BaselineVestingRewardsMid,
    //     } = await subCartGet.claimableRewards(token.address, elevation, user1.address)
    //     user1BaselineWinDelta = user1BaselineAvailRewardsMid.add(user1BaselineVestingRewardsMid).sub(user1BaselineAvailRewardsInit).sub(user1BaselineVestingRewardsInit)
    //     totem0baselineSet = true
    //   }
    //   if (!totem1baselineSet && winningTotem === 1) {
    //     const {
    //       harvestable: user3BaselineAvailRewardsMid,
    //       vesting: user3BaselineVestingRewardsMid,
    //     } = await subCartGet.claimableRewards(token.address, elevation, user1.address)
    //     user3BaselineWinDelta = user3BaselineAvailRewardsMid.add(user3BaselineVestingRewardsMid).sub(user3BaselineAvailRewardsInit).sub(user3BaselineVestingRewardsInit)
    //     totem1baselineSet = true
    //   }
    // }

    // // MULTI ROUND ROLLOVER
    // await rolloverRound(elevation)


    // const {
    //   harvestable: user1AvailRewardsInit,
    //   vesting: user1VestingRewardsInit,
    // } = await subCartGet.claimableRewards(token.address, elevation, user1.address)
    // const {
    //   harvestable: user3AvailRewardsInit,
    //   vesting: user3VestingRewardsInit,
    // } = await subCartGet.claimableRewards(token.address, elevation, user3.address)

    // const nextRoundTime = await elevationHelperGet.roundEndTimestamp(elevation)
    // const roundDuration = await elevationHelperGet.roundDurationSeconds(elevation)
    // await mineBlockWithTimestamp(nextRoundTime + (roundDuration * 4))

    // await rollover(elevation)

    // await subCartMethod.updatePool(token.address, elevation)


    // const {
    //   harvestable: user1AvailRewardsFinal,
    //   vesting: user1VestingRewardsFinal,
    // } = await subCartGet.claimableRewards(token.address, elevation, user1.address)
    // const {
    //   harvestable: user3AvailRewardsFinal,
    //   vesting: user3VestingRewardsFinal,
    // } = await subCartGet.claimableRewards(token.address, elevation, user3.address)

    // const user1MultiRoundDelta = user1AvailRewardsFinal.add(user1VestingRewardsFinal).sub(user1AvailRewardsInit).sub(user1VestingRewardsInit)
    // const user3MultiRoundDelta = user3AvailRewardsFinal.add(user3VestingRewardsFinal).sub(user3AvailRewardsInit).sub(user3VestingRewardsInit)

    // const prevWinningTotem = await elevationHelperGet.prevWinningTotem(elevation)

    // consoleLog({
    //   prevWinningTotem,
    //   user1WinDelta: toDecimal(user1BaselineWinDelta),
    //   user3WinDelta: toDecimal(user3BaselineWinDelta),
    //   user1MultiRoundDelta: toDecimal(user1MultiRoundDelta),
    //   user3MultiRoundDelta: toDecimal(user3MultiRoundDelta),
    //   user1Mult: user1BaselineWinDelta.eq(0) ? 'null' : user1MultiRoundDelta.mul('100000').div(user1BaselineWinDelta).toString(),
    //   user3Mult: user3BaselineWinDelta.eq(0) ? 'null' : user3MultiRoundDelta.mul('100000').div(user3BaselineWinDelta).toString(),
    //   user1AvailRewards: `${toDecimal(user1AvailRewardsInit)} --> ${toDecimal(user1AvailRewardsFinal)}`,
    //   user1VestingRewards: `${toDecimal(user1VestingRewardsInit)} --> ${toDecimal(user1VestingRewardsFinal)}`,
    //   user3AvailRewards: `${toDecimal(user3AvailRewardsInit)} --> ${toDecimal(user3AvailRewardsFinal)}`,
    //   user3VestingRewards: `${toDecimal(user3VestingRewardsInit)} --> ${toDecimal(user3VestingRewardsFinal)}`,
    // })

    // if (prevWinningTotem === 0) {
    //   expect6FigBigNumberEquals(user1MultiRoundDelta.mul(e18(1)).div(user1BaselineWinDelta), e18(5))
    // } else {
    //   expect6FigBigNumberEquals(user3MultiRoundDelta.mul(e18(1)).div(user3BaselineWinDelta), e18(5))
    // }
  })
}

const correctWinnersHistoricalData = (tokenName: string, elevation: number) => {
  it('HISTORICAL DATA: Single-rollovers update historical data correctly', async function() {
    const token = await getContract(tokenName)

    const {
      totemWinCounters: poolWinCountersInit,
      prevWinners: prevWinnersInit,
    } = await elevationHelperGet.historicalTotemStats(elevation)

    await rolloverRound(elevation)
    const {
      totemWinCounters: poolWinCounters1,
      prevWinners: prevWinners1,
    } = await elevationHelperGet.historicalTotemStats(elevation)
    const round1WinningTotem = await elevationHelperGet.prevWinningTotem(elevation)
    expect(poolWinCountersInit[round1WinningTotem].add(1)).to.equal(poolWinCounters1[round1WinningTotem])
    expectBigNumberArraysEqual(prevWinners1, [round1WinningTotem, ...prevWinnersInit.slice(0, 9)])

    await rolloverRound(elevation)
    const {
      totemWinCounters: poolWinCounters2,
      prevWinners: prevWinners2,
    } = await elevationHelperGet.historicalTotemStats(elevation)
    const round2WinningTotem = await elevationHelperGet.prevWinningTotem(elevation)
    expect(poolWinCounters1[round2WinningTotem].add(1)).to.equal(poolWinCounters2[round2WinningTotem])
    expectBigNumberArraysEqual(prevWinners2, [round2WinningTotem, round1WinningTotem, ...prevWinnersInit.slice(0, 8)])

    await rolloverRound(elevation)
    const {
      totemWinCounters: poolWinCounters3,
      prevWinners: prevWinners3,
    } = await elevationHelperGet.historicalTotemStats(elevation)
    const round3WinningTotem = await elevationHelperGet.prevWinningTotem(elevation)
    expect(poolWinCounters2[round3WinningTotem].add(1)).to.equal(poolWinCounters3[round3WinningTotem])
    expectBigNumberArraysEqual(prevWinners3, [round3WinningTotem, round2WinningTotem, round1WinningTotem, ...prevWinnersInit.slice(0, 7)])

    await rolloverRound(elevation)
    const {
      totemWinCounters: poolWinCounters4,
      prevWinners: prevWinners4,
    } = await elevationHelperGet.historicalTotemStats(elevation)
    const round4WinningTotem = await elevationHelperGet.prevWinningTotem(elevation)
    expect(poolWinCounters3[round4WinningTotem].add(1)).to.equal(poolWinCounters4[round4WinningTotem])
    expectBigNumberArraysEqual(prevWinners4, [round4WinningTotem, round3WinningTotem, round2WinningTotem, round1WinningTotem, ...prevWinnersInit.slice(0, 6)])

    await rolloverRound(elevation)
    const {
      totemWinCounters: poolWinCounters5,
      prevWinners: prevWinners5,
    } = await elevationHelperGet.historicalTotemStats(elevation)
    const round5WinningTotem = await elevationHelperGet.prevWinningTotem(elevation)
    expect(poolWinCounters4[round5WinningTotem].add(1)).to.equal(poolWinCounters5[round5WinningTotem])
    expectBigNumberArraysEqual(prevWinners5, [round5WinningTotem, round4WinningTotem, round3WinningTotem, round2WinningTotem, round1WinningTotem, ...prevWinnersInit.slice(0, 5)])

    consoleLog({
      poolWinCountersInit: stringifyBigNumberArray(poolWinCountersInit),
      poolWinCounters1: stringifyBigNumberArray(poolWinCounters1),
      poolWinCounters2: stringifyBigNumberArray(poolWinCounters2),
      poolWinCounters3: stringifyBigNumberArray(poolWinCounters3),
      poolWinCounters4: stringifyBigNumberArray(poolWinCounters4),
      poolWinCounters5: stringifyBigNumberArray(poolWinCounters5),
      prevWinnersInit: stringifyBigNumberArray(prevWinnersInit),
      prevWinners1: stringifyBigNumberArray(prevWinners1),
      prevWinners2: stringifyBigNumberArray(prevWinners2),
      prevWinners3: stringifyBigNumberArray(prevWinners3),
      prevWinners4: stringifyBigNumberArray(prevWinners4),
      prevWinners5: stringifyBigNumberArray(prevWinners5),
    })

    expect(true).to.be.true
  })
  it('HISTORICAL DATA: Multi-rollover updates historical data correctly', async function() {
    await rolloverRound(elevation)

    const {
      totemWinCounters: poolWinCountersInit
    } = await elevationHelperGet.historicalTotemStats(elevation)

    await rolloverRound(elevation)

    const {
      totemWinCounters: poolWinCountersFinal
    } = await elevationHelperGet.historicalTotemStats(elevation)

    const winsInit = poolWinCountersInit.reduce((accum: BigNumber, wins: BigNumber) => wins.add(accum), BigNumber.from('0'))
    const winsFinal = poolWinCountersFinal.reduce((accum: BigNumber, wins: BigNumber) => wins.add(accum), BigNumber.from('0'))

    expect(winsFinal.sub(winsInit)).to.equal(1)
  })
}

// TOTEMS
// const switchingTotems = (tokenName: string, elevation: number) => {
//   it(`TOTEMS: Switching to invalid totem should fail with error ${ERR.INVALID_TOTEM}`, async function() {
//     const { user1 } = await getNamedSigners(hre)
//     const cartographer = await getCartographer()

//     await expect(
//       cartographer.connect(user1).switchTotem(elevation, TOTEM_COUNT[elevation])
//     ).to.be.revertedWith(ERR.INVALID_TOTEM)
//   })
//   it('TOTEMS: Users should be able to switch to valid totems', async function() {
//     const { user1 } = await getNamedSigners(hre)
//     const cartographer = await getCartographer()
//     const subCartographer = await ethers.getContract(tokenName)
//     const elevationHelper = await ethers.getContract('ElevationHelper')

//     const targetTotem = TOTEM_COUNT[elevation] - 1

//     await rolloverRoundUntilWinningTotem(elevation, 0)
//     await mineBlocks(10)

//     const [harvestablePre0] = await cartographer.rewards(pid, user1.address)
//     await subCartMethod.updatePool(token.address, elevation)

//     let runningUserInfo =  await subCartographer.connect(user1).userInfo(pid, user1.address)
//     const user1Totem0 = await getUserTotem(subCartographer, elevation, user1)
//     const user1Staked0 = runningUserInfo.staked
//     const user1Summit0 = await rewardToken.balanceOf(user1.address)
//     const poolLpSupply0 = await cartographer.stakedSupply(pid)
//     const [roundRewards0, ...totemRewards0] = await subCartographer.totemRoundRewards(pid)
//     const totem0LpSupply0 = (await subCartographer.totemSupplies(pid))[0]
//     const totemTargetLpSupply0 = (await subCartographer.totemSupplies(pid))[targetTotem]

//     const [harvestable0] = await cartographer.rewards(pid, user1.address)
//     const singleBlockRewardDelta = harvestable0.sub(harvestablePre0)

//     expect(user1Totem0).to.equal(0)

//     // SWITCH TOTEM FROM 0 --> TARGET TOTEM
//     await cartographer.connect(user1).switchTotem(elevation, targetTotem)

//     runningUserInfo =  await subCartographer.connect(user1).userInfo(pid, user1.address)
//     const user1Totem1 = await getUserTotem(subCartographer, elevation, user1)
//     const user1Staked1 = runningUserInfo.staked
//     const user1Summit1 = await rewardToken.balanceOf(user1.address)
//     const poolLpSupply1 = await cartographer.stakedSupply(pid)
//     let [roundRewards1, ...totemRewards1] = await subCartographer.totemRoundRewards(pid)
//     const totem0LpSupply1 = (await subCartographer.totemSupplies(pid))[0]
//     const totemTargetLpSupply1 = (await subCartographer.totemSupplies(pid))[targetTotem]

//     expect6FigBigNumberEquals(user1Summit1.sub(user1Summit0), harvestable0.add(singleBlockRewardDelta))
//     expect(user1Totem1).to.equal(targetTotem)

//     expect(user1Staked1).to.equal(user1Staked0)
//     expect(poolLpSupply1).to.equal(poolLpSupply0)
//     expect(totem0LpSupply0.sub(totem0LpSupply1)).to.equal(user1Staked0)
//     expect(totemTargetLpSupply1.sub(totemTargetLpSupply0)).to.equal(user1Staked0)

//     expect6FigBigNumberEquals(totemRewards1[0].sub(totemRewards0[0]).sub(totemRewards0[1].sub(totemRewards1[1])), roundRewards1.sub(roundRewards0))

//     const [harvestablePre1] = await cartographer.rewards(pid, user1.address)
//     await subCartMethod.updatePool(token.address, elevation)
//     const [harvestable1] = await cartographer.rewards(pid, user1.address)
//     const singleBlockRewardDelta1 = harvestable1.sub(harvestablePre1)

//     const [roundRewards1B, ...totemRewards1B] = await subCartographer.totemRoundRewards(pid)

//     // SWITCH BACK FROM TARGET TOTEM --> 0
//     await cartographer.connect(user1).switchTotem(elevation, 0)

//     runningUserInfo =  await subCartographer.connect(user1).userInfo(pid, user1.address)
//     const user1Totem2 = await getUserTotem(subCartographer, elevation, user1)
//     const user1Staked2 = runningUserInfo.staked
//     const user1Summit2 = await rewardToken.balanceOf(user1.address)
//     const poolLpSupply2 = await cartographer.stakedSupply(pid)
//     const [roundRewards2, ...totemRewards2] = await subCartographer.totemRoundRewards(pid)
//     const totem0LpSupply2 = (await subCartographer.totemSupplies(pid))[0]
//     const totemTargetLpSupply2 = (await subCartographer.totemSupplies(pid))[targetTotem]

//     expect6FigBigNumberEquals(user1Summit2.sub(user1Summit1), harvestable1.add(singleBlockRewardDelta1))
//     expect(user1Totem2).to.equal(0)

//     expect(user1Staked2).to.equal(user1Staked1)
//     expect(poolLpSupply2).to.equal(poolLpSupply1)
//     expect(totem0LpSupply2.sub(totem0LpSupply1)).to.equal(user1Staked0)
//     expect(totemTargetLpSupply1.sub(totemTargetLpSupply2)).to.equal(user1Staked0)

//     expect(totem0LpSupply2).to.equal(totem0LpSupply0)
//     expect(totemTargetLpSupply2).to.equal(totemTargetLpSupply0)

//     expect6FigBigNumberEquals(totemRewards2[1].sub(totemRewards1B[1]).sub(totemRewards1B[0].sub(totemRewards2[0])), roundRewards2.sub(roundRewards1B))
//   })
// }

export const elevationTests = {
  standardDepositShouldSucceed,
  depositShouldUpdatePoolAndTotemInfo,

  elevationPoolRewardsShouldIncreaseEachBlock,

  vestedWinningsIncreaseOverDurationOfRound,
  winningsMatchHypotheticalWinnings,
  withdrawingVestedWinningsRevestsRemaining,
  winningsVestAndAccumulateOverMultipleRounds,

  rolloverMultipleRounds,

  correctWinnersHistoricalData,

  // switchingTotems,
}

function rollover(elevation: number) {
  throw new Error('Function not implemented.');
}
