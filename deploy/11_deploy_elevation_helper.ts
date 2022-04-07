import { ethers } from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, Contracts, delay, failableVerify, FORCE_VERIFY, hardhatChainId } from '../utils';

const deployElevationHelper: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy, execute} = deployments;
  const {dev, trustedSeeder} = await ethers.getNamedSigners();
  const chainId = await getChainId()

  const Cartographer = await deployments.get(Contracts.Cartographer);
  const ExpeditionV2 = await deployments.get(Contracts.ExpeditionV2)


  // Deploy SummitRandomnessModule
  const nonce = await dev.getTransactionCount()
  const SummitTrustedSeederRNGModule = await deploy(Contracts.SummitTrustedSeederRNGModule, {
    from: dev.address,
    args: [Cartographer.address],
    log: true,
    nonce
  })


  if (chainId !== hardhatChainId) {
    await delay(10000)
  }

  const nonce2 = await dev.getTransactionCount()
  const ElevationHelper = await deploy('ElevationHelper', {
    from: dev.address,
    args: [Cartographer.address, ExpeditionV2.address],
    log: true,
    nonce: nonce2
  });

  if (SummitTrustedSeederRNGModule.newlyDeployed && ElevationHelper.newlyDeployed) {
    if (chainId !== hardhatChainId) {
      await delay(10000)
    }

    const nonce3 = await dev.getTransactionCount()
    await execute(
      Contracts.SummitTrustedSeederRNGModule,
      { from: dev.address, nonce: nonce3, gasLimit: 1000000 },
      'setElevationHelper',
      ElevationHelper.address,
    )

    if (chainId !== hardhatChainId) {
      await delay(10000)
    }

    const nonce4 = await dev.getTransactionCount()
    await execute(
      Contracts.SummitTrustedSeederRNGModule,
      { from: dev.address, nonce: nonce4 },
      'setTrustedSeederAdd',
      trustedSeeder.address,
    )


    if (chainId !== hardhatChainId) {
      await delay(10000)
    }

    const nonce5 = await dev.getTransactionCount()
    await execute(
      Contracts.ElevationHelper,
      { from: dev.address, nonce: nonce5 },
      'upgradeSummitRNGModule',
      SummitTrustedSeederRNGModule.address,
    )
  }

  if (chainIdAllowsVerification(chainId) && (SummitTrustedSeederRNGModule.newlyDeployed || ElevationHelper.newlyDeployed || FORCE_VERIFY)) {
    
    await failableVerify({
      contract: "contracts/SummitTrustedSeederRNGModule.sol:SummitTrustedSeederRNGModule",
      address: SummitTrustedSeederRNGModule.address,
      constructorArguments: [Cartographer.address],
    })
    
    await failableVerify({
      contract: "contracts/ElevationHelper.sol:ElevationHelper",
      address: ElevationHelper.address,
      constructorArguments: [Cartographer.address, ExpeditionV2.address],
    })
  }
};
export default deployElevationHelper;
deployElevationHelper.tags = ['ElevationHelper', 'LOCALHOST', 'TESTNET', 'MAINNET']
deployElevationHelper.dependencies = ['Cartographer', 'ExpeditionV2']