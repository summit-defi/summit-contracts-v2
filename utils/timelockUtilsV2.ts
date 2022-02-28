import { Contract } from "@ethersproject/contracts";
import { keccak256 } from "@ethersproject/keccak256";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { providers } from "ethers";
import hre, { getChainId, ethers } from "hardhat";
import Web3 from "web3";
import { bytesify, checkForAlreadyQueuedMatchingTimelockTx, Contracts, delay, encodeQueuedTransactionHash, encodeTimelockTxData, ethersKeccak256, EVENT, executeTx, executeTxExpectEvent, executeTxExpectReversion, extractRevertMsg, getCartographer, getContract, getElevationName, getQueuedTimelockTransactionByHash, getTimelock, getTimelockTxParams, getTimestamp, getTxSignature, getTxSignatureBase, hardhatChainId, mineBlockWithTimestamp, TimelockTransactionType, TimelockTxFunctionName, timelockTxParamsToCallableArray, timestampToDate, writeTimelockTransaction } from ".";
import { TimelockTxSig } from "./timelockConstants";

export const timelockMethod = {
    queue: async ({
        dev,
        targetContractName,
        txName,
        txParams,
        note,
        dryRun = false,
    }: {
        dev: SignerWithAddress,
        targetContractName: string,
        txName: string,
        txParams: any[],
        note: string,
        dryRun?: boolean,
    }) => {
        const chainId = await getChainId()
        const timelock = await getTimelock()
        const targetContract = await getContract(targetContractName)
        const currentTimestamp = await getTimestamp()

        const params = {
            dryRun,
            note,
            txType: TimelockTransactionType.Queue,
            dev,
            timelock,
            targetContract,
            txName,
            txParams,
        }

        const txSignature = getTxSignatureBase({ targetContract, txName })
        const matchingTimelockTx = checkForAlreadyQueuedMatchingTimelockTx(
            chainId,
            targetContract.address,
            txSignature,
            txParams,
        )
        if (matchingTimelockTx != null) {
            console.log('Matching Transaction already Queued')
            console.log(`Matching tx Matures in ${((matchingTimelockTx.eta - currentTimestamp) / 3600).toFixed(1)}hr on ${timestampToDate(matchingTimelockTx.eta)}`)
            return
        }

        const timelockTxParams = await getTimelockTxParams(params)
        const tx = timelock.connect(dev).queueTransaction
        const txHash = encodeQueuedTransactionHash(timelock, timelockTxParams)

        // Execute Transaction
        if (!dryRun) {
            await executeTx(
                tx,
                timelockTxParamsToCallableArray(timelockTxParams),
            )
        }

        // Write transaction to JSON file of timelock interactions
        if (!dryRun) {
            const timestamp = await getTimestamp()
            writeTimelockTransaction(chainId, txHash, timestamp, TimelockTransactionType.Queue, txParams, timelockTxParams, note)
        }

        console.log(dryRun ? 'DRY RUN Timelock Tx:' : 'Timelock Transaction Finished:', {
            note,
            txType: TimelockTransactionType.Queue,
            target: targetContract.address,
            timelockedTransaction: `${txName}(${txParams.join(',')})`,
            executedTransaction: {
                '0': `  ${TimelockTxFunctionName[TimelockTransactionType.Queue]} (`,
                '1': `      ${timelockTxParams.targetContract}`,
                '2': `      ${timelockTxParams.value}`,
                '3': `      ${timelockTxParams.signature}`,
                '4': `      ${timelockTxParams.data}`,
                '5': `      ${timelockTxParams.eta}`,
                '6': '  )'
            },
        })

        return {
            ...timelockTxParams,
            note,
            txHash
        }
    },
}

