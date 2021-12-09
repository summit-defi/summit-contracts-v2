import { BigNumber } from "@ethersproject/bignumber"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { expect } from "chai"
import { string } from "hardhat/internal/core/params/argumentTypes"
import { consoleLog, e0, e18, elevationHelperGet, EVENT, executeTxExpectEvent, executeTxExpectReversion, EXPEDITION, getElevationHelper, getExpedition, getSummitBalance, getUsdcBalance, mineBlockWithTimestamp, toDecimal, usersExpeditionInfo } from "."
import { everestGet } from "./everestUtils"


export interface UserExpeditionInfo {
    everestOwned: BigNumber
    deity: number
    deitySelected: boolean
    deitySelectionRound: number
    safetyFactor: number
    safetyFactorSelected: boolean
    
    entered: boolean
    prevInteractedRound: number
    
    safeSupply: BigNumber
    deitiedSupply: BigNumber
}

export interface ExpeditionToken {
    roundEmission: BigNumber
    emissionsRemaining: BigNumber
    markedForDist: BigNumber
    distributed: BigNumber
    safeMult: BigNumber
    deityMult: [BigNumber, BigNumber]
}

export interface ExpeditionInfo {
    live: boolean

    roundsRemaining: number

    safeSupply: BigNumber
    deitiedSupply: BigNumber
    deitySupply: [BigNumber, BigNumber],

    summitExpeditionToken: ExpeditionToken,
    usdcExpeditionToken: ExpeditionToken
}

export interface ExpeditionRewards {
    summit: BigNumber
    usdc: BigNumber
}

export interface ExpeditionHypotheticalRewards {
    safeSummit: BigNumber,
    safeUsdc: BigNumber,
    deitiedSummit: BigNumber,
    deitiedUsdc: BigNumber
}



export const expeditionGet = {
    expeditionDeityWinningsMult: async () => {
        return (await (await getExpedition()).expeditionDeityWinningsMult()).toNumber()
    },
    expeditionRunwayRounds: async () => {
        return (await (await getExpedition()).expeditionRunwayRounds()).toNumber()
    },
    userExpeditionInfo: async (userAddress: string): Promise<UserExpeditionInfo> => {
        const expedition = await getExpedition()
        const fetchedExpedInfo = await expedition.userExpeditionInfo(userAddress)
        return {
            everestOwned: fetchedExpedInfo.everestOwned,
            deity: fetchedExpedInfo.deity,
            deitySelected: fetchedExpedInfo.deitySelected,
            deitySelectionRound: fetchedExpedInfo.deitySelectionRound.toNumber(),
            safetyFactor: fetchedExpedInfo.safetyFactor,
            safetyFactorSelected: fetchedExpedInfo.safetyFactorSelected,

            entered: fetchedExpedInfo.entered,
            prevInteractedRound: fetchedExpedInfo.prevInteractedRound,
            
            safeSupply: fetchedExpedInfo.safeSupply,
            deitiedSupply: fetchedExpedInfo.deitiedSupply,
        }
    },
    expeditionInfo: async (): Promise<ExpeditionInfo> => {
        const expedition = await getExpedition()
        const fetchedExpedInfo = await expedition.expeditionInfo()
        return {
            live: fetchedExpedInfo.live,

            roundsRemaining: fetchedExpedInfo.roundsRemaining.toNumber(),

            safeSupply: fetchedExpedInfo.supplies.safe,
            deitiedSupply: fetchedExpedInfo.supplies.deitied,
            deitySupply: [
                fetchedExpedInfo.supplies.deity[0],
                fetchedExpedInfo.supplies.deity[1],
            ],

            summitExpeditionToken: {
                roundEmission: fetchedExpedInfo.summit.roundEmission,
                emissionsRemaining: fetchedExpedInfo.summit.emissionsRemaining,
                markedForDist: fetchedExpedInfo.summit.markedForDist,
                distributed: fetchedExpedInfo.summit.distributed,
                safeMult: fetchedExpedInfo.summit.safeMult,
                deityMult: [
                    fetchedExpedInfo.summit.deityMult[0],
                    fetchedExpedInfo.summit.deityMult[1],
                ],
            },

            usdcExpeditionToken: {
                roundEmission: fetchedExpedInfo.usdc.roundEmission,
                emissionsRemaining: fetchedExpedInfo.usdc.emissionsRemaining,
                markedForDist: fetchedExpedInfo.usdc.markedForDist,
                distributed: fetchedExpedInfo.usdc.distributed,
                safeMult: fetchedExpedInfo.usdc.safeMult,
                deityMult: [
                    fetchedExpedInfo.usdc.deityMult[0],
                    fetchedExpedInfo.usdc.deityMult[1],
                ],
            },
        }
    },
    rewards: async (userAddress: string): Promise<ExpeditionRewards> => {
        const rewards = await (await getExpedition()).rewards(userAddress)
        return {
            summit: rewards[0],
            usdc: rewards[1],
        }
    },
    hypotheticalRewards: async (userAddress: string): Promise<ExpeditionHypotheticalRewards> => {
        const rewards = await (await getExpedition()).hypotheticalRewards(userAddress)
        return {
            safeSummit: rewards[0],
            safeUsdc: rewards[1],
            deitiedSummit: rewards[2],
            deitiedUsdc: rewards[3],
        }
    },
    userSatisfiesExpeditionRequirements: async (userAddress: string): Promise<{ everest: boolean, deity: boolean, safetyFactor: boolean }> => {
        const requirements = await (await getExpedition()).userSatisfiesExpeditionRequirements(userAddress)
        return {
            everest: requirements[0],
            deity: requirements[1],
            safetyFactor: requirements[2],
        }
    }
}

