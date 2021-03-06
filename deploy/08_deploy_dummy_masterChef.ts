import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, chainIdRequiresDummies, delay, e18, failableVerify } from '../utils';

const deployDummyMasterChef: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy, execute} = deployments;
  const {dev, user1, user2, user3} = await getNamedAccounts();
  const chainId = await getChainId()

  if (!chainIdRequiresDummies(chainId)) return;

  const Cartographer = await deployments.get('Cartographer');
  const DummyBIFI = await deployments.get('DummyBIFI')

  const cakeToken = await deploy('DummyCAKE', {
    from: dev,
    log: true,
  });
  const dummyMasterChef = await deploy('MasterChef', {
    from: dev,
    args: [cakeToken.address, dev, e18(1), 0],
  })

  await execute('MasterChef', { from: dev }, 'add', 100, DummyBIFI.address, true)

  await deploy('MasterChefPassthrough', {
    from: dev,
    args: [
      Cartographer.address,
      dummyMasterChef.address,
      1,
      DummyBIFI.address,
      cakeToken.address,
    ],
    log: true,
  })

  if (cakeToken.newlyDeployed) {
    await execute('DummyCAKE', { from: dev }, 'mint', dev, e18(20000000))
    await execute('DummyCAKE', { from: dev }, 'transfer', user1, e18(500))
    await execute('DummyCAKE', { from: dev }, 'transfer', user2, e18(500))
    await execute('DummyCAKE', { from: dev }, 'transfer', user3, e18(500))

    await execute('DummyCAKE', { from: dev }, 'transferOwnership', dummyMasterChef.address)
  }

  if (chainIdAllowsVerification(chainId)) {
    
    await failableVerify({
      address: cakeToken.address,
      contract: 'contracts/dummy/DummyCAKE.sol:DummyCAKE',
    })
  }
};
export default deployDummyMasterChef;
deployDummyMasterChef.tags = ['DummyCAKE', 'TESTNET', 'LOCALHOST']
