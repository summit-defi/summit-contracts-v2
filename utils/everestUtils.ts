import { BigNumber } from "@ethersproject/bignumber"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { EVENT, executeTx, executeTxExpectEvent, executeTxExpectReversion, getExpedition } from "."


export interface UserEverestInfo {
    everestOwned: BigNumber
    everestLockMultiplier: number
    lockDuration: number
    lockRelease: number
    summitLocked: BigNumber

    compoundClaimableSummitAsEverest: boolean

    deity: number
    deitySelected: boolean
    deitySelectionRound: number
    safetyFactor: number
    safetyFactorSelected: boolean
}

const userEverestInfo = async (userAddress: string): Promise<UserEverestInfo> => {
    const expedition = await getExpedition()
    const fetchedUserEverestInfo = await expedition.userEverestInfo(userAddress)
    return {
        everestOwned: fetchedUserEverestInfo.everestOwned,
        everestLockMultiplier: fetchedUserEverestInfo.everestLockMultiplier.toNumber(),
        lockDuration: fetchedUserEverestInfo.lockDuration.toNumber(),
        lockRelease: fetchedUserEverestInfo.lockRelease.toNumber(),
        summitLocked: fetchedUserEverestInfo.summitLocked,

        compoundClaimableSummitAsEverest: fetchedUserEverestInfo.compoundClaimableSummitAsEverest,

        deity: fetchedUserEverestInfo.deity,
        deitySelected: fetchedUserEverestInfo.deitySelected,
        deitySelectionRound: fetchedUserEverestInfo.deitySelectionRound.toNumber(),
        safetyFactor: fetchedUserEverestInfo.safetyFactor,
        safetyFactorSelected: fetchedUserEverestInfo.safetyFactorSelected,
    }
}


const minLockTime = async () => {
    return ((await getExpedition()).minLockTime()).toNumber()
}
const maxLockTime = async () => {
    return ((await getExpedition()).maxLockTime()).toNumber()
}
const minEverestLockMult = async () => {
    return ((await getExpedition()).minEverestLockMult()).toNumber()
}
const maxEverestLockMult = async () => {
    return ((await getExpedition()).maxEverestLockMult()).toNumber()
}

const getLockPeriodMultiplier = async (lockPeriod: number): Promise<number> => {
    const minLock = await minLockTime()
    const maxLock = await maxLockTime()
    const minEverestMult = await minEverestLockMult()
    const maxEverestMult = await maxEverestLockMult()

    return Math.floor((lockPeriod - minLock) * (maxEverestMult - minEverestMult) / (maxLock - minLock)) + minEverestMult
}

const getExpectedEverestAward = async (summitAmount: BigNumber, lockPeriod: number): Promise<BigNumber> => {
    const lockPeriodMultiplier = await getLockPeriodMultiplier(lockPeriod)
    return summitAmount.mul(lockPeriodMultiplier).div(10000)
}

const getAdditionalEverestAwardForLockDurationIncrease = async (userAddress: string, lockPeriod: number): Promise<BigNumber> => {
    const newLockPeriodMultiplier = await getLockPeriodMultiplier(lockPeriod)
    const everestInfo = await userEverestInfo(userAddress)
    return everestInfo.summitLocked.mul(newLockPeriodMultiplier).sub(everestInfo.everestOwned)
}

const getAdditionalEverestAwardForIncreaseLockedSummit = async (userAddress: string, amount: BigNumber): Promise<BigNumber> => {
    const everestInfo = await userEverestInfo(userAddress)
    const lockPeriodMultiplier = await getLockPeriodMultiplier(everestInfo.lockDuration)
    return amount.mul(lockPeriodMultiplier)
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
    getLockPeriodMultiplier,
    getExpectedEverestAward,
    expeditionDeityWinningsMult: async () => {
        return ((await getExpedition()).expeditionDeityWinningsMult()).toNumber()
    },
    expeditionRunwayRounds: async () => {
        return ((await getExpedition()).expeditionRunwayRounds()).toNumber()
    },
    totalSummitLocked: async () => {
        return (await getExpedition()).totalSummitLocked()
    },
    avgSummitLockDuration: async () => {
        return (await getExpedition()).avgSummitLockDuration()
    },
    userEverestInfo,
}

