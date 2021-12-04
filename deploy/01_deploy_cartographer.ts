import {DeployFunction} from 'hardhat-deploy/types';
import { chainIdAllowsVerification, delay } from '../utils';
import deployCartographerOasis from './03_deploy_cartographer_oasis';

const deployCartographer: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy} = deployments;
  const {dev, exped} = await getNamedAccounts()
  const chainId = await getChainId()

  const Cartographer = await deploy('Cartographer', {
    from: dev,
    args: [dev, exped],
    log: true,
  });


  if (Cartographer.newlyDeployed && chainIdAllowsVerification(chainId)) {
    await delay(10000)
    await run("verify:verify", {
      address: Cartographer.address,
      constructorArguments: [dev, exped],
    })
  }
};
export default deployCartographer;
deployCartographer.tags = ['Cartographer', 'LOCALHOST', 'TESTNET', 'MAINNET'];