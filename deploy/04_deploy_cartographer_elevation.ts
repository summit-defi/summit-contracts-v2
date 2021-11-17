import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, delay } from '../utils';

const deployCartographerElevation: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy} = deployments;
  const {dev} = await getNamedAccounts();
  const chainId = await getChainId()

  const Cartographer = await deployments.get('Cartographer');

  const CartographerElevation = await deploy('CartographerElevation', {
    from: dev,
    args: [Cartographer.address],
    log: true,
  });

  if (CartographerElevation.newlyDeployed && chainIdAllowsVerification(chainId)) {
    await delay(10000)
    await run("verify:verify", {
      address: CartographerElevation.address,
      constructorArguments: [Cartographer.address],
    })
  }
};
export default deployCartographerElevation;
deployCartographerElevation.tags = ['CartographerElevation', 'LOCALHOST', 'TESTNET', 'MAINNET']
deployCartographerElevation.dependencies = ['Cartographer']