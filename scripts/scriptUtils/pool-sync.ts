import { ethers, getChainId } from "hardhat"
import { PoolConfig, getElevationName, promiseSequenceMap, replaceSummitAddresses, subCartGet, cartographerGet, getSummitToken, cartographerMethod, cartographerSetParam, getEverestToken, ZEROADD, getPassthroughStrategy, getCartographer, allElevationPromiseSequenceMap, Contracts, getWrittenContractAddress } from "../../utils"
import { createPassthroughStrategy } from "./passthrough-strategy"

export const syncPools = async ({
    poolConfigs,
    callAsTimelock = false,
    dryRun = true,
    specificPools,
}: {
    poolConfigs: PoolConfig[],
    callAsTimelock?: boolean,
    dryRun?: boolean,
    specificPools?: string[],
}) => {
    const { dev } = await ethers.getNamedSigners()
    const summitToken = await getSummitToken()
    const chainId = await getChainId()
    const summitLpAddress = getWrittenContractAddress(chainId, 'summitLpToken')
    const everestToken = await getEverestToken()

    await promiseSequenceMap(
        poolConfigs,
        async (poolConfig) => {
            const {
                name: configName,
                token: configToken,
                allocation: configAllocation,
                elevations: configElevations,
                taxBP: configTaxBP,
                depositFeeBP: configDepositFeeBP,
                native: configNative,
                passthroughStrategy: configPassthroughStrategy,
            } = poolConfig

            // Early escape if not concerned with this pool
            if (specificPools != null && !specificPools.includes(configName)) return


            
            // Pool Token / LP Address
            const tokenAddress = replaceSummitAddresses(configToken, summitToken.address, summitLpAddress, everestToken.address)
            console.log(`\n\n\n== POOL: ${configName} - ${tokenAddress} ==`)





            // Token is Native is Correct, if not queue to update it
            const existingNative = (await cartographerGet.isNativeFarmToken(tokenAddress))
            console.log('\n-- Token Is Native --')
            if (existingNative !== configNative) {
                console.log(`\tToken Is Native out of sync, syncing ${existingNative} => ${configNative}`)
                // UPDATE TOKEN IS NATIVE TRANSACTION
                await cartographerSetParam.setTokenIsNativeFarm({
                    dev,
                    tokenAddress,
                    tokenIsNativeFarm: configNative,
                    callAsTimelock,
                    dryRun,
                    tokenSymbol: configName,
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
                    allocation: configAllocation,
                    callAsTimelock,
                    dryRun,
                    tokenSymbol: configName,
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
                    taxBP: configTaxBP,
                    callAsTimelock,
                    dryRun,
                    tokenSymbol: configName,
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
                    callAsTimelock,
                    dryRun,
                    tokenSymbol: configName,
                })
                console.log(`\t\t\tdone.`)
            } else {
                console.log(`\t\tpassed.`)
            }



            // Passthrough Strategy, create it if need be
            // console.log('\n-- Passthrough Strategy --')
            // const {
            //     targetVaultContract: existingTargetVaultContract,
            //     passthroughContract: existingPassthroughContract,
            // } = getPassthroughStrategy(chainId, configName) || {
            //     targetVaultContract: ZEROADD
            // }
            // const {
            //     target: configTargetVaultContract,
            // } = configPassthroughStrategy || {
            //     target: ZEROADD
            // }

            // const cartPassthroughStrategy = await cartographerGet.tokenPassthroughStrategy(tokenAddress)
            // let cartPassthroughStrategyVault = null
            // try {
            //     cartPassthroughStrategyVault = cartPassthroughStrategy === ZEROADD ?
            //     ZEROADD :
            //     await (await ethers.getContractAt(Contracts.BeefyVaultPassthrough, cartPassthroughStrategy)).vault()
            // } catch (e) {}
                
            // console.log({
            //     configTargetVaultContract,
            //     existingTargetVaultContract,
            //     cartPassthroughStrategy,
            //     cartPassthroughStrategyVault,
            // })
            // if (cartPassthroughStrategyVault !== configTargetVaultContract) {
            //     // Create a passthrough strategy if it doesnt exist
            //     let passthroughStrategyContractAddress: string | undefined | null
            //     if (existingTargetVaultContract !== configTargetVaultContract) {
            //         console.log(`\t\tCreate passthrough strategy`)
            //         passthroughStrategyContractAddress = await createPassthroughStrategy(poolConfig, summitToken.address, summitLpAddress, everestToken.address)
            //     } else {
            //         console.log(`\t\tPassthrough strategy already created: ${existingPassthroughContract}`)
            //         passthroughStrategyContractAddress = existingPassthroughContract
            //     }
                
            //     console.log(`\t\tSetting passthrough strategy: Contract<${passthroughStrategyContractAddress}> Target<${poolConfig.passthroughStrategy?.target}>`)

            //     // QUEUE TX
            //     if (passthroughStrategyContractAddress != null) {
            //         await cartographerMethod.setTokenPassthroughStrategy({
            //             dev,
            //             tokenAddress: configToken,
            //             passthroughTargetAddress: passthroughStrategyContractAddress,
            //             callAsTimelock,
            //             dryRun,
            //             tokenSymbol: configName,
            //         })
            //     }

            //     console.log('\t\tdone.')
            // } else {
            //     console.log(`\tpassed.`)
            // }



            await allElevationPromiseSequenceMap(
                async (elevation) => {
                    const elevationName = getElevationName(elevation)
                    const configElevation = configElevations[elevationName]

                    // Pool Existence, if not create it
                    console.log(`\n-- Pool at ${elevationName} --`)
                    const poolExists = await cartographerGet.poolExists(tokenAddress, elevation)
                    if (!poolExists) {
                        console.log(`\tPool doesnt exist, creating: add(${tokenAddress}, ${elevation}, ${configElevation.live}, false)`)
                        // ADD POOL
                        await cartographerMethod.add({
                            dev,
                            tokenAddress,
                            elevation,
                            live: configElevation.live,
                            withUpdate: false,
                            callAsTimelock,
                            dryRun,
                            tokenSymbol: configName,
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
                                callAsTimelock,
                                dryRun,
                                tokenSymbol: configName,
                            })
                            console.log(`\t\t\tdone.`)
                        } else {
                            console.log(`\t\tpassed.`)
                        }
                    }
                }
            )
        }
    )
}

