import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { expect } from "chai"
import { BigNumber, Contract } from "ethers"
import { getChainId } from "hardhat"
import { chainIdIsMainnet, delay, EVENT, expect6FigBigNumberEquals, FORKED_MAINNET, hardhatChainId, notHardhat, sixFigBigNumberEquals, toDecimal, txWaitCount } from "."

export const executeTx = async (signer: SignerWithAddress, tx: any, txArgs: any[], providerArgs?: object) => {
    let transaction
    let tries = 0
    while (transaction == null) {
        if (tries >= 5) {
            throw new Error('Ran out of retries')
        }
        try {
            const nonce = await signer.getTransactionCount()
            const provArgs = {
                ...providerArgs,
                nonce,
            }
            transaction = await tx(...txArgs, provArgs)
        } catch (e: any) {
            console.log('Err in tx', e.message)
            tries++
        }
    }
    const waitCount = await txWaitCount()
    if ((await getChainId()) !== hardhatChainId){
        try {
            await transaction.wait(waitCount)
            // await delay(5000)
        } catch (e: any) {
            console.log('Err in wait', e.message)
        }
    }
    return transaction
}

export const executeTxExpectReversion = async (signer: SignerWithAddress, tx: any, txArgs: any[], revertErr: string, providerArgs?: object) => {
    const nonce = await signer.getTransactionCount()
    const provArgs = {
        ...providerArgs,
        nonce,
    }
    await expect(
        tx(...txArgs, provArgs)
    ).to.be.revertedWith(revertErr)
}

export const executeTxExpectEvent = async (signer: SignerWithAddress, tx: any, txArgs: any[], contract: Contract, eventName: string, eventArgs: any[] | null, requireExactBigNumberMatch: boolean, providerArgs?: object) => {
    let transaction
    let tries = 0
    while (transaction == null) {
        if (tries >= 5) {
            throw new Error('Ran out of retries')
        }
        try {
            const nonce = await signer.getTransactionCount()
            const provArgs = {
                ...providerArgs,
                nonce,
            }
            if (txArgs.length > 0) {
                transaction = await tx(...txArgs, provArgs)
            } else {
                transaction = await tx(provArgs)
            }
        } catch (e: any) {
            console.log('Err in tx', e.message)
            tries++
        }
    }
    const waitCount = await txWaitCount()
    const receipt = await transaction.wait(waitCount)
    // if ((await getChainId()) !== hardhatChainId) {
    //     await delay(5000)
    // }

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