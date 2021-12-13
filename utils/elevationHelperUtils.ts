import { BigNumber } from "@ethersproject/bignumber"
import { getElevationHelper } from "."


// BASE GETTERS


const roundNumber = async (elevation: number): Promise<number> => {
    return (await (await getElevationHelper()).roundNumber(elevation)).toNumber()
}
const winningTotem = async (elevation: number, round: number): Promise<number> => {
    return await (await getElevationHelper()).winningTotem(elevation, round)
}

export const elevationHelperGet = {
    roundEndTimestamp: async (elevation: number): Promise<number> => {
        return (await (await getElevationHelper()).roundEndTimestamp(elevation)).toNumber()
    },
    unlockTimestamp: async (elevation: number): Promise<number> => {
        return (await (await getElevationHelper()).unlockTimestamp(elevation)).toNumber()
    },
    roundNumber,
    winningTotem,
    prevWinningTotem: async (elevation: number): Promise<number> => {
        return await winningTotem(elevation, (await roundNumber(elevation)) - 1)
    },
    roundDurationSeconds: async (elevation: number): Promise<number> => {
        return (await (await getElevationHelper()).roundDurationSeconds(elevation)).toNumber()
    },
    currentRoundStartTime: async (elevation: number): Promise<number> => {
        return (await (await getElevationHelper()).currentRoundStartTime(elevation)).toNumber()
    },
    referralBurnTimestamp: async (): Promise<number> => {
        return (await (await getElevationHelper()).referralBurnTimestamp()).toNumber()
    },
    historicalTotemStats: async (elevation: number) => {
        const history = await (await getElevationHelper()).historicalWinningTotems(elevation)
        return {
            totemWinCounters: history[0].map((wins: BigNumber) => wins.toNumber()),
            prevWinners: history[1].map((winner: BigNumber) => winner.toNumber()),
        }
    }
}