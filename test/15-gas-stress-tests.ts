import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre from "hardhat";
import { ERR, e18, rolloverRoundUntilWinningTotem, toDecimal, rolloverRound, deltaBN, expect6FigBigNumberAllEqual, promiseSequenceMap, rolloverRoundUntilLosingTotem, consoleLog, cartographerMethod, SUMMIT, cartographerGet, tokenPromiseSequenceMap, subCartGet, getContract, getCartographer, getCakeToken, getSummitToken, sumBigNumbers, getUserTotems, userPromiseSequenceMap } from "../utils";
import { summitLockingGet } from "../utils/summitLockingUtils";
import { plainsUnlockedFixture } from "./fixtures";


describe("GAS STRESS TESTS", function() {
  before(async function() {
    await plainsUnlockedFixture()
    const userTotems = await getUserTotems()

    await userPromiseSequenceMap(
      async (user) => await cartographerMethod.switchTotem({
        user,
        elevation: SUMMIT,
        totem: userTotems[user.address]
      })
    )
  })
  it(`GAS STRESS POOLS: Elevations will allow up to 24 active pools`, async function () {
    const { dev, user1, user2, user3 } = await getNamedSigners(hre)

    const poolsCount = await cartographerGet.poolsCount()

    const summitActivePoolsCount = await subCartGet.getActivePoolsCount(SUMMIT)

    const activePoolCap = 24

    let gasStressTokenIds = [];
    for (let i = 0; i < activePoolCap - summitActivePoolsCount; i++) {
        gasStressTokenIds.push(i);
    }

    const gasStressTokenInfo = await promiseSequenceMap(
        gasStressTokenIds,
        async (tokenId, tokenIndex) => ({
            name: `GS${tokenId}`,
            token: await getContract(`GS${tokenId}`),
            user: tokenId < 12 - summitActivePoolsCount ? user1 : tokenId < 24 - summitActivePoolsCount ? user2 : user3,
            pid: tokenIndex + poolsCount,
        })
    )
      
    // Create Gas Stress Pools
    await promiseSequenceMap(
        Object.values(gasStressTokenInfo),
        async (tokenInfo) => {
          await cartographerMethod.createTokenAllocation({
            dev,
            tokenAddress: tokenInfo.token.address,
            allocation: 100
          })
          await cartographerMethod.add({
            dev,
            tokenAddress: tokenInfo.token.address,
            elevation: SUMMIT,
            live: true,
            withUpdate: true,
          })
        }
    )

    // Launch Pools by rollover
    await rolloverRound(SUMMIT)

    // Deposit in original existing pools
    await tokenPromiseSequenceMap(
      async (token) => cartographerMethod.deposit({
        user: user1,
        tokenAddress: token.address,
        elevation: SUMMIT,
        amount: e18(5),
      })
    )
      
    // Deposit in new gas stress test pools
    await promiseSequenceMap(
        gasStressTokenInfo,
        async (tokenInfo) => {
          await tokenInfo.token.connect(tokenInfo.user).approve((await getCartographer()).address, e18(1000000))
          await cartographerMethod.deposit({
            user: tokenInfo.user,
            tokenAddress: tokenInfo.token.address,
            elevation: SUMMIT,
            amount: e18(5),
          })
        }
    )
  })



  // ACTIVE POOLS CAP TESTS
  it(`ACTIVE POOLS CAP: Attempting to add another pool should fail with error "${ERR.TOO_MANY_ACTIVE_POOLS}"`, async function() {
    const { dev } = await getNamedSigners(hre)

    const summitActivePoolsCount = await subCartGet.getActivePoolsCount(SUMMIT)
    expect(summitActivePoolsCount).to.equal(24)

    const tokenName = `GS${summitActivePoolsCount}`
    const gasStressToken = await getContract(tokenName)

    await cartographerMethod.createTokenAllocation({
      dev,
      tokenAddress: gasStressToken.address,
      allocation: 100,
    })

    await cartographerMethod.add({
      dev,
      tokenAddress: gasStressToken.address,
      elevation: SUMMIT,
      live: true,
      withUpdate: true,
      revertErr: ERR.TOO_MANY_ACTIVE_POOLS
    })
  })
  it(`ACTIVE POOLS CAP: Removing a pool should preserve active pools count until rollover, at which point it should decrement`, async function () {
    const { dev } = await getNamedSigners(hre)
    const cakeToken = await getCakeToken()

    const summitActivePoolsCountInit = await subCartGet.getActivePoolsCount(SUMMIT)
    expect(summitActivePoolsCountInit).to.equal(24)

    // Remove active pool (set not live)
    await cartographerMethod.set({
      dev,
      tokenAddress: cakeToken.address,
      elevation: SUMMIT,
      live: false,
      withUpdate: false,
    })

    const summitActivePoolsCountMid = await subCartGet.getActivePoolsCount(SUMMIT)
    expect(summitActivePoolsCountMid).to.equal(24)

    // Roll over PLAINS pools
    await rolloverRound(SUMMIT)

    const summitActivePoolsCountFinal = await subCartGet.getActivePoolsCount(SUMMIT)
    expect(summitActivePoolsCountFinal).to.equal(23)
  })
  it(`ACTIVE POOLS CAP: Setting a pool live should add it to the active pools count instantly`, async function () {
    const { dev } = await getNamedSigners(hre)
    const cakeToken = await getCakeToken()

    const summitActivePoolsCountInit = await subCartGet.getActivePoolsCount(SUMMIT)
    expect(summitActivePoolsCountInit).to.equal(23)

    // Add active pool (set live)
    await cartographerMethod.set({
      dev,
      tokenAddress: cakeToken.address,
      elevation: SUMMIT,
      live: true,
      withUpdate: false,
    })

    const summitActivePoolsCountFinal = await subCartGet.getActivePoolsCount(SUMMIT)
    expect(summitActivePoolsCountFinal).to.equal(24)
  })



  // ROLLING OVER ALL ACTIVE POOLS
  it(`ROLLOVER 24 POOLS: Rolling over all active pools should have a reasonable gas usage`, async function () {
    await rolloverRound(SUMMIT)
  })



  // USER INTERACTING POOLS STRESS TEST
  it(`INTERACTING POOLS CAP: Attempting to add another pool should fail with error "${ERR.TOO_MANY_STAKED_POOLS}"`, async function() {
    const { user1 } = await getNamedSigners(hre)

    const gasStressInfo = {
        name: 'GS20',
        token: await getContract('GS20'),
    }

    await gasStressInfo.token.connect(user1).approve((await getCartographer()).address, e18(1000000))
    await cartographerMethod.deposit({
      user: user1,
      tokenAddress: gasStressInfo.token.address,
      elevation: SUMMIT,
      amount: e18(5),
      revertErr: ERR.TOO_MANY_STAKED_POOLS
    })
  })
  it(`INTERACTING POOLS: Exiting a pool should reduce interacting pools count when there are no winnings to harvest or rewards generated in current round`, async function() {
    const { user1 } = await getNamedSigners(hre)

    const gasStressInfo = {
        name: 'GS1',
        token: await getContract('GS1'),
    }

    const userInteractingCountInit = await subCartGet.getUserInteractingPoolsCount(SUMMIT, user1.address)

    // Withdraw staked amount and harvest any winnings. Will still have some rewards generated in current round
    await cartographerMethod.withdraw({
      user: user1,
      tokenAddress: gasStressInfo.token.address,
      elevation: SUMMIT,
      amount: e18(5),
    })

    const userInteractingCountMid = await subCartGet.getUserInteractingPoolsCount(SUMMIT, user1.address)
    expect(userInteractingCountInit).to.equal(userInteractingCountMid)

    await rolloverRound(SUMMIT)

    // Harvest remaining winnings if any
    await cartographerMethod.claimSingleFarm({
      user: user1,
      tokenAddress: gasStressInfo.token.address,
      elevation: SUMMIT,
    })

    const userInteractingCountFinal = await subCartGet.getUserInteractingPoolsCount(SUMMIT, user1.address)
    expect(userInteractingCountMid - 1).to.equal(userInteractingCountFinal)

    // Re-deposit into pool for later tests
    await cartographerMethod.deposit({
      user: user1,
      tokenAddress: gasStressInfo.token.address,
      elevation: SUMMIT,
      amount: e18(5),
    })
  })

  it(`INTERACTING POOLS: Exiting a pool should reduce interacting pools count only after all winnings are harvested`, async function() {
    const { user1 } = await getNamedSigners(hre)

    const gasStressInfo = {
        name: 'GS5',
        token: await getContract('GS5'),
        pid: 14,
    }

    const userInteractingCountInit = await subCartGet.getUserInteractingPoolsCount(SUMMIT, user1.address)

    await cartographerMethod.withdraw({
      user: user1,
      tokenAddress: gasStressInfo.token.address,
      elevation: SUMMIT,
      amount: e18(5),
    })

    const userInteractingCountMid = await subCartGet.getUserInteractingPoolsCount(SUMMIT, user1.address)
    expect(userInteractingCountInit).to.equal(userInteractingCountMid)
    
    await rolloverRound(SUMMIT)

    await cartographerMethod.claimSingleFarm({
      user: user1,
      tokenAddress: gasStressInfo.token.address,
      elevation: SUMMIT,
    })

    const userInteractingCountFinal = await subCartGet.getUserInteractingPoolsCount(SUMMIT, user1.address)
    expect(userInteractingCountMid - 1).to.equal(userInteractingCountFinal)

    // Re-deposit into pool for later tests
    await cartographerMethod.deposit({
      user: user1,
      tokenAddress: gasStressInfo.token.address,
      elevation: SUMMIT,
      amount: e18(5),
    })    
  })



  // SWITCH TOTEM MAX GAS
  it(`SWITCH TOTEM: Switching totem with 12 active pools with winnings should succeed`, async function() {
    const { user1 } = await getNamedSigners(hre)

    await rolloverRoundUntilWinningTotem(SUMMIT, 0)

    await cartographerMethod.switchTotem({
      user: user1,
      elevation: SUMMIT,
      totem: 1
    })
  })



  // HARVEST ALL / CROSS COMPOUND ALL
  it(`HARVEST ALL: Harvesting all winnings from 12 active pools with winnings should succeed`, async function() {
    const { user1 } = await getNamedSigners(hre)

    // Ensure winnings on all farms, then ensure that all has vested
    await rolloverRoundUntilWinningTotem(SUMMIT, 1)
    await rolloverRoundUntilLosingTotem(SUMMIT, 1)

    // Sum total expected withdrawn winnings
    const userInteractingFarms = await subCartGet.getUserInteractingPools(SUMMIT, user1.address)

    const userInteractingFarmsClaimable = await promiseSequenceMap(
        userInteractingFarms,
        async (tokenAddress) => await subCartGet.poolClaimableRewards(tokenAddress, SUMMIT, user1.address)
    )
    const elevClaimable = await subCartGet.elevClaimableRewards(SUMMIT, user1.address)


    const totalClaimable = sumBigNumbers(userInteractingFarmsClaimable)
    const userSummitLockedInit = await summitLockingGet.getUserCurrentEpochHarvestableWinnings(user1.address)
    
    await cartographerMethod.claimElevation({
      user: user1,
      elevation: SUMMIT,
      eventOnly: true
    })

    const userSummitLockedFinal = await summitLockingGet.getUserCurrentEpochHarvestableWinnings(user1.address)
    const userSummitLockedDelta = deltaBN(userSummitLockedFinal, userSummitLockedInit)
    
    consoleLog({
        userSummitDelta: toDecimal(userSummitLockedDelta),
        totalClaimable: toDecimal(totalClaimable),
        elevClaimable: toDecimal(elevClaimable),
    })
    expect6FigBigNumberAllEqual([
      userSummitLockedDelta,
      elevClaimable,
      totalClaimable
    ])
  })
})