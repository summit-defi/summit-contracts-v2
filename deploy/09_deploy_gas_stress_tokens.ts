import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, chainIdRequiresDummies, delay, e18, failableVerify, promiseSequenceMap } from '../utils';

const deployGasStressTokens: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}) {
  const {deploy, execute} = deployments;
  const {dev, user1, user2, user3} = await getNamedAccounts();
  const chainId = await getChainId();

  if (!chainIdRequiresDummies(chainId)) return;

  // USDC
  await deploy('DummyUSDC', { from: dev, log: true });
  await execute('DummyUSDC', { from: dev }, 'mint', dev, e18(2000000))
        
  // GS1-n
  let gasStressTokenIds = [];
  for (let i = 0; i < (chainId === '31137' ? 30 : 6); i++) {
    gasStressTokenIds.push(i);
  }
  await promiseSequenceMap(
    gasStressTokenIds,
    async (tokenId) => {
        const tokenName = `GS${tokenId}`
        const token = await deploy(tokenName, { from: dev, log: true });
        await execute(tokenName, { from: dev }, 'mint', dev, e18(2000000))
        await execute(tokenName, { from: dev }, 'transfer', user1, e18(500))
        await execute(tokenName, { from: dev }, 'transfer', user2, e18(500))
        await execute(tokenName, { from: dev }, 'transfer', user3, e18(500))

        if (chainIdAllowsVerification(chainId)) {
          
          await failableVerify({
            address: token.address,
            contract: `contracts/dummy/GasStressTokens.sol:${tokenName}`,
          })
        }
    }
  )
};

export default deployGasStressTokens;
deployGasStressTokens.tags = ['GasStressTokens', 'LOCALHOST', 'TESTNET']
