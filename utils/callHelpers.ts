import { expect } from "chai"
import { BigNumber, Contract } from "ethers"
import { expect6FigBigNumberEquals, toDecimal } from "."

export const executeTx = async (tx: any, txArgs: any[]) => {
    await tx(...txArgs)
}

export const executeTxExpectReversion = async (tx: any, txArgs: any[], revertErr: string) => {
    await expect(
        tx(...txArgs)
    ).to.be.revertedWith(revertErr)
}
export const executeTxExpectEvent = async (tx: any, txArgs: any[], contract: Contract, eventName: string, eventArgs: any[] | null, requireExactBigNumberMatch: boolean) => {
    const transaction = await tx(...txArgs)
    const receipt = await transaction.wait()

    let emitted = false
    let emittedArgs = []
    for (const event of receipt.events) {
        if (event.event === eventName) {
            emitted = true;
            emittedArgs = event.args
        }
    }

    if (eventArgs != null) {
        for (let argIndex = 0; argIndex < eventArgs.length; argIndex++) {
            if (!requireExactBigNumberMatch && BigNumber.isBigNumber(eventArgs[argIndex])) {
                console.log("ArgIndex", argIndex, toDecimal(eventArgs[argIndex]), "==?", toDecimal(emittedArgs[argIndex]))
                expect6FigBigNumberEquals(eventArgs[argIndex], emittedArgs[argIndex])
            } else {
                expect(eventArgs[argIndex]).to.equal(emittedArgs[argIndex])
            }
        }
    }

    if (!emitted) {
        console.error(`EVENT NOT EMITTED: ${eventName}`)
    }
    expect(emitted).to.be.true
}