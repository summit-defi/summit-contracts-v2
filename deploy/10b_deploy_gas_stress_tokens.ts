import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, chainIdRequiresDummies, delay, e18, promiseSequenceMap } from '../utils';

const deployGasStressTokens: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}) {
  // const {deploy, execute} = deployments;
  // const {dev, user1, user2, user3} = await getNamedAccounts();
  // const chainId = await getChainId();

  // if (!chainIdRequiresDummies(chainId)) return;

  // let gasStressTokenIds = [];
  // for (let i = 4; i <= 29; i++) {
  //   gasStressTokenIds.push(i);
  // }
  // await promiseSequenceMap(
  //   gasStressTokenIds,
  //   async (tokenId) => {
  //       const tokenName = `GS${tokenId}`
  //       await deploy(tokenName, { from: dev, log: true });
  //       await execute(tokenName, { from: dev }, 'mint', e18(2000000))
  //       await execute(tokenName, { from: dev }, 'approve', user1, e18(500))
  //       await execute(tokenName, { from: dev }, 'approve', user2, e18(500))
  //       await execute(tokenName, { from: dev }, 'approve', user3, e18(500))
  //       await execute(tokenName, { from: dev }, 'transfer', user1, e18(500))
  //       await execute(tokenName, { from: dev }, 'transfer', user2, e18(500))
  //       await execute(tokenName, { from: dev }, 'transfer', user3, e18(500))
  //   }
  // )
};

export default deployGasStressTokens;
deployGasStressTokens.tags = ['GasStressTokens', 'LOCALHOST', 'TESTNET']
