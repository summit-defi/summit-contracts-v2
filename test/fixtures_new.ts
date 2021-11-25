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
  readonly summitToken: Contract
  readonly trustedSeeder: SignerWithAddress
  readonly cartographer: Contract
  readonly cartographerElevation: Contract
}

export const baseFixture = deployments.createFixture(async (hre, options): Promise<FixtureState> => {
  const { deployments, ethers } = hre
  await deployments.all()
  await deployments.fixture();
  const { dev, exped, user1, user2, user3, trustedSeeder } = await getNamedSigners(hre)
  const summitToken = await ethers.getContract('SummitToken')
  const cartographer = await ethers.getContract('Cartographer')
  const cartographerElevation = await ethers.getContract('CartographerElevation')


  // APPROVALS
  await summitToken.connect(user1).approve(cartographer.address, INF_APPROVE)
  await summitToken.connect(user2).approve(cartographer.address, INF_APPROVE)
  await summitToken.connect(user3).approve(cartographer.address, INF_APPROVE)

  return {
    dev,
    exped,
    user1,
    user2,
    user3,
    trustedSeeder,
    summitToken,
    cartographer,
    cartographerElevation    
  }
})

export const poolsFixture = deployments.createFixture(async (): Promise<FixtureState> => {
  const baseFixtureState = await baseFixture();

  const { cartographer, summitToken } = baseFixtureState

  // POOLS
  await cartographer.createTokenAllocation(summitToken.address, 4000)
  await cartographer.add(summitToken.address, OASIS, true, 0, true)
  await cartographer.add(summitToken.address, TWOTHOUSAND, true, 0, true)
  await cartographer.add(summitToken.address, FIVETHOUSAND, true, 0, true)
  await cartographer.add(summitToken.address, TENTHOUSAND, true, 0, true)

  return baseFixtureState
})