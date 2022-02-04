import { Contract } from "ethers"
import { ethers } from "hardhat"
import { createPassthroughStrategy } from "."
import { NamedElevations, Contracts, checkForAlreadyQueuedMatchingTimelockTx, PoolConfig, getElevationName, promiseSequenceMap, replaceSummitAddresses, UpdatePoolTxHashes, UpdatePoolTxType, ZEROADD, delay, TxHashAndNote, flatten, getPassthroughStrategy, hardhatChainId, subCartGet, getContract, cartographerGet, getSummitToken, getEverestToken } from "../../utils"
import { QueueTxConfig, getTxSignatureBase, queueTimelockTransaction } from "../../utils"
import { TimelockTxSig } from "../../utils/timelockConstants"

const getPoolLive = async (tokenAddress: string, elevation: number) => {
    return (await subCartGet.poolInfo(tokenAddress, elevation)).live
}
//     
//     const depositFeeBP = (await cartographerGet.getTokenDepositFee(tokenAddress))

//     return {
//         live,
//         taxBP,
//         depositFeeBP,
//     }
// }


const getContractFromName = async (queuedTxTargetName: string): Promise<Contract> => {
    return await getContract(queuedTxTargetName)
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

export const queueSyncPoolsTimelockTransactions = async (chainId: string, dryRun: boolean, elevation: number, poolConfigs: PoolConfig[]): Promise<TxHashAndNote[]> => {
    const elevationName = getElevationName(elevation)
    const summitToken = await getSummitToken()
    const everestToken = await getEverestToken()

    const queuedTxHashes = await promiseSequenceMap(
        poolConfigs,
        async (poolConfig) => {
            let poolQueuedTxHashes: TxHashAndNote[] = []

            const { name: configName, token: configToken, allocation: configAllocation, elevations: configElevations, taxBP: configTaxBP, depositFeeBP: configDepositFeeBP } = poolConfig
            const configElevation = configElevations[elevationName]



            
            // Pool Token / LP Address
            const tokenAddress = replaceSummitAddresses(configToken, summitToken.address, everestToken.address)
            console.log(`\n\n\n== POOL: ${configName} at The ${elevationName} ==`)
            




            // Token Allocation Existence & Correct, if not queue to add/update it
            const allocationExists = await cartographerGet.tokenAllocExistence(tokenAddress)
            const existingAllocation = await cartographerGet.tokenAlloc(tokenAddress)
            console.log('\n-- Allocation --')
            if (!allocationExists || existingAllocation !== configAllocation) {
                console.log(`\tAllocation doesnt exist or out of sync, syncing ${existingAllocation} => ${configAllocation}`)
                const allocationNote = `Set ${configName} Allocation: ${configAllocation}`
                // QUEUE ADD TOKEN ALLOCATION TRANSACTION
                const setTokenAllocationTxHash = await queueTransactionInTimelock(chainId, dryRun, allocationNote, {
                    targetContractName: Contracts.Cartographer,
                    txName: TimelockTxSig.Cartographer.SetTokenAllocation,
                    txParams: [tokenAddress, configAllocation],
                })
                if (setTokenAllocationTxHash != null) poolQueuedTxHashes.push({
                    txHash: setTokenAllocationTxHash,
                    note: allocationNote,
                })
                console.log(`\t\tqueued.`)
            } else {
                console.log(`\t\tpassed.`)
            }




            // Token TaxBP Correct, if not queue to update it
            const existingTaxBP = (await cartographerGet.tokenWithdrawalTax(tokenAddress))
            const taxBPOutOfSync = existingTaxBP !== configTaxBP
            console.log('\n-- Token Withdraw Tax --')
            if (taxBPOutOfSync) {
                console.log(`\tToken TaxBP out of sync, syncing ${existingTaxBP} => ${configTaxBP}`)
                const updateTaxBPNote = `Update ${configName} TaxBP: ${existingTaxBP} => ${configTaxBP}`

                // QUEUE UPDATE TOKEN TAX BP TRANSACTION
                const setTokenTaxBPTxHash = await queueTransactionInTimelock(chainId, dryRun, updateTaxBPNote, {
                    targetContractName: Contracts.Cartographer,
                    txName: TimelockTxSig.Cartographer.SetTokenWithdrawTax,
                    txParams: [tokenAddress, configTaxBP],
                })
                if (setTokenTaxBPTxHash != null) poolQueuedTxHashes.push({
                    txHash: setTokenTaxBPTxHash,
                    note: updateTaxBPNote,
                })
                console.log(`\t\t\tqueued.`)
            } else {
                console.log(`\t\tpassed.`)
            }

            


            // Token DepositFeeBP Correct, if not queue to update it
            const existingDepositFeeBP = (await cartographerGet.getTokenDepositFee(tokenAddress))
            const depositFeeBPOutOfSync = existingDepositFeeBP !== configDepositFeeBP
            console.log('\n-- Token Deposit Fee --')
            if (depositFeeBPOutOfSync) {
                console.log(`\tToken DepositFeeBP out of sync, syncing ${existingDepositFeeBP} => ${configDepositFeeBP}`)
                const updateDepositFeeBPNote = `Update ${configName} DepositFeeBP: ${existingDepositFeeBP} => ${configDepositFeeBP}`

                // QUEUE UPDATE TOKEN TAX BP TRANSACTION
                const setTokenDepositFeeBPTxHash = await queueTransactionInTimelock(chainId, dryRun, updateDepositFeeBPNote, {
                    targetContractName: Contracts.Cartographer,
                    txName: TimelockTxSig.Cartographer.SetTokenDepositFee,
                    txParams: [tokenAddress, configDepositFeeBP],
                })
                if (setTokenDepositFeeBPTxHash != null) poolQueuedTxHashes.push({
                    txHash: setTokenDepositFeeBPTxHash,
                    note: updateDepositFeeBPNote,
                })
                console.log(`\t\t\tqueued.`)
            } else {
                console.log(`\t\tpassed.`)
            }



            // const passthroughStrategyAddress = await createPassthroughStrategy(poolConfig, summitToken.address, summitLpAddress)

            

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
            //         newPassthroughStrategyContract = await createPassthroughStrategy(poolConfig, summitToken.address, summitLpAddress)
            //     }

            //     const setPassthroughStrategyNote = `Set ${configName} Passthrough Strategy: ${newPassthroughStrategyContract}`

            //     // QUEUE TX
            //     if (newPassthroughStrategyContract != null) {
            //         const setPassthroughStrategyTxHash = await queueTransactionInTimelock(chainId, dryRun, setPassthroughStrategyNote, {
            //             targetContractName: Contracts.Cartographer,
            //             txName: TimelockTxSig.Cartographer_SetTokenPassthroughStrategy,
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
            const poolExists = await cartographerGet.poolExists(tokenAddress, elevation)
            if (!poolExists) {
                console.log(`\tPool doesnt exist, creating: add(${tokenAddress}, ${elevation}, ${configElevation.live}, false)`)
                const createPoolNote = `Create ${configName} Farm at ${elevationName} with params | Live: ${configElevation.live}`
                // QUEUE ADD POOL
                const addFarmTxHash = await queueTransactionInTimelock(chainId, dryRun, createPoolNote, {
                    targetContractName: Contracts.Cartographer,
                    txName: TimelockTxSig.Cartographer.AddFarm,
                    txParams: [tokenAddress, elevation, configElevation.live, false],
                })
                if (addFarmTxHash != null) poolQueuedTxHashes.push({
                    txHash: addFarmTxHash,
                    note: createPoolNote,
                })
                console.log(`\t\tqueued.`)
            } else {
                console.log(`\tPool exists, checking in sync`)
                // Validate that pool LIVE matches config, if not queue to update it
                const existingLive = await getPoolLive(tokenAddress, elevation)

                // const taxBPOutOfSync = existingTaxBP !== configTaxBP
                // const depositFeeBPOutOfSync = existingDepositFeeBP !== configDepositFeeBP
                const liveOutOfSync = existingLive !== configElevation.live

                // TaxBP out of sync, update
                // if (taxBPOutOfSync) {

                // }

                // // DepositFeeBP out of sync, update
                // if (depositFeeBPOutOfSync) {

                // }

                // Live out of sync, update
                if (liveOutOfSync) {
                    console.log(`\t\tPool live out of sync: ${existingLive} --> ${configElevation.live}`)
                    console.log(`\t\tUpdating pool: set(${tokenAddress}, ${elevation}, ${configElevation.live}, ${configDepositFeeBP}, false)`)
                    const updatePoolNote = `Update ${configName} Farm at ${elevationName} with params | Live: ${configElevation.live}`
                    // QUEUE UPDATE POOL LIVE VALUE
                    const setFarmTxHash = await queueTransactionInTimelock(chainId, dryRun, updatePoolNote, {
                        targetContractName: Contracts.Cartographer,
                        txName: TimelockTxSig.Cartographer.SetFarm,
                        txParams: [tokenAddress, elevation, configElevation.live, false],
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
