import { Contract } from "ethers"
import { ethers } from "hardhat"
import { createPassthroughStrategy } from "."
import { NamedElevations, Contracts, checkForAlreadyQueuedMatchingTimelockTx, PoolConfig, getElevationName, promiseSequenceMap, replaceSummitAddresses, UpdatePoolTxHashes, UpdatePoolTxType, ZEROADD, delay, TxHashAndNote, flatten, getPassthroughStrategy, hardhatChainId } from "../../utils"
import { TimelockTargetContract, QueueTxConfig, getTxSignatureBase, queueTimelockTransaction, TimelockedTransaction } from "../../utils/timelockUtils"

const getPoolInfo = async (elevationName: NamedElevations, poolPid: number) => {
    if (elevationName === NamedElevations.OASIS) {
        const cartographerOasis = await ethers.getContract(Contracts.CartographerOasis)
        return await cartographerOasis.oasisPoolInfo(poolPid)
    } else {
        const cartographerElevation = await ethers.getContract(Contracts.CartographerElevation)
        return await cartographerElevation.elevationPoolInfo(poolPid)
    }

}


const getContractFromName = async (queuedTxTargetName: TimelockTargetContract): Promise<Contract> => {
    return await ethers.getContract(queuedTxTargetName)
}

const queueTransactionInTimelock = async (chainId: string, dryRun: boolean, note: string, { targetContractName, txName, txParams }: QueueTxConfig) => {
    const targetContract = await getContractFromName(targetContractName)
    const txSignature = getTxSignatureBase({ targetContract, txName })
    console.log(`\tQueue Transaction: ${txSignature}, params: (${txParams.join(',')})`)

    const alreadyQueuedMatchingTxHash = checkForAlreadyQueuedMatchingTimelockTx(chainId, targetContract.address, txSignature, txParams)
    if (alreadyQueuedMatchingTxHash != null) {
        console.log('\t\t', `Matching Existing Queued Tx Found: ${alreadyQueuedMatchingTxHash}, skipping (use force to push it through)\n`)
        return
    }

    const { txHash } = await queueTimelockTransaction({ dryRun, targetContract, txName, txParams, note })

    console.log('\tdone.')
    if(!dryRun && chainId !== hardhatChainId) {
        await delay(20000)
    }
    return txHash
}

