import { ethers } from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types';
import { chainIdAllowsVerification, delay, failableVerify, FORCE_VERIFY, getChainExpedTreasuryAddress, getChainLpGeneratorAddress, getChainTreasuryAddress } from '../utils';

const deployCartographer: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy} = deployments;
  const {dev, exped, lpGenerator} = await ethers.getNamedSigners()
  const chainId = await getChainId()

  console.log({
    chainId
  })

  const treasuryAddress = getChainTreasuryAddress(chainId) || dev.address
  const expedTreasuryAddress = getChainExpedTreasuryAddress(chainId) || exped.address
  const lpGeneratorAddress = getChainLpGeneratorAddress(chainId) || lpGenerator.address

  const nonce = await dev.getTransactionCount()
  const Cartographer = await deploy('Cartographer', {
    from: dev.address,
    args: [treasuryAddress, expedTreasuryAddress, lpGeneratorAddress],
    log: true,
    nonce,
  });

  if (chainIdAllowsVerification(chainId) && (Cartographer.newlyDeployed || FORCE_VERIFY)) {
    await failableVerify({
      contract: "contracts/Cartographer.sol:Cartographer",
      address: Cartographer.address,
      constructorArguments: [treasuryAddress, expedTreasuryAddress, lpGeneratorAddress],
    })
  }
};
export default deployCartographer;
deployCartographer.tags = ['Cartographer', 'LOCALHOST', 'TESTNET', 'MAINNET'];