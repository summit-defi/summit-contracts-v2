import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers"
import hre from "hardhat"
import { PoolConfig, getElevationName, promiseSequenceMap, replaceSummitAddresses, subCartGet, cartographerGet, getSummitToken, cartographerMethod, cartographerSetParam } from "../../utils"

export const syncPools = async (elevation: number, poolConfigs: PoolConfig[]) => {
    const { dev } = await getNamedSigners(hre)
    const elevationName = getElevationName(elevation)
    const summitToken = await getSummitToken()

    await promiseSequenceMap(
        poolConfigs,
        async (poolConfig) => {
            const { name: configName, token: configToken, allocation: configAllocation, elevations: configElevations, taxBP: configTaxBP, depositFeeBP: configDepositFeeBP, native: configNative } = poolConfig
            const configElevation = configElevations[elevationName]


            
            // Pool Token / LP Address
            const tokenAddress = replaceSummitAddresses(configToken, summitToken.address)
            console.log(`\n\n\n== POOL: ${configName} at The ${elevationName} ==`)





            // Token is Native is Correct, if not queue to update it
            const existingNative = (await cartographerGet.isNativeFarmToken(tokenAddress))
            console.log('\n-- Token Is Native --')
            if (existingNative !== configNative) {
                console.log(`\tToken Is Native out of sync, syncing ${existingNative} => ${configNative}`)
                // UPDATE TOKEN IS NATIVE TRANSACTION
                await cartographerSetParam.setTokenIsNativeFarm({
                    dev,
                    tokenAddress,
                    tokenIsNativeFarm: configNative
                })
                console.log(`\t\t\tdone.`)
            } else {
                console.log(`\t\tpassed.`)
            }




            // Token Allocation Existence & Correct, if not queue to add/update it
            const allocationExists = await cartographerGet.tokenAllocExistence(tokenAddress)
            const existingAllocation = await cartographerGet.tokenAlloc(tokenAddress)
            
            console.log('\n-- Allocation --')
            if (!allocationExists || existingAllocation !== configAllocation) {
                console.log(`\tAllocation doesnt exist our out of sync, syncing ${existingAllocation} => ${configAllocation}`)
                // ADD TOKEN ALLOCATION TRANSACTION
                await cartographerMethod.setTokenAllocation({
                    dev,
                    tokenAddress,
                    allocation: configAllocation
                })
                console.log(`\t\tdone.`)
            } else {
                console.log(`\t\tpassed.`)
            }





            // Token TaxBP Correct, if not queue to update it
            const existingTaxBP = (await cartographerGet.tokenWithdrawalTax(tokenAddress))
            const taxBPOutOfSync = existingTaxBP !== configTaxBP
            console.log('\n-- Token Withdraw Tax --')
            if (taxBPOutOfSync) {
                console.log(`\tToken TaxBP out of sync, syncing ${existingTaxBP} => ${configTaxBP}`)
                // UPDATE TOKEN TAX BP TRANSACTION
                await cartographerSetParam.setTokenWithdrawTax({
                    dev,
                    tokenAddress,
                    taxBP: configTaxBP
                })
                console.log(`\t\t\tdone.`)
            } else {
                console.log(`\t\tpassed.`)
            }





            // Token DepositFeeBP Correct, if not queue to update it
            const existingDepositFeeBP = (await cartographerGet.getTokenDepositFee(tokenAddress))
            const depositFeeBPOutOfSync = existingDepositFeeBP !== configDepositFeeBP
            console.log('\n-- Token Deposit Fee --')
            if (depositFeeBPOutOfSync) {
                console.log(`\tToken DepositFeeBP out of sync, syncing ${existingDepositFeeBP} => ${configDepositFeeBP}`)
                // UPDATE TOKEN TAX BP TRANSACTION
                await cartographerSetParam.setTokenDepositFee({
                    dev,
                    tokenAddress,
                    feeBP: configDepositFeeBP,
                })
                console.log(`\t\t\tdone.`)
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





            // Pool Existence, if not create it
            console.log('\n-- Pool --')
            const poolExists = await cartographerGet.poolExists(tokenAddress, elevation)
            if (!poolExists) {
                console.log(`\tPool doesnt exist, creating: add(${tokenAddress}, ${elevation}, ${configElevation.live}, false)`)
                // ADD POOL
                await cartographerMethod.add({
                    dev,
                    tokenAddress,
                    elevation,
                    live: configElevation.live,
                    withUpdate: false
                })
                console.log(`\t\tdone.`)
            } else {
                console.log(`\tPool exists, checking in sync`)
                // Validate that pool LIVE matches config, if not queue to update it
                const existingLive = (await subCartGet.poolInfo(tokenAddress, elevation)).live
                if (existingLive !== configElevation.live) {
                    console.log(`\t\tPool live out of sync: ${existingLive} --> ${configElevation.live}`)
                    console.log(`\t\tUpdating pool: set(${tokenAddress}, ${elevation}, ${configElevation.live}, ${configDepositFeeBP}, false)`)
                    // UPDATE POOL LIVE VALUE
                    await cartographerMethod.set({
                        dev,
                        tokenAddress,
                        elevation,
                        live: configElevation.live,
                        withUpdate: false,
                    })
                    console.log(`\t\t\tdone.`)
                } else {
                    console.log(`\t\tpassed.`)
                }
            }
        }
    )
}

