import { getSummitToken, getEverestToken } from "."

export const getSummitBalance = async (add: string) => {
    return (await (await getSummitToken()).balanceOf(add))
}
export const getEverestBalance = async (add: string) => {
    return (await (await getEverestToken()).balanceOf(add))
}