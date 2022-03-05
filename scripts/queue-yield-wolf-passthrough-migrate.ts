import { ethers, getChainId, run } from "hardhat";
import inquirer from "inquirer";
import { cartographerGet, cartographerMethod, e18, emptyHardhatTimelockTransactions, failableVerify, getCartographer, promiseSequenceMap, ZEROADD } from "../utils";


const dryRun = false





const main = async () => {
    await run("compile")
    const chainId = await getChainId()
    emptyHardhatTimelockTransactions(chainId)


    const { dev } = await ethers.getNamedSigners()
    const cartographer = await getCartographer()
    const yieldWolfAddress = '0x876f890135091381c23be437fa1cec2251b7c117'




    const migrations = [
        {
            symbol: 'FTM-BSHARE',
            token: '0x6F607443DC307DCBe570D0ecFf79d65838630B56',
            donor: '0x26d181a3c313B6122a1BEB7A1ebd6c2682CD9e3c',
            donorAmount: e18(10),
            iterations: 60,
            pid: 359,
            stakedUSD: 35000,
            deployedMigrationPassthrough: '0xAd63a8a68179c54E0a5aCC290eB594c0e8D00dbe',
            deployedPassthroughV2: '0xbA74A5C08Ee6B8D63Cd51A80D236602637feBB71',
            iterationsQueued: 60,
        },
        {
            symbol: 'TOMB-BASED',
            token: '0xaB2ddCBB346327bBDF97120b0dD5eE172a9c8f9E',
            donor: '0x5653973e4647453eceeb3a0e9fbb6df85df64a42',
            donorAmount: e18(1200),
            iterations: 50,
            pid: 358,
            stakedUSD: 35000,
            deployedMigrationPassthrough: '0xC32E6A91D5E37d216C31775250eC075f650948f7',
            deployedPassthroughV2: '0x65810243e044a532272994856643078E65ef9611',
            iterationsQueued: 50,
        },
        {
            symbol: 'BOO-xBOO',
            token: '0x5804F6C40f44cF7593F73cf3aa16F7037213A623',
            donor: '0x800af106e83b49ae1168d44ce51e9d3f98a3347a',
            donorAmount: e18(169),
            iterations: 5,
            pid: 431,
            stakedUSD: 250000,
            deployedMigrationPassthrough: '0x27bCB37D21ce55c203b28Cf2120394fafA480A5d',
            deployedPassthroughV2: '0x77bF5EBc3912a091E1cDceF9041Dffe7b8639BC8',
            iterationsQueued: 5,
        },
        {
            symbol: 'USDC-MIM',
            token: '0xbcab7d083Cf6a01e0DdA9ed7F8a02b47d125e682',
            donor: '0xf930b0a0500d8f53b2e7efa4f7bcb5cc0c71067e',
            donorAmount: e18(0.05),
            iterations: 3,
            pid: 419,
            stakedUSD: 550000,
            deployedMigrationPassthrough: '0xdf663B7Ef52f188f167673533408C516d557ccEf',
            deployedPassthroughV2: '0x940a44Fe2b1c6BB0b21170995Fd9BD57b45a7CfA',
            iterationsQueued: 3,
        },
    ]




    await promiseSequenceMap(
        migrations,
        async ({ symbol, token, iterations, pid, deployedMigrationPassthrough, deployedPassthroughV2, iterationsQueued }) => {

            console.log(`\n========= QUEUE MIGRATE TOKEN: ${symbol} =========\n`)


            // Deploy Yield Wolf Migrator
            console.log(`${symbol} Deploy Yield Wolf Migrator`)

            let migrationPassthroughAdd: string

            if (deployedMigrationPassthrough == null) {
                const yieldWolfMigratorFactory = await ethers.getContractFactory('YieldWolfPassthroughV1toV2Migrator')
                const constructorArguments = [
                    cartographer.address,
                    ZEROADD,            
                    0,                  
                    token
                ]

                const yieldWolfMigratorContract = await yieldWolfMigratorFactory.connect(dev).deploy(
                    ...constructorArguments, {
                        gasLimit: 5000000,
                    }
                )
                await yieldWolfMigratorContract.deployed()
                const yieldWolfMigratorAdd = yieldWolfMigratorContract.address

                await failableVerify({
                    address: yieldWolfMigratorContract.address,
                    constructorArguments: constructorArguments
                })

                console.log(`${symbol} Yield Wolf Migrator Deployed`, yieldWolfMigratorAdd)

                await inquirer.prompt([
                    {
                        type: 'confirm',
                        message: `Migrator added to ${symbol} data? ${yieldWolfMigratorAdd}`,
                        name: 'ConfirmAdded',
                    },
                ])
                
                migrationPassthroughAdd = yieldWolfMigratorAdd
            } else {
                migrationPassthroughAdd = deployedMigrationPassthrough!
            }






            // Initial recovery swap - Drop balance in yieldWolfPassthroughV1 and enable the target token to be distributed to treasuries
            console.log(`${symbol} Initial migration Queue`)
            await cartographerMethod.setTokenPassthroughStrategy({
                dev,
                tokenAddress: token,
                passthroughTargetAddress: migrationPassthroughAdd,
                callAsTimelock: true,
                dryRun,
                tokenSymbol: symbol,
            })
            console.log(`${symbol} Initial migration queued`)






            // Iterative recovery
            console.log(`${symbol} Iterative Stuck Funds Recovery Queueing`)
            const existingYieldWolfPassthrough = await cartographerGet.tokenPassthroughStrategy(token)
            await promiseSequenceMap(
                [...new Array(iterations - iterationsQueued)],
                async (_, index) => {
                    await cartographerMethod.setTokenPassthroughStrategy({
                        dev,
                        tokenAddress: token,
                        passthroughTargetAddress: existingYieldWolfPassthrough,
                        callAsTimelock: true,
                        dryRun,
                        tokenSymbol: symbol,
                        queueEvenIfMatchingExists: true,
                    })
                    console.log(`ITERATION QUEUED: ${iterationsQueued + index}`)
                }
            )
            // Retire existing passthrough
            await cartographerMethod.retireTokenPassthroughStrategy({
                dev,
                tokenAddress: token,
                callAsTimelock: true,
                dryRun,
                tokenSymbol: symbol,
            })





            // Finalize migrate passthrough all funds to cartographer
            // TODO: Do this during execution:
            // await yieldWolfMigratorContract.connect(dev).finalizeMigration()









            // Deploy V2 passthrough
            let v2PassthroughAdd: string

            if (deployedPassthroughV2 == null) {
                const yieldWolfPassthroughV2Factory = await ethers.getContractFactory('YieldWolfPassthrough')
                const yieldWolfPassthroughV2ConstructorArgs = [
                    cartographer.address,
                    yieldWolfAddress,            
                    pid,                  
                    token
                ]
                
                const yieldWolfPassthroughV2Contract = await yieldWolfPassthroughV2Factory.connect(dev).deploy(
                    ...yieldWolfPassthroughV2ConstructorArgs, {
                        gasLimit: 5000000,
                    }
                )
                await yieldWolfPassthroughV2Contract.deployed()

                await failableVerify({
                    address: yieldWolfPassthroughV2Contract.address,
                    constructorArguments: yieldWolfPassthroughV2ConstructorArgs
                })

                console.log(`${symbol} Yield Wolf Passthrough V2 Deployed`, yieldWolfPassthroughV2Contract.address)

                await inquirer.prompt([
                    {
                        type: 'confirm',
                        message: `Passthrough V2 added to ${symbol} data? ${yieldWolfPassthroughV2Contract.address}`,
                        name: 'ConfirmAdded',
                    },
                ])
                
                v2PassthroughAdd = yieldWolfPassthroughV2Contract.address
            } else {
                v2PassthroughAdd = deployedPassthroughV2!
            }
            






            // Enact fixed yield wolf passthrough
            await cartographerMethod.setTokenPassthroughStrategy({
                dev,
                tokenAddress: token,
                passthroughTargetAddress: v2PassthroughAdd,
                callAsTimelock: true,
                dryRun,
                tokenSymbol: symbol,
            })


            console.log(`\n========= ${symbol} FINISHED ========\n`)
        }
    )

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });