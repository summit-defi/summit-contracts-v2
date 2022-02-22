import inquirer from 'inquirer'
import { getChainId } from 'hardhat';
import { getQueuedTimelockTxs, getTimestamp, promiseSequenceMap, timestampToDate, delay } from '../utils';
import { cancelQueuedTimelockTransactionByHash } from '../utils/timelockUtils';

async function main() {
    console.log('\n\n== CANCEL QUEUED TIMELOCK TRANSACTIONS ==\n\n\n')

    const chainId = await getChainId()
    const queuedTimelockTxs = getQueuedTimelockTxs(chainId)
    const queuedTimelockTxsList = Object.values(queuedTimelockTxs)
    const currentTimestamp = await getTimestamp()

    const txHashesToExecute: string[] = (await inquirer.prompt([
        {
            type: 'checkbox',
            message: 'Select Queued Txs to Cancel',
            name: 'txHashes',
            pageSize: 50,
            choices: queuedTimelockTxsList.map((tx) => ({
                name: `${currentTimestamp < tx.eta ? 'IMMATURE - ' : ''}${tx.note}${currentTimestamp >= tx.eta ? '' : ` - Matures in ${((tx.eta - currentTimestamp) / 3600).toFixed(1)}hr on ${timestampToDate(tx.eta)}`}`,
                value: tx.txHash,
            })),
        },
    ])).txHashes

    // Execute Queued transactions
    await promiseSequenceMap(
        txHashesToExecute,
        async (txHash) => {
            console.log(`\tCancel Queued Transaction: ${txHash}`)

            const cancelQueuedTxResult = await cancelQueuedTimelockTransactionByHash(txHash)

            if (typeof cancelQueuedTxResult === 'string') {
                console.log(`\t\tCancel Tx Failed: ${cancelQueuedTxResult}\t`)
            } else {
                console.log(`\t\tdone.\n`)
            }
            await delay(5000)
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
