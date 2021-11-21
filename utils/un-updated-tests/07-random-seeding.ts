import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { ERR, PLAINS, mineBlockWithTimestamp, Contracts, getSeeds, mineBlock, mineBlocks } from "../utils";
import { twoThousandUnlockedFixture } from "./fixtures";


describe("Seeding Random Numbers", function() {
  before(async function() {
      await twoThousandUnlockedFixture()
  })
  it(`SEEDING: Sending sealed and unsealed seed should fail until nextSeedRoundAvailable returns true`, async function() {
    const { trustedSeeder } = await getNamedSigners(hre)
    const elevationHelper = await ethers.getContract(Contracts.ElevationHelper)

    const { unsealedSeed, sealedSeed } = getSeeds('summit', trustedSeeder.address)

    await expect(
        elevationHelper.connect(trustedSeeder).receiveSealedSeed(sealedSeed)
    ).to.be.revertedWith(ERR.SEEDING.ALREADY_SEALED_SEEDED)

    await mineBlocks(3)

    await expect(
        elevationHelper.connect(trustedSeeder).receiveUnsealedSeed(unsealedSeed)
    ).to.be.revertedWith(ERR.SEEDING.ALREADY_UNSEALED_SEEDED)
  })
  it(`SEEDING: nextSeedRoundAvailable should become true only within 60 seconds of end of round`, async function() {
    const elevationHelper = await ethers.getContract(Contracts.ElevationHelper)

    const nextRoundTime = (await elevationHelper.roundEndTimestamp(PLAINS)).toNumber()

    await mineBlockWithTimestamp(nextRoundTime - 75)
    const nextSeedRoundAvailableFalse = await elevationHelper.nextSeedRoundAvailable()
    expect(nextSeedRoundAvailableFalse).to.be.false

    await mineBlockWithTimestamp(nextRoundTime - 60)
    const nextSeedRoundAvailableTrue = await elevationHelper.nextSeedRoundAvailable()
    expect(nextSeedRoundAvailableTrue).to.be.true    
  })
  it(`SEEDING: Sending a sealed seed should succeed, and nextSeedRoundAvailable should become false`, async function() {
    const { trustedSeeder } = await getNamedSigners(hre)
    const elevationHelper = await ethers.getContract(Contracts.ElevationHelper)

    const { sealedSeed } = getSeeds('summit', trustedSeeder.address)

    await expect(
        elevationHelper.connect(trustedSeeder).receiveSealedSeed(sealedSeed)
    ).to.not.be.reverted

    const nextSeedRoundAvailableFalse = await elevationHelper.nextSeedRoundAvailable()

    expect(nextSeedRoundAvailableFalse).to.be.false
  })
  it(`SEEDING: Sending another sealed seed should fail with error ${ERR.SEEDING.ALREADY_SEALED_SEEDED}`, async function() {
    const { trustedSeeder } = await getNamedSigners(hre)
    const elevationHelper = await ethers.getContract(Contracts.ElevationHelper)

    const { sealedSeed } = getSeeds('summit2', trustedSeeder.address)

    await expect(
        elevationHelper.connect(trustedSeeder).receiveSealedSeed(sealedSeed)
    ).to.be.revertedWith(ERR.SEEDING.ALREADY_SEALED_SEEDED)
  })
  it(`SEEDING: After sealed seed received, the future block mined should become true`, async function() {
    const elevationHelper = await ethers.getContract(Contracts.ElevationHelper)

    const futureBlockMinedFalse = await elevationHelper.futureBlockMined()
    expect(futureBlockMinedFalse).to.be.false

    await mineBlock()

    const futureBlockMinedTrue = await elevationHelper.futureBlockMined()
    expect(futureBlockMinedTrue).to.be.true
  })
  it(`SEEDING: Sending incorrect unsealed seed should fail with error ${ERR.SEEDING.UNSEALED_SEED_NOT_MATCH}`, async function() {
    const { trustedSeeder } = await getNamedSigners(hre)
    const elevationHelper = await ethers.getContract(Contracts.ElevationHelper)

    const { unsealedSeed } = getSeeds('summitWRONG', trustedSeeder.address)

    await expect(
        elevationHelper.connect(trustedSeeder).receiveUnsealedSeed(unsealedSeed)
    ).to.be.revertedWith(ERR.SEEDING.UNSEALED_SEED_NOT_MATCH)
  })
  it(`SEEDING: After future block mined, sending the unsealed seed should succeed`, async function() {
    const { trustedSeeder } = await getNamedSigners(hre)
    const elevationHelper = await ethers.getContract(Contracts.ElevationHelper)

    const { unsealedSeed } = getSeeds('summit', trustedSeeder.address)

    await expect(
        elevationHelper.connect(trustedSeeder).receiveUnsealedSeed(unsealedSeed)
    ).to.not.be.reverted
  })



  it(`SEEDING: Non trusted seeder attempting to seed should fail with error ${ERR.SEEDING.ONLY_TRUSTED_SEEDER}`, async function() {
    const { user1, trustedSeeder } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract(Contracts.Cartographer)
    const elevationHelper = await ethers.getContract(Contracts.ElevationHelper)
    
    const nextRoundTime = (await elevationHelper.roundEndTimestamp(PLAINS)).toNumber()

    await mineBlockWithTimestamp(nextRoundTime)
    await cartographer.rollover(PLAINS)

    const nextSeedRoundTime = (await elevationHelper.roundEndTimestamp(PLAINS)).toNumber()
    await mineBlockWithTimestamp(nextSeedRoundTime - 60)

    const { sealedSeed } = getSeeds('summit', trustedSeeder.address)

    await expect(
        elevationHelper.connect(user1).receiveSealedSeed(sealedSeed)
    ).to.be.revertedWith(ERR.SEEDING.ONLY_TRUSTED_SEEDER)
  })
  it(`SEEDING: Trusted seeding address can be updated`, async function() {
    const { dev, user1, trustedSeeder } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract(Contracts.Cartographer)
    const elevationHelper = await ethers.getContract(Contracts.ElevationHelper)
    
    await cartographer.connect(dev).setTrustedSeederAdd(user1.address)

    const { sealedSeed } = getSeeds('summitUser1', user1.address)

    await expect(
        elevationHelper.connect(trustedSeeder).receiveSealedSeed(sealedSeed)
    ).to.be.revertedWith(ERR.SEEDING.ONLY_TRUSTED_SEEDER)

    await expect(
        elevationHelper.connect(user1).receiveSealedSeed(sealedSeed)
    ).to.not.be.reverted
  })
  it(`SEEDING: Sending unsealed seed before future block reached should fail with error ${ERR.SEEDING.FUTURE_BLOCK_NOT_REACHED}`, async function() {
    // This is tested at end because we already have a new sealed seed sent to elevationHelper
    const { user1 } = await getNamedSigners(hre)
    const elevationHelper = await ethers.getContract(Contracts.ElevationHelper)

    const { unsealedSeed } = getSeeds('summitUser1', user1.address)

    await expect(
        elevationHelper.connect(user1).receiveUnsealedSeed(unsealedSeed)
    ).to.be.revertedWith(ERR.SEEDING.FUTURE_BLOCK_NOT_REACHED)
  })
})
