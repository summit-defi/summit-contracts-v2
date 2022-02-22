import { ethers, run } from "hardhat";
import { e18, failableVerify, notHardhat, toDecimal } from "../utils";
import erc20Abi from '../data/abi/ERC20.json'
import { Contract } from "ethers";




const logState = async (passthroughContract: Contract) => {
    const passthroughBalance = await passthroughContract.balance()
    const passthroughVaultBalance = await passthroughContract.vaultBalance()
    const passthroughPricePerFullShare = await passthroughContract.getPricePerFullShare()

    console.log({
        balance: toDecimal(passthroughBalance),
        vaultBalance: toDecimal(passthroughVaultBalance),
        pricePerFullShare: toDecimal(passthroughPricePerFullShare),
    })
}


const main = async () => {
    const { dev, user1, user2 } = await ethers.getNamedSigners()
    const yieldWolfAddress = '0x876f890135091381c23be437fa1cec2251b7c117'
    const ftm2OmbAddress = '0xbdC7DFb7B88183e87f003ca6B5a2F81202343478'
    const pid = 227

    const passthroughFactory = await ethers.getContractFactory('YieldWolfPassthrough')
    const constructorArguments = [
        user2.address,      // Cartographer
        yieldWolfAddress,   // Yield Wolf Master Chef
        pid,                // 2OMB-FTM pid
        ftm2OmbAddress      // 2OMB-FTM lp token address
    ]

    await run("compile")

    const passthroughContract = await passthroughFactory.connect(dev).deploy(
        ...constructorArguments, {
            gasLimit: 5000000,
        }
    )
    if (await notHardhat()) {
        await passthroughContract.deployTransaction.wait(5)
    }
    await failableVerify({
        address: passthroughContract.address,
        constructorArguments,
    })

    const ftm2OmbContract = await ethers.getContractAt(erc20Abi, ftm2OmbAddress, user2)

    await logState(passthroughContract)

    // Send 2OMB-FTM to user2
    const send1tx = await ftm2OmbContract.connect(user1).transfer(user2.address, e18(0.5), { gasLimit: 2000000 })
    await send1tx.wait(5)
    await logState(passthroughContract)


    
    // Pre-approve passthrough from 'Cartographer' (user2)
    const approveTx = await ftm2OmbContract.connect(user2).approve(passthroughContract.address, e18(10), { gasLimit: 2000000 })
    await approveTx.wait(5)
    await logState(passthroughContract)

    // Enact passthrough, should transfer 0.5 LP from user2 to passthrough
    const enactTx = await passthroughContract.connect(user2).enact({ gasLimit: 2000000 })
    await enactTx.wait(5)
    await logState(passthroughContract)

    // Send more LP to deposit
    const send2Tx = await ftm2OmbContract.connect(user1).transfer(user2.address, e18(0.75), { gasLimit: 2000000 })
    await send2Tx.wait(5)
    await logState(passthroughContract)

    // Deposit, should pull in 0.75 more
    const depositTx = await passthroughContract.connect(user2).deposit(e18(0.75), user2.address, user2.address, user2.address, { gasLimit: 2000000 })
    await depositTx.wait(5)
    await logState(passthroughContract)

    // Withdraw, should pull out 0.9 more
    const withdraw = await passthroughContract.connect(user2).withdraw(e18(0.9), user1.address, user1.address, user1.address, { gasLimit: 2000000 })
    await withdraw.wait(5)
    await logState(passthroughContract)

    // Retire, should pull out remaining 0.35
    const retireTx = await passthroughContract.connect(user2).retire(user1.address, user1.address, user1.address, { gasLimit: 2000000 })
    await retireTx.wait(5)
    await logState(passthroughContract)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });