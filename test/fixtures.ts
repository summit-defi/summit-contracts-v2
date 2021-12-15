import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { Contract } from "ethers";
import { deployments } from "hardhat";
import { OASIS, PLAINS, MESA, SUMMIT, EXPEDITION, INF_APPROVE, e18, mineBlockWithTimestamp, getSeeds, mineBlocks, TOKEN_FEE, Contracts, getSubCartographers, promiseSequenceMap, getBifiToken, getBifiVault, getBifiVaultPassthrough, getCakeToken, getCartographer, getElevationHelper, getEverestToken, getExpedition, getMasterChef, getMasterChefPassthrough, getSummitReferrals, getSummitToken, getTimelock, elevationHelperGet, getSummitTrustedSeeder, expeditionMethod, rolloverRound, getDummyEverestExtension, getSummitLocking } from "../utils";

interface FixtureState {
  readonly dev: SignerWithAddress
  readonly exped: SignerWithAddress
  readonly user1: SignerWithAddress
  readonly user2: SignerWithAddress
  readonly user3: SignerWithAddress
  readonly trustedSeeder: SignerWithAddress
  readonly summitToken: Contract
  readonly cakeToken: Contract
  readonly dummyMasterChef: Contract
  readonly masterChefPassthrough: Contract
  readonly bifiToken: Contract
  readonly dummyVault: Contract
  readonly bifiVaultPassthrough: Contract
  readonly cartographer: Contract
  readonly subCartographers: Contract[]
  readonly elevationHelper: Contract
  readonly summitTrustedSeederRNGModule: Contract
  readonly summitReferrals: Contract
  readonly summitLocking: Contract
  readonly timelock: Contract
  readonly everestToken: Contract
  readonly expeditionV2: Contract
  readonly dummyEverestExtension: Contract
}

export const baseFixture = deployments.createFixture(async (hre, options): Promise<FixtureState> => {
  const { deployments, ethers } = hre
  await deployments.all()
  await deployments.fixture();
  const { dev, exped, user1, user2, user3, trustedSeeder } = await getNamedSigners(hre)
  const summitToken = await getSummitToken()
  const cakeToken = await getCakeToken()
  const dummyMasterChef = await getMasterChef()
  const masterChefPassthrough = await getMasterChefPassthrough()
  const bifiToken = await getBifiToken()
  const dummyVault = await getBifiVault()
  const bifiVaultPassthrough = await getBifiVaultPassthrough()
  const cartographer = await getCartographer()
  const subCartographers = await getSubCartographers()
  const elevationHelper = await getElevationHelper()
  const summitTrustedSeederRNGModule = await getSummitTrustedSeeder()
  const summitReferrals = await getSummitReferrals()
  const summitLocking = await getSummitLocking()
  const timelock = await getTimelock()
  const everestToken = await getEverestToken()
  const expeditionV2 = await getExpedition()
  const dummyEverestExtension = await getDummyEverestExtension()

  // APPROVALS
  await summitToken.connect(user1).approve(cartographer.address, INF_APPROVE)
  await summitToken.connect(user2).approve(cartographer.address, INF_APPROVE)
  await summitToken.connect(user3).approve(cartographer.address, INF_APPROVE)

  await cakeToken.connect(user1).approve(cartographer.address, INF_APPROVE)
  await cakeToken.connect(user2).approve(cartographer.address, INF_APPROVE)
  await cakeToken.connect(user3).approve(cartographer.address, INF_APPROVE)

  await bifiToken.connect(user1).approve(cartographer.address, INF_APPROVE)
  await bifiToken.connect(user2).approve(cartographer.address, INF_APPROVE)
  await bifiToken.connect(user3).approve(cartographer.address, INF_APPROVE)

  await everestToken.connect(user1).approve(everestToken.address, INF_APPROVE)
  await everestToken.connect(user2).approve(everestToken.address, INF_APPROVE)
  await everestToken.connect(user3).approve(everestToken.address, INF_APPROVE)

  await summitToken.connect(user1).approve(everestToken.address, INF_APPROVE)
  await summitToken.connect(user2).approve(everestToken.address, INF_APPROVE)
  await summitToken.connect(user3).approve(everestToken.address, INF_APPROVE)

  return {
    dev,
    exped,
    user1,
    user2,
    user3,
    trustedSeeder,
    summitToken,
    cakeToken,
    dummyMasterChef,
    masterChefPassthrough,
    bifiToken,
    dummyVault,
    bifiVaultPassthrough,
    cartographer,
    subCartographers,
    elevationHelper,
    summitTrustedSeederRNGModule,
    summitReferrals,
    summitLocking,
    timelock,
    everestToken,
    expeditionV2,
    dummyEverestExtension,
  }
})

