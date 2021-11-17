import { BigNumber } from "@ethersproject/bignumber";
import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { consoleLog, ERR, EVENT, FIVETHOUSAND, mineBlockWithTimestamp, OASIS, PID, rolloverRound, TENTHOUSAND, TWOTHOUSAND, ZEROADD } from "../utils";
import { baseFixture, twoThousandUnlockedFixture } from "./fixtures";

let pid: BigNumber

describe("Base Pools", function() {
  describe('- Pool Creation', async function() {
    it('Pool creation without a token alloc should fail', async function() {
      const { dev, summitToken, cartographer } = await baseFixture() 
      await expect(
        cartographer.connect(dev).add(summitToken.address, OASIS, true, 0, true)
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
        cartographer.connect(dev).add(summitToken.address, OASIS, true, 0, true)
      ).to.be.revertedWith(ERR.INVALID_TOKEN_ALLOC)
    })
    it('Non-Admin pool creation should fail', async function() {
      const { dev, user1, summitToken, cartographer } = await baseFixture()
      await expect(
        cartographer.connect(dev).createTokenAllocation(summitToken.address, 4000)
      ).to.emit(cartographer, EVENT.TokenAllocCreated).withArgs(summitToken.address, 4000)
      await expect(
        cartographer.connect(user1).add(summitToken.address, OASIS, true, 0, true)
      ).to.be.revertedWith(ERR.NON_OWNER)
    })
    it('Admin pool creation should succeed', async function() {
      const { dev, summitToken, cartographer } = await baseFixture()
      await expect(
        cartographer.connect(dev).createTokenAllocation(summitToken.address, 4000)
      ).to.emit(cartographer, EVENT.TokenAllocCreated).withArgs(summitToken.address, 4000)
      await expect(
        cartographer.connect(dev).add(summitToken.address, OASIS, true, 0, true)
      ).to.emit(cartographer, EVENT.PoolCreated).withArgs(1, 0, summitToken.address)
    })
    it(`Deploying another OASIS SUMMIT Pool should fail with error ${ERR.DUPLICATED}`, async function() {
      const { dev } = await getNamedSigners(hre)
      const summitToken = await ethers.getContract('SummitToken')
      const cartographer = await ethers.getContract('Cartographer')
      await expect(
        cartographer.add(summitToken.address, OASIS, true, 0, true)
      ).to.be.revertedWith(ERR.DUPLICATED)
    })
  })
  describe("- Pool Verification", async function() {
    before(async function () {
      const { summitToken, dummyCakeToken, cartographer } = await baseFixture()
      pid = await cartographer.poolsCount()
      await cartographer.createTokenAllocation(summitToken.address, 4000)
      await cartographer.createTokenAllocation(dummyCakeToken.address, 100)
      await cartographer.add(summitToken.address, OASIS, true, 0, true)
      await cartographer.add(summitToken.address, TWOTHOUSAND, true, 0, true)
      await cartographer.add(summitToken.address, FIVETHOUSAND, true, 0, true)
      await cartographer.add(summitToken.address, TENTHOUSAND, true, 0, true)
      await cartographer.add(dummyCakeToken.address, OASIS, true, 0, true)
      await cartographer.add(dummyCakeToken.address, TWOTHOUSAND, true, 0, true)
      await cartographer.add(dummyCakeToken.address, FIVETHOUSAND, true, 0, true)
      await cartographer.add(dummyCakeToken.address, TENTHOUSAND, true, 0, true)
    })
    it('Number of pools should be correct', async function() {  
      const cartographer = await ethers.getContract('Cartographer')
      expect(await cartographer.poolsCount()).to.equal(9)
    })
    it('Pool Allocation Points should be correct', async function () {
      const cartographer = await ethers.getContract('Cartographer')
      const cartographerElevation = await ethers.getContract('CartographerElevation')
      const elevationHelper = await ethers.getContract('ElevationHelper')

      const oasisAllocSummit = Math.floor(4000 * 100)
      const twothousandAllocSummit = Math.floor(4000 * 110)
      const fivethousandAllocSummit = Math.floor(4000 * 125)
      const tenthousandAllocSummit = Math.floor(4000 * 150)

      const tenThousandUnlockTime = (await elevationHelper.unlockTimestamp(TENTHOUSAND)).toNumber()
      await mineBlockWithTimestamp(tenThousandUnlockTime)
      await cartographer.rollover(TENTHOUSAND)
      await cartographer.rollover(FIVETHOUSAND)
      await cartographer.rollover(TWOTHOUSAND)

      expect(await cartographer.elevationModulatedAllocation(1)).to.equal(oasisAllocSummit)
      expect(await cartographer.elevationModulatedAllocation(2)).to.equal(twothousandAllocSummit)
      expect(await cartographer.elevationModulatedAllocation(3)).to.equal(fivethousandAllocSummit)
      expect(await cartographer.elevationModulatedAllocation(4)).to.equal(tenthousandAllocSummit)

      const oasisAllocCake = Math.floor(100 * 100)
      const twothousandAllocCake = Math.floor(100 * 110)
      const fivethousandAllocCake = Math.floor(100 * 125)
      const tenthousandAllocCake = Math.floor(100 * 150)

      expect(await cartographer.elevationModulatedAllocation(5)).to.equal(oasisAllocCake)
      expect(await cartographer.elevationModulatedAllocation(6)).to.equal(twothousandAllocCake)
      expect(await cartographer.elevationModulatedAllocation(7)).to.equal(fivethousandAllocCake)
      expect(await cartographer.elevationModulatedAllocation(8)).to.equal(tenthousandAllocCake)
    })
    it('Pools can be disabled and reenabled', async function() {
      await twoThousandUnlockedFixture()
      const { dev } = await getNamedSigners(hre)
      const cartographer = await ethers.getContract('Cartographer')
      const summitToken = await ethers.getContract('SummitToken')

      const oasisAllocSummit = Math.floor(4000 * 100)
      const totalAllocBefore = await cartographer.totalSharedAlloc()
      const summitTokenBaseAlloc = await cartographer.tokenBaseAlloc(summitToken.address)
      const summitTokenSharedAlloc = await cartographer.tokenSharedAlloc(summitToken.address)
      expect(await cartographer.elevationModulatedAllocation(PID.SUMMIT_OASIS)).to.equal(oasisAllocSummit)
      await cartographer.connect(dev).set(PID.SUMMIT_OASIS, false, 0, true)

      const totalAllocAfter = await cartographer.totalSharedAlloc()
      expect(await cartographer.elevationModulatedAllocation(PID.SUMMIT_OASIS)).to.equal(0)
      expect(totalAllocBefore.sub(totalAllocAfter)).to.equal(oasisAllocSummit)
      expect(await cartographer.tokenBaseAlloc(summitToken.address)).to.equal(summitTokenBaseAlloc)
      expect(summitTokenSharedAlloc.sub(await cartographer.tokenSharedAlloc(summitToken.address))).to.equal(oasisAllocSummit)

      await cartographer.connect(dev).set(PID.SUMMIT_OASIS, true, 0, true)

      const totalAllocFinal = await cartographer.totalSharedAlloc()
      expect(await cartographer.elevationModulatedAllocation(PID.SUMMIT_OASIS)).to.equal(oasisAllocSummit)
      expect(totalAllocFinal.sub(totalAllocAfter)).to.equal(oasisAllocSummit)
      expect(await cartographer.tokenBaseAlloc(summitToken.address)).to.equal(summitTokenBaseAlloc)
      expect(await cartographer.tokenSharedAlloc(summitToken.address)).to.equal(summitTokenSharedAlloc)
    })
    it('Tokens total alloc points can be updated', async function() {
      await twoThousandUnlockedFixture()
      const { dev } = await getNamedSigners(hre)
      const cartographer = await ethers.getContract('Cartographer')
      const summitToken = await ethers.getContract('SummitToken')

      const totalAllocBefore = await cartographer.totalSharedAlloc()
      const oasisAllocSummit = Math.floor(4000 * 100)
      const summitTokenBaseAlloc = await cartographer.tokenBaseAlloc(summitToken.address)
      const summitTokenSharedAlloc = await cartographer.tokenSharedAlloc(summitToken.address)
      consoleLog({
        summitTokenBaseAlloc: summitTokenBaseAlloc.toString(),
        totalAllocBefore: totalAllocBefore.toString(),
        oasisAllocSummit,
        summitTokenSharedAlloc: summitTokenSharedAlloc.toString()
      })
      expect(await cartographer.elevationModulatedAllocation(PID.SUMMIT_OASIS)).to.equal(oasisAllocSummit)
      
      await cartographer.connect(dev).setTokenSharedAlloc(summitToken.address, 0)
      
      expect(await cartographer.tokenSharedAlloc(summitToken.address)).to.equal(0)
      expect(await cartographer.elevationModulatedAllocation(PID.SUMMIT_OASIS)).to.equal(0)
      const totalAllocAfter = await cartographer.totalSharedAlloc()
      expect(totalAllocBefore.sub(totalAllocAfter)).to.equal(summitTokenSharedAlloc)

      await cartographer.connect(dev).setTokenSharedAlloc(summitToken.address, summitTokenBaseAlloc.div(2))

      expect(await cartographer.tokenSharedAlloc(summitToken.address)).to.equal(summitTokenSharedAlloc.div(2))
      expect(await cartographer.elevationModulatedAllocation(PID.SUMMIT_OASIS)).to.equal(oasisAllocSummit / 2)
      const totalAllocFinal = await cartographer.totalSharedAlloc()
      expect(totalAllocFinal.sub(totalAllocAfter)).to.equal(summitTokenSharedAlloc.div(2))

      consoleLog({
        totalAllocBefore: totalAllocBefore.toString(),
        totalAllocAfter: totalAllocAfter.toString(),
        totalAllocFinal: totalAllocFinal.toString(),
      })

      expect(true).to.be.true
    })
  })
});
