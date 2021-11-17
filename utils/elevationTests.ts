import { BigNumber } from '@ethersproject/bignumber';
import { getNamedSigners } from '@nomiclabs/hardhat-ethers/dist/src/helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai'
import { Contract } from 'ethers';
import hre, { ethers } from 'hardhat';
import { consoleLog, Contracts, depositedAfterFee, e18, ERR, EVENT, getTotemCount, mineBlock, toDecimal } from '.';
import { EXPEDITION, TOTEM_COUNT, SubCartographer } from './constants';
import { e12, expect6FigBigNumberEquals, expect6FigBigNumberAllEqual, expectBigNumberArraysEqual, expectBigNumberGreaterThan, expectBigNumberLessThan, mineBlocks, stringifyBigNumberArray, getTimestamp, mineBlockWithTimestamp, increaseTimestampAndMine, e0, e6 } from './utils';


// ELEVATION / EXPEDITION DIFFING
const isExpedition = (subCartographerName: string) => subCartographerName == SubCartographer.EXPEDITION
const getElevation = async (subCartographerName: string, contract: Contract, pid: number) => {
  if (isExpedition(subCartographerName)) {
    return EXPEDITION
  } else {
    return (await contract.elevationPoolInfo(pid)).elevation
  }
}

// HELPERS
const getLpSupplies = async (cartographer: Contract, subCartographer: Contract, pid: number) => {
  const [lpSupply, totemSupplies] = await Promise.all([
    await cartographer.stakedSupply(pid),
    await subCartographer.totemSupplies(pid),
  ])
  return [lpSupply, ...totemSupplies]
}
export const rolloverRound = async (subCartographerName: string, cartographer: Contract, subCartographer: Contract, elevationHelper: Contract, pid: number) => {
  const elevation = await getElevation(subCartographerName, subCartographer, pid)
  const nextRoundTime = (await elevationHelper.roundEndTimestamp(elevation)).toNumber()
  await mineBlockWithTimestamp(nextRoundTime)
  await cartographer.rollover(elevation)
}
export const rolloverRounds = async (rounds: number, subCartographerName: string, cartographer: Contract, subCartographer: Contract, elevationHelper: Contract, pid: number) => {
  for (let i = 0; i < rounds; i++) {
    await rolloverRound(subCartographerName, cartographer, subCartographer, elevationHelper, pid)
  }
}
export const getPrevRoundWinner = async (subCartographerName: string, subCartographer: Contract, elevationHelper: Contract, pid: number) => {
  const elevation = await getElevation(subCartographerName, subCartographer, pid)
    const round = await elevationHelper.roundNumber(elevation)
    return await elevationHelper.winningTotem(elevation, round - 1)
}
export const rolloverRoundUntilWinningTotem = async (subCartographerName: string, cartographer: Contract, subCartographer: Contract, elevationHelper: Contract, pid: number, targetWinningTotem: number) => {
  const elevation = await getElevation(subCartographerName, subCartographer, pid)
  let winningTotem
  do {
    await rolloverRound(subCartographerName, cartographer, subCartographer, elevationHelper, pid)
    winningTotem = await getPrevRoundWinner(subCartographerName, subCartographer, elevationHelper, pid)
  } while (winningTotem !== targetWinningTotem)
}
export const rolloverRoundUntilLosingTotem = async(subCartographerName: string, cartographer: Contract, subCartographer: Contract, elevationHelper: Contract, pid: number, targetLosingTotem: number) => {
  const elevation = await getElevation(subCartographerName, subCartographer, pid)
  let winningTotem
  do {
    await rolloverRound(subCartographerName, cartographer, subCartographer, elevationHelper, pid)
    winningTotem = await getPrevRoundWinner(subCartographerName, subCartographer, elevationHelper, pid)
  } while (winningTotem === targetLosingTotem)
}

const getHistoricalTotemStats = async (elevationHelper: Contract, elevation: number): Promise<BigNumber[][]> => {
  const historicalWinningTotems = await elevationHelper.historicalWinningTotems(elevation)
  const poolWinCounters = historicalWinningTotems.slice(0, 10)
  const last5Winners = historicalWinningTotems.slice(10)
  return [poolWinCounters, last5Winners]
}

const getBlockPendingDiff = async (subCartographerName: string, cartographer: Contract, subCartographer: Contract, elevationHelper: Contract, pid: number): Promise<BigNumber> => {
  const elevation = await getElevation(subCartographerName, subCartographer, pid)
  const token = await cartographer.token(pid, 0)
  const tokenElevationRewardMultiplier = await cartographer.tokenElevationEmissionMultiplier(token, elevation)
  const tokenSharedAlloc = await cartographer.tokenSharedAlloc(token)
  const totalAllocPoint = await cartographer.totalSharedAlloc()
  const summitPerSecond = await cartographer.summitPerSecond()
  return tokenSharedAlloc.mul(e12(1)).div(totalAllocPoint).mul(tokenElevationRewardMultiplier).mul(summitPerSecond).div(e12(1)).div(e12(1))
}

const getUserTotem = async (subCartographer: Contract, elevation: number, user: SignerWithAddress): Promise<BigNumber> => {
  if (elevation === EXPEDITION) {
    return await subCartographer.connect(user).userTotem(user.address)
  } else {
    return await subCartographer.connect(user).userTotem(user.address, elevation)
  }
}

export const getSubCartographerStaked = async (subCartographer: Contract, subCartographerName: string, pid: number, user: SignerWithAddress) => {
  if (subCartographerName === Contracts.CartographerExpedition) {
    return [
      (await subCartographer.connect(user).userInfo(pid, user.address)).summitStaked,
      (await subCartographer.connect(user).userInfo(pid, user.address)).lpStaked,
    ]
  } else {
    return [(await subCartographer.connect(user).userInfo(pid, user.address)).staked, e18(0)]
  }
}


