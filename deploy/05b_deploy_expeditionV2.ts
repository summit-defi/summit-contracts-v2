import {DeployFunction} from 'hardhat-deploy/types'
import { createLpPair } from '../scripts/scriptUtils';
import { chainIdAllowsVerification, chainIdAMMFactory, chainIdAMMPairCodeHash, chainIdExpectsUserToHaveSummit, chainIdWrappedNativeToken, consoleLog, Contracts, delay, e18 } from '../utils';

const deployExpeditionV2: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy, execute} = deployments;
  const {dev, user1, user2, user3} = await getNamedAccounts();
  const chainId = await getChainId()

  const SummitToken = await deployments.get(Contracts.SummitToken);
  const ElevationHelper = await deployments.get(Contracts.ElevationHelper)

  const ammFactory = await chainIdAMMFactory(chainId)
  const wrappedNativeToken = await chainIdWrappedNativeToken(chainId)
  const summitLpAddress = ammFactory != null && wrappedNativeToken != null ?
    await createLpPair(SummitToken.address, wrappedNativeToken, ammFactory, false) :
    (await deployments.get('DummySUMMITLP')).address

  const EverestToken = await deploy(Contracts.EverestToken, {
      from: dev,
      args: [],
      log: true
  })

  const ExpeditionV2 = await deploy('ExpeditionV2', {
    from: dev,
    args: [SummitToken.address, summitLpAddress, EverestToken.address, ElevationHelper.address],
    log: true,
  });

  if (ExpeditionV2.newlyDeployed && chainIdAllowsVerification(chainId)) {
    await delay(10000)
    await run("verify:verify", {
      address: ExpeditionV2.address,
      constructorArguments: [SummitToken.address, summitLpAddress, EverestToken.address, ElevationHelper.address],
    })
  }

  if (EverestToken.newlyDeployed) {
    await execute(Contracts.EverestToken, { from: dev }, 'transferOwnership', ExpeditionV2.address)
    consoleLog('Transferred Ownership of EVEREST Token to ExpeditionV2')

    if (chainIdAllowsVerification(chainId)) {
      await delay(10000)
      await run("verify:verify", {
        address: EverestToken.address,
      })
    }
  }
};
export default deployExpeditionV2;
deployExpeditionV2.tags = ['ExpeditionV2', 'LOCALHOST', 'TESTNET', 'MAINNET']
deployExpeditionV2.dependencies = ['Cartographer']