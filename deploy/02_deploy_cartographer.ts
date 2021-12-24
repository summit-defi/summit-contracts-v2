import {DeployFunction} from 'hardhat-deploy/types';
import { chainIdAllowsVerification, delay, failableVerify } from '../utils';

const deployCartographer: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy} = deployments;
  const {dev, exped} = await getNamedAccounts()
  const chainId = await getChainId()

  console.log({
    chainId
  })

  const Cartographer = await deploy('Cartographer', {
    from: dev,
    args: [dev, exped],
    log: true,
  });

  if (chainIdAllowsVerification(chainId)) {
    await delay(3)
    await failableVerify({
      address: Cartographer.address,
      constructorArguments: [dev, exped],
    })
  }
};
export default deployCartographer;
deployCartographer.tags = ['Cartographer', 'LOCALHOST', 'TESTNET', 'MAINNET'];