import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { BigNumber } from "ethers"
import { executeTx, executeTxExpectEvent, executeTxExpectReversion, getSummitToken, getSummitTrustedSeeder } from "."

export const summitTokenGet = {
    oldSummit: async (): Promise<string> => {
        return await (await getSummitTrustedSeeder()).oldSummit()
    },
    swapRatio: async (): Promise<number> => {
        return (await (await getSummitTrustedSeeder()).swapRatio()).toNumber()
    },
}

export const summitTokenMethod = {
    initialize: async ({
        dev,
        oldSummitAddress,
        revertErr,
    }: {
        dev: SignerWithAddress,
        oldSummitAddress: string,
        revertErr?: string,
    }) => {
        const summitToken = await getSummitToken()
        const tx = summitToken.connect(dev).initialize
        const txArgs = [oldSummitAddress]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            await executeTx(tx, txArgs)
        }
    },
    tokenSwap: async ({
        user,
        oldSummitAmount,
        revertErr,
    }: {
        user: SignerWithAddress,
        oldSummitAmount: BigNumber,
        revertErr?: string,
    }) => {
        const summitToken = await getSummitToken()
        const tx = summitToken.connect(user).tokenSwap
        const txArgs = [oldSummitAmount]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [user.address, oldSummitAmount, oldSummitAmount.div(10)]
            await executeTxExpectEvent(tx, txArgs, summitToken, 'SummitTokenSwap', eventArgs, true)
        }
    },
}