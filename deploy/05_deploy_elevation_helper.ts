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

  const Cartographer = await deployments.get('Cartographer');


  // Deploy SummitRandomnessModule
  const SummitRandomnessModule = await deploy(Contracts.SummitRandomnessModule, {
    from: dev,
    args: [Cartographer.address],
    log: true
  })


  const ElevationHelper = await deploy('ElevationHelper', {
    from: dev,
    args: [Cartographer.address],
    log: true,
  });

  await execute(
    Contracts.SummitRandomnessModule,
    { from: dev },
    'setElevationHelper',
    ElevationHelper.address,
  )

  await execute(
    Contracts.SummitRandomnessModule,
    { from: dev },
    'setTrustedSeederAdd',
    trustedSeeder,
  )

  await execute(
    Contracts.ElevationHelper,
    { from: dev },
    'setSummitRandomnessModuleAdd',
    SummitRandomnessModule.address,
  )

  if (ElevationHelper.newlyDeployed && chainIdAllowsVerification(chainId)) {
    await delay(10000)
    await run("verify:verify", {
      address: SummitRandomnessModule.address,
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
deployElevationHelper.dependencies = ['Cartographer']