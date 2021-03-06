import { getChainId } from 'hardhat'
import { chainIdRequiresDummies, getBifiToken, getCakeToken, getCartographer, getContract, getElevationHelper, getEverestToken, getExpedition, getSubCartographers, getSummitGlacier, getSummitToken, getTimelock, getUSDCToken, writeContractAddresses } from '../utils'

async function main() {
    const chainId = await getChainId()

    const cartographer = await getCartographer()
    const SummitToken = await getSummitToken()
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
            ['USDC', usdcToken.address],
            ['BIFI', bifiToken.address],
            ['CAKE', cakeToken.address],
            ...gasStressTokens.map((token, index) => [`GS${index}`, token.address]),
        ]
        console.log({
            additionalAddresses
        })
    }

    writeContractAddresses(chainId, [
        ['summitToken', SummitToken.address],
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

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });