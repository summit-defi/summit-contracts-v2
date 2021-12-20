import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre from "hardhat";
import { e18, getTimestamp,  mineBlockWithTimestamp, getSummitToken, everestMethod, days, cartographerMethod, OASIS, getCakeToken, rolloverRound, cartographerGet, PLAINS, cartographerSetParam, sumBigNumbers, getSummitBalance, getTokenBalance, tokenAmountAfterWithdrawTax } from "../utils";
import { mesaUnlockedFixture } from "./fixtures";



describe("FAIRNESS TAX", async function() {
    before(async function () {
        await mesaUnlockedFixture()
    })

    it(`TAX TIMESTAMP: TokenLastDepositTimestampForTax is set correctly on initial deposit`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        const lastDepositTimestampForTaxInit = await cartographerGet.tokenLastDepositTimestampForTax(user1.address, summitToken.address)
        expect(lastDepositTimestampForTaxInit).to.equal(0)

        await cartographerMethod.deposit({
            user: user1,
            tokenAddress: summitToken.address,
            elevation: OASIS,
            amount: e18(5),
        })
        const depositTimestamp = await getTimestamp()

        const lastDepositTimestampForTaxFinal = await cartographerGet.tokenLastDepositTimestampForTax(user1.address, summitToken.address)
        expect(lastDepositTimestampForTaxFinal).to.equal(depositTimestamp)

        console.log({
            bonusTimestamp: `${lastDepositTimestampForTaxInit} --> ${lastDepositTimestampForTaxFinal}`
        })
    })

    it(`TAX TIMESTAMP: The fairness tax should not reset for a token when a use deposits < 5% of their current staked amount`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        const lastDepositTimestampForTaxInit = await cartographerGet.tokenLastDepositTimestampForTax(user1.address, summitToken.address)

        const _userStakedAmount = await cartographerGet.userTokenStakedAmount(user1.address, summitToken.address)
        const _taxResetOnDepositBP = await cartographerGet.taxResetOnDepositBP()
        const _newDepositAmount = _userStakedAmount.mul(_taxResetOnDepositBP).div(10000)

        await cartographerMethod.deposit({
            user: user1,
            tokenAddress: summitToken.address,
            elevation: OASIS,
            amount: _newDepositAmount,
        })
        const depositTimestamp = await getTimestamp()
        const lastDepositTimestampForTaxFinal = await cartographerGet.tokenLastDepositTimestampForTax(user1.address, summitToken.address)

        expect(lastDepositTimestampForTaxInit).to.equal(lastDepositTimestampForTaxFinal)
        expect(lastDepositTimestampForTaxFinal).to.not.equal(depositTimestamp)

        console.log({
            bonusTimestamp: `${lastDepositTimestampForTaxInit} --> ${lastDepositTimestampForTaxFinal}`
        })
    })

    it(`TAX TIMESTAMP: The fairness tax should reset for a token when a use deposits > 5% of their current staked amount`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        const lastDepositTimestampForTaxInit = await cartographerGet.tokenLastDepositTimestampForTax(user1.address, summitToken.address)

        const _userStakedAmount = await cartographerGet.userTokenStakedAmount(user1.address, summitToken.address)
        const _taxResetOnDepositBP = await cartographerGet.taxResetOnDepositBP()
        const _newDepositAmount = _userStakedAmount.mul(_taxResetOnDepositBP).div(10000).add(e18(1))

        await cartographerMethod.deposit({
            user: user1,
            tokenAddress: summitToken.address,
            elevation: OASIS,
            amount: _newDepositAmount,
        })
        const depositTimestamp = await getTimestamp()
        const lastDepositTimestampForTaxFinal = await cartographerGet.tokenLastDepositTimestampForTax(user1.address, summitToken.address)

        expect(lastDepositTimestampForTaxInit).to.not.equal(lastDepositTimestampForTaxFinal)
        expect(lastDepositTimestampForTaxFinal).to.equal(depositTimestamp)

        console.log({
            bonusTimestamp: `${lastDepositTimestampForTaxInit} --> ${lastDepositTimestampForTaxFinal}`
        })
    })

    it(`STAKED TOTAL AMOUNT FOR TOKEN: The user's total staked amount for token should be calculated correctly across all elevations`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()
        const oasisDepositAmount = e18(5)
        const plainsDepositAmount = e18(10)

        const userTotalStakedAmountBefore = await cartographerGet.userTokenStakedAmount(user1.address, summitToken.address)

        await cartographerMethod.deposit({
            user: user1,
            tokenAddress: summitToken.address,
            elevation: OASIS,
            amount: oasisDepositAmount,
        })

        await rolloverRound(PLAINS)
        await cartographerMethod.switchTotem({
            user: user1,
            elevation: PLAINS,
            totem: 0,
        })
        await cartographerMethod.deposit({
            user: user1,
            tokenAddress: summitToken.address,
            elevation: PLAINS,
            amount: plainsDepositAmount,
        })

        const userTotalStakedAmountAfter = await cartographerGet.userTokenStakedAmount(user1.address, summitToken.address)
        expect(userTotalStakedAmountAfter).to.equal(sumBigNumbers([userTotalStakedAmountBefore, oasisDepositAmount, plainsDepositAmount]))
    })

    it(`TAX BP: The fairness tax decreases correctly to the 0% for native farms, over the duration of the tax decay`, async function() {
        const { dev, user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        await cartographerSetParam.setTokenIsNativeFarm({
            dev,
            tokenAddress: summitToken.address,
            tokenIsNativeFarm: true
        })

        const taxBPEarlier = await cartographerGet.taxBP(user1.address, summitToken.address)
        expect(taxBPEarlier).to.equal(0)

        await cartographerMethod.deposit({
            user: user1,
            tokenAddress: summitToken.address,
            elevation: OASIS,
            amount: e18(5),
        })        

        const afterDepositTimestamp = await getTimestamp()
        await mineBlockWithTimestamp(afterDepositTimestamp + days(8))

        const taxBPAfter = await cartographerGet.taxBP(user1.address, summitToken.address)
        expect(taxBPAfter).to.equal(0)        
    })

    it(`TAX BP: The fairness tax decreases correctly to the minimum value, over the duration of the tax decay`, async function() {
        const { dev, user1 } = await getNamedSigners(hre)
        const cakeToken = await getCakeToken()

        const taxBPEarlier = await cartographerGet.taxBP(user1.address, cakeToken.address)
        expect(taxBPEarlier).to.equal(100)

        await cartographerSetParam.setTokenWithdrawTax({
            dev,
            tokenAddress: cakeToken.address,
            taxBP: 500
        })

        await cartographerMethod.deposit({
            user: user1,
            tokenAddress: cakeToken.address,
            elevation: OASIS,
            amount: e18(5),
        })

        const afterDepositTimestamp = await getTimestamp()
        await mineBlockWithTimestamp(afterDepositTimestamp + days(7))

        const taxBPAfter = await cartographerGet.taxBP(user1.address, cakeToken.address)
        expect(taxBPAfter).to.equal(100)
    })

    it(`WAIVED TAX: The fairness tax is waived when a use elevates their SUMMIT from the elevation farms to the Expedition`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const cakeToken = await getSummitToken()

        await cartographerMethod.deposit({
            user: user1,
            tokenAddress: cakeToken.address,
            elevation: OASIS,
            amount: e18(5),
        })
        await everestMethod.lockSummit({
            user: user1,
            amount: e18(1),
            lockDuration: days(7),
        })

        const userTotalStakedAmountBefore = await cartographerGet.userTokenStakedAmount(user1.address, cakeToken.address)
        await cartographerMethod.elevateAndLockStakedSummit({
            user: user1,
            elevation: OASIS,
            amount: e18(5),
        })
        const userTotalStakedAmountAfter = await cartographerGet.userTokenStakedAmount(user1.address, cakeToken.address)

        expect(userTotalStakedAmountAfter.add(e18(5))).to.equal(userTotalStakedAmountBefore)
    })

    it(`MINIMUM TAX: The 0% tax should be taken when a use withdraws from a farm after the tax has fully decayed (for native farms) `, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()
        const depositAmount = 5
        const withdrawAmount = 5

        await cartographerMethod.deposit({
            user: user1,
            tokenAddress: summitToken.address,
            elevation: OASIS,
            amount: e18(depositAmount),
        })    

        const afterDepositTimestamp = await getTimestamp()
        await mineBlockWithTimestamp(afterDepositTimestamp + days(8))

        const summitTokenBalanceBefore = await getSummitBalance(user1.address)
        await cartographerMethod.withdraw({
            user: user1,
            tokenAddress: summitToken.address,
            elevation: OASIS,
            amount: e18(withdrawAmount),
        })
        const summitTokenBalanceAfter = await getSummitBalance(user1.address)
        expect(summitTokenBalanceAfter).to.equal(summitTokenBalanceBefore.add(e18(withdrawAmount)))
    })

    it(`MINIMUM TAX: The baseMinimumWithdrawalTax (minimum tax) should be taken when a use withdraws from a farm after the tax has fully decayed (for non-native farms) `, async function() {        
        const { user1 } = await getNamedSigners(hre)
        const cakeToken = await getCakeToken()
        const depositAmount = 5
        const withdrawAmount = 5

        await cartographerMethod.deposit({
            user: user1,
            tokenAddress: cakeToken.address,
            elevation: OASIS,
            amount: e18(depositAmount),
        })

        const afterDepositTimestamp = await getTimestamp()
        await mineBlockWithTimestamp(afterDepositTimestamp + days(8))

        const cakeTokenBalanceBefore = await getTokenBalance(cakeToken, user1.address)

        await cartographerMethod.withdraw({
            user: user1,
            tokenAddress: cakeToken.address,
            elevation: OASIS,
            amount: e18(withdrawAmount),
        })  
        const cakeTokenBalanceAfter = await getTokenBalance(cakeToken, user1.address)


        const baseMinimumWithdrawalTax = await cartographerGet.baseMinimumWithdrawalTax()
        const realExpectedWithdrawAmount = e18(withdrawAmount).mul((10000 - baseMinimumWithdrawalTax)).div(10000)

        expect(cakeTokenBalanceAfter).to.equal(sumBigNumbers([cakeTokenBalanceBefore, realExpectedWithdrawAmount]))
    })

    it(`TAX WITHDRAW: The 0% withdrawal fee should be taken when a use withdraws from a farm after the tax has fully decayed (native farms) `, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()
        const withdrawAmount = 5

        const summitTokenBalanceBefore = await getSummitBalance(user1.address)

        await cartographerMethod.withdraw({
            user: user1,
            tokenAddress: summitToken.address,
            elevation: OASIS,
            amount: e18(withdrawAmount),
        })  
        const summitTokenBalanceAfter = await getSummitBalance(user1.address)
        expect(summitTokenBalanceAfter).to.equal(summitTokenBalanceBefore.add(e18(withdrawAmount)))
    })

    it(`TAX WITHDRAW: The correct Fairness Tax should be take when as user withdraws their funds while the tax is active (before finished decaying to minimum) `, async function() {
        const { user1 } = await getNamedSigners(hre)
        const cakeToken = await getCakeToken()
        const withdrawAmount = 5

        const cakeTokenBalanceBefore = await getTokenBalance(cakeToken, user1.address)

        await cartographerMethod.withdraw({
            user: user1,
            tokenAddress: cakeToken.address,
            elevation: OASIS,
            amount: e18(withdrawAmount),
        })  
        const cakeTokenBalanceAfter = await getTokenBalance(cakeToken, user1.address)


        const taxBP = await cartographerGet.taxBP(user1.address, cakeToken.address)
        const realExpectedWithdrawAmount = tokenAmountAfterWithdrawTax(e18(withdrawAmount), taxBP)

        expect(cakeTokenBalanceAfter).to.equal(cakeTokenBalanceBefore.add(realExpectedWithdrawAmount))
    })

    it(`TAX PARAMS: Fairness taxes can be set and updated for each token `, async function() {
        const { dev } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()
        const cakeToken = await getCakeToken()

        await cartographerSetParam.setTokenWithdrawTax({
            dev,
            tokenAddress: summitToken.address,
            taxBP: 100
        })

        await cartographerSetParam.setTokenWithdrawTax({
            dev,
            tokenAddress: cakeToken.address,
            taxBP: 500
        })

        const summitTokenWithdrawalTax = await cartographerGet.tokenWithdrawalTax(summitToken.address)
        const cakeTokenWithdrawalTax = await cartographerGet.tokenWithdrawalTax(cakeToken.address)

        expect(summitTokenWithdrawalTax).to.equal(100)
        expect(cakeTokenWithdrawalTax).to.equal(500)        
    })    

    it(`TAX PARAMS: Making a token as a native farm is successful `, async function() {
        const { dev } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()
        const cakeToken = await getCakeToken()

        await cartographerSetParam.setTokenIsNativeFarm({
            dev,
            tokenAddress: summitToken.address,
            tokenIsNativeFarm: true
        })
        await cartographerSetParam.setTokenIsNativeFarm({
            dev,
            tokenAddress: cakeToken.address,
            tokenIsNativeFarm: true
        })

        expect(await cartographerGet.isNativeFarmToken(summitToken.address)).to.equal(true)
        expect(await cartographerGet.isNativeFarmToken(cakeToken.address)).to.equal(true)
    })  
})