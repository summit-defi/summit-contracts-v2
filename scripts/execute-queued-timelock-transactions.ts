import { promiseSequenceMap } from '../utils';
import { executeQueuedTimelockTransactionByHash } from '../utils/timelockUtils';

const ExecuteQueuedTransactions: string[] = [
    '0xcdc22179d01abe5a5678d5fd2cb24c674e0d5ad4e7f0449d07f89e283e0acbbe',
    '0x5e468e6d91fc2f301a5edec72c84ac2f6179e8194cd7930c4baa2b660795edee',
    '0xb7a44816edb9d99102e6fac9b43ee6f8bffda149d7bcafbbc306ee9d1fd9b63a',
    '0x5211171d5ebf971241a55dc80c26d338ae099ff921c514025c0a00dc20667dfc',
]

const delay = async () => await new Promise(resolve => setTimeout(resolve, 20000));

async function main() {
    console.log('\n\n== EXECUTE QUEUED TIMELOCK TRANSACTIONS ==')

    console.log("Transaction to Execute", ExecuteQueuedTransactions)

    // Execute Queued transactions
    await promiseSequenceMap(
        ExecuteQueuedTransactions,
        async (txHash) => {
            console.log(`\tExecute Queued Transaction: ${txHash}`)

            const executeQueuedTxResult = await executeQueuedTimelockTransactionByHash(txHash)

            if (typeof executeQueuedTxResult === 'string') {
                console.log(`\t\tExecute Tx Failed: ${executeQueuedTxResult}\t`)
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
