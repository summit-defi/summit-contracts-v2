// BASE GETTERS

import { BigNumber } from "@ethersproject/bignumber"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { EVENT, executeTx, executeTxExpectEvent, executeTxExpectReversion, getSummitGlacier } from "."

export interface UserLockedWinnings {
    winnings: BigNumber
    bonusEarned: BigNumber
    claimedWinnings: BigNumber
}

const epochDuration = 3600 * 24 * 7

const getYieldLockEpochCount = async () => {
    return (await getSummitGlacier()).yieldLockEpochCount()
}
const epochStartTimestamp = (epoch: number) => {
    return epoch * epochDuration
}

const getCurrentEpoch = async () => {
    return (await (await getSummitGlacier()).getCurrentEpoch()).toNumber()
}

const getUserEpochLockedWinnings = async (userAddress: string, epoch: number): Promise<UserLockedWinnings> => {
    const userLockedWinnings = await (await getSummitGlacier()).userLockedWinnings(userAddress, epoch)
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

export const summitGlacierGet = {
    getEpochDuration: async () => {
        return epochDuration
    },
    getYieldLockEpochCount,
    getCurrentEpoch,
    getHasEpochMatured: async (epoch: number) => {
        return await (await getSummitGlacier()).hasEpochMatured(epoch);
    },
    getEpochStartTimestamp: async (epoch: number) => {
        return (await (await getSummitGlacier()).getEpochStartTimestamp(epoch)).toNumber();
    },
    getEpochMatureTimestamp: async (epoch: number) => {
        return (await (await getSummitGlacier()).getEpochMatureTimestamp(epoch)).toNumber();
    },
    getUserLifetimeWinnings: async (userAddress: string) => {
        return await (await getSummitGlacier()).userLifetimeWinnings(userAddress)
    },
    getUserLifetimeBonusWinnings: async (userAddress: string) => {
        return await (await getSummitGlacier()).userLifetimeBonusWinnings(userAddress)
    },
    getUserEpochLockedWinnings,
    getUserEpochHarvestableWinnings,
    getUserCurrentEpochHarvestableWinnings: async (userAddress: string) => {
        const currentEpoch = await getCurrentEpoch()
        return await getUserEpochHarvestableWinnings(userAddress, currentEpoch)
    },
    getPanicFundsReleased: async () => {
        return (await getSummitGlacier()).getPanicFundsReleased()
    },
    getUserInteractingEpochs: async (userAddress: string): Promise<number[]> => {
        const interactingEpochs = await (await getSummitGlacier()).getUserInteractingEpochs(userAddress)
        return interactingEpochs.map((epoch: BigNumber) => epoch.toNumber())
    }
}

export const summitGlacierMethod = {
    initialize: async ({
        dev,
        summitTokenAddress,
        everestTokenAddress,
        cartographerAddress,
        expeditionAddress,
        revertErr,
    }: {
        dev: SignerWithAddress,
        summitTokenAddress: string,
        everestTokenAddress: string,
        cartographerAddress: string,
        expeditionAddress: string,
        revertErr?: string,
    }) => {
        const summitGlacier = await getSummitGlacier()
        const tx = summitGlacier.connect(dev).initialize
        const txArgs = [
            summitTokenAddress,
            everestTokenAddress,
            cartographerAddress,
            expeditionAddress,
        ]
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            await executeTx(dev, tx, txArgs)
        }
    },
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
        const summitGlacier = await getSummitGlacier()
        const tx = summitGlacier.connect(user).harvestWinnings
        const txArgs = [epoch, amount, lockForEverest]
        
        if (revertErr != null) {
            await executeTxExpectReversion(user, tx, txArgs, revertErr)
        } else {
            const eventArgs = [user.address, epoch, amount, lockForEverest]
            await executeTxExpectEvent(user, tx, txArgs, summitGlacier, EVENT.SummitGlacier.WinningsHarvested, eventArgs, true)
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
        const summitGlacier = await getSummitGlacier()
        const tx = summitGlacier.connect(dev).setYieldLockEpochCount
        const txArgs = [yieldLockEpochCount]
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [yieldLockEpochCount]
            await executeTxExpectEvent(dev, tx, txArgs, summitGlacier, EVENT.SummitGlacier.SetYieldLockEpochCount, eventArgs, true)
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
        const summitGlacier = await getSummitGlacier()
        const tx = summitGlacier.connect(dev).setPanic
        const txArgs = [panic]
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [panic]
            await executeTxExpectEvent(dev, tx, txArgs, summitGlacier, EVENT.SummitGlacier.SetPanic, eventArgs, true)
        }
    },
}