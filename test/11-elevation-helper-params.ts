import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre from "hardhat";
import { e18, ERR, toDecimal, getTimestamp, deltaBN, mineBlockWithTimestamp, promiseSequenceMap, getSummitToken, everestGet, everestMethod, days, getSummitBalance, getEverestBalance, userPromiseSequenceMap, allElevationPromiseSequenceMap, cartographerMethod, rolloverRoundUntilWinningTotem, getUserTotems, OASIS, getCakeToken, getBifiToken, epochDuration, getSummitLocking, rolloverIfAvailable, rolloverRound, sumBigNumbers, tokenPromiseSequenceMap, cartographerGet, expect6FigBigNumberEquals, BURNADD, expectAllEqual, usersInteractingPoolsLists, subCartGet, onlyElevationPromiseSequenceMap, getInvUserTotems, getContract, PLAINS, cartographerSynth, elevationHelperMethod, sumNumbers, e12, mineBlocks } from "../utils";
import { summitLockingGet, summitLockingMethod } from "../utils/summitLockingUtils";
import { oasisUnlockedFixture, tenThousandUnlockedFixture } from "./fixtures";



describe("UPDATING ELEVATION EMISSIONS", async function() {
    before(async function () {
        const { user1, summitToken } = await tenThousandUnlockedFixture()
        const userTotems = await getUserTotems()

        await allElevationPromiseSequenceMap(
            async (elevation) => rolloverIfAvailable(elevation)
        )

        await allElevationPromiseSequenceMap(
            async (elevation) => {
                await cartographerMethod.switchTotem({
                    user: user1,
                    elevation,
                    totem: userTotems[user1.address]
                })
                await cartographerMethod.deposit({
                    user: user1,
                    elevation,
                    tokenAddress: summitToken.address,
                    amount: e18(1),
                })
            }
        )
    })

    it(`ALLOC MULTIPLIER: Invalid alloc multipliers should revert with err "${ERR.ELEVATION_HELPER.MULT_CANT_EXCEED_3X}"`, async function() {
        const { dev } = await getNamedSigners(hre)

        await elevationHelperMethod.setElevationAllocMultiplier({
            dev,
            elevation: OASIS,
            allocMultiplier: 500,
            revertErr: ERR.ELEVATION_HELPER.MULT_CANT_EXCEED_3X,
        })
    })

    it('ALLOC MULTIPLIER: Updating the emissions of the OASIS updates accordingly', async function () {
        const { dev } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        const elevAllocInit = [100, 110, 125, 150]
        const elevAllocTotalInit = sumNumbers(elevAllocInit)
        const elevAllocFinal = [50, 110, 125, 150]
        const elevAllocTotalFinal = sumNumbers(elevAllocFinal)

        await allElevationPromiseSequenceMap(
            async (elevation) => {
                const mult = (await cartographerGet.tokenElevationEmissionMultiplier(summitToken.address, elevation)).toNumber()
                console.log({
                    mult,
                    expectedMult: e12(1).mul(elevAllocInit[elevation]).div(elevAllocTotalInit).toNumber()
                })
                expect(mult).to.equal(e12(1).mul(elevAllocInit[elevation]).div(elevAllocTotalInit).toNumber())
            }
        )

        await elevationHelperMethod.setElevationAllocMultiplier({
            dev,
            elevation: OASIS,
            allocMultiplier: 50,
        })

        await allElevationPromiseSequenceMap(
            async (elevation) => {
                const mult = (await cartographerGet.tokenElevationEmissionMultiplier(summitToken.address, elevation)).toNumber()
                console.log({
                    mult,
                    expectedMult: e12(1).mul(elevAllocFinal[elevation]).div(elevAllocTotalFinal).toNumber()
                })
                expect(mult).to.equal(e12(1).mul(elevAllocFinal[elevation]).div(elevAllocTotalFinal).toNumber())
            }
        )
    })
    it('ALLOC MULTIPLIER: Updating the emissions of Elevations updates after round rollover', async function () {
        const { dev } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        const elevAllocInit = [50, 110, 125, 150]
        const elevAllocTotalInit = sumNumbers(elevAllocInit)
        const elevAllocFinal = [50, 95, 125, 150]
        const elevAllocTotalFinal = sumNumbers(elevAllocFinal)

        await allElevationPromiseSequenceMap(
            async (elevation) => {
                const mult = (await cartographerGet.tokenElevationEmissionMultiplier(summitToken.address, elevation)).toNumber()
                console.log({
                    mult,
                    expectedMult: e12(1).mul(elevAllocInit[elevation]).div(elevAllocTotalInit).toNumber()
                })
                expect(mult).to.equal(e12(1).mul(elevAllocInit[elevation]).div(elevAllocTotalInit).toNumber())
            }
        )

        await elevationHelperMethod.setElevationAllocMultiplier({
            dev,
            elevation: PLAINS,
            allocMultiplier: 95,
        })

        await allElevationPromiseSequenceMap(
            async (elevation) => {
                const mult = (await cartographerGet.tokenElevationEmissionMultiplier(summitToken.address, elevation)).toNumber()
                console.log({
                    mult,
                    expectedMult: e12(1).mul(elevAllocInit[elevation]).div(elevAllocTotalInit).toNumber()
                })
                expect(mult).to.equal(e12(1).mul(elevAllocInit[elevation]).div(elevAllocTotalInit).toNumber())
            }
        )

        await rolloverRound(PLAINS)

        await allElevationPromiseSequenceMap(
            async (elevation) => {
                const mult = (await cartographerGet.tokenElevationEmissionMultiplier(summitToken.address, elevation)).toNumber()
                console.log({
                    mult,
                    expectedMult: e12(1).mul(elevAllocFinal[elevation]).div(elevAllocTotalFinal).toNumber()
                })
                expect(mult).to.equal(e12(1).mul(elevAllocFinal[elevation]).div(elevAllocTotalFinal).toNumber())
            }
        )
    })
    it('ALLOC MULTIPLIER: Setting the allocation to 0 earns 0 rewards', async function() {
        const { dev, user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        await elevationHelperMethod.setElevationAllocMultiplier({
            dev,
            elevation: OASIS,
            allocMultiplier: 0,
        })

        await elevationHelperMethod.setElevationAllocMultiplier({
            dev,
            elevation: PLAINS,
            allocMultiplier: 0
        })

        const oasisRewardsInit = await subCartGet.poolClaimableRewards(summitToken.address, OASIS, user1.address)
        const plainsRewardsInit = await subCartGet.poolYieldContributed(summitToken.address, PLAINS, user1.address)

        await mineBlocks(10)
        
        const oasisRewardsMid = await subCartGet.poolClaimableRewards(summitToken.address, OASIS, user1.address)
        const plainsRewardsMid = await subCartGet.poolYieldContributed(summitToken.address, PLAINS, user1.address)
        expect(deltaBN(oasisRewardsInit, oasisRewardsMid)).to.equal(0)
        expect(deltaBN(plainsRewardsInit, plainsRewardsMid).gt(0)).to.be.true

        await rolloverRound(PLAINS)

        const plainsRewardsFinal0 = await subCartGet.poolClaimableRewards(summitToken.address, OASIS, user1.address)

        await mineBlocks(10)

        const plainsRewardsFinal1 = await subCartGet.poolYieldContributed(summitToken.address, PLAINS, user1.address)

        expect(deltaBN(plainsRewardsFinal0, plainsRewardsFinal1)).to.equal(0)
    })


    it(`ROUND DURATION: Elevation round durations can be updated`, async function() {
        const { dev } = await getNamedSigners(hre)
        await rolloverRound(PLAINS)

        await elevationHelperMethod.setElevationRoundDurationMult({
            dev,
            elevation: PLAINS,
            roundDurationMult: 0,
            revertErr: ERR.ELEVATION_HELPER.ROUND_DURATION_NON_ZERO
        })

        await rolloverRound(PLAINS)

        await elevationHelperMethod.setElevationRoundDurationMult({
            dev,
            elevation: PLAINS,
            roundDurationMult: 1,
        })

        await rolloverRound(PLAINS)
    })
})