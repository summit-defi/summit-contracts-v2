import { promiseSequenceMap } from '../utils';
import { cancelQueuedTimelockTransactionByHash, executeQueuedTimelockTransactionByHash } from '../utils/timelockUtils';

const ExecuteQueuedTransactions: string[] = [
    
]

const delay = async () => await new Promise(resolve => setTimeout(resolve, 20000));

async function main() {
    console.log('\n\n== CANCEL QUEUED TIMELOCK TRANSACTIONS ==')

    // Execute Queued transactions
    await promiseSequenceMap(
        ExecuteQueuedTransactions,
        async (txHash) => {
            console.log(`\Cancel Queued Transaction: ${txHash}`)

            const executeQueuedTxResult = await cancelQueuedTimelockTransactionByHash(txHash)

            if (typeof executeQueuedTxResult === 'string') {
                console.log(`\t\Cancel Tx Failed: ${executeQueuedTxResult}\t`)
            } else {
                console.log(`\t\tdone.\n`)
                await delay()
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
