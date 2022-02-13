import { ethers, getChainId } from 'hardhat'
import { Contracts, delay, getTimestamp, hardhatChainId, promiseSequenceMap } from '../utils';
import { queueTimelockTransaction, QueueTxConfig, getMatchingTimelockedTransaction } from '../utils/timelockUtils';
import { TimelockTxSig } from '../utils/timelockConstants';

const QueuedTransactions: QueueTxConfig[] = [
    {
        targetContractName: Contracts.Cartographer,
        txName: TimelockTxSig.Cartographer.Enable,
        txParams: [],
        note: 'Enable The Summit Ecosystem'
    },
    {
        targetContractName: Contracts.SummitTrustedSeederRNGModule,
        txName: TimelockTxSig.SummitTrustedSeederRNGModule.SetTrustedSeederAdd,
        txParams: ['0xC2a1c87162acC85Dd25bE1bCbF0b9d45E891229f'],
        note: `Set Trusted Seeder Address to '0xC2a1c87162acC85Dd25bE1bCbF0b9d45E891229f'`,
    }
]

const DRY_RUN = false

async function main() {
    const chainId = await getChainId()

    console.log('\n\n== QUEUE TIMELOCK TRANSACTIONS ==')

    // Queue transactions
    console.log(`\n-- QUEUE TRANSACTIONS --\n`)
    const txHashes = await promiseSequenceMap(
        QueuedTransactions,
        async ({ targetContractName, txName, txParams, note }) => {
            const targetContract = await ethers.getContract(targetContractName)

            console.log(`QUEUE: ${note}`)

            const params = {
                dryRun: DRY_RUN,

                targetContract,
                txName,
                txParams,
                note
            }
            const matchingTx = await getMatchingTimelockedTransaction(params)
            let txHash

            if (matchingTx == null) {
                const { txHash: hash } = await queueTimelockTransaction(params)
                txHash = hash
                console.log('\t\tqueued.')
            } else {
                const currentTimestamp = await getTimestamp()
                const matchingTxEta = matchingTx.eta
                const matured = currentTimestamp >= matchingTxEta
                if (matured) {
                    console.log(`\t\tAlready queued and MATURED`)
                } else {
                    const matureDateTime = new Date(matchingTxEta * 1000)
                    console.log(`\t\tAlready queued, matures in ${((matchingTxEta - currentTimestamp) / 3600).toFixed(1)}hr on ${matureDateTime.toString()}`)
                }
            }

            if (!DRY_RUN && chainId !== hardhatChainId) {
                await delay(5000)
            }

            return txHash
        }
    )

    console.log('\n\n== DONE ==\n\n')
    console.log({
        txHashes
    })
};

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
