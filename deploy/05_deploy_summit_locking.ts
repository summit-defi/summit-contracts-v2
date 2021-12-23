import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, delay, failableVerify } from '../utils';

const deploySummitLocking: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy} = deployments;
  const {dev} = await getNamedAccounts();
  const chainId = await getChainId()

  const SummitLocking = await deploy('SummitLocking', {
    from: dev,
    log: true,
  });

  if (chainIdAllowsVerification(chainId)) {
    await delay(3)
    await failableVerify({
      address: SummitLocking.address,
    })
  }
};
export default deploySummitLocking;
deploySummitLocking.tags = ['SummitLocking', 'LOCALHOST', 'TESTNET', 'MAINNET']
deploySummitLocking.dependencies = ['Cartographer']