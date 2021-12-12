import { BigNumber } from "@ethersproject/bignumber"
import { ethers } from "hardhat"
import { e18, executeTx, getElevationHelper, getElevationName, MESA, OASIS, PLAINS, promiseSequenceMap, SUMMIT } from "."

export const elevationPromiseSequenceMap = async (transformer: (element: number, index: number, array: number[]) => Promise<any>) => {
    return await promiseSequenceMap(
        [OASIS, PLAINS, MESA, SUMMIT],
        async (elevation, index, array) => await transformer(elevation, index, array)
    )
}
export const elevationPromiseSequenceReduce = async (reducer: (acc: any, element: number, index: number, array: number[]) => Promise<any>, initialValue: any) => {
    let acc = initialValue
    const elevations = [OASIS, PLAINS, MESA, SUMMIT]
    for (let i = 0; i < elevations.length; i++) {
        acc = await reducer(acc, elevations[i], i, elevations)
    }
    return acc
}

export const getSubCartographer = async (elevation: number) => {
    return await ethers.getContract(`Cartographer${getElevationName(elevation)}`)
}

export const getSubCartographers = async () => {
    return await elevationPromiseSequenceMap(getSubCartographer)
}
export interface UserInfo {
    [key: string]: BigNumber
    prevInteractedRound: BigNumber
    staked: BigNumber
    debt: BigNumber
    roundRew: BigNumber
    winningsDebt: BigNumber
    reVestAmt: BigNumber
    reVestStart: BigNumber
    reVestDur: BigNumber
}
export interface UserTotemInfo {
    totem: number
    totemSelected: boolean
    totemSelectionRound: number
}

export const subCartGet = {
    farmingEnabled: async (elevation: number) => {
        return elevation === OASIS ? true : (await getSubCartographer(elevation)).elevationEnabled
    },
    userInfo: async (tokenAddress: string, elevation: number, userAddress: string): Promise<UserInfo> => {
        const subCart = await getSubCartographer(elevation)
        const userInfo = await subCart.userInfo(tokenAddress, userAddress)
        return {
            prevInteractedRound: userInfo.prevInteractedRound,
            staked: userInfo.staked,
            debt: userInfo.debt || userInfo.roundDebt,
            roundRew: userInfo.roundRew,
            winningsDebt: userInfo.winningsDebt,
            reVestAmt: userInfo.reVestAmt,
            reVestStart: userInfo.reVestStart,
            reVestDur: userInfo.reVestDur,
        }
    },
    poolInfo: async (tokenAddress: string, elevation: number) => {
        const subCart = await getSubCartographer(elevation)
        const poolInfo = await subCart.poolInfo(tokenAddress)
        const totemSupplies = elevation === OASIS ? [] : await subCart.totemSupplies(tokenAddress)
        const totemRoundRewards = elevation === OASIS ? [] : (await subCart.totemRoundRewards(tokenAddress) as any[])
        return {
            token: poolInfo.token,

            launched: poolInfo.launched,
            live: poolInfo.live,
            active: poolInfo.active,
            
            supply: poolInfo.supply,

            totemSupplies,
            roundRewards: totemRoundRewards.length > 0 ? totemRoundRewards[0] : e18(0),
            totemRoundRewards: totemRoundRewards.length > 0 ? totemRoundRewards.slice(1) : [],
        }
    },
    userTotemInfo: async (elevation: number, userAddress: string): Promise<UserTotemInfo> => {
        if (elevation === OASIS) return {
            totem: 0,
            totemSelected: true,
            totemSelectionRound: 0,
        }
        const subCart = await getSubCartographer(elevation)
        const userElevationInfo = await subCart.userElevationInfo(userAddress)
        return {
            totem: userElevationInfo.totem,
            totemSelected: userElevationInfo.totemSelected,
            totemSelectionRound: userElevationInfo.totemSelectionRound,
        }        
    },
    claimableRewards: async (tokenAddress: string, elevation: number, userAddress: string): Promise<BigNumber> => {
        const subCart = await getSubCartographer(elevation)
        return await subCart.claimableRewards(tokenAddress, userAddress)
    },
    elevClaimableRewards: async (elevation: number, userAddress: string) => {
        const subCart = await getSubCartographer(elevation)
        return await subCart.elevClaimableRewards(userAddress)
    },
    potentialWinnings: async (tokenAddress: string, elevation: number, userAddress: string) => {
        const subCart = await getSubCartographer(elevation)
        const potentialWinnings = await subCart.potentialWinnings(tokenAddress, userAddress)
        return {
            contributedYield: potentialWinnings[0],
            potentialWinnings: potentialWinnings[1],
        }
    },
    userInteractingWithPool: async (tokenAddress: string, elevation: number, userAddress: string) => {
        const subCart = await getSubCartographer(elevation)
        return await subCart.userInteractingWithPool(tokenAddress, userAddress)
    },
    totemCount: async (elevation: number) => {
        return (await getElevationHelper()).totemCount(elevation)
    }

}




export const subCartMethod = {
    updatePool: async (tokenAddress: string, elevation: number) => {
        executeTx((await getSubCartographer(elevation)).updatePool, [tokenAddress])
    }
}