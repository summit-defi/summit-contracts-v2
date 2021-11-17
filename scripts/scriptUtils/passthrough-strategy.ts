import { ContractFactory } from '@ethersproject/contracts'
import { getNamedSigners } from '@nomiclabs/hardhat-ethers/dist/src/helpers'
import hre, { ethers, getChainId, run } from 'hardhat'
import { delay, PassthroughType, PoolConfig, replaceSummitAddresses, writePassthroughStrategy, ZEROADD } from '../../utils'

export const createPassthroughStrategy = async (pool: PoolConfig, summitAddress: string, summitLpAddress: string): Promise<string | undefined> => {
    const chainId = await getChainId()
    const { dev } = await getNamedSigners(hre)
    const Cartographer = await ethers.getContract('Cartographer')
    const tokenAddress = replaceSummitAddresses(pool.token, summitAddress, summitLpAddress)
        
    // Early exit if no target passthrough strategy
    if (pool.passthroughStrategy == null) return

    console.log(`\tCreate Passthrough Strategy: ${pool.name}`)

    const { type, target, pid, rewardToken } = pool.passthroughStrategy

    // // Early exit if passthrough strategy exists
    // const tokenPassthroughStrategy = await Cartographer.tokenPassthroughStrategy(tokenAddress)
    // if (tokenPassthroughStrategy != ZEROADD) {
    //     console.log(`\t\talready exists.\n`)
    //     const tokenPassthroughStrategy = await Cartographer.tokenPassthroughStrategy(tokenAddress)
    //     writePassthroughStrategy(
    //         chainId,
    //         pool.name,
    //         tokenAddress,
    //         tokenPassthroughStrategy,
    //     )
    //     return
    // }

    // Set passthrough creation variables
    let passthroughFactory: ContractFactory | null = null
    let constructorArguments: any[] = []
    let passthroughContract
    switch (type) {
        case PassthroughType.MasterChef:
            passthroughFactory = await ethers.getContractFactory('MasterChefPassthrough')
            constructorArguments = [
                Cartographer.address,
                target,
                pid,
                tokenAddress,
                rewardToken,
            ]
        break
        case PassthroughType.BeefyVaultV6:
            passthroughFactory = await ethers.getContractFactory('BeefyVaultV6Passthrough')
            constructorArguments = [
                Cartographer.address,
                target,
                tokenAddress,
            ]
            break
        case PassthroughType.BeefyVaultV6Native:
            passthroughFactory = await ethers.getContractFactory('BeefyVaultV6NativePassthrough')
            constructorArguments = [
                Cartographer.address,
                target,
                tokenAddress,
            ]
        break
        default: break
    }

    // Create passthrough contract
    if (passthroughFactory != null) {
        await run("compile")
        passthroughContract = await passthroughFactory.connect(dev).deploy(
            ...constructorArguments, {
                gasLimit: 1200000,
            }
        )
        console.log({
            passthroughContract
        })
        await delay(30)
        await passthroughContract.deployed()
    }

    console.log(`\t\tPassthrough contract created`)

    // // Verify passthrough contract
    // if (passthroughContract) {
    //     await run("verify:verify", {
    //         address: passthroughContract.address,
    //         constructorArguments: constructorArguments,
    //     })
    // }

    console.log(`\t\tPassthrough contract verified`)


    // // Set token passthrough strategy
    // if (passthroughContract) {
    //     const setPassthroughStrategyTx = await Cartographer.connect(dev).setTokenPassthroughStrategy(
    //         tokenAddress,
    //         passthroughContract.address,
    //     )
    //     await setPassthroughStrategyTx.wait(10)
    // }

    // console.log(`\t\tPassthrough strategy created`)

    // Write passthrough strategy to json
    if (passthroughContract) {
        const tokenPassthroughStrategy = await Cartographer.tokenPassthroughStrategy(tokenAddress)
        writePassthroughStrategy(
            chainId,
            pool.name,
            tokenAddress,
            tokenPassthroughStrategy
        )
    }

    await delay(30)


    console.log(`\t\tdone.\n`)
    return passthroughContract?.address
}