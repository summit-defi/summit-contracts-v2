import { BigNumber } from "@ethersproject/bignumber"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { e18, EVENT, executeTx, executeTxExpectEvent, executeTxExpectReversion, getEverestToken } from "."


export interface UserEverestInfo {
    everestOwned: BigNumber
    everestLockMultiplier: number
    lockDuration: number
    lockRelease: number
    summitLocked: BigNumber
}

const userEverestInfo = async (userAddress: string): Promise<UserEverestInfo> => {
    const everestToken = await getEverestToken()
    const fetchedUserEverestInfo = await everestToken.userEverestInfo(userAddress)
    return {
        everestOwned: fetchedUserEverestInfo.everestOwned,
        everestLockMultiplier: fetchedUserEverestInfo.everestLockMultiplier.toNumber(),
        lockDuration: fetchedUserEverestInfo.lockDuration.toNumber(),
        lockRelease: fetchedUserEverestInfo.lockRelease.toNumber(),
        summitLocked: fetchedUserEverestInfo.summitLocked,
    }
}


const minLockTime = async () => {
    return (await (await getEverestToken()).minLockTime()).toNumber()
}
const inflectionLockTime = async () => {
    return (await (await getEverestToken()).inflectionLockTime()).toNumber()
}
const maxLockTime = async () => {
    return (await (await getEverestToken()).maxLockTime()).toNumber()
}
const minEverestLockMult = async () => {
    return (await (await getEverestToken()).minEverestLockMult()).toNumber()
}
const inflectionEverestLockMult = async () => {
    return (await (await getEverestToken()).inflectionEverestLockMult()).toNumber()
}
const maxEverestLockMult = async () => {
    return (await (await getEverestToken()).maxEverestLockMult()).toNumber()
}

const getLockDurationMultiplier = async (lockDuration: number): Promise<number> => {
    const minLock = await minLockTime()
    const inflectionLock = await inflectionLockTime()
    const maxLock = await maxLockTime()
    const minEverestMult = await minEverestLockMult()
    const inflectionEverestMult = await inflectionEverestLockMult()
    const maxEverestMult = await maxEverestLockMult()

    if (lockDuration <= inflectionLock) {
        return Math.floor((lockDuration - minLock) * (inflectionEverestMult - minEverestMult) / (inflectionLock - minLock)) + minEverestMult
    }

    return Math.floor((lockDuration - inflectionLock) * (maxEverestMult - inflectionEverestMult) / (maxLock - inflectionLock)) + inflectionEverestMult
}

const getExpectedEverestAward = async (summitAmount: BigNumber, lockDuration: number): Promise<BigNumber> => {
    const lockDurationMultiplier = await getLockDurationMultiplier(lockDuration)
    return summitAmount.mul(lockDurationMultiplier).div(10000)
}

const getAdditionalEverestAwardForLockDurationIncrease = async (userAddress: string, lockDuration: number): Promise<BigNumber> => {
    const newLockDurationMultiplier = await getLockDurationMultiplier(lockDuration)
    const everestInfo = await userEverestInfo(userAddress)
    if (lockDuration <= everestInfo.lockDuration) return e18(0)
    return everestInfo.summitLocked.mul(newLockDurationMultiplier).div(10000).sub(everestInfo.everestOwned)
}

const getAdditionalEverestAwardForIncreaseLockedSummit = async (userAddress: string, amount: BigNumber): Promise<BigNumber> => {
    const everestInfo = await userEverestInfo(userAddress)
    const lockDurationMultiplier = await getLockDurationMultiplier(everestInfo.lockDuration)
    return amount.mul(lockDurationMultiplier).div(10000)
}

const getExpectedWithdrawnSummit = async (userAddress: string, everestAmount: BigNumber): Promise<BigNumber> => {
    const everestInfo = await userEverestInfo(userAddress)
    return everestAmount.mul(10000).div(everestInfo.everestLockMultiplier)
}

export const everestGet = {
    minLockTime,
    maxLockTime,
    minEverestLockMult,
    maxEverestLockMult,
    getLockDurationMultiplier,
    getExpectedEverestAward,
    getExpectedWithdrawnSummit,
    getAdditionalEverestAwardForLockDurationIncrease,
    getAdditionalEverestAwardForIncreaseLockedSummit,
    panic: async () => {
        return await (await getEverestToken()).panic()
    },
    totalSummitLocked: async () => {
        return await (await getEverestToken()).totalSummitLocked()
    },
    avgSummitLockDuration: async () => {
        return await (await getEverestToken()).avgSummitLockDuration()
    },
    userEverestInfo,
    getEverestExtensions: async (): Promise<string[]> => {
        return await (await getEverestToken()).getEverestExtensions()
    }
}

