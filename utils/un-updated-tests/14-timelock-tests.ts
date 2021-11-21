// import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
// import { expect } from "chai"
// import hre, { ethers, getChainId } from "hardhat";
// import { queueSyncPoolsTimelockTransactions } from "../scripts/scriptUtils/timelock-pool-sync";
// import { mineBlockWithTimestamp, Contracts, ERR, getTimestamp, EVENT, PoolConfig, promiseSequenceMap, FIVETHOUSAND, TENTHOUSAND, OASIS } from "../utils";
// import { cancelQueuedTimelockTransaction, cancelQueuedTimelockTransactionByHash, encodeQueuedTransactionHash, executeQueuedTimelockTransaction, executeQueuedTimelockTransactionByHash, getDelay, getTimelockTxParams, getTxSignature, getTxSignatureBase, queueTimelockTransaction, testableTimelockTransaction, testableTimelockTransactionByHash, TimelockedTransaction, TimelockTransactionType, TimelockTxFunctionParams } from "../utils/timelockUtils";
// import { poolsFixture, timelockedFixture } from "./fixtures";


// describe("TIMELOCK TEST ENABLE SUMMIT", function() {
//   it(`TIMELOCK: Enable function succeeds`, async function () {
//     const { dev, timelock, cartographer } = await poolsFixture()

//     // Transfer Ownership of the Cartographer to Timelock for duration of test
//     await cartographer.connect(dev).transferOwnership(timelock.address)

//     let txnParams: TimelockTxFunctionParams = {
//         targetContract: cartographer,
//         txName: TimelockedTransaction.Cartographer_Enable,
//         txParams: [],
//     }

//     // QUEUE SET DELAY
//     const { txHash: queueTxHash } = await queueTimelockTransaction(txnParams)

//     console.log('QUEUE TX FINISHED', queueTxHash)

//     // EXECUTE SET DELAY
//     const [ enableTransactionToRun ] = await testableTimelockTransactionByHash(
//         TimelockTransactionType.Execute,
//         queueTxHash,
//         true
//     )

//     console.log({
//         enableTransactionToRun,
//     })

//     await expect(
//         enableTransactionToRun()
//     ).to.emit(timelock, EVENT.TIMELOCK_EXECUTE_TRANSACTION)
//   })
// })


// describe("TIMELOCK TESTS", function() {
//   before(async function() {
//     await timelockedFixture()
//   })
//   it(`TIMELOCK: Set base delay to 24 hours`, async function () {
//     const timelock = await ethers.getContract(Contracts.Timelock)

//     const initialTimelockDelay = (await timelock.delay()).toNumber()

//     let txnParams: TimelockTxFunctionParams = {
//         targetContract: timelock,
//         txName: TimelockedTransaction.Timelock_SetDelay,
//         txParams: [24 * 3600],
//     }

//     // QUEUE SET DELAY
//     const { txHash: queueTxHash } = await queueTimelockTransaction(txnParams)

//     // EXECUTE SET DELAY
//     await executeQueuedTimelockTransactionByHash(queueTxHash, true)

//     const finalTimelockDelay = (await timelock.delay()).toNumber()

//     expect(initialTimelockDelay).to.equal(6 * 3600)
//     expect(finalTimelockDelay).to.equal(24 * 3600)
//   })
  
//   it(`TIMELOCK SET DELAY: SetDelay must be a timelocked call with valid parameters, else throw errors`, async function () {
//     const { dev } = await getNamedSigners(hre)
//     const timelock = await ethers.getContract(Contracts.Timelock)

//     // Must be timelocked call
//     await expect(
//         timelock.connect(dev).setDelay(24 * 3600)
//     ).to.be.revertedWith(ERR.TIMELOCK.SET_DELAY_MUST_COME_FROM_TIMELOCK)


//     // Must exceed minimum delay
//     let delayTooShortInputParams: TimelockTxFunctionParams = {
//         targetContract: timelock,
//         txName: TimelockedTransaction.Timelock_SetDelay,
//         txParams: [3 * 3600],
//     }

//     const { txHash: delayTooShortTxHash } = await queueTimelockTransaction(delayTooShortInputParams)

//     const [ delayTooShortTransactionToRun ] = await testableTimelockTransactionByHash(
//         TimelockTransactionType.Execute,
//         delayTooShortTxHash,
//         true
//     )

//     await expect(
//         delayTooShortTransactionToRun()
//     ).to.be.revertedWith(ERR.TIMELOCK.SET_DELAY_MUST_EXCEED_MIN_DELAY)


