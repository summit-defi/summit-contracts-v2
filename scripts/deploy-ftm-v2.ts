import hre, { ethers, getChainId } from 'hardhat'
import { getPoolConfigs } from '../data';
import { Contracts, everestMethod, getCartographer, pausableGet, pausableMethod } from '../utils';
import { syncPools, syncTimelockFunctionSpecificDelays, transferContractOwnershipToTimelock } from './scriptUtils';

const DeployStep = {
  None: 0,
  DeployContracts: 1,
  PauseSummitTokenV2: 2,
  EverestWhitelistCartographer: 3,
  CreatePools: 4,
  InitializeTimelock: 5,
  TransferContractOwnershipToTimelock: 6,
}


async function main() {
  const completedDeployStep = DeployStep.CreatePools
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




  console.log(' -- Create Pools -- ')
  if (completedDeployStep < DeployStep.CreatePools) {
    await syncPools(mainnetPools)

    const massUpdateTx = await Cartographer.massUpdatePools()
    await massUpdateTx.wait(10)
  }
  console.log('\tdone.\n')




  console.log(' -- Initialize Timelock -- ')
  if (completedDeployStep < DeployStep.InitializeTimelock) {
    await syncTimelockFunctionSpecificDelays()
  }
  console.log('\tdone.\n')




  console.log(' -- Transfer Contract Ownership to Timelock -- ')
  if (completedDeployStep < DeployStep.TransferContractOwnershipToTimelock) {
    await transferContractOwnershipToTimelock()
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
