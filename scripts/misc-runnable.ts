import inquirer from 'inquirer'
import { ethers, getChainId } from "hardhat";
import { getPoolConfigs } from "../data";
import { cartographerMethod, cartographerSetParam, elevationHelperMethod, expeditionMethod, MESA, PLAINS, SUMMIT } from "../utils";
import { syncPools, syncTimelockFunctionSpecificDelays } from "./scriptUtils";

enum MiscRunnable {
    SyncTimelockFunctionSpecificDelays = 'SyncTimelockFunctionSpecificDelays',
    SyncPools = 'SyncPools',
    RecalculateExpeditionEmissions = 'RecalculateExpeditionEmissions',
    UpdateElevationRoundDurations = 'UpdateElevationRoundDurations',
    SetBaseMinimumWithdrawalTax = 'SetBaseMinimumWithdrawalTax',
}

// CONFIGS
const runnable: MiscRunnable = MiscRunnable.SetBaseMinimumWithdrawalTax
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

    if (runnable === MiscRunnable.UpdateElevationRoundDurations) {
        await elevationHelperMethod.setElevationRoundDurationMult({
            dev,
            elevation: PLAINS,
            roundDurationMult: 4,
            callAsTimelock: timelock,
            dryRun,
        })
        await elevationHelperMethod.setElevationRoundDurationMult({
            dev,
            elevation: MESA,
            roundDurationMult: 8,
            callAsTimelock: timelock,
            dryRun,
        })
        await elevationHelperMethod.setElevationRoundDurationMult({
            dev,
            elevation: SUMMIT,
            roundDurationMult: 8,
            callAsTimelock: timelock,
            dryRun,
        })
    }



    if (runnable === MiscRunnable.SetBaseMinimumWithdrawalTax) {
        await cartographerSetParam.setBaseMinimumWithdrawalTax({
            dev,
            baseMinimumWithdrawalTax: 50,
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
