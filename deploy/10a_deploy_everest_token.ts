import { ethers } from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, chainIdRequiresDummies, Contracts, delay, failableVerify, FORCE_VERIFY } from '../utils';

const deployEverestToken: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy} = deployments;
  const {dev} = await ethers.getNamedSigners();
  const chainId = await getChainId()

  const SummitToken = await deployments.get(Contracts.SummitToken);

  const nonce = await dev.getTransactionCount()
  const EverestToken = await deploy(Contracts.EverestToken, {
      from: dev.address,
      args: [SummitToken.address],
      log: true,
      nonce,
  })

  if (chainIdAllowsVerification(chainId) && (EverestToken.newlyDeployed || FORCE_VERIFY)) {
    await failableVerify({
      contract: "contracts/EverestToken.sol:EverestToken",
      address: EverestToken.address,
      constructorArguments: [SummitToken.address],
    })
  }

  if (chainIdRequiresDummies(chainId)) {
    const nonce2 = await dev.getTransactionCount()
    const DummyEverestExtension = await deploy(Contracts.DummyEverestExtension, {
      from: dev.address,
      args: [EverestToken.address],
      log: true,
      nonce: nonce2
    })
  };

};
export default deployEverestToken;
deployEverestToken.tags = ['EverestToken', 'LOCALHOST', 'TESTNET', 'MAINNET']
deployEverestToken.dependencies = ['Cartographer', 'SummitToken', 'SummitGlacier']