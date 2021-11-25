import {DeployFunction} from 'hardhat-deploy/types'
import { createLpPair, getLpPair } from '../scripts/scriptUtils';
import { chainIdAMMFactory, chainIdAMMPairCodeHash, chainIdWrappedNativeToken, computePairAddress, consoleLog, ZEROADD } from '../utils'

const initializeContracts: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  ethers,
  getChainId,
}) {
  // const {execute} = deployments;
  // const {dev} = await getNamedAccounts();

  // const Cartographer = await ethers.getContract('Cartographer')
  // const cartSummitToken = await Cartographer.summit()
  // consoleLog('Cartographer address', Cartographer.address, 'summitToken', cartSummitToken)

  // if (cartSummitToken === ZEROADD) {
  //   const SummitToken = await deployments.get('SummitToken')
  //   const chainId = await getChainId()
  //   const ammFactory = await chainIdAMMFactory(chainId)
  //   const pairInitHash = await chainIdAMMPairCodeHash(chainId)
  //   const wrappedNativeToken = await chainIdWrappedNativeToken(chainId)
  //   const summitLpAddress = ammFactory != null && wrappedNativeToken != null ?
  //     await createLpPair(SummitToken.address, wrappedNativeToken, ammFactory, false) :
  //     // computePairAddress(ammFactory!, pairInitHash!, SummitToken.address, wrappedNativeToken) :
  //     (await deployments.get('DummySUMMITLP')).address

  //   console.log('SUMMIT LP ADDRESS:', summitLpAddress)

  //   const CartographerOasis = await deployments.get('CartographerOasis')
  //   const CartographerElevation = await deployments.get('CartographerElevation')
  //   const CartographerExpedition = await deployments.get('CartographerExpedition')
  //   const ElevationHelper = await deployments.get('ElevationHelper')
  //   const SummitReferrals = await deployments.get('SummitReferrals')
    
  //   // Initialize cartographer
  //   await execute(
  //     'Cartographer',
  //     { from: dev },
  //     'initialize',
  //     SummitToken.address,
  //     summitLpAddress,
  //     ElevationHelper.address,
  //     SummitReferrals.address,
  //     CartographerOasis.address,
  //     CartographerElevation.address,
  //     CartographerExpedition.address,
  //   )
  //   consoleLog('Cartographer Initialized')
  // } else {
  //   consoleLog('Cartographer Already Initialized')
  // }
};

export default initializeContracts;
initializeContracts.tags = ['InitializeContracts', 'LOCALHOST', 'TESTNET', 'MAINNET']
initializeContracts.runAtTheEnd = true
initializeContracts.dependencies = [
  'Cartographer', 
  'SummitToken', 
  'SummitLpToken',
  'CartographerOasis', 
  'CartographerElevation', 
  'CartographerExpedition', 
  'ElevationHelper', 
  'SummitReferrals',
  'ExpeditionV2',
]