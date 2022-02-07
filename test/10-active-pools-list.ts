import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { e18, ERR, toDecimal, getTimestamp, deltaBN, mineBlockWithTimestamp, promiseSequenceMap, getSummitToken, everestGet, everestMethod, days, getSummitBalance, getEverestBalance, userPromiseSequenceMap, allElevationPromiseSequenceMap, cartographerMethod, rolloverRoundUntilWinningTotem, getUserTotems, OASIS, getCakeToken, getBifiToken, epochDuration, getSummitGlacier, rolloverIfAvailable, rolloverRound, sumBigNumbers, tokenPromiseSequenceMap, cartographerGet, expect6FigBigNumberEquals, BURNADD, expectAllEqual, usersInteractingPoolsLists, subCartGet, onlyElevationPromiseSequenceMap, getInvUserTotems, getContract, PLAINS } from "../utils";
import { summitGlacierGet, summitGlacierMethod } from "../utils/summitGlacierUtils";
import { oasisUnlockedFixture, summitUnlockedFixture } from "./fixtures";



describe("ACTIVE POOLS LIST", async function() {
    before(async function () {
        const { user1 } = await summitUnlockedFixture()
        const userTotems = await getUserTotems()

        await allElevationPromiseSequenceMap(
            async (elevation) => rolloverIfAvailable(elevation)
        )

        await userPromiseSequenceMap(
            async (user) => {
                await allElevationPromiseSequenceMap(
                    async (elevation) => {
                        await cartographerMethod.switchTotem({
                            user,
                            elevation,
                            totem: userTotems[user.address]
                        })
                    }
                )
            }
        )

        await everestMethod.lockSummit({
            user: user1,
            amount: e18(1),
            lockDuration: days(30),
        })
    })

    it('ADD: Adding a live pool adds it to the active pools list immediately', async function () {
        const { dev } = await ethers.getNamedSigners()
        const gs1 = await getContract('GS1')

        const activePoolsInit = await subCartGet.getActivePools(PLAINS)
        expect(activePoolsInit.includes(gs1.address)).to.be.false

        await cartographerMethod.setTokenAllocation({
            dev,
            tokenAddress: gs1.address,
            allocation: 200
        })
        await cartographerMethod.add({
            dev,
            tokenAddress: gs1.address,
            elevation: PLAINS,
            live: true,
            withUpdate: true,
        })

        const activePoolsFinal = await subCartGet.getActivePools(PLAINS)
        expect(activePoolsFinal.includes(gs1.address)).to.be.true
    })
    it('SET: Setting a pool non-live removes if from the active pools list at the end of the round', async function() {
        const { dev } = await ethers.getNamedSigners()
        const gs1 = await getContract('GS1')

        const activePoolsInit = await subCartGet.getActivePools(PLAINS)
        expect(activePoolsInit.includes(gs1.address)).to.be.true

        await cartographerMethod.set({
            dev,
            tokenAddress: gs1.address,
            elevation: PLAINS,
            live: false,
            withUpdate: true,
        })

        const activePoolsMid = await subCartGet.getActivePools(PLAINS)
        expect(activePoolsMid.includes(gs1.address)).to.be.true

        await rolloverRound(PLAINS)

        const activePoolsFinal = await subCartGet.getActivePools(PLAINS)
        expect(activePoolsFinal.includes(gs1.address)).to.be.false
    })
    it('ADD: Adding a non-live pool doesnt add it to the active pools list immediately', async function() {
        const { dev } = await ethers.getNamedSigners()
        const gs2 = await getContract('GS2')

        const activePoolsInit = await subCartGet.getActivePools(PLAINS)
        expect(activePoolsInit.includes(gs2.address)).to.be.false

        await cartographerMethod.setTokenAllocation({
            dev,
            tokenAddress: gs2.address,
            allocation: 200
        })
        await cartographerMethod.add({
            dev,
            tokenAddress: gs2.address,
            elevation: PLAINS,
            live: false,
            withUpdate: true,
        })

        const activePoolsFinal = await subCartGet.getActivePools(PLAINS)
        expect(activePoolsFinal.includes(gs2.address)).to.be.false
    })
    it('SET: Setting a pool live adds it to the active pools list immediately', async function() {
        const { dev } = await ethers.getNamedSigners()
        const gs2 = await getContract('GS2')

        const activePoolsInit = await subCartGet.getActivePools(PLAINS)
        expect(activePoolsInit.includes(gs2.address)).to.be.false

        await cartographerMethod.set({
            dev,
            tokenAddress: gs2.address,
            elevation: PLAINS,
            live: true,
            withUpdate: true,
        })

        const activePoolsFinal = await subCartGet.getActivePools(PLAINS)
        expect(activePoolsFinal.includes(gs2.address)).to.be.true
    })
})