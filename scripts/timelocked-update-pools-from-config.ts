import hre, { ethers, getChainId } from 'hardhat'
import { Contracts, MESA, OASIS, promiseSequenceMap, SUMMIT, PLAINS } from '../utils';
import { getConfigs } from '../data';
import { queueSyncPoolsTimelockTransactions } from './scriptUtils/timelock-pool-sync';


const DRY_RUN = false


async function main() {
    const chainId = await getChainId()
    const cartographer = await getCartographer()
    const SummitToken = await getSummitToken()

    const summitAddress = SummitToken.address
    const summitLpAddress = await cartographer.summitLp()

    console.log('\n\n== QUEUE TIMELOCK TRANSACTIONS ==')

    const poolConfigs = getConfigs(chainId).pools

    const elevationQueuedTxHashes = await promiseSequenceMap(
        [PLAINS, MESA, SUMMIT],
        async (elevation) => {
            return await queueSyncPoolsTimelockTransactions(chainId, DRY_RUN, elevation, poolConfigs, cartographer, summitAddress, summitLpAddress)
        }
    )

    console.log('==== QUEUED TX HASHES ====')
    console.log(JSON.stringify(elevationQueuedTxHashes, null, 2))
};

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
