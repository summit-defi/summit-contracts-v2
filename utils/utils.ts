import { expect } from "chai"
import { BigNumber, ethers } from "ethers"
import hre, { network, ethers as hardhatEthers, getChainId } from "hardhat"
import { chainTreasuryAddress, EVM, getElevationName, hardhatChainId } from "."
import { getCreate2Address } from '@ethersproject/address';
import { pack, keccak256 } from '@ethersproject/solidity';
import fs from 'fs'
import { chainExpedTreasuryAddress, chainLpGeneratorAddress, mainnetNetworks, NamedElevations, networkAMMFactory, networkAMMPairCodeHash, networkExportsAddresses, networksOnWhichToVerify, networksWhichExpectUsersToHaveSummit, networksWhichRequireDummies, networkUsdcAddress, networkWrappedNativeTokens } from "./constants"
import { JSONQueuedTransaction, TimelockTransactionType, TimelockTxParams, TimelockTxTypeName } from "./timelockUtils";

// ETHERS
export const ethersKeccak256 = (input: string): string => ethers.utils.keccak256(input)
export const bytesify = (input: string): string => `0x${input}`
export const extractRevertMsg = (err: any) => {
    return err.error.toString().split('execution reverted: ')[1]
}

// ARRAYS
export const flatten = <T>(arr: T[][]): T[] => {
    return ([] as T[]).concat(...arr);
}

// Failable verify
export const failableVerify = async (args: Object) => {
    await delay(10000)
    try {
        await hre.run("verify:verify", args)
    } catch (err: any) {
        console.log('Verify Failed: ', err.message)
    }
}

// BIG NUMBERS
export const sumBigNumbers = (arr: BigNumber[]) => {
    return arr.reduce((acc, n) => acc.add(n), e18(0))
}
export const sumNumbers = (arr: number[]) => {
    return arr.reduce((acc, n) => acc + n, 0)
}
export const days = (n: number) => {
    return n * 24 * 3600
}
export const e36 = (n: number) => {
    return e18(n).mul(e18(1))
}
export const e24 = (n: number) => {
    return e18(n).mul(e6(1))
}
export const e18 = (n: number) => {
    return ethers.utils.parseUnits(n.toString())
}
export const e16 = (n: number) => {
    return e18(n).div(BigNumber.from(100))
}
export const toDecimal = (n: BigNumber) => {
    return ethers.utils.formatUnits(n, 18)
}
export const toFixedDecimal = (n: BigNumber, dec = 2) => {
    return parseFloat(toDecimal(n)).toFixed(dec)
}
export const e12 = (n: number) => {
    return ethers.utils.parseUnits(n.toString()).div(BigNumber.from(1000000))
}
export const e6 = (n: number) => {
    return ethers.utils.parseUnits(n.toString()).div(BigNumber.from(1000000000000))
}
export const e0 = (n: number) => {
    return BigNumber.from(n)
}
export const stringifyBigNumberArray = (arr: BigNumber[]): string => {
    return arr.map(item => item.toString()).join(' ')
}
export const deltaBN = (n0: BigNumber, n1: BigNumber): BigNumber => {
    return n0.gt(n1) ? n0.sub(n1) : n1.sub(n0)
}

// LOGGING
export const checkmarkIfTrue = (b: boolean) => {
    return b ? '✔' : '✘'
}
export const checkmarkIfEquals = (a: any, b: any) => {
    return checkmarkIfTrue(a === b)
}
export const checkmarkIfBNEquals = (a: BigNumber, b: BigNumber) => {
    return checkmarkIfTrue(a.eq(b))
}

