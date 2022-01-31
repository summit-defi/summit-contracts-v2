import { DeployFunction } from 'hardhat-deploy/types'
import { chainIdExportsAddresses, chainIdRequiresDummies, getBifiToken, getCakeToken, getCartographer, getContract, getElevationHelper, getEverestToken, getExpedition, getSubCartographers, getSummitGlacier, getSummitToken, getTimelock, getUSDCToken, writeContractAddresses } from '../utils'

const exportAddresses: DeployFunction = async function ({
    getChainId,
}) {
    const chainId = await getChainId()
    if (!chainIdExportsAddresses(chainId)) return;

    const cartographer = await getCartographer()
    const SummitToken = await getSummitToken()
    const oldSummitToken = await SummitToken.oldSummit()
    const EverestToken = await getEverestToken()
    const subCartographers = await getSubCartographers()
    const elevationHelper = await getElevationHelper()
    const ExpeditionV2 = await getExpedition()
    const SummitGlacier = await getSummitGlacier()
    const timelock = await getTimelock()

    let additionalAddresses = [] as any[]
    if (chainIdRequiresDummies(chainId)) {
        const usdcToken = await getUSDCToken()
        const bifiToken = await getBifiToken()
        const cakeToken = await getCakeToken()
        let gasStressTokens = [];
        for (let i = 0; i < 6; i++) {
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
        ['oldSummitToken', oldSummitToken],
        ['everestToken', EverestToken.address],
        ['cartographer', cartographer.address],
        ['cartographerOasis', subCartographers[0].address],
        ['cartographerPlains', subCartographers[1].address],
        ['cartographerMesa', subCartographers[2].address],
        ['cartographerSummit', subCartographers[3].address],
        ['expedition', ExpeditionV2.address],
        ['summitGlacier', SummitGlacier.address],
        ['elevationHelper', elevationHelper.address],
        ['timelock', timelock.address],
        ...additionalAddresses,
    ])
}

export default exportAddresses
exportAddresses.tags = ['exportAddresses', 'TESTNET', 'MAINNET']
exportAddresses.runAtTheEnd = true
exportAddresses.dependencies = ['initializeContracts', 'Timelock']
