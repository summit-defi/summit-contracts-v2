import { ethers, network, run } from "hardhat";
import { cartographerGet, cartographerMethod, Contracts, e18, emptyHardhatTimelockTransactions, erc20Get, erc20Method, executeQueuedTimelockTransactionByHash, failableVerify, getCartographer, getTokenBalance, mineBlockWithTimestamp, notHardhat, ownableMethod, promiseSequenceMap, toDecimal, toFixedDecimal, ZEROADD } from "../utils";
import erc20Abi from '../data/abi/ERC20.json'
import { Contract } from "ethers";
import yieldWolfAbi from './scriptUtils/yieldWolfAbi.json'


    // // Deploy Yield Wolf Passthrough V1 with comments
    // const yieldWolfPassthroughV1Factory = await ethers.getContractFactory('YieldWolfPassthroughV1')
    // const yieldWolfPassthroughV1ConstructorArgs = [
    //     cartographer.address,      // Cartographer
    //     yieldWolfAddress,            
    //     pid,                  
    //     token        // FTM-BSHARE lp token address
    // ]
    
    // const yieldWolfPassthroughV1wCommentsContract = await yieldWolfPassthroughV1Factory.connect(dev).deploy(
    //     ...yieldWolfPassthroughV1ConstructorArgs, {
    //         gasLimit: 5000000,
    //     }
    // )
    // await yieldWolfPassthroughV1wCommentsContract.deployed()

    // const ywV1wCommentsCode = await network.provider.send("eth_getCode", [
    //     yieldWolfPassthroughV1wCommentsContract.address,
    // ]);

    
    // // Update code of passthroughV1
    // await network.provider.send("hardhat_setCode", [
    //     yieldWolfPassthroughV1,
    //     ywV1wCommentsCode,
    // ]);

const giveFtm = async (add: string) => {
    await network.provider.send("hardhat_setBalance", [
        add,
        "0x56BC75E2D63100000",
    ]);
}
const impersonate = async (add: string) => {
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [add],
    });
    return await ethers.getSigner(add)
}

