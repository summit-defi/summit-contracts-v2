import { getContract, getDelay, getMatchingTimelockedTransaction, getTimelock, getTimestamp, getTxSignatureBase, promiseSequenceMap, queueTimelockTransaction } from "../../utils"
import { TimelockTxSig, TimelockTxSigSpecificDelay } from "../../utils/timelockConstants"






export const syncTimelockFunctionSpecificDelays = async (dryRun = true) => {
    const timelock = await getTimelock()

    let sigSpecificDelays: Array<{ sigSpecificContractName: string, txName: string, delaySeconds: number }> = []

    Object.keys(TimelockTxSigSpecificDelay).forEach(async (sigSpecificContractName) => {
        Object.keys(TimelockTxSigSpecificDelay[sigSpecificContractName]).forEach(async (sig) => {
            const delay = TimelockTxSigSpecificDelay[sigSpecificContractName][sig]
            if (delay == null) return
            const delaySeconds = delay * 3600
            sigSpecificDelays.push({
                sigSpecificContractName,
                txName: sig,
                delaySeconds
            })
        })
    })

    await promiseSequenceMap(
        sigSpecificDelays,
        async ({ sigSpecificContractName, txName, delaySeconds }) => {
            const txNote = `Set Function Specific Delay: ${sigSpecificContractName}:${txName} - ${delaySeconds / (3600 * 24)}D`
            console.log(`\n\t- ${txNote} -`)

            const targetContract = await getContract(sigSpecificContractName)

            const txSignature = getTxSignatureBase({
                targetContract,
                txName: txName,
            })

            const existingDelay = await getDelay(
                timelock,
                txSignature,
            )

            // Early exit if delay is already in sync
            if (existingDelay === delaySeconds) {
                console.log(`\t\tDelay already synced: ${sigSpecificContractName}:${txName}, Delay: ${delaySeconds / (3600 * 24)}D`)
                return
            }

            const params = {
                dryRun,
                note: `Set Function Specific Delay: ${sigSpecificContractName}:${txName} - ${delaySeconds / (3600 * 24)}D`,

                timelock,
                targetContract: timelock,
                txName: TimelockTxSig.Timelock.SetFunctionSpecificDelay,
                txParams: [txSignature, delaySeconds]
            }

            const matchingTx = await getMatchingTimelockedTransaction(params)

            // If a matching transaction already exists, check and log if it has matured, early exit
            if (matchingTx != null) {
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

            // Queue the function specific delay
            await queueTimelockTransaction(params)
            console.log('\t\tqueued.')
        }
    )
}