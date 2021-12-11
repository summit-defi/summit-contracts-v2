import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { e18, ERR, EVENT, PLAINS, MESA, SUMMIT, mineBlockWithTimestamp, cartographerMethod, getSummitToken, OASIS, getCartographer, elevationHelperGet, cartographerSynth, cartographerGet, expect6FigBigNumberAllEqual, expectAllEqual, subCartGet, elevationPromiseSequenceMap, getBifiToken, getCakeToken, promiseSequenceMap } from "../utils";
import { fiveThousandUnlockedFixture, oasisUnlockedFixture, poolsFixture, twoThousandUnlockedFixture } from "./fixtures";

const switchTotemIfNecessary = async (user: SignerWithAddress, elevation: number, totem: number, revertErr?: string) => {
  if ((await subCartGet.userTotemInfo(elevation, user.address)).totemSelected) return
  await cartographerMethod.switchTotem({
    user,
    elevation,
    totem,
    revertErr
  })
}

const initialTotemSelections = async (user: SignerWithAddress) => {
  await switchTotemIfNecessary(user, PLAINS, 0)
  await switchTotemIfNecessary(user, MESA, 0)
  await switchTotemIfNecessary(user, SUMMIT, 0)
}

const userDepositIntoElevationPools = async (elevation: number) => {
  const { user1 } = await getNamedSigners(hre)
  const summitToken = await getSummitToken()
  const cakeToken = await getCakeToken()
  const bifiToken = await getBifiToken()

  // Deposit into each pool
  const pools = [
    { tokenAddress: summitToken.address },
    { tokenAddress: cakeToken.address },
    { tokenAddress: bifiToken.address },
  ]

  console.log({
    userElevationTotemInfoBefore: await subCartGet.userTotemInfo(elevation, user1.address)
  })
  if (!(await subCartGet.userTotemInfo(elevation, user1.address)).totemSelected) {
    await cartographerMethod.switchTotem({
      user: user1,
      elevation,
      totem: 0,
    })
  }
  console.log({
    userElevationTotemInfoAfter: await subCartGet.userTotemInfo(elevation, user1.address)
  })

  await promiseSequenceMap(
    pools,
    async (pool) => await cartographerMethod.deposit({
      user: user1,
      ...pool,
      elevation,
      amount: e18(0.1),
    })
  )
}

