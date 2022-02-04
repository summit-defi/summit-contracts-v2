import { getNamedSigners } from '@nomiclabs/hardhat-ethers/dist/src/helpers';
import hre, { getChainId } from 'hardhat'
import { getPoolConfigs } from '../data';
import { allElevationPromiseSequenceMap, Contracts, e18, e6, erc20Method, everestMethod, expeditionMethod, getBifiToken, getCakeToken, getCartographer, getContract, getEverestToken, getExpedition, getSummitToken, getUSDCToken, pausableMethod, PoolConfig, SUMMIT } from '../utils';
import { summitTokenMethod } from '../utils/summitTokenUtils';
import { syncPools } from './scriptUtils';

const DeployStep = {
  None: 0,
  DeployContracts: 1,
  PauseSummitTokenV2: 2,
  EverestWhitelistCartographer: 3,
  CreatePools: 4,
  InitializeExpedition: 5,
  InitializeTimelock: 6,
  SetTimelockDurations: 7,
}


async function main() {
  const completedDeployStep = DeployStep.None
  console.log(' == Deploying Summit Ecosystem to FTM Mainnet ==\n')


  console.log(' -- Deploy Contracts -- ')
  if (completedDeployStep < DeployStep.DeployContracts) {
    await hre.run('deploy', { tags: 'MAINNET' })
  }
  console.log('\tdone.\n')
  
  const { dev } = await getNamedSigners(hre)
  const Cartographer = await getCartographer()

  const chainId = await getChainId()
  const mainnetPools = getPoolConfigs(chainId)




  console.log(' -- Pause SUMMIT V2 Token --')
  if (completedDeployStep < DeployStep.PauseSummitTokenV2) {
    await pausableMethod.pause({
      admin: dev,
      contractName: Contracts.SummitToken
    })
  }
  console.log('\tdone.\n')



  console.log(' -- Whitelist Cartographer as Everest Target -- ')
  if (completedDeployStep < DeployStep.EverestWhitelistCartographer) {
    await everestMethod.addWhitelistedTransferAddress({
      dev,
      whitelistedAddress: Cartographer.address
    })
  }
  console.log('\tdone.\n')




  console.log(' -- Create Pools -- ')
  if (completedDeployStep < DeployStep.CreatePools) {
    await allElevationPromiseSequenceMap(
      async (elevation) => {
        await syncPools(elevation, mainnetPools)
      }
    )

    const massUpdateTx = await Cartographer.massUpdatePools()
    await massUpdateTx.wait(10)
  }
  console.log('\tdone.\n')


  console.log(' -- Initialize Expedition -- ')
  if (completedDeployStep < DeployStep.InitializeExpedition) {
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
