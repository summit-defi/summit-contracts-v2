// BASE GETTERS

import { BigNumber } from "@ethersproject/bignumber"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { EVENT, executeTxExpectEvent, executeTxExpectReversion, getSummitLocking } from "."

export interface UserLockedWinnings {
    winnings: BigNumber
    bonusEarned: BigNumber
    claimedWinnings: BigNumber
}

const epochDuration = 3600 * 24 * 7

const getYieldLockEpochCount = async () => {
    return (await getSummitLocking()).yieldLockEpochCount()
}
const epochStartTimestamp = (epoch: number) => {
    return epoch * epochDuration
}

const getCurrentEpoch = async () => {
    return (await (await getSummitLocking()).getCurrentEpoch()).toNumber()
}

const getUserEpochLockedWinnings = async (userAddress: string, epoch: number): Promise<UserLockedWinnings> => {
    const userLockedWinnings = await (await getSummitLocking()).userLockedWinnings(userAddress, epoch)
    return {
        winnings: userLockedWinnings.winnings,
        bonusEarned: userLockedWinnings.bonusEarned,
        claimedWinnings: userLockedWinnings.claimedWinnings,
    }
}
const getUserEpochHarvestableWinnings = async (userAddress: string, epoch: number) => {
    const userLockedWinnings = await getUserEpochLockedWinnings(userAddress, epoch)
    return userLockedWinnings.winnings.sub(userLockedWinnings.claimedWinnings)
}

export const summitLockingGet = {
    getEpochDuration: async () => {
        return epochDuration
    },
    getYieldLockEpochCount,
    getCurrentEpoch,
    getHasEpochMatured: async (epoch: number) => {
        return await (await getSummitLocking()).hasEpochMatured(epoch);
    },
    getEpochStartTimestamp: async (epoch: number) => {
        return (await (await getSummitLocking()).getEpochStartTimestamp(epoch)).toNumber();
    },
    getEpochMatureTimestamp: async (epoch: number) => {
        return (await (await getSummitLocking()).getEpochMatureTimestamp(epoch)).toNumber();
    },
    getUserLifetimeWinnings: async (userAddress: string) => {
        return await (await getSummitLocking()).userLifetimeWinnings(userAddress)
    },
    getUserLifetimeBonusWinnings: async (userAddress: string) => {
        return await (await getSummitLocking()).userLifetimeBonusWinnings(userAddress)
    },
    getUserEpochLockedWinnings,
    getUserEpochHarvestableWinnings,
    getUserCurrentEpochHarvestableWinnings: async (userAddress: string) => {
        const currentEpoch = await getCurrentEpoch()
        return await getUserEpochHarvestableWinnings(userAddress, currentEpoch)
    },
    getPanicFundsReleased: async () => {
        return (await getSummitLocking()).getPanicFundsReleased()
    },
    getUserInteractingEpochs: async (userAddress: string): Promise<number[]> => {
        const interactingEpochs = await (await getSummitLocking()).getUserInteractingEpochs(userAddress)
        return interactingEpochs.map((epoch: BigNumber) => epoch.toNumber())
    }
}

export const summitLockingMethod = {
    harvestWinnings: async ({
        user,
        epoch,
        amount,
        lockForEverest = false,
        revertErr,
    }: {
        user: SignerWithAddress,
        epoch: number,
        amount: BigNumber,
        lockForEverest?: boolean,
        revertErr?: string,
    }) => {
        const summitLocking = await getSummitLocking()
        const tx = summitLocking.connect(user).harvestWinnings
        const txArgs = [epoch, amount, lockForEverest]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [user.address, epoch, amount, lockForEverest]
            await executeTxExpectEvent(tx, txArgs, summitLocking, EVENT.SummitLocking.WinningsHarvested, eventArgs, true)
        }
    },
    setYieldLockEpochCount: async ({
        dev,
        yieldLockEpochCount,
        revertErr,
    }: {
        dev: SignerWithAddress,
        yieldLockEpochCount: number,
        revertErr?: string,
    }) => {
        const summitLocking = await getSummitLocking()
        const tx = summitLocking.connect(dev).setYieldLockEpochCount
        const txArgs = [yieldLockEpochCount]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [yieldLockEpochCount]
            await executeTxExpectEvent(tx, txArgs, summitLocking, EVENT.SummitLocking.SetYieldLockEpochCount, eventArgs, true)
        }
    },
    setPanic: async ({
        dev,
        panic,
        revertErr,
    }: {
        dev: SignerWithAddress,
        panic: boolean,
        revertErr?: string,
    }) => {
        const summitLocking = await getSummitLocking()
        const tx = summitLocking.connect(dev).setPanic
        const txArgs = [panic]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [panic]
            await executeTxExpectEvent(tx, txArgs, summitLocking, EVENT.SummitLocking.SetPanic, eventArgs, true)
        }
    },
}