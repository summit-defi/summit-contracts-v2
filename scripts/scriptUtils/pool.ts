import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import hre, { ethers, getChainId } from "hardhat";
import { getCartographer, getElevationName, PoolConfig, promiseSequenceMap, replaceSummitAddresses, writePoolAllocation, writePoolPid } from "../../utils";

export const createPool = async (pool: PoolConfig, summitAddress: string) => {
    const chainId = await getChainId()
    const { dev } = await getNamedSigners(hre)
    const Cartographer = await getCartographer()
    const tokenAddress = replaceSummitAddresses(pool.token, summitAddress)

    console.log(`\tCreate Pool: ${pool.name}`)

    // Create allocation if it doesn't exist
    const allocationExists = await Cartographer.tokenAllocExistence(tokenAddress)
    if (!allocationExists) {
        const createAllocationTx = await Cartographer.connect(dev).createTokenAllocation(tokenAddress, pool.allocation)
        await createAllocationTx.wait(10)
        console.log(`\t\tPool allocation created: ${pool.allocation}`)
        writePoolAllocation(chainId, pool.name, pool.allocation)
    } else {
        const baseAllocation = await Cartographer.tokenBaseAlloc(tokenAddress)

        // Update allocation if it exists but is different than intended allocation
        if (baseAllocation.toNumber() !== pool.allocation) {
            const updateAllocationTx = await Cartographer.connect(dev).setTokenAlloc(tokenAddress, pool.allocation)
            await updateAllocationTx.wait(10)
            console.log(`\t\tPool allocation updated: ${baseAllocation} --> ${pool.allocation}`)
            writePoolAllocation(chainId, pool.name, pool.allocation)
        }
    }

    await promiseSequenceMap(
        [0, 1, 2, 3],
        async (elevation) => {
            if (!pool.elevations[getElevationName(elevation)].exists) {
                console.log(`\t\tPool not designated: ${getElevationName(elevation)}`)
                writePoolPid(chainId, pool.name, elevation, undefined)
                return
            }

            // Early exit if pool already exists
            const poolAtElevExists = await Cartographer.tokenElevationPid(tokenAddress, elevation)
            if (poolAtElevExists > 0) {
                console.log(`\t\tPool already exists: ${getElevationName(elevation)}`)
                writePoolPid(chainId, pool.name, elevation, poolAtElevExists)
                return
            }

            // Create Pool
            const createPoolTx = await Cartographer.connect(dev).add(
                tokenAddress,
                elevation,
                pool.elevations[getElevationName(elevation)].live,
                false
            )
            await createPoolTx.wait(10)
            console.log(`\t\tPool at elevation created: ${getElevationName(elevation)}`)

            // Get newly created pool Id
            const createdPoolPid = await Cartographer.tokenElevationPid(tokenAddress, elevation)
            
            // Add pool id to created pools list
            writePoolPid(chainId, pool.name, elevation, createdPoolPid)
        }
    )

    console.log('\t\tdone.\n')
}