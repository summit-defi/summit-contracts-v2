import { Contract } from "@ethersproject/contracts";
import { keccak256 } from "@ethersproject/keccak256";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { providers } from "ethers";
import hre, { getChainId, ethers } from "hardhat";
import Web3 from "web3";
import { bytesify, checkForAlreadyQueuedMatchingTimelockTx, Contracts, delay, ethersKeccak256, extractRevertMsg, getQueuedTimelockTransactionByHash, getTimelock, getTimestamp, hardhatChainId, mineBlockWithTimestamp, writeTimelockTransaction } from ".";



export enum TimelockTransactionType {
    Queue = 'Queue',
    Cancel = 'Cancel',
    Execute = 'Execute',
}

export const TimelockTxTypeName = {
    [TimelockTransactionType.Queue]: 'queued',
    [TimelockTransactionType.Cancel]: 'cancelled',
    [TimelockTransactionType.Execute]: 'executed',
}

export const TimelockTxFunctionName = {
    [TimelockTransactionType.Queue]: 'queueTransaction',
    [TimelockTransactionType.Cancel]: 'cancelTransaction',
    [TimelockTransactionType.Execute]: 'executeTransaction',
}

export interface TimelockTxFunctionParams {
    dryRun?: boolean
    note?: string

    txType?: TimelockTransactionType
    dev?: SignerWithAddress
    timelock?: Contract

    targetContract: Contract
    txName: string
    txParams: any[]

    queuedTxEta?: number
}

export interface TimelockTxParams {
    targetContract: string
    value: number
    signature: string
    data: string
    eta: number
}

export interface JSONQueuedTransaction extends TimelockTxParams {
    rawParams: any[]
    queueTimestamp: number
    txHash: string
}

export type TimelockTxParamsArray = [
    string,
    number,
    string,
    string,
    number,
]

export const timelockTxParamsToCallableArray = (params: TimelockTxParams): TimelockTxParamsArray => {
    return [params.targetContract, params.value, params.signature, params.data, params.eta]
}

export interface QueueTxConfig {
    targetContractName: string
    txName: string
    txParams: any[]
    force?: boolean
    note?: string
}



/* Example Full Timelock Tx

    timelockTransaction(
        TimelockTransactionType.Queue,
        dev,
        timelock,
        cartographer,
        TimelockTransaction.Cartographer_AddFarm,
        null,
        [SummitToken.address, 0, true, 0, true],
    )

    LATER

    timelockTransaction(
        TimelockTransactionType.Execute,
        dev,
        timelock,
        cartographer,
        TimelockTransaction.Cartographer_AddFarm,
        queuedTxEta,
        [SummitToken.address, 0, true, 0, true],
    )

    OR

    timelockTransaction(
        TimelockTransactionType.Cancel,
        dev,
        timelock,
        cartographer,
        TimelockTransaction.Cartographer_AddFarm,
        queuedTxEta,
        [SummitToken.address, 0, true, 0, true],
    )

*/


export const getMatchingTimelockedTransaction = async ({ targetContract, txName, txParams }: TimelockTxFunctionParams): Promise<JSONQueuedTransaction | null> => {
    const chainId = await getChainId()
    const txSignature = getTxSignatureBase({ targetContract, txName })
    return checkForAlreadyQueuedMatchingTimelockTx(
        chainId,
        targetContract.address,
        txSignature,
        txParams,
    )
}


export const getTxSignature = (params: TimelockTxFunctionParams): string => getTxSignatureBase({ targetContract: params.targetContract, txName: params.txName })
export const getTxSignatureBase = ({ targetContract, txName }: { targetContract: Contract, txName: string }): string => {
    const contractInterface = targetContract.interface
    const signature = contractInterface.getFunction(txName)
    return `${signature.name}(${(signature.inputs.map((input) => input.type).join(','))})`
}

export const getDelay = async (timelock: Contract, txSignature: string): Promise<number> => {
    const signatureSpecificDelay = (await timelock.getFunctionSpecificDelay(txSignature)).toNumber()
    const baseDelay = (await timelock.delay()).toNumber()
    return Math.max(signatureSpecificDelay, baseDelay)
}

