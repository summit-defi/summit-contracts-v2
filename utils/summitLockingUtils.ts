// BASE GETTERS

import { BigNumber } from "@ethersproject/bignumber"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { EVENT, executeTxExpectEvent, executeTxExpectReversion, getSummitLocking } from "."

export interface UserLockedWinnings {
    winnings: BigNumber
    bonusEarned: BigNumber
    claimedWinnings: BigNumber
}

export const epochDuration = 3600 * 24 * 7

export const getYieldLockEpochCount = async () => {
    return (await getSummitLocking()).yieldLockEpochCount()
}
export const epochStartTimestamp = (epoch: number) => {
    return epoch * epochDuration
}

export const summitLockingGet = {
    getCurrentEpoch: async () => {
        return (await (await getSummitLocking()).getCurrentEpoch()).toNumber()
    },
    getHasEpochMatured: async (epoch: number) => {
        return (await getSummitLocking()).hasEpochMatured(epoch);
    },
    getUserLifetimeWinnings: async (userAddress: string) => {
        return (await getSummitLocking()).userLifetimeWinnings(userAddress)
    },
    getUserLifetimeBonusWinnings: async (userAddress: string) => {
        return (await getSummitLocking()).userLifetimeBonusWinnings(userAddress)
    },
    getUserEpochLockedWinnings: async (userAddress: string, epoch: number): Promise<UserLockedWinnings> => {
        const userLockedWinnings = await (await getSummitLocking()).userLockedWinnings(userAddress, epoch)
        return {
            winnings: userLockedWinnings.winnings,
            bonusEarned: userLockedWinnings.bonusEarned,
            claimedWinnings: userLockedWinnings.claimedWinnings,
        }
    },
    getEpochMatureTimestamp: async (epoch: number) => {
        return epochStartTimestamp(epoch) + (5 * epochDuration)
    },
    getPanicFundsReleased: async () => {
        return (await getSummitLocking()).getPanicFundsReleased()
    },
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
            await executeTxExpectEvent(tx, txArgs, summitLocking, EVENT.WinningsHarvested, eventArgs, true)
        }
    },
}