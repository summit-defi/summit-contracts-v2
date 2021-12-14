import { Contract } from "@ethersproject/contracts";
import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { e18, ERR, EVENT, OASIS, PLAINS, MESA, SUMMIT, EXPEDITION, depositedAfterFee, mineBlockWithTimestamp, toDecimal, expect6FigBigNumberEquals, deltaBN, expect6FigBigNumberAllEqual, promiseSequenceMap, rolloverIfAvailable, consoleLog, Contracts, rolloverRound, cartographerMethod, subCartGet, tokenAmountAfterDepositFee, cartographerGet, getSummitToken, cartographerSetParam, onlyElevationPromiseSequenceMap } from "../utils";
import { expeditionUnlockedFixture } from "./fixtures";


const elevateTestSeries = async (token: Contract) => {
    const { user1 } = await getNamedSigners(hre)

    const amount = e18(5)
    const depositFee = await cartographerGet.getTokenDepositFee(token.address)
    const amountAfterFee = tokenAmountAfterDepositFee(amount, depositFee)
    
    await cartographerMethod.deposit({
        user: user1,
        tokenAddress: token.address,
        elevation: OASIS,
        amount: e18(5)
    })

    const elevates = [
        { sourceElevation: OASIS, targetElevation: PLAINS },
        { sourceElevation: PLAINS, targetElevation: MESA },
        { sourceElevation: MESA, targetElevation: SUMMIT },
        { sourceElevation: SUMMIT, targetElevation: OASIS },
    ]

    await promiseSequenceMap(
        elevates,
        async ({ sourceElevation, targetElevation }) => {

            const sourceElevationStakedInit = (await subCartGet.userInfo(token.address, sourceElevation, user1.address)).staked
            expect(sourceElevationStakedInit).to.equal(amountAfterFee)
            const targetElevationStakedInit = (await subCartGet.userInfo(token.address, targetElevation, user1.address)).staked
            expect(targetElevationStakedInit).to.equal(0)

            await cartographerMethod.elevate({
                user: user1,
                tokenAddress: token.address,
                sourceElevation,
                targetElevation,
                amount: amountAfterFee
            })

            const sourceElevationStakedFinal = (await subCartGet.userInfo(token.address, sourceElevation, user1.address)).staked
            expect(sourceElevationStakedFinal).to.equal(0)
            const targetElevationStakedFinal = (await subCartGet.userInfo(token.address, targetElevation, user1.address)).staked
            expect(targetElevationStakedFinal).to.equal(amountAfterFee)
        }
    )
}


describe("Elevation", function() {
    before(async function() {
        const { dev, user1, bifiToken } = await expeditionUnlockedFixture()
        await rolloverRound(SUMMIT)
        await rolloverRound(MESA)
        await rolloverRound(PLAINS)

        await cartographerSetParam.setTokenDepositFee({
            dev,
            tokenAddress: bifiToken.address,
            feeBP: 100,
        })

        await onlyElevationPromiseSequenceMap(
            async (elevation) => {
                await cartographerMethod.switchTotem({
                    user: user1,
                    elevation,
                    totem: 0,
                })
            }
        )
    })

    it('Standard elevate should succeed', async function() {
        const summitToken = await getSummitToken()
        await elevateTestSeries(summitToken)
    })
    it('Passthrough elevate should succeed with deposit fee taken', async function() {
        const bifiToken = await ethers.getContract('DummyBIFI')
        await elevateTestSeries(bifiToken)
    })
    it(`Elevating to a pool at the current elevation will fail with error ${ERR.ELEVATE.NO_SAME_ELEV_TRANSFER}`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        await cartographerMethod.elevate({
            user: user1,
            tokenAddress: summitToken.address,
            sourceElevation: OASIS,
            targetElevation: OASIS,
            amount: e18(5),
            revertErr: ERR.ELEVATE.NO_SAME_ELEV_TRANSFER
        })
    })
    it(`Elevating with zero amount will fail with error ${ERR.ELEVATE.NON_ZERO_AMOUNT}`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        await cartographerMethod.elevate({
            user: user1,
            tokenAddress: summitToken.address,
            sourceElevation: OASIS,
            targetElevation: PLAINS,
            amount: e18(0),
            revertErr: ERR.ELEVATE.NON_ZERO_AMOUNT
        })
    })
    it(`Elevating more than staked will fail with error ${ERR.BAD_WITHDRAWAL}`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        await cartographerMethod.elevate({
            user: user1,
            tokenAddress: summitToken.address,
            sourceElevation: OASIS,
            targetElevation: PLAINS,
            amount: e18(100),
            revertErr: ERR.BAD_WITHDRAWAL
        })
    })
    it(`Elevating to an elevation without a selected totem should fail with error ${ERR.TOTEM_NOT_SELECTED}`, async function() {
        const { user2 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        await cartographerMethod.deposit({
            user: user2,
            tokenAddress: summitToken.address,
            elevation: OASIS,
            amount: e18(5)
        })
        await cartographerMethod.elevate({
            user: user2,
            tokenAddress: summitToken.address,
            sourceElevation: OASIS,
            targetElevation: PLAINS,
            amount: e18(5),
            revertErr: ERR.TOTEM_NOT_SELECTED
        })
    })
})