export const expeditionMethod = {
    addExpeditionFunds: async ({
        user,
        tokenAddress,
        amount,
        revertErr,
    }: {
        user: SignerWithAddress
        tokenAddress: string,
        amount: BigNumber,
        revertErr?: string,
    }) => {
        const expedition = await getExpedition()
        const tx = expedition.connect(user).addExpeditionFunds
        const txArgs = [tokenAddress, amount]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [tokenAddress, amount]
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.ExpeditionFundsAdded, eventArgs, true)
        }
    },
    disableExpedition: async ({
        user,
        revertErr,
    }: {
        user: SignerWithAddress
        revertErr?: string,
    }) => {
        const expedition = await getExpedition()
        const tx = expedition.connect(user).disableExpedition
        const txArgs = [] as any[]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.ExpeditionDisabled, null, true)
        }
    },
    enableExpedition: async ({
        user,
        revertErr,
    }: {
        user: SignerWithAddress
        revertErr?: string,
    }) => {
        const expedition = await getExpedition()
        const tx = expedition.connect(user).enableExpedition
        const txArgs = [] as any[]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.ExpeditionEnabled, null, true)
        }
    },
    rollover: async ({
        user,
        revertErr,
    }: {
        user?: SignerWithAddress,
        revertErr?: string,
    }) => {
        const expedition = await getExpedition()
        const tx = user != null ? expedition.connect(user).rollover : expedition.rollover
        const txArgs = [] as any[]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.Rollover, null, false)
        }
    },
    selectDeity: async ({
        user,
        deity,
        revertErr,
    }: {
        user: SignerWithAddress,
        deity: number,
        revertErr?: string
    }) => {
        const expedition = await getExpedition()
        const tx = expedition.connect(user).selectDeity
        const txArgs = [deity]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const expeditionRound = await elevationHelperGet.roundNumber(EXPEDITION)
            const eventArgs = [user.address, deity, expeditionRound]
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.DeitySelected, eventArgs, true)
        }
    },
    selectSafetyFactor: async ({
        user,
        safetyFactor,
        revertErr,
    }: {
        user: SignerWithAddress,
        safetyFactor: number,
        revertErr?: string
    }) => {
        const expedition = await getExpedition()
        const tx = expedition.connect(user).selectSafetyFactor
        const txArgs = [safetyFactor]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [user.address, safetyFactor]
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.SafetyFactorSelected, eventArgs, true)
        }
    },
    joinExpedition: async ({
        user,
        revertErr,
    }: {
        user: SignerWithAddress,
        revertErr?: string
    }) => {
        const expedition = await getExpedition()
        const tx = expedition.connect(user).joinExpedition
        const txArgs = [] as any[]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const userExpeditionInfo = await expeditionGet.userExpeditionInfo(user.address)
            const eventArgs = [user.address, userExpeditionInfo.deity, userExpeditionInfo.safetyFactor, userExpeditionInfo.everestOwned]
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.UserJoinedExpedition, eventArgs, true)
        }
    },
    harvestExpedition: async ({
        user,
        revertErr,
    }: {
        user: SignerWithAddress,
        revertErr?: string
    }) => {
        const expedition = await getExpedition()
        const tx = expedition.connect(user).harvestExpedition
        const txArgs = [] as any[]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const expectedRewards = await expeditionGet.rewards(user.address)
            const eventArgs = [user.address, expectedRewards.summit, expectedRewards.usdc]
            console.log({
                harvestExpectedArgs: eventArgs
            })
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.UserHarvestedExpedition, eventArgs, true)
        }
    },
}


