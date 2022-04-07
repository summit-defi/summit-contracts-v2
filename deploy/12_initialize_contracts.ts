import { ethers } from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types'
import { createLpPair } from '../scripts/scriptUtils';
import { cartographerMethod, chainIdIsMainnet, chainIdUsdcAddress, chainIdWrappedNativeToken, consoleLog, Contracts, delay, everestMethod, expeditionMethod, getCartographer, getSubCartographers, MESA, OASIS, ownableMethod, PLAINS, SUMMIT, ZEROADD } from '../utils'
import { summitGlacierMethod } from '../utils/summitGlacierUtils';

const initializeContracts: DeployFunction = async function ({
  deployments,
  getChainId
}) {
  const { dev } = await ethers.getNamedSigners()

  const Cartographer = await getCartographer()
  const cartSummitToken = await Cartographer.summit()
  consoleLog('Cartographer address', Cartographer.address, Contracts.SummitToken, cartSummitToken)

  const chainId = await getChainId()
  const isMainnet = chainIdIsMainnet(chainId)

  if (cartSummitToken === ZEROADD) {
    const SummitToken = await deployments.get(Contracts.SummitToken)
    const EverestToken = await deployments.get(Contracts.EverestToken)
    const SubCartographers = await getSubCartographers()
    const ElevationHelper = await deployments.get(Contracts.ElevationHelper)
    const ExpeditionV2 = await deployments.get(Contracts.ExpeditionV2)
    const SummitGlacier = await deployments.get(Contracts.SummitGlacier)

    // let tokenSwapSummitAddress
    let expeditionUSDCAddress
    
    if (isMainnet) {
      // const mainnetSummitToken = '0x8F9bCCB6Dd999148Da1808aC290F2274b13D7994'
      const mainnetUSDCAddress = chainIdUsdcAddress(chainId)
      // tokenSwapSummitAddress = mainnetSummitToken
      expeditionUSDCAddress = mainnetUSDCAddress!
    } else {
      const CakeToken = await deployments.get(Contracts.DummyCAKE)
      const USDCToken = await deployments.get(Contracts.DummyUSDC)
      // tokenSwapSummitAddress = CakeToken.address
      expeditionUSDCAddress = USDCToken.address
    }


    
    // Initialize cartographer
    await cartographerMethod.initialize({
      dev,
      summitTokenAddress: SummitToken.address,
      elevationHelperAddress: ElevationHelper.address,
      oasisAddress: SubCartographers[OASIS].address,
      plainsAddress: SubCartographers[PLAINS].address,
      mesaAddress: SubCartographers[MESA].address,
      summitAddress: SubCartographers[SUMMIT].address,
      everestTokenAddress: EverestToken.address,
      summitGlacierAddress: SummitGlacier.address,
    })
    consoleLog('Cartographer Initialized')


    // Initialize Summit Token Swap
    // await summitTokenMethod.initialize({
    //   dev,
    //   oldSummitAddress: tokenSwapSummitAddress
    // })
    // consoleLog('Summit Token V1-->V2 Swap initialized')
    
    // Transfer summit token ownership to cartographer
    await ownableMethod.transferOwnership({
      dev,
      contractName: Contracts.SummitToken,
      newOwnerAddress: Cartographer.address,
    })
    consoleLog('Transferred Ownership of SUMMIT Token to Cartographer')

    // Initialize Summit Glacier
    await summitGlacierMethod.initialize({
      dev,
      summitTokenAddress: SummitToken.address,
      everestTokenAddress: EverestToken.address,
      cartographerAddress: Cartographer.address,
      expeditionAddress: ExpeditionV2.address
    })
    consoleLog('Summit Glacier Initialized')

    // Initialize Expedition V2
    await expeditionMethod.initialize({
      dev,
      usdcAddress: expeditionUSDCAddress,
      elevationHelperAddress: ElevationHelper.address
    })
    consoleLog('Expedition V2 Initialized')

    // Add ExpeditionV2 as an EverestExtension
    await everestMethod.addEverestExtension({
      dev,
      extension: ExpeditionV2.address
    })
    consoleLog('ExpeditionV2 Added as everest Extension')
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