describe("ELEVATION Unlocks", function() {
  it(`UNLOCK: Before summit enabled all elevations should fail with error "${ERR.ELEVATION_LOCKED_UNTIL_ROLLOVER}"`, async function() {
    await poolsFixture()
    const { user1 } = await getNamedSigners(hre)
    const summitToken = await getSummitToken()

    await initialTotemSelections(user1)

    await cartographerMethod.deposit({
      user: user1,
      tokenAddress: summitToken.address,
      elevation: PLAINS,
      amount: e18(5),
      revertErr: ERR.POOL_NOT_AVAILABLE_YET,
    })
    await cartographerMethod.deposit({
      user: user1,
      tokenAddress: summitToken.address,
      elevation: MESA,
      amount: e18(5),
      revertErr: ERR.POOL_NOT_AVAILABLE_YET,
    })
    await cartographerMethod.deposit({
      user: user1,
      tokenAddress: summitToken.address,
      elevation: SUMMIT,
      amount: e18(5),
      revertErr: ERR.POOL_NOT_AVAILABLE_YET,
    })
  })
  it(`UNLOCK: Before 2K rollover, all elevations should fail with error "${ERR.POOL_NOT_AVAILABLE_YET}"`, async function() {
    await oasisUnlockedFixture()

    const { user1 } = await getNamedSigners(hre)
    const summitToken = await getSummitToken()
    
    await initialTotemSelections(user1)

    await cartographerMethod.deposit({
      user: user1,
      tokenAddress: summitToken.address,
      elevation: PLAINS,
      amount: e18(5),
      revertErr: ERR.POOL_NOT_AVAILABLE_YET,
    })
    await cartographerMethod.deposit({
      user: user1,
      tokenAddress: summitToken.address,
      elevation: MESA,
      amount: e18(5),
      revertErr: ERR.POOL_NOT_AVAILABLE_YET,
    })
    await cartographerMethod.deposit({
      user: user1,
      tokenAddress: summitToken.address,
      elevation: SUMMIT,
      amount: e18(5),
      revertErr: ERR.POOL_NOT_AVAILABLE_YET,
    })
  })

  describe("- Two Thousand Meters", async function() {
    it(`UNLOCK: 2K Rollover should only be available after 2K elevation unlocks, else fails with error "${ERR.ELEVATION_LOCKED}"`, async function() {
      const oasisUnlockedFixtureState = await oasisUnlockedFixture()

      const { elevationHelper, user1 } = oasisUnlockedFixtureState
      const twoThousandUnlockTime = await elevationHelperGet.unlockTimestamp(PLAINS)
      await mineBlockWithTimestamp(twoThousandUnlockTime - 60)

      await cartographerMethod.rollover({
        user: user1,
        elevation: PLAINS,
        revertErr: ERR.ELEVATION_LOCKED
      })

      await mineBlockWithTimestamp(twoThousandUnlockTime)

      await cartographerMethod.rollover({
        user: user1,
        elevation: PLAINS,
      })
    })
    it(`UNLOCK: Rolling over first 2K round, 2K pools should switch from failing ("${ERR.POOL_NOT_AVAILABLE_YET}") to succeeding`, async function() {
      const { summitToken, user1 } = await oasisUnlockedFixture()
      
      await initialTotemSelections(user1)
      const twoThousandUnlockTime = await elevationHelperGet.unlockTimestamp(PLAINS)
      await mineBlockWithTimestamp(twoThousandUnlockTime)

      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: PLAINS,
        amount: e18(5),
        revertErr: ERR.POOL_NOT_AVAILABLE_YET,
      })
      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: MESA,
        amount: e18(5),
        revertErr: ERR.POOL_NOT_AVAILABLE_YET,
      })
      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: SUMMIT,
        amount: e18(5),
        revertErr: ERR.POOL_NOT_AVAILABLE_YET,
      })

      await cartographerMethod.rollover({
        elevation: PLAINS
      })

      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: PLAINS,
        amount: e18(5),
      })
      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: MESA,
        amount: e18(5),
        revertErr: ERR.POOL_NOT_AVAILABLE_YET,
      })
      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: SUMMIT,
        amount: e18(5),
        revertErr: ERR.POOL_NOT_AVAILABLE_YET,
      })
    })
    it(`UNLOCK: 2K Rollover should increase totalAllocPoint`, async function() {
      await oasisUnlockedFixture()
      
      const totalAllocPointInit = await cartographerSynth.totalAlloc()
      
      const twoThousandUnlockTime = await elevationHelperGet.unlockTimestamp(PLAINS)
      await mineBlockWithTimestamp(twoThousandUnlockTime)
      
      await cartographerMethod.rollover({
        elevation: PLAINS
      })

      await userDepositIntoElevationPools(PLAINS)

      const totalAllocPointFinal = await cartographerSynth.totalAlloc()
      const plainsAlloc = await cartographerGet.elevAlloc(PLAINS)

      console.log({
        totalAllocPointInit,
        totalAllocPointFinal,
      })

      const expectedAllocPoint = 4000 + 100 + 150
      expectAllEqual([
        totalAllocPointFinal - totalAllocPointInit,
        expectedAllocPoint,
        plainsAlloc,
      ])
    })
  })


  describe("- Five Thousand Meters", async function() {
    it(`UNLOCK: 5K Rollover should only be available after 5K elevation unlocks, else fails with error "${ERR.ELEVATION_LOCKED}"`, async function() {
      await twoThousandUnlockedFixture()
      const fiveThousandUnlockTime = await elevationHelperGet.unlockTimestamp(MESA)
      
      await mineBlockWithTimestamp(fiveThousandUnlockTime - 60)

      await cartographerMethod.rollover({
        elevation: MESA,
        revertErr: ERR.ELEVATION_LOCKED,
      })

      await mineBlockWithTimestamp(fiveThousandUnlockTime)

      await cartographerMethod.rollover({
        elevation: MESA,
      })
    })
    it(`UNLOCK: Rolling over first 5K round, 5K pools should switch from failing ("${ERR.POOL_NOT_AVAILABLE_YET}") to succeeding`, async function() {
      const { summitToken, user1 } = await twoThousandUnlockedFixture()

      const fiveThousandUnlockTime = await elevationHelperGet.unlockTimestamp(MESA)
      await initialTotemSelections(user1)
      await mineBlockWithTimestamp(fiveThousandUnlockTime)

      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: MESA,
        amount: e18(5),
        revertErr: ERR.POOL_NOT_AVAILABLE_YET,
      })
      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: SUMMIT,
        amount: e18(5),
        revertErr: ERR.POOL_NOT_AVAILABLE_YET,
      })

      await cartographerMethod.rollover({
        elevation: MESA
      })

      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: MESA,
        amount: e18(5),
      })
      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: SUMMIT,
        amount: e18(5),
        revertErr: ERR.POOL_NOT_AVAILABLE_YET,
      })
    })
    it(`UNLOCK: 5K Rollover should increase totalAllocPoint`, async function() {
      await twoThousandUnlockedFixture()
      
      const totalAllocPointInit = await cartographerSynth.totalAlloc()
      
      const fiveThousandUnlockTime = await elevationHelperGet.unlockTimestamp(MESA)
      await mineBlockWithTimestamp(fiveThousandUnlockTime)
      
      await cartographerMethod.rollover({
        elevation: MESA
      })
      await userDepositIntoElevationPools(MESA)
      const mesaAlloc = await cartographerGet.elevAlloc(MESA)
      const totalAllocPointFinal = await cartographerSynth.totalAlloc()
      
      console.log({
        totalAllocPointInit,
        totalAllocPointFinal,
      })

      const expectedAllocPoint = 4000 + 100 + 150
      expectAllEqual([
        totalAllocPointFinal - totalAllocPointInit,
        expectedAllocPoint,
        mesaAlloc,
      ])
    })
  })

  describe('- Ten Thousand Meters', async function() {
    it(`UNLOCK: 10K Rollover should only be available after 10K elevation unlocks, else fails with error "${ERR.ELEVATION_LOCKED}"`, async function() {
      await fiveThousandUnlockedFixture()

      const tenThousandUnlockTime = await elevationHelperGet.unlockTimestamp(SUMMIT)
      await mineBlockWithTimestamp(tenThousandUnlockTime - 60)

      await cartographerMethod.rollover({
        elevation: SUMMIT,
        revertErr: ERR.ELEVATION_LOCKED,
      })

      await mineBlockWithTimestamp(tenThousandUnlockTime)

      await cartographerMethod.rollover({
        elevation: SUMMIT
      })
    })
    it(`UNLOCK: Rolling over first 10k round, 10k pools should switch from failing ("${ERR.POOL_NOT_AVAILABLE_YET}") to succeeding`, async function() {
      const { summitToken, user1 } = await fiveThousandUnlockedFixture()

      const summitUnlockTimestamp = await elevationHelperGet.unlockTimestamp(SUMMIT)
      await switchTotemIfNecessary(user1, SUMMIT, 0)
      await mineBlockWithTimestamp(summitUnlockTimestamp)

      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: SUMMIT,
        amount: e18(5),
        revertErr: ERR.POOL_NOT_AVAILABLE_YET,
      })

      await cartographerMethod.rollover({
        elevation: SUMMIT
      })

      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: SUMMIT,
        amount: e18(5),
      })
    })
    it(`UNLOCK: 10K Rollover should increase totalAllocPoint`, async function() {
      await fiveThousandUnlockedFixture()
      
      const totalAllocPointInit = await cartographerSynth.totalAlloc()
      
      const tenThousandUnlockTime = await elevationHelperGet.unlockTimestamp(SUMMIT)
      await mineBlockWithTimestamp(tenThousandUnlockTime)
      
      await cartographerMethod.rollover({
        elevation: SUMMIT
      })
      await userDepositIntoElevationPools(SUMMIT)

      const summitAlloc = await cartographerGet.elevAlloc(SUMMIT)
      const totalAllocPointFinal = await cartographerSynth.totalAlloc()
      
      console.log({
        totalAllocPointInit,
        totalAllocPointFinal,
      })

      const expectedAllocPoint = 4000 + 100 + 150
      expectAllEqual([
        totalAllocPointFinal - totalAllocPointInit,
        expectedAllocPoint,
        summitAlloc,
      ])
    })
  })

  describe('- Round End Lockout', async function() {
    it(`LOCKOUT: Elevation pools lockout 1 minute before round end until rollover`, async function() {
      const { summitToken, user1 } = await twoThousandUnlockedFixture()
      
      const twoMinutesBeforeRollover = await elevationHelperGet.roundEndTimestamp(PLAINS) - 180
      await initialTotemSelections(user1)
      await mineBlockWithTimestamp(twoMinutesBeforeRollover)

      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: PLAINS,
        amount: e18(5),
      })

      await mineBlockWithTimestamp(twoMinutesBeforeRollover + 90)

      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: PLAINS,
        amount: e18(5),
        revertErr: ERR.ELEVATION_LOCKED_UNTIL_ROLLOVER,
      })

      await mineBlockWithTimestamp(twoMinutesBeforeRollover + 120)

      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: PLAINS,
        amount: e18(5),
        revertErr: ERR.ELEVATION_LOCKED_UNTIL_ROLLOVER,
      })

      await mineBlockWithTimestamp(twoMinutesBeforeRollover + 180)

      await cartographerMethod.rollover({
        elevation: PLAINS
      })

      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: PLAINS,
        amount: e18(5),
      })
    }) 
  })
})
