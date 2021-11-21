import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { e18, ERR, EVENT, toDecimal, Contracts, INF_APPROVE, getTimestamp, deltaBN, expect6FigBigNumberAllEqual, mineBlockWithTimestamp, e36, EXPEDITION, promiseSequenceMap, expect6FigBigNumberEquals, e12, e0, consoleLog, expectAllEqual } from "..";
import { getEverestLockMultiplier, getExpectedEverest } from "../everestUtils";
import { oasisUnlockedFixture } from "../fixtures";


const rolloverExpedition = async () => {
    const elevationHelper = await ethers.getContract(Contracts.ElevationHelper)
    const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
    const cartographer = await ethers.getContract(Contracts.Cartographer)

    const expeditionRoundEndTime = (await elevationHelper.roundEndTimestamp(EXPEDITION)).toNumber()
    await mineBlockWithTimestamp(expeditionRoundEndTime)

    await cartographer.rollover(EXPEDITION)
    await expeditionV2.rollover()
}
const rolloverExpeditionMultiRounds = async (roundsToRollover: number) => {
    for (let i = 0; i < roundsToRollover; i++) {
        await rolloverExpedition()
    }
}
const expeditionPrevWinningTotem = async () => {
    const elevationHelper = await ethers.getContract(Contracts.ElevationHelper)
    const round = await elevationHelper.roundNumber(EXPEDITION)
    return await elevationHelper.winningTotem(EXPEDITION, round - 1)
}
const _getUserSafeAmount = (everestInfo: any) => {
    return everestInfo.everestOwned.mul(everestInfo.safetyFactor).div(100)
}
const _getUserDeitiedAmount = (everestInfo: any) => {
    return everestInfo.everestOwned.mul(e0(100).sub(everestInfo.safetyFactor)).div(100).mul(120).div(100)
}
const getUserSafeAmount = async (user: SignerWithAddress) => {
    const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
    const everestInfo = await expeditionV2.userEverestInfo(user.address)

    return _getUserSafeAmount(everestInfo)
}
const getUserDeitiedAmount = async (user: SignerWithAddress) => {
    const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
    const everestInfo = await expeditionV2.userEverestInfo(user.address)

    return _getUserDeitiedAmount(everestInfo)
}
const getUserSafeAndDeitiedAmount = async (user: SignerWithAddress) => {
    const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
    const everestInfo = await expeditionV2.userEverestInfo(user.address)
    
    return {
        safe: _getUserSafeAmount(everestInfo),
        deitied: _getUserDeitiedAmount(everestInfo)
    }
}
const expectUserAndExpedSuppliesToMatch = async () => {
    const { user1, user2, user3 } = await getNamedSigners(hre)
    const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
    const dummyCakeToken = await ethers.getContract(Contracts.DummyCAKE)

    const users = [user1, user2, user3]

    const usersEverestInfo = await promiseSequenceMap(
        users,
        async (user) => await expeditionV2.userEverestInfo(user.address)
    )
    const { safeSupply, deity0Supply, deity1Supply } = usersEverestInfo.reduce((acc, everestInfo) => ({
        safeSupply: acc.safeSupply.add(everestInfo.everestOwned.mul(everestInfo.safetyFactor).div(100)),
        deity0Supply: acc.deity0Supply.add(everestInfo.deity !== 0 ? 0 : _getUserDeitiedAmount(everestInfo)),
        deity1Supply: acc.deity1Supply.add(everestInfo.deity !== 1 ? 0 : _getUserDeitiedAmount(everestInfo)),
    }), { safeSupply: e18(0), deity0Supply: e18(0), deity1Supply: e18(0) })

    const [expedSafeSupply, expedDeitiedSupply, expedDeity0Supply, expedDeity1Supply] = await expeditionV2.supply(dummyCakeToken.address)

    consoleLog({
        SafeSupply: `${toDecimal(expedSafeSupply)} should equal ${toDecimal(safeSupply)}`,
        Deity0Supply: `${toDecimal(expedDeity0Supply)} should equal ${toDecimal(deity0Supply)}`,
        Deity1Supply: `${toDecimal(expedDeity1Supply)} should equal ${toDecimal(deity1Supply)}`,
        DeitiedSupply: `${toDecimal(expedDeitiedSupply)} should equal ${toDecimal(deity0Supply.add(deity1Supply))}`,
    })

    expect(expedSafeSupply).to.equal(safeSupply)
    expect(expedDeity0Supply).to.equal(deity0Supply)
    expect(expedDeity1Supply).to.equal(deity1Supply)
    expect(expedDeitiedSupply).to.equal(deity0Supply.add(deity1Supply))
}


