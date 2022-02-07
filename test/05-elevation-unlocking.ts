import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { e18, ERR, EVENT, PLAINS, MESA, SUMMIT, mineBlockWithTimestamp, cartographerMethod, getSummitToken, OASIS, getCartographer, elevationHelperGet, cartographerSynth, cartographerGet, expect6FigBigNumberAllEqual, expectAllEqual, subCartGet, allElevationPromiseSequenceMap, getBifiToken, getCakeToken, promiseSequenceMap, consoleLog, userPromiseSequenceMap, getTimestamp } from "../utils";
import { mesaUnlockedFixture, oasisUnlockedFixture, poolsFixture, plainsUnlockedFixture } from "./fixtures";

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
  const { user1 } = await ethers.getNamedSigners()
  const summitToken = await getSummitToken()
  const cakeToken = await getCakeToken()
  const bifiToken = await getBifiToken()

  // Deposit into each pool
  const pools = [
    { tokenAddress: summitToken.address },
    { tokenAddress: cakeToken.address },
    { tokenAddress: bifiToken.address },
  ]

  if (!(await subCartGet.userTotemInfo(elevation, user1.address)).totemSelected) {
    await cartographerMethod.switchTotem({
      user: user1,
      elevation,
      totem: 0,
    })
  }

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
  describe("- PLAINS", async function() {
    it(`UNLOCK: Before PLAINS unlock, deposits should be enabled, but no yield contributed accumulates and potential winnings are 0`, async function() {
      await oasisUnlockedFixture()
  
      const { user1 } = await ethers.getNamedSigners()
      const summitToken = await getSummitToken()
      
      await initialTotemSelections(user1)
  
      await userPromiseSequenceMap(
        async (user) => {
          await cartographerMethod.deposit({
            user: user1,
            tokenAddress: summitToken.address,
            elevation: PLAINS,
            amount: e18(5),
          })
          const currentTimestamp = await getTimestamp()
          await mineBlockWithTimestamp(currentTimestamp + 20)
          const potentialWinnings = await subCartGet.elevPotentialWinnings(PLAINS, user.address)
          expect(potentialWinnings.potentialWinnings).to.equal(0)
          expect(potentialWinnings.yieldContributed).to.equal(0)
        }
      )
    })
    it(`UNLOCK: PLAINS Rollover should only be available after PLAINS elevation unlocks, else fails with error "${ERR.ELEVATION_LOCKED}"`, async function() {
      const oasisUnlockedFixtureState = await oasisUnlockedFixture()

      const { user1 } = oasisUnlockedFixtureState
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
    it(`UNLOCK: Rolling over first PLAINS round, no rewards should be earned`, async function() {
      const { user1 } = await oasisUnlockedFixture()
      
      await initialTotemSelections(user1)
      const twoThousandUnlockTime = await elevationHelperGet.unlockTimestamp(PLAINS)
      await mineBlockWithTimestamp(twoThousandUnlockTime)

      await userPromiseSequenceMap(
        async (user) => {
          const claimable = await subCartGet.elevClaimableRewards(PLAINS, user.address)
          expect(claimable).to.equal(0)
        }
      )
    })
    it(`UNLOCK: PLAINS Rollover should increase totalAllocPoint`, async function() {
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

      consoleLog({
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


  describe("- MESA", async function() {
    it(`UNLOCK: Before MESA unlock, deposits should be enabled, but no yield contributed accumulates and potential winnings are 0`, async function() {
      await oasisUnlockedFixture()
  
      const { user1 } = await ethers.getNamedSigners()
      const summitToken = await getSummitToken()
      
      await initialTotemSelections(user1)
  
      await userPromiseSequenceMap(
        async (user) => {
          await cartographerMethod.deposit({
            user: user1,
            tokenAddress: summitToken.address,
            elevation: MESA,
            amount: e18(5),
          })
          const currentTimestamp = await getTimestamp()
          await mineBlockWithTimestamp(currentTimestamp + 20)
          const potentialWinnings = await subCartGet.elevPotentialWinnings(MESA, user.address)
          expect(potentialWinnings.potentialWinnings).to.equal(0)
          expect(potentialWinnings.yieldContributed).to.equal(0)
        }
      )
    })
    it(`UNLOCK: MESA Rollover should only be available after MESA elevation unlocks, else fails with error "${ERR.ELEVATION_LOCKED}"`, async function() {
      await plainsUnlockedFixture()
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
    it(`UNLOCK: Rolling over first MESA round, no rewards should be earned`, async function() {
      const { user1 } = await oasisUnlockedFixture()
      
      await initialTotemSelections(user1)
      const twoThousandUnlockTime = await elevationHelperGet.unlockTimestamp(MESA)
      await mineBlockWithTimestamp(twoThousandUnlockTime)

      await userPromiseSequenceMap(
        async (user) => {
          const claimable = await subCartGet.elevClaimableRewards(MESA, user.address)
          expect(claimable).to.equal(0)
        }
      )
    })
    it(`UNLOCK: MESA Rollover should increase totalAllocPoint`, async function() {
      await plainsUnlockedFixture()
      
      const totalAllocPointInit = await cartographerSynth.totalAlloc()
      
      const fiveThousandUnlockTime = await elevationHelperGet.unlockTimestamp(MESA)
      await mineBlockWithTimestamp(fiveThousandUnlockTime)
      
      await cartographerMethod.rollover({
        elevation: MESA
      })
      await userDepositIntoElevationPools(MESA)
      const mesaAlloc = await cartographerGet.elevAlloc(MESA)
      const totalAllocPointFinal = await cartographerSynth.totalAlloc()
      
      consoleLog({
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

  describe('- SUMMIT', async function() {
    it(`UNLOCK: Before SUMMIT unlock, deposits should be enabled, but no yield contributed accumulates and potential winnings are 0`, async function() {
      await oasisUnlockedFixture()
  
      const { user1 } = await ethers.getNamedSigners()
      const summitToken = await getSummitToken()
      
      await initialTotemSelections(user1)
  
      await userPromiseSequenceMap(
        async (user) => {
          await cartographerMethod.deposit({
            user: user1,
            tokenAddress: summitToken.address,
            elevation: SUMMIT,
            amount: e18(5),
          })
          const currentTimestamp = await getTimestamp()
          await mineBlockWithTimestamp(currentTimestamp + 20)
          const potentialWinnings = await subCartGet.elevPotentialWinnings(SUMMIT, user.address)
          expect(potentialWinnings.potentialWinnings).to.equal(0)
          expect(potentialWinnings.yieldContributed).to.equal(0)
        }
      )
    })
    it(`UNLOCK: SUMMIT Rollover should only be available after SUMMIT elevation unlocks, else fails with error "${ERR.ELEVATION_LOCKED}"`, async function() {
      await mesaUnlockedFixture()

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
    it(`UNLOCK: Rolling over first SUMMIT round, no rewards should be earned`, async function() {
      const { user1 } = await oasisUnlockedFixture()
      
      await initialTotemSelections(user1)
      const twoThousandUnlockTime = await elevationHelperGet.unlockTimestamp(SUMMIT)
      await mineBlockWithTimestamp(twoThousandUnlockTime)

      await userPromiseSequenceMap(
        async (user) => {
          const claimable = await subCartGet.elevClaimableRewards(SUMMIT, user.address)
          expect(claimable).to.equal(0)
        }
      )
    })
    it(`UNLOCK: SUMMIT Rollover should increase totalAllocPoint`, async function() {
      await mesaUnlockedFixture()
      
      const totalAllocPointInit = await cartographerSynth.totalAlloc()
      
      const tenThousandUnlockTime = await elevationHelperGet.unlockTimestamp(SUMMIT)
      await mineBlockWithTimestamp(tenThousandUnlockTime)
      
      await cartographerMethod.rollover({
        elevation: SUMMIT
      })
      await userDepositIntoElevationPools(SUMMIT)

      const summitAlloc = await cartographerGet.elevAlloc(SUMMIT)
      const totalAllocPointFinal = await cartographerSynth.totalAlloc()
      
      consoleLog({
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
      const { summitToken, user1 } = await plainsUnlockedFixture()
      
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
