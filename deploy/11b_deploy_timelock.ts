import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdAllowsVerification, delay, emptyHardhatTimelockTransactions, getTimestamp } from '../utils';
import { ethers } from 'ethers';

const deployTimelock: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  run,
}) {
  const {deploy, execute} = deployments;
  const {dev} = await getNamedAccounts();
  const chainId = await getChainId()
  const timestamp = await getTimestamp()
  const timestampWithDelay = timestamp + (6.5 * 3600)
  const abiCoder = ethers.utils.defaultAbiCoder

  // Clear out previous timelock transactions
  emptyHardhatTimelockTransactions(chainId)

  // if (chainIdRequiresTimelock(chainId)) {
  const Timelock = await deploy('Timelock', {
    from: dev,
    args: [dev, 6 * 3600],
    log: true,
  })

  console.log('Deployed Timelock')

  if (chainIdAllowsVerification(chainId)) {
    await delay(10000)
    await run("verify:verify", {
      address: Timelock.address,
      constructorArguments: [dev, 6 * 3600],
    })
  }

  console.log('Verified Timelock')

  // if (Timelock.newlyDeployed) {
    console.log('Setting Function Specific Delays')

    const setFunctionSpecificDelaySignature = 'setFunctionSpecificDelay(string,uint)'

    // Set Expedition Treasury Address
    const setExpedAddSignature = 'setExpedAdd(address)'
    const setExpedAddData = abiCoder.encode(
      ['string', 'uint'],
      [setExpedAddSignature, 72 * 3600],
    )
    console.log({
      sig: setExpedAddSignature,
      data: setExpedAddData,
    })
    await execute(
      'Timelock',
      { from: dev },
      'queueTransaction',
      Timelock.address,
      0,
      setFunctionSpecificDelaySignature,
      setExpedAddData,
      timestampWithDelay,
    )

    // Set Token Passthrough Strategy
    const setTokenPassthroughStrategySignature = 'setTokenPassthroughStrategy(address,address)'
    const setTokenPassthroughStrategyData = abiCoder.encode(
      ['string', 'uint'],
      [setTokenPassthroughStrategySignature, 72 * 3600],
    )
    console.log({
      sig: setTokenPassthroughStrategySignature,
      data: setTokenPassthroughStrategyData,
    })
    await execute(
      'Timelock',
      { from: dev },
      'queueTransaction',
      Timelock.address,
      0,
      setFunctionSpecificDelaySignature,
      setTokenPassthroughStrategyData,
      timestampWithDelay,
    )

    // Retire Token Passthrough Strategy
    const retireTokenPassthroughStrategySignature = 'retireTokenPassthroughStrategy(address)'
    const retireTokenPassthroughStrategyData = abiCoder.encode(
      ['string', 'uint'],
      [retireTokenPassthroughStrategySignature, 72 * 3600],
    )
    console.log({
      sig: retireTokenPassthroughStrategySignature,
      data: retireTokenPassthroughStrategyData,
    })
    await execute(
      'Timelock',
      { from: dev },
      'queueTransaction',
      Timelock.address,
      0,
      setFunctionSpecificDelaySignature,
      retireTokenPassthroughStrategyData,
      timestampWithDelay,
    )


    console.log('Finished Function Specific Delays')
  // }

};
export default deployTimelock;
deployTimelock.tags = ['Timelock', 'LOCALHOST', 'MAINNET']
deployTimelock.dependencies = ['Cartographer']
