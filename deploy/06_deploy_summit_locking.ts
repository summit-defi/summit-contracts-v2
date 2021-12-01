import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, delay } from '../utils';

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

  if (SummitLocking.newlyDeployed && chainIdAllowsVerification(chainId)) {
    await delay(10000)
    await run("verify:verify", {
      address: SummitLocking.address,
    })
  }
};
export default deploySummitLocking;
deploySummitLocking.tags = ['SummitLocking', 'LOCALHOST', 'TESTNET', 'MAINNET']
deploySummitLocking.dependencies = ['Cartographer']