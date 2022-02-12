import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, Contracts, delay, failableVerify, FORCE_VERIFY, hardhatChainId } from '../utils';

const deployElevationHelper: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy, execute} = deployments;
  const {dev, trustedSeeder} = await getNamedAccounts();
  const chainId = await getChainId()

  const Cartographer = await deployments.get(Contracts.Cartographer);
  const ExpeditionV2 = await deployments.get(Contracts.ExpeditionV2)


  // Deploy SummitRandomnessModule
  const SummitTrustedSeederRNGModule = await deploy(Contracts.SummitTrustedSeederRNGModule, {
    from: dev,
    args: [Cartographer.address],
    log: true
  })


  if (chainId !== hardhatChainId) {
    await delay(10000)
  }


  const ElevationHelper = await deploy('ElevationHelper', {
    from: dev,
    args: [Cartographer.address, ExpeditionV2.address],
    log: true,
  });

  if (SummitTrustedSeederRNGModule.newlyDeployed && ElevationHelper.newlyDeployed) {
    if (chainId !== hardhatChainId) {
      await delay(10000)
    }

    await execute(
      Contracts.SummitTrustedSeederRNGModule,
      { from: dev },
      'setElevationHelper',
      ElevationHelper.address,
    )

    if (chainId !== hardhatChainId) {
      await delay(10000)
    }

    await execute(
      Contracts.SummitTrustedSeederRNGModule,
      { from: dev },
      'setTrustedSeederAdd',
      trustedSeeder,
    )


    if (chainId !== hardhatChainId) {
      await delay(10000)
    }

    await execute(
      Contracts.ElevationHelper,
      { from: dev },
      'upgradeSummitRNGModule',
      SummitTrustedSeederRNGModule.address,
    )
  }

  if (chainIdAllowsVerification(chainId) && (SummitTrustedSeederRNGModule.newlyDeployed || ElevationHelper.newlyDeployed || FORCE_VERIFY)) {
    
    await failableVerify({
      address: SummitTrustedSeederRNGModule.address,
      constructorArguments: [Cartographer.address],
    })
    
    await failableVerify({
      address: ElevationHelper.address,
      constructorArguments: [Cartographer.address, ExpeditionV2.address],
    })
  }
};
export default deployElevationHelper;
deployElevationHelper.tags = ['ElevationHelper', 'LOCALHOST', 'TESTNET', 'MAINNET']
deployElevationHelper.dependencies = ['Cartographer', 'ExpeditionV2']