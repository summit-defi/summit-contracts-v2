import { BigNumber } from "@ethersproject/bignumber";
import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { consoleLog, ERR, EVENT, MESA, mineBlockWithTimestamp, OASIS, SUMMIT, PLAINS, ZEROADD, promiseSequenceMap, allElevationPromiseSequenceMap, getSubCartographers, Contracts, getCakeToken, getCartographer, getElevationHelper, getSummitToken, cartographerMethod, cartographerGet, elevationHelperGet, e18, subCartMethod, subCartGet, delay } from "../utils";
import { baseFixture, twoThousandUnlockedFixture } from "./fixtures";

const userDepositIntoPools = async () => {
  const { user1 } = await getNamedSigners(hre)
  const summitToken = await getSummitToken()
  const cakeToken = await getCakeToken()

  // Deposit into each pool
  const pools = [
    { tokenAddress: summitToken.address },
    { tokenAddress: cakeToken.address }
  ]

  await allElevationPromiseSequenceMap(
    async (elevation) => {
      if ((await subCartGet.userTotemInfo(elevation, user1.address)).totemSelected) return
      await cartographerMethod.switchTotem({
        user: user1,
        elevation,
        totem: 0,
      })
    }
  )

  await promiseSequenceMap(
    pools,
    async (pool) => await allElevationPromiseSequenceMap(
      async (elevation) => await cartographerMethod.deposit({
        user: user1,
        ...pool,
        elevation,
        amount: e18(0.1),
      })
    )
  )
}

