import { getMatchingTimelockedTransaction, getTimelock, getTimestamp, promiseSequenceMap, queueTimelockTransaction } from "../../utils"
import { TimelockTxSig, TimelockTxSigSpecificDelay } from "../../utils/timelockConstants"






export const syncTimelockFunctionSpecificDelays = async () => {
    const timelock = await getTimelock()

    let sigSpecificDelays: Array<{ sigSpecificContract: string, sig: string, delaySeconds: number }> = []

    Object.keys(TimelockTxSigSpecificDelay).forEach(async (sigSpecificContract) => {
        Object.keys(TimelockTxSigSpecificDelay[sigSpecificContract]).forEach(async (sig) => {
            const delay = TimelockTxSigSpecificDelay[sigSpecificContract][sig]
            if (delay == null) return
            const delaySeconds = delay * 3600
            sigSpecificDelays.push({
                sigSpecificContract,
                sig,
                delaySeconds
            })
        })
    })

    await promiseSequenceMap(
        sigSpecificDelays,
        async ({ sigSpecificContract, sig, delaySeconds }) => {
            const txNote = `Set Function Specific Delay: ${sigSpecificContract}:${sig} - ${delaySeconds / (3600 * 24)}D`
            console.log(`\n\t- ${txNote} -`)

            const params = {
                dryRun: false,
                note: `Set Function Specific Delay: ${sigSpecificContract}:${sig} - ${delaySeconds / (3600 * 24)}D`,

                timelock,
                targetContract: timelock,
                txName: TimelockTxSig.Timelock.SetFunctionSpecificDelay,
                txParams: [sig, delaySeconds]
            }

            const matchingTx = await getMatchingTimelockedTransaction(params)

            if (matchingTx == null) {
                await queueTimelockTransaction(params)
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
        }
    )
}