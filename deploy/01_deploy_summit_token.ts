import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, chainIdExpectsUserToHaveSummit, consoleLog, delay, e18, failableVerify } from '../utils';

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
    
    if (chainIdExpectsUserToHaveSummit(chainId)) {
      // Mint initial summit, change summit token owner
      await execute('SummitToken', { from: dev }, 'mint', dev, e18(2000000))
      await execute('SummitToken', { from: dev }, 'transfer', user1, e18(500))
      await execute('SummitToken', { from: dev }, 'transfer', user2, e18(500))
      await execute('SummitToken', { from: dev }, 'transfer', user3, e18(500))
      consoleLog('Sent SUMMIT to test users')
    }
  }

  

  if (chainIdAllowsVerification(chainId)) {
    
    await failableVerify({
      address: SummitToken.address,
    })
  }
};
export default deploySummitToken;
deploySummitToken.tags = ['SummitToken', 'LOCALHOST', 'TESTNET', 'MAINNET']
