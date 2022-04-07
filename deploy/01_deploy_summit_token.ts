import { ethers } from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, chainIdExpectsUserToHaveSummit, consoleLog, delay, e18, erc20Method, failableVerify, FORCE_VERIFY } from '../utils';

const deploySummitToken: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy, execute} = deployments;
  const {dev, user1, user2, user3} = await ethers.getNamedSigners();
  const chainId = await getChainId()

  
  const nonce = await dev.getTransactionCount()
  const SummitToken = await deploy('SummitToken', {
    from: dev.address,
    log: true,
    nonce,
  });


  if (SummitToken.newlyDeployed) {
    
    if (chainIdExpectsUserToHaveSummit(chainId)) {
      // Mint initial summit, change summit token owner
      const nonce2 = await dev.getTransactionCount()
      await execute('SummitToken', { from: dev.address, nonce: nonce2 + 0 }, 'mint', dev.address, e18(2000000))
      await execute('SummitToken', { from: dev.address, nonce: nonce2 + 1 }, 'transfer', user1.address, e18(500))
      await execute('SummitToken', { from: dev.address, nonce: nonce2 + 2 }, 'transfer', user2.address, e18(500))
      await execute('SummitToken', { from: dev.address, nonce: nonce2 + 3 }, 'transfer', user3.address, e18(500))
      consoleLog('Sent SUMMIT to test users')
    }
  }

  

  if (chainIdAllowsVerification(chainId) && (SummitToken.newlyDeployed || FORCE_VERIFY)) {
    const nonce3 = await dev.getTransactionCount()
    await execute('SummitToken', { from: dev.address, gasLimit: 1000000, nonce: nonce3 }, 'mint', dev.address, e18(1000))
    consoleLog('Initial SUMMIT treasury mint')

    await failableVerify({
      contract: "contracts/SummitToken.sol:SummitToken",
      address: SummitToken.address,
    })
  }
};
export default deploySummitToken;
deploySummitToken.tags = ['SummitToken', 'LOCALHOST', 'TESTNET', 'MAINNET']
