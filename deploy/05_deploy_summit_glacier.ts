import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, delay, failableVerify } from '../utils';

const deploySummitGlacier: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy} = deployments;
  const {dev} = await getNamedAccounts();
  const chainId = await getChainId()

  const SummitGlacier = await deploy('SummitGlacier', {
    from: dev,
    log: true,
  });

  if (chainIdAllowsVerification(chainId)) {
    
    await failableVerify({
      address: SummitGlacier.address,
    })
  }
};
export default deploySummitGlacier;
deploySummitGlacier.tags = ['SummitGlacier', 'LOCALHOST', 'TESTNET', 'MAINNET']
deploySummitGlacier.dependencies = ['Cartographer']