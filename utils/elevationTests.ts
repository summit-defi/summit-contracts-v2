import { BigNumber } from '@ethersproject/bignumber';
import { getNamedSigners } from '@nomiclabs/hardhat-ethers/dist/src/helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai'
import { Contract } from 'ethers';
import { access } from 'fs';
import hre, { ethers } from 'hardhat';
import { cartographerGet, cartographerMethod, cartographerSynth, consoleLog, deltaBN, depositedAfterFee, e18, elevationHelperGet, ERR, EVENT, getCartographer, getContract, getSummitBalance, getTotemCount, getUserTotems, mineBlock, rolloverRound, rolloverRounds, rolloverRoundUntilLosingTotem, rolloverRoundUntilWinningTotem, subCartGet, subCartMethod, sumBigNumbers, toDecimal, usersPoolYieldsContributed } from '.';
import { TOTEM_COUNT } from './constants';
import { userPromiseSequenceMap, userPromiseSequenceReduce, usersPotentialWinnings, usersRewards, usersStaked, usersTotemInfos } from './users';
import { e12, expect6FigBigNumberEquals, expect6FigBigNumberAllEqual, expectBigNumberArraysEqual, expectBigNumberGreaterThan, expectBigNumberLessThan, mineBlocks, stringifyBigNumberArray, getTimestamp, mineBlockWithTimestamp, increaseTimestampAndMine, e0, e6 } from './utils';



const getHistoricalTotemStats = async (elevationHelper: Contract, elevation: number): Promise<BigNumber[][]> => {
  const historicalWinningTotems = await elevationHelper.historicalWinningTotems(elevation)
  const poolWinCounters = historicalWinningTotems.slice(0, 10)
  const last5Winners = historicalWinningTotems.slice(10)
  return [poolWinCounters, last5Winners]
}

const switchTotemIfNecessary = async (user: SignerWithAddress, elevation: number, totem: number, revertErr?: string) => {
  const userTotemInfo = await subCartGet.userTotemInfo(elevation, user.address)
  if (userTotemInfo.totemSelected && userTotemInfo.totem === totem) return
  await cartographerMethod.switchTotem({
    user,
    elevation,
    totem,
    revertErr
  })
}

const sumUsersTotemDeposited = async (elevation: number, tokenAddress: string) => {
  const usersTotemsInfos = await usersTotemInfos(elevation)
  const usersStakedAmounts = await usersStaked(tokenAddress, elevation)
  console.log({usersStakedAmounts})
  return usersStakedAmounts.reduce((acc, stakedAmount, userIndex) => ({
    total: acc.total.add(stakedAmount),
    totem0: acc.totem0.add(usersTotemsInfos[userIndex].totem === 0 ? stakedAmount : 0),
    totem1: acc.totem1.add(usersTotemsInfos[userIndex].totem === 1 ? stakedAmount : 0),
  }), { total: e18(0), totem0: e18(0), totem1: e18(0)})
}


