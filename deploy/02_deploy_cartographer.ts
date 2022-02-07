import {DeployFunction} from 'hardhat-deploy/types';
import { chainIdAllowsVerification, delay, failableVerify, getChainExpedTreasuryAddress, getChainLpGeneratorAddress, getChainTreasuryAddress } from '../utils';

const deployCartographer: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy} = deployments;
  const {dev, exped, lpGenerator} = await getNamedAccounts()
  const chainId = await getChainId()

  console.log({
    chainId
  })

  const treasuryAddress = getChainTreasuryAddress(chainId) || dev
  const expedTreasuryAddress = getChainExpedTreasuryAddress(chainId) || exped
  const lpGeneratorAddress = getChainLpGeneratorAddress(chainId) || lpGenerator

  const Cartographer = await deploy('Cartographer', {
    from: dev,
    args: [treasuryAddress, expedTreasuryAddress, lpGeneratorAddress],
    log: true,
  });

  if (chainIdAllowsVerification(chainId)) {
    await delay(3)
    await failableVerify({
      address: Cartographer.address,
      constructorArguments: [treasuryAddress, expedTreasuryAddress, lpGeneratorAddress],
    })
  }
};
export default deployCartographer;
deployCartographer.tags = ['Cartographer', 'LOCALHOST', 'TESTNET', 'MAINNET'];