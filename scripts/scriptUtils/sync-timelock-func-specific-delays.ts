import { getTimelock, promiseSequenceMap, queueTimelockTransaction } from "../../utils"
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
            console.log({
                sigSpecificContract,
                sig,
                delaySeconds: `${delaySeconds / (3600 * 24)} DAYS`
            })

            await queueTimelockTransaction({
                dryRun: false,
                note: `Set Function Specific Delay: ${sigSpecificContract}:${sig} - ${delaySeconds / (3600 * 24)}D`,

                timelock,
                targetContract: timelock,
                txName: TimelockTxSig.Timelock.SetFunctionSpecificDelay,
                txParams: [sig, delaySeconds]
            })
        }
    )
}