const main = async () => {
    await run("compile")
    emptyHardhatTimelockTransactions('31337')

    const { dev, user1 } = await ethers.getNamedSigners()
    const cartographer = await getCartographer()
    const expedTreasury = await cartographer.expeditionTreasuryAdd();
    const treasury = await cartographer.treasuryAdd();
    const lpGenerator = await cartographer.lpGeneratorAdd();
    const yieldWolfAddress = '0x876f890135091381c23be437fa1cec2251b7c117'
    const yieldWolfContract = await ethers.getContractAt(yieldWolfAbi, yieldWolfAddress)


    // PREP CONTRACTS

    // Transfer cart ownership
    const { eta, txHash } = await ownableMethod.transferOwnership({
        dev,
        contractName: Contracts.Cartographer,
        newOwnerAddress: dev.address,
        callAsTimelock: true,
    }) || {}
    console.log({
        eta, txHash
    })

    if (eta == null || txHash == null) throw new Error('TRANSFER OWNERSHIP NOT QUEUED')

    await mineBlockWithTimestamp(eta + 60)
    await executeQueuedTimelockTransactionByHash(txHash)

    // Update code of cartographer
    const cartWithCommentsFactory = await ethers.getContractFactory('Cartographer')
    
    const cartWithCommentsContract = await cartWithCommentsFactory.connect(dev).deploy(
        treasury,
        expedTreasury,
        lpGenerator
    )
    await cartWithCommentsContract.deployed()

    const cartWithCommentsCode = await network.provider.send("eth_getCode", [
        cartWithCommentsContract.address,
    ]);
    await network.provider.send("hardhat_setCode", [
        cartographer.address,
        cartWithCommentsCode,
    ]);







    const migrations = [
        {
            symbol: 'FTM-BSHARE',
            token: '0x6F607443DC307DCBe570D0ecFf79d65838630B56',
            donor: '0x26d181a3c313B6122a1BEB7A1ebd6c2682CD9e3c',
            donorAmount: e18(10),
            iterations: 60,
            pid: 359,
            stakedUSD: 35000
        },
        {
            symbol: 'TOMB-BASED',
            token: '0xaB2ddCBB346327bBDF97120b0dD5eE172a9c8f9E',
            donor: '0x5653973e4647453eceeb3a0e9fbb6df85df64a42',
            donorAmount: e18(1200),
            iterations: 50,
            pid: 358,
            stakedUSD: 35000
        },
        {
            symbol: 'BOO-xBOO',
            token: '0x5804F6C40f44cF7593F73cf3aa16F7037213A623',
            donor: '0x800af106e83b49ae1168d44ce51e9d3f98a3347a',
            donorAmount: e18(169),
            iterations: 5,
            pid: 431,
            stakedUSD: 250000
        },
        {
            symbol: 'USDC-MIM',
            token: '0xbcab7d083Cf6a01e0DdA9ed7F8a02b47d125e682',
            donor: '0xf930b0a0500d8f53b2e7efa4f7bcb5cc0c71067e',
            donorAmount: e18(0.05),
            iterations: 3,
            pid: 419,
            stakedUSD: 550000
        },
    ]




    await promiseSequenceMap(
        migrations,
        async ({ symbol, token, donor, donorAmount, iterations, pid, stakedUSD }) => {

            console.log(`\n========= MIGRATE TOKEN: ${symbol} =========\n`)

            // Get Token contract
            const tokenContract = await erc20Get.tokenContract({ token })
            const tokenBalance = async (add: string) => await getTokenBalance(tokenContract, add)




            // Fill USER1 balance with token
            await giveFtm(donor)
            const donorSigner = await impersonate(donor)
            await tokenContract.connect(donorSigner).transfer(user1.address, donorAmount)

            const user1BalInit = await tokenBalance(user1.address)
            console.log(`${symbol} Transferred to user, userBal`, toFixedDecimal(user1BalInit))


            // Get Existing YieldWolfPassthrough
            const yieldWolfPassthroughV1 = await cartographerGet.tokenPassthroughStrategy(token)
            const yieldWolfPassthroughV1Contract = await ethers.getContractAt('YieldWolfPassthroughV1', yieldWolfPassthroughV1)

            // Deploy Yield Wolf Migrator
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

            console.log(`${symbol} Yield Wolf Migrator Deployed`, yieldWolfMigratorAdd)






            // Initial recovery swap - Drop balance in yieldWolfPassthroughV1 and enable the target token to be distributed to treasuries
            const initStaked = await yieldWolfContract.stakedTokens(pid, yieldWolfPassthroughV1)
            await cartographerMethod.setTokenPassthroughStrategy({
                dev,
                tokenAddress: token,
                passthroughTargetAddress: yieldWolfMigratorAdd,
            })
            const migratorRescued = await tokenBalance(yieldWolfMigratorContract.address)
            console.log(`${symbol} Initial migration completed`)






            // Iterative recovery
            console.log(`${symbol} Stuck Funds Recovery Progress`)
            let prevRescued = e18(0)
            await promiseSequenceMap(
                [...new Array(iterations)],
                async (_, index) => {
                    await cartographerMethod.setTokenPassthroughStrategy({
                        dev,
                        tokenAddress: token,
                        passthroughTargetAddress: yieldWolfPassthroughV1
                    })
                    const expedBalance = await tokenBalance(expedTreasury)
                    const treasuryBalance = await tokenBalance(treasury)
                    const lpGenBalance = await tokenBalance(lpGenerator)
                    const rescued = migratorRescued.add(expedBalance).add(treasuryBalance).add(lpGenBalance)
                    console.log(`\tIter ${index}, initStuck: ${toFixedDecimal(initStaked)}, rescued: ${toFixedDecimal(rescued)}, %rescuedThisIter: ${rescued.sub(prevRescued).mul(10000).div(initStaked).toNumber() / 100}%, usdRescuedThisIter: $${rescued.sub(prevRescued).mul(stakedUSD).div(initStaked)}`)
                    prevRescued = rescued
                }
            )

            const vaultBalance = await yieldWolfPassthroughV1Contract.vaultBalance()
            console.log(`${symbol} Stuck funds Remaining`, toDecimal(vaultBalance))


            const expedBalance = await tokenBalance(expedTreasury)
            const treasuryBalance = await tokenBalance(treasury)
            const lpGenBalance = await tokenBalance(lpGenerator)
            console.log(`${symbol} Recovered`, toDecimal(migratorRescued.add(expedBalance).add(treasuryBalance).add(lpGenBalance)))





            // Retire existing passthrough
            await cartographerMethod.retireTokenPassthroughStrategy({
                dev,
                tokenAddress: token,
            })





            // Finalize migrate passthrough all funds to cartographer
            const cartBalancePreFinalization = await tokenBalance(cartographer.address)
            await yieldWolfMigratorContract.connect(dev).finalizeMigration()
            const cartBalanceAfterFinalization = await tokenBalance(cartographer.address)






            // Send funds back to cartographer
            await promiseSequenceMap(
                [treasury, expedTreasury, lpGenerator],
                async (add) => {
                    await network.provider.request({
                        method: "hardhat_impersonateAccount",
                        params: [add],
                    });
                    const signer = await ethers.getSigner(add)
                    const bal = await tokenBalance(add)
                    await tokenContract.connect(signer).transfer(cartographer.address, bal)
                }
            )
            const cartBalanceAfterRefill = await tokenBalance(cartographer.address)

            console.log({
                symbol,
                cartBalFinalization: `${toFixedDecimal(cartBalancePreFinalization)} --> ${toFixedDecimal(cartBalanceAfterFinalization)}`,
                cartBalRefill: `${toFixedDecimal(cartBalanceAfterFinalization)} --> ${toFixedDecimal(cartBalanceAfterRefill)}`,
            })






            // Create V2 passthrough
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






            // Enact fixed yield wolf passthrough
            await cartographerMethod.setTokenPassthroughStrategy({
                dev,
                tokenAddress: token,
                passthroughTargetAddress: yieldWolfPassthroughV2Contract.address
            })

            const cartPassthroughAdd = await cartographerGet.tokenPassthroughStrategy(token)
            const v2Balance = await yieldWolfPassthroughV2Contract.balance()
            const v2VaultBalance = await yieldWolfPassthroughV2Contract.vaultBalance()
            const v2StakedTokens = await yieldWolfContract.stakedTokens(pid, yieldWolfPassthroughV2Contract.address)
            console.log({
                symbol,
                v2Contract: yieldWolfPassthroughV2Contract.address,
                cartPassthroughAdd,
                v2Balance: toFixedDecimal(v2Balance),
                v2VaultBalance: toFixedDecimal(v2VaultBalance),
                v2StakedTokens: toFixedDecimal(v2StakedTokens),
            })







            // Validate deposit / withdraw
            await tokenContract.connect(user1).approve(cartographer.address, donorAmount)
            await cartographerMethod.deposit({
                user: user1,
                tokenAddress: token,
                elevation: 0,
                amount: donorAmount.div(2),
            })
            const user1BalMid = await tokenBalance(user1.address)
            const v2VaultBalanceMid = await yieldWolfPassthroughV2Contract.vaultBalance()
            await cartographerMethod.withdraw({
                user: user1,
                tokenAddress: token,
                elevation: 0,
                amount: donorAmount.div(2),
                eventOnly: true,
            })
            const user1BalFinal = await tokenBalance(user1.address)
            const v2VaultBalanceFinal = await yieldWolfPassthroughV2Contract.vaultBalance()


            console.log({
                symbol,
                user1Bal: `${toFixedDecimal(user1BalInit)} --> ${toFixedDecimal(user1BalMid)} --> ${toFixedDecimal(user1BalFinal)}`,
                passthroughBal: `${toFixedDecimal(v2VaultBalance)} --> ${toFixedDecimal(v2VaultBalanceMid)} --> ${toFixedDecimal(v2VaultBalanceFinal)}`
            })






            // Validate V2 retire
            const cartBeforeRetire = await tokenBalance(cartographer.address)
            await cartographerMethod.retireTokenPassthroughStrategy({
                dev,
                tokenAddress: token
            })
            const cartAfterRetire = await tokenBalance(cartographer.address)
            const v2VaultBalanceAfterRetire = await yieldWolfPassthroughV2Contract.vaultBalance()
            console.log({
                symbol,
                cartBal: `${toFixedDecimal(cartBeforeRetire)} --> ${toFixedDecimal(cartAfterRetire)}`,
                passthroughBal: `${toFixedDecimal(v2VaultBalanceFinal)} --> ${toFixedDecimal(v2VaultBalanceAfterRetire)}`
            })


        }
    )

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });