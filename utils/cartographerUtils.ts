import { BigNumber } from "@ethersproject/bignumber"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { ethers } from "hardhat"
import { claimAmountBonus, claimAmountWithBonusAdded, days, e18, e12, e6, elevationPromiseSequenceReduce, EVENT, executeTx, executeTxExpectEvent, executeTxExpectReversion, getBifiToken, getCakeToken, getTimestamp, OASIS, subCartGet, sumBigNumbers, toDecimal, tokenAmountAfterDepositFee, tokenAmountAfterWithdrawTax, tokenPromiseSequenceMap, Contracts, NamedElevations, getElevationName } from "."
import { getCartographer, getSummitToken } from "./contracts"
import { TimelockTxSig } from "./timelockConstants"
import { timelockMethod } from "./timelockUtilsV2"


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
const tokensWithAllocation = async (): Promise<string[]> => {
    return (await (await getCartographer()).tokensWithAllocation()).map((addr: string) => addr.toLowerCase())
}
const calcBonusBPNextSecond = async (userAddress: string, tokenAddress: string) => {
    const lastWithdrawTimestampForBonus = await (await getCartographer()).tokenLastWithdrawTimestampForBonus(userAddress, tokenAddress)
    const nextTimestamp = (await getTimestamp()) + 1
    const offset = nextTimestamp - lastWithdrawTimestampForBonus
    return calculateBonusFromOffset(offset)
}
const getBonusBP = async (userAddress: string, tokenAddress: string): Promise<number> => {
    return await (await getCartographer()).bonusBP(userAddress, tokenAddress)
}
const getTokenClaimableWithEmission = async (userAddress: string, tokenAddress: string, elevation: number): Promise<BigNumber> => {
    return (await subCartGet.poolClaimableRewards(tokenAddress, elevation, userAddress))
        .add(await farmSummitEmissionOverDuration(tokenAddress, elevation, 1))
}
const getTokenClaimableWithBonus = async (userAddress: string, tokenAddress: string, elevation: number): Promise<BigNumber> => {
    const claimableRewards = await subCartGet.poolClaimableRewards(tokenAddress, elevation, userAddress)
    const userTokenBonusBp = await calcBonusBPNextSecond(userAddress, tokenAddress)

    // Earnings remain consistent over time
    if (elevation !== OASIS) return claimAmountWithBonusAdded(claimableRewards.div(e6(1)).mul(e6(1)), userTokenBonusBp)

    // OASIS additional earnings need to be factored in
    const expectedClaimAmount = claimableRewards
        .add(await farmSummitEmissionOverDuration(tokenAddress, elevation, 1))
        .div(e6(1)).mul(e6(1))
    return claimAmountWithBonusAdded(expectedClaimAmount, userTokenBonusBp)
}
const getTokenClaimableBonus = async (userAddress: string, tokenAddress: string, elevation: number): Promise<BigNumber> => {
    const claimableRewards = await subCartGet.poolClaimableRewards(tokenAddress, elevation, userAddress)
    const userTokenBonusBp = await calcBonusBPNextSecond(userAddress, tokenAddress)

    // Earnings remain consistent over time
    if (elevation !== OASIS) return claimAmountBonus(claimableRewards.div(e6(1)).mul(e6(1)), userTokenBonusBp)

    // OASIS additional earnings need to be factored in
    const expectedClaimAmount = claimableRewards
        .add(await farmSummitEmissionOverDuration(tokenAddress, elevation, 1))
        .div(e6(1)).mul(e6(1))
    return claimAmountBonus(expectedClaimAmount, userTokenBonusBp)
}
const calculateBonusFromOffset = (offset: number): number => {
    if (offset <= days(7)) return 0
    if (offset >= days(14)) return 700
    return Math.floor(((offset - days(7)) * 700) / days(7))
}

