import { ethers } from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, delay, failableVerify, FORCE_VERIFY } from '../utils';

const deploySummitGlacier: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy} = deployments;
  const {dev} = await ethers.getNamedSigners();
  const chainId = await getChainId()

  const nonce = await dev.getTransactionCount()
  const SummitGlacier = await deploy('SummitGlacier', {
    from: dev.address,
    log: true,
    nonce,
  });

  if (chainIdAllowsVerification(chainId) && (SummitGlacier.newlyDeployed || FORCE_VERIFY)) {
    await failableVerify({
      contract: "contracts/Glacier.sol:Glacier",
      address: SummitGlacier.address,
    })
  }
};
export default deploySummitGlacier;
deploySummitGlacier.tags = ['SummitGlacier', 'LOCALHOST', 'TESTNET', 'MAINNET']
deploySummitGlacier.dependencies = ['Cartographer']