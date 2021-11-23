 import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, delay, getElevationName, MESA, PLAINS, promiseSequenceMap, SUMMIT } from '../utils';

const deployCartographerElevations: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy} = deployments;
  const {dev} = await getNamedAccounts();
  const chainId = await getChainId()

  const Cartographer = await deployments.get('Cartographer');

  await promiseSequenceMap(
    [PLAINS, MESA, SUMMIT],
    async (elevation) => {
      const elevationName = getElevationName(elevation)
      const CartographerElevation = await deploy(`Cartographer${elevationName}`, {
        contract: 'CartographerElevation',
        from: dev,
        args: [Cartographer.address, elevation],
        log: true,
      });
    
      if (CartographerElevation.newlyDeployed && chainIdAllowsVerification(chainId)) {
        await delay(10000)
        await run("verify:verify", {
          address: CartographerElevation.address,
          constructorArguments: [Cartographer.address, elevation],
        })
      }
    }
  )

};
export default deployCartographerElevations;
deployCartographerElevations.tags = ['CartographerElevation', 'LOCALHOST', 'TESTNET', 'MAINNET']
deployCartographerElevations.dependencies = ['Cartographer']