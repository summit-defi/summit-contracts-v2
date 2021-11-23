import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, chainIdExpectsUserToHaveSummit, consoleLog, delay, e18 } from '../utils';

const deploySummitToken: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy, execute} = deployments;
  const {dev, user1, user2, user3} = await getNamedAccounts();
  const chainId = await getChainId()

  const SummitToken = await deploy('SummitToken', {
    from: dev,
    log: true,
  });

  if (SummitToken.newlyDeployed) {
    // Mint initial summit, change summit token owner
    await execute('SummitToken', { from: dev }, 'mint', dev, e18(2000000))
    consoleLog('Minted Initial SUMMIT Token')

    const Cartographer = await deployments.get('Cartographer');
    
    await execute('SummitToken', { from: dev }, 'transferOwnership', Cartographer.address)
    consoleLog('Transferred Ownership of SUMMIT Token to Cartographer')

    if (chainIdExpectsUserToHaveSummit(chainId)) {
      await execute('SummitToken', { from: dev }, 'transfer', user1, e18(500))
      await execute('SummitToken', { from: dev }, 'transfer', user2, e18(500))
      await execute('SummitToken', { from: dev }, 'transfer', user3, e18(500))
      consoleLog('Sent SUMMIT to test users')
    }

    if (chainIdAllowsVerification(chainId)) {
      await delay(10000)
      await run("verify:verify", {
        address: SummitToken.address,
      })
    }
  }
};
export default deploySummitToken;
deploySummitToken.tags = ['SummitToken', 'LOCALHOST', 'TESTNET', 'MAINNET']
deploySummitToken.dependencies = ['Cartographer']
