import { BigNumber } from "@ethersproject/bignumber"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { e12, e6, elevationPromiseSequenceReduce, EVENT, executeTxExpectEvent, executeTxExpectReversion, subCartGet } from "."
import { getCartographer } from "./contracts"


// BASE GETTERS

const tokenAlloc = async (tokenAddress: string): Promise<number> => {
    return (await (await getCartographer()).tokenAlloc(tokenAddress)).toNumber()
}
const elevAlloc =  async (elevation: number): Promise<number> => {
    return (await (await getCartographer()).elevAlloc(elevation)).toNumber()
}
const elevationModulatedAllocation = async (tokenAddress: string, elevation: number): Promise<number> => {
    return (await (await getCartographer()).elevationModulatedAllocation(tokenAddress, elevation)).toNumber()
}
const tokenElevationIsEarning = async (tokenAddress: string, elevation: number): Promise<boolean> => {
    return await (await getCartographer()).tokenElevationIsEarning(tokenAddress, elevation)
}
const tokenElevationEmissionMultiplier = async (tokenAddress: string, elevation: number): Promise<BigNumber> => {
    return await (await getCartographer()).tokenElevationEmissionMultiplier(tokenAddress, elevation)
}
const tokenAllocEmissionMultiplier = async (tokenAddress: string, elevation: number): Promise<BigNumber> => {
    return await (await getCartographer()).tokenAllocEmissionMultiplier(tokenAddress)
}
const summitPerSecond = async (): Promise<BigNumber> => {
    return await (await getCartographer()).summitPerSecond()
}

export const cartographerGet = {
    tokenAlloc,
    elevAlloc,
    elevationModulatedAllocation,
    tokenElevationIsEarning,
    tokenElevationEmissionMultiplier,
    tokenAllocEmissionMultiplier,
    summitPerSecond,
}


// DATA SYNTHESIS

const tokenTotalAlloc =  async (tokenAddress: string): Promise<number> => {
    const baseAlloc = await tokenAlloc(tokenAddress)
    return await elevationPromiseSequenceReduce(
        async (alloc, elevation) => alloc + (await tokenElevationIsEarning(tokenAddress, elevation)) ? baseAlloc : 0,
        0,
    )
}
const totalAlloc = async (): Promise<number> => {
    return await elevationPromiseSequenceReduce(
        async (alloc, elevation) => alloc + await elevAlloc(elevation),
        0,
    )
}
const farmSummitPerSecond = async (tokenAddress: string, elevation: number): Promise<BigNumber> => {
    return (await summitPerSecond())
        .mul(await tokenElevationEmissionMultiplier(tokenAddress, elevation))
        .mul(await tokenAllocEmissionMultiplier(tokenAddress, elevation))
        .div(e12(1))
}
const farmSummitEmissionOverDuration = async (tokenAddress: string, elevation: number, duration: number): Promise<BigNumber> => {
    return (await farmSummitPerSecond(tokenAddress, elevation)).mul(duration).div(e12(1))
}
const farmSummitEmissionOneBlock = async (tokenAddress: string, elevation: number) => {
    return await farmSummitEmissionOverDuration(tokenAddress, elevation, 1)
}

export const cartographerSynth = {
    tokenTotalAlloc,
    totalAlloc,
    farmSummitPerSecond,
    farmSummitEmissionOverDuration,
    farmSummitEmissionOneBlock,
}


// CARTOGRAPHER METHODS

export const cartographerMethod = {
    deposit: async ({
        user,
        tokenAddress,
        elevation,
        amount,
        revertErr,
    }: {
        user: SignerWithAddress,
        tokenAddress: string,
        elevation: number,
        amount: BigNumber,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const expectedAfterFee = amount
        const tx = cartographer.connect(user).deposit
        const txArgs = [tokenAddress, elevation, amount]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [user.address, tokenAddress, elevation, expectedAfterFee]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.Deposit, eventArgs, false)
        }
    },
    claimSingleFarm: async ({
        user,
        tokenAddress,
        elevation,
        revertErr,
        eventOnly = false,
    }: {
        user: SignerWithAddress,
        tokenAddress: string,
        elevation: number,
        revertErr?: string,
        eventOnly?: boolean,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(user).deposit
        const txArgs = [tokenAddress, elevation, 0]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const expectedClaimAmount = (await subCartGet.rewards(tokenAddress, elevation, user.address)).harvestable
                .add(await farmSummitEmissionOverDuration(tokenAddress, elevation, 1))
                .div(e6(1)).mul(e6(1))
            const eventArgs = eventOnly ? null : [user.address, expectedClaimAmount]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.ClaimWinnings, eventArgs, false)
        }
    },
    withdraw: async ({
        user,
        tokenAddress,
        elevation,
        amount,
        revertErr,
        eventOnly = false,
    }: {
        user: SignerWithAddress,
        tokenAddress: string,
        elevation: number,
        amount: BigNumber,
        revertErr?: string,
        eventOnly?: boolean,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(user).withdraw
        const txArgs = [tokenAddress, elevation, amount]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [user.address, tokenAddress, elevation, amount]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.Withdraw, eventOnly ? null : eventArgs, false)
        }
    },
    setTokenAlloc: async ({
        user,
        tokenAddress,
        alloc,
        revertErr,
    }: {
        user: SignerWithAddress,
        tokenAddress: string,
        alloc: number,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(user).setTokenAlloc
        const txArgs = [tokenAddress, alloc]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [tokenAddress, alloc]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.TokenAllocUpdated, eventArgs, false)
        }
    },
    switchTotem: async ({
        user,
        elevation,
        totem,
        revertErr,
    }: {
        user: SignerWithAddress,
        elevation: number,
        totem: number,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(user).switchTotem
        const txArgs = [elevation, totem]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [user.address, elevation, totem]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.SwitchTotem, eventArgs, false)
        }
    },
    rollover: async ({
        user,
        elevation,
        revertErr,
    }: {
        user?: SignerWithAddress,
        elevation: number,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = user != null ? cartographer.connect(user).rollover : cartographer.rollover
        const txArgs = [elevation]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.Rollover, null, false)
        }
    },
    setTokenPassthroughStrategy: async ({
        dev,
        tokenAddress,
        passthroughTargetAddress,
        revertErr,
    }: {
        dev: SignerWithAddress
        tokenAddress: string,
        passthroughTargetAddress: string,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).setTokenPassthroughStrategy
        const txArgs = [tokenAddress, passthroughTargetAddress]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [tokenAddress, passthroughTargetAddress]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.SET_PASSTHROUGH_STRATEGY, eventArgs, false)
        }
    },
    retireTokenPassthroughStrategy: async ({
        dev,
        tokenAddress,
        revertErr,
    }: {
        dev: SignerWithAddress,
        tokenAddress: string,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).retireTokenPassthroughStrategy
        const txArgs = [tokenAddress]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.RETIRE_PASSTHROUGH_STRATEGY, null, false)
        }
    },
    rolloverReferral: async ({
        user,
        revertErr,
    }: {
        user: SignerWithAddress,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(user).rolloverReferral
        const txArgs = [] as any[]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [user.address]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.RolloverReferral, eventArgs, false)
        }
    },

}