import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre from "hardhat";
import { e18, ERR, toDecimal, getTimestamp, deltaBN, mineBlockWithTimestamp, promiseSequenceMap, getSummitToken, everestGet, everestMethod, days, getSummitBalance, getEverestBalance, userPromiseSequenceMap, allElevationPromiseSequenceMap, cartographerMethod, rolloverRoundUntilWinningTotem, getUserTotems, OASIS, getCakeToken, getBifiToken, epochDuration, getSummitGlacier, rolloverIfAvailable, rolloverRound, sumBigNumbers, tokenPromiseSequenceMap, cartographerGet, expect6FigBigNumberEquals, BURNADD, expectAllEqual, subCartGet, consoleLog, PLAINS, checkmarkIfBNEquals, checkmarkIfEquals, cartographerSetParam } from "../utils";
import { summitGlacierGet, summitGlacierMethod } from "../utils/summitGlacierUtils";
import { mesaUnlockedFixture, oasisUnlockedFixture, summitUnlockedFixture } from "./fixtures";


describe("STAKING BONUSES", async function() {
    before(async function () {
        await mesaUnlockedFixture()
    })

    it(`BONUS TIMESTAMP: TokenLastWithdrawTimestampForBonus is set correctly on initial deposit`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        const lastWithdrawTimestampForBonusInit = await cartographerGet.tokenLastWithdrawTimestampForBonus(user1.address, summitToken.address)
        expect(lastWithdrawTimestampForBonusInit).to.equal(0)

        await cartographerMethod.deposit({
            user: user1,
            tokenAddress: summitToken.address,
            elevation: OASIS,
            amount: e18(5),
        })
        const depositTimestamp = await getTimestamp()

        const lastWithdrawTimestampForBonusFinal = await cartographerGet.tokenLastWithdrawTimestampForBonus(user1.address, summitToken.address)
        expect(lastWithdrawTimestampForBonusFinal).to.equal(depositTimestamp)

        console.log({
            bonusTimestamp: `${lastWithdrawTimestampForBonusInit} --> ${lastWithdrawTimestampForBonusFinal}`
        })
    })
    it(`BONUS TIMESTAMP: TokenLastWithdrawTimestampForBonus doesn't update on further deposits`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        const lastWithdrawTimestampForBonusInit = await cartographerGet.tokenLastWithdrawTimestampForBonus(user1.address, summitToken.address)

        await cartographerMethod.deposit({
            user: user1,
            tokenAddress: summitToken.address,
            elevation: OASIS,
            amount: e18(5),
        })

        const lastWithdrawTimestampForBonusFinal = await cartographerGet.tokenLastWithdrawTimestampForBonus(user1.address, summitToken.address)
        expect(lastWithdrawTimestampForBonusFinal).to.equal(lastWithdrawTimestampForBonusInit)

        console.log({
            bonusTimestamp: `${lastWithdrawTimestampForBonusInit} --> ${lastWithdrawTimestampForBonusFinal}`
        })
    })

    it(`BONUS ACCRUAL: Before bonus starts accruing: TokenLastWithdrawTimestampForBonus doesnt update on withdraw`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        const lastWithdrawTimestampForBonusInit = await cartographerGet.tokenLastWithdrawTimestampForBonus(user1.address, summitToken.address)

        await cartographerMethod.withdraw({
            user: user1,
            tokenAddress: summitToken.address,
            elevation: OASIS,
            amount: e18(5),
        })

        const lastWithdrawTimestampForBonusFinal = await cartographerGet.tokenLastWithdrawTimestampForBonus(user1.address, summitToken.address)
        expect(lastWithdrawTimestampForBonusFinal).to.equal(lastWithdrawTimestampForBonusInit)

        console.log({
            bonusTimestamp: `${lastWithdrawTimestampForBonusInit} --> ${lastWithdrawTimestampForBonusFinal}`
        })
    })
    it(`BONUS ACCRUAL: Harvesting winnings doesn't reset bonus BP`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        const lastWithdrawTimestampForBonusInit = await cartographerGet.tokenLastWithdrawTimestampForBonus(user1.address, summitToken.address)

        await cartographerMethod.claimSingleFarm({
            user: user1,
            tokenAddress: summitToken.address,
            elevation: OASIS,
        })

        const lastWithdrawTimestampForBonusFinal = await cartographerGet.tokenLastWithdrawTimestampForBonus(user1.address, summitToken.address)
        expect(lastWithdrawTimestampForBonusFinal).to.equal(lastWithdrawTimestampForBonusInit)
    })
    it(`BONUS ACCRUAL: Bonus start accruing at 7 days, and accrues correctly and earns correctly over duration of 7 days, and remains at max indefinitely`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        const lastWithdrawTimestampForBonusInit = await cartographerGet.tokenLastWithdrawTimestampForBonus(user1.address, summitToken.address)

        const timestampOffsets = [
            days(0),
            days(1),
            days(2),
            days(3),
            days(4),
            days(5),
            days(6),
            days(7) - 1,
            days(7),
            days(7.5),
            days(8),
            days(9),
            days(10),
            days(11),
            days(12),
            days(13),
            days(14) - 1,
            days(15),
            days(16),
            days(30),
            days(60),
            days(180),
            days(365),
        ]

        const timestampOffsetsWithBonuses = timestampOffsets.map((offset) => {
            return {
                offset: offset,
                timestamp: lastWithdrawTimestampForBonusInit + offset,
                bonus: cartographerGet.calculateBonusFromOffset(offset),
            }
        })

        await promiseSequenceMap(
            timestampOffsetsWithBonuses,
            async (offsetWithBonus) => {
                await mineBlockWithTimestamp(offsetWithBonus.timestamp - 1)

                const lifetimeWinningsInit = await summitGlacierGet.getUserLifetimeWinnings(user1.address)
                const lifetimeBonusWinningsInit = await summitGlacierGet.getUserLifetimeBonusWinnings(user1.address)

                const claimableRewards = await cartographerGet.getTokenClaimableWithEmission(user1.address, summitToken.address, OASIS)

                await cartographerMethod.claimSingleFarm({
                    user: user1,
                    tokenAddress: summitToken.address,
                    elevation: OASIS
                })
                
                const cartBonusBP = await cartographerGet.getBonusBP(user1.address, summitToken.address)

                // Bonus BP Matches
                expect(cartBonusBP).to.equal(offsetWithBonus.bonus)

                // Bonus Emissions Correct
                const lifetimeWinningsFinal = await summitGlacierGet.getUserLifetimeWinnings(user1.address)
                const lifetimeBonusWinningsFinal = await summitGlacierGet.getUserLifetimeBonusWinnings(user1.address)

                const expectedBonusDelta = claimableRewards.mul(offsetWithBonus.bonus).div(10000)
                const bonusDelta = deltaBN(lifetimeBonusWinningsInit, lifetimeBonusWinningsFinal)
                const lifetimeWinningsDelta = deltaBN(lifetimeWinningsInit, lifetimeWinningsFinal)

                consoleLog({
                    days: offsetWithBonus.offset / (24 * 3600),
                    bonusBP: `${offsetWithBonus.bonus} ==? ${cartBonusBP} ${checkmarkIfEquals(offsetWithBonus.bonus, cartBonusBP)}`,
                    bonusDelta: `${toDecimal(expectedBonusDelta)} ==? ${toDecimal(bonusDelta)} ${checkmarkIfBNEquals(expectedBonusDelta, bonusDelta)}`,
                })

                expect(expectedBonusDelta).to.equal(bonusDelta)

                expect(lifetimeWinningsDelta).to.equal(claimableRewards.add(expectedBonusDelta))
            }
        )
    })

    it(`BONUS WITHDRAW: Withdraw after bonus starts accruing resets bonus to 0%, and starts accruing immediately`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        const lastWithdrawTimestampForBonusInit = await cartographerGet.tokenLastWithdrawTimestampForBonus(user1.address, summitToken.address)
        const bonusInit = await cartographerGet.getBonusBP(user1.address, summitToken.address)
        expect(bonusInit).to.equal(700)

        await cartographerMethod.withdraw({
            user: user1,
            tokenAddress: summitToken.address,
            elevation: OASIS,
            amount: e18(1),
        })
        const afterWithdrawTimestamp = await getTimestamp()

        const lastWithdrawTimestampForBonusMid = await cartographerGet.tokenLastWithdrawTimestampForBonus(user1.address, summitToken.address)
        expect(lastWithdrawTimestampForBonusMid).to.equal(afterWithdrawTimestamp - days(7))
        const bonusMid = await cartographerGet.getBonusBP(user1.address, summitToken.address)
        expect(bonusMid).to.equal(0)

        // Ensure bonus increases by 1% after 1 day from withdraw
        await mineBlockWithTimestamp(afterWithdrawTimestamp + days(1))
        const bonusFinal = await cartographerGet.getBonusBP(user1.address, summitToken.address)
        expect(bonusFinal).to.equal(100)
    })
    it(`BONUS TOKENS: Bonuses are tracked for each token independently`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const cakeToken = await getCakeToken()
        const summitToken = await getSummitToken()

        const cakeBonusInit = await cartographerGet.getBonusBP(user1.address, cakeToken.address)
        const summitBonusInit = await cartographerGet.getBonusBP(user1.address, summitToken.address)
        expect(cakeBonusInit).to.equal(0)
        expect(summitBonusInit).to.equal(100)

        await rolloverRound(PLAINS)
        await cartographerMethod.switchTotem({
            user: user1,
            elevation: PLAINS,
            totem: 0,
        })
        await cartographerMethod.deposit({
            user: user1,
            tokenAddress: cakeToken.address,
            elevation: OASIS,
            amount: e18(1)
        })
        const afterDepositTimestamp = await getTimestamp()

        await mineBlockWithTimestamp(afterDepositTimestamp + days(8))

        const cakeBonusFinal = await cartographerGet.getBonusBP(user1.address, cakeToken.address)
        const summitBonusFinal = await cartographerGet.getBonusBP(user1.address, summitToken.address)
        expect(cakeBonusFinal).to.equal(100)
        expect(summitBonusFinal).to.equal(700)
    })
    it(`BONUS TOKENS: Withdrawing from any farm of same token resets bonus to 0%`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const cakeToken = await getCakeToken()

        const cakeBonusInit = await cartographerGet.getBonusBP(user1.address, cakeToken.address)
        expect(cakeBonusInit).to.be.greaterThan(0)

        await rolloverRound(PLAINS)
        await cartographerMethod.deposit({
            user: user1,
            tokenAddress: cakeToken.address,
            elevation: PLAINS,
            amount: e18(1)
        })
        await cartographerMethod.withdraw({
            user: user1,
            tokenAddress: cakeToken.address,
            elevation: PLAINS,
            amount: e18(0.5)
        })

        const cakeBonusFinal = await cartographerGet.getBonusBP(user1.address, cakeToken.address)
        expect(cakeBonusFinal).to.equal(0)
    })
    
    it(`BONUS PARAMS: MaxBonusBP can be updated`, async function() {
        const { dev, user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()
        const cakeToken = await getCakeToken()

        const currentTimestamp = await getTimestamp()
        await mineBlockWithTimestamp(currentTimestamp + days(1) - 1)

        const cakeBonusInit = await cartographerGet.getBonusBP(user1.address, cakeToken.address)
        const summitBonusInit = await cartographerGet.getBonusBP(user1.address, summitToken.address)
        expect(cakeBonusInit).to.equal(99)
        expect(summitBonusInit).to.equal(700)

        await cartographerSetParam.setMaxBonusBP({
            dev,
            maxBonusBP: 1000,
        })

        const cakeBonusFinal = await cartographerGet.getBonusBP(user1.address, cakeToken.address)
        const summitBonusFinal = await cartographerGet.getBonusBP(user1.address, summitToken.address)
        expect(cakeBonusFinal).to.equal(Math.floor(100 * (1000 / 700)))
        expect(summitBonusFinal).to.equal(Math.floor(700 * (1000 / 700)))
    })
})