export const everestMethod = {
    lockSummit: async ({
        user,
        amount,
        lockDuration,
        revertErr,
    }: {
        user: SignerWithAddress,
        amount: BigNumber,
        lockDuration: number,
        revertErr?: string,
    }) => {
        const everestToken = await getEverestToken()
        const tx = everestToken.connect(user).lockSummit
        const txArgs = [amount, lockDuration]
        
        if (revertErr != null) {
            await executeTxExpectReversion(user, tx, txArgs, revertErr)
        } else {
            const expectedEverestAward = await getExpectedEverestAward(amount, lockDuration)
            const eventArgs = [user.address, amount, lockDuration, expectedEverestAward]
            await executeTxExpectEvent(user, tx, txArgs, everestToken, EVENT.Everest.SummitLocked, eventArgs, false)
        }
    },
    increaseLockDuration: async ({
        user,
        lockDuration,
        revertErr,
    }: {
        user: SignerWithAddress,
        lockDuration: number,
        revertErr?: string,
    }) => {
        const everestToken = await getEverestToken()
        const tx = everestToken.connect(user).increaseLockDuration
        const txArgs = [lockDuration]
        
        if (revertErr != null) {
            await executeTxExpectReversion(user, tx, txArgs, revertErr)
        } else {
            const expectedEverestAward = await getAdditionalEverestAwardForLockDurationIncrease(user.address, lockDuration)
            const eventArgs = [user.address, lockDuration, expectedEverestAward]
            await executeTxExpectEvent(user, tx, txArgs, everestToken, EVENT.Everest.LockDurationIncreased, eventArgs, false)
        }
    },
    increaseLockedSummit: async ({
        user,
        amount,
        revertErr,
    }: {
        user: SignerWithAddress,
        amount: BigNumber,
        revertErr?: string,
    }) => {
        const everestToken = await getEverestToken()
        const tx = everestToken.connect(user).increaseLockedSummit
        const txArgs = [amount]
        
        if (revertErr != null) {
            await executeTxExpectReversion(user, tx, txArgs, revertErr)
        } else {
            const additionalEverestAward = await getAdditionalEverestAwardForIncreaseLockedSummit(user.address, amount)
            const eventArgs = [user.address, false, amount, additionalEverestAward]
            await executeTxExpectEvent(user, tx, txArgs, everestToken, EVENT.Everest.LockedSummitIncreased, eventArgs, false)
        }
    },
    withdrawLockedSummit: async ({
        user,
        everestAmount,
        revertErr,
    }: {
        user: SignerWithAddress,
        everestAmount: BigNumber,
        revertErr?: string,
    }) => {
        const everestToken = await getEverestToken()
        const tx = everestToken.connect(user).withdrawLockedSummit
        const txArgs = [everestAmount]
        
        if (revertErr != null) {
            await executeTxExpectReversion(user, tx, txArgs, revertErr)
        } else {
            const expectedWithdrawnSummit = await getExpectedWithdrawnSummit(user.address, everestAmount)
            const eventArgs = [user.address, expectedWithdrawnSummit, everestAmount]
            await executeTxExpectEvent(user, tx, txArgs, everestToken, EVENT.Everest.LockedSummitWithdrawn, eventArgs, false)
        }
    },
    panicRecoverFunds: async ({
        user,
        revertErr,
    }: {
        user: SignerWithAddress,
        revertErr?: string,
    }) => {
        const everestToken = await getEverestToken()
        const tx = everestToken.connect(user).panicRecoverFunds
        const txArgs = [] as any[]
        
        if (revertErr != null) {
            await executeTxExpectReversion(user, tx, txArgs, revertErr)
        } else {
            const recoverableSummit = (await everestGet.userEverestInfo(user.address)).summitLocked
            const eventArgs = [user.address, recoverableSummit]
            await executeTxExpectEvent(user, tx, txArgs, everestToken, EVENT.Everest.PanicFundsRecovered, eventArgs, false)
        }
    },



    addWhitelistedTransferAddress: async ({
        dev,
        whitelistedAddress,
        revertErr,
    }: {
        dev: SignerWithAddress
        whitelistedAddress: string,
        revertErr?: string,
    }) => {
        const everestToken = await getEverestToken()
        const tx = everestToken.connect(dev).addWhitelistedTransferAddress
        const txArgs = [whitelistedAddress]
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [whitelistedAddress]
            await executeTxExpectEvent(dev, tx, txArgs, everestToken, EVENT.Everest.AddWhitelistedTransferAddress, eventArgs, true)
        }
    },
    

    
    addEverestExtension: async ({
        dev,
        extension,
        revertErr,
    }: {
        dev: SignerWithAddress
        extension: string,
        revertErr?: string,
    }) => {
        const everestToken = await getEverestToken()
        const tx = everestToken.connect(dev).addEverestExtension
        const txArgs = [extension]
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [extension]
            await executeTxExpectEvent(dev, tx, txArgs, everestToken, EVENT.Everest.EverestExtensionAdded, eventArgs, true)
        }
    },
    removeEverestExtension: async ({
        dev,
        extension,
        revertErr,
    }: {
        dev: SignerWithAddress
        extension: string,
        revertErr?: string,
    }) => {
        const everestToken = await getEverestToken()
        const tx = everestToken.connect(dev).removeEverestExtension
        const txArgs = [extension]
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [extension]
            await executeTxExpectEvent(dev, tx, txArgs, everestToken, EVENT.Everest.EverestExtensionRemoved, eventArgs, true)
        }
    },
}


