import { expect } from "chai"
import { Contract } from "ethers"

export const executeTx = async (tx: any, txArgs: any[]) => {
    await tx(...txArgs)
}

export const executeTxExpectReversion = async (tx: any, txArgs: any[], revertErr: string) => {
    await expect(
        tx(...txArgs)
    ).to.be.revertedWith(revertErr)
}
export const executeTxExpectEvent = async (tx: any, txArgs: any[], contract: Contract, eventName: string, eventArgs?: any[]) => {
    if (eventArgs != null) {
        await expect(
            tx(...txArgs)
        ).to.emit(contract, eventName).withArgs(eventArgs)
    } else {
        await expect(
            tx(...txArgs)
        ).to.emit(contract, eventName)
    }
}