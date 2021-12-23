import { DeployFunction } from 'hardhat-deploy/types'
import { chainIdExportsAddresses, chainIdRequiresDummies, getContract, writeContractAddresses } from '../utils'

const exportAddresses: DeployFunction = async function ({
    deployments,
    getChainId,
}) {
    const chainId = await getChainId()
    if (!chainIdExportsAddresses(chainId)) return;

    const cartographer = await deployments.get('Cartographer')
    const SummitToken = await deployments.get('SummitToken')
    
    const cartographerOasis = await deployments.get('CartographerOasis')
    const cartographerElevation = await deployments.get('CartographerElevation')
    const cartographerExpedition = await deployments.get('CartographerExpedition')
    const elevationHelper = await deployments.get('ElevationHelper')
    const summitReferrals = await deployments.get('SummitReferrals')
    const timelock = await deployments.get('Timelock')

    let additionalAddresses = [] as any[]
    if (chainIdRequiresDummies(chainId)) {
        const usdcToken = await deployments.get('DummyUSDC')
        const bifiToken = await deployments.get('DummyBIFI')
        const cakeToken = await deployments.get('DummyCAKE')
        let gasStressTokens = [];
        for (let i = 0; i < 12; i++) {
            gasStressTokens.push(await getContract(`GS${i}`));
        }        
        additionalAddresses = [
            ['dummyUSDC', usdcToken.address],
            ['dummyBIFI', bifiToken.address],
            ['dummyCAKE', cakeToken.address],
            gasStressTokens.map((token, index) => [`dummyGS${index}`, token.address]),
        ]
    }

    writeContractAddresses(chainId, [
        ['summitToken', SummitToken.address],
        ['cartographer', cartographer.address],
        ['cartographerOasis', cartographerOasis.address],
        ['cartographerElevation', cartographerElevation.address],
        ['cartographerExpedition', cartographerExpedition.address],
        ['elevationHelper', elevationHelper.address],
        ['summitReferrals', summitReferrals.address],
        ['timelock', timelock.address],
        ...additionalAddresses,
    ])
}

export default exportAddresses
exportAddresses.tags = ['exportAddresses', 'TESTNET', 'MAINNET']
exportAddresses.runAtTheEnd = true
exportAddresses.dependencies = ['initializeContracts', 'Timelock']
