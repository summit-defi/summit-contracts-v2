import { BigNumber } from "@ethersproject/bignumber"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { boolean, string } from "hardhat/internal/core/params/argumentTypes"
import { claimAmountBonus, claimAmountWithBonusAdded, e12, e6, elevationPromiseSequenceReduce, EVENT, executeTxExpectEvent, executeTxExpectReversion, getBifiToken, getCakeToken, OASIS, subCartGet, sumBigNumbers, toDecimal, tokenAmountAfterDepositFee, tokenAmountAfterWithdrawTax, tokenPromiseSequenceMap } from "."
import { getCartographer, getSummitToken } from "./contracts"


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
const getUserTokenWithdrawalTax = async (userAddress: string, tokenAddress: string): Promise<number> => {
    return await (await getCartographer()).taxBP(userAddress, tokenAddress)
}
const getTokenDepositFee = async (tokenAddress: string): Promise<number> => {
    return await (await getCartographer()).tokenDepositFee(tokenAddress)
}
const getUserTokenEarningsBonus = async (userAddress: string, tokenAddress: string): Promise<number> => {
    return await (await getCartographer()).bonusBP(userAddress, tokenAddress)
}
const getTokenClaimableWithBonus = async (userAddress: string, tokenAddress: string, elevation: number): Promise<BigNumber> => {
    const expectedClaimAmount = (await subCartGet.claimableRewards(tokenAddress, elevation, userAddress))
        .add(await farmSummitEmissionOverDuration(tokenAddress, elevation, 1))
        .div(e6(1)).mul(e6(1))
    const userTokenBonusBp = await getUserTokenEarningsBonus(userAddress, tokenAddress)
    return claimAmountWithBonusAdded(expectedClaimAmount, userTokenBonusBp)
}
const getTokenClaimableBonus = async (userAddress: string, tokenAddress: string, elevation: number): Promise<BigNumber> => {
    const expectedClaimAmount = (await subCartGet.claimableRewards(tokenAddress, elevation, userAddress))
        .add(await farmSummitEmissionOverDuration(tokenAddress, elevation, 1))
        .div(e6(1)).mul(e6(1))
    const userTokenBonusBp = await getUserTokenEarningsBonus(userAddress, tokenAddress)
    return claimAmountBonus(expectedClaimAmount, userTokenBonusBp)
}

export const cartographerGet = {
    tokenAlloc,
    elevAlloc,
    elevationModulatedAllocation,
    tokenElevationIsEarning,
    tokenElevationEmissionMultiplier,
    tokenAllocEmissionMultiplier,
    summitPerSecond,
    getUserTokenWithdrawalTax,
    getTokenDepositFee,
    getUserTokenEarningsBonus,
    getTokenClaimableWithBonus,
    getTokenClaimableBonus,
    getRolloverReward: async () => {
        return await (await getCartographer()).rolloverReward()
    },
    poolsCount: async () => {
        return (await (await getCartographer()).poolsCount()).toNumber()
    },
    elevationPoolsCount: async (elevation: number) => {
        return await (await getCartographer()).elevationPoolsCount(elevation)
    }
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
    add: async ({
        dev,
        tokenAddress,
        elevation,
        live,
        withUpdate,
        revertErr,
    }: {
        dev: SignerWithAddress,
        tokenAddress: string,
        elevation: number,
        live: boolean,
        withUpdate: boolean,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).add
        const txArgs = [tokenAddress, elevation, live, withUpdate]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [tokenAddress, elevation]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.PoolCreated, eventArgs, false)
        }
    },
    set: async ({
        dev,
        tokenAddress,
        elevation,
        live,
        withUpdate,
        revertErr,
    }: {
        dev: SignerWithAddress,
        tokenAddress: string,
        elevation: number,
        live: boolean,
        withUpdate: boolean,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).set
        const txArgs = [tokenAddress, elevation, live, withUpdate]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [tokenAddress, elevation, live]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.PoolUpdated, eventArgs, false)
        }
    },
    createTokenAllocation: async ({
        dev,
        tokenAddress,
        allocation,
        revertErr,
    }: {
        dev: SignerWithAddress,
        tokenAddress: string,
        allocation: number,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).createTokenAllocation
        const txArgs = [tokenAddress, allocation]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [tokenAddress, allocation]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.TokenAllocCreated, eventArgs, false)
        }
    },
    setTokenAllocation: async ({
        dev,
        tokenAddress,
        allocation,
        revertErr,
    }: {
        dev: SignerWithAddress,
        tokenAddress: string,
        allocation: number,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).setTokenAllocation
        const txArgs = [tokenAddress, allocation]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [tokenAddress, allocation]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.TokenAllocUpdated, eventArgs, false)
        }
    },
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
        const tx = cartographer.connect(user).deposit
        const txArgs = [tokenAddress, elevation, amount]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const depositFee = await getTokenDepositFee(tokenAddress)
            const expectedAfterFee = tokenAmountAfterDepositFee(amount, depositFee)
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
            const expectedClaimAmountWithBonus = await getTokenClaimableWithBonus(user.address, tokenAddress, elevation)
            const eventArgs = eventOnly ? null : [user.address, expectedClaimAmountWithBonus]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.ClaimWinnings, eventArgs, false)
        }
    },
    claimElevation: async ({
        user,
        elevation,
        revertErr,
    }: {
        user: SignerWithAddress,
        elevation: number,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(user).claimElevation
        const txArgs = [elevation]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const tokenClaimableWithBonuses = await tokenPromiseSequenceMap(
                async (token) => await getTokenClaimableWithBonus(user.address, token.address, elevation)
            )
            const totalClaimableWithBonuses = sumBigNumbers(tokenClaimableWithBonuses)
            const eventArgs = [user.address, elevation, totalClaimableWithBonuses]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.ClaimElevation, eventArgs, false)
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
            const userTokenTaxBP = await getUserTokenWithdrawalTax(user.address, tokenAddress)
            const amountAfterTax = tokenAmountAfterWithdrawTax(amount, userTokenTaxBP)
            const eventArgs = [user.address, tokenAddress, elevation, amountAfterTax]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.Withdraw, eventOnly ? null : eventArgs, false)
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
        if (elevation === OASIS) return

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
        if (elevation === OASIS) return

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

