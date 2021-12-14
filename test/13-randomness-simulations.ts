import { elevationHelperGet, getSeeds, MESA, mineBlock, PLAINS, promiseSequenceMap, rolloverRound, RUN_RNG_SIMS, SUMMIT, summitTrustedSeederMethod } from "../utils"
import { mesaUnlockedFixture, plainsUnlockedFixture, summitUnlockedFixture } from "./fixtures"

describe('RANDOMNESS SIMULATIONS', async function() {
    it('PLAINS RANDOMNESS: Verify plains randomness', async function () {
        if (!RUN_RNG_SIMS) {
            console.log("Skip Sims")
            return
        }
        const { trustedSeeder } = await plainsUnlockedFixture()

        for (let i = 0; i < 1000; i++) {
            if (i % 50 == 0) console.log("Rollovers Complete:", i, Math.random().toString())
            const { unsealedSeed, sealedSeed } = getSeeds(Math.random().toString(), trustedSeeder.address)
            await rolloverRound(PLAINS)

            await summitTrustedSeederMethod.receiveSealedSeed({
                trustedSeeder,
                sealedSeed,
            })
            await mineBlock()
            await summitTrustedSeederMethod.receiveUnsealedSeed({
                trustedSeeder,
                unsealedSeed,
            })
        }

        const historicalStats = await elevationHelperGet.historicalTotemStats(PLAINS)
        console.log({
            totemWinsCounters: historicalStats.totemWinCounters
        })
    })
    it('MESA RANDOMNESS: Verify mesa randomness', async function () {
        if (!RUN_RNG_SIMS) {
            console.log("Skip Sims")
            return
        }
        const { trustedSeeder } = await mesaUnlockedFixture()

        for (let i = 0; i < 1000; i++) {
            if (i % 50 == 0) console.log("Rollovers Complete:", i, Math.random().toString())
            const { unsealedSeed, sealedSeed } = getSeeds(Math.random().toString(), trustedSeeder.address)
            await rolloverRound(MESA)

            await summitTrustedSeederMethod.receiveSealedSeed({
                trustedSeeder,
                sealedSeed,
            })
            await mineBlock()
            await summitTrustedSeederMethod.receiveUnsealedSeed({
                trustedSeeder,
                unsealedSeed,
            })
        }

        const historicalStats = await elevationHelperGet.historicalTotemStats(MESA)
        console.log({
            totemWinsCounters: historicalStats.totemWinCounters
        })
    })
    it('SUMMIT RANDOMNESS: Verify summit randomness', async function () {
        if (!RUN_RNG_SIMS) {
            console.log("Skip Sims")
            return
        }
        const { trustedSeeder } = await summitUnlockedFixture()

        for (let i = 0; i < 1000; i++) {
            if (i % 50 == 0) console.log("Rollovers Complete:", i, Math.random().toString())
            const { unsealedSeed, sealedSeed } = getSeeds(Math.random().toString(), trustedSeeder.address)
            await rolloverRound(SUMMIT)

            await summitTrustedSeederMethod.receiveSealedSeed({
                trustedSeeder,
                sealedSeed,
            })
            await mineBlock()
            await summitTrustedSeederMethod.receiveUnsealedSeed({
                trustedSeeder,
                unsealedSeed,
            })
        }

        const historicalStats = await elevationHelperGet.historicalTotemStats(SUMMIT)
        console.log({
            totemWinsCounters: historicalStats.totemWinCounters
        })
    })
})