// ASSERTIONS
export const sixFigBigNumberEquals = (a: BigNumber, b: BigNumber) => {
    const diff = a.gt(b) ? a.sub(b) : b.sub(a)
    return diff.div(e12(1)).toNumber() === 0
}
export const expect6FigBigNumberEquals = (a: BigNumber, b: BigNumber) => {
    if (!sixFigBigNumberEquals(a, b)) {
        console.log(`BN Mismatch: ${toDecimal(a)} ==? ${toDecimal(b)}: ✘`)
    }
    expect(sixFigBigNumberEquals(a, b)).to.be.true
}
export const expect6FigBigNumberAllEqual = (arr: BigNumber[]) => {
    arr.forEach((item) => expect6FigBigNumberEquals(item, arr[0]))
}
export const expectAllEqual = (arr: Array<number | BigNumber>) => {
    arr.forEach((item) => expect(item).to.equal(arr[0]))
}
export const expectBigNumberGreaterThan = (a: BigNumber, b: BigNumber) => {
    expect(a.gt(b)).to.be.true
}
export const expectBigNumberLessThan = (a: BigNumber, b: BigNumber) => {
    expect(a.lt(b)).to.be.true
}
export const expectBigNumberArraysEqual = (arrA: BigNumber[], arrB: BigNumber[]) => {
    expect(stringifyBigNumberArray(arrA)).to.equal(stringifyBigNumberArray(arrB))
}

// PROMISES
export const promiseSequenceMap = async <T, R>(inputArray: T[], transformer: (element: T, index: number, array: T[]) => Promise<R>): Promise<R[]> => {
    const newArray: R[] = []
    for (let i = 0; i < inputArray.length; i++) {
        newArray[i] = await transformer(inputArray[i], i, inputArray)
    }
    return newArray
}

// FUNCTIONS
export const getBlock = async(): Promise<ethers.providers.Block> => {
    return await hardhatEthers.provider.getBlock('latest')
}
export const getBlockNumber = async(): Promise<number> => {
    return (await getBlock()).number
}
export const getTimestamp = async(): Promise<number> => {
    return (await getBlock()).timestamp
}
export const setTimestamp = async(timestamp: number) => {
    const currentTimestamp = await getTimestamp()
    await network.provider.send(EVM.SetNextBlockTimestamp, [Math.max(timestamp, currentTimestamp + 2)])
}
export const increaseTimestampAndMine = async(increment: number) => {
    await network.provider.send(EVM.IncreaseTime, [increment])
    await mineBlock()
}
export const mineBlock = async () => {
    await network.provider.send(EVM.Mine)
}
export const mineBlockWithTimestamp = async (timestamp: number) => {
    await setTimestamp(timestamp)
    await mineBlock()
}
export const mineBlocks = async (blockCount: number) => {
    for (let i = 0; i < blockCount; i++) {
        await mineBlock()
    }
}
export const getExpectedDistributionsOnClaim = (rewards: BigNumber) => ({
    treasuryExpected: rewards.mul(2000).div(10000)
})
export const tokenAmountAfterWithdrawTax = (amount: BigNumber, tax: number): BigNumber => {
    return amount.mul(10000 - tax).div(10000)
}
export const tokenAmountAfterDepositFee = (amount: BigNumber, fee: number): BigNumber => {
    return amount.mul(10000 - fee).div(10000)
}
export const claimAmountBonus = (amount: BigNumber, bonus: number): BigNumber => {
    return amount.mul(bonus).div(10000)
}
export const claimAmountWithBonusAdded = (amount: BigNumber, bonus: number): BigNumber => {
    return amount.mul(10000 + bonus).div(10000)
}
export const depositedAfterFee = (amount: BigNumber, fee: number): BigNumber => {
    return amount.mul(10000 - fee).div(10000)
}
export const withdrawnAfterFee = (amount: BigNumber, fee: number): BigNumber => {
    return amount.mul(10000 - fee).div(10000)
}
export const amountAfterFullFee = (amount: BigNumber, fee: number): BigNumber => {
    return withdrawnAfterFee(depositedAfterFee(amount, fee), fee)
}
export function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}
export const chainIdAllowsVerification = (chainId: string) => {
    return networksOnWhichToVerify.includes(parseInt(chainId))
}
export const chainIdExpectsUserToHaveSummit = (chainId: string) => {
    return networksWhichExpectUsersToHaveSummit.includes(parseInt(chainId))
}
export const chainIdRequiresDummies = (chainId: string): boolean => {
    return networksWhichRequireDummies.includes(parseInt(chainId))
}
export const chainIdAMMFactory = (chainId: string): string | null => {
    return networkAMMFactory[chainId] || null
}
export const chainIdAMMPairCodeHash = (chainId: string): string | null => {
    return networkAMMPairCodeHash[chainId] || null
}
export const chainIdWrappedNativeToken = (chainId: string): string | null => {
    return networkWrappedNativeTokens[chainId] || null
}
export const chainIdExportsAddresses = (chainId: string) => {
    return networkExportsAddresses.includes(parseInt(chainId))
}
export const chainIdIsMainnet = (chainId: string) => {
    return mainnetNetworks.includes(parseInt(chainId))
}
export const chainIdUsdcAddress = (chainId: string) => {
    return networkUsdcAddress[chainId] || null
}
export const getChainTreasuryAddress = (chainId: string) => {
    return chainTreasuryAddress[chainId]
}
export const getChainExpedTreasuryAddress = (chainId: string) => {
    return chainExpedTreasuryAddress[chainId]
}
export const getChainLpGeneratorAddress = (chainId: string) => {
    return chainLpGeneratorAddress[chainId]
}
export const notHardhat = async () => {
    return (await getChainId()) !== hardhatChainId
}
export const txWaitCount = async () => {
    return (await notHardhat()) ? 5 : 0
}


