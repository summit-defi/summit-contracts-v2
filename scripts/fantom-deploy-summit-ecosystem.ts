import hre, { ethers, getChainId } from 'hardhat'
import { promiseSequenceMap } from '../utils';
import { getConfigs } from '../data'
import { createExpedition, createPassthroughStrategy, createPool } from './scriptUtils';

const DeployStep = {
  None: 0,
  DeployContracts: 1,
  CreatePools: 2,
  CreatePassthroughStrategies: 3,
  CreateExpeditions: 4,
}


async function main() {
  const completedDeployStep = DeployStep.CreatePools
  console.log(' == Deploying Summit Ecosystem to FTM ==\n')


  const chainId = await getChainId()
  const { pools, expeditions } = getConfigs(chainId)



  console.log(' -- Deploy Contracts -- ')
  if (completedDeployStep < DeployStep.DeployContracts) {
    await hre.run('deploy', { tags: 'TESTNET'})
  }
  console.log('\tdone.\n')





  const Cartographer = await ethers.getContract('Cartographer')
  const SummitToken = await ethers.getContract('SummitToken')
  const summitAddress = SummitToken.address
  const summitLpAddress = await Cartographer.summitLp()



  console.log(' -- Create Pools -- ')
  if (completedDeployStep < DeployStep.CreatePools) {
    await promiseSequenceMap(
      pools,
      async (pool) => await createPool(pool, summitAddress, summitLpAddress)
    )
  }
  console.log('\tdone.\n')




  console.log(' -- Create Passthrough Strategies -- ')
  if (completedDeployStep < DeployStep.CreatePassthroughStrategies) {
    await promiseSequenceMap(
      pools,
      async (pool) => await createPassthroughStrategy(pool, summitAddress, summitLpAddress)
    )
  }
  console.log('\tdone.\n')




  // console.log(' -- Create Expeditions -- ')
  // await promiseSequenceMap(
  //   expeditions,
  //   async (expedition) => await createExpedition(expedition)
  // )
  // console.log('\tdone.\n')





  const massUpdateTx = await Cartographer.massUpdatePools()
  await massUpdateTx.wait(10)




  console.log(' == Deployment Complete ==')
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
