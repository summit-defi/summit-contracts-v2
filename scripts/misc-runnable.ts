import inquirer from 'inquirer'
import { ethers, getChainId } from "hardhat";
import { getPoolConfigs } from "../data";
import { cartographerMethod, expeditionMethod } from "../utils";
import { syncPools, syncTimelockFunctionSpecificDelays } from "./scriptUtils";

enum MiscRunnable {
    SyncTimelockFunctionSpecificDelays = 'SyncTimelockFunctionSpecificDelays',
    SyncPools = 'SyncPools',
    RecalculateExpeditionEmissions = 'RecalculateExpeditionEmissions',
}

// CONFIGS
const runnable: MiscRunnable = MiscRunnable.RecalculateExpeditionEmissions
const timelock = true
const dryRun = false


async function main() {
    const { dev } = await ethers.getNamedSigners()

    // CONFIRM ACTION
    const runnableConfirmed = (await inquirer.prompt([
        {
            type: 'confirm',
            message: `${runnable}${timelock ? ` - Call as ${dryRun ? 'DRY RUN ' : ''}Timelock` : ''}`,
            name: 'ConfirmRunnable',
        },
    ])).ConfirmRunnable

    if (!runnableConfirmed) {
        console.log('Tx Not Confirmed, Exiting')
        return
    }

    if (runnable === MiscRunnable.SyncTimelockFunctionSpecificDelays) {
        await syncTimelockFunctionSpecificDelays() 
    }

    if (runnable === MiscRunnable.SyncPools) {
        const chainId = await getChainId()
        const mainnetPools = getPoolConfigs(chainId)
        await syncPools(mainnetPools, timelock, dryRun)
    }

    if (runnable === MiscRunnable.RecalculateExpeditionEmissions) {
        await expeditionMethod.recalculateExpeditionEmissions({
            dev,
            callAsTimelock: timelock,
            dryRun,
        })
    }


};

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
