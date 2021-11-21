import { BigNumber } from "@ethersproject/bignumber"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { e12, elevationPromiseSequenceReduce, EVENT, executeTxExpectEvent, executeTxExpectReversion, getElevationHelper, subCartGet } from "."
import { getCartographer } from "./contracts"


// BASE GETTERS


const roundNumber = async (elevation: number): Promise<number> => {
    return ((await getElevationHelper()).roundNumber(elevation)).toNumber()
}
const winningTotem = async (elevation: number, round: number): Promise<number> => {
    return (await getElevationHelper()).winningTotem(elevation, round)
}

export const elevationHelperGet = {
    roundEndTimestamp: async (elevation: number): Promise<number> => {
        return ((await getElevationHelper()).roundEndTimestamp(elevation)).toNumber()
    },
    roundNumber,
    winningTotem,
    prevWinningTotem: async (elevation: number): Promise<number> => {
        return await winningTotem(elevation, (await roundNumber(elevation)) - 1)
    },
    roundDurationSeconds: async (elevation: number): Promise<number> => {
        return ((await getElevationHelper()).roundDurationSeconds(elevation)).toNumber()
    },
    currentRoundStartTime: async (elevation: number): Promise<number> => {
        return ((await getElevationHelper()).roundDurationSeconds(elevation)).toNumber()
    },
    historicalTotemStats: async (elevation: number) => {
        const history = ((await getElevationHelper()).historicalWinningTotems(elevation))
        return {
            totemWinCounters: history.slice(0, 10).map((wins: BigNumber) => wins.toNumber()),
            prevWinners: history.slice(10).map((winner: BigNumber) => winner.toNumber()),
        }
    }
}