import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, Contracts, delay } from '../utils';

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


  const ElevationHelper = await deploy('ElevationHelper', {
    from: dev,
    args: [Cartographer.address, ExpeditionV2.address],
    log: true,
  });

  await execute(
    Contracts.SummitTrustedSeederRNGModule,
    { from: dev },
    'setElevationHelper',
    ElevationHelper.address,
  )

  await execute(
    Contracts.SummitTrustedSeederRNGModule,
    { from: dev },
    'setTrustedSeederAdd',
    trustedSeeder,
  )

  await execute(
    Contracts.ElevationHelper,
    { from: dev },
    'upgradeSummitRNGModule',
    SummitTrustedSeederRNGModule.address,
  )

  if (ElevationHelper.newlyDeployed && chainIdAllowsVerification(chainId)) {
    await delay(10000)
    await run("verify:verify", {
      address: SummitTrustedSeederRNGModule.address,
      constructorArguments: [Cartographer.address],
    })
    await delay(10000)
    await run("verify:verify", {
      address: ElevationHelper.address,
      constructorArguments: [Cartographer.address],
    })
  }
};
export default deployElevationHelper;
deployElevationHelper.tags = ['ElevationHelper', 'LOCALHOST', 'TESTNET', 'MAINNET']
deployElevationHelper.dependencies = ['Cartographer', 'ExpeditionV2']