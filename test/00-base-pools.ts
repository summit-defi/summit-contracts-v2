import { BigNumber } from "@ethersproject/bignumber";
import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { consoleLog, ERR, EVENT, MESA, mineBlockWithTimestamp, OASIS, SUMMIT, PLAINS, ZEROADD, promiseSequenceMap, elevationPromiseSequenceMap, getSubCartographers, Contracts, getCakeToken, getCartographer, getElevationHelper, getSummitToken } from "../utils";
import { baseFixture, twoThousandUnlockedFixture } from "./fixtures";

let pid: BigNumber

describe("Base Pools", function() {
  describe('- Pool Creation', async function() {
    it('Pool creation without a token alloc should fail', async function() {
      const { dev, summitToken, cartographer } = await baseFixture() 
      await expect(
        cartographer.connect(dev).add(summitToken.address, OASIS, true, true)
      ).to.be.revertedWith(ERR.INVALID_TOKEN_ALLOC)
    })
    it('Creation of tokenAlloc should succeed', async function() {
      const { dev, summitToken, cartographer } = await baseFixture() 
      await expect(
        cartographer.connect(dev).createTokenAllocation(summitToken.address, 4000)
      ).to.emit(cartographer, EVENT.TokenAllocCreated).withArgs(summitToken.address, 4000)
    })
    it(`Creation of duplicated tokenAlloc should fail with error ${ERR.DUPLICATED_TOKEN_ALLOC}`, async function() {
      const { dev, summitToken, cartographer } = await baseFixture() 
      await expect(
        cartographer.connect(dev).createTokenAllocation(summitToken.address, 4000)
      ).to.emit(cartographer, EVENT.TokenAllocCreated).withArgs(summitToken.address, 4000)
      await expect(
        cartographer.connect(dev).createTokenAllocation(summitToken.address, 4000)
      ).to.be.revertedWith(ERR.DUPLICATED_TOKEN_ALLOC)
    })
    it(`Pool creation without already existing tokenAlloc should fail with error ${ERR.INVALID_TOKEN_ALLOC}`, async function() {
      const { dev, summitToken, cartographer } = await baseFixture()
      await expect(
        cartographer.connect(dev).add(summitToken.address, OASIS, true, true)
      ).to.be.revertedWith(ERR.INVALID_TOKEN_ALLOC)
    })
    it('Non-Admin pool creation should fail', async function() {
      const { dev, user1, summitToken, cartographer } = await baseFixture()
      await expect(
        cartographer.connect(dev).createTokenAllocation(summitToken.address, 4000)
      ).to.emit(cartographer, EVENT.TokenAllocCreated).withArgs(summitToken.address, 4000)
      await expect(
        cartographer.connect(user1).add(summitToken.address, OASIS, true, true)
      ).to.be.revertedWith(ERR.NON_OWNER)
    })
    it('Admin pool creation should succeed', async function() {
      const { dev, summitToken, cartographer } = await baseFixture()
      await expect(
        cartographer.connect(dev).createTokenAllocation(summitToken.address, 4000)
      ).to.emit(cartographer, EVENT.TokenAllocCreated).withArgs(summitToken.address, 4000)
      await expect(
        cartographer.connect(dev).add(summitToken.address, OASIS, true, true)
      ).to.emit(cartographer, EVENT.PoolCreated).withArgs(summitToken.address, OASIS)
    })
    it(`Deploying another OASIS SUMMIT Pool should fail with error ${ERR.DUPLICATED}`, async function() {
      const { dev } = await getNamedSigners(hre)
      const summitToken = await getSummitToken()
      const cartographer = await getCartographer()
      await expect(
        cartographer.connect(dev).add(summitToken.address, OASIS, true, true)
      ).to.be.revertedWith(ERR.DUPLICATED)
    })
  })
  describe("- Pool Verification", async function() {
    before(async function () {
      const { summitToken, cakeToken, cartographer } = await baseFixture()
      await cartographer.createTokenAllocation(summitToken.address, 4000)
      await cartographer.createTokenAllocation(cakeToken.address, 100)
      await cartographer.add(summitToken.address, OASIS, true, true)
      await cartographer.add(summitToken.address, PLAINS, true, true)
      await cartographer.add(summitToken.address, MESA, true, true)
      await cartographer.add(summitToken.address, SUMMIT, true, true)
      await cartographer.add(cakeToken.address, OASIS, true, true)
      await cartographer.add(cakeToken.address, PLAINS, true, true)
      await cartographer.add(cakeToken.address, MESA, true, true)
      await cartographer.add(cakeToken.address, SUMMIT, true, true)
    })
    it('Number of pools should be correct', async function() {  
      const cartographer = await getCartographer()
      expect(await cartographer.poolsCount()).to.equal(8)
      await elevationPromiseSequenceMap(
        async (elevation) => expect(await cartographer.elevationPoolsCount(elevation)).to.equal(2)
      )
    })
    it('Pool Allocation Points should be correct', async function () {
      const cartographer = await getCartographer()
      const elevationHelper = await getElevationHelper()
      const summitToken = await getSummitToken()
      const cakeToken = await getCakeToken()

      const oasisAllocSummit = Math.floor(4000 * 100)
      const twothousandAllocSummit = Math.floor(4000 * 110)
      const fivethousandAllocSummit = Math.floor(4000 * 125)
      const tenthousandAllocSummit = Math.floor(4000 * 150)

      const tenThousandUnlockTime = (await elevationHelper.unlockTimestamp(SUMMIT)).toNumber()
      await mineBlockWithTimestamp(tenThousandUnlockTime)
      await cartographer.rollover(SUMMIT)
      await cartographer.rollover(MESA)
      await cartographer.rollover(PLAINS)

      expect(await cartographer.elevationModulatedAllocation(summitToken.address, OASIS)).to.equal(oasisAllocSummit)
      expect(await cartographer.elevationModulatedAllocation(summitToken.address, PLAINS)).to.equal(twothousandAllocSummit)
      expect(await cartographer.elevationModulatedAllocation(summitToken.address, MESA)).to.equal(fivethousandAllocSummit)
      expect(await cartographer.elevationModulatedAllocation(summitToken.address, SUMMIT)).to.equal(tenthousandAllocSummit)

      const oasisAllocCake = Math.floor(100 * 100)
      const twothousandAllocCake = Math.floor(100 * 110)
      const fivethousandAllocCake = Math.floor(100 * 125)
      const tenthousandAllocCake = Math.floor(100 * 150)

      expect(await cartographer.elevationModulatedAllocation(cakeToken.address, OASIS)).to.equal(oasisAllocCake)
      expect(await cartographer.elevationModulatedAllocation(cakeToken.address, PLAINS)).to.equal(twothousandAllocCake)
      expect(await cartographer.elevationModulatedAllocation(cakeToken.address, MESA)).to.equal(fivethousandAllocCake)
      expect(await cartographer.elevationModulatedAllocation(cakeToken.address, SUMMIT)).to.equal(tenthousandAllocCake)
    })
    it('Pools can be disabled and reenabled', async function() {
      await twoThousandUnlockedFixture()
      const { dev } = await getNamedSigners(hre)
      const cartographer = await getCartographer()
      const summitToken = await getSummitToken()

      const oasisAllocSummit = 4000
      const oasisAllocBefore = await cartographer.elevAlloc(OASIS)
      const summitTokenAlloc = await cartographer.tokenAlloc(summitToken.address)
      expect(await cartographer.elevationModulatedAllocation(summitToken.address, OASIS)).to.equal(oasisAllocSummit * 100)
      await cartographer.connect(dev).set(summitToken.address, OASIS, false, true)

      const oasisAllocAfter = await cartographer.elevAlloc(OASIS)
      expect(await cartographer.elevationModulatedAllocation(summitToken.address, OASIS)).to.equal(0)
      expect(oasisAllocBefore.sub(oasisAllocAfter)).to.equal(oasisAllocSummit)
      expect(await cartographer.tokenAlloc(summitToken.address)).to.equal(summitTokenAlloc)

      await cartographer.connect(dev).set(summitToken.address, OASIS, true, true)

      const oasisAllocFinal = await cartographer.elevAlloc(OASIS)
      expect(await cartographer.elevationModulatedAllocation(summitToken.address, OASIS)).to.equal(oasisAllocSummit * 100)
      expect(oasisAllocFinal.sub(oasisAllocAfter)).to.equal(oasisAllocSummit)
      expect(await cartographer.tokenAlloc(summitToken.address)).to.equal(summitTokenAlloc)
    })
    it('Tokens total alloc points can be updated', async function() {
      await twoThousandUnlockedFixture()
      const { dev } = await getNamedSigners(hre)
      const cartographer = await getCartographer()
      const summitToken = await getSummitToken()

      const oasisAllocBefore = await cartographer.elevAlloc(OASIS)
      const oasisAllocSummit = 4000
      const summitTokenAlloc = await cartographer.tokenAlloc(summitToken.address)
      consoleLog({
        summitTokenAlloc: summitTokenAlloc.toString(),
        oasisAllocBefore: oasisAllocBefore.toString(),
        oasisAllocSummit,
      })
      expect(await cartographer.elevationModulatedAllocation(summitToken.address, OASIS)).to.equal(oasisAllocSummit * 100)
      
      await cartographer.connect(dev).setTokenAlloc(summitToken.address, 0)
      
      expect(await cartographer.tokenAlloc(summitToken.address)).to.equal(0)
      expect(await cartographer.elevationModulatedAllocation(summitToken.address, OASIS)).to.equal(0)
      const oasisAllocAfter = await cartographer.elevAlloc(OASIS)
      expect(oasisAllocBefore.sub(oasisAllocAfter)).to.equal(summitTokenAlloc)

      await cartographer.connect(dev).setTokenAlloc(summitToken.address, summitTokenAlloc.div(2))

      expect(await cartographer.elevationModulatedAllocation(summitToken.address, OASIS)).to.equal((oasisAllocSummit * 100) / 2)
      const oasisAllocFinal = await cartographer.elevAlloc(OASIS)
      expect(oasisAllocFinal.sub(oasisAllocAfter)).to.equal(summitTokenAlloc.div(2))

      consoleLog({
        oasisAllocBefore: oasisAllocBefore.toString(),
        oasisAllocAfter: oasisAllocAfter.toString(),
        oasisAllocFinal: oasisAllocFinal.toString(),
      })

      expect(true).to.be.true
    })
  })
});
