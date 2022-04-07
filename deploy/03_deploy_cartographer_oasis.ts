import { ethers } from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, delay, failableVerify, FORCE_VERIFY, getElevationName, OASIS } from '../utils';

const deployCartographerOasis: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy} = deployments;
  const {dev} = await ethers.getNamedSigners();
  const chainId = await getChainId()

  const Cartographer = await deployments.get('Cartographer');

  const nonce = await dev.getTransactionCount()
  const CartographerOasis = await deploy(`Cartographer${getElevationName(OASIS)}`, {
    contract: 'CartographerOasis',
    from: dev.address,
    args: [Cartographer.address],
    log: true,
    nonce,
  });

  if (chainIdAllowsVerification(chainId) && (CartographerOasis.newlyDeployed || FORCE_VERIFY)) {
    await failableVerify({
      contract: "contracts/CartographerOasis.sol:CartographerOasis",
      address: CartographerOasis.address,
      constructorArguments: [Cartographer.address],
    })
  }
};
export default deployCartographerOasis;
deployCartographerOasis.tags = ['CartographerOasis', 'LOCALHOST', 'TESTNET', 'MAINNET']
deployCartographerOasis.dependencies = ['Cartographer']