 import { ethers } from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, delay, failableVerify, FORCE_VERIFY, getElevationName, MESA, PLAINS, promiseSequenceMap, SUMMIT } from '../utils';

const deployCartographerElevations: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy} = deployments;
  const {dev} = await ethers.getNamedSigners();
  const chainId = await getChainId()

  const Cartographer = await deployments.get('Cartographer');

  await promiseSequenceMap(
    [PLAINS, MESA, SUMMIT],
    async (elevation) => {
      const elevationName = getElevationName(elevation)
      const nonce = await dev.getTransactionCount()
      const CartographerElevation = await deploy(`Cartographer${elevationName}`, {
        contract: 'CartographerElevation',
        from: dev.address,
        args: [Cartographer.address, elevation],
        log: true,
        nonce,
      });
    
      if (chainIdAllowsVerification(chainId) && (CartographerElevation.newlyDeployed || FORCE_VERIFY)) {
        
        await failableVerify({
          contract: "contracts/CartographerElevation.sol:CartographerElevation",
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