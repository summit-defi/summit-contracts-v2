import hre, { deployments, ethers, getChainId } from 'hardhat'
import { getPoolConfigs } from '../data';
import { chainIdAMMFactory, chainIdAMMPairCodeHash, chainIdWrappedNativeToken, Contracts, delay, everestGet, everestMethod, expeditionGet, expeditionMethod, getCartographer, getElevationHelper, getExpedition, getSummitToken, getTimelock, getWrittenContractAddress, pausableGet, pausableMethod, writeContractAddresses, ZEROADD } from '../utils';
import { ElevationHelperSigs } from '../utils/timelockConstants';
import { createLpPair, syncPools, syncTimelockFunctionSpecificDelays, transferContractOwnershipToTimelock } from './scriptUtils';

const DeployStep = {
  None: 0,
  DeployContracts: 1,
  CreateSummitLpPair: 2,
  EverestWhitelistCartographer: 3,
  CreatePools: 4,
  InitializeExpedition: 5,
  InitializeTimelock: 6,
  TransferContractOwnershipToTimelock: 7,
}

const polygonUsdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'

async function main() {
  const completedDeployStep = DeployStep.EverestWhitelistCartographer
  console.log(' == Deploying Summit Ecosystem to Polygon Mainnet ==\n')


  console.log(' -- Deploy Contracts -- ')
  if (completedDeployStep < DeployStep.DeployContracts) {
    await hre.run('deploy', { tags: 'MAINNET' })
  }
  console.log('\tdone.\n')
  
  const { dev } = await ethers.getNamedSigners()
  const Cartographer = await getCartographer()

  const chainId = await getChainId()
  const mainnetPools = getPoolConfigs(chainId)





  console.log(' -- Create SUMMIT LP Pair -- ')
  const summitLpAddress = getWrittenContractAddress(chainId, 'summitLpToken')
  if (completedDeployStep < DeployStep.CreateSummitLpPair && summitLpAddress == null) {
    // Create SUMMIT-LP Pair
    const SummitToken = await getSummitToken()
    const ammFactory = chainIdAMMFactory(chainId)!
    const wrappedNativeToken = chainIdWrappedNativeToken(chainId)!
    const summitLpAddress = await createLpPair(SummitToken.address, wrappedNativeToken, ammFactory, false)

    writeContractAddresses(
      chainId,
      [['summitLpToken', summitLpAddress]]
    )
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
    await syncPools({
      poolConfigs: mainnetPools
    })

    const massUpdateTx = await Cartographer.massUpdatePools({ gasLimit: 2000000 })
    await massUpdateTx.wait(10)
  }
  console.log('\tdone.\n')




  // console.log(' -- Initialize Expedition -- ')
  // if (completedDeployStep < DeployStep.InitializeExpedition) {
  //   const elevationHelper = await getElevationHelper()
  //   const expedition = await getExpedition()
    
  //   const expeditionInitialized = (await expeditionGet.expeditionInfo()).live
  //   if (!expeditionInitialized) {
  //     await expeditionMethod.initialize({
  //       dev,
  //       usdcAddress: polygonUsdcAddress,
  //       elevationHelperAddress: elevationHelper.address
  //     })
  //     console.log('Expedition V2 Initialized')
  //   }
    
  //   // Add ExpeditionV2 as an EverestExtension
  //   const expeditionAddedAsEverestExtension = (await everestGet.getEverestExtensions()).includes(expedition.address)
  //   if (!expeditionAddedAsEverestExtension) {
  //     await everestMethod.addEverestExtension({
  //       dev,
  //       extension: expedition.address
  //     })
  //     console.log('ExpeditionV2 Added as everest Extension')
  //   }
  // }
  // console.log('\tdone.\n')

  


  // console.log(' -- Initialize Timelock -- ')
  // if (completedDeployStep < DeployStep.InitializeTimelock) {
  //   const timelock = await getTimelock()

  //   const pendingAdmin = await timelock.pendingAdmin()
  //   if (pendingAdmin == ZEROADD) {
  //     const setPendingAdminTx = await timelock.connect(dev).setPendingAdmin(dev.address)
  //     await setPendingAdminTx.wait(10)
  //     await delay(5000)
  //   }

  //   const adminInitialized = await timelock.admin_initialized()
  //   if (!adminInitialized) {
  //     const acceptAdminTx = await timelock.connect(dev).acceptAdmin()
  //     await acceptAdminTx.wait(10)
  //     await delay(5000)
  //   }

  //   await syncTimelockFunctionSpecificDelays(false)
  // }
  // console.log('\tdone.\n')




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