export const everestMethod = {
    lockSummit: async ({
        user,
        amount,
        lockPeriod,
        revertErr,
    }: {
        user: SignerWithAddress,
        amount: BigNumber,
        lockPeriod: number,
        revertErr?: string,
    }) => {
        const expedition = await getExpedition()
        const tx = expedition.connect(user).lockSummit
        const txArgs = [amount, lockPeriod]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const expectedEverestAward = getExpectedEverestAward(amount, lockPeriod)
            const eventArgs = [user.address, amount, lockPeriod, expectedEverestAward]
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.SummitLocked, eventArgs, false)
        }
    },
    increaseLockDuration: async ({
        user,
        lockPeriod,
        revertErr,
    }: {
        user: SignerWithAddress,
        lockPeriod: number,
        revertErr?: string,
    }) => {
        const expedition = await getExpedition()
        const tx = expedition.connect(user).increaseLockDuration
        const txArgs = [lockPeriod]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const expectedEverestAward = getAdditionalEverestAwardForLockDurationIncrease(user.address, lockPeriod)
            const eventArgs = [user.address, lockPeriod, expectedEverestAward]
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.SummitLocked, eventArgs, false)
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
        const expedition = await getExpedition()
        const tx = expedition.connect(user).increaseLockedSummit
        const txArgs = [amount]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const additionalEverestAward = getAdditionalEverestAwardForIncreaseLockedSummit(user.address, amount)
            const eventArgs = [user.address, false, amount, additionalEverestAward]
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.LockedSummitIncreased, eventArgs, false)
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
        const expedition = await getExpedition()
        const tx = expedition.connect(user).withdrawLockedSummit
        const txArgs = [everestAmount]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const expectedWithdrawnSummit = getExpectedWithdrawnSummit(user.address, everestAmount)
            const eventArgs = [user.address, expectedWithdrawnSummit, everestAmount]
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.LockedSummitIncreased, eventArgs, false)
        }
    }
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
        const expedition = await getExpedition()
        const tx = expedition.connect(dev).setMinLockTime
        const txArgs = [minLockTime]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [minLockTime]
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.Param.SetMinLockTime, eventArgs, true)
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
        const expedition = await getExpedition()
        const tx = expedition.connect(dev).setMaxLockTime
        const txArgs = [maxLockTime]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [maxLockTime]
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.Param.SetMaxLockTime, eventArgs, true)
        }
    },
    setLockTimeRequiredForTaxlessSummitWithdraw: async ({
        dev,
        lockTimeRequiredForTaxlessSummitWithdraw,
        revertErr,
    }: {
        dev: SignerWithAddress
        lockTimeRequiredForTaxlessSummitWithdraw: number,
        revertErr?: string,
    }) => {
        const expedition = await getExpedition()
        const tx = expedition.connect(dev).setLockTimeRequiredForTaxlessSummitWithdraw
        const txArgs = [lockTimeRequiredForTaxlessSummitWithdraw]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [lockTimeRequiredForTaxlessSummitWithdraw]
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.Param.SetLockTimeRequiredForTaxlessSummitWithdraw, eventArgs, true)
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
        const expedition = await getExpedition()
        const tx = expedition.connect(dev).setLockTimeRequiredForLockedSummitDeposit
        const txArgs = [lockTimeRequiredForLockedSummitDeposit]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [lockTimeRequiredForLockedSummitDeposit]
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.Param.SetLockTimeRequiredForLockedSummitDeposit, eventArgs, true)
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
        const expedition = await getExpedition()
        const tx = expedition.connect(dev).setMinEverestLockMult
        const txArgs = [minEverestLockMult]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [minEverestLockMult]
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.Param.SetMinEverestLockMult, eventArgs, true)
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
        const expedition = await getExpedition()
        const tx = expedition.connect(dev).setMaxEverestLockMult
        const txArgs = [maxEverestLockMult]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [maxEverestLockMult]
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.Param.SetMaxEverestLockMult, eventArgs, true)
        }
    },
    panicReleaseLocking: async ({
        dev,
        releaseLockedSummit,
        revertErr,
    }: {
        dev: SignerWithAddress
        releaseLockedSummit: number,
        revertErr?: string,
    }) => {
        const expedition = await getExpedition()
        const tx = expedition.connect(dev).panicReleaseLocking
        const txArgs = [releaseLockedSummit]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            await executeTx(tx, txArgs)
        }
    },
}