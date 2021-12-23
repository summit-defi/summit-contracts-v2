import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, Contracts, delay, failableVerify } from '../utils';

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
  const EverestToken = await deployments.get(Contracts.EverestToken)
  const SummitLocking = await deployments.get(Contracts.SummitLocking)

  const ExpeditionV2 = await deploy('ExpeditionV2', {
    from: dev,
    args: [SummitToken.address, EverestToken.address, SummitLocking.address],
    log: true,
  });

  if (chainIdAllowsVerification(chainId)) {
    await delay(3)
    await failableVerify({
      address: ExpeditionV2.address,
      constructorArguments: [SummitToken.address, EverestToken.address, SummitLocking.address],
    })
  }
};
export default deployExpeditionV2;
deployExpeditionV2.tags = ['ExpeditionV2', 'LOCALHOST', 'TESTNET', 'MAINNET']
deployExpeditionV2.dependencies = ['Cartographer', 'EverestToken', 'SummitToken', 'SummitLocking']