export const poolsFixture = deployments.createFixture(async (): Promise<FixtureState> => {
  const baseFixtureState = await baseFixture();

  const { cartographer, subCartographers, summitToken, cakeToken, bifiToken, bifiVaultPassthrough, user1, user2, user3 } = baseFixtureState

  // POOLS
  await cartographer.createTokenAllocation(summitToken.address, 4000)
  await cartographer.createTokenAllocation(cakeToken.address, 100)
  await cartographer.createTokenAllocation(bifiToken.address, 150)
  await cartographer.add(summitToken.address, OASIS, true, true)
  await cartographer.add(summitToken.address, PLAINS, true, true)
  await cartographer.add(summitToken.address, MESA, true, true)
  await cartographer.add(summitToken.address, SUMMIT, true, true)
  await cartographer.add(cakeToken.address, OASIS, true, true)
  await cartographer.add(cakeToken.address, PLAINS, true, true)
  await cartographer.add(cakeToken.address, MESA, true, true)
  await cartographer.add(cakeToken.address, SUMMIT, true, true)
  await cartographer.add(bifiToken.address, OASIS, true, true)
  await cartographer.add(bifiToken.address, PLAINS, true, true)
  await cartographer.add(bifiToken.address, MESA, true, true)
  await cartographer.add(bifiToken.address, SUMMIT, true, true)

  return baseFixtureState
})

export const oasisUnlockedFixture = deployments.createFixture(async (): Promise<FixtureState> => {
  const poolsFixtureState = await poolsFixture();

  const { dev, cartographer } = poolsFixtureState
  await cartographer.connect(dev).enable();

  return poolsFixtureState
})

export const plainsUnlockedFixture = deployments.createFixture(async (): Promise<FixtureState> => {
  const oasisUnlockedFixtureState = await oasisUnlockedFixture();

  const { summitTrustedSeederRNGModule, cartographer, trustedSeeder } = oasisUnlockedFixtureState
  const twoThousandUnlockTime = await elevationHelperGet.unlockTimestamp(PLAINS)
  await mineBlockWithTimestamp(twoThousandUnlockTime)
  await cartographer.rollover(PLAINS)

  const { unsealedSeed, sealedSeed } = getSeeds('throwaway', trustedSeeder.address)

  await summitTrustedSeederRNGModule.connect(trustedSeeder).receiveSealedSeed(sealedSeed)
  await mineBlocks(3)
  await summitTrustedSeederRNGModule.connect(trustedSeeder).receiveUnsealedSeed(unsealedSeed)


  return oasisUnlockedFixtureState
})

export const mesaUnlockedFixture = deployments.createFixture(async (): Promise<FixtureState> => {
  const twoThousandUnlockedFixtureState = await plainsUnlockedFixture();

  const { cartographer } = twoThousandUnlockedFixtureState
  const fiveThousandUnlockTime = await elevationHelperGet.unlockTimestamp(MESA)
  await mineBlockWithTimestamp(fiveThousandUnlockTime)
  await cartographer.rollover(MESA)

  return twoThousandUnlockedFixtureState
})

export const summitUnlockedFixture = deployments.createFixture(async (): Promise<FixtureState> => {
  const fiveThousandUnlockedFixtureState = await mesaUnlockedFixture();

  const { cartographer } = fiveThousandUnlockedFixtureState
  const tenThousandUnlockTime = await elevationHelperGet.unlockTimestamp(SUMMIT)
  await mineBlockWithTimestamp(tenThousandUnlockTime)
  await cartographer.rollover(SUMMIT)

  return fiveThousandUnlockedFixtureState
})

export const expeditionUnlockedFixture = deployments.createFixture(async (): Promise<FixtureState> => {
  const tenThousandUnlockedFixtureState = await summitUnlockedFixture();

  const expeditionUnlockTime = await elevationHelperGet.unlockTimestamp(EXPEDITION)
  await mineBlockWithTimestamp(expeditionUnlockTime)
  await rolloverRound(EXPEDITION)

  return tenThousandUnlockedFixtureState
})

export const timelockedFixture = deployments.createFixture(async (): Promise<FixtureState> => {
  const expeditionUnlockedFixtureState = await summitUnlockedFixture();

  const { dev, cartographer, elevationHelper, everestToken, summitLocking, expeditionV2, summitTrustedSeederRNGModule, timelock } = expeditionUnlockedFixtureState

  await cartographer.connect(dev).transferOwnership(timelock.address)
  await elevationHelper.connect(dev).transferOwnership(timelock.address)
  await everestToken.connect(dev).transferOwnership(timelock.address)
  await summitLocking.connect(dev).transferOwnership(timelock.address)
  await expeditionV2.connect(dev).transferOwnership(timelock.address)
  await summitTrustedSeederRNGModule.connect(dev).transferOwnership(timelock.address)
  await timelock.connect(dev).setPendingAdmin(dev.address)
  await timelock.connect(dev).acceptAdmin()

  return expeditionUnlockedFixtureState
})