export const encodeCallData = (
    { targetContract, transaction, txParams }:
    { targetContract: Contract, transaction: string, txParams: any[] }
): string => {
    return targetContract.interface.encodeFunctionData(transaction, txParams).substr(10)
}

export const encodeTimelockTxData = (params: TimelockTxFunctionParams): string => {
    return bytesify(
        encodeCallData({
            targetContract: params.targetContract,
            transaction: params.txName,
            txParams: params.txParams
        })
    )
}


export const encodeQueuedTransactionHash = (timelock: Contract, timelockTxParams: TimelockTxParams): string => {
    return ethersKeccak256(
        bytesify(
            encodeCallData({
                targetContract: timelock,
                transaction: 'queueTransaction',
                txParams: timelockTxParamsToCallableArray(timelockTxParams)
            })
        )
    )
}


export const getTimelockTxEta = async (params: TimelockTxFunctionParams): Promise<number> => {
    if (params.queuedTxEta != null) return params.queuedTxEta

    const signature = getTxSignature(params)
    const signatureDelay = await getDelay(params.timelock!, signature)
    const currentTimestamp = await getTimestamp()

    return currentTimestamp + signatureDelay + 60
}


// BASE TIMELOCK TRANSACTION VARIABLES GETTER
export const getTimelockTxParams = async (params: TimelockTxFunctionParams): Promise<TimelockTxParams> => {
    return {
        targetContract: params.targetContract.address,
        value: 0,
        signature: getTxSignature(params),
        data: encodeTimelockTxData(params),
        eta: await getTimelockTxEta(params),
    }
}

            
// TIMELOCK TRANSACTION
export const queueTimelockTransaction = async (params: TimelockTxFunctionParams) => await timelockTransaction({ ...params, txType: TimelockTransactionType.Queue })
export const executeQueuedTimelockTransaction = async (params: TimelockTxFunctionParams) => await timelockTransaction({ ...params, txType: TimelockTransactionType.Execute })
export const cancelQueuedTimelockTransaction = async (params: TimelockTxFunctionParams) => await timelockTransaction({ ...params, txType: TimelockTransactionType.Cancel })
const timelockTransaction = async (params: TimelockTxFunctionParams) => {
    if (params.dev == null) {
        params.dev = (await ethers.getNamedSigners()).dev
    }
    if (params.timelock == null) {
        params.timelock = await getTimelock()
    }
    const { txType, txName, txParams, queuedTxEta, targetContract, dev, timelock, dryRun = false, note } = params

    // Must have a Timelock tx type
    if (txType == null) throw new Error('Timelock Transaction Called Without Tx Type')

    // Throw error if queuedTxEta isn't passed in to Execute or Cancel transaction
    if (txType !== TimelockTransactionType.Queue) {
        if (queuedTxEta == null) throw new Error('Cancelling a Queued Timelock Transaction requires a queuedTxEta')
    }

    // Get params for timelock transaction
    const timelockTxParams = await getTimelockTxParams(params)

    // Object of available transactions to be run on the Timelock
    const availableTimelockTransactions = {
        [TimelockTransactionType.Queue]: timelock.connect(dev).queueTransaction,
        [TimelockTransactionType.Cancel]: timelock.connect(dev).cancelTransaction,
        [TimelockTransactionType.Execute]: timelock.connect(dev).executeTransaction,
    }

    // Get TX hash that will be used in the Timelock contract to reference queue txn
    const txHash = encodeQueuedTransactionHash(timelock, timelockTxParams)
    
    // Execute Timelock Transaction
    if (!dryRun) {
        const timelockTx = await availableTimelockTransactions[txType](
            ...timelockTxParamsToCallableArray(timelockTxParams),
            { gasLimit: 1200000 }
        )
        const chainId = await getChainId()
        if (chainId !== hardhatChainId) {
            await timelockTx.wait(10)    
            await delay(5000)
        }
    }

    // Write transaction to JSON file of timelock interactions
    if (!dryRun) {
        const chainId = await getChainId()
        const timestamp = await getTimestamp()
        writeTimelockTransaction(chainId, txHash, timestamp, txType, txParams, timelockTxParams, note)
    }

    console.log("Timelock Transaction Finished:", {
        note,
        txType,
        target: targetContract.address,
        timelockedTransaction: `${txName}(${txParams.join(',')})`,
        executedTransaction: {
            '0': `  ${TimelockTxFunctionName[txType]} (`,
            '1': `      ${timelockTxParams.targetContract}`,
            '2': `      ${timelockTxParams.value}`,
            '3': `      ${timelockTxParams.signature}`,
            '4': `      ${timelockTxParams.data}`,
            '5': `      ${timelockTxParams.eta}`,
            '6': '  )'
        },
    })

    // Return the txParams that were run on the Timelock
    return {
        ...timelockTxParams,
        txHash,
    }
}

  
// TESTABLE TIMELOCK TRANSACTION
export const testableTimelockTransaction = async (params: TimelockTxFunctionParams): Promise<[() => any, () => Promise<void>]> => {
    if (params.dev == null) {
        params.dev = (await ethers.getNamedSigners()).dev
    }
    if (params.timelock == null) {
        params.timelock = await getTimelock()
    }
    const { txType, txParams, queuedTxEta, dev, timelock, note } = params

    // Must have a Timelock tx type
    if (txType == null) throw new Error('Timelock Transaction Called Without Tx Type')

    // Throw error if queuedTxEta isn't passed in to Execute or Cancel transaction
    if (txType !== TimelockTransactionType.Queue) {
        if (queuedTxEta == null) throw new Error('Cancelling a Queued Timelock Transaction requires a queuedTxEta')
    }

    // Get params for timelock transaction
    const timelockTxParams = await getTimelockTxParams(params)

    // Get TX hash that will be used in the Timelock contract to reference queue txn
    const txHash = encodeQueuedTransactionHash(timelock, timelockTxParams)

    // Object of available transactions to be run on the Timelock
    const availableTimelockTransactions = {
        [TimelockTransactionType.Queue]: timelock.connect(dev).queueTransaction,
        [TimelockTransactionType.Cancel]: timelock.connect(dev).cancelTransaction,
        [TimelockTransactionType.Execute]: timelock.connect(dev).executeTransaction,
    }

    const writeToJSON = async () => {
        const chainId = await getChainId()
        const timestamp = await getTimestamp()
        writeTimelockTransaction(chainId, txHash, timestamp, txType, txParams ,timelockTxParams, note)
    }

    return [
        () => availableTimelockTransactions[txType](...timelockTxParamsToCallableArray(timelockTxParams)),
        writeToJSON,
    ]
}