// CONTRACT ADDRESSES
export const writeContractAddresses = (chainId: string, addresses: Array<[string, string]>) => {
    const contractsJSON = fs.readFileSync('./data/contracts.json')
    const contracts = JSON.parse(contractsJSON.toString())

    const insertAddress = (key: string, value: string) => {
        if (!contracts[key]) contracts[key] = {}
        contracts[key][chainId] = value
    }

    addresses.map(([name, address]) => {
        insertAddress(name, address)
    })

    const output = JSON.stringify(contracts, null, 2)
    fs.writeFileSync('./data/contracts.json', output)
}
export const getWrittenContractAddress = (chainId: string, contractName: string) => {
    const contractsJSON = fs.readFileSync('./data/contracts.json')
    const contracts = JSON.parse(contractsJSON.toString())
    return contracts[contractName][chainId]
}

// SEEDING

// TOKEN ADDRESS
export const replaceSummitAddresses = (address: string, summitAddress: string, summitLpAddress: string, everestAddress: string): string => {
    if (address === '0xSUMMIT') return summitAddress
    if (address === '0xSUMMITLP') return summitLpAddress
    if (address === '0xEVEREST') return everestAddress
    return address
}

// POOL PIDS
export const getChainName = (chainId: string) => {
    switch (chainId) {
        case '250': return 'ftm'
        case '56': return 'bsc'
        case '97': return 'bsc_testnet'
        case '31337': return 'hardhat'
        case '137': return 'polygon'
        default: return 'error'
    }
}


export interface JSONPoolPids {
    allocation: number
    elevationPids: {
        [NamedElevations.OASIS]: number | null
        [NamedElevations.PLAINS]: number | null
        [NamedElevations.MESA]: number | null
        [NamedElevations.SUMMIT]: number | null
    }
}

type NamedElevationsOnly = NamedElevations.OASIS | NamedElevations.PLAINS | NamedElevations.MESA | NamedElevations.SUMMIT

