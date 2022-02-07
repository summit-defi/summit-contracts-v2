import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, chainIdRequiresDummies, delay, e18, failableVerify } from '../utils';

const deployDummyVault: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy, execute} = deployments;
  const {dev, user1, user2, user3} = await getNamedAccounts();
  const chainId = await getChainId();

  if (!chainIdRequiresDummies(chainId)) return;

  const Cartographer = await deployments.get('Cartographer');

  const bifiToken = await deploy('DummyBIFI', {
    from: dev,
    log: true,
  });

  const dummyVault = await deploy('BeefyVaultV6', {
    from: dev,
    args: [bifiToken.address, 'mooBIFI', 'mooBIFI'],
    log: true,
  })

  await deploy('BeefyVaultV6Passthrough', {
    from: dev,
    args: [Cartographer.address, dummyVault.address, bifiToken.address],
    log: true,
  })

  if (bifiToken.newlyDeployed) {
    await execute('DummyBIFI', { from: dev, gasLimit: 120000 }, 'mint', dev, e18(20000000))
    await execute('DummyBIFI', { from: dev, gasLimit: 120000 }, 'transfer', user1, e18(500))
    await execute('DummyBIFI', { from: dev, gasLimit: 120000 }, 'transfer', user2, e18(500))
    await execute('DummyBIFI', { from: dev, gasLimit: 120000 }, 'transfer', user3, e18(500))

    await execute('DummyBIFI', { from: dev, gasLimit: 120000 }, 'transferOwnership', dummyVault.address)
  }

  if (chainIdAllowsVerification(chainId)) {
    
    failableVerify({
      address: bifiToken.address,
      contract: 'contracts/dummy/DummyBIFI.sol:DummyBIFI',
    })
  }
};
export default deployDummyVault;
deployDummyVault.tags = ['DummyBIFI', 'LOCALHOST', 'TESTNET']