// CANCEL / EXECUTE TRANSACTION BY HASH
export const executeQueuedTimelockTransactionByHash = async (txHash: string, withMine = false) => await timelockTransactionByHash(TimelockTransactionType.Execute, txHash, withMine)
export const cancelQueuedTimelockTransactionByHash = async (txHash: string, withMine = false) => await timelockTransactionByHash(TimelockTransactionType.Cancel, txHash, withMine)
const timelockTransactionByHash = async (txType: TimelockTransactionType, txHash: string, withMine = false) => {
    if (txType === TimelockTransactionType.Queue) throw new Error('Cant Call a Timelock Transaction of Time Queue by Hash')
    const { dev } = await ethers.getNamedSigners()
    const timelock = await getTimelock()
    const chainId = await getChainId()
    
    const queuedTransactionByHash = getQueuedTimelockTransactionByHash(chainId, txHash)
    if (queuedTransactionByHash == null) return `Queued Transaction By Hash Not Found: ${txHash}`
    
    const {
        rawParams,
        queueTimestamp,
        ...timelockTxParams
    }  = queuedTransactionByHash

    // Mine ETA Timestamp if required
    if (withMine) await mineBlockWithTimestamp(timelockTxParams.eta)

    // Object of available transactions to be run on the Timelock
    const availableTimelockTransactionsEstimateGas = {
        [TimelockTransactionType.Queue]: timelock.connect(dev).estimateGas.queueTransaction,
        [TimelockTransactionType.Cancel]: timelock.connect(dev).estimateGas.cancelTransaction,
        [TimelockTransactionType.Execute]: timelock.connect(dev).estimateGas.executeTransaction,
    }
    const availableTimelockTransactions = {
        [TimelockTransactionType.Queue]: timelock.connect(dev).queueTransaction,
        [TimelockTransactionType.Cancel]: timelock.connect(dev).cancelTransaction,
        [TimelockTransactionType.Execute]: timelock.connect(dev).executeTransaction,
    }

    await availableTimelockTransactionsEstimateGas[txType](
        ...timelockTxParamsToCallableArray(timelockTxParams),
        { gasLimit: 1200000 }
    ).catch((err) => {
        console.log('throwing error', err)
        return extractRevertMsg(err)
    })
    

    // Execute Timelock Transaction
    // const nonce = dev.getTransactionCount('pending')
    // console.log({
    //     nonce
    // })
    const timelockTx = await availableTimelockTransactions[txType](
        ...timelockTxParamsToCallableArray(timelockTxParams),
        { gasLimit: 1200000 }
    )
    if (chainId !== hardhatChainId) {
        await timelockTx.wait(10) 
    }

    // Write transaction to JSON file of timelock interactions
    const timestamp = await getTimestamp()
    writeTimelockTransaction(chainId, txHash, timestamp, txType, rawParams, timelockTxParams)

    console.log("Timelock Transaction from Hash Finished:", {
        txType,
        target: timelockTxParams.targetContract,
        executedTransaction: {
            '0': `  ${TimelockTxFunctionName[txType]} (`,
            '1': `      ${timelockTxParams.targetContract}`,
            '2': `      ${timelockTxParams.value}`,
            '3': `      ${timelockTxParams.signature}`,
            '4': `      ${timelockTxParams.data}`,
            '5': `      ${timelockTxParams.eta}`,
            '6': '  )'
        },
    })

    // Return the txParams that were run on the Timelock
    return {
        ...timelockTxParams,
        txHash,
    }
}


