import inquirer from 'inquirer'
import { getChainId } from 'hardhat';
import { getQueuedTimelockTxs, getTimestamp, promiseSequenceMap, timestampToDate, delay } from '../utils';
import { executeQueuedTimelockTransactionByHash } from '../utils/timelockUtils';

async function main() {
    console.log('\n\n== MANAGE QUEUED TIMELOCK TRANSACTIONS ==\n\n\n')

    const chainId = await getChainId()
    const queuedTimelockTxs = getQueuedTimelockTxs(chainId)
    const queuedTimelockTxsList = Object.values(queuedTimelockTxs)
    const currentTimestamp = await getTimestamp()

    const txHashesToExecute: string[] = (await inquirer.prompt([
        {
            type: 'checkbox',
            message: 'Select Queued Txs to Execute',
            name: 'txHashes',
            pageSize: 50,
            choices: queuedTimelockTxsList.map((tx) => ({
                name: `${currentTimestamp < tx.eta ? 'IMMATURE - ' : ''}${tx.note}`,
                disabled: currentTimestamp >= tx.eta ? false : `Matures in ${((tx.eta - currentTimestamp) / 3600).toFixed(1)}hr on ${timestampToDate(tx.eta)}`,
                value: tx.txHash,
            })),
        },
    ])).txHashes

    // Execute Queued transactions
    await promiseSequenceMap(
        txHashesToExecute,
        async (txHash) => {
            console.log(`\tExecute Queued Transaction: ${txHash}`)

            const executeQueuedTxResult = await executeQueuedTimelockTransactionByHash(txHash)

            if (typeof executeQueuedTxResult === 'string') {
                console.log(`\t\tExecute Tx Failed: ${executeQueuedTxResult}\t`)
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
