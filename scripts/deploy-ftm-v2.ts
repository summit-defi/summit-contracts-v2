import hre, { ethers, getChainId } from 'hardhat'
import { getPoolConfigs } from '../data';
import { Contracts, everestMethod, expeditionMethod, getCartographer, getElevationHelper, getExpedition, getTimelock, pausableGet, pausableMethod } from '../utils';
import { ElevationHelperSigs } from '../utils/timelockConstants';
import { syncPools, syncTimelockFunctionSpecificDelays, transferContractOwnershipToTimelock } from './scriptUtils';

const DeployStep = {
  None: 0,
  DeployContracts: 1,
  PauseSummitTokenV2: 2,
  EverestWhitelistCartographer: 3,
  CreatePools: 4,
  InitializeExpedition: 5,
  InitializeTimelock: 6,
  TransferContractOwnershipToTimelock: 7,
}

const ftmUsdcAddress = '0x04068da6c83afcfa0e13ba15a6696662335d5b75'


async function main() {
  const completedDeployStep = DeployStep.InitializeExpedition
  console.log(' == Deploying Summit Ecosystem to FTM Mainnet ==\n')


  console.log(' -- Deploy Contracts -- ')
  if (completedDeployStep < DeployStep.DeployContracts) {
    await hre.run('deploy', { tags: 'MAINNET' })
  }
  console.log('\tdone.\n')
  
  const { dev } = await ethers.getNamedSigners()
  const Cartographer = await getCartographer()

  const chainId = await getChainId()
  const mainnetPools = getPoolConfigs(chainId)




  console.log(' -- Pause SUMMIT V2 Token --')
  if (completedDeployStep < DeployStep.PauseSummitTokenV2) {
    const paused = await pausableGet.paused(Contracts.SummitToken)
    if (paused) {
      console.log('\tpassed.\n')
    } else {
      await pausableMethod.pause({
        admin: dev,
        contractName: Contracts.SummitToken
      })
      console.log('\tdone.\n')
    } 
  }



  console.log(' -- Whitelist Cartographer as Everest Target -- ')
  if (completedDeployStep < DeployStep.EverestWhitelistCartographer) {
    await everestMethod.addWhitelistedTransferAddress({
      dev,
      whitelistedAddress: Cartographer.address
    })
  }
  console.log('\tdone.\n')




  // console.log(' -- Create Pools -- ')
  // if (completedDeployStep < DeployStep.CreatePools) {
  //   await syncPools(mainnetPools)

  //   const massUpdateTx = await Cartographer.massUpdatePools()
  //   await massUpdateTx.wait(10)
  // }
  // console.log('\tdone.\n')




  // console.log(' -- Initialize Expedition -- ')
  // if (completedDeployStep < DeployStep.InitializeExpedition) {
  //   const elevationHelper = await getElevationHelper()
  //   const expedition = await getExpedition()

  //   await expeditionMethod.initialize({
  //     dev,
  //     usdcAddress: ftmUsdcAddress,
  //     elevationHelperAddress: elevationHelper.address
  //   })
  //   console.log('Expedition V2 Initialized')

  //   // Add ExpeditionV2 as an EverestExtension
  //   await everestMethod.addEverestExtension({
  //     dev,
  //     extension: expedition.address
  //   })
  //   console.log('ExpeditionV2 Added as everest Extension')
  // }
  // console.log('\tdone.\n')

  


  console.log(' -- Initialize Timelock -- ')
  if (completedDeployStep < DeployStep.InitializeTimelock) {
    // const timelock = await getTimelock()
    // await timelock.connect(dev).setPendingAdmin(dev.address)
    // await timelock.connect(dev).acceptAdmin()
    await syncTimelockFunctionSpecificDelays()
  }
  console.log('\tdone.\n')




  // console.log(' -- Transfer Contract Ownership to Timelock -- ')
  // if (completedDeployStep < DeployStep.TransferContractOwnershipToTimelock) {
  //   await transferContractOwnershipToTimelock()
  // }
  // console.log('\tdone.\n')





  console.log(' == Deployment Complete ==')
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