// DEPOSIT
const standardDepositShouldSucceed = (subCartographerName: string, pid: number, totem: number, depositFee: number = 0) => {
  it('DEPOSIT: Standard deposit should succeed', async function() {
    const { user1 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')
    const subCartographer = await ethers.getContract(subCartographerName)

    const [initialStaked] = await getSubCartographerStaked(subCartographer, subCartographerName, pid, user1)
    
    const amountAfterFee = depositedAfterFee(e18(5), depositFee)
    await expect(
      cartographer.connect(user1).deposit(pid, e18(5), 0, totem)
    ).to.emit(cartographer, EVENT.Deposit).withArgs(user1.address, pid, amountAfterFee, 0)
      
    const [finalStaked] = await getSubCartographerStaked(subCartographer, subCartographerName, pid, user1)
    expect(finalStaked).to.equal(initialStaked.add(amountAfterFee))
  })
}
const depositShouldUpdatePoolAndTotemInfo = (subCartographerName: string, pid: number, depositFee: number = 0) => {
  it('DEPOSIT: Deposit should update pool and totem info', async function() {
    const { user1, user2, user3 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')
    const subCartographer = await ethers.getContract(subCartographerName)

    const [lpSupplyInit, totem0LpSupplyInit, totem1LpSupplyInit] = await getLpSupplies(cartographer, subCartographer, pid)

    const [user1StakedInit] = await getSubCartographerStaked(subCartographer, subCartographerName, pid, user1)
    const [user2StakedInit] = await getSubCartographerStaked(subCartographer, subCartographerName, pid, user2)
    const [user3StakedInit] = await getSubCartographerStaked(subCartographer, subCartographerName, pid, user3)
  
    await cartographer.connect(user1).deposit(pid, e18(5), 0, 0)
    await cartographer.connect(user2).deposit(pid, e18(2), 0, 0)
    await cartographer.connect(user3).deposit(pid, e18(6), 0, 1)

    const [lpSupplyFinal, totem0LpSupplyFinal, totem1LpSupplyFinal] = await getLpSupplies(cartographer, subCartographer, pid)
    
    const [user1StakedFinal] = await getSubCartographerStaked(subCartographer, subCartographerName, pid, user1)
    const [user2StakedFinal] = await getSubCartographerStaked(subCartographer, subCartographerName, pid, user2)
    const [user3StakedFinal] = await getSubCartographerStaked(subCartographer, subCartographerName, pid, user3)

    expect(totem0LpSupplyFinal.sub(totem0LpSupplyInit)).to.equal(depositedAfterFee(e18(5 + 2), depositFee))
    expect(totem1LpSupplyFinal.sub(totem1LpSupplyInit)).to.equal(depositedAfterFee(e18(6), depositFee))
    expect(lpSupplyFinal.sub(lpSupplyInit)).to.equal(depositedAfterFee(e18(5 + 2 + 6), depositFee))
    
    expect(user1StakedFinal.sub(user1StakedInit)).to.equal(depositedAfterFee(e18(5), depositFee))
    expect(user2StakedFinal.sub(user2StakedInit)).to.equal(depositedAfterFee(e18(2), depositFee))
    expect(user3StakedFinal.sub(user3StakedInit)).to.equal(depositedAfterFee(e18(6), depositFee))
  })
}

// VALID TOTEM
const validTotemDepositShouldSucceed = (subCartographerName: string, pid: number, depositFee = 0) => {
  it(`VALIDTOTEM: Valid totem deposit should succeed`, async function() {
    // CURRENT TOTEM: 0
    const { user1 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')
    const subCartographer = await ethers.getContract(subCartographerName)
    const elevationHelper = await ethers.getContract('ElevationHelper')

    const poolElevation = await getElevation(subCartographerName, subCartographer, pid)
    const totemCount = getTotemCount(poolElevation)

    const [userStaked] = await getSubCartographerStaked(subCartographer, subCartographerName, pid, user1)

    // Exit to 0 staked
    await cartographer.connect(user1).withdraw(pid, userStaked, 0)

    await rolloverRoundUntilLosingTotem(subCartographerName, cartographer, subCartographer, elevationHelper, pid, 0)

    // Harvest any winnings
    await cartographer.connect(user1).deposit(pid, 0, 0, 0)

    await expect(
      cartographer.connect(user1).deposit(pid, e18(5), 0, totemCount - 1)
    ).to.emit(cartographer, EVENT.Deposit).withArgs(user1.address, pid, depositedAfterFee(e18(5), depositFee), 0)
  })
}
const invalidTotemDepositShouldFail = (subCartographerName: string, pid: number) => {
  it(`VALIDTOTEM: Invalid totem deposit should fail with error "${ERR.INVALID_TOTEM}"`, async function() {
    // CURRENT TOTEM: totemCount - 1
    const { user1 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')
    const subCartographer = await ethers.getContract(subCartographerName)
    const elevationHelper = await ethers.getContract('ElevationHelper')

    const poolElevation = await getElevation(subCartographerName, subCartographer, pid)
    const totemCount = getTotemCount(poolElevation)

    const [userStaked] = await getSubCartographerStaked(subCartographer, subCartographerName, pid, user1)

    // Exit to 0 staked
    await cartographer.connect(user1).withdraw(pid, userStaked, 0)

    await rolloverRoundUntilLosingTotem(subCartographerName, cartographer, subCartographer, elevationHelper, pid, totemCount - 1)

    // Harvest any winnings
    await cartographer.connect(user1).deposit(pid, 0, 0, totemCount - 1)    

    await expect(
      cartographer.connect(user1).deposit(pid, e18(5), 0, totemCount)
    ).to.be.revertedWith(ERR.INVALID_TOTEM)
  })
}
const depositToDifferentTotemShouldFail = (subCartographerName: string, pid: number) => {
  it(`VALIDTOTEM: Deposit to different totem than current should fail with error "${ERR.NO_TOTEM_SWITCH_ON_DEPOSIT}"`, async function() {
    // CURRENT TOTEM: None
    const { user1 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')

    cartographer.connect(user1).deposit(pid, e18(5), 0, 0)

    await expect(
      cartographer.connect(user1).deposit(pid, e18(5), 0, 1)
    ).to.be.revertedWith(ERR.NO_TOTEM_SWITCH_ON_DEPOSIT)
  })
}

// TOTEM IN USE
const initialTotemInUseShouldBeFalse = (elevation: number) => {
  it('TOTEMINUSE: Initial TotemInUse should be false', async function() {
    const { user1 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')

    const [totemInUse] = await cartographer.userTotem(elevation, user1.address)
    expect(totemInUse).to.be.false
  })
}

const totemInUseShouldUpdateOnDeposit = (pid: number, elevation: number) => {
  it('TOTEMINUSE: TotemInUse should update on deposit', async function() {
    const { user1 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')

    await cartographer.connect(user1).deposit(pid, e18(1), 0, 1)

    const [totemInUse] = await cartographer.userTotem(elevation, user1.address)
    expect(totemInUse).to.be.true
   })
}

const totemInUseShouldPreventIncorrectPondDeposit = (pid: number, elevation: number) => {
  it('TOTEMINUSE: TotemInUse should prevent incorrect pond deposits', async function() {
    // CURRENT TOTEM: 1
    const { user1 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')

    await expect(
      cartographer.connect(user1).deposit(pid, e18(1), 0, 0)
    ).to.be.revertedWith(ERR.NO_TOTEM_SWITCH_ON_DEPOSIT)
  })
}

const withdrawToZeroShouldUpdateTotemInUse = (subCartographerName: string, pid: number, elevation: number) => {
  it('TOTEMINUSE: TotemInUse should be true even after withdrawal to zero', async function() {
    // CURRENT TOTEM: 1
    const { user1 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')

    await cartographer.connect(user1).withdraw(pid, e18(1), 0)

    const [totemInUse] = await cartographer.userTotem(elevation, user1.address)
    expect(totemInUse).to.be.true
  })
  it('TOTEMINUSE: TotemInUse should become false after harvest of any winnings', async function() {
    // CURRENT TOTEM: 1
    const { user1 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')
    const subCartographer = await ethers.getContract(subCartographerName)
    const elevationHelper = await ethers.getContract('ElevationHelper')

    await rolloverRoundUntilLosingTotem(subCartographerName, cartographer, subCartographer, elevationHelper, pid, 1)

    await cartographer.connect(user1).deposit(pid, 0, 0, 1)

    const [totemInUse] = await cartographer.userTotem(elevation, user1.address)
    expect(totemInUse).to.be.false
  })
}



// PENDING CURR ROUND
const elevationPoolRewardsShouldIncreaseEachBlock = (subCartographerName: string, pid: number) => {
  it('PENDING: Elevation pool struct rewards should increase each block', async function() {
    const { user1, user2, user3 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')
    const subCartographer = await ethers.getContract(subCartographerName)
    const elevationHelper = await ethers.getContract('ElevationHelper')

    await cartographer.connect(user1).deposit(pid, e18(5), 0, 0)
    await cartographer.connect(user2).deposit(pid, e18(2), 0, 0)
    await cartographer.connect(user3).deposit(pid, e18(6), 0, 1)

    const [roundRewardsInit, totem0RoundRewardsInit, totem1RoundRewardsInit] = await subCartographer.totemRoundRewards(pid)
    const [_lpSupply, totem0LpSupply, totem1LpSupply] = await getLpSupplies(cartographer, subCartographer, pid)
    await mineBlock()
    await mineBlock()
    await mineBlock()
    await subCartographer.updatePool(pid)
    const [roundRewardsFinal, totem0RoundRewardsFinal, totem1RoundRewardsFinal] = await subCartographer.totemRoundRewards(pid)
    const totem0RoundRewardsDelta = totem0RoundRewardsFinal.sub(totem0RoundRewardsInit)
    const totem1RoundRewardsDelta = totem1RoundRewardsFinal.sub(totem1RoundRewardsInit)
    const roundRewardsDelta = roundRewardsFinal.sub(roundRewardsInit)

    consoleLog({
      roundRewards: `${toDecimal(roundRewardsInit)} --> ${toDecimal(roundRewardsFinal)}`,
      totem0RoundRewards: `${toDecimal(totem0RoundRewardsInit)} --> ${toDecimal(totem0RoundRewardsFinal)}`,
      totem1RoundRewards: `${toDecimal(totem1RoundRewardsInit)} --> ${toDecimal(totem1RoundRewardsFinal)}`,
    })
    
    expect6FigBigNumberEquals(roundRewardsDelta, totem0RoundRewardsDelta.add(totem1RoundRewardsDelta))

    let blockPendingDiff = BigNumber.from(0)
    if (isExpedition(subCartographerName)) {
      blockPendingDiff = (await subCartographer.expeditionPoolInfo(pid)).rewardEmission
    } else {
      blockPendingDiff = await getBlockPendingDiff(subCartographerName, cartographer, subCartographer, elevationHelper, pid)
    }
    expect6FigBigNumberEquals(roundRewardsDelta, blockPendingDiff.mul(4))
    
    const totem0ScaledRewards = totem0RoundRewardsDelta.mul('100000000').div(totem0LpSupply)
    const totem1ScaledRewards = totem1RoundRewardsDelta.mul('100000000').div(totem1LpSupply)
    consoleLog({
      0: `${toDecimal(totem0RoundRewardsDelta)}, ${toDecimal(totem0LpSupply)}, ${totem0ScaledRewards}`,
      1: `${toDecimal(totem1RoundRewardsDelta)}, ${toDecimal(totem1LpSupply)}, ${totem1ScaledRewards}`,
      2: toDecimal(roundRewardsDelta),
      3: toDecimal(blockPendingDiff.mul('4')),
    })
    expect6FigBigNumberEquals(totem0ScaledRewards, totem1ScaledRewards)
  })
  it('PENDING: Users hypothetical rewards should increase each block proportionally', async function() {
    const { user1, user2, user3 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')
    const subCartographer = await ethers.getContract(subCartographerName)

    const user1Staked = (await subCartographer.userInfo(pid, user1.address)).staked
    const user2Staked = (await subCartographer.userInfo(pid, user2.address)).staked
    const user3Staked = (await subCartographer.userInfo(pid, user3.address)).staked
    
    const [user1HypotheticalPendingInit, user1HypotheticalWinningsInit] = await cartographer.hypotheticalRewards(pid, user1.address)
    const [user2HypotheticalPendingInit, user2HypotheticalWinningsInit] = await cartographer.hypotheticalRewards(pid, user2.address)
    const [user3HypotheticalPendingInit, user3HypotheticalWinningsInit] = await cartographer.hypotheticalRewards(pid, user3.address)
    consoleLog({
      ROUND_REWARDS: await subCartographer.totemRoundRewards(pid)
    })
    const [roundRewardsInit, totem0RoundRewardsInit, totem1RoundRewardsInit] = await subCartographer.totemRoundRewards(pid)

    consoleLog({
      roundRewards: toDecimal(roundRewardsInit),
      totem0RoundRewards: toDecimal(totem0RoundRewardsInit),
      totem1RoundRewards: toDecimal(totem1RoundRewardsInit),
      user1: `${toDecimal(user1HypotheticalWinningsInit)}, ${toDecimal(user1HypotheticalPendingInit)}`,
      user2: `${toDecimal(user2HypotheticalWinningsInit)}, ${toDecimal(user2HypotheticalPendingInit)}`,
      user3: `${toDecimal(user3HypotheticalWinningsInit)}, ${toDecimal(user3HypotheticalPendingInit)}`,
    })

    expect(user1HypotheticalWinningsInit).to.equal(user1HypotheticalPendingInit.mul(roundRewardsInit).div(totem0RoundRewardsInit))
    expect(user2HypotheticalWinningsInit).to.equal(user2HypotheticalPendingInit.mul(roundRewardsInit).div(totem0RoundRewardsInit))
    expect(user3HypotheticalWinningsInit).to.equal(user3HypotheticalPendingInit.mul(roundRewardsInit).div(totem1RoundRewardsInit))
    
    await mineBlock()
    await mineBlock()
    await mineBlock()
    await subCartographer.updatePool(pid)

    // Users hypothetical winnings are calculated correctly
    const [user1HypotheticalPendingFinal, user1HypotheticalWinningsFinal] = await cartographer.hypotheticalRewards(pid, user1.address)
    const [user2HypotheticalPendingFinal, user2HypotheticalWinningsFinal] = await cartographer.hypotheticalRewards(pid, user2.address)
    const [user3HypotheticalPendingFinal, user3HypotheticalWinningsFinal] = await cartographer.hypotheticalRewards(pid, user3.address)
    const [roundRewardsFinal, totem0RoundRewardsFinal, totem1RoundRewardsFinal] = await subCartographer.totemRoundRewards(pid)

    expect(user1HypotheticalWinningsFinal).to.equal(user1HypotheticalPendingFinal.mul(roundRewardsFinal).div(totem0RoundRewardsFinal))
    expect(user2HypotheticalWinningsFinal).to.equal(user2HypotheticalPendingFinal.mul(roundRewardsFinal).div(totem0RoundRewardsFinal))
    expect(user3HypotheticalWinningsFinal).to.equal(user3HypotheticalPendingFinal.mul(roundRewardsFinal).div(totem1RoundRewardsFinal))

    // Sum of users rewards in each totem is reflected in totem total, and sum of all totems is reflected in pool total
    const user1HypotheticalPendingDelta = user1HypotheticalPendingFinal.sub(user1HypotheticalPendingInit)
    const user2HypotheticalPendingDelta = user2HypotheticalPendingFinal.sub(user2HypotheticalPendingInit)
    const user3HypotheticalPendingDelta = user3HypotheticalPendingFinal.sub(user3HypotheticalPendingInit)
    const roundRewardsDelta = roundRewardsFinal.sub(roundRewardsInit)
    const totem0RoundRewardsDelta = totem0RoundRewardsFinal.sub(totem0RoundRewardsInit)
    const totem1RoundRewardsDelta = totem1RoundRewardsFinal.sub(totem1RoundRewardsInit)

    expect6FigBigNumberEquals(totem0RoundRewardsDelta, user1HypotheticalPendingDelta.add(user2HypotheticalPendingDelta))
    expect6FigBigNumberEquals(totem1RoundRewardsDelta, user3HypotheticalPendingDelta)
    expect6FigBigNumberEquals(roundRewardsDelta, totem0RoundRewardsDelta.add(totem1RoundRewardsDelta))
    
    // User's rewards scale proportionally to their staked amount
    const user1HypotheticalPendingScaled = user1HypotheticalPendingDelta.mul('100000000').div(user1Staked)
    const user2HypotheticalPendingScaled = user2HypotheticalPendingDelta.mul('100000000').div(user2Staked)
    const user3HypotheticalPendingScaled = user3HypotheticalPendingDelta.mul('100000000').div(user3Staked)

    expect(user1HypotheticalPendingScaled).to.equal(user2HypotheticalPendingScaled)
    expect(user1HypotheticalPendingScaled).to.equal(user3HypotheticalPendingScaled)
  })
}


// PENDING INTER ROUND
const vestedWinningsIncreaseOverDurationOfRound = (subCartographerName: string, pid: number) => {
  it('VESTING: Winnings vest over duration of round', async function() {
    const { user1, user3 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')
    const subCartographer = await ethers.getContract(subCartographerName)
    const elevationHelper = await ethers.getContract('ElevationHelper')

    const elevation = await getElevation(subCartographerName, subCartographer, pid)
    const roundDuration = await elevationHelper.roundDurationSeconds(elevation)
    const quarterRoundDuration = roundDuration.toNumber() / 4
    
    await rolloverRound(subCartographerName, cartographer, subCartographer, elevationHelper, pid)
    const initTimestamp = await getTimestamp()
    const round = await elevationHelper.roundNumber(elevation)
    const prevRound = round - 1

    const prevwinningTotem = await elevationHelper.winningTotem(elevation, prevRound)
    const winningUser = prevwinningTotem === 0 ? user1 : user3
    const [availRewards0, vestingRewards0, vestingStart0, vestingDur0] = await cartographer.rewards(pid, winningUser.address)

    consoleLog({
      PERC_THROUGH_ROUND: `${((roundDuration.toNumber() - vestingDur0.toNumber()) * 100) / roundDuration.toNumber()}%`,
      harvestableRewards: toDecimal(availRewards0),
      vestingRewards: toDecimal(vestingRewards0),
      vestingDurationSeconds: vestingDur0.toString(),
      timestamp: await getTimestamp(),
      quarterRoundDuration,
    })

    await increaseTimestampAndMine(quarterRoundDuration)

    const [availRewards1, vestingRewards1, vestingStart1, vestingDur1] = await cartographer.rewards(pid, winningUser.address)


    consoleLog({
      PERC_THROUGH_ROUND: `${((roundDuration.toNumber() - vestingDur1.toNumber()) * 100) / roundDuration.toNumber()}%`,
      harvestableRewards: toDecimal(availRewards1),
      vestingRewards: toDecimal(vestingRewards1),
      vestingDurationSeconds: vestingDur1.toString(),
      timestamp: await getTimestamp(),
    })

    expectBigNumberGreaterThan(availRewards1, availRewards0)
    expectBigNumberLessThan(vestingRewards1, vestingRewards0)


    await increaseTimestampAndMine(quarterRoundDuration)

    const [availRewards2, vestingRewards2, vestingStart2, vestingDur2] = await cartographer.rewards(pid, winningUser.address)

    consoleLog({
      PERC_THROUGH_ROUND: `${((roundDuration.toNumber() - vestingDur2.toNumber()) * 100) / roundDuration.toNumber()}%`,
      harvestableRewards: toDecimal(availRewards2),
      vestingRewards: toDecimal(vestingRewards2),
      vestingDurationSeconds: vestingDur2.toString(),
      timestamp: await getTimestamp(),
    })

    expectBigNumberGreaterThan(availRewards2, availRewards1)
    expectBigNumberLessThan(vestingRewards2, vestingRewards1)

    
    await increaseTimestampAndMine(quarterRoundDuration)

    const [availRewards3, vestingRewards3, vestingStart3, vestingDur3] = await cartographer.rewards(pid, winningUser.address)

    consoleLog({
      PERC_THROUGH_ROUND: `${((roundDuration.toNumber() - vestingDur3.toNumber()) * 100) / roundDuration.toNumber()}%`,
      harvestableRewards: toDecimal(availRewards3),
      vestingRewards: toDecimal(vestingRewards3),
      vestingDurationSeconds: vestingDur3.toString(),
      timestamp: await getTimestamp(),
    })

    expectBigNumberGreaterThan(availRewards3, availRewards2)
    expectBigNumberLessThan(vestingRewards3, vestingRewards2)


    await increaseTimestampAndMine(quarterRoundDuration)

    const [availRewards4, vestingRewards4, vestingStart4, vestingDur4] = await cartographer.rewards(pid, winningUser.address)

    consoleLog({
      PERC_THROUGH_ROUND: `${((roundDuration.toNumber() - vestingDur4.toNumber()) * 100) / roundDuration.toNumber()}%`,
      harvestableRewards: toDecimal(availRewards4),
      vestingRewards: toDecimal(vestingRewards4),
      vestingDurationSeconds: vestingDur4.toString(),
      timestamp: await getTimestamp(),
    })

    expectBigNumberGreaterThan(availRewards4, availRewards3)
    expectBigNumberLessThan(vestingRewards4, vestingRewards3)
  })
}
const winningsMatchHypotheticalWinnings = (subCartographerName: string, pid: number) => {
  it('WINNINGS: Winnings match hypothetical winnings before round end', async function() {
    const { user1, user2, user3 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')
    const subCartographer = await ethers.getContract(subCartographerName)
    const elevationHelper = await ethers.getContract('ElevationHelper')

    const elevation = await getElevation(subCartographerName, subCartographer, pid)
    
    await subCartographer.updatePool(pid)

    const user1HypotheticalWinningsInit = (await cartographer.hypotheticalRewards(pid, user1.address))[1]
    const user2HypotheticalWinningsInit = (await cartographer.hypotheticalRewards(pid, user2.address))[1]
    const user3HypotheticalWinningsInit = (await cartographer.hypotheticalRewards(pid, user3.address))[1]

    await subCartographer.updatePool(pid)

    const timestampBegin = await getTimestamp()

    const user1HypotheticalWinningsFinal = (await cartographer.hypotheticalRewards(pid, user1.address))[1]
    const user2HypotheticalWinningsFinal = (await cartographer.hypotheticalRewards(pid, user2.address))[1]
    const user3HypotheticalWinningsFinal = (await cartographer.hypotheticalRewards(pid, user3.address))[1]

    const user1HypotheticalWinningsDelta = user1HypotheticalWinningsFinal.sub(user1HypotheticalWinningsInit)
    const user2HypotheticalWinningsDelta = user2HypotheticalWinningsFinal.sub(user2HypotheticalWinningsInit)
    const user3HypotheticalWinningsDelta = user3HypotheticalWinningsFinal.sub(user3HypotheticalWinningsInit)

    const [user1AvailRewardsInit, user1VestingRewardsInit] = await cartographer.rewards(pid, user1.address)
    const [user2AvailRewardsInit, user2VestingRewardsInit] = await cartographer.rewards(pid, user2.address)
    const [user3AvailRewardsInit, user3VestingRewardsInit] = await cartographer.rewards(pid, user3.address)

    await rolloverRound(subCartographerName, cartographer, subCartographer, elevationHelper, pid)
    const round = await elevationHelper.roundNumber(elevation)
    const prevRound = round - 1
    const prevwinningTotem = await elevationHelper.winningTotem(elevation, prevRound)

    const [user1AvailRewardsFinal, user1VestingRewardsFinal] = await cartographer.rewards(pid, user1.address)
    const [user2AvailRewardsFinal, user2VestingRewardsFinal] = await cartographer.rewards(pid, user2.address)
    const [user3AvailRewardsFinal, user3VestingRewardsFinal] = await cartographer.rewards(pid, user3.address)

    const user1TotalRewardsDelta = user1AvailRewardsFinal.add(user1VestingRewardsFinal).sub(user1AvailRewardsInit).sub(user1VestingRewardsInit)
    const user2TotalRewardsDelta = user2AvailRewardsFinal.add(user2VestingRewardsFinal).sub(user2AvailRewardsInit).sub(user2VestingRewardsInit)
    const user3TotalRewardsDelta = user3AvailRewardsFinal.add(user3VestingRewardsFinal).sub(user3AvailRewardsInit).sub(user3VestingRewardsInit)

    const timestampEnd = await getTimestamp()
    const timestampDelta = timestampEnd - timestampBegin

    if (prevwinningTotem == 0) {
      expect6FigBigNumberEquals(user1TotalRewardsDelta, user1HypotheticalWinningsFinal.add(user1HypotheticalWinningsDelta.mul(timestampDelta)))
      expect6FigBigNumberEquals(user2TotalRewardsDelta, user2HypotheticalWinningsFinal.add(user2HypotheticalWinningsDelta.mul(timestampDelta)))
    } else {
      expect6FigBigNumberEquals(user3TotalRewardsDelta, user3HypotheticalWinningsFinal.add(user3HypotheticalWinningsDelta.mul(timestampDelta)))
    }
  })
}
const withdrawingVestedWinningsRevestsRemaining = (subCartographerName: string, pid: number) => {
  it('VESTING: Withdrawing partially vesting winnings re-vests remaining', async function() {
    const { user1, user3 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')
    const subCartographer = await ethers.getContract(subCartographerName)
    const elevationHelper = await ethers.getContract('ElevationHelper')
    const summitToken = await ethers.getContract('SummitToken')

    const elevation = await getElevation(subCartographerName, subCartographer, pid)
    const round = await elevationHelper.roundNumber(elevation)
    const prevRound = round - 1
    const winningTotem = await elevationHelper.winningTotem(elevation, prevRound)
    const roundDuration = await elevationHelper.roundDurationSeconds(elevation)
    const quarterRoundDuration = roundDuration.div('4').toNumber()

    await increaseTimestampAndMine(quarterRoundDuration)
    await subCartographer.updatePool(pid)

    const winningUser = winningTotem === 0 ? user1 : user3

    const [avail0] = await cartographer.rewards(pid, winningUser.address)
    await subCartographer.updatePool(pid)
    const [availInit, vestingInit, vestingStartInit, vestingDurInit] = await cartographer.rewards(pid, winningUser.address)
    const availBlockDelta = availInit.sub(avail0);
    const balanceInit = await summitToken.balanceOf(winningUser.address)
    
    await cartographer.connect(winningUser).deposit(pid, 0, 0, winningTotem)
    
    const [availFinal, vestingFinal, vestingStartFinal, vestingDurFinal] = await cartographer.rewards(pid, winningUser.address)
    const balanceFinal = await summitToken.balanceOf(winningUser.address)

    expect6FigBigNumberEquals(balanceFinal.sub(balanceInit), availInit.add(availBlockDelta))
    expect(availFinal).to.equal(0)
    expect6FigBigNumberEquals(vestingInit.sub(vestingFinal), vestingInit.div(vestingDurInit))
  })
  it('VESTING: Re-vested winnings increase over duration of vesting', async function() {
    const { user1, user3 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')
    const subCartographer = await ethers.getContract(subCartographerName)
    const elevationHelper = await ethers.getContract('ElevationHelper')
    const summitToken = await ethers.getContract('SummitToken')

    await rolloverRound(subCartographerName, cartographer, subCartographer, elevationHelper, pid)

    const elevation = await getElevation(subCartographerName, subCartographer, pid)
    const round = await elevationHelper.roundNumber(elevation)
    const prevRound = round - 1
    const winningTotem = await elevationHelper.winningTotem(elevation, prevRound)
    const roundStart = await elevationHelper.currentRoundStartTime(elevation)

    const winningUser = winningTotem === 0 ? user1 : user3

    await subCartographer.updatePool(pid)
    const [avail0, vesting0, vestingStart0, vestingDur0] = await cartographer.rewards(pid, winningUser.address)
    const totalAmount0 = avail0.add(vesting0)
    const vestAmtToDurRatio0 = vesting0.div(vestingDur0)

    const quarterVestingDuration = vestingDur0.div(4).toNumber() + 1

    await increaseTimestampAndMine(quarterVestingDuration)
    await subCartographer.updatePool(pid)

    const [avail1, vesting1, vestingStart1, vestingDur1] = await cartographer.rewards(pid, winningUser.address)
    expect(vestingStart0).to.equal(vestingStart1)

    const totalAmount1 = avail1.add(vesting1)
    const vestAmtToDurRatio1 = vesting1.div(vestingDur1)

    await increaseTimestampAndMine(quarterVestingDuration)
    await subCartographer.updatePool(pid)

    const [avail2, vesting2, vestingStart2, vestingDur2] = await cartographer.rewards(pid, winningUser.address)
    const totalAmount2 = avail2.add(vesting2)
    const vestAmtToDurRatio2 = vesting2.div(vestingDur2)

    await increaseTimestampAndMine(quarterVestingDuration)
    await subCartographer.updatePool(pid)

    const [avail3, vesting3, vestingStart3, vestingDur3] = await cartographer.rewards(pid, winningUser.address)
    const totalAmount3 = avail3.add(vesting3)
    const vestAmtToDurRatio3 = vesting3.div(vestingDur3)

    await increaseTimestampAndMine(quarterVestingDuration)
    await subCartographer.updatePool(pid)

    const [avail4, vesting4, vestingStart4, vestingDur4] = await cartographer.rewards(pid, winningUser.address)
    expect(vestingStart4).to.equal(roundStart)

    await rolloverRound(subCartographerName, cartographer, subCartographer, elevationHelper, pid)

    const [avail5, vesting5, vestingStart5, vestingDur5] = await cartographer.rewards(pid, winningUser.address)
    const oneBlockVestAmount = vestingDur5.gt(0) ? vesting5.div(vestingDur5) : vestingDur5
    const totalAmount4 = avail4.add(vesting4)

    consoleLog({
      totalAmount0: toDecimal(totalAmount0),
      totalAmount1: toDecimal(totalAmount1),
      totalAmount2: toDecimal(totalAmount2),
      totalAmount3: toDecimal(totalAmount3),
      totalAmount4: toDecimal(totalAmount4),
      avail4: toDecimal(avail4),
      vesting4: toDecimal(vesting4),
    })

    expect6FigBigNumberAllEqual([totalAmount0, totalAmount1, totalAmount2, totalAmount3, totalAmount4, avail4])
    expect6FigBigNumberAllEqual([vestAmtToDurRatio0, vestAmtToDurRatio1, vestAmtToDurRatio2, vestAmtToDurRatio3])

    const balanceInit = await summitToken.balanceOf(winningUser.address)
    
    await cartographer.connect(winningUser).deposit(pid, 0, 0, winningTotem)
    
    const balanceFinal = await summitToken.balanceOf(winningUser.address)
    expect6FigBigNumberEquals(balanceFinal.sub(balanceInit), avail5.add(oneBlockVestAmount))
  })
}
const winningsVestAndAccumulateOverMultipleRounds = (subCartographerName: string, pid: number) => {
  it('VESTING: Vest and accumulate over multiple rounds', async function() {
    const { user1, user3 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')
    const subCartographer = await ethers.getContract(subCartographerName)
    const elevationHelper = await ethers.getContract('ElevationHelper')

    const elevation = await getElevation(subCartographerName, subCartographer, pid)
    await rolloverRound(subCartographerName, cartographer, subCartographer, elevationHelper, pid)
    const round = await elevationHelper.roundNumber(elevation)
    const prevRound = round - 1

    const prevwinningTotem = await elevationHelper.winningTotem(elevation, prevRound)
    const winningUser = prevwinningTotem === 0 ? user1 : user3
    const [availRewards0, vestingRewards0, vestingDur0] = await cartographer.rewards(pid, winningUser.address)

    await mineBlock()

    const [availRewards1, vestingRewards1, vestingDur1] = await cartographer.rewards(pid, winningUser.address)
    consoleLog({
      availRewards: `${toDecimal(availRewards0)} --> ${toDecimal(availRewards1)}`,
      vestingRewards: `${toDecimal(vestingRewards0)} --> ${toDecimal(vestingRewards1)}`,
    })
    expectBigNumberGreaterThan(availRewards1, availRewards0)
    expectBigNumberLessThan(vestingRewards1, vestingRewards0)
    expect6FigBigNumberEquals(availRewards0.add(vestingRewards0), availRewards1.add(vestingRewards1))

    await rolloverRoundUntilWinningTotem(subCartographerName, cartographer, subCartographer, elevationHelper, pid, prevwinningTotem)

    await mineBlock()
    const [availRewards2, vestingRewards2, vestingDur2] = await cartographer.rewards(pid, winningUser.address)
    await mineBlock()
    const [availRewards3, vestingRewards3, vestingDur3] = await cartographer.rewards(pid, winningUser.address)
    consoleLog({
      availRewards: `${toDecimal(availRewards2)} --> ${toDecimal(availRewards3)}`,
      vestingRewards: `${toDecimal(vestingRewards2)} --> ${toDecimal(vestingRewards3)}`,
    })
    expectBigNumberGreaterThan(availRewards3, availRewards2)
    expectBigNumberLessThan(vestingRewards3, vestingRewards2)
    expect6FigBigNumberEquals(availRewards2.add(vestingRewards2), availRewards3.add(vestingRewards3))

    await rolloverRoundUntilWinningTotem(subCartographerName, cartographer, subCartographer, elevationHelper, pid, prevwinningTotem)

    await mineBlock()
    const [availRewards4, vestingRewards4, vestingDur4] = await cartographer.rewards(pid, winningUser.address)
    await mineBlock()
    const [availRewards5, vestingRewards5, vestingDur5] = await cartographer.rewards(pid, winningUser.address)
    expectBigNumberGreaterThan(availRewards5, availRewards4)
    expectBigNumberLessThan(vestingRewards5, vestingRewards4)
    expect6FigBigNumberEquals(availRewards4.add(vestingRewards4), availRewards5.add(vestingRewards5))

    await rolloverRoundUntilLosingTotem(subCartographerName, cartographer, subCartographer, elevationHelper, pid, prevwinningTotem)

    const [availRewards6, vestingRewards6, vestingDur6] = await cartographer.rewards(pid, winningUser.address)
    expect(vestingRewards6).to.equal(0)

    await expect(
      cartographer.connect(winningUser).deposit(pid, 0, 0, prevwinningTotem)
    ).to.emit(cartographer, EVENT.RedeemRewards).withArgs(winningUser.address, availRewards6)
    
    const [availRewards7, vestingRewards7, vestingDur7] = await cartographer.rewards(pid, winningUser.address)
    consoleLog({
      availRewards6: toDecimal(availRewards6),
      vestingRewards6: toDecimal(vestingRewards6),
      availRewards7: toDecimal(availRewards7),
      vestingRewards7: toDecimal(vestingRewards7),
    })
    expect(availRewards7).to.equal(0)
    expect(vestingRewards7).to.equal(0)
  })
}

const rolloverMultipleRounds = (subCartographerName: string, pid: number) => {
  it('ROLLOVER: Rolling over multiple rounds yields correct rewards', async function() {
    const { user1, user3 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')
    const subCartographer = await ethers.getContract(subCartographerName)
    const elevationHelper = await ethers.getContract('ElevationHelper')

    const elevation = await getElevation(subCartographerName, subCartographer, pid)
    await rolloverRound(subCartographerName, cartographer, subCartographer, elevationHelper, pid)


    // DETERMINE FULL ROUND ROLLOVER BASELINE
    let totem0baselineSet = false
    let totem1baselineSet = false

    let user1BaselineAvailRewardsInit
    let user1BaselineVestingRewardsInit
    let user3BaselineAvailRewardsInit
    let user3BaselineVestingRewardsInit

    let user1BaselineWinDelta
    let user3BaselineWinDelta

    while (!totem1baselineSet || !totem0baselineSet) {
      if (!totem0baselineSet) {
        const user1Init = await cartographer.rewards(pid, user1.address)
        user1BaselineAvailRewardsInit = user1Init[0]
        user1BaselineVestingRewardsInit = user1Init[1]
      }

      if (!totem1baselineSet) {
        const user3Init = await cartographer.rewards(pid, user3.address)
        user3BaselineAvailRewardsInit = user3Init[0]
        user3BaselineVestingRewardsInit = user3Init[1]
      }

      await rolloverRound(subCartographerName, cartographer, subCartographer, elevationHelper, pid)
      const roundInc = await elevationHelper.roundNumber(elevation)
      const winningTotem = await elevationHelper.winningTotem(elevation, roundInc - 1)

      if (!totem0baselineSet && winningTotem === 0) {
        const [user1BaselineAvailRewardsMid, user1BaselineVestingRewardsMid] = await cartographer.rewards(pid, user1.address)
        user1BaselineWinDelta = user1BaselineAvailRewardsMid.add(user1BaselineVestingRewardsMid).sub(user1BaselineAvailRewardsInit).sub(user1BaselineVestingRewardsInit)
        totem0baselineSet = true
      }
      if (!totem1baselineSet && winningTotem === 1) {
        const [user3BaselineAvailRewardsMid, user3BaselineVestingRewardsMid] = await cartographer.rewards(pid, user3.address)
        user3BaselineWinDelta = user3BaselineAvailRewardsMid.add(user3BaselineVestingRewardsMid).sub(user3BaselineAvailRewardsInit).sub(user3BaselineVestingRewardsInit)
        totem1baselineSet = true
      }
    }

    // MULTI ROUND ROLLOVER
    await rolloverRound(subCartographerName, cartographer, subCartographer, elevationHelper, pid)

    const [user1AvailRewardsInit, user1VestingRewardsInit] = await cartographer.rewards(pid, user1.address)
    const [user3AvailRewardsInit, user3VestingRewardsInit] = await cartographer.rewards(pid, user3.address)

    const nextRoundTime = (await elevationHelper.roundEndTimestamp(elevation)).toNumber()
    const roundDuration = (await elevationHelper.roundDurationSeconds(elevation)).toNumber()
    await mineBlockWithTimestamp(nextRoundTime + (roundDuration * 4))
    await cartographer.rollover(elevation)

    await subCartographer.updatePool(pid)
    
    const [user1AvailRewardsFinal, user1VestingRewardsFinal, user1VestingDurFinal] = await cartographer.rewards(pid, user1.address)
    const [user3AvailRewardsFinal, user3VestingRewardsFinal, user3VestingDurFinal] = await cartographer.rewards(pid, user3.address)

    const user1MultiRoundDelta = user1AvailRewardsFinal.add(user1VestingRewardsFinal).sub(user1AvailRewardsInit).sub(user1VestingRewardsInit)
    const user3MultiRoundDelta = user3AvailRewardsFinal.add(user3VestingRewardsFinal).sub(user3AvailRewardsInit).sub(user3VestingRewardsInit)

    const round = await elevationHelper.roundNumber(elevation)
    const prevwinningTotem = await elevationHelper.winningTotem(elevation, round - 1)

    consoleLog({
      prevwinningTotem,
      user1WinDelta: toDecimal(user1BaselineWinDelta),
      user3WinDelta: toDecimal(user3BaselineWinDelta),
      user1MultiRoundDelta: toDecimal(user1MultiRoundDelta),
      user3MultiRoundDelta: toDecimal(user3MultiRoundDelta),
      user1Mult: user1BaselineWinDelta.eq(0) ? 'null' : user1MultiRoundDelta.mul('100000').div(user1BaselineWinDelta).toString(),
      user3Mult: user3BaselineWinDelta.eq(0) ? 'null' : user3MultiRoundDelta.mul('100000').div(user3BaselineWinDelta).toString(),
      user1AvailRewards: `${toDecimal(user1AvailRewardsInit)} --> ${toDecimal(user1AvailRewardsFinal)}`,
      user1VestingRewards: `${toDecimal(user1VestingRewardsInit)} --> ${toDecimal(user1VestingRewardsFinal)}`,
      user3AvailRewards: `${toDecimal(user3AvailRewardsInit)} --> ${toDecimal(user3AvailRewardsFinal)}`,
      user3VestingRewards: `${toDecimal(user3VestingRewardsInit)} --> ${toDecimal(user3VestingRewardsFinal)}`,
    })

    if (prevwinningTotem === 0) {
      expect6FigBigNumberEquals(user1MultiRoundDelta.mul(e18(1)).div(user1BaselineWinDelta), e18(5))
    } else {
      expect6FigBigNumberEquals(user3MultiRoundDelta.mul(e18(1)).div(user3BaselineWinDelta), e18(5))
    }
  })
}

const correctWinnersHistoricalData = (subCartographerName: string, pid: number) => {
  it('HISTORICAL DATA: Single-rollovers update historical data correctly', async function() {
    const cartographer = await ethers.getContract('Cartographer')
    const subCartographer = await ethers.getContract(subCartographerName)
    const elevationHelper = await ethers.getContract('ElevationHelper')

    const elevation = await getElevation(subCartographerName, subCartographer, pid)

    let round
    const [poolWinCountersInit, historicalWinnersInit] = await getHistoricalTotemStats(elevationHelper, elevation)

    await rolloverRound(subCartographerName, cartographer, subCartographer, elevationHelper, pid)
    const [poolWinCounters1, historicalWinners1] = await getHistoricalTotemStats(elevationHelper, elevation)
    round = await elevationHelper.roundNumber(elevation)
    const round1WinningTotem = await elevationHelper.winningTotem(elevation, round - 1)
    expect(poolWinCountersInit[round1WinningTotem].add(1)).to.equal(poolWinCounters1[round1WinningTotem])
    expectBigNumberArraysEqual(historicalWinners1, [round1WinningTotem, ...historicalWinnersInit.slice(0, 9)])
    
    await rolloverRound(subCartographerName, cartographer, subCartographer, elevationHelper, pid)
    const [poolWinCounters2, historicalWinners2] = await getHistoricalTotemStats(elevationHelper, elevation)
    round = await elevationHelper.roundNumber(elevation)
    const round2WinningTotem = await elevationHelper.winningTotem(elevation, round - 1)
    expect(poolWinCounters1[round2WinningTotem].add(1)).to.equal(poolWinCounters2[round2WinningTotem])
    expectBigNumberArraysEqual(historicalWinners2, [round2WinningTotem, round1WinningTotem, ...historicalWinnersInit.slice(0, 8)])
    
    await rolloverRound(subCartographerName, cartographer, subCartographer, elevationHelper, pid)
    const [poolWinCounters3, historicalWinners3] = await getHistoricalTotemStats(elevationHelper, elevation)
    round = await elevationHelper.roundNumber(elevation)
    const round3WinningTotem = await elevationHelper.winningTotem(elevation, round - 1)
    expect(poolWinCounters2[round3WinningTotem].add(1)).to.equal(poolWinCounters3[round3WinningTotem])
    expectBigNumberArraysEqual(historicalWinners3, [round3WinningTotem, round2WinningTotem, round1WinningTotem, ...historicalWinnersInit.slice(0, 7)])
    
    await rolloverRound(subCartographerName, cartographer, subCartographer, elevationHelper, pid)
    const [poolWinCounters4, historicalWinners4] = await getHistoricalTotemStats(elevationHelper, elevation)
    round = await elevationHelper.roundNumber(elevation)
    const round4WinningTotem = await elevationHelper.winningTotem(elevation, round - 1)
    expect(poolWinCounters3[round4WinningTotem].add(1)).to.equal(poolWinCounters4[round4WinningTotem])
    expectBigNumberArraysEqual(historicalWinners4, [round4WinningTotem, round3WinningTotem, round2WinningTotem, round1WinningTotem, ...historicalWinnersInit.slice(0, 6)])
    
    await rolloverRound(subCartographerName, cartographer, subCartographer, elevationHelper, pid)
    const [poolWinCounters5, historicalWinners5] = await getHistoricalTotemStats(elevationHelper, elevation)
    round = await elevationHelper.roundNumber(elevation)
    const round5WinningTotem = await elevationHelper.winningTotem(elevation, round - 1)
    expect(poolWinCounters4[round5WinningTotem].add(1)).to.equal(poolWinCounters5[round5WinningTotem])
    expectBigNumberArraysEqual(historicalWinners5, [round5WinningTotem, round4WinningTotem, round3WinningTotem, round2WinningTotem, round1WinningTotem, ...historicalWinnersInit.slice(0, 5)])

    consoleLog({
      poolWinCountersInit: stringifyBigNumberArray(poolWinCountersInit),
      poolWinCounters1: stringifyBigNumberArray(poolWinCounters1),
      poolWinCounters2: stringifyBigNumberArray(poolWinCounters2),
      poolWinCounters3: stringifyBigNumberArray(poolWinCounters3),
      poolWinCounters4: stringifyBigNumberArray(poolWinCounters4),
      poolWinCounters5: stringifyBigNumberArray(poolWinCounters5),
      historicalWinnersInit: stringifyBigNumberArray(historicalWinnersInit),
      historicalWinners1: stringifyBigNumberArray(historicalWinners1),
      historicalWinners2: stringifyBigNumberArray(historicalWinners2),
      historicalWinners3: stringifyBigNumberArray(historicalWinners3),
      historicalWinners4: stringifyBigNumberArray(historicalWinners4),
      historicalWinners5: stringifyBigNumberArray(historicalWinners5),
    })

    expect(true).to.be.true
  })
  it('HISTORICAL DATA: Multi-rollover updates historical data correctly', async function() {
    const cartographer = await ethers.getContract('Cartographer')
    const subCartographer = await ethers.getContract(subCartographerName)
    const elevationHelper = await ethers.getContract('ElevationHelper')

    const elevation = await getElevation(subCartographerName, subCartographer, pid)
    await rolloverRound(subCartographerName, cartographer, subCartographer, elevationHelper, pid)

    const [poolWinCountersInit] = await getHistoricalTotemStats(elevationHelper, elevation)

    const nextRoundTime = (await elevationHelper.roundEndTimestamp(elevation)).toNumber()
    const roundDuration = (await elevationHelper.roundDurationSeconds(elevation)).toNumber()

    await mineBlockWithTimestamp(nextRoundTime + (roundDuration * 2))
    await rolloverRound(subCartographerName, cartographer, subCartographer, elevationHelper, pid)

    const [poolWinCountersFinal] = await getHistoricalTotemStats(elevationHelper, elevation)

    const winsInit = poolWinCountersInit.reduce((accum: BigNumber, wins: BigNumber) => wins.add(accum), BigNumber.from('0'))
    const winsFinal = poolWinCountersFinal.reduce((accum: BigNumber, wins: BigNumber) => wins.add(accum), BigNumber.from('0'))
    
    expect(winsFinal.sub(winsInit)).to.equal(1)
  })
}

// TOTEMS
const switchingTotems = (subCartographerName: string, rewardTokenName: string, pid: number, elevation: number) => {
  it(`TOTEMS: Switching to invalid totem should fail with error ${ERR.INVALID_TOTEM}`, async function() {
    const { user1 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')
    
    await expect(
      cartographer.connect(user1).switchTotem(elevation, TOTEM_COUNT[elevation])
    ).to.be.revertedWith(ERR.INVALID_TOTEM)
  })
  it('TOTEMS: Users should be able to switch to valid totems', async function() {
    const { user1 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')
    const subCartographer = await ethers.getContract(subCartographerName)
    const rewardToken = await ethers.getContract(rewardTokenName)
    const elevationHelper = await ethers.getContract('ElevationHelper')

    const targetTotem = TOTEM_COUNT[elevation] - 1

    await rolloverRoundUntilWinningTotem(subCartographerName, cartographer, subCartographer, elevationHelper, pid, 0)
    await mineBlocks(10)
    
    const [availRewardsPre0] = await cartographer.rewards(pid, user1.address)
    await subCartographer.updatePool(pid)
    
    let runningUserInfo =  await subCartographer.connect(user1).userInfo(pid, user1.address)
    const user1Totem0 = await getUserTotem(subCartographer, elevation, user1)
    const user1Staked0 = runningUserInfo.staked
    const user1Summit0 = await rewardToken.balanceOf(user1.address)
    const poolLpSupply0 = await cartographer.stakedSupply(pid)
    const [roundRewards0, ...totemRewards0] = await subCartographer.totemRoundRewards(pid)
    const totem0LpSupply0 = (await subCartographer.totemSupplies(pid))[0]
    const totemTargetLpSupply0 = (await subCartographer.totemSupplies(pid))[targetTotem]

    const [availRewards0] = await cartographer.rewards(pid, user1.address)
    const singleBlockRewardDelta = availRewards0.sub(availRewardsPre0)
    
    expect(user1Totem0).to.equal(0)
    
    // SWITCH TOTEM FROM 0 --> TARGET TOTEM
    await cartographer.connect(user1).switchTotem(elevation, targetTotem)
    
    runningUserInfo =  await subCartographer.connect(user1).userInfo(pid, user1.address)
    const user1Totem1 = await getUserTotem(subCartographer, elevation, user1)
    const user1Staked1 = runningUserInfo.staked
    const user1Summit1 = await rewardToken.balanceOf(user1.address)
    const poolLpSupply1 = await cartographer.stakedSupply(pid)
    let [roundRewards1, ...totemRewards1] = await subCartographer.totemRoundRewards(pid)
    const totem0LpSupply1 = (await subCartographer.totemSupplies(pid))[0]
    const totemTargetLpSupply1 = (await subCartographer.totemSupplies(pid))[targetTotem]

    expect6FigBigNumberEquals(user1Summit1.sub(user1Summit0), availRewards0.add(singleBlockRewardDelta))
    expect(user1Totem1).to.equal(targetTotem)

    expect(user1Staked1).to.equal(user1Staked0)
    expect(poolLpSupply1).to.equal(poolLpSupply0)
    expect(totem0LpSupply0.sub(totem0LpSupply1)).to.equal(user1Staked0)
    expect(totemTargetLpSupply1.sub(totemTargetLpSupply0)).to.equal(user1Staked0)

    expect6FigBigNumberEquals(totemRewards1[0].sub(totemRewards0[0]).sub(totemRewards0[1].sub(totemRewards1[1])), roundRewards1.sub(roundRewards0))

    const [availRewardsPre1] = await cartographer.rewards(pid, user1.address)
    await subCartographer.updatePool(pid)
    const [availRewards1] = await cartographer.rewards(pid, user1.address)
    const singleBlockRewardDelta1 = availRewards1.sub(availRewardsPre1)

    const [roundRewards1B, ...totemRewards1B] = await subCartographer.totemRoundRewards(pid)
    
    // SWITCH BACK FROM TARGET TOTEM --> 0
    await cartographer.connect(user1).switchTotem(elevation, 0)
  
    runningUserInfo =  await subCartographer.connect(user1).userInfo(pid, user1.address)
    const user1Totem2 = await getUserTotem(subCartographer, elevation, user1)
    const user1Staked2 = runningUserInfo.staked
    const user1Summit2 = await rewardToken.balanceOf(user1.address)
    const poolLpSupply2 = await cartographer.stakedSupply(pid)
    const [roundRewards2, ...totemRewards2] = await subCartographer.totemRoundRewards(pid)
    const totem0LpSupply2 = (await subCartographer.totemSupplies(pid))[0]
    const totemTargetLpSupply2 = (await subCartographer.totemSupplies(pid))[targetTotem]

    expect6FigBigNumberEquals(user1Summit2.sub(user1Summit1), availRewards1.add(singleBlockRewardDelta1))
    expect(user1Totem2).to.equal(0)

    expect(user1Staked2).to.equal(user1Staked1)
    expect(poolLpSupply2).to.equal(poolLpSupply1)
    expect(totem0LpSupply2.sub(totem0LpSupply1)).to.equal(user1Staked0)
    expect(totemTargetLpSupply1.sub(totemTargetLpSupply2)).to.equal(user1Staked0)
    
    expect(totem0LpSupply2).to.equal(totem0LpSupply0)
    expect(totemTargetLpSupply2).to.equal(totemTargetLpSupply0)

    expect6FigBigNumberEquals(totemRewards2[1].sub(totemRewards1B[1]).sub(totemRewards1B[0].sub(totemRewards2[0])), roundRewards2.sub(roundRewards1B))
  })
}

export const elevationTests = {
  standardDepositShouldSucceed,
  depositShouldUpdatePoolAndTotemInfo,

  validTotemDepositShouldSucceed,
  invalidTotemDepositShouldFail,
  depositToDifferentTotemShouldFail,

  elevationPoolRewardsShouldIncreaseEachBlock,

  vestedWinningsIncreaseOverDurationOfRound,
  winningsMatchHypotheticalWinnings,
  withdrawingVestedWinningsRevestsRemaining,
  winningsVestAndAccumulateOverMultipleRounds,

  rolloverMultipleRounds,

  correctWinnersHistoricalData,

  switchingTotems,


  initialTotemInUseShouldBeFalse,
  totemInUseShouldUpdateOnDeposit,
  totemInUseShouldPreventIncorrectPondDeposit,
  withdrawToZeroShouldUpdateTotemInUse,
}