export const cartographerSetParam = {
    setTokenDepositFee: async ({
        dev,
        tokenAddress,
        feeBP,
        revertErr,
    }: {
        dev: SignerWithAddress
        tokenAddress: string,
        feeBP: number,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).setTokenDepositFee
        const txArgs = [tokenAddress, feeBP]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [tokenAddress, feeBP]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.CartographerParam.SetTokenDepositFee, eventArgs, false)
        }
    },
    setTokenWithdrawTax: async ({
        dev,
        tokenAddress,
        taxBP,
        revertErr,
    }: {
        dev: SignerWithAddress
        tokenAddress: string,
        taxBP: number,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).setTokenWithdrawTax
        const txArgs = [tokenAddress, taxBP]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [tokenAddress, taxBP]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.CartographerParam.SetTokenWithdrawTax, eventArgs, false)
        }
    },
    setTaxDecayDuration: async ({
        dev,
        taxDecayDuration,
        revertErr,
    }: {
        dev: SignerWithAddress
        taxDecayDuration: number,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).setTaxDecayDuration
        const txArgs = [taxDecayDuration]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [taxDecayDuration]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.CartographerParam.SetTaxDecayDuration, eventArgs, false)
        }
    },
    setBaseMinimumWithdrawalTax: async ({
        dev,
        baseMinimumWithdrawalTax,
        revertErr,
    }: {
        dev: SignerWithAddress
        baseMinimumWithdrawalTax: number,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).setBaseMinimumWithdrawalTax
        const txArgs = [baseMinimumWithdrawalTax]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [baseMinimumWithdrawalTax]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.CartographerParam.SetBaseMinimumWithdrawalTax, eventArgs, false)
        }
    },
    setTokenIsNativeFarm: async ({
        dev,
        tokenAddress,
        tokenIsNativeFarm,
        revertErr,
    }: {
        dev: SignerWithAddress
        tokenAddress: string,
        tokenIsNativeFarm: boolean,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).setTokenIsNativeFarm
        const txArgs = [tokenAddress, tokenIsNativeFarm]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [tokenAddress, tokenIsNativeFarm]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.CartographerParam.SetTokenIsNativeFarm, eventArgs, false)
        }
    },
    setMaxBonusBP: async ({
        dev,
        maxBonusBP,
        revertErr,
    }: {
        dev: SignerWithAddress
        maxBonusBP: boolean,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).setMaxBonusBP
        const txArgs = [maxBonusBP]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            const eventArgs = [maxBonusBP]
            await executeTxExpectEvent(tx, txArgs, cartographer, EVENT.CartographerParam.SetMaxBonusBP, eventArgs, false)
        }
    },
}