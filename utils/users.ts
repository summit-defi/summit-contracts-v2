import { BigNumber } from "@ethersproject/bignumber"
import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import hre from 'hardhat'
import { UserInfo } from "os"
import { expeditionGet, ExpeditionHypotheticalRewards, ExpeditionRewards, getEverestBalance, getSummitBalance, getUsdcBalance, promiseSequenceMap, subCartGet } from "."
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
        async (user) => (await subCartGet.hypotheticalRewards(tokenAddress, elevation, user.address))
    )
}
export const usersRewards = async (tokenAddress: string, elevation: number) => {
    return await userPromiseSequenceMap(
        async (user) => (await subCartGet.rewards(tokenAddress, elevation, user.address))
    )
}

export const usersSummitBalances = async () => {
    return await userPromiseSequenceMap(
        async (user) => await getSummitBalance(user.address)
    )
}
export const usersClaimedSummitBalances = async () => {
    return await userPromiseSequenceMap(
        async (user) => await summitLockingGet.getUserCurrentEpochClaimableWinnings(user.address)
    )
}
export const usersEverestBalances = async () => {
    return await userPromiseSequenceMap(
        async (user) => await getEverestBalance(user.address)
    )
}
export const usersUsdcBalances = async () => {
    return await userPromiseSequenceMap(
        async (user) => await getUsdcBalance(user.address)
    )
}

export const usersExpeditionInfo = async () => {
    return await userPromiseSequenceMap(
        async (user) => await expeditionGet.userExpeditionInfo(user.address)
    )
}

export const usersExpeditionRewards = async (): Promise<ExpeditionRewards[]> => {
    return await userPromiseSequenceMap(
        async (user) => await expeditionGet.rewards(user.address)
    )
}
export const usersExpeditionHypotheticalRewards = async (): Promise<ExpeditionHypotheticalRewards[]> => {
    return await userPromiseSequenceMap(
        async (user) => await expeditionGet.hypotheticalRewards(user.address)
    )
}