import { getNamedSigners } from '@nomiclabs/hardhat-ethers/dist/src/helpers'
import { Contract } from 'ethers'
import hre, { getChainId, artifacts, ethers } from 'hardhat'
import { chainIdAllowsVerification, consoleLog, delay, e18, OASIS, toDecimal } from '../utils'


async function main() {
    // PROCESS:
    //  Deploy many fake summit tokens 
    //  Mint all fake summits to dev address
    //  Assign owner of all fake summits to cartographer
    //  Randomly select which will be the real summit
    //  Add liquidity to all fake summits
    //  Initialize summit with correct contract address
    //  Wait 1 Minutes
    //  Pull liquidity from fake pancakeswap summit tokens

    await hre.run('deploy')

    const { dev } = await getNamedSigners(hre)
    const chainId = await getChainId()
    const Cartographer = await ethers.getContract('Cartographer')
    const pcsRouterAdd = '0x10ED43C718714eb63d5aA57B78B54704E256024E'
    const pcsFactoryAdd = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73'
    const wBNBAdd = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
    const pcsRouterArtifact = await artifacts.readArtifact("IPancakeRouter")
    const pcsFactoryArtifact = await artifacts.readArtifact("IPancakeFactory")
    const pcsPairArtifact = await artifacts.readArtifact('IUniswapV2Pair')
    const PCSRouter = await new ethers.Contract(pcsRouterAdd, pcsRouterArtifact.abi, ethers.provider)
    const PCSFactory = await new ethers.Contract(pcsFactoryAdd, pcsFactoryArtifact.abi, ethers.provider)

    const SummitTokenFactory = await hre.ethers.getContractFactory('SummitToken');
    const trueSummitIndex = Math.floor(Math.random() * 10)
    
    const initBalance = await ethers.provider.getBalance(dev.address)

    const res = await Promise.all(Array(10).fill('').map(async (_, i) => {
        const summitToken = await SummitTokenFactory.deploy();
        await summitToken.deployed();
        await summitToken.connect(dev).mint(dev.address, e18(20000))
        await summitToken.connect(dev).transferOwnership(Cartographer.address)
        await summitToken.connect(dev).approve(pcsRouterAdd, e18(20000))
        const liqAmount = trueSummitIndex === i ? 55 : (Math.floor(Math.random() * 45) + 5)
        const addLiquidityTx = await PCSRouter.connect(dev).addLiquidityETH( 
            summitToken.address, 
            e18(20000), 
            e18(1),
            e18(50),
            dev.address, 
            ~~((Date.now() + 1000*24*60*60) / 1000), // unix date 24h into the future
            {from: dev.address, value: e18(liqAmount)}
        )
        await addLiquidityTx.wait(10)
        const pairAdd = await PCSFactory.connect(dev).getPair(summitToken.address, wBNBAdd);

        const pair = await new ethers.Contract(pairAdd, pcsPairArtifact.abi, ethers.provider)
        const balance = await pair.balanceOf(dev.address); 

        return { summitToken, liqAmount, pairAdd, liqTokenBalance: balance }
    }))

    const summitTokens = res.map((singleRes) => singleRes.summitToken)
    const totalLiqAmount = res.reduce((acc, singleRes) => acc + singleRes.liqAmount, 0)
    const pairAddresses = res.map((singleRes) => singleRes.pairAdd)
    const liqTokenBalances = res.map((singleRes) => singleRes.liqTokenBalance)
    const midBalance = await ethers.provider.getBalance(dev.address)    

    const trueSummitToken = summitTokens[trueSummitIndex]
    consoleLog('True Summit To be Added to Cartographer', trueSummitToken.address)

    const enableTx = await Cartographer.connect(dev).enable();
    await enableTx.wait(10)

    await delay(1000)

    await Promise.all(summitTokens.map(async (summitToken, i) => {
        if (i !== trueSummitIndex) {
            const pair = await new ethers.Contract(pairAddresses[i], pcsPairArtifact.abi, ethers.provider)
            await pair.connect(dev).approve(PCSRouter.address, liqTokenBalances[i])
            const removeLiquidityTx = await PCSRouter.connect(dev).removeLiquidityETH( 
                summitToken.address, 
                liqTokenBalances[i], 
                0,
                0,
                dev.address, 
                ~~((Date.now() + 1000*24*60*60) / 1000), // unix date 24h into the future
            )
            await removeLiquidityTx.wait(10)
        }
    }))

    const finalBalance = await ethers.provider.getBalance(dev.address)

    if (chainIdAllowsVerification(chainId)) {
        await run('verify:verify', {
            address: trueSummitToken.address,
        })
    }

    consoleLog({
        eth: `${toDecimal(initBalance)} --> ${toDecimal(midBalance)} --> ${toDecimal(finalBalance)}: ${toDecimal(initBalance.sub(finalBalance))}`,
        totalLiq: totalLiqAmount,
        gasSpend: toDecimal(initBalance.sub(finalBalance).sub(e18(55))),
    })
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
