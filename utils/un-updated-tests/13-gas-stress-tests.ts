import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { ERR, mineBlockWithTimestamp, Contracts, getSeeds, mineBlock, mineBlocks, PID, e18, rolloverRoundUntilWinningTotem, SubCartographer, toDecimal, rolloverRound, deltaBN, expect6FigBigNumberAllEqual, promiseSequenceMap, POOL_FEE, TENTHOUSAND, EVENT, rolloverRoundUntilLosingTotem, expect6FigBigNumberEquals, consoleLog, getSubCartographerStaked } from "../utils";
import { tenThousandUnlockedFixture } from "./fixtures";


describe("GAS STRESS TESTS", function() {
  before(async function() {
    await tenThousandUnlockedFixture()
  })
  it(`GAS STRESS POOLS: Plains will allow up to 24 active pools`, async function () {
    const { user1, user2, user3 } = await getNamedSigners(hre)
    const cartographer = await getCartographer()
    const cartographerElevation = await ethers.getContract(Contracts.CartographerElevation)
    const elevationHelper = await getElevationHelper()

    const poolsCount = (await cartographer.poolsCount()).toNumber()

    const plainsActivePoolsCount = (await cartographerElevation.elevActivePoolsCount(TENTHOUSAND)).toNumber()

    const activePoolCap = 24

    let gasStressTokenIds = [];
    for (let i = (plainsActivePoolsCount + 1); i <= activePoolCap; i++) {
        gasStressTokenIds.push(i);
    }

    const gasStressTokenInfo = await promiseSequenceMap(
        gasStressTokenIds,
        async (tokenId, tokenIndex) => ({
            name: `GS${tokenId}`,
            token: await ethers.getContract(`GS${tokenId}`),
            user: tokenId <= 12 ? user1 : tokenId <= 24 ? user2 : user3,
            pid: tokenIndex + poolsCount,
        })
    )
      
    // Create Gas Stress Pools
    await promiseSequenceMap(
        Object.values(gasStressTokenInfo),
        async (tokenInfo) => {
            await cartographer.createTokenAllocation(tokenInfo.token.address, 100)
            await cartographer.add(tokenInfo.token.address, TENTHOUSAND, true, 0, true)
        }
    )

    // Launch Pools by rollover
    await rolloverRound(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, PID.SUMMIT_10K)

    // Deposit in original existing pools
    await cartographer.connect(user1).deposit(PID.SUMMIT_10K, e18(5), 0, 0)    
    await cartographer.connect(user1).deposit(PID.DUMMY_BIFI_10K, e18(5), 0, 0)    
    await cartographer.connect(user1).deposit(PID.DUMMY_CAKE_10K, e18(5), 0, 0)    
      
    // Deposit in new gas stress test pools
    await promiseSequenceMap(
        gasStressTokenInfo,
        async (tokenInfo) => {
            await tokenInfo.token.connect(tokenInfo.user).approve(cartographer.address, e18(1000000))
            await cartographer.connect(tokenInfo.user).deposit(tokenInfo.pid, e18(5), 0, 0)
        }
    )
  })



  // ACTIVE POOLS CAP TESTS
  it(`ACTIVE POOLS CAP: Attempting to add another pool should fail with error "${ERR.TOO_MANY_ACTIVE_POOLS}"`, async function() {
    const cartographer = await getCartographer()
    const cartographerElevation = await ethers.getContract(Contracts.CartographerElevation)

    const plainsActivePoolsCount = (await cartographerElevation.elevActivePoolsCount(TENTHOUSAND)).toNumber()
    expect(plainsActivePoolsCount).to.equal(24)

    const tokenName = `GS${plainsActivePoolsCount + 1}`
    const gasStressToken = await ethers.getContract(tokenName)

    await cartographer.createTokenAllocation(gasStressToken.address, 100)
    
    await expect(
        cartographer.add(gasStressToken.address, TENTHOUSAND, true, 0, true)
    ).to.be.revertedWith(ERR.TOO_MANY_ACTIVE_POOLS)
  })
  it(`ACTIVE POOLS CAP: Removing a pool should preserve active pools count until rollover, at which point it should decrement`, async function () {
    const { dev } = await getNamedSigners(hre)
    const cartographer = await getCartographer()
    const cartographerElevation = await ethers.getContract(Contracts.CartographerElevation)
    const elevationHelper = await getElevationHelper()

    const plainsActivePoolsCountInit = await cartographerElevation.elevActivePoolsCount(TENTHOUSAND)
    expect(plainsActivePoolsCountInit).to.equal(24)

    // Remove active pool (set not live)
    await cartographer.connect(dev).set(PID.DUMMY_CAKE_10K, false, POOL_FEE.DUMMY_CAKE_10K, false);

    const plainsActivePoolsCountMid = await cartographerElevation.elevActivePoolsCount(TENTHOUSAND)
    expect(plainsActivePoolsCountMid).to.equal(24)

    // Roll over PLAINS pools
    await rolloverRound(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, PID.SUMMIT_10K)

    const plainsActivePoolsCountFinal = await cartographerElevation.elevActivePoolsCount(TENTHOUSAND)
    expect(plainsActivePoolsCountFinal).to.equal(23)
  })
  it(`ACTIVE POOLS CAP: Setting a pool live should add it to the active pools count instantly`, async function () {
    const { dev } = await getNamedSigners(hre)
    const cartographer = await getCartographer()
    const cartographerElevation = await ethers.getContract(Contracts.CartographerElevation)

    const plainsActivePoolsCountInit = await cartographerElevation.elevActivePoolsCount(TENTHOUSAND)
    expect(plainsActivePoolsCountInit).to.equal(23)

    // Add active pool (set live)
    await cartographer.connect(dev).set(PID.DUMMY_CAKE_10K, true, POOL_FEE.DUMMY_CAKE_10K, false);

    const plainsActivePoolsCountFinal = await cartographerElevation.elevActivePoolsCount(TENTHOUSAND)
    expect(plainsActivePoolsCountFinal).to.equal(24)
  })



  // ROLLING OVER ALL ACTIVE POOLS
  it(`ROLLOVER 24 POOLS: Rolling over all active pools should have a reasonable gas usage`, async function () {
    const { user1 } = await getNamedSigners(hre)
    const cartographer = await getCartographer()
    const elevationHelper = await getElevationHelper()

    const nextRoundTime = (await elevationHelper.roundEndTimestamp(TENTHOUSAND)).toNumber()
    await mineBlockWithTimestamp(nextRoundTime)

    await expect(
        cartographer.connect(user1).rollover(TENTHOUSAND)
    ).to.emit(cartographer, EVENT.Rollover)
  })



  // USER INTERACTING POOLS STRESS TEST
  it(`INTERACTING POOLS CAP: Attempting to add another pool should fail with error "${ERR.TOO_MANY_STAKED_POOLS}"`, async function() {
    const { user1 } = await getNamedSigners(hre)

    const cartographer = await getCartographer()

    const gasStressInfo = {
        name: 'GS24',
        token: await ethers.getContract('GS24'),
        pid: 33,
    }

    await gasStressInfo.token.connect(user1).approve(cartographer.address, e18(10000))
    await expect(
        cartographer.connect(user1).deposit(gasStressInfo.pid, e18(5), 0, 0)
    ).to.be.revertedWith(ERR.TOO_MANY_STAKED_POOLS)
  })
  it(`INTERACTING POOLS: Exiting a pool should reduce interacting pools count when there are no winnings to harvest or rewards generated in current round`, async function() {
    const { user1 } = await getNamedSigners(hre)

    const cartographer = await getCartographer()
    const cartographerElevation = await ethers.getContract(Contracts.CartographerElevation)
    const elevationHelper = await getElevationHelper()

    const gasStressInfo = {
        name: 'GS4',
        token: await ethers.getContract('GS4'),
        pid: 13,
    }

    await rolloverRoundUntilLosingTotem(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, gasStressInfo.pid, 0)

    const userInteractingCountInit = await cartographerElevation.connect(user1).userElevInteractingCount(user1.address, TENTHOUSAND)

    // Withdraw staked amount and harvest any winnings. Will still have some rewards generated in current round
    await cartographer.connect(user1).withdraw(gasStressInfo.pid, e18(5), 0)

    const userInteractingCountMid = await cartographerElevation.connect(user1).userElevInteractingCount(user1.address, TENTHOUSAND)

    expect(userInteractingCountInit).to.equal(userInteractingCountMid)

    await rolloverRoundUntilLosingTotem(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, gasStressInfo.pid, 0)

    // Harvest remaining winnings if any
    await cartographer.connect(user1).deposit(gasStressInfo.pid, 0, 0, 0)

    const userInteractingCountFinal = await cartographerElevation.connect(user1).userElevInteractingCount(user1.address, TENTHOUSAND)

    expect(userInteractingCountMid.sub(1)).to.equal(userInteractingCountFinal)

    // Re-deposit into pool for later tests
    await cartographer.connect(user1).deposit(gasStressInfo.pid, e18(5), 0, 0)
    expect(true).to.be.true
  })

  it(`INTERACTING POOLS: Exiting a pool should reduce interacting pools count only after all winnings are harvested`, async function() {
    const { user1 } = await getNamedSigners(hre)

    const cartographer = await getCartographer()
    const cartographerElevation = await ethers.getContract(Contracts.CartographerElevation)
    const elevationHelper = await getElevationHelper()

    const gasStressInfo = {
        name: 'GS5',
        token: await ethers.getContract('GS5'),
        pid: 14,
    }

    const userInteractingCountInit = await cartographerElevation.connect(user1).userElevInteractingCount(user1.address, TENTHOUSAND)

    await rolloverRoundUntilWinningTotem(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, gasStressInfo.pid, 0)
    
    await cartographer.connect(user1).withdraw(gasStressInfo.pid, e18(5), 0)

    const userInteractingCountMid = await cartographerElevation.connect(user1).userElevInteractingCount(user1.address, TENTHOUSAND)
    
    expect(userInteractingCountInit).to.equal(userInteractingCountMid)
    
    await rolloverRoundUntilLosingTotem(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, gasStressInfo.pid, 0)

    await cartographer.connect(user1).deposit(gasStressInfo.pid, 0, 0, 0)
    
    const userInteractingCountFinal = await cartographerElevation.connect(user1).userElevInteractingCount(user1.address, TENTHOUSAND)

    expect(userInteractingCountMid.sub(1)).to.equal(userInteractingCountFinal)

    // Re-deposit into pool for later tests
    await cartographer.connect(user1).deposit(gasStressInfo.pid, e18(5), 0, 0)
    expect(true).to.be.true
  })



  // SWITCH TOTEM MAX GAS
  it(`SWITCH TOTEM: Switching totem with 12 active pools with winnings should succeed`, async function() {
    const { user1 } = await getNamedSigners(hre)

    const cartographer = await getCartographer()
    const cartographerElevation = await ethers.getContract(Contracts.CartographerElevation)
    const elevationHelper = await getElevationHelper()

    await rolloverRoundUntilWinningTotem(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, PID.DUMMY_CAKE_10K, 0)

    await expect(
        cartographer.connect(user1).switchTotem(TENTHOUSAND, 1)
    ).to.emit(cartographer, EVENT.SwitchTotem)
  })



  // HARVEST ALL / CROSS COMPOUND ALL
  it(`HARVEST ALL: Harvesting all winnings from 12 active pools with winnings should succeed`, async function() {
    const { user1 } = await getNamedSigners(hre)

    const summitToken = await getSummitToken()
    const cartographer = await getCartographer()
    const cartographerElevation = await ethers.getContract(Contracts.CartographerElevation)
    const elevationHelper = await getElevationHelper()

    // Ensure winnings on all farms, then ensure that all has vested
    await rolloverRoundUntilWinningTotem(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, PID.DUMMY_CAKE_10K, 1)
    await rolloverRoundUntilLosingTotem(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, PID.DUMMY_CAKE_10K, 1)

    // Sum total expected withdrawn winnings
    const userInteractingFarms = await promiseSequenceMap(
        [...new Array(12)],
        async (_, index) => await cartographerElevation.connect(user1).userElevInteractingPools(user1.address, TENTHOUSAND, index)
    )

    const userInteractingFarmsHarvestable = await promiseSequenceMap(
        userInteractingFarms,
        async (interactingPid) => (await cartographer.connect(user1).rewards(interactingPid, user1.address))[0]
    )

    const totalHarvestable = userInteractingFarmsHarvestable.reduce((total, farmHarvestable) => total.add(farmHarvestable), e18(0))
    const userSummitInit = await summitToken.balanceOf(user1.address)
    
    await expect(
        cartographer.connect(user1).claimElevation(TENTHOUSAND, false)
    ).to.emit(cartographer, EVENT.claimElevation)

    const userSummitFinal = await summitToken.balanceOf(user1.address)
    const userSummitDelta = userSummitFinal.sub(userSummitInit)
    
    consoleLog({
        userSummitDelta: toDecimal(userSummitDelta),
        totalHarvestable: toDecimal(totalHarvestable),
    })
    expect6FigBigNumberEquals(userSummitDelta, totalHarvestable)
  })
  it(`CROSS COMPOUND ALL: Cross compounding all winnings from 12 active pools with winnings should succeed`, async function() {
    const { user1 } = await getNamedSigners(hre)

    const cartographer = await getCartographer()
    const cartographerElevation = await ethers.getContract(Contracts.CartographerElevation)
    const elevationHelper = await getElevationHelper()

    // Ensure winnings on all farms, then ensure that all has vested
    await rolloverRoundUntilWinningTotem(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, PID.DUMMY_CAKE_10K, 1)
    await rolloverRoundUntilLosingTotem(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, PID.DUMMY_CAKE_10K, 1)

    // Sum total expected withdrawn winnings
    const userInteractingFarms = await promiseSequenceMap(
        [...new Array(12)],
        async (_, index) => await cartographerElevation.connect(user1).userElevInteractingPools(user1.address, TENTHOUSAND, index)
    )

    const userInteractingFarmsHarvestable = await promiseSequenceMap(
        userInteractingFarms,
        async (interactingPid) => (await cartographer.connect(user1).rewards(interactingPid, user1.address))[0]
    )

    const totalHarvestable = userInteractingFarmsHarvestable.reduce((total, farmHarvestable) => total.add(farmHarvestable), e18(0))
    const userSummitInit = (await getSubCartographerStaked(cartographerElevation, Contracts.CartographerElevation, PID.SUMMIT_10K, user1))[0]
    
    await expect(
        cartographer.connect(user1).claimElevation(TENTHOUSAND, true)
    ).to.emit(cartographer, EVENT.claimElevation)
    
    const userSummitFinal = (await getSubCartographerStaked(cartographerElevation, Contracts.CartographerElevation, PID.SUMMIT_10K, user1))[0]
    const userSummitDelta = userSummitFinal.sub(userSummitInit)
    
    consoleLog({
        userSummitDelta: toDecimal(userSummitDelta),
        totalHarvestable: toDecimal(totalHarvestable),
    })
    expect6FigBigNumberEquals(userSummitDelta, totalHarvestable)
  })
})