import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, chainIdRequiresDummies, Contracts, delay } from '../utils';

const deployEverestToken: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy} = deployments;
  const {dev} = await getNamedAccounts();
  const chainId = await getChainId()

  const SummitToken = await deployments.get(Contracts.SummitToken);

  const EverestToken = await deploy(Contracts.EverestToken, {
      from: dev,
      args: [SummitToken.address],
      log: true
  })

  if (EverestToken.newlyDeployed && chainIdAllowsVerification(chainId)) {
    await delay(10000)
    await run("verify:verify", {
      address: EverestToken.address,
      constructorArguments: [SummitToken.address],
    })
  }

  if (chainIdRequiresDummies(chainId)) {
    const DummyEverestExtension = await deploy(Contracts.DummyEverestExtension, {
      from: dev,
      args: [EverestToken.address],
      log: true,
    })
  };

};
export default deployEverestToken;
deployEverestToken.tags = ['EverestToken', 'LOCALHOST', 'TESTNET', 'MAINNET']
deployEverestToken.dependencies = ['Cartographer', 'SummitToken', 'SummitLocking']