export const queueSyncPoolsTimelockTransactions = async (chainId: string, dryRun: boolean, elevation: number, poolConfigs: PoolConfig[],  cartographer: Contract, summitAddress: string, summitLpAddress: string): Promise<TxHashAndNote[]> => {
    const elevationName = getElevationName(elevation)

    const queuedTxHashes = await promiseSequenceMap(
        poolConfigs,
        async (poolConfig) => {
            let poolQueuedTxHashes: TxHashAndNote[] = []

            const { name: configName, token: configToken, allocation: configAllocation, elevations: configElevations, fee: configFee } = poolConfig
            const configElevation = configElevations[elevationName]



            
            // Pool Token / LP Address
            const tokenAddress = replaceSummitAddresses(configToken, summitAddress, summitLpAddress)
            console.log(`\n\n\n== POOL: ${configName} at The ${elevationName} ==`)
            




            // Token Allocation Existence & Correct, if not queue to add/update it
            const allocationExists = await cartographer.tokenAllocExistence(tokenAddress)
            console.log('\n-- Allocation --')
            if (!allocationExists) {
                console.log(`\tAllocation doesnt exist, creating: ${configAllocation}`)
                const createAllocationNote = `Create ${configName} Allocation: ${configAllocation}`
                // QUEUE ADD TOKEN ALLOCATION TRANSACTION
                const createTokenAllocationTxHash = await queueTransactionInTimelock(chainId, dryRun, createAllocationNote, {
                    targetContractName: TimelockTargetContract.Cartographer,
                    txName: TimelockedTransaction.Cartographer_CreateTokenAllocation,
                    txParams: [tokenAddress, configAllocation],
                })
                if (createTokenAllocationTxHash != null) poolQueuedTxHashes.push({
                    txHash: createTokenAllocationTxHash,
                    note: createAllocationNote,
                })
                console.log(`\t\tqueued.`)
            } else {
                console.log(`\tAllocation exists, validating in sync: ${configAllocation}`)
                // Validate Token Allocation matches, if not queue to update it
                const existingAllocation = (await cartographer.tokenBaseAlloc(tokenAddress)).toNumber()
                if (existingAllocation !== configAllocation) {
                    console.log(`\t\tAllocation out of sync, syncing ${existingAllocation} => ${configAllocation}`)
                    const updateAllocationNote = `Update ${configName} Allocation: ${existingAllocation} => ${configAllocation}`
                    // QUEUE UPDATE TOKEN ALLOCATION TRANSACTION
                    const setTokenSharedAllocationTxHash = await queueTransactionInTimelock(chainId, dryRun, updateAllocationNote, {
                        targetContractName: TimelockTargetContract.Cartographer,
                        txName: TimelockedTransaction.Cartographer_SetTokenSharedAlloc,
                        txParams: [tokenAddress, configAllocation],
                    })
                    if (setTokenSharedAllocationTxHash != null) poolQueuedTxHashes.push({
                        txHash: setTokenSharedAllocationTxHash,
                        note: updateAllocationNote,
                    })
                    console.log(`\t\t\tqueued.`)
                } else {
                    console.log(`\t\tpassed.`)
                }
            }



            // const passthroughStrategyAddress = await createPassthroughStrategy(poolConfig, summitAddress, summitLpAddress)

            

            // Passthrough Strategy, create it if need be
            // console.log('\n-- Passthrough Strategy --')
            // const tokenPassthroughStrategy = await cartographer.tokenPassthroughStrategy(tokenAddress) || ZEROADD
            // const existingPassthroughStrategy = getPassthroughStrategy(chainId, configName)
            // const configPassthroughStrategy = poolConfig.passthroughStrategy?.target || ZEROADD
            // console.log({
            //     tokenPassthroughStrategy,
            //     configPassthroughStrategy: poolConfig.passthroughStrategy?.target || ZEROADD,
            //     existingPassthroughStrategy: existingPassthroughStrategy?.passthroughContract || ZEROADD,
            // })
            // if ((tokenPassthroughStrategy === ZEROADD) !== (configPassthroughStrategy === ZEROADD) && configPassthroughStrategy !== ZEROADD) {
            //     console.log(`\t\tSetting passthrough strategy: ${poolConfig.passthroughStrategy?.target}`)


            //     let newPassthroughStrategyContract

            //     if (dryRun) {
            //         newPassthroughStrategyContract = '0x2b4c76d0dc16be1c31d4c1dc53bf9b45987fc75c'
            //     } else {
            //         newPassthroughStrategyContract = await createPassthroughStrategy(poolConfig, summitAddress, summitLpAddress)
            //     }

            //     const setPassthroughStrategyNote = `Set ${configName} Passthrough Strategy: ${newPassthroughStrategyContract}`

            //     // QUEUE TX
            //     if (newPassthroughStrategyContract != null) {
            //         const setPassthroughStrategyTxHash = await queueTransactionInTimelock(chainId, dryRun, setPassthroughStrategyNote, {
            //             targetContractName: TimelockTargetContract.Cartographer,
            //             txName: TimelockedTransaction.Cartographer_SetTokenPassthroughStrategy,
            //             txParams: [tokenAddress, newPassthroughStrategyContract]
            //         })
            //         if (setPassthroughStrategyTxHash != null) poolQueuedTxHashes.push({
            //             txHash: setPassthroughStrategyTxHash,
            //             note: setPassthroughStrategyNote,
            //         })
            //     }

            //     console.log('\t\tdone.')
            // } else {
            //     console.log(`\tpassed.`)
            // }

            // Pool Existence, if not queue to create it
            console.log('\n-- Pool --')
            const poolPid = await cartographer.tokenElevationPid(tokenAddress, elevation)
            if (poolPid === 0) {
                console.log(`\tPool doesnt exist, creating: add(${configAllocation}, ${elevation}, ${configElevation.live}, ${configFee}, false)`)
                const createPoolNote = `Create ${configName} Farm at ${elevationName} with params | Token: ${tokenAddress} | Live: ${configElevation.live} | Fee: ${configFee}`
                // QUEUE ADD POOL
                const addFarmTxHash = await queueTransactionInTimelock(chainId, dryRun, createPoolNote, {
                    targetContractName: TimelockTargetContract.Cartographer,
                    txName: TimelockedTransaction.Cartographer_AddFarm,
                    txParams: [tokenAddress, elevation, configElevation.live, configFee, false],
                })
                if (addFarmTxHash != null) poolQueuedTxHashes.push({
                    txHash: addFarmTxHash,
                    note: createPoolNote,
                })
                console.log(`\t\tqueued.`)
            } else {
                console.log(`\tPool exists, checking in sync: ${poolPid}`)
                // Validate that pool LIVE & FEE matches config, if not queue to update it
                const { live: existingLive, feeBP: existingFee } = await getPoolInfo(elevationName, poolPid)
                if (existingLive !== configElevation.live || existingFee !== configFee) {
                    console.log(`\t\tPool out of sync: ${existingLive !== configElevation.live ? `live: ${existingLive} !== ${configElevation.live}` : ''} ${existingFee !== configFee ? `fee: ${existingFee} !== ${configFee}` : ''}`)
                    console.log(`\t\tUpdating pool: set(${poolPid}, ${configElevation.live}, ${configFee}, false)`)
                    const updatePoolNote = `Update ${configName} Farm at ${elevationName} with params | Pid: ${poolPid} | Live: ${configElevation.live} | Fee: ${configFee}`
                    // QUEUE UPDATE POOL LIVE VALUE
                    const setFarmTxHash = await queueTransactionInTimelock(chainId, dryRun, updatePoolNote, {
                        targetContractName: TimelockTargetContract.Cartographer,
                        txName: TimelockedTransaction.Cartographer_SetFarm,
                        txParams: [poolPid, configElevation.live, configFee, false],
                    })
                    if (setFarmTxHash != null) poolQueuedTxHashes.push({
                        txHash: setFarmTxHash,
                        note: updatePoolNote,
                    })
                    console.log(`\t\t\tqueued.`)
                } else {
                    console.log(`\t\tpassed.`)
                }
            }

            return poolQueuedTxHashes
        }
    )

    return flatten(queuedTxHashes)
}
