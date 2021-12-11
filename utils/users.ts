import { BigNumber } from "@ethersproject/bignumber"
import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import hre from 'hardhat'
import { UserInfo } from "os"
import { everestGet, expeditionGet, ExpeditionHypotheticalRewards, ExpeditionInfo, ExpeditionRewards, getEverestBalance, getSummitBalance, getUsdcBalance, promiseSequenceMap, subCartGet, UserEverestInfo, UserExpeditionInfo } from "."
import { summitLockingGet } from "./summitLockingUtils"


export const userPromiseSequenceMap = async (transformer: (element: SignerWithAddress, index: number, array: SignerWithAddress[]) => Promise<any>) => {
    const { user1, user2, user3 } = await getNamedSigners(hre)
    return await promiseSequenceMap(
        [user1, user2, user3],
        async (user: SignerWithAddress, index: number, array: SignerWithAddress[]) => await transformer(user, index, array)
    )
}

export const userPromiseSequenceReduce = async <T>(reducer: (acc: any, element: SignerWithAddress, index: number, array: SignerWithAddress[]) => T, initialValue: T) => {
    const { user1, user2, user3 } = await getNamedSigners(hre)
    return [user1, user2, user3].reduce(await reducer, initialValue)
}

// HELPERS
export const usersPoolInfo = async (tokenAddress: string, elevation: number) => {
    return await userPromiseSequenceMap(
        async (user) => (await subCartGet.userInfo(tokenAddress, elevation, user.address)).staked
    )
}
export const usersPoolInfoItem = async (tokenAddress: string, elevation: number, item: string) => {
    return await userPromiseSequenceMap(
        async (user) => (await subCartGet.userInfo(tokenAddress, elevation, user.address))[item]
    )
}
export const usersStaked = async (tokenAddress: string, elevation: number): Promise<BigNumber[]> => {
    return await usersPoolInfoItem(tokenAddress, elevation, 'staked')
}
export const usersHypotheticalRewards = async (tokenAddress: string, elevation: number) => {
    return await userPromiseSequenceMap(
        async (user) => (await subCartGet.potentialWinnings(tokenAddress, elevation, user.address))
    )
}
export const usersRewards = async (tokenAddress: string, elevation: number) => {
    return await userPromiseSequenceMap(
        async (user) => (await subCartGet.claimableRewards(tokenAddress, elevation, user.address))
    )
}

export const usersSummitBalances = async (): Promise<BigNumber[]> => {
    return await userPromiseSequenceMap(
        async (user) => await getSummitBalance(user.address)
    )
}
export const usersLockedSummitBalances = async (): Promise<BigNumber[]> => {
    return await userPromiseSequenceMap(
        async (user) => await summitLockingGet.getUserCurrentEpochHarvestableWinnings(user.address)
    )
}
export const usersEverestBalances = async (): Promise<BigNumber[]> => {
    return await userPromiseSequenceMap(
        async (user) => await getEverestBalance(user.address)
    )
}
export const usersUsdcBalances = async (): Promise<BigNumber[]> => {
    return await userPromiseSequenceMap(
        async (user) => await getUsdcBalance(user.address)
    )
}

export const usersExpeditionInfos = async (): Promise<UserExpeditionInfo[]> => {
    return await userPromiseSequenceMap(
        async (user) => await expeditionGet.userExpeditionInfo(user.address)
    )
}
export const usersEverestInfos = async (): Promise<UserEverestInfo[]> => {
    return await userPromiseSequenceMap(
        async (user) => await everestGet.userEverestInfo(user.address)
    )
}

export const usersExpeditionRewards = async (): Promise<ExpeditionRewards[]> => {
    return await userPromiseSequenceMap(
        async (user) => await expeditionGet.rewards(user.address)
    )
}
export const usersExpeditionHypotheticalRewards = async (): Promise<ExpeditionHypotheticalRewards[]> => {
    return await userPromiseSequenceMap(
        async (user) => await expeditionGet.potentialWinnings(user.address)
    )
}

export const getUserTotems = async () => {
    const { user1, user2, user3 } = await getNamedSigners(hre)
    return {
        [user1.address]: 0,
        [user2.address]: 0,
        [user3.address]: 1,
    }
}