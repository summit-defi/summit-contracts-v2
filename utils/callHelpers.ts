import { expect } from "chai"
import { BigNumber, Contract } from "ethers"
import { expect6FigBigNumberEquals, sixFigBigNumberEquals, toDecimal } from "."

export const executeTx = async (tx: any, txArgs: any[]) => {
    await tx(...txArgs)
}

export const executeTxExpectReversion = async (tx: any, txArgs: any[], revertErr: string) => {
    await expect(
        tx(...txArgs)
    ).to.be.revertedWith(revertErr)
}
export const executeTxExpectEvent = async (tx: any, txArgs: any[], contract: Contract, eventName: string, eventArgs: any[] | null, requireExactBigNumberMatch: boolean) => {
    let transaction
    if (txArgs.length > 0) {
        transaction = await tx(...txArgs)
    } else {
        transaction = await tx()
    }
    const receipt = await transaction.wait()

    let emitted = false
    let emittedArgs = []
    for (const event of receipt.events) {
        if (event.event === eventName) {
            emitted = true;
            emittedArgs = event.args
        }
    }

    if (!emitted) {
        console.error(`EVENT NOT EMITTED: ${eventName}`)
    }

    if (eventArgs != null) {
        for (let argIndex = 0; argIndex < eventArgs.length; argIndex++) {
            if (!requireExactBigNumberMatch && BigNumber.isBigNumber(eventArgs[argIndex])) {
                if (!sixFigBigNumberEquals(eventArgs[argIndex], emittedArgs[argIndex])) {
                    console.log(`EVENT ARG MISMATCH, arg${argIndex}, ${toDecimal(eventArgs[argIndex])} ==? ${toDecimal(emittedArgs[argIndex])}`)
                }
                expect6FigBigNumberEquals(eventArgs[argIndex], emittedArgs[argIndex])
            } else {
                if (eventArgs[argIndex] != emittedArgs[argIndex]) {
                    if (BigNumber.isBigNumber(eventArgs[argIndex])) {
                        console.log(`EVENT ARG MISMATCH, arg${argIndex}, ${toDecimal(eventArgs[argIndex])} ==? ${toDecimal(emittedArgs[argIndex])}`)
                    } else {
                        console.log(`EVENT ARG MISMATCH, arg${argIndex}, ${eventArgs[argIndex]} ==? ${emittedArgs[argIndex]}`)
                    }
                }
                expect(eventArgs[argIndex]).to.equal(emittedArgs[argIndex])
            }
        }
    }
    expect(emitted).to.be.true
}