import { ContractFactory } from '@ethersproject/contracts'
import hre, { ethers, getChainId, run } from 'hardhat'
import { delay, failableVerify, getCartographer, PassthroughType, PoolConfig, replaceSummitAddresses, writePassthroughStrategy, ZEROADD } from '../../utils'

export const createPassthroughStrategy = async (pool: PoolConfig, summitAddress: string, everestAddress: string): Promise<string | undefined> => {
    const chainId = await getChainId()
    const { dev } = await ethers.getNamedSigners()
    const Cartographer = await getCartographer()
    const tokenAddress = replaceSummitAddresses(pool.token, summitAddress, everestAddress)
        
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
                gasLimit: 5000000,
            }
        )
        await passthroughContract.deployed()
        await delay(30000)
    }

    console.log(`\t\tPassthrough contract created`)

    // // Verify passthrough contract
    if (passthroughContract != null) {
        await failableVerify({
            address: passthroughContract.address,
            constructorArguments: constructorArguments,
        })
    }

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
        writePassthroughStrategy(
            chainId,
            pool.name,
            tokenAddress,
            passthroughContract.address,
            target,
        )
    }


    console.log(`\t\tdone.\n`)
    return passthroughContract?.address
}
