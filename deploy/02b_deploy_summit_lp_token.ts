import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, chainIdAMMFactory, chainIdAMMPairCodeHash, chainIdWrappedNativeToken, computePairAddress, delay, e18, ZEROADD } from '../utils';
import { createLpPair, getLpPair } from '../scripts/scriptUtils';

const deploySummitLpToken: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy, execute} = deployments;
  const {dev, user1, user2, user3} = await getNamedAccounts();
  const chainId = await getChainId()
  const SummitToken = await deployments.get('SummitToken');

  const ammFactory = chainIdAMMFactory(chainId)
  const wrappedNativeToken = chainIdWrappedNativeToken(chainId)

  if (ammFactory == null || wrappedNativeToken == null) {

    // Create and Mint initial dummy SUMMIT LP
    const DummySummitLp = await deploy('DummySUMMITLP', {
      from: dev,
      log: true,
    })
    const DummyNativeToken = await deploy('DummyNativeToken', {
      from: dev,
      log: true,
    })

    

    if (DummySummitLp.newlyDeployed) {
      // Mint initial summit, change summit token owner
      await execute('DummySUMMITLP', { from: dev }, 'mint', e18(50))
      await execute('DummySUMMITLP', { from: dev }, 'approve', user1, e18(10))
      await execute('DummySUMMITLP', { from: dev }, 'approve', user2, e18(10))
      await execute('DummySUMMITLP', { from: dev }, 'approve', user3, e18(10))
      await execute('DummySUMMITLP', { from: dev }, 'transfer', user1, e18(10))
      await execute('DummySUMMITLP', { from: dev }, 'transfer', user2, e18(10))
      await execute('DummySUMMITLP', { from: dev }, 'transfer', user3, e18(10))

      await execute('DummyNativeToken', { from: dev }, 'mint', e18(50))

      await execute('DummySUMMITLP', { from: dev }, 'setTokens', SummitToken.address, DummyNativeToken.address)
      await execute('DummySUMMITLP', { from: dev }, 'setReserves', e18(100), e18(150))

      if (chainIdAllowsVerification(chainId)) {
        await delay(10000)
        await run("verify:verify", {
          address: DummySummitLp.address,
        })
      }
    }
  }
};
export default deploySummitLpToken;
deploySummitLpToken.tags = ['SummitLpToken', 'LOCALHOST', 'TESTNET', 'MAINNET']
deploySummitLpToken.dependencies = ['Cartographer']
