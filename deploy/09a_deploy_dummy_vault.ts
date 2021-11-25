import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, chainIdRequiresDummies, delay, e18 } from '../utils';

const deployDummyVault: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  // const {deploy, execute} = deployments;
  // const {dev, user1, user2, user3} = await getNamedAccounts();
  // const chainId = await getChainId();

  // if (!chainIdRequiresDummies(chainId)) return;

  // const Cartographer = await deployments.get('Cartographer');

  // const dummyBifiToken = await deploy('DummyBIFI', {
  //   from: dev,
  //   log: true,
  // });
  // const dummyVault = await deploy('BeefyVaultV6', {
  //   from: dev,
  //   args: [dummyBifiToken.address, 'mooBIFI', 'mooBIFI'],
  //   log: true,
  // })

  // await deploy('BeefyVaultV6Passthrough', {
  //   from: dev,
  //   args: [Cartographer.address, dummyVault.address, dummyBifiToken.address],
  //   log: true,
  // })

  // if (dummyBifiToken.newlyDeployed) {
  //   await execute('DummyBIFI', { from: dev }, 'mint', e18(20000000))
  //   await execute('DummyBIFI', { from: dev }, 'approve', user1, e18(500))
  //   await execute('DummyBIFI', { from: dev }, 'approve', user2, e18(500))
  //   await execute('DummyBIFI', { from: dev }, 'approve', user3, e18(500))
  //   await execute('DummyBIFI', { from: dev }, 'transfer', user1, e18(500))
  //   await execute('DummyBIFI', { from: dev }, 'transfer', user2, e18(500))
  //   await execute('DummyBIFI', { from: dev }, 'transfer', user3, e18(500))

  //   await execute('DummyBIFI', { from: dev }, 'transferOwnership', dummyVault.address)

  //   if (chainIdAllowsVerification(chainId)) {
  //     await delay(10000)
  //     await run("verify:verify", {
  //       address: dummyBifiToken.address,
  //       contract: 'contracts/DummyBIFI.sol:DummyBIFI',
  //     })
  //   }
  // }
};
export default deployDummyVault;
deployDummyVault.tags = ['DummyBIFI', 'LOCALHOST', 'TESTNET']
