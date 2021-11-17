import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, delay } from '../utils';

const deployCartographerExpedition: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy} = deployments;
  const {dev} = await getNamedAccounts();
  const chainId = await getChainId()

  const Cartographer = await deployments.get('Cartographer');

  const CartographerExpedition = await deploy('CartographerExpedition', {
    from: dev,
    args: [Cartographer.address],
    log: true,
  });

  if (CartographerExpedition.newlyDeployed && chainIdAllowsVerification(chainId)) {
    await delay(10000)
    await run("verify:verify", {
      address: CartographerExpedition.address,
      constructorArguments: [Cartographer.address],
    })
  }
};
export default deployCartographerExpedition;
deployCartographerExpedition.tags = ['CartographerExpedition', 'LOCALHOST', 'TESTNET', 'MAINNET']
deployCartographerExpedition.dependencies = ['Cartographer']