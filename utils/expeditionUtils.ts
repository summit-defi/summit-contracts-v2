import { BigNumber } from "@ethersproject/bignumber"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { elevationHelperGet, EVENT, executeTxExpectEvent, executeTxExpectReversion, EXPEDITION, getExpedition } from "."
import { everestGet } from "./everestUtils"


export interface UserExpeditionInfo {
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
    launched: boolean
    live: boolean

    roundsRemaining: number

    safeSupply: BigNumber
    deitiedSupply: BigNumber
    deitySupply: [BigNumber, BigNumber],

    summitExpeditionToken: ExpeditionToken,
    usdcExpeditionToken: ExpeditionToken
}



export const expeditionGet = {
    expeditionDeityWinningsMult: async () => {
        return ((await getExpedition()).expeditionDeityWinningsMult()).toNumber()
    },
    expeditionRunwayRounds: async () => {
        return ((await getExpedition()).expeditionRunwayRounds()).toNumber()
    },
    userExpeditionInfo: async (userAddress: string): Promise<UserExpeditionInfo> => {
        const expedition = await getExpedition()
        const fetchedExpedInfo = await expedition.userExpeditionInfo(userAddress)
        return {
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
            launched: fetchedExpedInfo.launched,
            live: fetchedExpedInfo.live,

            roundsRemaining: fetchedExpedInfo.roundsRemaining.toNumber(),

            safeSupply: fetchedExpedInfo.safeSupply,
            deitiedSupply: fetchedExpedInfo.deitiedSupply,
            deitySupply: [
                fetchedExpedInfo.deitySupply[0],
                fetchedExpedInfo.deitySupply[1],
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
    rewards: async (userAddress: string): Promise<{ summit: BigNumber, usdc: BigNumber }> => {
        const rewards = (await getExpedition()).rewards(userAddress)
        return {
            summit: rewards[0],
            usdc: rewards[1],
        }
    },
    hypotheticalRewards: async (userAddress: string): Promise<{ safeSummit: BigNumber, safeUsdc: BigNumber, deitiedSummit: BigNumber, deitiedUsdc: BigNumber }> => {
        const rewards = (await getExpedition()).hypotheticalRewards(userAddress)
        return {
            safeSummit: rewards[0],
            safeUsdc: rewards[1],
            deitiedSummit: rewards[2],
            deitiedUsdc: rewards[3],
        }
    },
    userSatisfiesExpeditionRequirements: async (userAddress: string): Promise<{ everest: boolean, deity: boolean, safetyFactor: boolean }> => {
        const requirements = (await getExpedition()).userSatisfiesExpeditionRequirements(userAddress)
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
            const everestInfo = await everestGet.userEverestInfo(user.address)
            const eventArgs = [user.address, everestInfo.deity, everestInfo.safetyFactor, everestInfo.everestOwned]
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
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.UserHarvestedExpedition, eventArgs, true)
        }
    },
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
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.Param.SetExpeditionDeityWinningsMult, eventArgs, true)
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
            await executeTxExpectEvent(tx, txArgs, expedition, EVENT.Expedition.Param.SetExpeditionRunwayRounds, eventArgs, true)
        }
    },
}