export const writePoolPid = (chainId: string, poolSymbol: string, elevation: number, createdPoolPid: number | undefined) => {
    const chainName = getChainName(chainId)
    const filename = `./data/${chainName}/pools.json`
    const poolPidsJSON = fs.readFileSync(filename)
    const poolPids = JSON.parse(poolPidsJSON.toString())

    if (!poolPids[poolSymbol]) poolPids[poolSymbol] = {} 
    if (!poolPids[poolSymbol].elevationPids) poolPids[poolSymbol].elevationPids = {}
    poolPids[poolSymbol].elevationPids[getElevationName(elevation)] = createdPoolPid

    const output = JSON.stringify(poolPids, (k, v) => v === undefined ? null : v, 2)
    fs.writeFileSync(filename, output)
}
export const getElevationPoolPids = (chainId: string, elevation: number): number[] => {
    const poolPids = getPoolPids(chainId)
    return poolPids
        .map((singlePoolPids) => singlePoolPids.elevationPids[getElevationName(elevation) as NamedElevationsOnly])
        .filter((pid) => pid != null) as number[]
}
export const getPoolPids = (chainId: string): JSONPoolPids[] => {
    const chainName = getChainName(chainId)
    const filename = `./data/${chainName}/pools.json`
    const poolPidsJSON = fs.readFileSync(filename)
    const poolPids = JSON.parse(poolPidsJSON.toString())

    if (poolPids == null) return []

    return Object.values(poolPids)
}
export const writePoolAllocation = (chainId: string, poolSymbol: string, allocation: number) => {
    const chainName = getChainName(chainId)
    const filename = `./data/${chainName}/pools.json`
    const poolPidsJSON = fs.readFileSync(filename)
    const poolPids = JSON.parse(poolPidsJSON.toString())

    if (!poolPids[poolSymbol]) poolPids[poolSymbol] = {} 
    poolPids[poolSymbol].allocation = allocation

    const output = JSON.stringify(poolPids, (k, v) => v === undefined ? null : v, 2)
    fs.writeFileSync(filename, output)
}
export const writePassthroughStrategy = (chainId: string, poolSymbol: string, token: string, passthroughContract: string, targetVaultContract: string) => {
    const chainName = getChainName(chainId)
    const filename = `./data/${chainName}/passthroughStrategies.json`
    const passthroughStrategiesJSON = fs.readFileSync(filename)
    const passthroughStrategies = JSON.parse(passthroughStrategiesJSON.toString())

    if (!passthroughStrategies[poolSymbol]) passthroughStrategies[poolSymbol] = {} 
    passthroughStrategies[poolSymbol].token = token
    passthroughStrategies[poolSymbol].passthroughContract = passthroughContract
    passthroughStrategies[poolSymbol].targetVaultContract = targetVaultContract

    const output = JSON.stringify(passthroughStrategies, null, 2)
    fs.writeFileSync(filename, output)
}

export interface JSONPassthroughStrategy {
    token: string,
    passthroughContract: string,
    targetVaultContract: string,
}
export const getPassthroughStrategy = (chainId: string, poolSymbol: string): JSONPassthroughStrategy => {
    const chainName = getChainName(chainId)
    const filename = `./data/${chainName}/passthroughStrategies.json`
    const passthroughStrategiesJSON = fs.readFileSync(filename)
    const passthroughStrategies = JSON.parse(passthroughStrategiesJSON.toString())

    return passthroughStrategies[poolSymbol]
}
export const writeExpeditionPid = (chainId: string, expeditionSymbol: string, createdExpeditionPid: number) => {
    const chainName = getChainName(chainId)
    const filename = `./data/${chainName}/expeditions.json`
    const expeditionPidsJSON = fs.readFileSync(filename)
    const expeditionPids = JSON.parse(expeditionPidsJSON.toString())

    expeditionPids[expeditionSymbol] = createdExpeditionPid

    const output = JSON.stringify(expeditionPids, null, 2)
    fs.writeFileSync(filename, output)
}


// COMPUTE EXPECTED LP PAIR ADDRESS
export const computePairAddress = (factoryAddress: string, pairInitHash: string, tokenA: string, tokenB: string) => {
    const [token0, token1] = sortTokens(tokenA, tokenB);
    return getCreate2Address(
        factoryAddress,
        keccak256(['bytes'], [pack(['address', 'address'], [token0, token1])]),
        pairInitHash
    );
};

export const sortTokens = (tokenA: string, tokenB: string) => {
    if (tokenA === tokenB) throw new RangeError(`tokenA should not be equal to tokenB: ${tokenB}`);
    return tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
};

