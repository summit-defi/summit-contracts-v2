import { DeployFunction } from 'hardhat-deploy/types'
import { getLpPair } from '../scripts/scriptUtils'
import { chainIdAMMFactory, chainIdExportsAddresses, chainIdWrappedNativeToken, writeContractAddresses } from '../utils'

const exportAddresses: DeployFunction = async function ({
    deployments,
    getChainId,
}) {
    const chainId = await getChainId()
    if (!chainIdExportsAddresses(chainId)) return;

    const cartographer = await deployments.get('Cartographer')
    const SummitToken = await deployments.get('SummitToken')
    
    const ammFactory = await chainIdAMMFactory(chainId)
    const wrappedNativeToken = await chainIdWrappedNativeToken(chainId)
    const summitLpAddress = await getLpPair(SummitToken.address, wrappedNativeToken!, ammFactory!, false)
    // const dummySummitLp = await deployments.get('DummySUMMITLP')
    // const bifiToken = await deployments.get('DummyBIFI')
    // const cakeToken = await deployments.get('DummyCAKE')
    const cartographerOasis = await deployments.get('CartographerOasis')
    const cartographerElevation = await deployments.get('CartographerElevation')
    const cartographerExpedition = await deployments.get('CartographerExpedition')
    const elevationHelper = await deployments.get('ElevationHelper')
    const summitReferrals = await deployments.get('SummitReferrals')
    const timelock = await deployments.get('Timelock')

    writeContractAddresses(chainId, [
        ['summitToken', SummitToken.address],
        ['summitLpToken', summitLpAddress],
        ['cartographer', cartographer.address],
        ['cartographerOasis', cartographerOasis.address],
        ['cartographerElevation', cartographerElevation.address],
        ['cartographerExpedition', cartographerExpedition.address],
        ['elevationHelper', elevationHelper.address],
        ['summitReferrals', summitReferrals.address],
        ['timelock', timelock.address],
    ])
}

export default exportAddresses
exportAddresses.tags = ['exportAddresses', 'TESTNET', 'MAINNET']
exportAddresses.runAtTheEnd = true
exportAddresses.dependencies = ['initializeContracts', 'Timelock']
