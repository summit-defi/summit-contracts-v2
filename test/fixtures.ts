import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { Contract } from "ethers";
import { deployments } from "hardhat";
import { OASIS, PLAINS, MESA, SUMMIT, EXPEDITION, INF_APPROVE, e18, mineBlockWithTimestamp, getSeeds, mineBlocks, TOKEN_FEE, Contracts, getSubCartographers, promiseSequenceMap } from "../utils";

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
  readonly subCartographers: Contract[]
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
  const summitToken = await ethers.getContract(Contracts.SummitToken)
  const dummySummitLpToken = await ethers.getContract(Contracts.DummySUMMITLP)
  const dummyCakeToken = await ethers.getContract(Contracts.DummyCAKE)
  const dummyMasterChef = await ethers.getContract(Contracts.DummyMasterChef)
  const masterChefPassthrough = await ethers.getContract(Contracts.MasterChefPassthrough)
  const dummyBifiToken = await ethers.getContract(Contracts.DummyBIFI)
  const dummyVault = await ethers.getContract(Contracts.DummyVault)
  const bifiVaultPassthrough = await ethers.getContract(Contracts.BeefyVaultV6Passthrough)
  const cartographer = await ethers.getContract(Contracts.Cartographer)
  const subCartographers = await getSubCartographers()
  const elevationHelper = await ethers.getContract(Contracts.ElevationHelper)
  const summitReferrals = await ethers.getContract(Contracts.SummitReferrals)
  const timelock = await ethers.getContract(Contracts.Timelock)
  const everestToken = await ethers.getContract(Contracts.EverestToken)
  const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)

  // APPROVALS
  await summitToken.connect(user1).approve(cartographer.address, INF_APPROVE)
  await summitToken.connect(user2).approve(cartographer.address, INF_APPROVE)
  await summitToken.connect(user3).approve(cartographer.address, INF_APPROVE)

  await dummyCakeToken.connect(user1).approve(cartographer.address, INF_APPROVE)
  await dummyCakeToken.connect(user2).approve(cartographer.address, INF_APPROVE)
  await dummyCakeToken.connect(user3).approve(cartographer.address, INF_APPROVE)

  await dummyBifiToken.connect(user1).approve(cartographer.address, INF_APPROVE)
  await dummyBifiToken.connect(user2).approve(cartographer.address, INF_APPROVE)
  await dummyBifiToken.connect(user3).approve(cartographer.address, INF_APPROVE)

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
    subCartographers,
    elevationHelper,
    summitReferrals,
    timelock,
    everestToken,
    expeditionV2,
  }
})

export const poolsFixture = deployments.createFixture(async (): Promise<FixtureState> => {
  const baseFixtureState = await baseFixture();

  const { cartographer, subCartographers, summitToken, dummyCakeToken, dummyBifiToken, bifiVaultPassthrough, user1, user2, user3 } = baseFixtureState

  // POOLS
  await cartographer.createTokenAllocation(summitToken.address, 4000)
  await cartographer.createTokenAllocation(dummyCakeToken.address, 100)
  await cartographer.createTokenAllocation(dummyBifiToken.address, 150)
  await cartographer.add(summitToken.address, OASIS, true, true)
  await cartographer.add(summitToken.address, PLAINS, true, true)
  await cartographer.add(summitToken.address, MESA, true, true)
  await cartographer.add(summitToken.address, SUMMIT, true, true)
  await cartographer.add(dummyCakeToken.address, OASIS, true, true)
  await cartographer.add(dummyCakeToken.address, PLAINS, true, true)
  await cartographer.add(dummyCakeToken.address, MESA, true, true)
  await cartographer.add(dummyCakeToken.address, SUMMIT, true, true)
  await cartographer.add(dummyBifiToken.address, OASIS, true, true)
  await cartographer.add(dummyBifiToken.address, PLAINS, true, true)
  await cartographer.add(dummyBifiToken.address, MESA, true, true)
  await cartographer.add(dummyBifiToken.address, SUMMIT, true, true)

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
  const twoThousandUnlockTime = (await elevationHelper.unlockTimestamp(PLAINS)).toNumber()
  await mineBlockWithTimestamp(twoThousandUnlockTime)
  await cartographer.rollover(PLAINS)

  const { unsealedSeed, sealedSeed } = getSeeds('throwaway', trustedSeeder.address)

  await elevationHelper.connect(trustedSeeder).receiveSealedSeed(sealedSeed)
  await mineBlocks(3)
  await elevationHelper.connect(trustedSeeder).receiveUnsealedSeed(unsealedSeed)


  return oasisUnlockedFixtureState
})

export const fiveThousandUnlockedFixture = deployments.createFixture(async (): Promise<FixtureState> => {
  const twoThousandUnlockedFixtureState = await twoThousandUnlockedFixture();

  const { elevationHelper, cartographer } = twoThousandUnlockedFixtureState
  const fiveThousandUnlockTime = (await elevationHelper.unlockTimestamp(MESA)).toNumber()
  await mineBlockWithTimestamp(fiveThousandUnlockTime)
  await cartographer.rollover(MESA)

  return twoThousandUnlockedFixtureState
})

export const tenThousandUnlockedFixture = deployments.createFixture(async (): Promise<FixtureState> => {
  const fiveThousandUnlockedFixtureState = await fiveThousandUnlockedFixture();

  const { elevationHelper, cartographer } = fiveThousandUnlockedFixtureState
  const tenThousandUnlockTime = (await elevationHelper.unlockTimestamp(SUMMIT)).toNumber()
  await mineBlockWithTimestamp(tenThousandUnlockTime)
  await cartographer.rollover(SUMMIT)

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

  const { dev, cartographer, subCartographers, timelock } = expeditionUnlockedFixtureState

  await cartographer.connect(dev).transferOwnership(timelock.address)
  await promiseSequenceMap(
    subCartographers,
    async (subCart) => subCart.connect(dev).transferOwnership(dev.address)
  )
  await timelock.connect(dev).setPendingAdmin(dev.address)
  await timelock.connect(dev).acceptAdmin()

  return expeditionUnlockedFixtureState
})