// TIMELOCK
export const emptyHardhatTimelockTransactions = (chainId: string) => {
    if (chainId !== '31337') return

    const chainName = getChainName(chainId)
    const filename = `./data/${chainName}/timelockTxns.json`

    const output = JSON.stringify({
        queued: {},
        executed: {},
        cancelled: {},
    }, null, 2)

    fs.writeFileSync(filename, output)
}
export const writeTimelockTransaction = (chainId: string, txHash: string, timestamp: number, txType: TimelockTransactionType, rawParams: any[], timelockTxParams: TimelockTxParams, note?: string) => {
    const chainName = getChainName(chainId)
    const filename = `./data/${chainName}/timelockTxns.json`
    const timelockTxnsJSON = fs.readFileSync(filename)
    const timelockTxns = JSON.parse(timelockTxnsJSON.toString())

    // Create tx type object if necessary    
    const stringTxType = TimelockTxTypeName[txType]
    if (timelockTxns[stringTxType] == null) timelockTxns[stringTxType] = {}

    let additionalData = {}
    switch (txType) {
        case TimelockTransactionType.Queue:
            additionalData = {
                queueTimestamp: timestamp,
                note,
            }
            break;
        case TimelockTransactionType.Execute:
            additionalData = {
                queueTimestamp: timelockTxns[TimelockTxTypeName[TimelockTransactionType.Queue]][txHash].queueTimestamp,
                note: timelockTxns[TimelockTxTypeName[TimelockTransactionType.Queue]][txHash].note,
                executeTimestamp: timestamp,
            }
            break;
        case TimelockTransactionType.Cancel:
            additionalData = {
                queueTimestamp: timelockTxns[TimelockTxTypeName[TimelockTransactionType.Queue]][txHash].queueTimestamp,
                note: timelockTxns[TimelockTxTypeName[TimelockTransactionType.Queue]][txHash].note,
                cancelTimestamp: timestamp
            }
            break;
    }

    // Add tx to tx type object
    timelockTxns[stringTxType][txHash] = {
        ...timelockTxParams,
        rawParams,
        txHash,
        ...additionalData,
    }

    // Delete corresponding queue transaction if it has been executed or cancelled
    if (txType !== TimelockTransactionType.Queue) {
        delete timelockTxns[TimelockTxTypeName[TimelockTransactionType.Queue]][txHash]
    }

    // Write output
    const output = JSON.stringify(timelockTxns, null, 2)
    fs.writeFileSync(filename, output)
}

export const getQueuedTimelockTransactionByHash = (chainId: string, txHash: string): JSONQueuedTransaction | null => {
    const chainName = getChainName(chainId)
    const filename = `./data/${chainName}/timelockTxns.json`
    const timelockTxnsJSON = fs.readFileSync(filename)
    const timelockTxns = JSON.parse(timelockTxnsJSON.toString())

    return timelockTxns[TimelockTxTypeName[TimelockTransactionType.Queue]][txHash]
}

export const checkForAlreadyQueuedMatchingTimelockTx = (chainId: string, targetContract: string, txSignature: string, txParams: any[]): JSONQueuedTransaction | null => {
    const chainName = getChainName(chainId)
    const filename = `./data/${chainName}/timelockTxns.json`
    const timelockTxnsJSON = fs.readFileSync(filename)
    const timelockTxns = JSON.parse(timelockTxnsJSON.toString())

    const alreadyQueuedTransactions = Object.values(timelockTxns[TimelockTxTypeName[TimelockTransactionType.Queue]]) as JSONQueuedTransaction[]

    let alreadyQueuedTransaction: JSONQueuedTransaction
    for (let txIndex = 0; txIndex < alreadyQueuedTransactions.length; txIndex++) {
        alreadyQueuedTransaction = alreadyQueuedTransactions[txIndex]
        if (
            alreadyQueuedTransaction.targetContract.toLowerCase() === targetContract.toLowerCase() &&
            alreadyQueuedTransaction.signature === txSignature &&
            alreadyQueuedTransaction.rawParams.every((rawParam: any, paramIndex: number) => rawParam === txParams[paramIndex])
        ) {
            return alreadyQueuedTransaction
        }
    }
    
    return null
}

export const getQueuedTimelockTxs = (chainId: string): JSONQueuedTransaction[] => {
    const chainName = getChainName(chainId)
    const filename = `./data/${chainName}/timelockTxns.json`
    const timelockTxnsJSON = fs.readFileSync(filename)
    const timelockTxns = JSON.parse(timelockTxnsJSON.toString())

    return timelockTxns.queued
}

export const timestampToDate = (timestamp: number): string => {
    if (timestamp < 10000000) return '---'
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' }).toUpperCase()
}