describe("Base Pools", function() {
  describe('- Pool Creation', async function() {
    it('Pool creation without a token alloc should fail', async function() {
      const { dev, summitToken } = await baseFixture() 

      await cartographerMethod.add({
        dev,
        tokenAddress: summitToken.address,
        elevation: OASIS,
        live: true,
        withUpdate: true,
        revertErr: ERR.INVALID_TOKEN_ALLOC,
      })
    })
    it('Creation of tokenAlloc should succeed', async function() {
      const { dev, summitToken } = await baseFixture() 

      await cartographerMethod.createTokenAllocation({
        dev,
        tokenAddress: summitToken.address,
        allocation: 4000
      })
    })
    it(`Creation of duplicated tokenAlloc should fail with error ${ERR.DUPLICATED_TOKEN_ALLOC}`, async function() {
      const { dev, summitToken } = await baseFixture() 

      await cartographerMethod.createTokenAllocation({
        dev,
        tokenAddress: summitToken.address,
        allocation: 4000
      })
      await cartographerMethod.createTokenAllocation({
        dev,
        tokenAddress: summitToken.address,
        allocation: 4000,
        revertErr: ERR.DUPLICATED_TOKEN_ALLOC
      })
    })
    it(`Pool creation without already existing tokenAlloc should fail with error ${ERR.INVALID_TOKEN_ALLOC}`, async function() {
      const { dev, summitToken  } = await baseFixture()

      await cartographerMethod.add({
        dev,
        tokenAddress: summitToken.address,
        elevation: OASIS,
        live: true,
        withUpdate: true,
        revertErr: ERR.INVALID_TOKEN_ALLOC,
      })
    })
    it('Non-Admin pool creation should fail', async function() {
      const { dev, user1, summitToken } = await baseFixture()

      await cartographerMethod.createTokenAllocation({
        dev,
        tokenAddress: summitToken.address,
        allocation: 4000
      })
      await cartographerMethod.add({
        dev: user1,
        tokenAddress: summitToken.address,
        elevation: OASIS,
        live: true,
        withUpdate: true,
        revertErr: ERR.NON_OWNER
      })
    })
    it('Admin pool creation should succeed', async function() {
      const { dev, summitToken } = await baseFixture()

      await cartographerMethod.createTokenAllocation({
        dev,
        tokenAddress: summitToken.address,
        allocation: 4000
      })
      await cartographerMethod.add({
        dev,
        tokenAddress: summitToken.address,
        elevation: OASIS,
        live: true,
        withUpdate: true,
      })
    })
    it(`Deploying another OASIS SUMMIT Pool should fail with error ${ERR.DUPLICATED}`, async function() {
      const { dev } = await getNamedSigners(hre)
      const summitToken = await getSummitToken()

      await cartographerMethod.add({
        dev,
        tokenAddress: summitToken.address,
        elevation: OASIS,
        live: true,
        withUpdate: true,
        revertErr: ERR.DUPLICATED
      })
    })
  })
  describe("- Pool Verification", async function() {
    before(async function () {
      const { dev, summitToken, cakeToken } = await baseFixture()

      const allocations = [
        { tokenAddress: summitToken.address, allocation: 4000 },
        { tokenAddress: cakeToken.address, allocation: 100 },
      ]

      await promiseSequenceMap(
        allocations,
        async (tokenAllocation) => await cartographerMethod.createTokenAllocation({
          dev,
          ...tokenAllocation
        })
      )

      const pools = [
        { tokenAddress: summitToken.address },
        { tokenAddress: cakeToken.address }
      ]

      await promiseSequenceMap(
        pools,
        async (pool) => await allElevationPromiseSequenceMap(
          async (elevation) => await cartographerMethod.add({
            dev,
            ...pool,
            elevation,
            live: true,
            withUpdate: true
          })
        )
      )
    })
    it('Number of pools should be correct', async function() {  
      expect(await cartographerGet.poolsCount()).to.equal(8)
      await allElevationPromiseSequenceMap(
        async (elevation) => expect(await cartographerGet.elevationPoolsCount(elevation)).to.equal(2)
      )
    })
    it('Pool Allocation Points should be correct', async function () {
      const summitToken = await getSummitToken()
      const cakeToken = await getCakeToken()

      const elevationAllocMultipliers = [100, 110, 125, 150]

      const summitAllocations = await allElevationPromiseSequenceMap(
        async (elevation) => Math.floor(4000 * elevationAllocMultipliers[elevation])
      )
      const cakeAllocations = await allElevationPromiseSequenceMap(
        async (elevation) => Math.floor(100 * elevationAllocMultipliers[elevation])
      )

      const tenThousandUnlockTime = await elevationHelperGet.unlockTimestamp(SUMMIT)
      await mineBlockWithTimestamp(tenThousandUnlockTime)
      await allElevationPromiseSequenceMap(
        async (elevation) => await cartographerMethod.rollover({ elevation })
      )

      await userDepositIntoPools()

      await allElevationPromiseSequenceMap(
        async (elevation) => {
          expect(await cartographerGet.elevationModulatedAllocation(summitToken.address, elevation)).to.equal(summitAllocations[elevation])
          expect(await cartographerGet.elevationModulatedAllocation(cakeToken.address, elevation)).to.equal(cakeAllocations[elevation])
        }
      )
    })
    it('Pools can be disabled and reenabled', async function() {
      await twoThousandUnlockedFixture()
      const { dev, user1 } = await getNamedSigners(hre)
      const summitToken = await getSummitToken()

      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: OASIS,
        amount: e18(1)
      })

      const oasisAllocSummit = 4000
      const oasisAllocBefore = await cartographerGet.elevAlloc(OASIS)
      const summitTokenAlloc = await cartographerGet.tokenAlloc(summitToken.address)
      expect(await cartographerGet.elevationModulatedAllocation(summitToken.address, OASIS)).to.equal(oasisAllocSummit * 100)

      await cartographerMethod.set({
        dev,
        tokenAddress: summitToken.address,
        elevation: OASIS,
        live: false,
        withUpdate: true,
      })

      const oasisAllocAfter = await cartographerGet.elevAlloc(OASIS)
      expect(await cartographerGet.elevationModulatedAllocation(summitToken.address, OASIS)).to.equal(0)
      expect(oasisAllocBefore - oasisAllocAfter).to.equal(oasisAllocSummit)
      expect(await cartographerGet.tokenAlloc(summitToken.address)).to.equal(summitTokenAlloc)

      await cartographerMethod.set({
        dev,
        tokenAddress: summitToken.address,
        elevation: OASIS,
        live: true,
        withUpdate: true,
      })

      const oasisAllocFinal = await cartographerGet.elevAlloc(OASIS)
      expect(await cartographerGet.elevationModulatedAllocation(summitToken.address, OASIS)).to.equal(oasisAllocSummit * 100)
      expect(oasisAllocFinal - oasisAllocAfter).to.equal(oasisAllocSummit)
      expect(await cartographerGet.tokenAlloc(summitToken.address)).to.equal(summitTokenAlloc)
    })
    it('Tokens total alloc points can be updated', async function() {
      await twoThousandUnlockedFixture()
      const { dev, user1 } = await getNamedSigners(hre)
      const summitToken = await getSummitToken()

      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: OASIS,
        amount: e18(1)
      })

      const oasisAllocBefore = await cartographerGet.elevAlloc(OASIS)
      const oasisAllocSummit = 4000
      const summitTokenAlloc = await cartographerGet.tokenAlloc(summitToken.address)
      consoleLog({
        summitTokenAlloc: summitTokenAlloc.toString(),
        oasisAllocBefore: oasisAllocBefore.toString(),
        oasisAllocSummit,
      })
      expect(await cartographerGet.elevationModulatedAllocation(summitToken.address, OASIS)).to.equal(oasisAllocSummit * 100)
      
      await cartographerMethod.setTokenAllocation({
        dev,
        tokenAddress: summitToken.address,
        allocation: 0
      })
      
      expect(await cartographerGet.tokenAlloc(summitToken.address)).to.equal(0)
      expect(await cartographerGet.elevationModulatedAllocation(summitToken.address, OASIS)).to.equal(0)
      const oasisAllocAfter = await cartographerGet.elevAlloc(OASIS)
      expect(oasisAllocBefore - oasisAllocAfter).to.equal(summitTokenAlloc)

      await cartographerMethod.setTokenAllocation({
        dev,
        tokenAddress: summitToken.address,
        allocation: summitTokenAlloc / 2
      })

      expect(await cartographerGet.elevationModulatedAllocation(summitToken.address, OASIS)).to.equal((oasisAllocSummit * 100) / 2)
      const oasisAllocFinal = await cartographerGet.elevAlloc(OASIS)
      expect(oasisAllocFinal - oasisAllocAfter).to.equal(summitTokenAlloc / 2)

      consoleLog({
        oasisAllocBefore: oasisAllocBefore.toString(),
        oasisAllocAfter: oasisAllocAfter.toString(),
        oasisAllocFinal: oasisAllocFinal.toString(),
      })

      expect(true).to.be.true
    })
  })
});
