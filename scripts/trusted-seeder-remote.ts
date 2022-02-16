import { getElevationHelper, getSeeds, getTimestamp, summitTrustedSeederMethod, delay } from '../utils';
import hre, { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import cron from 'node-cron'

const getRandomSeeds = (signer: SignerWithAddress): { sealedSeed: string, unsealedSeed: string } => {
    const seed = Math.random().toString(36).replace(/[^a-z]+/g, '')
    const { sealedSeed, unsealedSeed } = getSeeds(seed, signer.address)
    console.log({
        seed,
        sealedSeed,
        unsealedSeed,
    })
    return { sealedSeed, unsealedSeed }
}

const getSeedRoundTimeRemaining = async (nextTopOfSeedRound: number) => {
    let timestamp = null
    let timestampFetched = false
    while (!timestampFetched) {
        try {
            timestamp = await getTimestamp()
            timestampFetched = true
        } catch (err) {
            console.log('Err fetching timestamp')
        }
    }
    if (timestamp == null) {
        return 56476745647654765
    }
    return nextTopOfSeedRound - timestamp
}

async function main() {
    console.log("DATE TIME", new Date().toLocaleString('en-US', { timeZone: 'UTC' }))
    const { trustedSeeder } = await ethers.getNamedSigners()


    const timestamp = await getTimestamp()
    const nextTopOfHour = timestamp + (3600 - Math.max(timestamp % 3600))
    let seedRoundTimeRemaining = await getSeedRoundTimeRemaining(nextTopOfHour)

    console.log({
        timestamp,
        nextTopOfHour,
        remaining: (nextTopOfHour - timestamp) / 60,
        seedRoundTimeRemaining,
    })

    const hour = nextTopOfHour / 3600

    // if ((hour % 2) === 0) {
    //     console.log('Incorrect hour, exiting.')
    //     return;
    // }


    // console.log('Send seed to Elevation Helper')
    const { sealedSeed, unsealedSeed } = getRandomSeeds(trustedSeeder)
    console.log({
        sealedSeed,
        unsealedSeed
    })


    // // SEALED SEED

    console.log("== COUNTDOWN TO ROUND END ==")
    seedRoundTimeRemaining = await getSeedRoundTimeRemaining(nextTopOfHour)
    console.log({seedRoundTimeRemaining})
    while (seedRoundTimeRemaining > 120) {
        await delay(3)
        console.log(". ", seedRoundTimeRemaining)
        seedRoundTimeRemaining = await getSeedRoundTimeRemaining(nextTopOfHour)
    }


    console.log("==  SEND SEALED SEED ==\n")
    let seedingFailed = true
    while (seedingFailed) {
        try {
            await summitTrustedSeederMethod.receiveSealedSeed({
                trustedSeeder,
                sealedSeed,
            })
            seedingFailed = false;
        } catch (err) {
            console.log("Seeding Failed", err)
            seedingFailed = true;

            await delay(1000)

            const timestampCheck = await getTimestamp()
            if (timestampCheck == null || timestampCheck > nextTopOfHour) {
                throw new Error('Ran out of time to execute')
            }
        }
    }
    console.log('done.')


    // // UNSEALED SED

    seedRoundTimeRemaining = await getSeedRoundTimeRemaining(nextTopOfHour)
    while (seedRoundTimeRemaining >= 120) {
        await delay(3000)
        console.log("Time Remaining", seedRoundTimeRemaining)
        seedRoundTimeRemaining = await getSeedRoundTimeRemaining(nextTopOfHour)
    }

    console.log("==  SEND UNSEALED SEED ==\n")
    let unsealedSeedingFailed = true
    while (unsealedSeedingFailed) {
        try {
            await delay(10000)
            await summitTrustedSeederMethod.receiveUnsealedSeed({
                trustedSeeder,
                unsealedSeed,
            })
            unsealedSeedingFailed = false
        } catch (err) {
            console.log("Unsealed Seeding Failed", err)
            unsealedSeedingFailed = true;
            
            await delay(1000)

            const timestampCheck = await getTimestamp()
            if (timestampCheck == null || timestampCheck > nextTopOfHour) {
                throw new Error('Ran out of time to execute')
            }
        }
    }

    console.log('RECEIVED UNSEALED SEED')
    console.log('done.\n')
};

/*

  * * * * * *
  | | | | | |
  | | | | | day of week
  | | | | month
  | | | day of month
  | | hour
  | minute
  second ( optional )

*/

cron.schedule('2 58 1-23/2 * * *', () => {
  console.log('starting seeder');
  main()
     .catch(error => {
         console.error(error);
     });
}).start();

// main()
//     .catch(err => {
//         console.error(err);
//     })

// main()

// main()
//     .then(() => process.exit(0))
//     .catch(error => {
//         console.error(error);
//         process.exit(1);
//     });
