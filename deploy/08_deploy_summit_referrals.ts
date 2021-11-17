import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, delay } from '../utils';

const deploySummitReferrals: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy} = deployments;
  const {dev} = await getNamedAccounts();
  const chainId = await getChainId()

  const Cartographer = await deployments.get('Cartographer');

  const SummitReferrals = await deploy('SummitReferrals', {
    from: dev,
    args: [Cartographer.address],
    log: true,
  });

  if (SummitReferrals.newlyDeployed && chainIdAllowsVerification(chainId)) {
    await delay(10000)
    await run("verify:verify", {
      address: SummitReferrals.address,
      constructorArguments: [Cartographer.address],
    })
  }
};
export default deploySummitReferrals;
deploySummitReferrals.tags = ['SummitReferrals', 'LOCALHOST', 'TESTNET', 'MAINNET']
deploySummitReferrals.dependencies = ['Cartographer']