export const everestSetParams = {
    setMinLockTime: async ({
        dev,
        minLockTime,
        revertErr,
    }: {
        dev: SignerWithAddress
        minLockTime: number,
        revertErr?: string,
    }) => {
        const everestToken = await getEverestToken()
        const tx = everestToken.connect(dev).setMinLockTime
        const txArgs = [minLockTime]
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [minLockTime]
            await executeTxExpectEvent(dev, tx, txArgs, everestToken, EVENT.Everest.SetMinLockTime, eventArgs, true)
        }
    },
    setMaxLockTime: async ({
        dev,
        maxLockTime,
        revertErr,
    }: {
        dev: SignerWithAddress
        maxLockTime: number,
        revertErr?: string,
    }) => {
        const everestToken = await getEverestToken()
        const tx = everestToken.connect(dev).setMaxLockTime
        const txArgs = [maxLockTime]
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [maxLockTime]
            await executeTxExpectEvent(dev, tx, txArgs, everestToken, EVENT.Everest.SetMaxLockTime, eventArgs, true)
        }
    },
    setLockTimeRequiredForTaxlessSummitWithdraw: async ({
        dev,
        inflectionLockTime,
        revertErr,
    }: {
        dev: SignerWithAddress
        inflectionLockTime: number,
        revertErr?: string,
    }) => {
        const everestToken = await getEverestToken()
        const tx = everestToken.connect(dev).setLockTimeRequiredForTaxlessSummitWithdraw
        const txArgs = [inflectionLockTime]
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [inflectionLockTime]
            await executeTxExpectEvent(dev, tx, txArgs, everestToken, EVENT.Everest.SetLockTimeRequiredForTaxlessSummitWithdraw, eventArgs, true)
        }
    },
    setLockTimeRequiredForLockedSummitDeposit: async ({
        dev,
        lockTimeRequiredForLockedSummitDeposit,
        revertErr,
    }: {
        dev: SignerWithAddress
        lockTimeRequiredForLockedSummitDeposit: number,
        revertErr?: string,
    }) => {
        const everestToken = await getEverestToken()
        const tx = everestToken.connect(dev).setLockTimeRequiredForLockedSummitDeposit
        const txArgs = [lockTimeRequiredForLockedSummitDeposit]
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [lockTimeRequiredForLockedSummitDeposit]
            await executeTxExpectEvent(dev, tx, txArgs, everestToken, EVENT.Everest.SetLockTimeRequiredForLockedSummitDeposit, eventArgs, true)
        }
    },
    setMinEverestLockMult: async ({
        dev,
        minEverestLockMult,
        revertErr,
    }: {
        dev: SignerWithAddress
        minEverestLockMult: number,
        revertErr?: string,
    }) => {
        const everestToken = await getEverestToken()
        const tx = everestToken.connect(dev).setMinEverestLockMult
        const txArgs = [minEverestLockMult]
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [minEverestLockMult]
            await executeTxExpectEvent(dev, tx, txArgs, everestToken, EVENT.Everest.SetMinEverestLockMult, eventArgs, true)
        }
    },
    setMaxEverestLockMult: async ({
        dev,
        maxEverestLockMult,
        revertErr,
    }: {
        dev: SignerWithAddress
        maxEverestLockMult: number,
        revertErr?: string,
    }) => {
        const everestToken = await getEverestToken()
        const tx = everestToken.connect(dev).setMaxEverestLockMult
        const txArgs = [maxEverestLockMult]
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [maxEverestLockMult]
            await executeTxExpectEvent(dev, tx, txArgs, everestToken, EVENT.Everest.SetMaxEverestLockMult, eventArgs, true)
        }
    },
    setPanic: async ({
        dev,
        panic,
        revertErr,
    }: {
        dev: SignerWithAddress
        panic: boolean,
        revertErr?: string,
    }) => {
        const everestToken = await getEverestToken()
        const tx = everestToken.connect(dev).setPanic
        const txArgs = [panic]
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [panic]
            await executeTxExpectEvent(dev, tx, txArgs, everestToken, EVENT.Everest.SetPanic, eventArgs, true)
        }
    },    
}