// TESTABLE CANCEL / EXECUTE TRANSACTION BY HASH
export const testableTimelockTransactionByHash = async (txType: TimelockTransactionType, txHash: string, withMine = false) => {
    if (txType === TimelockTransactionType.Queue) throw new Error('Cant Call a Timelock Transaction of Time Queue by Hash')
    const { dev } = await ethers.getNamedSigners()
    const timelock = await getTimelock()
    const chainId = await getChainId()
    
    const queuedTransactionByHash = getQueuedTimelockTransactionByHash(chainId, txHash)
    if (queuedTransactionByHash == null) throw new Error(`Queued Transaction By Hash Not Found: ${txHash}`)
    
    const {
        rawParams,
        queueTimestamp,
        ...timelockTxParams
    }  = queuedTransactionByHash

    // Mine ETA Timestamp if required
    if (withMine) await mineBlockWithTimestamp(timelockTxParams.eta)

    // Object of available transactions to be run on the Timelock
    const availableTimelockTransactions = {
        [TimelockTransactionType.Queue]: timelock.connect(dev).queueTransaction,
        [TimelockTransactionType.Cancel]: timelock.connect(dev).cancelTransaction,
        [TimelockTransactionType.Execute]: timelock.connect(dev).executeTransaction,
    }

    const writeToJSON = async () => {
        const chainId = await getChainId()
        const timestamp = await getTimestamp()
        writeTimelockTransaction(chainId, txHash, timestamp, txType, rawParams, timelockTxParams)
    }

    return [
        () => availableTimelockTransactions[txType](...timelockTxParamsToCallableArray(timelockTxParams)),
        writeToJSON,
    ]
}

