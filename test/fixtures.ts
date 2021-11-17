import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { Contract } from "ethers";
import { deployments } from "hardhat";
import { OASIS, TWOTHOUSAND, FIVETHOUSAND, TENTHOUSAND, EXPEDITION, INF_APPROVE, e18, mineBlockWithTimestamp, getSeeds, mineBlocks, POOL_FEE, Contracts } from "../utils";

interface FixtureState {
  readonly dev: SignerWithAddress
  readonly exped: SignerWithAddress
  readonly user1: SignerWithAddress
  readonly user2: SignerWithAddress
  readonly user3: SignerWithAddress
  readonly trustedSeeder: SignerWithAddress
  readonly summitToken: Contract
  readonly dummySummitLpToken: Contract
  readonly dummyCakeToken: Contract
  readonly dummyMasterChef: Contract
  readonly masterChefPassthrough: Contract
  readonly dummyBifiToken: Contract
  readonly dummyVault: Contract
  readonly bifiVaultPassthrough: Contract
  readonly cartographer: Contract
  readonly cartographerOasis: Contract
  readonly cartographerElevation: Contract
  readonly cartographerExpedition: Contract
  readonly elevationHelper: Contract
  readonly summitReferrals: Contract
  readonly timelock: Contract
  readonly everestToken: Contract
  readonly expeditionV2: Contract
}

export const baseFixture = deployments.createFixture(async (hre, options): Promise<FixtureState> => {
  const { deployments, ethers } = hre
  await deployments.all()
  await deployments.fixture();
  const { dev, exped, user1, user2, user3, trustedSeeder } = await getNamedSigners(hre)
  const summitToken = await ethers.getContract('SummitToken')
  const dummySummitLpToken = await ethers.getContract('DummySUMMITLP')
  const dummyCakeToken = await ethers.getContract('DummyCAKE')
  const dummyMasterChef = await ethers.getContract('MasterChef')
  const masterChefPassthrough = await ethers.getContract('MasterChefPassthrough')
  const dummyBifiToken = await ethers.getContract('DummyBIFI')
  const dummyVault = await ethers.getContract('BeefyVaultV6')
  const bifiVaultPassthrough = await ethers.getContract('BeefyVaultV6Passthrough')
  const cartographer = await ethers.getContract('Cartographer')
  const cartographerOasis = await ethers.getContract('CartographerOasis')
  const cartographerElevation = await ethers.getContract('CartographerElevation')
  const cartographerExpedition = await ethers.getContract('CartographerExpedition')
  const elevationHelper = await ethers.getContract('ElevationHelper')
  const summitReferrals = await ethers.getContract('SummitReferrals')
  const timelock = await ethers.getContract('Timelock')
  const everestToken = await ethers.getContract(Contracts.EverestToken)
  const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)

  // APPROVALS
  await summitToken.connect(user1).approve(cartographer.address, INF_APPROVE)
  await summitToken.connect(user2).approve(cartographer.address, INF_APPROVE)
  await summitToken.connect(user3).approve(cartographer.address, INF_APPROVE)
  await summitToken.connect(user1).approve(cartographerExpedition.address, INF_APPROVE)
  await summitToken.connect(user2).approve(cartographerExpedition.address, INF_APPROVE)
  await summitToken.connect(user3).approve(cartographerExpedition.address, INF_APPROVE)

  await dummyCakeToken.connect(user1).approve(cartographer.address, INF_APPROVE)
  await dummyCakeToken.connect(user2).approve(cartographer.address, INF_APPROVE)
  await dummyCakeToken.connect(user3).approve(cartographer.address, INF_APPROVE)
  await dummyCakeToken.connect(user1).approve(cartographerExpedition.address, INF_APPROVE)
  await dummyCakeToken.connect(user2).approve(cartographerExpedition.address, INF_APPROVE)
  await dummyCakeToken.connect(user3).approve(cartographerExpedition.address, INF_APPROVE)

  await dummyBifiToken.connect(user1).approve(cartographer.address, INF_APPROVE)
  await dummyBifiToken.connect(user2).approve(cartographer.address, INF_APPROVE)
  await dummyBifiToken.connect(user3).approve(cartographer.address, INF_APPROVE)
  await dummyBifiToken.connect(user1).approve(cartographerExpedition.address, INF_APPROVE)
  await dummyBifiToken.connect(user2).approve(cartographerExpedition.address, INF_APPROVE)
  await dummyBifiToken.connect(user3).approve(cartographerExpedition.address, INF_APPROVE)

  return {
    dev,
    exped,
    user1,
    user2,
    user3,
    trustedSeeder,
    summitToken,
    dummySummitLpToken,
    dummyCakeToken,
    dummyMasterChef,
    masterChefPassthrough,
    dummyBifiToken,
    dummyVault,
    bifiVaultPassthrough,
    cartographer,
    cartographerOasis,
    cartographerElevation,
    cartographerExpedition,
    elevationHelper,
    summitReferrals,
    timelock,
    everestToken,
    expeditionV2,
  }
})

