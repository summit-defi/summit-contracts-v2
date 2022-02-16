import { expect } from "chai"
import { BigNumber, Contract } from "ethers"
import { getChainId } from "hardhat"
import { chainIdIsMainnet, delay, EVENT, expect6FigBigNumberEquals, hardhatChainId, notHardhat, sixFigBigNumberEquals, toDecimal, txWaitCount } from "."

export const executeTx = async (tx: any, txArgs: any[]) => {
    const transaction = await tx(...txArgs)
    const waitCount = await txWaitCount()
    await transaction.wait(waitCount)
    if ((await getChainId()) !== hardhatChainId) await delay(5000)
    return transaction
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
    const waitCount = await txWaitCount()
    const receipt = await transaction.wait(waitCount)
    if ((await getChainId()) !== hardhatChainId) await delay(5000)

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
    expect(emitted).to.be.true

    if (eventArgs != null) {
        for (let argIndex = 0; argIndex < eventArgs.length; argIndex++) {

            // Test BigNumber match
            if (BigNumber.isBigNumber(eventArgs[argIndex])) {

                // If BigNumbers must match exactly
                if (requireExactBigNumberMatch) {
                    if (!eventArgs[argIndex].eq(emittedArgs[argIndex])) {
                        console.log(`EVENT ARG MISMATCH, arg${argIndex}, ${toDecimal(eventArgs[argIndex])} ==? ${toDecimal(emittedArgs[argIndex])}`)
                    }
                    expect(eventArgs[argIndex]).to.equal(emittedArgs[argIndex])

                // BigNumbers only need 6 fig match
                } else {
                    if (!sixFigBigNumberEquals(eventArgs[argIndex], emittedArgs[argIndex])) {
                        console.log(`EVENT ARG MISMATCH, arg ${argIndex}, ${toDecimal(eventArgs[argIndex])} ==? ${toDecimal(emittedArgs[argIndex])}`)
                    }
                    expect6FigBigNumberEquals(eventArgs[argIndex], emittedArgs[argIndex])
                }

            // Test all other matches
            } else if (typeof eventArgs[argIndex] === 'string') {
                if (eventArgs[argIndex].toLowerCase() !== emittedArgs[argIndex].toLowerCase()) {
                    console.log(`EVENT ARG MISMATCH, arg${argIndex}, ${eventArgs[argIndex]} ==? ${emittedArgs[argIndex]}`)
                }
                expect(eventArgs[argIndex].toLowerCase()).to.equal(emittedArgs[argIndex].toLowerCase())
            } else {
                if (eventArgs[argIndex] !== emittedArgs[argIndex]) {
                    console.log(`EVENT ARG MISMATCH, arg${argIndex}, ${eventArgs[argIndex]} ==? ${emittedArgs[argIndex]}`)
                }
                expect(eventArgs[argIndex]).to.equal(emittedArgs[argIndex])
            }
        }
    }
}