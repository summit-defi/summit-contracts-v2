import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { e18, ERR, EVENT, toDecimal, Contracts, INF_APPROVE, getTimestamp, deltaBN, expect6FigBigNumberAllEqual, mineBlockWithTimestamp, e36, EXPEDITION, promiseSequenceMap, expect6FigBigNumberEquals, e12, e0, consoleLog, expectAllEqual, getBifiToken, getCakeToken, getCartographer, getElevationHelper, getEverestToken, getExpedition, getSummitLpToken, getSummitToken, everestGet, everestMethod, expeditionMethod, expeditionGet } from "..";
import { userPromiseSequenceMap } from "../users";
import { oasisUnlockedFixture } from "../../test/fixtures";


const rolloverExpedition = async () => {
    const elevationHelper = await getElevationHelper()
    const expeditionV2 = await getExpedition()
    const cartographer = await getCartographer()

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
    const elevationHelper = await getElevationHelper()
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
    const expeditionV2 = await getExpedition()
    const everestInfo = await everestGet.userEverestInfo(user.address)

    return _getUserSafeAmount(everestInfo)
}
const getUserDeitiedAmount = async (user: SignerWithAddress) => {
    const expeditionV2 = await getExpedition()
    const everestInfo = await everestGet.userEverestInfo(user.address)

    return _getUserDeitiedAmount(everestInfo)
}
const getUserSafeAndDeitiedAmount = async (user: SignerWithAddress) => {
    const expeditionV2 = await getExpedition()
    const everestInfo = await everestGet.userEverestInfo(user.address)
    
    return {
        safe: _getUserSafeAmount(everestInfo),
        deitied: _getUserDeitiedAmount(everestInfo)
    }
}
const expectUserAndExpedSuppliesToMatch = async () => {
    const { user1, user2, user3 } = await getNamedSigners(hre)
    const expeditionV2 = await getExpedition()
    const cakeToken = await getCakeToken()

    const users = [user1, user2, user3]

    const usersEverestInfo = await promiseSequenceMap(
        users,
        async (user) => await everestGet.userEverestInfo(user.address)
    )
    const { safeSupply, deity0Supply, deity1Supply } = usersEverestInfo.reduce((acc, everestInfo) => ({
        safeSupply: acc.safeSupply.add(everestInfo.everestOwned.mul(everestInfo.safetyFactor).div(100)),
        deity0Supply: acc.deity0Supply.add(everestInfo.deity !== 0 ? 0 : _getUserDeitiedAmount(everestInfo)),
        deity1Supply: acc.deity1Supply.add(everestInfo.deity !== 1 ? 0 : _getUserDeitiedAmount(everestInfo)),
    }), { safeSupply: e18(0), deity0Supply: e18(0), deity1Supply: e18(0) })

    const [expedSafeSupply, expedDeitiedSupply, expedDeity0Supply, expedDeity1Supply] = await expeditionV2.supply(cakeToken.address)

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

const getSummitBalance = async (address: string) => {
    return (await (await getSummitToken()).balanceOf(address))
}
const getUsdcBalance = async (address: string) => {
    return (await (await getCakeToken()).balanceOf(address))
}

const getExpeditionExpectedEmissions = async () => {
    const expedition = await getExpedition()

    const summitBalance = await getSummitBalance(expedition.address)
    const usdcBalance = await getUsdcBalance(expedition.address)

    const runwayRounds = await expeditionGet.expeditionRunwayRounds()

    return {
        summitEmission: summitBalance.div(runwayRounds),
        usdcEmission: usdcBalance.div(runwayRounds),
    }
}


describe("EXPEDITION V2", async function() {
    before(async function () {
        const { everestToken, summitToken, cakeToken, expeditionV2, user1, user2, user3 } = await oasisUnlockedFixture()

        await everestToken.connect(user1).approve(expeditionV2.address, INF_APPROVE)
        await everestToken.connect(user2).approve(expeditionV2.address, INF_APPROVE)
        await everestToken.connect(user3).approve(expeditionV2.address, INF_APPROVE)

        await summitToken.connect(user1).approve(expeditionV2.address, INF_APPROVE)
        await summitToken.connect(user2).approve(expeditionV2.address, INF_APPROVE)
        await summitToken.connect(user3).approve(expeditionV2.address, INF_APPROVE)
    })

    it('EXPEDITION: Initializing expedition works', async function() {
        const { user1, dev } = await getNamedSigners(hre)
        const cakeToken = await getCakeToken()

        const expeditionInitializedInit = await expeditionGet.expeditionInitialized()
        expect(expeditionInitializedInit).to.be.false
        
        await expeditionMethod.initializeExpedition({
            dev: user1,
            usdcAddress: cakeToken.address,
            revertErr: ERR.NON_OWNER
        })
        await expeditionMethod.initializeExpedition({
            dev,
            usdcAddress: cakeToken.address,
        })

        const expeditionInitializedFinal = await expeditionGet.expeditionInitialized()
        expect(expeditionInitializedFinal).to.be.true

        await expeditionMethod.initializeExpedition({
            dev: user1,
            usdcAddress: cakeToken.address,
            revertErr: ERR.EXPEDITION_V2.EXPEDITION_ALREADY_INITIALIZED
        })
    })

    it(`EXPEDITION ADD FUNDS: Adding incorrect funds fails with error "${ERR.EXPEDITION_V2.INVALID_EXPED_TOKEN}"`, async function() {
        const { dev } = await getNamedSigners(hre)
        const bifiToken = await getBifiToken()
        
        await expeditionMethod.addExpeditionFunds({
            user: dev,
            tokenAddress: bifiToken.address,
            amount: e18(500),
            revertErr: ERR.EXPEDITION_V2.INVALID_EXPED_TOKEN
        })
    })
    it(`EXPEDITION ADD FUNDS: Adding funds to the expedition recalculates emissions correctly`, async function() {
        const { dev } = await getNamedSigners(hre)
        const expedition = await getExpedition()
        const cakeToken = await getCakeToken()
        const summitToken = await getSummitToken()

        const expeditionRunwayRounds = await expeditionGet.expeditionRunwayRounds()
        const expeditionInfoInit = await expeditionGet.expeditionInfo()

        expect(expeditionInfoInit.roundsRemaining).to.equal(0)
        expect(expeditionInfoInit.summitExpeditionToken.emissionsRemaining).to.equal(e18(0))
        expect(expeditionInfoInit.summitExpeditionToken.roundEmission).to.equal(e18(0))
        expect(expeditionInfoInit.usdcExpeditionToken.emissionsRemaining).to.equal(e18(0))
        expect(expeditionInfoInit.usdcExpeditionToken.roundEmission).to.equal(e18(0))

        await cakeToken.connect(dev).approve(expedition.address, e18(500))
        await expeditionMethod.addExpeditionFunds({
            user: dev,
            tokenAddress: cakeToken.address,
            amount: e18(500),
        })

        const expectedEmissionsMid = await getExpeditionExpectedEmissions()
        const expeditionInfoMid = await expeditionGet.expeditionInfo()

        expect(expeditionInfoMid.roundsRemaining).to.equal(expeditionRunwayRounds)
        expect(expeditionInfoMid.summitExpeditionToken.emissionsRemaining).to.equal(e18(0))
        expect(expeditionInfoMid.summitExpeditionToken.roundEmission).to.equal(e18(0))
        expect(expeditionInfoMid.usdcExpeditionToken.emissionsRemaining).to.equal(e18(500))
        expect(expeditionInfoMid.usdcExpeditionToken.roundEmission).to.equal(expectedEmissionsMid.usdcEmission)

        await summitToken.connect(dev).approve(expedition.address, e18(300))
        await expeditionMethod.addExpeditionFunds({
            user: dev,
            tokenAddress: summitToken.address,
            amount: e18(300),
        })

        const expectedEmissionsFinal = await getExpeditionExpectedEmissions()
        const expeditionInfoFinal = await expeditionGet.expeditionInfo()

        expect(expeditionInfoFinal.roundsRemaining).to.equal(expeditionRunwayRounds)
        expect(expeditionInfoFinal.summitExpeditionToken.emissionsRemaining).to.equal(e18(300))
        expect(expeditionInfoFinal.summitExpeditionToken.roundEmission).to.equal(expectedEmissionsFinal.summitEmission)
        expect(expeditionInfoFinal.usdcExpeditionToken.emissionsRemaining).to.equal(e18(500))
        expect(expeditionInfoFinal.usdcExpeditionToken.roundEmission).to.equal(expectedEmissionsFinal.usdcEmission)
    })

    it('EXPEDITION: User can only enter expedition if they own everest, have selected a deity, and have selected a safety factor', async function() {
        const { user3 } = await getNamedSigners(hre)
        const expeditionV2 = await getExpedition()
        const cakeToken = await getCakeToken()

        let userExpeditionInfo = await expeditionGet.userExpeditionInfo(user3.address)
        expect(userExpeditionInfo.entered).to.equal(false)

        let userEligibleToJoinExpedition = await expeditionGet.userSatisfiesExpeditionRequirements(user3.address)
        expect(userEligibleToJoinExpedition.everest).to.be.false
        expect(userEligibleToJoinExpedition.deity).to.be.false
        expect(userEligibleToJoinExpedition.safetyFactor).to.be.false
        
        await expeditionMethod.joinExpedition({
            user: user3,
            revertErr: ERR.EVEREST.MUST_OWN_EVEREST
        })

        await everestMethod.lockSummit({
            user: user3,
            amount: e18(10),
            lockPeriod: 24 * 3600
        })

        userEligibleToJoinExpedition = await expeditionGet.userSatisfiesExpeditionRequirements(user3.address)
        expect(userEligibleToJoinExpedition.everest).to.be.true
        expect(userEligibleToJoinExpedition.deity).to.be.false
        expect(userEligibleToJoinExpedition.safetyFactor).to.be.false        

        await expeditionMethod.joinExpedition({
            user: user3,
            revertErr: ERR.EXPEDITION_V2.NO_DEITY
        })

        await expeditionMethod.selectDeity({
            user: user3,
            deity: 1,
        })

        userEligibleToJoinExpedition = await expeditionGet.userSatisfiesExpeditionRequirements(user3.address)
        expect(userEligibleToJoinExpedition.everest).to.be.true
        expect(userEligibleToJoinExpedition.deity).to.be.true
        expect(userEligibleToJoinExpedition.safetyFactor).to.be.false        


        await expeditionMethod.joinExpedition({
            user: user3,
            revertErr: ERR.EXPEDITION_V2.NO_SAFETY_FACTOR
        })

        await expeditionMethod.selectSafetyFactor({
            user: user3,
            safetyFactor: 50,
        })

        userEligibleToJoinExpedition = await expeditionGet.userSatisfiesExpeditionRequirements(user3.address)
        expect(userEligibleToJoinExpedition.everest).to.be.true
        expect(userEligibleToJoinExpedition.deity).to.be.true
        expect(userEligibleToJoinExpedition.safetyFactor).to.be.true  

        const everestInfoInit = await everestGet.userEverestInfo(user3.address)
        expect(everestInfoInit.interactingExpedCount).to.equal(0)

        userEligibleToJoinExpedition = await expeditionGet.userSatisfiesExpeditionRequirements(user3.address)
        expect(userEligibleToJoinExpedition).to.be.true
        
        await expect(
            expeditionV2.connect(user3).joinExpedition(cakeToken.address)
        ).to.emit(expeditionV2, EVENT.EXPEDITION_V2.UserJoinedExpedition).withArgs(user3.address, cakeToken.address, 1, 50, everestInfoInit.everestOwned)

        const everestInfoFinal = await everestGet.userEverestInfo(user3.address)
        expect(everestInfoFinal.interactingExpedCount).to.equal(1)

        await expectUserAndExpedSuppliesToMatch()
    })

    it(`EXPEDITION: Expedition safe and deitied supplies match combined user's supplies`, async function () {
        await expectUserAndExpedSuppliesToMatch()
    })
    
    it('EXPEDITION: Expeditions automatically end after the final round', async function() {
        const { user1 } = await getNamedSigners(hre)
        const expeditionV2 = await getExpedition()
        const cakeToken = await getCakeToken()

        await rolloverExpeditionMultiRounds(8)

        const hypoWinnings0 = (await expeditionV2.hypotheticalRewards(cakeToken.address, user1.address))[1]

        consoleLog({
            hypoWinnings0: toDecimal(hypoWinnings0)
        })

        expect(hypoWinnings0.gt(0)).to.be.true
        
        await rolloverExpedition()

        const hypoWinnings1 = (await expeditionV2.hypotheticalRewards(cakeToken.address, user1.address))[1]
        
        expect(hypoWinnings1).to.equal(0)

        consoleLog({
            hypoWinnings1: toDecimal(hypoWinnings1)
        })
        
        await expect(
            expeditionV2.connect(user1).joinExpedition(cakeToken.address)
        ).to.be.revertedWith(ERR.EXPEDITION_V2.NOT_ACTIVE)
    })

    it(`EXPEDITION: Harvesting from an ended expedition automatically exits user`, async function() {
        const { user2 } = await getNamedSigners(hre)
        const expeditionV2 = await getExpedition()
        const cakeToken = await getCakeToken()

        const everestInfoInit = await everestGet.userEverestInfo(user2.address)
        expect(everestInfoInit.interactingExpedCount).to.equal(1)

        const rewards = await expeditionV2.connect(user2).rewards(cakeToken.address, user2.address)
        
        await expect(
            expeditionV2.connect(user2).harvestExpedition(cakeToken.address)
        ).to.emit(expeditionV2, EVENT.EXPEDITION_V2.UserHarvestedExpedition).withArgs(user2.address, cakeToken.address, rewards, true)

        const everestInfoFinal = await everestGet.userEverestInfo(user2.address)
        expect(everestInfoFinal.interactingExpedCount).to.equal(0)
    })
    it(`EXPEDITION: Can't join an ended expedition`, async function() {

    })


    it('EXPEDITION: Expeditions can be restarted after they end', async function() {
        const { dev } = await getNamedSigners(hre)
        const expeditionV2 = await getExpedition()
        const cakeToken = await getCakeToken()

        await expect(
            expeditionV2.connect(dev).restartExpedition(cakeToken.address, e18(50000), 1)
        ).to.be.revertedWith(ERR.EXPEDITION_FUNDS_REQUIRED)

        await cakeToken.connect(dev).approve(expeditionV2.address, e18(100000))
        await cakeToken.connect(dev).transfer(expeditionV2.address, e18(100000))

        await expect(
            expeditionV2.connect(dev).restartExpedition(cakeToken.address, e18(50000), 1)
        ).to.emit(expeditionV2, EVENT.ExpeditionRestarted)

        await rolloverExpedition()

        await expect(
            expeditionV2.connect(dev).restartExpedition(cakeToken.address, e18(50000), 1)
        ).to.be.revertedWith(ERR.EXPEDITION_ALREADY_RUNNING)
    })

    it('EXPEDITION: Expeditions can be extended while they are running', async function() {
        const { dev } = await getNamedSigners(hre)
        const expeditionV2 = await getExpedition()
        const cakeToken = await getCakeToken()

        await cakeToken.connect(dev).approve(expeditionV2.address, e18(50000))
        await cakeToken.connect(dev).transfer(expeditionV2.address, e18(50000))
        
        await expect(
            expeditionV2.connect(dev).extendExpedition(cakeToken.address, e18(50000), 200)
        ).to.emit(expeditionV2, EVENT.ExpeditionExtended)
    })

    it(`EXPEDITION: Rounds yield correct winnings`, async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        const expeditionV2 = await getExpedition()
        const cakeToken = await getCakeToken()

        const roundEmission = (await expeditionV2.expeditionInfo(cakeToken.address)).roundEmission
    
        const users = [user1, user2, user3]

        await promiseSequenceMap(
            users,
            async (user) => await expeditionV2.connect(user).harvestExpedition(cakeToken.address)
        )

        const usersHypotheticalRewards = await promiseSequenceMap(
            users,
            async (user) => await expeditionV2.hypotheticalRewards(cakeToken.address, user.address)
        )
        const usersSafeEarnings = usersHypotheticalRewards.map((hypotheticalReward) => hypotheticalReward[0])
        const usersHypoDeitiedWinnings = usersHypotheticalRewards.map((hypotheticalReward) => hypotheticalReward[1])

        await rolloverExpedition()
        const prevWinningTotem = await expeditionPrevWinningTotem()

        const winnings = await promiseSequenceMap(
            users,
            async (user) => await expeditionV2.connect(user).rewards(cakeToken.address, user.address)
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
        const expeditionV2 = await getExpedition()
        const cakeToken = await getCakeToken()

        const users = [user1, user2, user3]

        const rewardsInit = await promiseSequenceMap(
            users,
            async (user) => await cakeToken.balanceOf(user.address)
        )

        const winnings = await promiseSequenceMap(
            users,
            async (user) => await expeditionV2.connect(user).rewards(cakeToken.address, user.address)
        )

        await promiseSequenceMap(
            users,
            async (user, index) => await expect(
                expeditionV2.connect(user).harvestExpedition(cakeToken.address)
            ).to.emit(expeditionV2, EVENT.EXPEDITION_V2.UserHarvestedExpedition).withArgs(user.address, cakeToken.address, winnings[index], false)
        )

        const rewardsFinal = await promiseSequenceMap(
            users,
            async (user) => await cakeToken.balanceOf(user.address)
        )

        users.forEach((_, index) => {
            expect(deltaBN(rewardsInit[index], rewardsFinal[index])).to.equal(winnings[index])
        })
    })

    it(`DEITIES: Switching to invalid deity should fail with error ${ERR.EXPEDITION_V2.INVALID_DEITY}`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const expeditionV2 = await getExpedition()
        
        await expect(
            expeditionV2.connect(user1).selectDeity(2)
        ).to.be.revertedWith(ERR.EXPEDITION_V2.INVALID_DEITY)
    })



    // UPDATING DEITY / SAFETY FACTOR / EVEREST OWNED

    it('DEITIES: Users should be able to switch to valid deities', async function() {
        const { user1 } = await getNamedSigners(hre)
        const expeditionV2 = await getExpedition()
        const cakeToken = await getCakeToken()

        await rolloverExpedition()
        
        await expectUserAndExpedSuppliesToMatch()

        const everestInfoInit = await everestGet.userEverestInfo(user1.address)
        const userExpedInfoInit = await expeditionV2.userExpeditionInfo(cakeToken.address, user1.address)


        // SWITCH TOTEM FROM 0 --> TARGET TOTEM
        await expeditionV2.connect(user1).selectDeity(1)

        await expectUserAndExpedSuppliesToMatch()

        const everestInfoMid = await everestGet.userEverestInfo(user1.address)
        const userExpedInfoMid = await expeditionV2.userExpeditionInfo(cakeToken.address, user1.address)
        
        
        // SWITCH BACK TO TOTEM 0 FROM TARGET TOTEM
        await expeditionV2.connect(user1).selectDeity(0)
        
        await expectUserAndExpedSuppliesToMatch()

        const everestInfoFinal = await everestGet.userEverestInfo(user1.address)
        const userExpedInfoFinal = await expeditionV2.userExpeditionInfo(cakeToken.address, user1.address)

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
        const expeditionV2 = await getExpedition()
        const cakeToken = await getCakeToken()

        await rolloverExpedition()
        
        await expectUserAndExpedSuppliesToMatch()

        const everestInfoInit = await everestGet.userEverestInfo(user1.address)
        const userExpedInfoInit = await expeditionV2.userExpeditionInfo(cakeToken.address, user1.address)
        const { safe: safeInit, deitied: deitiedInit } = await getUserSafeAndDeitiedAmount(user1)

        expect(safeInit).to.equal(userExpedInfoInit.safeSupply)
        expect(deitiedInit).to.equal(userExpedInfoInit.deitiedSupply)

        // Switch safety factor to 0
        await expeditionV2.connect(user1).selectSafetyFactor(0)

        await expectUserAndExpedSuppliesToMatch()

        const everestInfoMid = await everestGet.userEverestInfo(user1.address)
        const userExpedInfoMid = await expeditionV2.userExpeditionInfo(cakeToken.address, user1.address)
        const { safe: safeMid, deitied: deitiedMid } = await getUserSafeAndDeitiedAmount(user1)

        expect(safeMid).to.equal(userExpedInfoMid.safeSupply)
        expect(deitiedMid).to.equal(userExpedInfoMid.deitiedSupply)
        
        // Switch safety factor to 100
        await expeditionV2.connect(user1).selectSafetyFactor(100)

        await expectUserAndExpedSuppliesToMatch()

        const everestInfoMid2 = await everestGet.userEverestInfo(user1.address)
        const userExpedInfoMid2 = await expeditionV2.userExpeditionInfo(cakeToken.address, user1.address)
        const { safe: safeMid2, deitied: deitiedMid2 } = await getUserSafeAndDeitiedAmount(user1)

        expect(safeMid2).to.equal(userExpedInfoMid2.safeSupply)
        expect(deitiedMid2).to.equal(userExpedInfoMid2.deitiedSupply)
        
        
        // Switch safety factor back to 50
        await expeditionV2.connect(user1).selectSafetyFactor(50)
        
        await expectUserAndExpedSuppliesToMatch()

        const everestInfoFinal = await everestGet.userEverestInfo(user1.address)
        const userExpedInfoFinal = await expeditionV2.userExpeditionInfo(cakeToken.address, user1.address)
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
        const expeditionV2 = await getExpedition()
        const cakeToken = await getCakeToken()

        await rolloverExpedition()
        
        await expectUserAndExpedSuppliesToMatch()

        const everestInfoInit = await everestGet.userEverestInfo(user1.address)
        const userExpedInfoInit = await expeditionV2.userExpeditionInfo(cakeToken.address, user1.address)
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

        const everestInfoMid = await everestGet.userEverestInfo(user1.address)
        const userExpedInfoMid = await expeditionV2.userExpeditionInfo(cakeToken.address, user1.address)
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

        const everestInfoMid2 = await everestGet.userEverestInfo(user1.address)
        const userExpedInfoMid2 = await expeditionV2.userExpeditionInfo(cakeToken.address, user1.address)
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

        const everestInfoFinal = await everestGet.userEverestInfo(user1.address)
        const userExpedInfoFinal = await expeditionV2.userExpeditionInfo(cakeToken.address, user1.address)
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
