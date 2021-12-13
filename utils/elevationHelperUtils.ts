import { BigNumber } from "@ethersproject/bignumber"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { EVENT, executeTxExpectEvent, executeTxExpectReversion, getElevationHelper } from "."


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
    },
    elevAllocMultiplier: async (): Promise<number> => {
        return await (await getElevationHelper()).allocMultiplier()
    },
    elevPendingAllocMultiplier: async (): Promise<number> => {
        return await (await getElevationHelper()).pendingAllocMultiplier()
    }
}

export const elevationHelperMethod = {
    upgradeSummitRNGModule: async ({
        dev,
        rngModule,
        revertErr,
    }: {
        dev: SignerWithAddress,
        rngModule: string,
        revertErr?: string,
    }) => {
        const elevationHelper = await getElevationHelper()
        const tx = elevationHelper.connect(dev).upgradeSummitRNGModule
        const txArgs = [rngModule]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [rngModule]
            await executeTxExpectEvent(tx, txArgs, elevationHelper, EVENT.ElevationHelper.UpgradeSummitRNGModule, eventArgs, false)
        }
    },
    setElevationRoundDurationMult: async ({
        dev,
        elevation,
        roundDurationMult,
        revertErr,
    }: {
        dev: SignerWithAddress,
        elevation: number,
        roundDurationMult: number,
        revertErr?: string,
    }) => {
        const elevationHelper = await getElevationHelper()
        const tx = elevationHelper.connect(dev).setElevationRoundDurationMult
        const txArgs = [elevation, roundDurationMult]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [elevation, roundDurationMult]
            await executeTxExpectEvent(tx, txArgs, elevationHelper, EVENT.ElevationHelper.SetElevationRoundDurationMult, eventArgs, false)
        }
    },
    setElevationAllocMultiplier: async ({
        dev,
        elevation,
        allocMultiplier,
        revertErr,
    }: {
        dev: SignerWithAddress,
        elevation: number,
        allocMultiplier: number,
        revertErr?: string,
    }) => {
        const elevationHelper = await getElevationHelper()
        const tx = elevationHelper.connect(dev).setElevationAllocMultiplier
        const txArgs = [elevation, allocMultiplier]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [elevation, allocMultiplier]
            await executeTxExpectEvent(tx, txArgs, elevationHelper, EVENT.ElevationHelper.SetElevationAllocMultiplier, eventArgs, false)
        }
    },
}