//     // Must not exceed maximum delay
//     let delayTooLongInputParams: TimelockTxFunctionParams = {
//         targetContract: timelock,
//         txName: TimelockedTransaction.Timelock_SetDelay,
//         txParams: [50 * 24 * 3600],
//     }

//     const { txHash: delayTooLongTxHash } = await queueTimelockTransaction(delayTooLongInputParams)

//     const [ delayTooLongTransactionToRun ] = await testableTimelockTransactionByHash(
//         TimelockTransactionType.Execute,
//         delayTooLongTxHash,
//         true
//     )

//     await expect(
//         delayTooLongTransactionToRun()
//     ).to.be.revertedWith(ERR.TIMELOCK.SET_DELAY_MUST_NOT_EXCEED_MAX_DELAY)
//   })
  
//   it(`TIMELOCK SET FUNCTION SPECIFIC DELAY: SetFunctionSpecificDelay must be a timelocked call with valid parameters, else throw errors`, async function () {
//     const { dev } = await getNamedSigners(hre)
//     const timelock = await ethers.getContract(Contracts.Timelock)
//     const cartographer = await ethers.getContract(Contracts.Cartographer)

//     const setTokenPassthroughStrategySignature = getTxSignatureBase({
//         targetContract: cartographer,
//         txName: TimelockedTransaction.Cartographer_SetTokenPassthroughStrategy
//     })

//     // Must be timelocked call
//     await expect(
//         timelock.connect(dev).setFunctionSpecificDelay(setTokenPassthroughStrategySignature, 24 * 3600)
//     ).to.be.revertedWith(ERR.TIMELOCK.SET_DELAY_MUST_COME_FROM_TIMELOCK)


//     // Must exceed minimum delay
//     let delayTooShortInputParams: TimelockTxFunctionParams = {
//         targetContract: timelock,
//         txName: TimelockedTransaction.Timelock_SetFunctionSpecificDelay,
//         txParams: [setTokenPassthroughStrategySignature, 3 * 3600],
//     }

//     const { txHash: delayTooShortTxHash } = await queueTimelockTransaction(delayTooShortInputParams)

//     const [ delayTooShortTransactionToRun ] = await testableTimelockTransactionByHash(
//         TimelockTransactionType.Execute,
//         delayTooShortTxHash,
//         true,
//     )

//     await expect(
//         delayTooShortTransactionToRun()
//     ).to.be.revertedWith(ERR.TIMELOCK.SIG_SPECIFIC_MUST_EXCEED_MIN_DELAY)


//     // Must not exceed maximum delay
//     let delayTooLongInputParams: TimelockTxFunctionParams = {
//         targetContract: timelock,
//         txName: TimelockedTransaction.Timelock_SetFunctionSpecificDelay,
//         txParams: [setTokenPassthroughStrategySignature, 50 * 24 * 3600],
//     }

//     const delayTooLongQueuedTxnParams = await queueTimelockTransaction(delayTooLongInputParams)
//     delayTooLongInputParams.queuedTxEta = delayTooLongQueuedTxnParams.eta

//     // INTENTIONALLY LEFT WITH EXECUTE TRANSACTION RUN FROM PARAMS DIRECTLY
//     await mineBlockWithTimestamp(delayTooLongQueuedTxnParams.eta)
//     const [ delayTooLongTransactionToRun ] = await testableTimelockTransaction({
//         ...delayTooLongInputParams,
//         txType: TimelockTransactionType.Execute
//     })

//     await expect(
//         delayTooLongTransactionToRun()
//     ).to.be.revertedWith(ERR.TIMELOCK.SIG_SPECIFIC_MUST_NOT_EXCEED_MAX_DELAY)


//     // Must not exceed maximum delay
//     let correctDelayInputParams: TimelockTxFunctionParams = {
//         targetContract: timelock,
//         txName: TimelockedTransaction.Timelock_SetFunctionSpecificDelay,
//         txParams: [setTokenPassthroughStrategySignature, 72 * 3600],
//     }

//     const correctDelayQueuedTxnParams = await queueTimelockTransaction(correctDelayInputParams)
//     correctDelayInputParams.queuedTxEta = correctDelayQueuedTxnParams.eta

//     // INTENTIONALLY LEFT WITH EXECUTE TRANSACTION RUN FROM PARAMS DIRECTLY
//     await mineBlockWithTimestamp(correctDelayQueuedTxnParams.eta)
//     const [ correctDelayTransactionToRun ] = await testableTimelockTransaction({
//         ...correctDelayInputParams,
//         txType: TimelockTransactionType.Execute
//     })