const rolloverExpedition = async () => {
    const expeditionRoundEndTime = await elevationHelperGet.roundEndTimestamp(EXPEDITION)
    await mineBlockWithTimestamp(expeditionRoundEndTime)
    await expeditionMethod.rollover({})
}
const rolloverExpeditionMultiRounds = async (roundsToRollover: number) => {
    for (let i = 0; i < roundsToRollover; i++) {
        await rolloverExpedition()
    }
}
const calcUserSafeEverest = (expedInfo: UserExpeditionInfo) => {
    return expedInfo.everestOwned.mul(expedInfo.safetyFactor).div(100)
}
const calcUserDeitiedEverest = (expedInfo: UserExpeditionInfo) => {
    return expedInfo.everestOwned.mul(e0(100).sub(expedInfo.safetyFactor)).div(100)
}
const calcUserSafeAndDeitiedEverest = async (userAddress: string) => {
    const expedInfo = await expeditionGet.userExpeditionInfo(userAddress)
    return {
        safe: calcUserSafeEverest(expedInfo),
        deitied: calcUserDeitiedEverest(expedInfo),
    }
}

const sumSafeAndDeitySupplies = async (): Promise<{ safeSupply: BigNumber, deity0Supply: BigNumber, deity1Supply: BigNumber}> => {
    const usersExpedInfo = await usersExpeditionInfo()
    return usersExpedInfo.reduce((acc, expedInfo) => ({
        safeSupply: acc.safeSupply.add(calcUserSafeEverest(expedInfo)),
        deity0Supply: acc.deity0Supply.add(expedInfo.deity !== 0 ? 0 : calcUserDeitiedEverest(expedInfo)),
        deity1Supply: acc.deity1Supply.add(expedInfo.deity !== 1 ? 0 : calcUserDeitiedEverest(expedInfo)),
    }), { safeSupply: e18(0), deity0Supply: e18(0), deity1Supply: e18(0) })
}

const expectUserAndExpedSuppliesToMatch = async () => {
    const summedSupplies = await sumSafeAndDeitySupplies()
    const expedInfo = await expeditionGet.expeditionInfo()

    consoleLog({
        SafeSupply: `${toDecimal(expedInfo.safeSupply)} should equal ${toDecimal(summedSupplies.safeSupply)}`,
        Deity0Supply: `${toDecimal(expedInfo.deitySupply[0])} should equal ${toDecimal(summedSupplies.deity0Supply)}`,
        Deity1Supply: `${toDecimal(expedInfo.deitySupply[1])} should equal ${toDecimal(summedSupplies.deity1Supply)}`,
        DeitiedSupply: `${toDecimal(expedInfo.deitiedSupply)} should equal ${toDecimal(summedSupplies.deity0Supply.add(summedSupplies.deity1Supply))}`,
    })

    expect(expedInfo.safeSupply).to.equal(summedSupplies.safeSupply)
    expect(expedInfo.deitySupply[0]).to.equal(summedSupplies.deity0Supply)
    expect(expedInfo.deitySupply[1]).to.equal(summedSupplies.deity1Supply)
    expect(expedInfo.deitiedSupply).to.equal(summedSupplies.deity0Supply.add(summedSupplies.deity1Supply))
}

const getExpeditionExpectedEmissions = async () => {
    const expedition = await getExpedition()

    const summitBalance = await getSummitBalance(expedition.address)
    const usdcBalance = await getUsdcBalance(expedition.address)

    const runwayRounds = await expeditionGet.expeditionRunwayRounds()

    return {
        summitEmission: summitBalance.div(runwayRounds),
        usdcEmission: usdcBalance.div(runwayRounds),
    }
}

export const expeditionSynth = {
    rolloverExpedition,
    rolloverExpeditionMultiRounds,
    calcUserSafeEverest,
    calcUserDeitiedEverest,
    calcUserSafeAndDeitiedEverest,
    sumSafeAndDeitySupplies,
    expectUserAndExpedSuppliesToMatch,
    getExpeditionExpectedEmissions,
}


export const expeditionSetParams = {
    setExpeditionDeityWinningsMult: async ({
        dev,
        expeditionDeityWinningsMult,
        revertErr,
    }: {
        dev: SignerWithAddress
        expeditionDeityWinningsMult: number,
        revertErr?: string,
    }) => {
        const expedition = await getExpedition()
        const tx = expedition.connect(dev).setExpeditionDeityWinningsMult
        const txArgs = [expeditionDeityWinningsMult]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [expeditionDeityWinningsMult]
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.SetExpeditionDeityWinningsMult, eventArgs, true)
        }
    },
    setExpeditionRunwayRounds: async ({
        dev,
        expeditionRunwayRounds,
        revertErr,
    }: {
        dev: SignerWithAddress
        expeditionRunwayRounds: number,
        revertErr?: string,
    }) => {
        const expedition = await getExpedition()
        const tx = expedition.connect(dev).setExpeditionRunwayRounds
        const txArgs = [expeditionRunwayRounds]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [expeditionRunwayRounds]
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.SetExpeditionRunwayRounds, eventArgs, true)
        }
    },
}