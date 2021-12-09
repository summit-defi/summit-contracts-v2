import { getSummitToken, getEverestToken, getCakeToken } from "."

export const getSummitBalance = async (add: string) => {
    return (await (await getSummitToken()).balanceOf(add))
}
export const getEverestBalance = async (add: string) => {
    return (await (await getEverestToken()).balanceOf(add))
}
export const getUsdcBalance = async (add: string) => {
    return (await (await getCakeToken()).balanceOf(add))
}