//     const delayInit = await getDelay(timelock, setTokenPassthroughStrategySignature)
    
//     await correctDelayTransactionToRun()

//     const delayFinal = await getDelay(timelock, setTokenPassthroughStrategySignature)

//     expect(delayInit).to.equal(24 * 3600)
//     expect(delayFinal).to.equal(72 * 3600)
//   })
  
//   it(`TIMELOCK QUEUE: QueueTransaction must be called with valid delay, else throw errors"`, async function () {
//     const timelock = await ethers.getContract(Contracts.Timelock)
//     const cartographer = await ethers.getContract(Contracts.Cartographer)

//     const setTokenPassthroughStrategySignature = getTxSignatureBase({
//         targetContract: cartographer,
//         txName: TimelockedTransaction.Cartographer_SetTokenPassthroughStrategy
//     })

//     // Invalid delay too small
//     const timestamp = await getTimestamp()
//     let queueWithInvalidDelayParams: TimelockTxFunctionParams = {
//         txType: TimelockTransactionType.Queue,

//         targetContract: timelock,
//         txName: TimelockedTransaction.Timelock_SetFunctionSpecificDelay,
//         txParams: [setTokenPassthroughStrategySignature, 72 * 3600],

//         queuedTxEta: timestamp + (6 * 3600),
//     }
    
//     const [ queueWithInvalidDelayTransactionToRun ] = await testableTimelockTransaction(queueWithInvalidDelayParams)

//     await expect(
//         queueWithInvalidDelayTransactionToRun()
//     ).to.be.revertedWith(ERR.TIMELOCK.QUEUE_MUST_SATISFY_DELAY)
//   })
  
//   it(`TIMELOCK CANCEL QUEUED: CancelQueuedTransaction should succeed`, async function () {
//     const { dev } = await getNamedSigners(hre)
//     const timelock = await ethers.getContract(Contracts.Timelock)
//     const cartographer = await ethers.getContract(Contracts.Cartographer)

//     const timestamp = await getTimestamp()

//     // Valid TX to be cancelled
//     let testTxParams: TimelockTxFunctionParams = {
//         targetContract: cartographer,
//         txName: TimelockedTransaction.Cartographer_SetExpedAdd,
//         txParams: [dev.address],
//         queuedTxEta: timestamp + 60 + (24 * 3600),
//     }

//     const timelockTxParams = await getTimelockTxParams(testTxParams)
//     const txHash = encodeQueuedTransactionHash(timelock, timelockTxParams)
    
//     const txQueued0 = await timelock.queuedTransactions(txHash)
//     expect(txQueued0).to.be.false

//     const queuedTxParams = await queueTimelockTransaction(testTxParams)
//     testTxParams.queuedTxEta = queuedTxParams.eta

//     const txQueued1 = await timelock.queuedTransactions(txHash)
//     expect(txQueued1).to.be.true
    
//     await cancelQueuedTimelockTransaction(testTxParams)
    
//     const txQueued2 = await timelock.queuedTransactions(txHash)
//     expect(txQueued2).to.be.false

//     const { txHash: queuedTxHash } = await queueTimelockTransaction(testTxParams)

//     const txQueued3 = await timelock.queuedTransactions(txHash)
//     expect(txQueued3).to.be.true

//     await cancelQueuedTimelockTransactionByHash(queuedTxHash)

//     const txQueued4 = await timelock.queuedTransactions(txHash)
//     expect(txQueued4).to.be.false


//   })
  
//   it(`TIMELOCK EXECUTE QUEUED: ExecuteQueuedTransactions should succeed`, async function () {
//     const { user1, exped } = await getNamedSigners(hre)
//     const timelock = await ethers.getContract(Contracts.Timelock)
//     const cartographer = await ethers.getContract(Contracts.Cartographer)
    
//     const expedAddInit = await cartographer.expedAdd()
//     expect(expedAddInit).to.equal(exped.address)
    
//     // Valid TX to be executed and verified: Switch Cartographer ExpedAdd --> User1 address
//     const timestamp = await getTimestamp()
//     let testTxParams: TimelockTxFunctionParams = {
//         targetContract: cartographer,
//         txName: TimelockedTransaction.Cartographer_SetExpedAdd,
//         txParams: [user1.address],
//         queuedTxEta: timestamp + 60 + (24 * 3600),
//     }

//     const timelockTxParams = await getTimelockTxParams(testTxParams)
//     const txHash = encodeQueuedTransactionHash(timelock, timelockTxParams)
    
