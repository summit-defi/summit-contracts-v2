import hre, { ethers, getChainId } from "hardhat"
import { PoolConfig, getElevationName, promiseSequenceMap, replaceSummitAddresses, subCartGet, cartographerGet, getSummitToken, cartographerMethod, cartographerSetParam, getEverestToken, ZEROADD, getPassthroughStrategy, getCartographer, allElevationPromiseSequenceMap, Contracts } from "../../utils"
import { createPassthroughStrategy } from "./passthrough-strategy"
import { NonceManager } from "@ethersproject/experimental"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"

const dryRun = true

export const syncPools = async (poolConfigs: PoolConfig[], callAsTimelock = false) => {
    const { dev } = await ethers.getNamedSigners()
    const summitToken = await getSummitToken()
    const everestToken = await getEverestToken()
    const chainId = await getChainId()

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


            
            // Pool Token / LP Address
            const tokenAddress = replaceSummitAddresses(configToken, summitToken.address, everestToken.address)
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



            // const dryRun = true
            // Passthrough Strategy, create it if need be
            console.log('\n-- Passthrough Strategy --')
            const {
                targetVaultContract: existingTargetVaultContract,
            } = getPassthroughStrategy(chainId, configName) || {
                targetVaultContract: ZEROADD
            }
            const {
                target: configTargetVaultContract,
            } = configPassthroughStrategy || {
                target: ZEROADD
            }

            const cartPassthroughStrategy = await cartographerGet.tokenPassthroughStrategy(tokenAddress)
            const cartPassthroughStrategyVault = cartPassthroughStrategy === ZEROADD ?
                ZEROADD :
                await (await ethers.getContractAt(Contracts.BeefyVaultPassthrough, cartPassthroughStrategy)).vault()
                
            console.log({
                configTargetVaultContract,
                existingTargetVaultContract,
                cartPassthroughStrategy,
                cartPassthroughStrategyVault,
            })
            if (existingTargetVaultContract !== configTargetVaultContract) {
            // if ((tokenPassthroughStrategy === ZEROADD) !== (configPassthroughStrategy === ZEROADD) && configPassthroughStrategy !== ZEROADD) {
                console.log(`\t\tSetting passthrough strategy: ${poolConfig.passthroughStrategy?.target}`)

                // if (dryRun) {
                //     newPassthroughStrategyContract = '0x2b4c76d0dc16be1c31d4c1dc53bf9b45987fc75c'
                // } else {
                const newPassthroughStrategyContract = await createPassthroughStrategy(poolConfig, summitToken.address, everestToken.address)
                // }

                // const setPassthroughStrategyNote = `Set ${configName} Passthrough Strategy: ${newPassthroughStrategyContract}`

                console.log({
                    newPassthroughStrategyContract
                })

                // QUEUE TX
                if (newPassthroughStrategyContract != null) {
                    await cartographerMethod.setTokenPassthroughStrategy({
                        dev,
                        tokenAddress: configToken,
                        passthroughTargetAddress: newPassthroughStrategyContract,
                        callAsTimelock,
                        dryRun,
                        tokenSymbol: configName,
                    })
                    // const setPassthroughStrategyTxHash = await queueTransactionInTimelock(chainId, dryRun, setPassthroughStrategyNote, {
                    //     targetContractName: Contracts.Cartographer,
                    //     txName: TimelockTxSig.Cartographer_SetTokenPassthroughStrategy,
                    //     txParams: [tokenAddress, newPassthroughStrategyContract]
                    // })
                    // if (setPassthroughStrategyTxHash != null) poolQueuedTxHashes.push({
                    //     txHash: setPassthroughStrategyTxHash,
                    //     note: setPassthroughStrategyNote,
                    // })
                }

                console.log('\t\tdone.')
            } else {
                console.log(`\tpassed.`)
            }



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

