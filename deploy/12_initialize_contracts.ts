import {DeployFunction} from 'hardhat-deploy/types'
import { chainIdIsMainnet, consoleLog, Contracts, getCartographer, getSubCartographers, MESA, OASIS, PLAINS, SUMMIT, ZEROADD } from '../utils'

const initializeContracts: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId
}) {
  const {execute} = deployments;
  const {dev} = await getNamedAccounts();

  const Cartographer = await getCartographer()
  const cartSummitToken = await Cartographer.summit()
  consoleLog('Cartographer address', Cartographer.address, Contracts.SummitToken, cartSummitToken)

  const chainId = await getChainId()
  const isMainnet = chainIdIsMainnet(chainId)

  if (cartSummitToken === ZEROADD) {
    const SummitToken = await deployments.get(Contracts.SummitToken)
    const EverestToken = await deployments.get(Contracts.EverestToken)
    const CakeToken = await deployments.get(Contracts.DummyCAKE)
    const USDCToken = await deployments.get(Contracts.DummyUSDC)
    const SubCartographers = await getSubCartographers()
    const ElevationHelper = await deployments.get(Contracts.ElevationHelper)
    const ExpeditionV2 = await deployments.get(Contracts.ExpeditionV2)
    const SummitGlacier = await deployments.get(Contracts.SummitGlacier)

    const mainnetSummitToken = '0x8F9bCCB6Dd999148Da1808aC290F2274b13D7994'
    const mainnetUSDCAddress = '0x04068da6c83afcfa0e13ba15a6696662335d5b75'
    const tokenSwapSummitAddress = isMainnet ? mainnetSummitToken : CakeToken.address
    const expeditionUSDCAddress = isMainnet ? mainnetUSDCAddress : USDCToken.address
    
    // Initialize cartographer
    await execute(
      'Cartographer',
      { from: dev },
      'initialize',
      SummitToken.address,
      ElevationHelper.address,
      SubCartographers[OASIS].address,
      SubCartographers[PLAINS].address,
      SubCartographers[MESA].address,
      SubCartographers[SUMMIT].address,
      EverestToken.address,
      SummitGlacier.address,
    )
    consoleLog('Cartographer Initialized')


    // Initialize Summit Token Swap
    await execute(
      Contracts.SummitToken,
      { from: dev },
      'initialize',
      tokenSwapSummitAddress,
    )
    
    // Transfer summit token ownership to cartographer
    await execute(
      Contracts.SummitToken,
      { from: dev },
      'transferOwnership',
      Cartographer.address
    )
    consoleLog('Transferred Ownership of SUMMIT Token to Cartographer')

    // Initialize Summit Glacier
    await execute(
      Contracts.SummitGlacier,
      { from: dev },
      'initialize',
      SummitToken.address,
      EverestToken.address,
      Cartographer.address,
      ExpeditionV2.address
    )

    // Initialize Expedition V2
    await execute(
      Contracts.ExpeditionV2,
      { from: dev },
      'initialize',
      expeditionUSDCAddress,
      ElevationHelper.address,
    )

    // Add ExpeditionV2 as an EverestExtension
    await execute(
      Contracts.EverestToken,
      { from: dev },
      'addEverestExtension',
      ExpeditionV2.address,
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
  'SummitGlacier',
  'EverestToken',
  'ExpeditionV2',
]