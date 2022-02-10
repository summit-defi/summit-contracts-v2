import { expect } from "chai"
import hre, { ethers, getChainId } from "hardhat";
import { queueSyncPoolsTimelockTransactions } from "../scripts/scriptUtils/timelock-pool-sync";
import { syncTimelockFunctionSpecificDelays } from "../scripts/scriptUtils/sync-timelock-func-specific-delays";
import { mineBlockWithTimestamp, Contracts, ERR, getTimestamp, EVENT, PoolConfig, promiseSequenceMap, OASIS, cancelQueuedTimelockTransaction, cancelQueuedTimelockTransactionByHash, encodeQueuedTransactionHash, executeQueuedTimelockTransactionByHash, getCartographer, getDelay, getSummitToken, getTimelock, getTimelockTxParams, getTxSignatureBase, queueTimelockTransaction, testableTimelockTransaction, testableTimelockTransactionByHash, TimelockTransactionType, TimelockTxFunctionParams, PLAINS, MESA } from "../utils";
import { TimelockTxSig } from "../utils/timelockConstants";
import { poolsFixture, timelockedFixture } from "./fixtures";
import { transferContractOwnershipToTimelock } from "../scripts/scriptUtils";

describe("TIMELOCK", async function() {
    it.only('Timelock sync function specific sigs, transfer contracts ownership to Timelock', async function() {
        await poolsFixture()
        await syncTimelockFunctionSpecificDelays()
        await transferContractOwnershipToTimelock()
    })

    describe("TIMELOCK TEST ENABLE SUMMIT", async function() {
        it(`TIMELOCK: Enable function succeeds`, async function () {
            const { dev, timelock, cartographer } = await poolsFixture()

            // Transfer Ownership of the Cartographer to Timelock for duration of test
            await cartographer.connect(dev).transferOwnership(timelock.address)

            let txnParams: TimelockTxFunctionParams = {
                targetContract: cartographer,
                txName: TimelockTxSig.Cartographer.Enable,
                txParams: [],
            }

            // QUEUE SET DELAY
            const { txHash: queueTxHash } = await queueTimelockTransaction(txnParams)

            console.log('QUEUE TX FINISHED', queueTxHash)

            // EXECUTE SET DELAY
            const [ enableTransactionToRun ] = await testableTimelockTransactionByHash(
                TimelockTransactionType.Execute,
                queueTxHash,
                true
            )

            console.log({
                enableTransactionToRun,
            })

            await expect(
                enableTransactionToRun()
            ).to.emit(timelock, EVENT.TIMELOCK_EXECUTE_TRANSACTION)
        })
    })


    describe("TIMELOCK TESTS", async function() {
        before(async function() {
            await timelockedFixture()
        })
        it(`TIMELOCK: Set base delay to 24 hours`, async function () {
            const timelock = await getTimelock()

            const initialTimelockDelay = (await timelock.delay()).toNumber()

            let txnParams: TimelockTxFunctionParams = {
                targetContract: timelock,
                txName: TimelockTxSig.Timelock.SetDelay,
                txParams: [24 * 3600],
            }

            // QUEUE SET DELAY
            const { txHash: queueTxHash } = await queueTimelockTransaction(txnParams)

            // EXECUTE SET DELAY
            await executeQueuedTimelockTransactionByHash(queueTxHash, true)

            const finalTimelockDelay = (await timelock.delay()).toNumber()

            expect(initialTimelockDelay).to.equal(6 * 3600)
            expect(finalTimelockDelay).to.equal(24 * 3600)
        })
        
        it(`TIMELOCK SET DELAY: SetDelay must be a timelocked call with valid parameters, else throw errors`, async function () {
            const { dev } = await ethers.getNamedSigners()
            const timelock = await getTimelock()

            // Must be timelocked call
            await expect(
                timelock.connect(dev).setDelay(24 * 3600)
            ).to.be.revertedWith(ERR.TIMELOCK.SET_DELAY_MUST_COME_FROM_TIMELOCK)


            // Must exceed minimum delay
            let delayTooShortInputParams: TimelockTxFunctionParams = {
                targetContract: timelock,
                txName: TimelockTxSig.Timelock.SetDelay,
                txParams: [3 * 3600],
            }

            const { txHash: delayTooShortTxHash } = await queueTimelockTransaction(delayTooShortInputParams)

            const [ delayTooShortTransactionToRun ] = await testableTimelockTransactionByHash(
                TimelockTransactionType.Execute,
                delayTooShortTxHash,
                true
            )

            await expect(
                delayTooShortTransactionToRun()
            ).to.be.revertedWith(ERR.TIMELOCK.SET_DELAY_MUST_EXCEED_MIN_DELAY)


            // Must not exceed maximum delay
            let delayTooLongInputParams: TimelockTxFunctionParams = {
                targetContract: timelock,
                txName: TimelockTxSig.Timelock.SetDelay,
                txParams: [50 * 24 * 3600],
            }

            const { txHash: delayTooLongTxHash } = await queueTimelockTransaction(delayTooLongInputParams)

            const [ delayTooLongTransactionToRun ] = await testableTimelockTransactionByHash(
                TimelockTransactionType.Execute,
                delayTooLongTxHash,
                true
            )

            await expect(
                delayTooLongTransactionToRun()
            ).to.be.revertedWith(ERR.TIMELOCK.SET_DELAY_MUST_NOT_EXCEED_MAX_DELAY)
        })
        
        it(`TIMELOCK SET FUNCTION SPECIFIC DELAY: SetFunctionSpecificDelay must be a timelocked call with valid parameters, else throw errors`, async function () {
            const { dev } = await ethers.getNamedSigners()
            const timelock = await getTimelock()
            const cartographer = await getCartographer()

            const setTokenPassthroughStrategySignature = getTxSignatureBase({
                targetContract: cartographer,
                txName: TimelockTxSig.Cartographer.SetTokenPassthroughStrategy
            })

            // Must be timelocked call
            await expect(
                timelock.connect(dev).setFunctionSpecificDelay(setTokenPassthroughStrategySignature, 24 * 3600)
            ).to.be.revertedWith(ERR.TIMELOCK.SET_DELAY_MUST_COME_FROM_TIMELOCK)


            // Must exceed minimum delay
            let delayTooShortInputParams: TimelockTxFunctionParams = {
                targetContract: timelock,
                txName: TimelockTxSig.Timelock.SetFunctionSpecificDelay,
                txParams: [setTokenPassthroughStrategySignature, 3 * 3600],
            }

            const { txHash: delayTooShortTxHash } = await queueTimelockTransaction(delayTooShortInputParams)

            const [ delayTooShortTransactionToRun ] = await testableTimelockTransactionByHash(
                TimelockTransactionType.Execute,
                delayTooShortTxHash,
                true,
            )

            await expect(
                delayTooShortTransactionToRun()
            ).to.be.revertedWith(ERR.TIMELOCK.SIG_SPECIFIC_MUST_EXCEED_MIN_DELAY)


            // Must not exceed maximum delay
            let delayTooLongInputParams: TimelockTxFunctionParams = {
                targetContract: timelock,
                txName: TimelockTxSig.Timelock.SetFunctionSpecificDelay,
                txParams: [setTokenPassthroughStrategySignature, 50 * 24 * 3600],
            }

            const delayTooLongQueuedTxnParams = await queueTimelockTransaction(delayTooLongInputParams)
            delayTooLongInputParams.queuedTxEta = delayTooLongQueuedTxnParams.eta

            // INTENTIONALLY LEFT WITH EXECUTE TRANSACTION RUN FROM PARAMS DIRECTLY
            await mineBlockWithTimestamp(delayTooLongQueuedTxnParams.eta)
            const [ delayTooLongTransactionToRun ] = await testableTimelockTransaction({
                ...delayTooLongInputParams,
                txType: TimelockTransactionType.Execute
            })

            await expect(
                delayTooLongTransactionToRun()
            ).to.be.revertedWith(ERR.TIMELOCK.SIG_SPECIFIC_MUST_NOT_EXCEED_MAX_DELAY)


            // Must not exceed maximum delay
            let correctDelayInputParams: TimelockTxFunctionParams = {
                targetContract: timelock,
                txName: TimelockTxSig.Timelock.SetFunctionSpecificDelay,
                txParams: [setTokenPassthroughStrategySignature, 72 * 3600],
            }

            const correctDelayQueuedTxnParams = await queueTimelockTransaction(correctDelayInputParams)
            correctDelayInputParams.queuedTxEta = correctDelayQueuedTxnParams.eta

            // INTENTIONALLY LEFT WITH EXECUTE TRANSACTION RUN FROM PARAMS DIRECTLY
            await mineBlockWithTimestamp(correctDelayQueuedTxnParams.eta)
            const [ correctDelayTransactionToRun ] = await testableTimelockTransaction({
                ...correctDelayInputParams,
                txType: TimelockTransactionType.Execute
            })

            const delayInit = await getDelay(timelock, setTokenPassthroughStrategySignature)
            
            await correctDelayTransactionToRun()

            const delayFinal = await getDelay(timelock, setTokenPassthroughStrategySignature)

            expect(delayInit).to.equal(24 * 3600)
            expect(delayFinal).to.equal(72 * 3600)
        })
        
        it(`TIMELOCK QUEUE: QueueTransaction must be called with valid delay, else throw errors"`, async function () {
            const timelock = await getTimelock()
            const cartographer = await getCartographer()

            const setTokenPassthroughStrategySignature = getTxSignatureBase({
                targetContract: cartographer,
                txName: TimelockTxSig.Cartographer.SetTokenPassthroughStrategy
            })

            // Invalid delay too small
            const timestamp = await getTimestamp()
            let queueWithInvalidDelayParams: TimelockTxFunctionParams = {
                txType: TimelockTransactionType.Queue,

                targetContract: timelock,
                txName: TimelockTxSig.Timelock.SetFunctionSpecificDelay,
                txParams: [setTokenPassthroughStrategySignature, 72 * 3600],

                queuedTxEta: timestamp + (6 * 3600),
            }
            
            const [ queueWithInvalidDelayTransactionToRun ] = await testableTimelockTransaction(queueWithInvalidDelayParams)

            await expect(
                queueWithInvalidDelayTransactionToRun()
            ).to.be.revertedWith(ERR.TIMELOCK.QUEUE_MUST_SATISFY_DELAY)
        })
        
        it(`TIMELOCK CANCEL QUEUED: CancelQueuedTransaction should succeed`, async function () {
            const { dev } = await ethers.getNamedSigners()
            const timelock = await getTimelock()
            const cartographer = await getCartographer()

            const timestamp = await getTimestamp()

            // Valid TX to be cancelled
            let testTxParams: TimelockTxFunctionParams = {
                targetContract: cartographer,
                txName: TimelockTxSig.Cartographer.SetExpeditionTreasuryAdd,
                txParams: [dev.address],
                queuedTxEta: timestamp + 60 + (24 * 3600),
            }

            const timelockTxParams = await getTimelockTxParams(testTxParams)
            const txHash = encodeQueuedTransactionHash(timelock, timelockTxParams)
            
            const txQueued0 = await timelock.queuedTransactions(txHash)
            expect(txQueued0).to.be.false

            const queuedTxParams = await queueTimelockTransaction(testTxParams)
            testTxParams.queuedTxEta = queuedTxParams.eta

            const txQueued1 = await timelock.queuedTransactions(txHash)
            expect(txQueued1).to.be.true
            
            await cancelQueuedTimelockTransaction(testTxParams)
            
            const txQueued2 = await timelock.queuedTransactions(txHash)
            expect(txQueued2).to.be.false

            const { txHash: queuedTxHash } = await queueTimelockTransaction(testTxParams)

            const txQueued3 = await timelock.queuedTransactions(txHash)
            expect(txQueued3).to.be.true

            await cancelQueuedTimelockTransactionByHash(queuedTxHash)

            const txQueued4 = await timelock.queuedTransactions(txHash)
            expect(txQueued4).to.be.false


        })
        
        it(`TIMELOCK EXECUTE QUEUED: ExecuteQueuedTransactions should succeed`, async function () {
            const { user1, exped } = await ethers.getNamedSigners()
            const timelock = await getTimelock()
            const cartographer = await getCartographer()
            
            const expeditionTreasuryAddInit = await cartographer.expeditionTreasuryAdd()
            expect(expeditionTreasuryAddInit).to.equal(exped.address)
            
            // Valid TX to be executed and verified: Switch Cartographer expeditionTreasuryAdd --> User1 address
            const timestamp = await getTimestamp()
            let testTxParams: TimelockTxFunctionParams = {
                targetContract: cartographer,
                txName: TimelockTxSig.Cartographer.SetExpeditionTreasuryAdd,
                txParams: [user1.address],
                queuedTxEta: timestamp + 60 + (24 * 3600),
            }

            const timelockTxParams = await getTimelockTxParams(testTxParams)
            const txHash = encodeQueuedTransactionHash(timelock, timelockTxParams)
            
            const txQueuedInit = await timelock.queuedTransactions(txHash)
            expect(txQueuedInit).to.be.false

            await queueTimelockTransaction(testTxParams)

            const txQueuedMid = await timelock.queuedTransactions(txHash)
            expect(txQueuedMid).to.be.true
            
            await executeQueuedTimelockTransactionByHash(txHash, true)
            
            const txQueuedFinal = await timelock.queuedTransactions(txHash)
            expect(txQueuedFinal).to.be.false

            const expeditionTreasuryAddFinal = await cartographer.expeditionTreasuryAdd()
            expect(expeditionTreasuryAddFinal).to.equal(user1.address)
        })

        it(`TIMELOCK SYNC POOLS: The syncing pool flow should succeed`, async function () {
            const { user1, exped } = await ethers.getNamedSigners()
            const timelock = await getTimelock()
            const cartographer = await getCartographer()
            const SummitToken = await getSummitToken()
            
            const summitAddress = SummitToken.address

            const chainId = await getChainId()


            // CONFIGS

            const baseSummitPoolConfig: PoolConfig = {
                name: 'SUMMIT',
                token: '0xSUMMIT',
                allocation: 4000,
                taxBP: 700,
                depositFeeBP: 100,
                native: true,
                elevations: {
                    OASIS: {
                        exists: true,
                        live: true,
                    },
                    PLAINS: {
                        exists: true,
                        live: true,
                    },
                    MESA: {
                        exists: true,
                        live: false,
                    },
                    SUMMIT: {
                        exists: true,
                        live: false,
                    },
                },
            }

            // DISABLE POOL AT THE OASIS
            const disabledOasisConfig: PoolConfig = {
                ...baseSummitPoolConfig,
                elevations: {
                    ...baseSummitPoolConfig.elevations,
                    OASIS: {
                        exists: true,
                        live: false,
                    }
                },
            }

            const disabledOasisTxHashes = await queueSyncPoolsTimelockTransactions(
                chainId,
                false,
                OASIS,
                [disabledOasisConfig],
            )
            await executeQueuedTimelockTransactionByHash(disabledOasisTxHashes[0].txHash!, true)



            // DISABLE POOL AT THE MESA
            const disabledMesaConfig: PoolConfig = {
                ...baseSummitPoolConfig,
                elevations: {
                    ...baseSummitPoolConfig.elevations,
                    MESA: {
                        exists: true,
                        live: false,
                    }
                },
            }

            const disabledMesaTxHashes = await queueSyncPoolsTimelockTransactions(
                chainId,
                false,
                MESA,
                [disabledMesaConfig],
            )
            console.log({
                disabledMesaTxHashes
            })
            await executeQueuedTimelockTransactionByHash(disabledMesaTxHashes[0].txHash!, true)


            // UPDATE TOKEN TAX
            const updatedTaxConfig: PoolConfig = {
                ...baseSummitPoolConfig,
                taxBP: 500,
            }

            const updatedTaxTxHashes = await queueSyncPoolsTimelockTransactions(
                chainId,
                false,
                OASIS,
                [updatedTaxConfig],
            )
            await executeQueuedTimelockTransactionByHash(updatedTaxTxHashes[0].txHash!, true)

            // UPDATE TOKEN DEPOSIT FEE
            const updatedDepositFeeConfig: PoolConfig = {
                ...updatedTaxConfig,
                depositFeeBP: 200,
            }

            const updatedDepositFeeTxHashes = await queueSyncPoolsTimelockTransactions(
                chainId,
                false,
                OASIS,
                [updatedDepositFeeConfig],
            )
            await executeQueuedTimelockTransactionByHash(updatedDepositFeeTxHashes[0].txHash!, true)


            // UPDATE TOKEN ALLOCATION
            const updatedAllocationConfig: PoolConfig = {
                ...baseSummitPoolConfig,
                allocation: 2000,
            }

            const updatedAllocationTxHashes = await queueSyncPoolsTimelockTransactions(
                chainId,
                false,
                OASIS,
                [updatedAllocationConfig],
            )
            await executeQueuedTimelockTransactionByHash(updatedAllocationTxHashes[0].txHash!, true)

            console.log({
                disabledOasisTxHashes,
                disabledMesaTxHashes,
                updatedTaxTxHashes,
                updatedDepositFeeTxHashes,
                updatedAllocationTxHashes,
            })

            expect(true).to.be.true
        })
    })
})
