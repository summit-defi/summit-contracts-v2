import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { e18, ERR, EVENT, PID, PLAINS, MESA, SUMMIT, mineBlockWithTimestamp } from "../utils";
import { fiveThousandUnlockedFixture, oasisUnlockedFixture, poolsFixture, twoThousandUnlockedFixture } from "./fixtures";


describe("ELEVATION Unlocks", function() {
  it(`UNLOCK: Before summit enabled all elevations should fail with error "${ERR.POOL_NOT_AVAILABLE_YET}"`, async function() {
    await poolsFixture()

    const { user1 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')

    await expect(
      cartographer.connect(user1).deposit(PID.SUMMIT_2K, e18(5), 0, 0)
    ).to.be.revertedWith(ERR.POOL_NOT_AVAILABLE_YET)
    await expect(
        cartographer.connect(user1).deposit(PID.SUMMIT_5K, e18(5), 0, 0)
    ).to.be.revertedWith(ERR.POOL_NOT_AVAILABLE_YET)
    await expect(
        cartographer.connect(user1).deposit(PID.SUMMIT_10K, e18(5), 0, 0)
    ).to.be.revertedWith(ERR.POOL_NOT_AVAILABLE_YET)
  })
  it(`UNLOCK: Before 2K rollover, all elevations should fail with error "${ERR.POOL_NOT_AVAILABLE_YET}"`, async function() {
    await oasisUnlockedFixture()

    const { user1 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')

    await expect(
      cartographer.connect(user1).deposit(PID.SUMMIT_2K, e18(5), 0, 0)
    ).to.be.revertedWith(ERR.POOL_NOT_AVAILABLE_YET)
    await expect(
        cartographer.connect(user1).deposit(PID.SUMMIT_5K, e18(5), 0, 0)
    ).to.be.revertedWith(ERR.POOL_NOT_AVAILABLE_YET)
    await expect(
        cartographer.connect(user1).deposit(PID.SUMMIT_10K, e18(5), 0, 0)
    ).to.be.revertedWith(ERR.POOL_NOT_AVAILABLE_YET)
  })

  describe("- Two Thousand Meters", async function() {
    it(`UNLOCK: 2K Rollover should only be available after 2K elevation unlocks, else fails with error "${ERR.ELEVATION_LOCKED}"`, async function() {
      const oasisUnlockedFixtureState = await oasisUnlockedFixture()

      const { elevationHelper, cartographer, user1 } = oasisUnlockedFixtureState
      const twoThousandUnlockTime = (await elevationHelper.unlockTimestamp(PLAINS)).toNumber()
      await mineBlockWithTimestamp(twoThousandUnlockTime - 60)

      await expect(
        cartographer.connect(user1).rollover(PLAINS)
      ).to.be.revertedWith(ERR.ELEVATION_LOCKED)

      await mineBlockWithTimestamp(twoThousandUnlockTime)

      await expect(
        cartographer.connect(user1).rollover(PLAINS)
      ).to.emit(cartographer, EVENT.Rollover).withArgs(user1.address, PLAINS)
    })
    it(`UNLOCK: Rolling over first 2K round, 2K pools should switch from failing ("${ERR.POOL_NOT_AVAILABLE_YET}") to succeeding`, async function() {
      const oasisUnlockedFixtureState = await oasisUnlockedFixture()

      const { elevationHelper, cartographer, user1 } = oasisUnlockedFixtureState
      const twoThousandUnlockTime = (await elevationHelper.unlockTimestamp(PLAINS)).toNumber()
      await mineBlockWithTimestamp(twoThousandUnlockTime)

      const amount = e18(5)

      await expect(
        cartographer.connect(user1).deposit(PID.SUMMIT_2K, amount, 0, 0)
      ).to.be.revertedWith(ERR.POOL_NOT_AVAILABLE_YET)
      await expect(
          cartographer.connect(user1).deposit(PID.SUMMIT_5K, amount, 0, 0)
      ).to.be.revertedWith(ERR.POOL_NOT_AVAILABLE_YET)
      await expect(
          cartographer.connect(user1).deposit(PID.SUMMIT_10K, amount, 0, 0)
      ).to.be.revertedWith(ERR.POOL_NOT_AVAILABLE_YET)

      await cartographer.rollover(PLAINS)

      await expect(
        cartographer.connect(user1).deposit(PID.SUMMIT_2K, amount, 0, 0)
      ).to.emit(cartographer, EVENT.Deposit).withArgs(user1.address, PID.SUMMIT_2K, amount, 0)
      await expect(
          cartographer.connect(user1).deposit(PID.SUMMIT_5K, amount, 0, 0)
      ).to.be.revertedWith(ERR.POOL_NOT_AVAILABLE_YET)
      await expect(
          cartographer.connect(user1).deposit(PID.SUMMIT_10K, amount, 0, 0)
      ).to.be.revertedWith(ERR.POOL_NOT_AVAILABLE_YET)
    })
    it(`UNLOCK: 2K Rollover should increase totalAllocPoint`, async function() {
      const oasisUnlockedFixtureState = await oasisUnlockedFixture()

      const { elevationHelper, cartographer } = oasisUnlockedFixtureState
      
      const totalAllocPointInit = await cartographer.totalSharedAlloc()

      const twoThousandUnlockTime = (await elevationHelper.unlockTimestamp(PLAINS)).toNumber()
      await mineBlockWithTimestamp(twoThousandUnlockTime)

      await cartographer.rollover(PLAINS)

      const totalAllocPointFinal = await cartographer.totalSharedAlloc()

      const expectedAllocPoint = Math.floor(4000 * 110) + Math.floor(100 * 110) + Math.floor(150 * 110)
      expect(totalAllocPointFinal.sub(totalAllocPointInit)).to.equal(expectedAllocPoint)
    })
  })


  describe("- Five Thousand Meters", async function() {
    it(`UNLOCK: 5K Rollover should only be available after 5K elevation unlocks, else fails with error "${ERR.ELEVATION_LOCKED}"`, async function() {
      const twoThousandUnlockedFixtureState = await twoThousandUnlockedFixture()

      const { elevationHelper, cartographer, user1 } = twoThousandUnlockedFixtureState
      const fiveThousandUnlockTime = (await elevationHelper.unlockTimestamp(MESA)).toNumber()
      
      await mineBlockWithTimestamp(fiveThousandUnlockTime - 60)

      await expect(
        cartographer.connect(user1).rollover(MESA)
      ).to.be.revertedWith(ERR.ELEVATION_LOCKED)

      await mineBlockWithTimestamp(fiveThousandUnlockTime)

      await expect(
        cartographer.connect(user1).rollover(MESA)
      ).to.emit(cartographer, EVENT.Rollover).withArgs(user1.address, MESA)
    })
    it(`UNLOCK: Rolling over first 5K round, 5K pools should switch from failing ("${ERR.POOL_NOT_AVAILABLE_YET}") to succeeding`, async function() {
      const twoThousandUnlockedFixtureState = await twoThousandUnlockedFixture()

      const { elevationHelper, cartographer, user1 } = twoThousandUnlockedFixtureState
      const fiveThousandUnlockTime = (await elevationHelper.unlockTimestamp(MESA)).toNumber()
      await mineBlockWithTimestamp(fiveThousandUnlockTime)

      const amount = e18(5)

      await expect(
          cartographer.connect(user1).deposit(PID.SUMMIT_5K, amount, 0, 0)
      ).to.be.revertedWith(ERR.POOL_NOT_AVAILABLE_YET)
      await expect(
          cartographer.connect(user1).deposit(PID.SUMMIT_10K, amount, 0, 0)
      ).to.be.revertedWith(ERR.POOL_NOT_AVAILABLE_YET)

      await cartographer.rollover(MESA)

      await expect(
          cartographer.connect(user1).deposit(PID.SUMMIT_5K, amount, 0, 0)
      ).to.emit(cartographer, EVENT.Deposit).withArgs(user1.address, PID.SUMMIT_5K, amount, 0)
      await expect(
          cartographer.connect(user1).deposit(PID.SUMMIT_10K, amount, 0, 0)
      ).to.be.revertedWith(ERR.POOL_NOT_AVAILABLE_YET)
    })
    it(`UNLOCK: 5K Rollover should increase totalAllocPoint`, async function() {
      const twoThousandUnlockedFixtureState = await twoThousandUnlockedFixture()

      const { elevationHelper, cartographer, user1 } = twoThousandUnlockedFixtureState
      
      const totalAllocPointInit = await cartographer.totalSharedAlloc()

      const fiveThousandUnlockTime = (await elevationHelper.unlockTimestamp(MESA)).toNumber()
      await mineBlockWithTimestamp(fiveThousandUnlockTime)
      
      await cartographer.rollover(MESA)

      const totalAllocPointFinal = await cartographer.totalSharedAlloc()

      const expectedAllocPoint = Math.floor(4000 * 125) + Math.floor(100 * 125) + Math.floor(150 * 125)
      expect(totalAllocPointFinal.sub(totalAllocPointInit)).to.equal(expectedAllocPoint)
    })
  })

  describe('- Ten Thousand Meters', async function() {
    it(`UNLOCK: Rolling over first 10K round, 10K pools should switch from failing ("${ERR.POOL_NOT_AVAILABLE_YET}") to succeeding`, async function() {
      const fiveThousandUnlockedFixtureState = await fiveThousandUnlockedFixture()

      const { elevationHelper, cartographer, user1 } = fiveThousandUnlockedFixtureState
      const tenThousandUnlockTime = (await elevationHelper.unlockTimestamp(SUMMIT)).toNumber()
      
      await mineBlockWithTimestamp(tenThousandUnlockTime)

      const amount = e18(5)

      await expect(
          cartographer.connect(user1).deposit(PID.SUMMIT_10K, amount, 0, 0)
      ).to.be.revertedWith(ERR.POOL_NOT_AVAILABLE_YET)

      await cartographer.rollover(SUMMIT)

      await expect(
          cartographer.connect(user1).deposit(PID.SUMMIT_10K, amount, 0, 0)
      ).to.emit(cartographer, EVENT.Deposit).withArgs(user1.address, PID.SUMMIT_10K, amount, 0)
    })
    it(`UNLOCK: 10K Rollover should only be available after 10K elevation unlocks, else fails with error "${ERR.ELEVATION_LOCKED}"`, async function() {
      const fiveThousandUnlockedFixtureState = await fiveThousandUnlockedFixture()

      const { elevationHelper, cartographer, user1 } = fiveThousandUnlockedFixtureState
      const tenThousandUnlockTime = (await elevationHelper.unlockTimestamp(SUMMIT)).toNumber()
      await mineBlockWithTimestamp(tenThousandUnlockTime - 60)

      await expect(
        cartographer.connect(user1).rollover(SUMMIT)
      ).to.be.revertedWith(ERR.ELEVATION_LOCKED)

      await mineBlockWithTimestamp(tenThousandUnlockTime)

      await expect(
        cartographer.connect(user1).rollover(SUMMIT)
      ).to.emit(cartographer, EVENT.Rollover).withArgs(user1.address, SUMMIT)
    })
    it(`UNLOCK: 10K Rollover should increase totalAllocPoint`, async function() {
      const fiveThousandUnlockedFixtureState = await fiveThousandUnlockedFixture()

      const { elevationHelper, cartographer, user1 } = fiveThousandUnlockedFixtureState
      
      const totalAllocPointInit = await cartographer.totalSharedAlloc()

      const tenThousandUnlockTime = (await elevationHelper.unlockTimestamp(SUMMIT)).toNumber()
      await mineBlockWithTimestamp(tenThousandUnlockTime)
      
      await cartographer.rollover(SUMMIT)

      const totalAllocPointFinal = await cartographer.totalSharedAlloc()

      const expectedAllocPoint = Math.floor(4000 * 150) + Math.floor(100 * 150) + Math.floor(150 * 150)
      expect(totalAllocPointFinal.sub(totalAllocPointInit)).to.equal(expectedAllocPoint)
    })
  })

  describe('- Round End Lockout', async function() {
    it(`LOCKOUT: Elevation pools lockout 1 minute before round end until rollover`, async function() {
      const { elevationHelper, cartographer, user1 } = await twoThousandUnlockedFixture()
      
      const threeMinutesBeforeRollover = (await elevationHelper.roundEndTimestamp(PLAINS)).sub(120)
      await mineBlockWithTimestamp(threeMinutesBeforeRollover.toNumber())

      const amount = e18(5)

      await expect(
        cartographer.connect(user1).deposit(PID.SUMMIT_2K, amount, 0, 0)
      ).to.emit(cartographer, EVENT.Deposit)

      await mineBlockWithTimestamp(threeMinutesBeforeRollover.add(90).toNumber())

      await expect(
        cartographer.connect(user1).deposit(PID.SUMMIT_2K, amount, 0, 0)
      ).to.be.revertedWith(ERR.ELEVATION_LOCKED_UNTIL_ROLLOVER)

      await mineBlockWithTimestamp(threeMinutesBeforeRollover.add(120).toNumber())

      await expect(
        cartographer.connect(user1).deposit(PID.SUMMIT_2K, amount, 0, 0)
      ).to.be.revertedWith(ERR.ELEVATION_LOCKED_UNTIL_ROLLOVER)

      await cartographer.rollover(PLAINS)

      await expect(
        cartographer.connect(user1).deposit(PID.SUMMIT_2K, amount, 0, 0)
      ).to.emit(cartographer, EVENT.Deposit)
    }) 
  })
})