//     const txQueuedInit = await timelock.queuedTransactions(txHash)
//     expect(txQueuedInit).to.be.false

//     await queueTimelockTransaction(testTxParams)

//     const txQueuedMid = await timelock.queuedTransactions(txHash)
//     expect(txQueuedMid).to.be.true
    
//     await executeQueuedTimelockTransactionByHash(txHash, true)
    
//     const txQueuedFinal = await timelock.queuedTransactions(txHash)
//     expect(txQueuedFinal).to.be.false

//     const expedAddFinal = await cartographer.expedAdd()
//     expect(expedAddFinal).to.equal(user1.address)
//   })

//   it(`TIMELOCK SYNC POOLS: The syncing pool flow should succeed`, async function () {
//     const { user1, exped } = await getNamedSigners(hre)
//     const timelock = await ethers.getContract(Contracts.Timelock)
//     const cartographer = await ethers.getContract(Contracts.Cartographer)
//     const cartographerElevation = await ethers.getContract(Contracts.CartographerElevation)
//     const SummitToken = await ethers.getContract(Contracts.SummitToken)
    
//     const summitAddress = SummitToken.address
//     const summitLpAddress = await cartographer.summitLp()

//     const chainId = await getChainId()


//     // CONFIGS

//     const baseSummitPoolConfig: PoolConfig = {
//         name: 'SUMMIT',
//         token: '0xSUMMIT',
//         allocation: 4000,
//         elevations: {
//             OASIS: {
//                 exists: true,
//                 live: true,
//             },
//             PLAINS: {
//                 exists: true,
//                 live: true,
//             },
//             MESA: {
//                 exists: true,
//                 live: false,
//             },
//             SUMMIT: {
//                 exists: true,
//                 live: false,
//             },
//         },
//         fee: 0,
//     }

//     // DISABLE POOL AT THE OASIS
//     const disabledOasisConfig: PoolConfig = {
//         ...baseSummitPoolConfig,
//         elevations: {
//             ...baseSummitPoolConfig.elevations,
//             OASIS: {
//                 exists: true,
//                 live: false,
//             }
//         },
//     }

//     const disabledOasisTxHashes = await queueSyncPoolsTimelockTransactions(
//         chainId,
//         false,
//         OASIS,
//         [disabledOasisConfig],
//         cartographer,
//         SummitToken.address,
//         summitLpAddress,
//     )
//     await executeQueuedTimelockTransactionByHash(disabledOasisTxHashes[0].txHash!, true)



//     // DISABLE POOL AT THE MESA
//     const disabledMesaConfig: PoolConfig = {
//         ...baseSummitPoolConfig,
//         elevations: {
//             ...baseSummitPoolConfig.elevations,
//             MESA: {
//                 exists: true,
//                 live: false,
//             }
//         },
//     }

//     const disabledMesaTxHashes = await queueSyncPoolsTimelockTransactions(
//         chainId,
//         false,
//         FIVETHOUSAND,
//         [disabledMesaConfig],
//         cartographer,
//         SummitToken.address,
//         summitLpAddress,
//     )
//     await executeQueuedTimelockTransactionByHash(disabledMesaTxHashes[0].txHash!, true)


//     // UPDATE POOL FEE
//     const updatedFeeConfig: PoolConfig = {
//         ...baseSummitPoolConfig,
//         fee: 200,
//     }

//     const updatedFeeTxHashes = await queueSyncPoolsTimelockTransactions(
//         chainId,
//         false,
//         OASIS,
//         [updatedFeeConfig],
//         cartographer,
//         SummitToken.address,
//         summitLpAddress,
//     )
//     await executeQueuedTimelockTransactionByHash(updatedFeeTxHashes[0].txHash!, true)


//     // UPDATE TOKEN ALLOCATION
//     const updatedAllocationConfig: PoolConfig = {
//         ...baseSummitPoolConfig,
//         allocation: 2000,
//     }

//     const updatedAllocationTxHashes = await queueSyncPoolsTimelockTransactions(
//         chainId,
//         false,
//         OASIS,
//         [updatedAllocationConfig],
//         cartographer,
//         SummitToken.address,
//         summitLpAddress,
//     )
//     await executeQueuedTimelockTransactionByHash(updatedAllocationTxHashes[0].txHash!, true)

//     console.log({
//         disabledOasisTxHashes,
//         disabledMesaTxHashes,
//         updatedFeeTxHashes,
//         updatedAllocationTxHashes,
//     })

//     expect(true).to.be.true
//   })
// })
