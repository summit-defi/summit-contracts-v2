import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, delay, getElevationName, OASIS } from '../utils';

const deployCartographerOasis: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy} = deployments;
  const {dev} = await getNamedAccounts();
  const chainId = await getChainId()

  const Cartographer = await deployments.get('Cartographer');

  const CartographerOasis = await deploy(`Cartographer${getElevationName(OASIS)}`, {
    contract: 'CartographerOasis',
    from: dev,
    args: [Cartographer.address],
    log: true,
  });

  if (CartographerOasis.newlyDeployed && chainIdAllowsVerification(chainId)) {
    await delay(10000)
    await run("verify:verify", {
      address: CartographerOasis.address,
      constructorArguments: [Cartographer.address],
    })
  }
};
export default deployCartographerOasis;
deployCartographerOasis.tags = ['CartographerOasis', 'LOCALHOST', 'TESTNET', 'MAINNET']
deployCartographerOasis.dependencies = ['Cartographer']