export const cartographerGet = {
    tokenAlloc,
    tokensWithAllocation,
    tokenAllocExistence: async (tokenAddress: string): Promise<boolean> => {
        const tokensWithAlloc = await tokensWithAllocation()
        return tokensWithAlloc.includes(tokenAddress.toLowerCase())
    },
    elevAlloc,
    elevationModulatedAllocation,
    tokenElevationIsEarning,
    tokenElevationEmissionMultiplier,
    tokenAllocEmissionMultiplier,
    summitPerSecond,
    getUserTokenWithdrawalTax,
    getTokenDepositFee,
    getBonusBP,
    getTokenClaimableWithEmission,
    getTokenClaimableWithBonus,
    getTokenClaimableBonus,
    calculateBonusFromOffset,
    getRolloverReward: async () => {
        return await (await getCartographer()).rolloverReward()
    },
    poolsCount: async (): Promise<number> => {
        return (await (await getCartographer()).poolsCount()).toNumber()
    },
    elevationPoolsCount: async (elevation: number) => {
        return await (await getCartographer()).elevationPoolsCount(elevation)
    },
    tokenLastWithdrawTimestampForBonus: async (userAddress: string, tokenAddress: string): Promise<number> => {
        return (await (await getCartographer()).tokenLastWithdrawTimestampForBonus(userAddress, tokenAddress)).toNumber()
    },
    tokenLastDepositTimestampForTax: async (userAddress: string, tokenAddress: string): Promise<number> => {
        return (await (await getCartographer()).tokenLastDepositTimestampForTax(userAddress, tokenAddress)).toNumber()
    },
    userTokenStakedAmount: async (userAddress: string, tokenAddress: string): Promise<BigNumber> => {
        return await (await getCartographer()).userTokenStakedAmount(userAddress, tokenAddress)
    },
    taxResetOnDepositBP: async (): Promise<number> => {
        return (await (await getCartographer()).taxResetOnDepositBP()).toNumber()
    },
    taxBP: async (userAddress: string, tokenAddress: string): Promise<number> => {
        return await (await getCartographer()).taxBP(userAddress, tokenAddress)
    },
    tokenWithdrawalTax: async (tokenAddress: string): Promise<number> => {
        return await (await getCartographer()).tokenWithdrawalTax(tokenAddress)
    },
    isNativeFarmToken: async (tokenAddress: string): Promise<boolean> => {
        return await (await getCartographer()).isNativeFarmToken(tokenAddress)
    },
    baseMinimumWithdrawalTax: async (): Promise<number> => {
        return await (await getCartographer()).baseMinimumWithdrawalTax()
    },
    poolExists: async (tokenAddress: string, elevation: number): Promise<boolean> => {
        return await (await getCartographer()).poolExistence(tokenAddress, elevation)
    },
    tokenPassthroughStrategy: async (tokenAddress: string): Promise<string> => {
        return await (await getCartographer()).tokenPassthroughStrategy(tokenAddress)
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
    initialize: async ({
        dev,
        summitTokenAddress,
        elevationHelperAddress,
        oasisAddress,
        plainsAddress,
        mesaAddress,
        summitAddress,
        everestTokenAddress,
        summitGlacierAddress,
        revertErr,
    }: {
        dev: SignerWithAddress,
        summitTokenAddress: string,
        elevationHelperAddress: string,
        oasisAddress: string,
        plainsAddress: string,
        mesaAddress: string,
        summitAddress: string,
        everestTokenAddress: string,
        summitGlacierAddress: string,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).initialize
        const txArgs = [
            summitTokenAddress,
            elevationHelperAddress,
            oasisAddress,
            plainsAddress,
            mesaAddress,
            summitAddress,
            everestTokenAddress,
            summitGlacierAddress,
        ]
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            await executeTx(dev, tx, txArgs)
        }
    },
    enable: async ({
        dev,
        callAsTimelock = false,
        dryRun = false,
        revertErr
    }: {
        dev: SignerWithAddress,
        callAsTimelock?: boolean,
        dryRun?: boolean,
        revertErr?: string,
    }) => {

        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).enable
        const txArgs: any[] = []

        if (callAsTimelock) {
            const note = `Enable Summit Ecosystem`
            return await timelockMethod.queue({
                dev,
                targetContractName: Contracts.Cartographer,
                txName: TimelockTxSig.Cartographer.Enable,
                txParams: txArgs,
                note,
                dryRun,
            })
        }
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            await executeTx(dev, tx, txArgs)
        }
    },
    add: async ({
        dev,
        tokenAddress,
        elevation,
        live,
        withUpdate,
        revertErr,
        callAsTimelock = false,
        dryRun = false,
        tokenSymbol = '',
    }: {
        dev: SignerWithAddress,
        tokenAddress: string,
        elevation: number,
        live: boolean,
        withUpdate: boolean,
        revertErr?: string,
        callAsTimelock?: boolean,
        dryRun?: boolean,
        tokenSymbol?: string,
    }) => {

        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).add
        const txArgs = [tokenAddress, elevation, live, withUpdate]

        if (callAsTimelock) {
            const note = `Add Farm at Elevation: ${tokenSymbol} - ${getElevationName(elevation)} - live<${live}>`
            return await timelockMethod.queue({
                dev,
                targetContractName: Contracts.Cartographer,
                txName: TimelockTxSig.Cartographer.AddFarm,
                txParams: txArgs,
                note,
                dryRun,
            })
        }
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [tokenAddress, elevation]
            await executeTxExpectEvent(dev, tx, txArgs, cartographer, EVENT.PoolCreated, eventArgs, false)
        }
    },
    set: async ({
        dev,
        tokenAddress,
        elevation,
        live,
        withUpdate,
        revertErr,
        callAsTimelock = false,
        dryRun = false,
        tokenSymbol = '',
    }: {
        dev: SignerWithAddress,
        tokenAddress: string,
        elevation: number,
        live: boolean,
        withUpdate: boolean,
        revertErr?: string,
        callAsTimelock?: boolean,
        dryRun?: boolean,
        tokenSymbol?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).set
        const txArgs = [tokenAddress, elevation, live, withUpdate]

        if (callAsTimelock) {
            const note = `Set Farm at Elevation: ${tokenSymbol} - ${getElevationName(elevation)} - live<${live}>`
            return await timelockMethod.queue({
                dev,
                targetContractName: Contracts.Cartographer,
                txName: TimelockTxSig.Cartographer.SetFarm,
                txParams: txArgs,
                note,
                dryRun,
            })
        }
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [tokenAddress, elevation, live]
            await executeTxExpectEvent(dev, tx, txArgs, cartographer, EVENT.PoolUpdated, eventArgs, false)
        }
    },
    setTokenAllocation: async ({
        dev,
        tokenAddress,
        allocation,
        revertErr,
        callAsTimelock = false,
        dryRun = false,
        tokenSymbol = '',
    }: {
        dev: SignerWithAddress,
        tokenAddress: string,
        allocation: number,
        revertErr?: string,
        callAsTimelock?: boolean,
        dryRun?: boolean,
        tokenSymbol?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).setTokenAllocation
        const txArgs = [tokenAddress, allocation]

        if (callAsTimelock) {
            const note = `Set Token Allocation: ${tokenSymbol} - ${allocation}`
            return await timelockMethod.queue({
                dev,
                targetContractName: Contracts.Cartographer,
                txName: TimelockTxSig.Cartographer.SetTokenAllocation,
                txParams: txArgs,
                note,
                dryRun,
            })
        }
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [tokenAddress, allocation]
            await executeTxExpectEvent(dev, tx, txArgs, cartographer, EVENT.SetTokenAllocation, eventArgs, false)
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
            await executeTxExpectReversion(user, tx, txArgs, revertErr)
        } else {
            const depositFee = await getTokenDepositFee(tokenAddress)
            const expectedAfterFee = tokenAmountAfterDepositFee(amount, depositFee)
            const eventArgs = [user.address, tokenAddress, elevation, expectedAfterFee]
            await executeTxExpectEvent(user, tx, txArgs, cartographer, EVENT.Deposit, eventArgs, false)
        }
    },
    elevate: async ({
        user,
        tokenAddress,
        sourceElevation,
        targetElevation,
        amount,
        revertErr,
    }: {
        user: SignerWithAddress,
        tokenAddress: string,
        sourceElevation: number,
        targetElevation: number,
        amount: BigNumber,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(user).elevate
        const txArgs = [tokenAddress, sourceElevation, targetElevation, amount]

        if (revertErr != null) {
            await executeTxExpectReversion(user, tx, txArgs, revertErr)
        } else {
            const eventArgs = [user.address, tokenAddress, sourceElevation, targetElevation, amount]
            await executeTxExpectEvent(user, tx, txArgs, cartographer, EVENT.Elevate, eventArgs, false)
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
            await executeTxExpectReversion(user, tx, txArgs, revertErr)
        } else {
            const expectedClaimAmountWithBonus = await getTokenClaimableWithBonus(user.address, tokenAddress, elevation)
            if (expectedClaimAmountWithBonus.eq(0)) {
                await executeTx(user, tx, txArgs)
            } else {
                const eventArgs = eventOnly ? null : [user.address, expectedClaimAmountWithBonus]
                await executeTxExpectEvent(user, tx, txArgs, cartographer, EVENT.ClaimWinnings, eventArgs, false)
            }
        }
    },
    claimElevation: async ({
        user,
        elevation,
        eventOnly = false,
        revertErr,
    }: {
        user: SignerWithAddress,
        elevation: number,
        eventOnly?: boolean,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(user).claimElevation
        const txArgs = [elevation]
        
        if (revertErr != null) {
            await executeTxExpectReversion(user, tx, txArgs, revertErr)
        } else {
            const tokenClaimableWithBonuses = await tokenPromiseSequenceMap(
                async (token) => await getTokenClaimableWithBonus(user.address, token.address, elevation)
            )
            const totalClaimableWithBonuses = sumBigNumbers(tokenClaimableWithBonuses)
            const eventArgs = eventOnly ? null : [user.address, elevation, totalClaimableWithBonuses]
            await executeTxExpectEvent(user, tx, txArgs, cartographer, EVENT.ClaimElevation, eventArgs, false)
        }
    },
    emergencyWithdraw: async ({
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
        const tx = cartographer.connect(user).emergencyWithdraw
        const txArgs = [tokenAddress, elevation]
        
        if (revertErr != null) {
            await executeTxExpectReversion(user, tx, txArgs, revertErr)
        } else {
            const amount = (await subCartGet.userInfo(tokenAddress, elevation, user.address)).staked
            const userTokenTaxBP = await getUserTokenWithdrawalTax(user.address, tokenAddress)
            const amountAfterTax = tokenAmountAfterWithdrawTax(amount, userTokenTaxBP)
            const eventArgs = [user.address, tokenAddress, elevation, amountAfterTax]
            await executeTxExpectEvent(user, tx, txArgs, cartographer, EVENT.EmergencyWithdraw, eventOnly ? null : eventArgs, false)
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
            await executeTxExpectReversion(user, tx, txArgs, revertErr)
        } else {
            const userTokenTaxBP = await getUserTokenWithdrawalTax(user.address, tokenAddress)
            const amountAfterTax = tokenAmountAfterWithdrawTax(amount, userTokenTaxBP)
            const eventArgs = [user.address, tokenAddress, elevation, amountAfterTax]
            await executeTxExpectEvent(user, tx, txArgs, cartographer, EVENT.Withdraw, eventOnly ? null : eventArgs, false)
        }
    },
    // function elevateAndLockStakedSummit(uint8 _elevation, uint256 _amount)
    elevateAndLockStakedSummit: async ({
        user,
        elevation,
        amount,
        revertErr,
    }: {
        user: SignerWithAddress,
        elevation: number,
        amount: BigNumber,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(user).elevateAndLockStakedSummit
        const txArgs = [elevation, amount]
        
        if (revertErr != null) {
            await executeTxExpectReversion(user, tx, txArgs, revertErr)
        } else {
            const eventArgs = [user.address, elevation, amount]
            await executeTxExpectEvent(user, tx, txArgs, cartographer, EVENT.ElevateAndLockStakedSummit, eventArgs, false)
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
            await executeTxExpectReversion(user, tx, txArgs, revertErr)
        } else {
            const eventArgs = [user.address, elevation, totem]
            await executeTxExpectEvent(user, tx, txArgs, cartographer, EVENT.SwitchTotem, eventArgs, false)
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
        const { dev } = await ethers.getNamedSigners()

        const cartographer = await getCartographer()
        const tx = user != null ? cartographer.connect(user).rollover : cartographer.rollover
        const txArgs = [elevation]
        
        if (revertErr != null) {
            await executeTxExpectReversion(user || dev, tx, txArgs, revertErr)
        } else {
            await executeTxExpectEvent(user || dev, tx, txArgs, cartographer, EVENT.Rollover, null, false)
        }
    },
    setTokenPassthroughStrategy: async ({
        dev,
        tokenAddress,
        passthroughTargetAddress,
        revertErr,
        callAsTimelock = false,
        dryRun = false,
        tokenSymbol = '',
        queueEvenIfMatchingExists = false,
    }: {
        dev: SignerWithAddress
        tokenAddress: string,
        passthroughTargetAddress: string,
        revertErr?: string,
        callAsTimelock?: boolean,
        dryRun?: boolean,
        tokenSymbol?: string,
        queueEvenIfMatchingExists?: boolean,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).setTokenPassthroughStrategy
        const txArgs = [tokenAddress, passthroughTargetAddress]

        if (callAsTimelock) {
            const note = `Set Token Passthrough Strategy: ${tokenSymbol} - ${passthroughTargetAddress}`
            return await timelockMethod.queue({
                dev,
                targetContractName: Contracts.Cartographer,
                txName: TimelockTxSig.Cartographer.SetTokenPassthroughStrategy,
                txParams: txArgs,
                note,
                dryRun,
                queueEvenIfMatchingExists,
            })
        }
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [tokenAddress, passthroughTargetAddress]
            await executeTxExpectEvent(dev, tx, txArgs, cartographer, EVENT.SET_PASSTHROUGH_STRATEGY, eventArgs, false, { gasLimit: 2000000 })
        }
    },
    retireTokenPassthroughStrategy: async ({
        dev,
        tokenAddress,
        revertErr,
        callAsTimelock = false,
        dryRun = false,
        tokenSymbol = '',
        queueEvenIfMatchingExists = false,
    }: {
        dev: SignerWithAddress,
        tokenAddress: string,
        revertErr?: string,
        callAsTimelock?: boolean,
        dryRun?: boolean,
        tokenSymbol?: string,
        queueEvenIfMatchingExists?: boolean,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).retireTokenPassthroughStrategy
        const txArgs = [tokenAddress]

        if (callAsTimelock) {
            const note = `Retire Token Passthrough Strategy: ${tokenSymbol}`
            return await timelockMethod.queue({
                dev,
                targetContractName: Contracts.Cartographer,
                txName: TimelockTxSig.Cartographer.RetireTokenPassthroughStrategy,
                txParams: txArgs,
                note,
                dryRun,
                queueEvenIfMatchingExists,
            })
        }
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            await executeTxExpectEvent(dev, tx, txArgs, cartographer, EVENT.RETIRE_PASSTHROUGH_STRATEGY, null, false)
        }
    },
    migrateSummitOwnership: async ({
        dev,
        summitOwner,
        revertErr,
    }: {
        dev: SignerWithAddress
        summitOwner: string,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).migrateSummitOwnership
        const txArgs = [summitOwner]
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [summitOwner]
            await executeTxExpectEvent(dev, tx, txArgs, cartographer, EVENT.SummitOwnershipTransferred, eventArgs, false)
        }
    },
}

export const cartographerSetParam = {
    setTokenDepositFee: async ({
        dev,
        tokenAddress,
        feeBP,
        revertErr,
        callAsTimelock = false,
        dryRun = false,
        tokenSymbol = '',
    }: {
        dev: SignerWithAddress
        tokenAddress: string,
        feeBP: number,
        revertErr?: string,
        callAsTimelock?: boolean,
        dryRun?: boolean,
        tokenSymbol?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).setTokenDepositFee
        const txArgs = [tokenAddress, feeBP]

        if (callAsTimelock) {
            const note = `Set Token Deposit Fee: ${tokenSymbol} - ${feeBP}`
            return await timelockMethod.queue({
                dev,
                targetContractName: Contracts.Cartographer,
                txName: TimelockTxSig.Cartographer.SetTokenDepositFee,
                txParams: txArgs,
                note,
                dryRun,
            })
        }
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [tokenAddress, feeBP]
            await executeTxExpectEvent(dev, tx, txArgs, cartographer, EVENT.CartographerParam.SetTokenDepositFee, eventArgs, false)
        }
    },
    setTokenWithdrawTax: async ({
        dev,
        tokenAddress,
        taxBP,
        revertErr,
        callAsTimelock = false,
        dryRun = false,
        tokenSymbol = '',
    }: {
        dev: SignerWithAddress
        tokenAddress: string,
        taxBP: number,
        revertErr?: string,
        callAsTimelock?: boolean,
        dryRun?: boolean,
        tokenSymbol?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).setTokenWithdrawTax
        const txArgs = [tokenAddress, taxBP]

        if (callAsTimelock) {
            const note = `Set Token Withdrawal Tax: ${tokenSymbol} - ${taxBP}`
            return await timelockMethod.queue({
                dev,
                targetContractName: Contracts.Cartographer,
                txName: TimelockTxSig.Cartographer.SetTokenWithdrawTax,
                txParams: txArgs,
                note,
                dryRun,
            })
        }
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [tokenAddress, taxBP]
            await executeTxExpectEvent(dev, tx, txArgs, cartographer, EVENT.CartographerParam.SetTokenWithdrawTax, eventArgs, false)
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
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [taxDecayDuration]
            await executeTxExpectEvent(dev, tx, txArgs, cartographer, EVENT.CartographerParam.SetTaxDecayDuration, eventArgs, false)
        }
    },
    setBaseMinimumWithdrawalTax: async ({
        dev,
        baseMinimumWithdrawalTax,
        revertErr,
        callAsTimelock = false,
        dryRun = false,
    }: {
        dev: SignerWithAddress
        baseMinimumWithdrawalTax: number,
        revertErr?: string,
        callAsTimelock?: boolean,
        dryRun?: boolean,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).setBaseMinimumWithdrawalTax
        const txArgs = [baseMinimumWithdrawalTax]

        if (callAsTimelock) {
            const note = `Set Base Minimum Withdrawal Tax: ${baseMinimumWithdrawalTax}`
            return await timelockMethod.queue({
                dev,
                targetContractName: Contracts.Cartographer,
                txName: TimelockTxSig.Cartographer.SetBaseMinimumWithdrawalTax,
                txParams: txArgs,
                note,
                dryRun,
            })
        }
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [baseMinimumWithdrawalTax]
            await executeTxExpectEvent(dev, tx, txArgs, cartographer, EVENT.CartographerParam.SetBaseMinimumWithdrawalTax, eventArgs, false)
        }
    },
    setTokenIsNativeFarm: async ({
        dev,
        tokenAddress,
        tokenIsNativeFarm,
        revertErr,
        callAsTimelock = false,
        dryRun = false,
        tokenSymbol = '',
    }: {
        dev: SignerWithAddress
        tokenAddress: string,
        tokenIsNativeFarm: boolean,
        revertErr?: string,
        callAsTimelock?: boolean,
        dryRun?: boolean,
        tokenSymbol?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).setTokenIsNativeFarm
        const txArgs = [tokenAddress, tokenIsNativeFarm]

        if (callAsTimelock) {
            const note = `Set Token Is Native: ${tokenSymbol} - ${tokenIsNativeFarm}`
            return await timelockMethod.queue({
                dev,
                targetContractName: Contracts.Cartographer,
                txName: TimelockTxSig.Cartographer.SetTokenIsNativeFarm,
                txParams: txArgs,
                note,
                dryRun,
            })
        }
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [tokenAddress, tokenIsNativeFarm]
            await executeTxExpectEvent(dev, tx, txArgs, cartographer, EVENT.CartographerParam.SetTokenIsNativeFarm, eventArgs, false)
        }
    },
    setMaxBonusBP: async ({
        dev,
        maxBonusBP,
        revertErr,
    }: {
        dev: SignerWithAddress
        maxBonusBP: number,
        revertErr?: string,
    }) => {
        const cartographer = await getCartographer()
        const tx = cartographer.connect(dev).setMaxBonusBP
        const txArgs = [maxBonusBP]
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            const eventArgs = [maxBonusBP]
            await executeTxExpectEvent(dev, tx, txArgs, cartographer, EVENT.CartographerParam.SetMaxBonusBP, eventArgs, false)
        }
    },
}