// DEPOSIT
const standardDepositShouldSucceed = (tokenName: string, elevation: number) => {
  it('DEPOSIT: Standard deposit should succeed', async function() {
    const { user1 } = await getNamedSigners(hre)
    const token = await getContract(tokenName)
    const userTotems = await getUserTotems()
    await switchTotemIfNecessary(user1, elevation, userTotems[user1.address])

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

    await switchTotemIfNecessary(user1, elevation, 0)
    await switchTotemIfNecessary(user2, elevation, 0)
    await switchTotemIfNecessary(user3, elevation, 1)


    const { supply: supplyInit, totemSupplies: totemSuppliesInit } = await subCartGet.poolInfo(token.address, elevation)

    const usersStakedInit = await usersStaked(token.address, elevation)

    const depositAmounts = {
      [user1.address]: e18(5),
      [user2.address]: e18(2),
      [user3.address]: e18(6),
    }

    const fee = await cartographerGet.getTokenDepositFee(token.address)
    const totalDepositAfterFee = depositedAfterFee(sumBigNumbers([depositAmounts[user1.address], depositAmounts[user2.address], depositAmounts[user3.address]]), fee)
    const totalTotem0DepositAfterFee = depositedAfterFee(sumBigNumbers([depositAmounts[user1.address], depositAmounts[user2.address]]), fee)
    const totalTotem1DepositAfterFee = depositedAfterFee(depositAmounts[user3.address], fee)

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

    console.log({
      totalSupply: `${supplyInit} --> ${supplyFinal}`,
      totemSupply0: `${totemSuppliesInit[0]} --> ${totemSuppliesFinal[0]}`,
      totemSupply1: `${totemSuppliesInit[1]} --> ${totemSuppliesFinal[1]}`,
      summedTotal: toDecimal(totalDepositAfterFee),
      summedTotem0: toDecimal(totalTotem0DepositAfterFee),
      summedTotem1: toDecimal(totalTotem1DepositAfterFee),
    })


    expect(totemSuppliesFinal[0].sub(totemSuppliesInit[0])).to.equal(totalTotem0DepositAfterFee)
    expect(totemSuppliesFinal[1].sub(totemSuppliesInit[1])).to.equal(totalTotem1DepositAfterFee)
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
  it('PENDING: Users potential rewards should increase each block proportionally', async function() {
    const token = await getContract(tokenName)
    const userTotems = await getUserTotems()

    const usersStakedAmt = await usersStaked(token.address, elevation)
    const usersPotentialWinningsInit = await usersPotentialWinnings(elevation)

    const {
      roundRewards: roundRewardsInit,
      totemRoundRewards: totemRoundRewardsInit,
    } = await subCartGet.poolInfo(token.address, elevation)

    consoleLog({
      roundRewards: toDecimal(roundRewardsInit),
      totem0RoundRewards: toDecimal(totemRoundRewardsInit[0]),
      totem1RoundRewards: toDecimal(totemRoundRewardsInit[1]),
      user1: `${toDecimal(usersPotentialWinningsInit[0].potentialWinnings)}, ${toDecimal(usersPotentialWinningsInit[0].yieldContributed)}`,
      user2: `${toDecimal(usersPotentialWinningsInit[1].potentialWinnings)}, ${toDecimal(usersPotentialWinningsInit[1].yieldContributed)}`,
      user3: `${toDecimal(usersPotentialWinningsInit[2].potentialWinnings)}, ${toDecimal(usersPotentialWinningsInit[2].yieldContributed)}`,
    })


    await userPromiseSequenceMap(
      async (user, userIndex) => expect6FigBigNumberEquals(
        usersPotentialWinningsInit[userIndex].potentialWinnings,
        usersPotentialWinningsInit[userIndex].yieldContributed.mul(roundRewardsInit).div(totemRoundRewardsInit[userTotems[user.address]])
      )
    )


    await mineBlocks(3)
    await subCartMethod.updatePool(token.address, elevation)

    // Users hypothetical winnings are calculated correctly
    const usersPotentialWinningsFinal = await usersPotentialWinnings(elevation)
    const {
      roundRewards: roundRewardsFinal,
      totemRoundRewards: totemRoundRewardsFinal,
    } = await subCartGet.poolInfo(token.address, elevation)

    await userPromiseSequenceMap(
      async (user, userIndex) => expect6FigBigNumberEquals(
        usersPotentialWinningsFinal[userIndex].potentialWinnings,
        usersPotentialWinningsFinal[userIndex].yieldContributed.mul(roundRewardsFinal).div(totemRoundRewardsFinal[userTotems[user.address]])
      )
    )


    // Sum of users rewards in each totem is reflected in totem total, and sum of all totems is reflected in pool total
    const usersPotentialWinningsDelta = await userPromiseSequenceMap(
      async (_user, userIndex) => usersPotentialWinningsFinal[userIndex].yieldContributed.sub(usersPotentialWinningsInit[userIndex].yieldContributed)
    )
    const roundRewardsDelta = roundRewardsFinal.sub(roundRewardsInit)
    const totem0RoundRewardsDelta = totemRoundRewardsFinal[0].sub(totemRoundRewardsInit[0])
    const totem1RoundRewardsDelta = totemRoundRewardsFinal[1].sub(totemRoundRewardsInit[1])

    expect6FigBigNumberEquals(totem0RoundRewardsDelta, usersPotentialWinningsDelta[0].add(usersPotentialWinningsDelta[1]))
    expect6FigBigNumberEquals(totem1RoundRewardsDelta, usersPotentialWinningsDelta[2])
    expect6FigBigNumberEquals(roundRewardsDelta, totem0RoundRewardsDelta.add(totem1RoundRewardsDelta))

    // User's rewards scale proportionally to their staked amount
    const usersPotentialWinningsScaled = await userPromiseSequenceMap(
      async (_user, userIndex) => usersPotentialWinningsDelta[userIndex].mul(e12(1)).div(usersStakedAmt[userIndex])
    )

    console.log({
      user1PotentialWinningsScaled: toDecimal(usersPotentialWinningsScaled[0]),
      user2PotentialWinningsScaled: toDecimal(usersPotentialWinningsScaled[1]),
      user3PotentialWinningsScaled: toDecimal(usersPotentialWinningsScaled[2]),
    })

    expect6FigBigNumberAllEqual([
      usersPotentialWinningsScaled[0],
      usersPotentialWinningsScaled[1],
      usersPotentialWinningsScaled[2],
    ])
  })
}


// PENDING INTER ROUND
const winningsMatchPotentialWinnings = (tokenName: string, elevation: number) => {
  it('WINNINGS: Winnings match potential winnings before round end', async function() {
    const token = await getContract(tokenName)

    await subCartMethod.updatePool(token.address, elevation)

    // Single timestamp delta
    const usersPotentialWinningsInit = await usersPotentialWinnings(elevation)
    await subCartMethod.updatePool(token.address, elevation)
    const usersPotentialWinningsInit2 = await usersPotentialWinnings(elevation)
    const usersYieldContributedDelta = await userPromiseSequenceMap(
      async (_user, userIndex) => usersPotentialWinningsInit2[userIndex].yieldContributed.sub(usersPotentialWinningsInit[userIndex].yieldContributed)
    )


    // Round Rollover
    const nextRoundTime = await elevationHelperGet.roundEndTimestamp(elevation)
    await mineBlockWithTimestamp(nextRoundTime)

    const usersPotentialWinningsFinal = await usersPotentialWinnings(elevation)
    const usersRewardsInit = await usersRewards(token.address, elevation)

    const timestampBeforeRollover = await getTimestamp()
    await rolloverRound(elevation)

    const timestampAfterRollover = await getTimestamp()
    const rolloverTimestampDelta = timestampAfterRollover - timestampBeforeRollover

    const usersTotalYieldContributed = await userPromiseSequenceMap(
      async (user, userIndex) => usersPotentialWinningsFinal[userIndex].yieldContributed.add(usersYieldContributedDelta[userIndex].mul(rolloverTimestampDelta))
    )

    const prevWinningTotem = await elevationHelperGet.prevWinningTotem(elevation)

    const totalYieldContributed = sumBigNumbers(usersTotalYieldContributed)
    const winningTotemYieldContributed = prevWinningTotem === 0 ?
      usersTotalYieldContributed[0].add(usersTotalYieldContributed[1]) :
      usersTotalYieldContributed[2]

    const winningsMult = totalYieldContributed.mul(e12(1)).div(winningTotemYieldContributed)


    const usersRewardsFinal = await usersRewards(token.address, elevation)
    const usersRewardsDelta = await userPromiseSequenceMap(
      async (user, userIndex) => usersRewardsFinal[userIndex].sub(usersRewardsInit[userIndex])
    )

    await userPromiseSequenceMap(
      async (user, userIndex) => consoleLog({
        user: userIndex,
        yieldContributed: toDecimal(usersTotalYieldContributed[userIndex]),
        winningsMult: winningsMult.toNumber(),
        winningsFinal: toDecimal(usersTotalYieldContributed[userIndex].mul(winningsMult).div(e12(1))),
        reward: toDecimal(usersRewardsDelta[userIndex]),
      })
    )

    if (prevWinningTotem == 0) {
      expect6FigBigNumberEquals(usersRewardsDelta[0], usersTotalYieldContributed[0].mul(winningsMult).div(e12(1)))
      expect6FigBigNumberEquals(usersRewardsDelta[1], usersTotalYieldContributed[1].mul(winningsMult).div(e12(1)))
    } else {
      expect6FigBigNumberEquals(usersRewardsDelta[2], usersTotalYieldContributed[2].mul(winningsMult).div(e12(1)))
    }
  })
}

const rolloverMultipleRounds = (tokenName: string, elevation: number) => {
  it('ROLLOVER: Rolling over multiple rounds yields correct rewards', async function() {
    const { user1, user3 } = await getNamedSigners(hre)
    const token = await getContract(tokenName)

    await rolloverRound(elevation)

    // DETERMINE FULL ROUND ROLLOVER BASELINE
    let totem0baselineSet = false
    let totem1baselineSet = false

    let user1BaselineAvailRewardsInit: BigNumber | undefined
    let user3BaselineAvailRewardsInit: BigNumber | undefined

    let user1BaselineWinDelta: BigNumber | undefined
    let user3BaselineWinDelta: BigNumber | undefined

    while (!totem1baselineSet || !totem0baselineSet) {
      if (!totem0baselineSet) {
        user1BaselineAvailRewardsInit = await subCartGet.poolClaimableRewards(token.address, elevation, user1.address)
      }

      if (!totem1baselineSet) {
        user3BaselineAvailRewardsInit = await subCartGet.poolClaimableRewards(token.address, elevation, user3.address)
      }

      await rolloverRound(elevation)
      const winningTotem = await elevationHelperGet.prevWinningTotem(elevation)

      if (!totem0baselineSet && winningTotem === 0) {
        const user1BaselineAvailRewardsMid = await subCartGet.poolClaimableRewards(token.address, elevation, user1.address)
        user1BaselineWinDelta = user1BaselineAvailRewardsMid.sub(user1BaselineAvailRewardsInit!)
        console.log({
          totem0: `${toDecimal(user1BaselineAvailRewardsInit || e18(0))} --> ${toDecimal(user1BaselineAvailRewardsMid || e18(0))}: ${toDecimal(user1BaselineWinDelta)}`,
        })
        totem0baselineSet = true
      }
      if (!totem1baselineSet && winningTotem === 1) {
        const user3BaselineAvailRewardsMid = await subCartGet.poolClaimableRewards(token.address, elevation, user3.address)
        user3BaselineWinDelta = user3BaselineAvailRewardsMid.sub(user3BaselineAvailRewardsInit!)
        console.log({
          totem1: `${toDecimal(user3BaselineAvailRewardsInit || e18(0))} --> ${toDecimal(user3BaselineAvailRewardsMid || e18(0))}: ${toDecimal(user3BaselineWinDelta)}`
        })
        totem1baselineSet = true
      }
    }

    if (user1BaselineWinDelta === null || user3BaselineWinDelta == null) {
      console.log("Baseline Win Delta Missing")
      expect(true).to.equal(false)
    }
    user1BaselineWinDelta = user1BaselineWinDelta!
    user3BaselineWinDelta = user3BaselineWinDelta!

    // MULTI ROUND ROLLOVER
    await rolloverRound(elevation)


    const user1AvailRewardsInit = await subCartGet.poolClaimableRewards(token.address, elevation, user1.address)
    const user3AvailRewardsInit = await subCartGet.poolClaimableRewards(token.address, elevation, user3.address)


    const nextRoundTime = await elevationHelperGet.roundEndTimestamp(elevation)
    const roundDuration = await elevationHelperGet.roundDurationSeconds(elevation)
    await mineBlockWithTimestamp(nextRoundTime + (roundDuration * 4))
    await cartographerMethod.rollover({ elevation })


    const user1AvailRewardsFinal = await subCartGet.poolClaimableRewards(token.address, elevation, user1.address)
    const user3AvailRewardsFinal = await subCartGet.poolClaimableRewards(token.address, elevation, user3.address)

    const user1MultiRoundDelta = user1AvailRewardsFinal.sub(user1AvailRewardsInit)
    const user3MultiRoundDelta = user3AvailRewardsFinal.sub(user3AvailRewardsInit)

    const prevWinningTotem = await elevationHelperGet.prevWinningTotem(elevation)

    consoleLog({
      prevWinningTotem,
      user1WinDelta: toDecimal(user1BaselineWinDelta),
      user3WinDelta: toDecimal(user3BaselineWinDelta),
      user1MultiRoundDelta: toDecimal(user1MultiRoundDelta),
      user3MultiRoundDelta: toDecimal(user3MultiRoundDelta),
      user1Mult: user1BaselineWinDelta.eq(0) ? 'div/0' : user1MultiRoundDelta.mul('100000').div(user1BaselineWinDelta).toString(),
      user3Mult: user3BaselineWinDelta.eq(0) ? 'div/0' : user3MultiRoundDelta.mul('100000').div(user3BaselineWinDelta).toString(),
      user1AvailRewards: `${toDecimal(user1AvailRewardsInit)} --> ${toDecimal(user1AvailRewardsFinal)}`,
      user3AvailRewards: `${toDecimal(user3AvailRewardsInit)} --> ${toDecimal(user3AvailRewardsFinal)}`,
    })

    if (prevWinningTotem === 0) {
      expect6FigBigNumberEquals(user1MultiRoundDelta.mul(e18(1)).div(user1BaselineWinDelta), e18(5))
    } else {
      expect6FigBigNumberEquals(user3MultiRoundDelta.mul(e18(1)).div(user3BaselineWinDelta), e18(5))
    }
  })
}

const correctWinnersHistoricalData = (tokenName: string, elevation: number) => {
  it('HISTORICAL DATA: Single-rollovers update historical data correctly', async function() {
    const token = await getContract(tokenName)

    const {
      totemWinCounters: poolWinCountersInit,
      prevWinners: prevWinnersInit,
    } = await elevationHelperGet.historicalTotemStats(elevation)

    console.log({
      poolWinCountersInit,
      prevWinnersInit
    })

    await rolloverRound(elevation)
    const {
      totemWinCounters: poolWinCounters1,
      prevWinners: prevWinners1,
    } = await elevationHelperGet.historicalTotemStats(elevation)
    const round1WinningTotem = await elevationHelperGet.prevWinningTotem(elevation)
    expect(poolWinCountersInit[round1WinningTotem] + 1).to.equal(poolWinCounters1[round1WinningTotem])
    expectBigNumberArraysEqual(prevWinners1, [round1WinningTotem, ...prevWinnersInit].slice(0, 10))

    await rolloverRound(elevation)
    const {
      totemWinCounters: poolWinCounters2,
      prevWinners: prevWinners2,
    } = await elevationHelperGet.historicalTotemStats(elevation)
    const round2WinningTotem = await elevationHelperGet.prevWinningTotem(elevation)
    expect(poolWinCounters1[round2WinningTotem] + 1).to.equal(poolWinCounters2[round2WinningTotem])
    expectBigNumberArraysEqual(prevWinners2, [round2WinningTotem, round1WinningTotem, ...prevWinnersInit].slice(0, 10))

    await rolloverRound(elevation)
    const {
      totemWinCounters: poolWinCounters3,
      prevWinners: prevWinners3,
    } = await elevationHelperGet.historicalTotemStats(elevation)
    const round3WinningTotem = await elevationHelperGet.prevWinningTotem(elevation)
    expect(poolWinCounters2[round3WinningTotem] + 1).to.equal(poolWinCounters3[round3WinningTotem])
    expectBigNumberArraysEqual(prevWinners3, [round3WinningTotem, round2WinningTotem, round1WinningTotem, ...prevWinnersInit].slice(0, 10))

    await rolloverRound(elevation)
    const {
      totemWinCounters: poolWinCounters4,
      prevWinners: prevWinners4,
    } = await elevationHelperGet.historicalTotemStats(elevation)
    const round4WinningTotem = await elevationHelperGet.prevWinningTotem(elevation)
    expect(poolWinCounters3[round4WinningTotem] + 1).to.equal(poolWinCounters4[round4WinningTotem])
    expectBigNumberArraysEqual(prevWinners4, [round4WinningTotem, round3WinningTotem, round2WinningTotem, round1WinningTotem, ...prevWinnersInit].slice(0, 10))

    await rolloverRound(elevation)
    const {
      totemWinCounters: poolWinCounters5,
      prevWinners: prevWinners5,
    } = await elevationHelperGet.historicalTotemStats(elevation)
    const round5WinningTotem = await elevationHelperGet.prevWinningTotem(elevation)
    expect(poolWinCounters4[round5WinningTotem] + 1).to.equal(poolWinCounters5[round5WinningTotem])
    expectBigNumberArraysEqual(prevWinners5, [round5WinningTotem, round4WinningTotem, round3WinningTotem, round2WinningTotem, round1WinningTotem, ...prevWinnersInit].slice(0, 10))

    consoleLog({
      poolWinCountersInit: poolWinCountersInit.join(' '),
      poolWinCounters1: poolWinCounters1.join(' '),
      poolWinCounters2: poolWinCounters2.join(' '),
      poolWinCounters3: poolWinCounters3.join(' '),
      poolWinCounters4: poolWinCounters4.join(' '),
      poolWinCounters5: poolWinCounters5.join(' '),
      prevWinnersInit: prevWinnersInit.join(' '),
      prevWinners1: prevWinners1.join(' '),
      prevWinners2: prevWinners2.join(' '),
      prevWinners3: prevWinners3.join(' '),
      prevWinners4: prevWinners4.join(' '),
      prevWinners5: prevWinners5.join(' '),
    })
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

    const winsInit = poolWinCountersInit.reduce((acc: number, wins: number) => acc + wins, 0)
    const winsFinal = poolWinCountersFinal.reduce((acc: number, wins: number) => acc + wins, 0)

    expect(winsFinal - winsInit).to.equal(1)
  })
}

// TOTEMS
const switchingTotems = (tokenName: string, elevation: number) => {
  it(`TOTEMS: Switching to invalid totem should fail with error ${ERR.INVALID_TOTEM}`, async function() {
    const { user1 } = await getNamedSigners(hre)
    const cartographer = await getCartographer()

    await cartographerMethod.switchTotem({
      user: user1,
      elevation,
      totem: TOTEM_COUNT[elevation],
      revertErr: ERR.INVALID_TOTEM
    })
  })
  it('TOTEMS: Users should be able to switch to valid totems', async function() {
    const { user1 } = await getNamedSigners(hre)
    const token = await getContract(tokenName)

    const targetTotem = TOTEM_COUNT[elevation] - 1

    await rolloverRoundUntilWinningTotem(elevation, 0)

    await subCartMethod.updatePool(token.address, elevation)

    let runningUserInfo = await subCartGet.userInfo(token.address, elevation, user1.address)
    const user1Totem0 = (await subCartGet.userTotemInfo(elevation, user1.address)).totem
    const user1Staked0 = runningUserInfo.staked
    const poolInfo0 = await subCartGet.poolInfo(token.address, elevation)

    expect(user1Totem0).to.equal(0)

    // SWITCH TOTEM FROM 0 --> TARGET TOTEM
    await cartographerMethod.switchTotem({
      user: user1,
      elevation,
      totem: targetTotem,
    })

    runningUserInfo =  await subCartGet.userInfo(token.address, elevation, user1.address)
    const user1Totem1 = (await subCartGet.userTotemInfo(elevation, user1.address)).totem
    const user1Staked1 = runningUserInfo.staked
    const poolInfo1 = await subCartGet.poolInfo(token.address, elevation)

    expect(user1Totem1).to.equal(targetTotem)
    expect(user1Staked1).to.equal(user1Staked0)
    expect(poolInfo1.supply).to.equal(poolInfo0.supply)
    expect(poolInfo0.totemSupplies[0].sub(poolInfo1.totemSupplies[0])).to.equal(user1Staked0)
    expect(poolInfo1.totemSupplies[1].sub(poolInfo0.totemSupplies[1])).to.equal(user1Staked0)

    expect6FigBigNumberEquals(poolInfo1.totemRoundRewards[0].sub(poolInfo0.totemRoundRewards[0]).sub(poolInfo0.totemRoundRewards[1].sub(poolInfo1.totemRoundRewards[1])), poolInfo1.roundRewards.sub(poolInfo0.roundRewards))

    await subCartMethod.updatePool(token.address, elevation)

    const poolInfo1B = await subCartGet.poolInfo(token.address, elevation)

    // SWITCH BACK FROM TARGET TOTEM --> 0
    await cartographerMethod.switchTotem({
      user: user1,
      elevation,
      totem: 0
    })

    runningUserInfo =  await subCartGet.userInfo(token.address, elevation, user1.address)
    const user1Totem2 = (await subCartGet.userTotemInfo(elevation, user1.address)).totem
    const user1Staked2 = runningUserInfo.staked
    const poolInfo2 = await subCartGet.poolInfo(token.address, elevation)

    expect(user1Totem2).to.equal(0)

    expect(user1Staked2).to.equal(user1Staked1)
    expect(poolInfo2.supply).to.equal(poolInfo1.supply)
    expect(poolInfo2.totemSupplies[0].sub(poolInfo1.totemSupplies[0])).to.equal(user1Staked0)
    expect(poolInfo1.totemSupplies[1].sub(poolInfo2.totemSupplies[1])).to.equal(user1Staked0)

    expect(poolInfo2.totemSupplies[0]).to.equal(poolInfo0.totemSupplies[0])
    expect(poolInfo2.totemSupplies[1]).to.equal(poolInfo0.totemSupplies[1])

    expect6FigBigNumberEquals(poolInfo2.totemRoundRewards[1].sub(poolInfo1B.totemRoundRewards[1]).sub(poolInfo1B.totemRoundRewards[0].sub(poolInfo2.totemRoundRewards[0])), poolInfo2.roundRewards.sub(poolInfo1B.roundRewards))
  })
}

export const elevationTests = {
  standardDepositShouldSucceed,
  depositShouldUpdatePoolAndTotemInfo,

  elevationPoolRewardsShouldIncreaseEachBlock,

  winningsMatchPotentialWinnings,

  rolloverMultipleRounds,

  correctWinnersHistoricalData,

  switchingTotems,
}
