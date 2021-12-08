import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, chainIdAMMFactory, chainIdAMMPairCodeHash, chainIdExpectsUserToHaveSummit, chainIdWrappedNativeToken, consoleLog, Contracts, delay, e18 } from '../utils';

const deployExpeditionV2: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy, execute} = deployments;
  const {dev} = await getNamedAccounts();
  const chainId = await getChainId()

  const SummitToken = await deployments.get(Contracts.SummitToken);
  const SummitLocking = await deployments.get(Contracts.SummitLocking)

  const EverestToken = await deploy(Contracts.EverestToken, {
      from: dev,
      args: [SummitToken.address],
      log: true
  })

  const ExpeditionV2 = await deploy('ExpeditionV2', {
    from: dev,
    args: [SummitToken.address, EverestToken.address, SummitLocking.address],
    log: true,
  });

  if (ExpeditionV2.newlyDeployed && chainIdAllowsVerification(chainId)) {
    await delay(10000)
    await run("verify:verify", {
      address: ExpeditionV2.address,
      constructorArguments: [SummitToken.address, EverestToken.address, SummitLocking.address],
    })
  }

  if (EverestToken.newlyDeployed) {
    if (chainIdAllowsVerification(chainId)) {
      await delay(10000)
      await run("verify:verify", {
        address: EverestToken.address,
        constructorArguments: [SummitToken.address],
      })
    }
  }
};
export default deployExpeditionV2;
deployExpeditionV2.tags = ['ExpeditionV2', 'LOCALHOST', 'TESTNET', 'MAINNET']
deployExpeditionV2.dependencies = ['Cartographer', 'SummitToken', 'SummitLocking']