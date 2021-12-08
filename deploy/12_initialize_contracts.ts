import {DeployFunction} from 'hardhat-deploy/types'
import { createLpPair, getLpPair } from '../scripts/scriptUtils';
import { chainIdAMMFactory, chainIdAMMPairCodeHash, chainIdWrappedNativeToken, computePairAddress, consoleLog, Contracts, getCartographer, getElevationName, getSubCartographers, MESA, OASIS, PLAINS, promiseSequenceMap, SUMMIT, ZEROADD } from '../utils'

const initializeContracts: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  ethers,
  getChainId,
}) {
  const {execute} = deployments;
  const {dev} = await getNamedAccounts();

  const Cartographer = await getCartographer()
  const cartSummitToken = await Cartographer.summit()
  consoleLog('Cartographer address', Cartographer.address, Contracts.SummitToken, cartSummitToken)

  if (cartSummitToken === ZEROADD) {
    const SummitToken = await deployments.get(Contracts.SummitToken)
    const EverestToken = await deployments.get(Contracts.EverestToken)
    const CakeToken = await deployments.get(Contracts.DummyCAKE)
    const SubCartographers = await getSubCartographers()
    const ElevationHelper = await deployments.get(Contracts.ElevationHelper)
    const SummitReferrals = await deployments.get(Contracts.SummitReferrals)
    const ExpeditionV2 = await deployments.get(Contracts.ExpeditionV2)
    const SummitLocking = await deployments.get(Contracts.SummitLocking)
    
    // Initialize cartographer
    await execute(
      'Cartographer',
      { from: dev },
      'initialize',
      SummitToken.address,
      ElevationHelper.address,
      SummitReferrals.address,
      SubCartographers[OASIS].address,
      SubCartographers[PLAINS].address,
      SubCartographers[MESA].address,
      SubCartographers[SUMMIT].address,
      EverestToken.address,
      SummitLocking.address,
    )
    consoleLog('Cartographer Initialized')

    // Initialize Summit Locking
    await execute(
      Contracts.SummitLocking,
      { from: dev },
      'initialize',
      SummitToken.address,
      EverestToken.address,
      Cartographer.address,
      ExpeditionV2.address
    )

    // Initialize Expedition V2
    // TODO: Add option for real USDC
    await execute(
      Contracts.ExpeditionV2,
      { from: dev },
      'initialize',
      CakeToken.address,
      ElevationHelper.address,
    )
  } else {
    consoleLog('Cartographer Already Initialized')
  }
};

export default initializeContracts;
initializeContracts.tags = ['InitializeContracts', 'LOCALHOST', 'TESTNET', 'MAINNET']
initializeContracts.runAtTheEnd = true
initializeContracts.dependencies = [
  'Cartographer', 
  'SummitToken',
  'CartographerOasis', 
  'CartographerElevation', 
  'CartographerExpedition', 
  'ElevationHelper', 
  'SummitReferrals',
  'SummitLocking',
  'ExpeditionV2',
]