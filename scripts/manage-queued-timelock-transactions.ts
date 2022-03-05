import inquirer from 'inquirer'
import { getChainId } from 'hardhat';
import { getQueuedTimelockTxs, getTimestamp, promiseSequenceMap, timestampToDate, delay } from '../utils';
import { cancelQueuedTimelockTransactionByHash, executeQueuedTimelockTransactionByHash, markQueuedTimelockTransactionAsCancelledByHash, markQueuedTimelockTransactionAsExecutedByHash } from '../utils/timelockUtils';

enum TxAction {
    Execute = 'Execute',
    Cancel = 'Cancel',
    MarkAsExecuted = 'MarkAsExecuted',
    MarkAsCancelled = 'MarkAsCancelled',
}
const allTxActions = [TxAction.Execute, TxAction.Cancel, TxAction.MarkAsExecuted, TxAction.MarkAsCancelled]

async function main() {
    console.log('\n\n== MANAGE QUEUED TIMELOCK TRANSACTIONS ==\n\n\n')

    const chainId = await getChainId()
    const queuedTimelockTxs = getQueuedTimelockTxs(chainId)
    const queuedTimelockTxsList = Object.values(queuedTimelockTxs)
    const currentTimestamp = await getTimestamp()

    const txsToManage: Array<{ txHash: string, txNote: string }> = (await inquirer.prompt([
        {
            type: 'checkbox',
            message: 'Select Queued Txs to Manage',
            name: 'txs',
            pageSize: 50,
            choices: queuedTimelockTxsList.map((tx) => {
                const txNote = `${currentTimestamp < tx.eta ? 'IMMATURE - ' : ''}${tx.note}${currentTimestamp >= tx.eta ? '' : ` - Matures in ${((tx.eta - currentTimestamp) / 3600).toFixed(1)}hr on ${timestampToDate(tx.eta)}`}`
                return {
                    name: txNote,
                    value: {
                        txHash: tx.txHash,
                        txNote
                    }
                }
            }),
        },
    ])).txs

    // Execute Queued transactions
    await promiseSequenceMap(
        txsToManage,
        async ({ txHash, txNote }) => {
            console.log(`\nQueued Transaction To Manage: ${txNote}`)

            const txAction = (await inquirer.prompt([
                {
                    type: 'list',
                    message: 'Action to perform',
                    name: 'action',
                    choices: allTxActions.map((action) => ({
                        name: action,
                        value: action, 
                    }))
                }
            ])).action

            console.log(txAction, 'Tx:', txNote)

            switch (txAction) {
                case TxAction.Execute:

                    const executeQueuedTxResult = await executeQueuedTimelockTransactionByHash(txHash)

                    if (typeof executeQueuedTxResult === 'string') {
                        console.log(`\tExecute Tx Failed: ${executeQueuedTxResult}\t`)
                    } else {
                        console.log(`\tdone.\n`)
                    }
                    break

                case TxAction.Cancel:

                    const cancelQueuedTxResult = await cancelQueuedTimelockTransactionByHash(txHash)

                    if (typeof cancelQueuedTxResult === 'string') {
                        console.log(`\tCancel Tx Failed: ${cancelQueuedTxResult}\t`)
                    } else {
                        console.log(`\tdone.\n`)
                    }
                    break

                case TxAction.MarkAsExecuted:
                    await markQueuedTimelockTransactionAsExecutedByHash(txHash)
                    console.log(`\tdone.\n`)
                    break

                case TxAction.MarkAsCancelled:
                    await markQueuedTimelockTransactionAsCancelledByHash(txHash)
                    console.log(`\tdone.\n`)
                    break
            }
        }
    )

    console.log('\n\n== DONE ==\n\n')
};

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