describe("EXPEDITION V2", async function() {
    before(async function () {
        const { everestToken, summitToken, dummySummitLpToken, dummyCakeToken, expeditionV2, user1, user2, user3 } = await oasisUnlockedFixture()

        await everestToken.connect(user1).approve(expeditionV2.address, INF_APPROVE)
        await everestToken.connect(user2).approve(expeditionV2.address, INF_APPROVE)
        await everestToken.connect(user3).approve(expeditionV2.address, INF_APPROVE)

        await summitToken.connect(user1).approve(expeditionV2.address, INF_APPROVE)
        await summitToken.connect(user2).approve(expeditionV2.address, INF_APPROVE)
        await summitToken.connect(user3).approve(expeditionV2.address, INF_APPROVE)

        await dummySummitLpToken.connect(user1).approve(expeditionV2.address, INF_APPROVE)
        await dummySummitLpToken.connect(user2).approve(expeditionV2.address, INF_APPROVE)
        await dummySummitLpToken.connect(user3).approve(expeditionV2.address, INF_APPROVE)

        await dummyCakeToken.connect(user1).approve(expeditionV2.address, INF_APPROVE)
        await dummyCakeToken.connect(user2).approve(expeditionV2.address, INF_APPROVE)
        await dummyCakeToken.connect(user3).approve(expeditionV2.address, INF_APPROVE)
    })


    it(`EVEREST: Locking for less than min time throws error "${ERR.EVEREST.INVALID_LOCK_PERIOD}"`, async function () {
        const { user1 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)

        await expect(
                expeditionV2.connect(user1).lockSummit(e18(1), e18(1), 12 * 3600)
        ).to.be.revertedWith(ERR.EVEREST.INVALID_LOCK_PERIOD)

        await expect(
                expeditionV2.connect(user1).lockSummit(e18(1), e18(1), 400 * 24 * 3600)
        ).to.be.revertedWith(ERR.EVEREST.INVALID_LOCK_PERIOD)
    })
    it(`EVEREST: Locking more than user's balance throws error "${ERR.ERC20.EXCEEDS_BALANCE}"`, async function () {
        const { user1 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)

        await expect(
                expeditionV2.connect(user1).lockSummit(e18(100000), 0, 36 * 3600)
        ).to.be.revertedWith(ERR.ERC20.EXCEEDS_BALANCE)

        await expect(
                expeditionV2.connect(user1).lockSummit(e18(0), e18(100000), 36 * 3600)
        ).to.be.revertedWith(ERR.ERC20.EXCEEDS_BALANCE)
    })



    it(`LOCK EVEREST: Depositing SUMMIT for EVEREST for different lock periods should succeed`, async function() {
        const { user1, user2 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
        const summitToken = await ethers.getContract(Contracts.SummitToken)
        const dummySummitLp = await ethers.getContract(Contracts.DummySUMMITLP)
        const everestToken = await ethers.getContract(Contracts.EverestToken)

        const user1ExpectedEverest = await getExpectedEverest(e18(1), e18(1), 24 * 3600)
        const user2ExpectedEverest = await getExpectedEverest(e18(1), e18(1), 365 * 24 * 3600)
        const user1EverestLockMultiplier = await getEverestLockMultiplier(24 * 3600)
        const user2EverestLockMultiplier = await getEverestLockMultiplier(365 * 24 * 3600)

        const user1InitSummit = await summitToken.balanceOf(user1.address)
        const user1InitSummitLp = await dummySummitLp.balanceOf(user1.address)
        const user1InitEverest = await everestToken.balanceOf(user1.address)
        const user2InitSummit = await summitToken.balanceOf(user2.address)
        const user2InitSummitLp = await dummySummitLp.balanceOf(user2.address)
        const user2InitEverest = await everestToken.balanceOf(user2.address)

        consoleLog({
            user1ExpectedEverest: toDecimal(user1ExpectedEverest),
            user2ExpectedEverest: toDecimal(user2ExpectedEverest),
            user1EverestLockMultiplier,
            user2EverestLockMultiplier,
        })

        const user1Timestamp = await getTimestamp()
        await expect(
            expeditionV2.connect(user1).lockSummit(e18(1), e18(1), 24 * 3600)
        ).to.emit(expeditionV2, EVENT.EVEREST.SummitLocked).withArgs(user1.address, e18(1), e18(1), 24 * 3600, user1ExpectedEverest)

        const user2Timestamp = await getTimestamp()
        await expect(
            expeditionV2.connect(user2).lockSummit(e18(1), e18(1), 365 * 24 * 3600)
        ).to.emit(expeditionV2, EVENT.EVEREST.SummitLocked).withArgs(user2.address, e18(1), e18(1), 365 * 24 * 3600, user2ExpectedEverest)

        const user1EverestInfo = await expeditionV2.userEverestInfo(user1.address)
        const user2EverestInfo = await expeditionV2.userEverestInfo(user2.address)

        const user1FinalSummit = await summitToken.balanceOf(user1.address)
        const user1FinalSummitLp = await dummySummitLp.balanceOf(user1.address)
        const user1FinalEverest = await everestToken.balanceOf(user1.address)
        const user2FinalSummit = await summitToken.balanceOf(user2.address)
        const user2FinalSummitLp = await dummySummitLp.balanceOf(user2.address)
        const user2FinalEverest = await everestToken.balanceOf(user2.address)

        expect(user1EverestInfo.everestOwned).to.equal(user1ExpectedEverest)
        expect(user1EverestInfo.everestLockMultiplier).to.equal(user1EverestLockMultiplier)
        expect(user1EverestInfo.lockRelease).to.equal(user1Timestamp + (24 * 3600) + 1)
        expect(user1EverestInfo.summitLocked).to.equal(e18(1))
        expect(user1EverestInfo.summitLpLocked).to.equal(e18(1))
        expect(deltaBN(user1InitSummit, user1FinalSummit)).to.equal(e18(1))
        expect(deltaBN(user1InitSummitLp, user1FinalSummitLp)).to.equal(e18(1))
        expect(deltaBN(user1InitEverest, user1FinalEverest)).to.equal(user1ExpectedEverest)

        expect(user2EverestInfo.everestOwned).to.equal(user2ExpectedEverest)
        expect(user2EverestInfo.everestLockMultiplier).to.equal(user2EverestLockMultiplier)
        expect(user2EverestInfo.lockRelease).to.equal(user2Timestamp + (365 * 24 * 3600) + 1)
        expect(user2EverestInfo.summitLocked).to.equal(e18(1))
        expect(user2EverestInfo.summitLpLocked).to.equal(e18(1))
        expect(deltaBN(user2InitSummit, user2FinalSummit)).to.equal(e18(1))
        expect(deltaBN(user2InitSummitLp, user2FinalSummitLp)).to.equal(e18(1))
        expect(deltaBN(user2InitEverest, user2FinalEverest)).to.equal(user2ExpectedEverest)
    })

    it(`INCREASE EVEREST: User with already locked summit cannot do another initial lock, or throws "${ERR.EVEREST.MUST_NOT_OWN_EVEREST}"`, async function () {
        const { user1 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)

        await expect(
                expeditionV2.connect(user1).lockSummit(e18(5), 0, 36 * 3600)
        ).to.be.revertedWith(ERR.EVEREST.MUST_NOT_OWN_EVEREST)
    })

    it(`INCREASE EVEREST: User with already locked summit should be able to lock more summit`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
        const summitToken = await ethers.getContract(Contracts.SummitToken)
        const everestToken = await ethers.getContract(Contracts.EverestToken)
        
        const user1InitSummit = await summitToken.balanceOf(user1.address)
        const everestInit = await everestToken.balanceOf(user1.address)
        const everestInfoInit = await expeditionV2.userEverestInfo(user1.address)
        
        const user1ExpectedEverest = await getExpectedEverest(e18(5), e18(0), 24 * 3600)

        consoleLog({
            user1ExpectedEverest: toDecimal(user1ExpectedEverest)
        })
        
        await expect(
            expeditionV2.connect(user1).increaseLockedSummit(e18(5), e18(0))
        ).to.emit(expeditionV2, EVENT.EVEREST.LockedSummitIncreased).withArgs(user1.address, e18(5), e18(0), user1ExpectedEverest)
            
        const user1FinalSummit = await summitToken.balanceOf(user1.address)
        const everestFinal = await everestToken.balanceOf(user1.address)
        const everestInfoFinal = await expeditionV2.userEverestInfo(user1.address)

        expect6FigBigNumberAllEqual([
            user1ExpectedEverest,
            deltaBN(everestInit, everestFinal),
            deltaBN(everestInfoInit.everestOwned, everestInfoFinal.everestOwned),
        ])
        expect6FigBigNumberAllEqual([
        everestFinal,
        everestInfoFinal.everestOwned,
        ])
        expect6FigBigNumberAllEqual([
            deltaBN(user1InitSummit, user1FinalSummit),
            deltaBN(everestInfoInit.summitLocked, everestInfoFinal.summitLocked)
        ])
    })

    it(`REMOVE EVEREST: User without locked everest cannot withdraw, or throws "${ERR.EVEREST.MUST_OWN_EVEREST}"`, async function () {
        const { user3 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)

        await expect(
                expeditionV2.connect(user3).decreaseLockedSummit(e18(1))
        ).to.be.revertedWith(ERR.EVEREST.MUST_OWN_EVEREST)
    })

    it(`REMOVE EVEREST: User's lock must mature before decreasing locked summit, or throws "${ERR.EVEREST.EVEREST_UNLOCKED}"`, async function () {
        const { user1 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)

        await expect(
                expeditionV2.connect(user1).decreaseLockedSummit(e18(1))
        ).to.be.revertedWith(ERR.EVEREST.EVEREST_UNLOCKED)
    })

    it(`REMOVE EVEREST: User's lock must mature before decreasing locked summit, or throws "${ERR.EVEREST.EVEREST_UNLOCKED}"`, async function () {
        const { user1 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)

        await expect(
                expeditionV2.connect(user1).decreaseLockedSummit(e18(1))
        ).to.be.revertedWith(ERR.EVEREST.EVEREST_UNLOCKED)
    })

    it(`REMOVE EVEREST: After lock matured, User cannot withdraw 0 or more than their locked everest, or throws "${ERR.EVEREST.BAD_WITHDRAW}"`, async function () {
        const { user1 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)

        const everestInfo = await expeditionV2.userEverestInfo(user1.address)
        await mineBlockWithTimestamp(everestInfo.lockRelease)

        await expect(
                expeditionV2.connect(user1).decreaseLockedSummit(e18(0))
        ).to.be.revertedWith(ERR.EVEREST.BAD_WITHDRAW)

        await expect(
                expeditionV2.connect(user1).decreaseLockedSummit(e36(10000))
        ).to.be.revertedWith(ERR.EVEREST.BAD_WITHDRAW)
    })

    it(`REMOVE EVEREST: Valid summit / summit lp withdraw is successful`, async function () {
        const { user1 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
        const everestToken = await ethers.getContract(Contracts.EverestToken)
        const summitToken = await ethers.getContract(Contracts.SummitToken)
        const dummySummitLp = await ethers.getContract(Contracts.DummySUMMITLP)

        const everestInfoInit = await expeditionV2.userEverestInfo(user1.address)
        const halfEverestAmount = everestInfoInit.everestOwned.div(2)
        const everestInit = await everestToken.balanceOf(user1.address)
        const summitInit = await summitToken.balanceOf(user1.address)
        const summitLpInit = await dummySummitLp.balanceOf(user1.address)
        expect(halfEverestAmount).to.equal(everestInit.div(2))

        // WITHDRAW HALF
        const expectedSummitWithdrawal1 = everestInfoInit.summitLocked.div(2)
        const expectedSummitLpWithdrawal1 = everestInfoInit.summitLpLocked.div(2)

        await expect(
                expeditionV2.connect(user1).decreaseLockedSummit(halfEverestAmount)
        ).to.emit(expeditionV2, EVENT.EVEREST.LockedSummitRemoved).withArgs(user1.address, expectedSummitWithdrawal1, expectedSummitLpWithdrawal1, halfEverestAmount)

        const everestInfoMid = await expeditionV2.userEverestInfo(user1.address)
        const everestMid = await everestToken.balanceOf(user1.address)
        const summitMid = await summitToken.balanceOf(user1.address)
        const summitLpMid = await dummySummitLp.balanceOf(user1.address)

        expect6FigBigNumberAllEqual([
            expectedSummitWithdrawal1,
            deltaBN(summitInit, summitMid),
            deltaBN(everestInfoInit.summitLocked, everestInfoMid.summitLocked)
        ])
        expect6FigBigNumberAllEqual([
            expectedSummitLpWithdrawal1,
            deltaBN(summitLpInit, summitLpMid),
            deltaBN(everestInfoInit.summitLpLocked, everestInfoMid.summitLpLocked)
        ])
        expect6FigBigNumberAllEqual([
            halfEverestAmount,
            deltaBN(everestInit, everestMid),
            deltaBN(everestInfoInit.everestOwned, everestInfoMid.everestOwned)
        ])

        // WITHDRAW REMAINING
        const expectedSummitWithdrawal2 = everestInfoMid.summitLocked
        const expectedSummitLpWithdrawal2 = everestInfoMid.summitLpLocked

        await expect(
                expeditionV2.connect(user1).decreaseLockedSummit(everestMid)
        ).to.emit(expeditionV2, EVENT.EVEREST.LockedSummitRemoved).withArgs(user1.address, expectedSummitWithdrawal2, expectedSummitLpWithdrawal2, everestMid)

        const everestInfoFinal = await expeditionV2.userEverestInfo(user1.address)
        const everestFinal = await everestToken.balanceOf(user1.address)
        const summitFinal = await summitToken.balanceOf(user1.address)
        const summitLpFinal = await dummySummitLp.balanceOf(user1.address)

        consoleLog({
            summit: `${toDecimal(summitMid)} ==> ${toDecimal(summitFinal)}: ${toDecimal(deltaBN(summitFinal, summitMid))}`,
            summitLp: `${toDecimal(summitLpMid)} ==> ${toDecimal(summitLpFinal)}: ${toDecimal(deltaBN(summitLpFinal, summitLpMid))}`,
            everest: `${toDecimal(everestMid)} ==> ${toDecimal(everestFinal)}: ${toDecimal(deltaBN(everestFinal, everestMid))}`,
            summitEverestInfo: `${toDecimal(everestInfoMid.summitLocked)} ==> ${toDecimal(everestInfoFinal.summitLocked)}: ${toDecimal(deltaBN(everestInfoMid.summitLocked, everestInfoFinal.summitLocked))}`,
            summitLpEverestInfo: `${toDecimal(everestInfoMid.summitLpLocked)} ==> ${toDecimal(everestInfoFinal.summitLpLocked)}: ${toDecimal(deltaBN(everestInfoMid.summitLpLocked, everestInfoFinal.summitLpLocked))}`,
            everestEverestInfo: `${toDecimal(everestInfoMid.everestOwned)} ==> ${toDecimal(everestInfoFinal.everestOwned)}: ${toDecimal(deltaBN(everestInfoMid.everestOwned, everestInfoFinal.everestOwned))}`,
            expectedSummitWithdrawal2: toDecimal(expectedSummitWithdrawal2),
            expectedSummitLpWithdrawal2: toDecimal(expectedSummitLpWithdrawal2),
            everestMid: toDecimal(everestMid),
        })

        expect6FigBigNumberAllEqual([
            expectedSummitWithdrawal2,
            deltaBN(summitFinal, summitMid),
            deltaBN(everestInfoFinal.summitLocked, everestInfoMid.summitLocked)
        ])
        expect6FigBigNumberAllEqual([
            expectedSummitLpWithdrawal2,
            deltaBN(summitLpFinal, summitLpMid),
            deltaBN(everestInfoFinal.summitLpLocked, everestInfoMid.summitLpLocked)
        ])
        expect6FigBigNumberAllEqual([
            everestMid,
            deltaBN(everestFinal, everestMid),
            deltaBN(everestInfoFinal.everestOwned, everestInfoMid.everestOwned)
        ])
    })





    

    it('EXPEDITION: Creating a valid expedition works', async function() {
        const { user1, dev } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
        const dummyBifiToken = await ethers.getContract(Contracts.DummyBIFI)
        const dummyCakeToken = await ethers.getContract(Contracts.DummyCAKE)

        await expect(
            expeditionV2.connect(user1).addExpedition(dummyCakeToken.address, true, e18(100000), 9)
        ).to.be.revertedWith(ERR.NON_OWNER)
        
        await expect(
            expeditionV2.connect(dev).addExpedition(dummyBifiToken.address, true, e18(100000), 9)
        ).to.be.revertedWith(ERR.EXPEDITION_FUNDS_REQUIRED)
        
        await dummyBifiToken.connect(dev).approve(expeditionV2.address, e18(100000))
        await dummyBifiToken.connect(dev).transfer(expeditionV2.address, e18(100000))
        await dummyCakeToken.connect(dev).approve(expeditionV2.address, e18(50000))
        await dummyCakeToken.connect(dev).transfer(expeditionV2.address, e18(50000))
        
        await expect(
            expeditionV2.connect(dev).addExpedition(dummyBifiToken.address, true, e18(500), 9)
        ).to.emit(expeditionV2, EVENT.ExpeditionCreated).withArgs(dummyBifiToken.address, e18(500), 9);
        await expect(
            expeditionV2.connect(dev).addExpedition(dummyCakeToken.address, true, e18(50000), 9)
        ).to.emit(expeditionV2, EVENT.ExpeditionCreated).withArgs(dummyCakeToken.address, e18(50000), 9);

        await expect(
            expeditionV2.connect(dev).addExpedition(dummyCakeToken.address, true, e18(50000), 9)
        ).to.be.revertedWith(ERR.DUPLICATED)
    })

    it('EXPEDITION: Entering expedition unlocks when expedition becomes active', async function() {
        const { user1, user2 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
        const dummyCakeToken = await ethers.getContract(Contracts.DummyCAKE)

        await expeditionV2.connect(user1).lockSummit(e18(5), e18(5), 30 * 24 * 3600)
        await expeditionV2.connect(user1).selectDeity(0)
        await expeditionV2.connect(user1).selectSafetyFactor(50)

        const everestInfoInit = await expeditionV2.userEverestInfo(user1.address)
        expect(everestInfoInit.interactingExpedCount).to.equal(0)
        consoleLog({
            user1EverestInfoOwned: toDecimal(everestInfoInit.everestOwned), 
        })
        
        await expect(
            expeditionV2.connect(user1).joinExpedition(dummyCakeToken.address)
        ).to.be.revertedWith(ERR.EXPEDITION_V2.NOT_ACTIVE)
  
        await rolloverExpedition()
        
        await expect(
            expeditionV2.connect(user1).joinExpedition(dummyCakeToken.address)
        ).to.emit(expeditionV2, EVENT.EXPEDITION_V2.UserJoinedExpedition).withArgs(user1.address, dummyCakeToken.address, 0, 50, everestInfoInit.everestOwned)

        const everestInfoFinal = await expeditionV2.userEverestInfo(user1.address)
        expect(everestInfoFinal.interactingExpedCount).to.equal(1)


        await expeditionV2.connect(user2).selectDeity(0)
        await expeditionV2.connect(user2).selectSafetyFactor(100)   
        const user2EverestInfo = await expeditionV2.userEverestInfo(user2.address)
        await expect(
            expeditionV2.connect(user2).joinExpedition(dummyCakeToken.address)
        ).to.emit(expeditionV2, EVENT.EXPEDITION_V2.UserJoinedExpedition).withArgs(user2.address, dummyCakeToken.address, 0, 100, user2EverestInfo.everestOwned)
    })

    it('EXPEDITION: Can only enter an expedition that exists', async function() {
        const { user1 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
        const summitToken = await ethers.getContract(Contracts.SummitToken)

        const everestInfoInit = await expeditionV2.userEverestInfo(user1.address)
        expect(everestInfoInit.interactingExpedCount).to.equal(1)
        
        await expect(
            expeditionV2.connect(user1).joinExpedition(summitToken.address)
        ).to.be.revertedWith(ERR.EXPEDITION_V2.DOESNT_EXIST)

        const everestInfoFinal = await expeditionV2.userEverestInfo(user1.address)
        expect(everestInfoFinal.interactingExpedCount).to.equal(1)
    })

    it('EXPEDITION: User can only enter expedition if they own everest, have selected a deity, and have selected a safety factor', async function() {
        const { user3 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
        const dummyCakeToken = await ethers.getContract(Contracts.DummyCAKE)

        let userEligibleToJoinExpedition = await expeditionV2.connect(user3).userEligibleToJoinExpedition()
        expect(userEligibleToJoinExpedition).to.be.false
        
        await expect(
            expeditionV2.connect(user3).joinExpedition(dummyCakeToken.address)
        ).to.be.revertedWith(ERR.EVEREST.MUST_OWN_EVEREST)

        await expeditionV2.connect(user3).lockSummit(e18(10), e18(10), 24 * 3600)

        userEligibleToJoinExpedition = await expeditionV2.connect(user3).userEligibleToJoinExpedition()
        expect(userEligibleToJoinExpedition).to.be.false
        
        await expect(
            expeditionV2.connect(user3).joinExpedition(dummyCakeToken.address)
        ).to.be.revertedWith(ERR.EXPEDITION_V2.NO_DEITY)

        await expeditionV2.connect(user3).selectDeity(1)

        userEligibleToJoinExpedition = await expeditionV2.connect(user3).userEligibleToJoinExpedition()
        expect(userEligibleToJoinExpedition).to.be.false
        
        await expect(
            expeditionV2.connect(user3).joinExpedition(dummyCakeToken.address)
        ).to.be.revertedWith(ERR.EXPEDITION_V2.NO_SAFETY_FACTOR)

        await expeditionV2.connect(user3).selectSafetyFactor(50)

        const everestInfoInit = await expeditionV2.userEverestInfo(user3.address)
        expect(everestInfoInit.interactingExpedCount).to.equal(0)

        userEligibleToJoinExpedition = await expeditionV2.connect(user3).userEligibleToJoinExpedition()
        expect(userEligibleToJoinExpedition).to.be.true
        
        await expect(
            expeditionV2.connect(user3).joinExpedition(dummyCakeToken.address)
        ).to.emit(expeditionV2, EVENT.EXPEDITION_V2.UserJoinedExpedition).withArgs(user3.address, dummyCakeToken.address, 1, 50, everestInfoInit.everestOwned)

        const everestInfoFinal = await expeditionV2.userEverestInfo(user3.address)
        expect(everestInfoFinal.interactingExpedCount).to.equal(1)

        await expectUserAndExpedSuppliesToMatch()
    })

    it(`EXPEDITION: Expedition safe and deitied supplies match combined user's supplies`, async function () {
        await expectUserAndExpedSuppliesToMatch()
    })
    
    it('EXPEDITION: Expeditions automatically end after the final round', async function() {
        const { user1 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
        const dummyCakeToken = await ethers.getContract(Contracts.DummyCAKE)

        await rolloverExpeditionMultiRounds(8)

        const hypoWinnings0 = (await expeditionV2.hypotheticalRewards(dummyCakeToken.address, user1.address))[1]

        consoleLog({
            hypoWinnings0: toDecimal(hypoWinnings0)
        })

        expect(hypoWinnings0.gt(0)).to.be.true
        
        await rolloverExpedition()

        const hypoWinnings1 = (await expeditionV2.hypotheticalRewards(dummyCakeToken.address, user1.address))[1]
        
        expect(hypoWinnings1).to.equal(0)

        consoleLog({
            hypoWinnings1: toDecimal(hypoWinnings1)
        })
        
        await expect(
            expeditionV2.connect(user1).joinExpedition(dummyCakeToken.address)
        ).to.be.revertedWith(ERR.EXPEDITION_V2.NOT_ACTIVE)
    })

    it(`EXPEDITION: Harvesting from an ended expedition automatically exits user`, async function() {
        const { user2 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
        const dummyCakeToken = await ethers.getContract(Contracts.DummyCAKE)

        const everestInfoInit = await expeditionV2.userEverestInfo(user2.address)
        expect(everestInfoInit.interactingExpedCount).to.equal(1)

        const rewards = await expeditionV2.connect(user2).rewards(dummyCakeToken.address, user2.address)
        
        await expect(
            expeditionV2.connect(user2).harvestExpedition(dummyCakeToken.address)
        ).to.emit(expeditionV2, EVENT.EXPEDITION_V2.UserHarvestedExpedition).withArgs(user2.address, dummyCakeToken.address, rewards, true)

        const everestInfoFinal = await expeditionV2.userEverestInfo(user2.address)
        expect(everestInfoFinal.interactingExpedCount).to.equal(0)
    })
    it(`EXPEDITION: Can't join an ended expedition`, async function() {

    })


    it('EXPEDITION: Expeditions can be restarted after they end', async function() {
        const { dev } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
        const dummyCakeToken = await ethers.getContract(Contracts.DummyCAKE)

        await expect(
            expeditionV2.connect(dev).restartExpedition(dummyCakeToken.address, e18(50000), 1)
        ).to.be.revertedWith(ERR.EXPEDITION_FUNDS_REQUIRED)

        await dummyCakeToken.connect(dev).approve(expeditionV2.address, e18(100000))
        await dummyCakeToken.connect(dev).transfer(expeditionV2.address, e18(100000))

        await expect(
            expeditionV2.connect(dev).restartExpedition(dummyCakeToken.address, e18(50000), 1)
        ).to.emit(expeditionV2, EVENT.ExpeditionRestarted)

        await rolloverExpedition()

        await expect(
            expeditionV2.connect(dev).restartExpedition(dummyCakeToken.address, e18(50000), 1)
        ).to.be.revertedWith(ERR.EXPEDITION_ALREADY_RUNNING)
    })

    it('EXPEDITION: Expeditions can be extended while they are running', async function() {
        const { dev } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
        const dummyCakeToken = await ethers.getContract(Contracts.DummyCAKE)

        await dummyCakeToken.connect(dev).approve(expeditionV2.address, e18(50000))
        await dummyCakeToken.connect(dev).transfer(expeditionV2.address, e18(50000))
        
        await expect(
            expeditionV2.connect(dev).extendExpedition(dummyCakeToken.address, e18(50000), 200)
        ).to.emit(expeditionV2, EVENT.ExpeditionExtended)
    })

    it(`EXPEDITION: Rounds yield correct winnings`, async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
        const dummyCakeToken = await ethers.getContract(Contracts.DummyCAKE)

        const roundEmission = (await expeditionV2.expeditionInfo(dummyCakeToken.address)).roundEmission
    
        const users = [user1, user2, user3]

        await promiseSequenceMap(
            users,
            async (user) => await expeditionV2.connect(user).harvestExpedition(dummyCakeToken.address)
        )

        const usersHypotheticalRewards = await promiseSequenceMap(
            users,
            async (user) => await expeditionV2.hypotheticalRewards(dummyCakeToken.address, user.address)
        )
        const usersSafeEarnings = usersHypotheticalRewards.map((hypotheticalReward) => hypotheticalReward[0])
        const usersHypoDeitiedWinnings = usersHypotheticalRewards.map((hypotheticalReward) => hypotheticalReward[1])

        await rolloverExpedition()
        const prevWinningTotem = await expeditionPrevWinningTotem()

        const winnings = await promiseSequenceMap(
            users,
            async (user) => await expeditionV2.connect(user).rewards(dummyCakeToken.address, user.address)
        )

        consoleLog({
            hypoUser1: `Safe: ${toDecimal(usersSafeEarnings[0])}, Deity: ${toDecimal(usersHypoDeitiedWinnings[0])}: Total ${toDecimal(usersSafeEarnings[0].add(usersHypoDeitiedWinnings[0]))}`,
            hypoUser2: `Safe: ${toDecimal(usersSafeEarnings[1])}, Deity: ${toDecimal(usersHypoDeitiedWinnings[1])}: Total ${toDecimal(usersSafeEarnings[1].add(usersHypoDeitiedWinnings[1]))}`,
            hypoUser3: `Safe: ${toDecimal(usersSafeEarnings[2])}, Deity: ${toDecimal(usersHypoDeitiedWinnings[2])}: Total ${toDecimal(usersSafeEarnings[2].add(usersHypoDeitiedWinnings[2]))}`,
            trueUser1: `True: ${toDecimal(winnings[0])}`,
            trueUser2: `True: ${toDecimal(winnings[1])}`,
            trueUser3: `True: ${toDecimal(winnings[2])}`,
            trueSum: `${toDecimal(winnings[0].add(winnings[1]).add(winnings[2]))}`,
            roundEmission: toDecimal(roundEmission),
        })

        expect6FigBigNumberEquals(winnings[0].add(winnings[1]).add(winnings[2]), roundEmission)

        expect6FigBigNumberEquals(winnings[0], usersSafeEarnings[0].add(prevWinningTotem === 0 ? usersHypoDeitiedWinnings[0] : 0))
        expect6FigBigNumberEquals(winnings[1], usersSafeEarnings[1].add(prevWinningTotem === 0 ? usersHypoDeitiedWinnings[1] : 0))
        expect6FigBigNumberEquals(winnings[2], usersSafeEarnings[2].add(prevWinningTotem === 1 ? usersHypoDeitiedWinnings[2] : 0))
    })
    it(`EXPEDITION: Winnings are withdrawn correctly`, async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
        const dummyCakeToken = await ethers.getContract(Contracts.DummyCAKE)

        const users = [user1, user2, user3]

        const rewardsInit = await promiseSequenceMap(
            users,
            async (user) => await dummyCakeToken.balanceOf(user.address)
        )

        const winnings = await promiseSequenceMap(
            users,
            async (user) => await expeditionV2.connect(user).rewards(dummyCakeToken.address, user.address)
        )

        await promiseSequenceMap(
            users,
            async (user, index) => await expect(
                expeditionV2.connect(user).harvestExpedition(dummyCakeToken.address)
            ).to.emit(expeditionV2, EVENT.EXPEDITION_V2.UserHarvestedExpedition).withArgs(user.address, dummyCakeToken.address, winnings[index], false)
        )

        const rewardsFinal = await promiseSequenceMap(
            users,
            async (user) => await dummyCakeToken.balanceOf(user.address)
        )

        users.forEach((_, index) => {
            expect(deltaBN(rewardsInit[index], rewardsFinal[index])).to.equal(winnings[index])
        })
    })

    it(`DEITIES: Switching to invalid deity should fail with error ${ERR.EXPEDITION_V2.INVALID_DEITY}`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
        
        await expect(
          expeditionV2.connect(user1).selectDeity(2)
        ).to.be.revertedWith(ERR.EXPEDITION_V2.INVALID_DEITY)
    })



    // UPDATING DEITY / SAFETY FACTOR / EVEREST OWNED

    it('DEITIES: Users should be able to switch to valid deities', async function() {
        const { user1 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
        const dummyCakeToken = await ethers.getContract(Contracts.DummyCAKE)

        await rolloverExpedition()
        
        await expectUserAndExpedSuppliesToMatch()

        const everestInfoInit = await expeditionV2.userEverestInfo(user1.address)
        const userExpedInfoInit = await expeditionV2.userExpeditionInfo(dummyCakeToken.address, user1.address)


        // SWITCH TOTEM FROM 0 --> TARGET TOTEM
        await expeditionV2.connect(user1).selectDeity(1)

        await expectUserAndExpedSuppliesToMatch()

        const everestInfoMid = await expeditionV2.userEverestInfo(user1.address)
        const userExpedInfoMid = await expeditionV2.userExpeditionInfo(dummyCakeToken.address, user1.address)
        
        
        // SWITCH BACK TO TOTEM 0 FROM TARGET TOTEM
        await expeditionV2.connect(user1).selectDeity(0)
        
        await expectUserAndExpedSuppliesToMatch()

        const everestInfoFinal = await expeditionV2.userEverestInfo(user1.address)
        const userExpedInfoFinal = await expeditionV2.userExpeditionInfo(dummyCakeToken.address, user1.address)

        // DEITY changes
        expectAllEqual([0, everestInfoInit.deity, everestInfoFinal.deity])
        expectAllEqual([1, everestInfoMid.deity])

        // User Everest Info doesnt change
        expect6FigBigNumberAllEqual([everestInfoInit.everestOwned, everestInfoMid.everestOwned, everestInfoFinal.everestOwned])
        expectAllEqual([everestInfoInit.everestLockMultiplier, everestInfoMid.everestLockMultiplier, everestInfoFinal.everestLockMultiplier])
        expect6FigBigNumberAllEqual([everestInfoInit.lockRelease, everestInfoMid.lockRelease, everestInfoFinal.lockRelease])
        expect6FigBigNumberAllEqual([everestInfoInit.summitLocked, everestInfoMid.summitLocked, everestInfoFinal.summitLocked])
        expect6FigBigNumberAllEqual([everestInfoInit.summitLpLocked, everestInfoMid.summitLpLocked, everestInfoFinal.summitLpLocked])
        expectAllEqual([everestInfoInit.interactingExpedCount, everestInfoMid.interactingExpedCount, everestInfoFinal.interactingExpedCount])
        expectAllEqual([everestInfoInit.safetyFactor, everestInfoMid.safetyFactor, everestInfoFinal.safetyFactor])
        
        // User safe and deitied info doesnt change
        expect6FigBigNumberAllEqual([userExpedInfoInit.safeSupply, userExpedInfoMid.safeSupply, userExpedInfoFinal.safeSupply])
        expect6FigBigNumberAllEqual([userExpedInfoInit.deitiedSupply, userExpedInfoMid.deitiedSupply, userExpedInfoFinal.deitiedSupply])
    })

    it('SAFETY FACTOR: Users should be able to switch to valid safety factors', async function() {
        const { user1 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
        const dummyCakeToken = await ethers.getContract(Contracts.DummyCAKE)

        await rolloverExpedition()
        
        await expectUserAndExpedSuppliesToMatch()

        const everestInfoInit = await expeditionV2.userEverestInfo(user1.address)
        const userExpedInfoInit = await expeditionV2.userExpeditionInfo(dummyCakeToken.address, user1.address)
        const { safe: safeInit, deitied: deitiedInit } = await getUserSafeAndDeitiedAmount(user1)

        expect(safeInit).to.equal(userExpedInfoInit.safeSupply)
        expect(deitiedInit).to.equal(userExpedInfoInit.deitiedSupply)

        // Switch safety factor to 0
        await expeditionV2.connect(user1).selectSafetyFactor(0)

        await expectUserAndExpedSuppliesToMatch()

        const everestInfoMid = await expeditionV2.userEverestInfo(user1.address)
        const userExpedInfoMid = await expeditionV2.userExpeditionInfo(dummyCakeToken.address, user1.address)
        const { safe: safeMid, deitied: deitiedMid } = await getUserSafeAndDeitiedAmount(user1)

        expect(safeMid).to.equal(userExpedInfoMid.safeSupply)
        expect(deitiedMid).to.equal(userExpedInfoMid.deitiedSupply)
        
        // Switch safety factor to 100
        await expeditionV2.connect(user1).selectSafetyFactor(100)

        await expectUserAndExpedSuppliesToMatch()

        const everestInfoMid2 = await expeditionV2.userEverestInfo(user1.address)
        const userExpedInfoMid2 = await expeditionV2.userExpeditionInfo(dummyCakeToken.address, user1.address)
        const { safe: safeMid2, deitied: deitiedMid2 } = await getUserSafeAndDeitiedAmount(user1)

        expect(safeMid2).to.equal(userExpedInfoMid2.safeSupply)
        expect(deitiedMid2).to.equal(userExpedInfoMid2.deitiedSupply)
        
        
        // Switch safety factor back to 50
        await expeditionV2.connect(user1).selectSafetyFactor(50)
        
        await expectUserAndExpedSuppliesToMatch()

        const everestInfoFinal = await expeditionV2.userEverestInfo(user1.address)
        const userExpedInfoFinal = await expeditionV2.userExpeditionInfo(dummyCakeToken.address, user1.address)
        const { safe: safeFinal, deitied: deitiedFinal } = await getUserSafeAndDeitiedAmount(user1)

        expect(safeFinal).to.equal(userExpedInfoFinal.safeSupply)
        expect(deitiedFinal).to.equal(userExpedInfoFinal.deitiedSupply)


        // Safety factor changes
        expectAllEqual([50, everestInfoInit.safetyFactor, everestInfoFinal.safetyFactor])
        expectAllEqual([0, everestInfoMid.safetyFactor])
        expectAllEqual([100, everestInfoMid2.safetyFactor])


        // User Everest Info doesnt change
        expectAllEqual([everestInfoInit.deity, everestInfoMid.deity, everestInfoMid2.deity, everestInfoFinal.deity])
        expect6FigBigNumberAllEqual([everestInfoInit.everestOwned, everestInfoMid.everestOwned, everestInfoMid2.everestOwned, everestInfoFinal.everestOwned])
        expectAllEqual([everestInfoInit.everestLockMultiplier, everestInfoMid.everestLockMultiplier, everestInfoMid2.everestLockMultiplier, everestInfoFinal.everestLockMultiplier])
        expect6FigBigNumberAllEqual([everestInfoInit.lockRelease, everestInfoMid.lockRelease, everestInfoMid2.lockRelease, everestInfoFinal.lockRelease])
        expect6FigBigNumberAllEqual([everestInfoInit.summitLocked, everestInfoMid.summitLocked, everestInfoMid2.summitLocked, everestInfoFinal.summitLocked])
        expect6FigBigNumberAllEqual([everestInfoInit.summitLpLocked, everestInfoMid.summitLpLocked, everestInfoMid2.summitLpLocked, everestInfoFinal.summitLpLocked])
        expectAllEqual([everestInfoInit.interactingExpedCount, everestInfoMid.interactingExpedCount, everestInfoMid2.interactingExpedCount, everestInfoFinal.interactingExpedCount])
    })

    it('EVEREST CHANGE: Users should be able to increase or remove locked everest and update expeditions', async function() {
        const { user1 } = await getNamedSigners(hre)
        const expeditionV2 = await ethers.getContract(Contracts.ExpeditionV2)
        const dummyCakeToken = await ethers.getContract(Contracts.DummyCAKE)

        await rolloverExpedition()
        
        await expectUserAndExpedSuppliesToMatch()

        const everestInfoInit = await expeditionV2.userEverestInfo(user1.address)
        const userExpedInfoInit = await expeditionV2.userExpeditionInfo(dummyCakeToken.address, user1.address)
        const { safe: safeInit, deitied: deitiedInit } = await getUserSafeAndDeitiedAmount(user1)

        consoleLog({
            safeInit: toDecimal(safeInit),
            expedInfoSafeInit: toDecimal(userExpedInfoInit.safeSupply),
            summitInit: toDecimal(everestInfoInit.summitLocked),
            summitLpInit: toDecimal(everestInfoInit.summitLpLocked),
        })

        expect(safeInit).to.equal(userExpedInfoInit.safeSupply)
        expect(deitiedInit).to.equal(userExpedInfoInit.deitiedSupply)

        // Increase locked summit
        await expeditionV2.connect(user1).increaseLockedSummit(e18(30), e18(0))

        await expectUserAndExpedSuppliesToMatch()

        const everestInfoMid = await expeditionV2.userEverestInfo(user1.address)
        const userExpedInfoMid = await expeditionV2.userExpeditionInfo(dummyCakeToken.address, user1.address)
        const { safe: safeMid, deitied: deitiedMid } = await getUserSafeAndDeitiedAmount(user1)

        expect(safeMid).to.equal(userExpedInfoMid.safeSupply)
        expect(deitiedMid).to.equal(userExpedInfoMid.deitiedSupply)

        consoleLog({
            safeMid: toDecimal(safeMid),
            expedInfoSafeMid: toDecimal(userExpedInfoMid.safeSupply),
            summitMid: toDecimal(everestInfoMid.summitLocked),
            summitLpMid: toDecimal(everestInfoMid.summitLpLocked),
        })



        // DECREASE LOCKED SUMMIT by half
        await mineBlockWithTimestamp(everestInfoInit.lockRelease)
        const halfEverestAmount = everestInfoMid.everestOwned.div(2)

        await expeditionV2.connect(user1).decreaseLockedSummit(halfEverestAmount)

        await expectUserAndExpedSuppliesToMatch()

        const everestInfoMid2 = await expeditionV2.userEverestInfo(user1.address)
        const userExpedInfoMid2 = await expeditionV2.userExpeditionInfo(dummyCakeToken.address, user1.address)
        const { safe: safeMid2, deitied: deitiedMid2 } = await getUserSafeAndDeitiedAmount(user1)

        consoleLog({
            safeMid2: toDecimal(safeMid2),
            expedInfoSafeMid2: toDecimal(userExpedInfoMid2.safeSupply),
            summitMid2: toDecimal(everestInfoMid2.summitLocked),
            summitLpMid2: toDecimal(everestInfoMid2.summitLpLocked),
        })

        expect(safeMid2).to.equal(userExpedInfoMid2.safeSupply)
        expect(deitiedMid2).to.equal(userExpedInfoMid2.deitiedSupply)
        
        
        // Decrease locked summit to 0
        await expeditionV2.connect(user1).decreaseLockedSummit(halfEverestAmount)
        
        await expectUserAndExpedSuppliesToMatch()

        const everestInfoFinal = await expeditionV2.userEverestInfo(user1.address)
        const userExpedInfoFinal = await expeditionV2.userExpeditionInfo(dummyCakeToken.address, user1.address)
        const { safe: safeFinal, deitied: deitiedFinal } = await getUserSafeAndDeitiedAmount(user1)

        consoleLog({
            safeFinal: toDecimal(safeFinal),
            expedInfoSafeFinal: toDecimal(userExpedInfoFinal.safeSupply),
            summitFinal: toDecimal(everestInfoFinal.summitLocked),
            summitLpFinal: toDecimal(everestInfoFinal.summitLpLocked),
        })

        expect(safeFinal).to.equal(userExpedInfoFinal.safeSupply)
        expect(deitiedFinal).to.equal(userExpedInfoFinal.deitiedSupply)


        // Safety factor changes
        expect6FigBigNumberAllEqual([everestInfoMid.summitLocked, everestInfoMid2.summitLocked.mul(2)])
        expect6FigBigNumberAllEqual([everestInfoMid.summitLpLocked, everestInfoMid2.summitLpLocked.mul(2)])
        expect6FigBigNumberAllEqual([everestInfoMid.everestOwned, everestInfoMid2.everestOwned.mul(2)])
        expect(everestInfoFinal.summitLocked).to.equal(0)
        expect(everestInfoFinal.summitLpLocked).to.equal(0)
        expect(everestInfoFinal.everestOwned).to.equal(0)
        expectAllEqual([1, everestInfoInit.interactingExpedCount, everestInfoMid.interactingExpedCount, everestInfoMid2.interactingExpedCount])
        expectAllEqual([0, everestInfoFinal.interactingExpedCount])


        // User Everest Info doesnt change
        expectAllEqual([everestInfoInit.deity, everestInfoMid.deity, everestInfoMid2.deity, everestInfoFinal.deity])
        expectAllEqual([everestInfoInit.everestLockMultiplier, everestInfoMid.everestLockMultiplier, everestInfoMid2.everestLockMultiplier, everestInfoFinal.everestLockMultiplier])
        expect6FigBigNumberAllEqual([everestInfoInit.lockRelease, everestInfoMid.lockRelease, everestInfoMid2.lockRelease, everestInfoFinal.lockRelease])
        expectAllEqual([everestInfoInit.safetyFactor, everestInfoMid.safetyFactor, everestInfoMid2.safetyFactor, everestInfoFinal.safetyFactor])
    })
})