export const poolsFixture = deployments.createFixture(async (): Promise<FixtureState> => {
  const baseFixtureState = await baseFixture();

  const { cartographer, cartographerOasis, cartographerElevation, cartographerExpedition, summitToken, dummyCakeToken, dummyBifiToken, bifiVaultPassthrough, user1, user2, user3 } = baseFixtureState

  // POOLS
  await cartographer.createTokenAllocation(summitToken.address, 4000)
  await cartographer.createTokenAllocation(dummyCakeToken.address, 100)
  await cartographer.createTokenAllocation(dummyBifiToken.address, 150)
  await cartographer.add(summitToken.address, OASIS, true, 0, true)
  await cartographer.add(summitToken.address, TWOTHOUSAND, true, 0, true)
  await cartographer.add(summitToken.address, FIVETHOUSAND, true, 0, true)
  await cartographer.add(summitToken.address, TENTHOUSAND, true, 0, true)
  await cartographer.add(dummyCakeToken.address, OASIS, true, POOL_FEE.DUMMY_CAKE_OASIS, true)
  await cartographer.add(dummyCakeToken.address, TWOTHOUSAND, true, POOL_FEE.DUMMY_CAKE_2K, true)
  await cartographer.add(dummyCakeToken.address, FIVETHOUSAND, true, POOL_FEE.DUMMY_CAKE_5K, true)
  await cartographer.add(dummyCakeToken.address, TENTHOUSAND, true, POOL_FEE.DUMMY_CAKE_10K, true)
  await cartographer.add(dummyBifiToken.address, OASIS, true, POOL_FEE.DUMMY_BIFI_OASIS, true)
  await cartographer.add(dummyBifiToken.address, TWOTHOUSAND, true, POOL_FEE.DUMMY_BIFI_2K, true)
  await cartographer.add(dummyBifiToken.address, FIVETHOUSAND, true, POOL_FEE.DUMMY_BIFI_5K, true)
  await cartographer.add(dummyBifiToken.address, TENTHOUSAND, true, POOL_FEE.DUMMY_BIFI_10K, true)

  return baseFixtureState
})

export const oasisUnlockedFixture = deployments.createFixture(async (): Promise<FixtureState> => {
  const poolsFixtureState = await poolsFixture();

  const { dev, cartographer } = poolsFixtureState
  await cartographer.connect(dev).enable();

  return poolsFixtureState
})

export const twoThousandUnlockedFixture = deployments.createFixture(async (): Promise<FixtureState> => {
  const oasisUnlockedFixtureState = await oasisUnlockedFixture();

  const { elevationHelper, cartographer, trustedSeeder } = oasisUnlockedFixtureState
  const twoThousandUnlockTime = (await elevationHelper.unlockTimestamp(TWOTHOUSAND)).toNumber()
  await mineBlockWithTimestamp(twoThousandUnlockTime)
  await cartographer.rollover(TWOTHOUSAND)

  const { unsealedSeed, sealedSeed } = getSeeds('throwaway', trustedSeeder.address)

  await elevationHelper.connect(trustedSeeder).receiveSealedSeed(sealedSeed)
  await mineBlocks(3)
  await elevationHelper.connect(trustedSeeder).receiveUnsealedSeed(unsealedSeed)


  return oasisUnlockedFixtureState
})

export const fiveThousandUnlockedFixture = deployments.createFixture(async (): Promise<FixtureState> => {
  const twoThousandUnlockedFixtureState = await twoThousandUnlockedFixture();

  const { elevationHelper, cartographer } = twoThousandUnlockedFixtureState
  const fiveThousandUnlockTime = (await elevationHelper.unlockTimestamp(FIVETHOUSAND)).toNumber()
  await mineBlockWithTimestamp(fiveThousandUnlockTime)
  await cartographer.rollover(FIVETHOUSAND)

  return twoThousandUnlockedFixtureState
})

export const tenThousandUnlockedFixture = deployments.createFixture(async (): Promise<FixtureState> => {
  const fiveThousandUnlockedFixtureState = await fiveThousandUnlockedFixture();

  const { elevationHelper, cartographer } = fiveThousandUnlockedFixtureState
  const tenThousandUnlockTime = (await elevationHelper.unlockTimestamp(TENTHOUSAND)).toNumber()
  await mineBlockWithTimestamp(tenThousandUnlockTime)
  await cartographer.rollover(TENTHOUSAND)

  return fiveThousandUnlockedFixtureState
})

export const expeditionUnlockedFixture = deployments.createFixture(async (): Promise<FixtureState> => {
  const tenThousandUnlockedFixtureState = await tenThousandUnlockedFixture();

  const { elevationHelper, cartographer } = tenThousandUnlockedFixtureState
  const expeditionUnlockTime = (await elevationHelper.unlockTimestamp(EXPEDITION)).toNumber()
  await mineBlockWithTimestamp(expeditionUnlockTime)
  await cartographer.rollover(EXPEDITION)

  return tenThousandUnlockedFixtureState
})

export const timelockedFixture = deployments.createFixture(async (): Promise<FixtureState> => {
  const expeditionUnlockedFixtureState = await tenThousandUnlockedFixture();

  const { dev, cartographer, cartographerExpedition, timelock } = expeditionUnlockedFixtureState

  await cartographer.connect(dev).transferOwnership(timelock.address)
  await cartographerExpedition.connect(dev).transferOwnership(timelock.address)
  await timelock.connect(dev).setPendingAdmin(dev.address)
  await timelock.connect(dev).acceptAdmin()

  return expeditionUnlockedFixtureState
})