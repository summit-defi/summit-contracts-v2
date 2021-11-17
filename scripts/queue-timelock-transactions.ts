import { ethers, getChainId } from 'hardhat'
import { checkForAlreadyQueuedMatchingTimelockTx, Contracts, delay, e18, e6, hardhatChainId, promiseSequenceMap, ZEROADD } from '../utils';
import { TimelockedTransaction, queueTimelockTransaction, getTxSignatureBase, QueueTxConfig, TimelockTargetContract } from '../utils/timelockUtils';
import { Contract } from 'ethers';

const USDCaddress_FTM = '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75'
const USDCexpedRounds = 7
const USDCexpedValue = 350000

const QueuedTransactions: QueueTxConfig[] = [
    // {
    //     targetContractName: TimelockTargetContract.Cartographer,
    //     txName: TimelockedTransaction.Cartographer_AddExpedition,
    //     txParams: [0, USDCaddress_FTM, e6(USDCexpedValue), 7],
    //     note: `Add Expedition: Token ${USDCaddress_FTM}, Rounds ${USDCexpedRounds}, Per Round ${USDCexpedValue / USDCexpedRounds}, Total ${USDCexpedValue}`
    // },
    {
        targetContractName: TimelockTargetContract.Cartographer,
        txName: TimelockedTransaction.Cartographer_SetTotalSummitPerSecond,
        txParams: [0],
        note: 'Turn off emissions',
    }
]

const getContractFromName = async (queuedTxTargetName: TimelockTargetContract): Promise<Contract> => {
    return await ethers.getContract(queuedTxTargetName)
}

const DRY_RUN = false

async function main() {
    const chainId = await getChainId()

    console.log('\n\n== QUEUE TIMELOCK TRANSACTIONS ==')

    // Queue transactions
    console.log(`\n-- QUEUE TRANSACTIONS --\n`)
    const txHashes = await promiseSequenceMap(
        QueuedTransactions,
        async ({ targetContractName, txName, txParams, note }) => {
            const targetContract = await getContractFromName(targetContractName)
            const txSignature = getTxSignatureBase({ targetContract, txName })
            console.log(`\tQueue Transaction: ${txSignature}, params: (${txParams.join(',')})`)

            const alreadyQueuedMatchingTxHash = checkForAlreadyQueuedMatchingTimelockTx(chainId, targetContract.address, txSignature, txParams)
            if (alreadyQueuedMatchingTxHash != null) {
                console.log(`\t\tMatching Existing Queued Tx Found: ${alreadyQueuedMatchingTxHash}, skipping (use force to push it through)\n`)
                return
            } else {
                console.log('\t\tFresh Transaction.\n')
            }

            const { txHash } = await queueTimelockTransaction({ dryRun: DRY_RUN, targetContract, txName, txParams, note })

            if (!DRY_RUN && chainId !== hardhatChainId) {
                await delay(20000)
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
