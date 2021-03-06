import inquirer from 'inquirer'
import { ethers, getChainId, run } from "hardhat";
import { getPoolConfigs } from "../data";
import { cartographerMethod, cartographerSetParam, elevationHelperMethod, expeditionMethod, failableVerify, getCartographer, MESA, PLAINS, SUMMIT, summitTrustedSeederMethod, writeContractAddresses } from "../utils";
import { syncPools, syncTimelockFunctionSpecificDelays, transferContractOwnershipToTimelock } from "./scriptUtils";

enum MiscRunnable {
    OneOff = 'OneOff',
    SyncTimelockFunctionSpecificDelays = 'SyncTimelockFunctionSpecificDelays',
    SyncPools = 'SyncPools',
    RecalculateExpeditionEmissions = 'RecalculateExpeditionEmissions',
    UpdateElevationRoundDurations = 'UpdateElevationRoundDurations',
    SetBaseMinimumWithdrawalTax = 'SetBaseMinimumWithdrawalTax',
    RetireTokenPassthroughStrategies = 'RetireTokenPassthroughStrategies',
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

    if (runnable === MiscRunnable.OneOff) {
        // QUEUE TRUSTED SEEDER UPDATE
        await summitTrustedSeederMethod.setTrustedSeederAdd({
            dev,
            trustedSeeder: '0xC2a1c87162acC85Dd25bE1bCbF0b9d45E891229f',
            callAsTimelock: timelock,
            dryRun,
        })


        // VERIFY PASSTHROUGH
        // const cartographer = await getCartographer()
        // await failableVerify({
        //     address: '0xB267C40183af6804ca9C5BdceB2B0C338A0b6eB8',
        //     constructorArguments: [cartographer.address, '0x876F890135091381c23Be437fA1cec2251B7c117', 205, '0x4Fe6f19031239F105F753D1DF8A0d24857D0cAA2']
        // })

        // TRANSFER OWNERSHIP TO TIMELOCK
        // await transferContractOwnershipToTimelock()

        // // DEPLOY MULTICALL
        // await run("compile")
        // const chainId = await getChainId()
        // const multicallFactory = await ethers.getContractFactory('Multicall')
        // const multicallContract = await multicallFactory.connect(dev).deploy()
        // await multicallContract.deployTransaction.wait(10)
        // await failableVerify({
        //     address: multicallContract.address,
        //     constructorArguments: [],
        // })
        // writeContractAddresses(chainId, [
        //     ['multicall', multicallContract.address]
        // ])

    }

    if (runnable === MiscRunnable.SyncTimelockFunctionSpecificDelays) {
        await syncTimelockFunctionSpecificDelays() 
    }

    if (runnable === MiscRunnable.SyncPools) {
        const chainId = await getChainId()
        const mainnetPools = getPoolConfigs(chainId)
        await syncPools({
            poolConfigs: mainnetPools,
            callAsTimelock: timelock,
            dryRun,
            // specificPools: ['LQDR-FTM'],
        })
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
            roundDurationMult: 2,
            callAsTimelock: timelock,
            dryRun,
        })
        await elevationHelperMethod.setElevationRoundDurationMult({
            dev,
            elevation: MESA,
            roundDurationMult: 2,
            callAsTimelock: timelock,
            dryRun,
        })
        await elevationHelperMethod.setElevationRoundDurationMult({
            dev,
            elevation: SUMMIT,
            roundDurationMult: 2,
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


    if (runnable === MiscRunnable.RetireTokenPassthroughStrategies) {
        // await cartographerMethod.retireTokenPassthroughStrategy({
        //     dev,
        //     tokenAddress: '0x5804F6C40f44cF7593F73cf3aa16F7037213A623',
        //     callAsTimelock: timelock,
        //     dryRun,
        //     tokenSymbol: 'BOO-xBOO'
        // })
        // await cartographerMethod.retireTokenPassthroughStrategy({
        //     dev,
        //     tokenAddress: '0xbcab7d083Cf6a01e0DdA9ed7F8a02b47d125e682',
        //     callAsTimelock: timelock,
        //     dryRun,
        //     tokenSymbol: 'USDC-MIM'
        // })
        // await cartographerMethod.retireTokenPassthroughStrategy({
        //     dev,
        //     tokenAddress: '0x6F607443DC307DCBe570D0ecFf79d65838630B56',
        //     callAsTimelock: timelock,
        //     dryRun,
        //     tokenSymbol: 'FTM-BSHARE'
        // })
        // await cartographerMethod.retireTokenPassthroughStrategy({
        //     dev,
        //     tokenAddress: '0xaB2ddCBB346327bBDF97120b0dD5eE172a9c8f9E',
        //     callAsTimelock: timelock,
        //     dryRun,
        //     tokenSymbol: 'TOMB-BASED'
        // })
    }


};

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
