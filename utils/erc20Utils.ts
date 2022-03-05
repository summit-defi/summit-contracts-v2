import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { BigNumber, Contract } from "ethers"
import { ethers } from "hardhat"
import { getSummitToken, getEverestToken, getCakeToken, getBifiToken, promiseSequenceMap, getContract, EVENT, executeTxExpectEvent, executeTxExpectReversion, executeTx, getUSDCToken, INF_APPROVE } from "."
import erc20 from '../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json'

export const getTokenBalance = async (token: Contract, add: string) => {
    return await token.balanceOf(add)
}
export const getSummitBalance = async (add: string) => {
    return (await (await getSummitToken()).balanceOf(add))
}
export const getEverestBalance = async (add: string) => {
    return (await (await getEverestToken()).balanceOf(add))
}
export const getUsdcBalance = async (add: string) => {
    return (await (await getUSDCToken()).balanceOf(add))
}
export const tokenPromiseSequenceMap = async (transformer: (element: Contract, index: number, array: Contract[]) => Promise<any>) => {
    const summitToken = await getSummitToken()
    const cakeToken = await getCakeToken()
    const bifiToken = await getBifiToken()
    return await promiseSequenceMap(
        [summitToken, cakeToken, bifiToken],
        async (user: Contract, index: number, array: Contract[]) => await transformer(user, index, array)
    )
}

export const erc20Get = {
    balanceOf: async ({
        token,
        balanceOf,
    }: {
        token: string,
        balanceOf: string,
    }) => {
        return await (await ethers.getContractAt(erc20.abi, token)).balanceOf(balanceOf)
    },
    tokenContract: async ({ token }: { token: string }) => {
        return await ethers.getContractAt(erc20.abi, token)
    }
}

export const erc20Method = {
    transfer: async ({
        user,
        tokenName,
        recipientAddress,
        amount,
        revertErr,
    }: {
        user: SignerWithAddress
        tokenName: string,
        recipientAddress: string,
        amount: BigNumber,
        revertErr?: string,
    }) => {
        const token = await getContract(tokenName)
        const tx = token.connect(user).transfer
        const txArgs = [recipientAddress, amount]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            await executeTxExpectEvent(tx, txArgs, token, 'Transfer', [user.address, recipientAddress, amount], true)
        }
    },
    approve: async ({
        user,
        tokenName,
        approvalAddress,
    }: {
        user: SignerWithAddress
        tokenName: string,
        approvalAddress: string,
    }) => {
        const token = await getContract(tokenName)
        const tx = token.connect(user).approve
        const txArgs = [approvalAddress, INF_APPROVE]
        
        await executeTx(tx, txArgs)
    },
    dummyMint: async ({
        user,
        tokenName,
        amount,
    }: {
        user: SignerWithAddress
        tokenName: string,
        amount: BigNumber,
    }) => {
        const token = await getContract(tokenName)
        const tx = token.connect(user).mint
        const txArgs = [user.address, amount]
        
        await executeTx(tx, txArgs)
    },
}