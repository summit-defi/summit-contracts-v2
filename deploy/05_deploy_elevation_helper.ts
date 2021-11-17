import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, delay } from '../utils';

const deployElevationHelper: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy} = deployments;
  const {dev} = await getNamedAccounts();
  const chainId = await getChainId()

  const Cartographer = await deployments.get('Cartographer');

  const ElevationHelper = await deploy('ElevationHelper', {
    from: dev,
    args: [Cartographer.address],
    log: true,
  });

  if (ElevationHelper.newlyDeployed && chainIdAllowsVerification(chainId)) {
    await delay(10000)
    await run("verify:verify", {
      address: ElevationHelper.address,
      constructorArguments: [Cartographer.address],
    })
  }
};
export default deployElevationHelper;
deployElevationHelper.tags = ['ElevationHelper', 'LOCALHOST', 'TESTNET', 'MAINNET']
deployElevationHelper.dependencies = ['Cartographer']