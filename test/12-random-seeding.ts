import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { ERR, PLAINS, mineBlockWithTimestamp, getSeeds, mineBlock, summitTrustedSeederMethod, elevationHelperGet, summitTrustedSeederGet, rolloverRound, getTimestamp } from "../utils";
import { plainsUnlockedFixture } from "./fixtures";


describe("Seeding Random Numbers", function() {
  before(async function() {
      await plainsUnlockedFixture()
  })
  it(`SEEDING: Sending sealed and unsealed seed should fail until nextSeedRoundAvailable returns true`, async function() {
    const { trustedSeeder } = await ethers.getNamedSigners()
    const { unsealedSeed, sealedSeed } = getSeeds('summit', trustedSeeder.address)

    await summitTrustedSeederMethod.receiveSealedSeed({
      trustedSeeder,
      sealedSeed,
      revertErr: ERR.SEEDING.ALREADY_SEALED_SEEDED
    })

    await summitTrustedSeederMethod.receiveUnsealedSeed({
      trustedSeeder,
      unsealedSeed,
      revertErr: ERR.SEEDING.ALREADY_UNSEALED_SEEDED
    })
  })
  it(`SEEDING: nextSeedRoundAvailable should become true only within 60 seconds of end of round`, async function() {

    const nextRoundTime = await elevationHelperGet.roundEndTimestamp(PLAINS) - 3600
    await mineBlockWithTimestamp(nextRoundTime - 135)

    const seedRound = await summitTrustedSeederGet.seedRound()
    const seedRoundEndTimestamp = await summitTrustedSeederGet.seedRoundEndTimestamp()
    const currentTimestamp = await getTimestamp()
    console.log({
      seedRound,
      seedRoundEndTimestamp,
      currentTimestamp,
      rounds: (currentTimestamp - seedRoundEndTimestamp) / 3600
    })

    const nextSeedRoundAvailableFalse = await summitTrustedSeederGet.nextSeedRoundAvailable()
    console.log({
      nextSeedRoundAvailableFalse
    })
    expect(nextSeedRoundAvailableFalse).to.be.false

    await mineBlockWithTimestamp(nextRoundTime - 120)
    const nextSeedRoundAvailableTrue = await summitTrustedSeederGet.nextSeedRoundAvailable()
    console.log({
      nextSeedRoundAvailableTrue
    })
    expect(nextSeedRoundAvailableTrue).to.be.true    
  })
  it(`SEEDING: Sending a sealed seed should succeed, and nextSeedRoundAvailable should become false`, async function() {
    const { trustedSeeder } = await ethers.getNamedSigners()

    const { sealedSeed } = getSeeds('summit', trustedSeeder.address)

    await summitTrustedSeederMethod.receiveSealedSeed({
      trustedSeeder,
      sealedSeed
    })

    const nextSeedRoundAvailableFalse = await summitTrustedSeederGet.nextSeedRoundAvailable()

    expect(nextSeedRoundAvailableFalse).to.be.false
  })
  it(`SEEDING: Sending another sealed seed should fail with error ${ERR.SEEDING.ALREADY_SEALED_SEEDED}`, async function() {
    const { trustedSeeder } = await ethers.getNamedSigners()

    const { sealedSeed } = getSeeds('summit2', trustedSeeder.address)

    await summitTrustedSeederMethod.receiveSealedSeed({
      trustedSeeder,
      sealedSeed,
      revertErr: ERR.SEEDING.ALREADY_SEALED_SEEDED
    })
  })
  it(`SEEDING: After sealed seed received, the future block mined should become true`, async function() {

    const futureBlockMinedFalse = await summitTrustedSeederGet.futureBlockMined()
    expect(futureBlockMinedFalse).to.be.false

    await mineBlock()

    const futureBlockMinedTrue = await summitTrustedSeederGet.futureBlockMined()
    expect(futureBlockMinedTrue).to.be.true
  })
  it(`SEEDING: Sending incorrect unsealed seed should fail with error ${ERR.SEEDING.UNSEALED_SEED_NOT_MATCH}`, async function() {
    const { trustedSeeder } = await ethers.getNamedSigners()

    const { unsealedSeed } = getSeeds('summitWRONG', trustedSeeder.address)

    await summitTrustedSeederMethod.receiveUnsealedSeed({
      trustedSeeder,
      unsealedSeed,
      revertErr: ERR.SEEDING.UNSEALED_SEED_NOT_MATCH
    })
  })
  it(`SEEDING: After future block mined, sending the unsealed seed should succeed`, async function() {
    const { trustedSeeder } = await ethers.getNamedSigners()

    const { unsealedSeed } = getSeeds('summit', trustedSeeder.address)

    await summitTrustedSeederMethod.receiveUnsealedSeed({
      trustedSeeder,
      unsealedSeed,
    })
  })



  it(`SEEDING: Non trusted seeder attempting to seed should fail with error ${ERR.SEEDING.ONLY_TRUSTED_SEEDER}`, async function() {
    const { user1, trustedSeeder } = await ethers.getNamedSigners()
    
    await rolloverRound(PLAINS)

    const nextSeedRoundTime = await elevationHelperGet.roundEndTimestamp(PLAINS)
    await mineBlockWithTimestamp(nextSeedRoundTime - 60)

    const { sealedSeed } = getSeeds('summit', trustedSeeder.address)

    await summitTrustedSeederMethod.receiveSealedSeed({
      trustedSeeder: user1,
      sealedSeed,
      revertErr: ERR.SEEDING.ONLY_TRUSTED_SEEDER
    })
  })
  it(`SEEDING: Trusted seeding address can be updated`, async function() {
    const { dev, user1, trustedSeeder } = await ethers.getNamedSigners()
    
    await summitTrustedSeederMethod.setTrustedSeederAdd({
      dev,
      trustedSeeder: user1.address
    })

    const { sealedSeed } = getSeeds('summitUser1', user1.address)

    await summitTrustedSeederMethod.receiveSealedSeed({
      trustedSeeder,
      sealedSeed,
      revertErr: ERR.SEEDING.ONLY_TRUSTED_SEEDER
    })

    await summitTrustedSeederMethod.receiveSealedSeed({
      trustedSeeder: user1,
      sealedSeed,
    })
  })
  it(`SEEDING: Sending unsealed seed before future block reached should fail with error ${ERR.SEEDING.FUTURE_BLOCK_NOT_REACHED}`, async function() {
    // This is tested at end because we already have a new sealed seed sent to elevationHelperGet
    const { user1 } = await ethers.getNamedSigners()

    const { unsealedSeed } = getSeeds('summitUser1', user1.address)

    await summitTrustedSeederMethod.receiveUnsealedSeed({
      trustedSeeder: user1,
      unsealedSeed,
      revertErr: ERR.SEEDING.FUTURE_BLOCK_NOT_REACHED
    })
  })
})
