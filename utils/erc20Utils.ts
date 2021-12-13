import { Contract } from "ethers"
import { getSummitToken, getEverestToken, getCakeToken, getBifiToken, promiseSequenceMap } from "."

export const getTokenBalance = async (token: Contract, add: string) => {
    return await token.balanceOf(add)
}
export const getSummitBalance = async (add: string) => {
    return (await (await getSummitToken()).balanceOf(add))
}
export const getEverestBalance = async (add: string) => {
    return (await (await getEverestToken()).balanceOf(add))
}
export const getUsdcBalance = async (add: string) => {
    return (await (await getCakeToken()).balanceOf(add))
}
export const tokenPromiseSequenceMap = async (transformer: (element: Contract, index: number, array: Contract[]) => Promise<any>) => {
    const summitToken = await getSummitToken()
    const cakeToken = await getCakeToken()
    const bifiToken = await getBifiToken()
    return await promiseSequenceMap(
        [summitToken, cakeToken, bifiToken],
        async (user: Contract, index: number, array: Contract[]) => await transformer(user, index, array)
    )
}