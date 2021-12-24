import { getNamedSigners } from '@nomiclabs/hardhat-ethers/dist/src/helpers';
import hre from 'hardhat'
import { allElevationPromiseSequenceMap, Contracts, e18, e6, erc20Method, expeditionMethod, getBifiToken, getCakeToken, getCartographer, getContract, getEverestToken, getExpedition, getSummitToken, getUSDCToken, PoolConfig } from '../utils';
import { summitTokenMethod } from '../utils/summitTokenUtils';
import { syncPools } from './scriptUtils';

const DeployStep = {
  None: 0,
  DeployContracts: 1,
  CreatePools: 2,
  InitializeExpedition: 3,
}


async function main() {
  const completedDeployStep = DeployStep.CreatePools
  console.log(' == Deploying Summit Ecosystem to BSC Testnet ==\n')


  console.log(' -- Deploy Contracts -- ')
  if (completedDeployStep < DeployStep.DeployContracts) {
    await hre.run('deploy', { tags: 'TESTNET' })
  }
  console.log('\tdone.\n')
  const Cartographer = await getCartographer()


  const summitToken = await getSummitToken()
  const everestToken = await getEverestToken()
  const usdcToken = await getContract('DummyUSDC')
  const bifiToken = await getBifiToken()
  const cakeToken = await getCakeToken()
  let gasStressTokens = [];
  for (let i = 0; i < 6; i++) {
      gasStressTokens.push(await getContract(`GS${i}`));
  }

  const baseElevations = {
    OASIS: { exists: true, live: true },
    PLAINS: { exists: true, live: true },
    MESA: { exists: true, live: true },
    SUMMIT: { exists: true, live: true },
  }

  const testnetPools: PoolConfig[] = [
    {
      name: 'SUMMIT',
      token: summitToken.address,
      allocation: 1500,
      taxBP: 700,
      depositFeeBP: 100,
      native: true,
      elevations: baseElevations,
    },
    {
      name: 'EVEREST',
      token: everestToken.address,
      allocation: 2000,
      taxBP: 0,
      depositFeeBP: 0,
      native: true,
      elevations: baseElevations,
    },
    {
      name: 'CAKE',
      token: cakeToken.address,
      allocation: 300,
      taxBP: 700,
      depositFeeBP: 100,
      native: false,
      elevations: baseElevations,
    },
    {
      name: 'BIFI',
      token: bifiToken.address,
      allocation: 200,
      taxBP: 700,
      depositFeeBP: 100,
      native: false,
      elevations: baseElevations,
    },
    {
      name: 'USDC',
      token: usdcToken.address,
      allocation: 100,
      taxBP: 700,
      depositFeeBP: 100,
      native: false,
      elevations: baseElevations,
    },
    ...gasStressTokens.map((token, index) => ({
      name: `GS${index}`,
      token: token.address,
      allocation: 50,
      taxBP: 700,
      depositFeeBP: 100,
      native: false,
      elevations: baseElevations,
    }))
  ]





  console.log(' -- Create Pools -- ')
  if (completedDeployStep < DeployStep.CreatePools) {
    await allElevationPromiseSequenceMap(
      async (elevation) => await syncPools(elevation, testnetPools)
    )

    const massUpdateTx = await Cartographer.massUpdatePools()
    await massUpdateTx.wait(10)
  }
  console.log('\tdone.\n')


  console.log(' -- Initialize Expedition -- ')
  if (completedDeployStep < DeployStep.InitializeExpedition) {
    const { dev } = await getNamedSigners(hre)
    const dummyUSDC = await getUSDCToken()
    const summitToken = await getSummitToken()
    const expeditionV2 = await getExpedition()

    // MINT USDC
    await erc20Method.dummyMint({
      user: dev,
      tokenName: Contracts.DummyUSDC,
      amount: e6(100000),
    })
    // ADD USDC EXPEDITION FUNDS
    await erc20Method.approve({
      user: dev,
      tokenName: Contracts.DummyUSDC,
      approvalAddress: expeditionV2.address
    })
    await expeditionMethod.addExpeditionFunds({
      user: dev,
      tokenAddress: dummyUSDC.address,
      amount: e6(100000),
    })

    // MINT CAKE, swap for SUMMIT
    await erc20Method.dummyMint({
      user: dev,
      tokenName: Contracts.DummyCAKE,
      amount: e18(1000000),
    })
    await erc20Method.approve({
      user: dev,
      tokenName: Contracts.DummyCAKE,
      approvalAddress: summitToken.address
    })
    await summitTokenMethod.tokenSwap({
      user: dev,
      oldSummitAmount: e18(1000000),
    })
    // ADD SUMMIT EXPEDITION FUNDS    
    await erc20Method.approve({
      user: dev,
      tokenName: Contracts.SummitToken,
      approvalAddress: expeditionV2.address
    })
    await expeditionMethod.addExpeditionFunds({
      user: dev,
      tokenAddress: summitToken.address,
      amount: e18(50000),
    })

    // RECALC EMISSIONS
    await expeditionMethod.recalculateExpeditionEmissions({
      dev
    })
  }
  console.log('\tdone.\n')


  console.log(' == Deployment Complete ==')
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
