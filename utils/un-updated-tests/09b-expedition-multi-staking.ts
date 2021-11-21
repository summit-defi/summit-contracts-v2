import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai"
import { BigNumber, Contract } from "ethers";
import hre, { ethers } from "hardhat";
import { e18, ERR, EVENT, PID, EXPEDITION, toDecimal, mineBlockWithTimestamp, Contracts, rolloverRoundUntilWinningTotem, expect6FigBigNumberAllEqual, deltaBN, promiseSequenceMap, expect6FigBigNumberEquals, consoleLog, OASIS, PLAINS, MESA, SUMMIT, getSubCartographerStaked, INF_APPROVE, getTimestamp } from "../utils";
import { expeditionUnlockedFixture } from "./fixtures";

// Constants
const DUMMY_SUMMIT_LP_OASIS = PID.DUMMY_BIFI_EXPEDITION + 1
const DUMMY_SUMMIT_LP_2K = DUMMY_SUMMIT_LP_OASIS + 1

// Utils
const getExpeditionStaked = async (cartExped: Contract, pid: number, user: SignerWithAddress) => {
    return await getSubCartographerStaked(cartExped, Contracts.CartographerExpedition, pid, user)
}
const getUnderlyingSummitInLpMult = async (cartExped: Contract, summitLp: Contract, summit: Contract) => {
    const summitInLpIncentiveMultiplier = await cartExped.summitInLpIncentiveMultiplier()
    const summitTokenInLpIndex = (await summitLp.token0()) === summit.address ? 0 : 1
    const [reserve0, reserve1] = await summitLp.getReserves()
    const summitReserve = summitTokenInLpIndex === 0 ? await reserve0 : await reserve1
    const totalSummitLpSupply = await summitLp.totalSupply()
    return e18(1).mul(summitReserve).mul(summitInLpIncentiveMultiplier).div(100).div(totalSummitLpSupply)    
}
const getUnderlyingSummitAmountInLp = (lpAmount: BigNumber, mult: BigNumber) => {
    return lpAmount.mul(mult).div(e18(1))
}



// Tests
describe("EXPEDITION MULTI STAKING", function() {
    before(async function() {
        const { dev, user1, user2, user3, dummySummitLpToken, cartographer, elevationHelper, cartographerExpedition, dummyBifiToken } = await expeditionUnlockedFixture()

        await dummyBifiToken.connect(dev).approve(cartographerExpedition.address, e18(500))
        await dummyBifiToken.connect(dev).transfer(cartographerExpedition.address, e18(500))
        await cartographer.connect(dev).addExpedition(0, dummyBifiToken.address, e18(500), 50)
        
        const expeditionRoundEndTime = (await elevationHelper.roundEndTimestamp(EXPEDITION)).toNumber()
        await mineBlockWithTimestamp(expeditionRoundEndTime)

        await cartographer.connect(dev).createTokenAllocation(dummySummitLpToken.address, 4000)

        await cartographer.connect(dev).add(dummySummitLpToken.address, OASIS, true, 0, true)
        await cartographer.connect(dev).add(dummySummitLpToken.address, PLAINS, true, 0, true)
        await cartographer.connect(dev).add(dummySummitLpToken.address, MESA, true, 0, true)
        await cartographer.connect(dev).add(dummySummitLpToken.address, SUMMIT, true, 0, true)

        await dummySummitLpToken.connect(user1).approve(cartographer.address, INF_APPROVE)
        await dummySummitLpToken.connect(user2).approve(cartographer.address, INF_APPROVE)
        await dummySummitLpToken.connect(user3).approve(cartographer.address, INF_APPROVE)

        await cartographer.rollover(EXPEDITION)
        await cartographer.rollover(PLAINS)
        await cartographer.rollover(MESA)
        await cartographer.rollover(SUMMIT)
    })

    it('DEPOSIT SUMMIT LP: Depositing SUMMIT LP alone into an Expedition succeeds', async function() {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const cartographerExpedition = await ethers.getContract('CartographerExpedition')
        const dummySummitLpToken = await ethers.getContract('DummySUMMITLP')

        const [summitStakedInit, summitLpStakedInit] = await getExpeditionStaked(cartographerExpedition, PID.DUMMY_BIFI_EXPEDITION, user1)
        const cartographerSummitLpInit = await dummySummitLpToken.balanceOf(cartographer.address)
        
        await expect(
            cartographer.connect(user1).deposit(PID.DUMMY_BIFI_EXPEDITION, 0, e18(3), 0)
        ).to.emit(cartographer, EVENT.Deposit).withArgs(user1.address, PID.DUMMY_BIFI_EXPEDITION, 0, e18(3))

        const [summitStakedFinal, summitLpStakedFinal] = await getExpeditionStaked(cartographerExpedition, PID.DUMMY_BIFI_EXPEDITION, user1)
        const cartographerSummitLpFinal = await dummySummitLpToken.balanceOf(cartographer.address)

        consoleLog({
            summitStaked: `${toDecimal(summitStakedInit)} --> ${toDecimal(summitStakedFinal)}`,
            summitLpStaked: `${toDecimal(summitLpStakedInit)} --> ${toDecimal(summitLpStakedFinal)}`,
            cartographerSummitLp: `${toDecimal(cartographerSummitLpInit)} --> ${toDecimal(cartographerSummitLpFinal)}`
        })

        expect(deltaBN(cartographerSummitLpFinal, cartographerSummitLpInit)).to.equal(e18(3))
        expect(deltaBN(summitStakedInit, summitStakedFinal)).to.equal(e18(0))
        expect(deltaBN(summitLpStakedFinal, summitLpStakedInit)).to.equal(e18(3))
    })
    it('DEPOSIT SUMMIT + SUMMIT LP: Depositing SUMMIT LP and SUMMIT TOKEN simultaneously into an Expedition succeeds', async function() {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const cartographerExpedition = await ethers.getContract('CartographerExpedition')
        const dummySummitLpToken = await ethers.getContract('DummySUMMITLP')

        const [summitStakedInit, summitLpStakedInit] = await getExpeditionStaked(cartographerExpedition, PID.DUMMY_BIFI_EXPEDITION, user1)
        const cartographerSummitLpInit = await dummySummitLpToken.balanceOf(cartographer.address)

        await expect(
            cartographer.connect(user1).deposit(PID.DUMMY_BIFI_EXPEDITION, e18(2), e18(3), 0)
        ).to.emit(cartographer, EVENT.Deposit).withArgs(user1.address, PID.DUMMY_BIFI_EXPEDITION, e18(2), e18(3))

        const [summitStakedFinal, summitLpStakedFinal] = await getExpeditionStaked(cartographerExpedition, PID.DUMMY_BIFI_EXPEDITION, user1)
        const cartographerSummitLpFinal = await dummySummitLpToken.balanceOf(cartographer.address)

        consoleLog({
            summitStaked: `${toDecimal(summitStakedInit)} --> ${toDecimal(summitStakedFinal)}`,
            summitLpStaked: `${toDecimal(summitLpStakedInit)} --> ${toDecimal(summitLpStakedFinal)}`
        })

        expect(deltaBN(cartographerSummitLpFinal, cartographerSummitLpInit)).to.equal(e18(3))
        expect(deltaBN(summitStakedInit, summitStakedFinal)).to.equal(e18(2))
        expect(deltaBN(summitLpStakedFinal, summitLpStakedInit)).to.equal(e18(3))
    })
    it('WITHDRAW SUMMIT LP: Withdrawing more than staked should still fail', async function () {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')

        await expect(
            cartographer.connect(user1).withdraw(PID.DUMMY_BIFI_EXPEDITION, e18(0), e18(100))
        ).to.be.revertedWith(ERR.BAD_WITHDRAWAL)
        await expect(
            cartographer.connect(user1).withdraw(PID.DUMMY_BIFI_EXPEDITION, e18(100), e18(100))
        ).to.be.revertedWith(ERR.BAD_WITHDRAWAL)
        await expect(
            cartographer.connect(user1).withdraw(PID.DUMMY_BIFI_EXPEDITION, e18(100), e18(0))
        ).to.be.revertedWith(ERR.BAD_WITHDRAWAL)
        await expect(
            cartographer.connect(user1).withdraw(PID.DUMMY_BIFI_EXPEDITION, e18(0), e18(0))
        ).to.be.revertedWith(ERR.BAD_WITHDRAWAL)
    })
    

    it('WITHDRAW SUMMIT LP: Withdrawing SUMMIT LP alone from an Expedition succeeds', async function() {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const cartographerExpedition = await ethers.getContract('CartographerExpedition')
        const dummySummitLpToken = await ethers.getContract('DummySUMMITLP')

        const [summitStakedInit, summitLpStakedInit] = await getExpeditionStaked(cartographerExpedition, PID.DUMMY_BIFI_EXPEDITION, user1)
        const cartographerSummitLpInit = await dummySummitLpToken.balanceOf(cartographer.address)

        await expect(
            cartographer.connect(user1).withdraw(PID.DUMMY_BIFI_EXPEDITION, 0, e18(3))
        ).to.emit(cartographer, EVENT.Withdraw).withArgs(user1.address, PID.DUMMY_BIFI_EXPEDITION, 0, e18(3))

        const [summitStakedFinal, summitLpStakedFinal] = await getExpeditionStaked(cartographerExpedition, PID.DUMMY_BIFI_EXPEDITION, user1)
        const cartographerSummitLpFinal = await dummySummitLpToken.balanceOf(cartographer.address)

        consoleLog({
            summitStaked: `${toDecimal(summitStakedInit)} --> ${toDecimal(summitStakedFinal)}`,
            summitLpStaked: `${toDecimal(summitLpStakedInit)} --> ${toDecimal(summitLpStakedFinal)}`
        })

        expect(deltaBN(cartographerSummitLpFinal, cartographerSummitLpInit)).to.equal(e18(3))
        expect(deltaBN(summitStakedInit, summitStakedFinal)).to.equal(e18(0))
        expect(deltaBN(summitLpStakedFinal, summitLpStakedInit)).to.equal(e18(3))
    })
    it('WITHDRAW SUMMIT + SUMMIT LP: Withdrawing SUMMIT LP and SUMMIT TOKEN simultaneously from an Expedition succeeds', async function() {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const cartographerExpedition = await ethers.getContract('CartographerExpedition')
        const dummySummitLpToken = await ethers.getContract('DummySUMMITLP')

        const [summitStakedInit, summitLpStakedInit] = await getExpeditionStaked(cartographerExpedition, PID.DUMMY_BIFI_EXPEDITION, user1)
        const cartographerSummitLpInit = await dummySummitLpToken.balanceOf(cartographer.address)

        await expect(
            cartographer.connect(user1).withdraw(PID.DUMMY_BIFI_EXPEDITION, e18(2), e18(3))
        ).to.emit(cartographer, EVENT.Withdraw).withArgs(user1.address, PID.DUMMY_BIFI_EXPEDITION, e18(2), e18(3))

        const [summitStakedFinal, summitLpStakedFinal] = await getExpeditionStaked(cartographerExpedition, PID.DUMMY_BIFI_EXPEDITION, user1)
        const cartographerSummitLpFinal = await dummySummitLpToken.balanceOf(cartographer.address)

        consoleLog({
            summitStaked: `${toDecimal(summitStakedInit)} --> ${toDecimal(summitStakedFinal)}`,
            summitLpStaked: `${toDecimal(summitLpStakedInit)} --> ${toDecimal(summitLpStakedFinal)}`
        })

        expect(deltaBN(cartographerSummitLpFinal, cartographerSummitLpInit)).to.equal(e18(3))
        expect(deltaBN(summitStakedInit, summitStakedFinal)).to.equal(e18(2))
        expect(deltaBN(summitLpStakedFinal, summitLpStakedInit)).to.equal(e18(3))
    })
    

    it('ELEVATE SUMMIT LP: Elevating SUMMIT LP to an Oasis farm and back should succeed', async function() {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const cartographerExpedition = await ethers.getContract('CartographerExpedition')
        const cartographerOasis = await ethers.getContract('CartographerOasis')
        const dummySummitLpToken = await ethers.getContract('DummySUMMITLP')

        await cartographer.connect(user1).deposit(PID.DUMMY_BIFI_EXPEDITION, 0, e18(3), 0)

        const [summitStakedInit, summitLpStakedInit] = await getExpeditionStaked(cartographerExpedition, PID.DUMMY_BIFI_EXPEDITION, user1)
        const [oasisSummitLpStakedInit] = await getSubCartographerStaked(cartographerOasis, Contracts.CartographerOasis, DUMMY_SUMMIT_LP_OASIS, user1)
        const cartographerSummitLpInit = await dummySummitLpToken.balanceOf(cartographer.address)



        await expect(
            cartographer.connect(user1).elevate(PID.DUMMY_BIFI_EXPEDITION, DUMMY_SUMMIT_LP_OASIS, e18(3), dummySummitLpToken.address, 0)
        ).to.emit(cartographer, EVENT.Elevate).withArgs(user1.address, PID.DUMMY_BIFI_EXPEDITION, DUMMY_SUMMIT_LP_OASIS, 0, e18(3))

        const [summitStakedMid, summitLpStakedMid] = await getExpeditionStaked(cartographerExpedition, PID.DUMMY_BIFI_EXPEDITION, user1)
        const [oasisSummitLpStakedMid] = await getSubCartographerStaked(cartographerOasis, Contracts.CartographerOasis, DUMMY_SUMMIT_LP_OASIS, user1)
        const cartographerSummitLpMid = await dummySummitLpToken.balanceOf(cartographer.address)

        consoleLog({
            summitStaked: `${toDecimal(summitStakedInit)} --> ${toDecimal(summitStakedMid)}`,
            summitLpStaked: `${toDecimal(summitLpStakedInit)} --> ${toDecimal(summitLpStakedMid)}`,
            oasisSummitLpStaked: `${toDecimal(oasisSummitLpStakedInit)} --> ${toDecimal(oasisSummitLpStakedMid)}`
        })

        expect(deltaBN(cartographerSummitLpMid, cartographerSummitLpInit)).to.equal(e18(0))
        expect(deltaBN(summitStakedInit, summitStakedMid)).to.equal(e18(0))
        expect(deltaBN(oasisSummitLpStakedInit, oasisSummitLpStakedMid)).to.equal(e18(3))
        expect(deltaBN(summitLpStakedMid, summitLpStakedInit)).to.equal(e18(3))



        await expect(
            cartographer.connect(user1).elevate(DUMMY_SUMMIT_LP_OASIS, PID.DUMMY_BIFI_EXPEDITION, e18(3), dummySummitLpToken.address, 0)
        ).to.emit(cartographer, EVENT.Elevate).withArgs(user1.address, DUMMY_SUMMIT_LP_OASIS, PID.DUMMY_BIFI_EXPEDITION, 0, e18(3))

        const [summitStakedFinal, summitLpStakedFinal] = await getExpeditionStaked(cartographerExpedition, PID.DUMMY_BIFI_EXPEDITION, user1)
        const [oasisSummitLpStakedFinal] = await getSubCartographerStaked(cartographerOasis, Contracts.CartographerOasis, DUMMY_SUMMIT_LP_OASIS, user1)
        const cartographerSummitLpFinal = await dummySummitLpToken.balanceOf(cartographer.address)

        consoleLog({
            summitStaked: `${toDecimal(summitStakedInit)} --> ${toDecimal(summitStakedMid)} --> ${toDecimal(summitStakedFinal)}`,
            summitLpStaked: `${toDecimal(summitLpStakedInit)} --> ${toDecimal(summitLpStakedMid)} --> ${toDecimal(summitLpStakedFinal)}`,
            oasisSummitLpStaked: `${toDecimal(oasisSummitLpStakedInit)} --> ${toDecimal(oasisSummitLpStakedMid)} --> ${toDecimal(oasisSummitLpStakedFinal)}`
        })

        expect(deltaBN(cartographerSummitLpFinal, cartographerSummitLpMid)).to.equal(e18(0))
        expect(deltaBN(summitStakedMid, summitStakedFinal)).to.equal(e18(0))
        expect(deltaBN(oasisSummitLpStakedMid, oasisSummitLpStakedFinal)).to.equal(e18(3))
        expect(deltaBN(summitLpStakedFinal, summitLpStakedMid)).to.equal(e18(3))

        // Before and After match
        expect(deltaBN(cartographerSummitLpFinal, cartographerSummitLpInit)).to.equal(e18(0))
        expect(deltaBN(summitStakedFinal, summitStakedInit)).to.equal(e18(0))
        expect(deltaBN(oasisSummitLpStakedFinal, oasisSummitLpStakedInit)).to.equal(e18(0))
        expect(deltaBN(summitLpStakedFinal, summitLpStakedInit)).to.equal(e18(0))
    })
    it('ELEVATE SUMMIT LP: Elevating SUMMIT LP to an Elevation farm and back should succeed', async function() {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const cartographerExpedition = await ethers.getContract('CartographerExpedition')
        const cartographerElevation = await ethers.getContract('CartographerElevation')
        const dummySummitLpToken = await ethers.getContract('DummySUMMITLP')

        await cartographer.connect(user1).deposit(PID.DUMMY_BIFI_EXPEDITION, 0, e18(3), 0)

        const [summitStakedInit, summitLpStakedInit] = await getExpeditionStaked(cartographerExpedition, PID.DUMMY_BIFI_EXPEDITION, user1)
        const [oasisSummitLpStakedInit] = await getSubCartographerStaked(cartographerElevation, Contracts.CartographerElevation, DUMMY_SUMMIT_LP_2K, user1)
        const cartographerSummitLpInit = await dummySummitLpToken.balanceOf(cartographer.address)



        await expect(
            cartographer.connect(user1).elevate(PID.DUMMY_BIFI_EXPEDITION, DUMMY_SUMMIT_LP_2K, e18(3), dummySummitLpToken.address, 0)
        ).to.emit(cartographer, EVENT.Elevate).withArgs(user1.address, PID.DUMMY_BIFI_EXPEDITION, DUMMY_SUMMIT_LP_2K, 0, e18(3))

        const [summitStakedMid, summitLpStakedMid] = await getExpeditionStaked(cartographerExpedition, PID.DUMMY_BIFI_EXPEDITION, user1)
        const [oasisSummitLpStakedMid] = await getSubCartographerStaked(cartographerElevation, Contracts.CartographerElevation, DUMMY_SUMMIT_LP_2K, user1)
        const cartographerSummitLpMid = await dummySummitLpToken.balanceOf(cartographer.address)

        consoleLog({
            summitStaked: `${toDecimal(summitStakedInit)} --> ${toDecimal(summitStakedMid)}`,
            summitLpStaked: `${toDecimal(summitLpStakedInit)} --> ${toDecimal(summitLpStakedMid)}`,
            oasisSummitLpStaked: `${toDecimal(oasisSummitLpStakedInit)} --> ${toDecimal(oasisSummitLpStakedMid)}`
        })

        expect(deltaBN(cartographerSummitLpMid, cartographerSummitLpInit)).to.equal(e18(0))
        expect(deltaBN(summitStakedInit, summitStakedMid)).to.equal(e18(0))
        expect(deltaBN(oasisSummitLpStakedInit, oasisSummitLpStakedMid)).to.equal(e18(3))
        expect(deltaBN(summitLpStakedMid, summitLpStakedInit)).to.equal(e18(3))



        await expect(
            cartographer.connect(user1).elevate(DUMMY_SUMMIT_LP_2K, PID.DUMMY_BIFI_EXPEDITION, e18(3), dummySummitLpToken.address, 0)
        ).to.emit(cartographer, EVENT.Elevate).withArgs(user1.address, DUMMY_SUMMIT_LP_2K, PID.DUMMY_BIFI_EXPEDITION, 0, e18(3))

        const [summitStakedFinal, summitLpStakedFinal] = await getExpeditionStaked(cartographerExpedition, PID.DUMMY_BIFI_EXPEDITION, user1)
        const [oasisSummitLpStakedFinal] = await getSubCartographerStaked(cartographerElevation, Contracts.CartographerElevation, DUMMY_SUMMIT_LP_2K, user1)
        const cartographerSummitLpFinal = await dummySummitLpToken.balanceOf(cartographer.address)

        consoleLog({
            summitStaked: `${toDecimal(summitStakedInit)} --> ${toDecimal(summitStakedMid)} --> ${toDecimal(summitStakedFinal)}`,
            summitLpStaked: `${toDecimal(summitLpStakedInit)} --> ${toDecimal(summitLpStakedMid)} --> ${toDecimal(summitLpStakedFinal)}`,
            oasisSummitLpStaked: `${toDecimal(oasisSummitLpStakedInit)} --> ${toDecimal(oasisSummitLpStakedMid)} --> ${toDecimal(oasisSummitLpStakedFinal)}`
        })

        expect(deltaBN(cartographerSummitLpFinal, cartographerSummitLpMid)).to.equal(e18(0))
        expect(deltaBN(summitStakedMid, summitStakedFinal)).to.equal(e18(0))
        expect(deltaBN(oasisSummitLpStakedMid, oasisSummitLpStakedFinal)).to.equal(e18(3))
        expect(deltaBN(summitLpStakedFinal, summitLpStakedMid)).to.equal(e18(3))

        // Before and After match
        expect(deltaBN(cartographerSummitLpFinal, cartographerSummitLpInit)).to.equal(e18(0))
        expect(deltaBN(summitStakedFinal, summitStakedInit)).to.equal(e18(0))
        expect(deltaBN(oasisSummitLpStakedFinal, oasisSummitLpStakedInit)).to.equal(e18(0))
        expect(deltaBN(summitLpStakedFinal, summitLpStakedInit)).to.equal(e18(0))
    })  
    
    // ELEVATION --> OASIS --> ELEVATION SUMMIT LP ELEVATE
    it('ELEVATE SUMMIT LP: Elevating SUMMIT LP from an elevation to an oasis farm and back should succeed', async function() {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const cartographerElevation = await ethers.getContract('CartographerElevation')
        const cartographerOasis = await ethers.getContract('CartographerOasis')
        const summitToken = await ethers.getContract('SummitToken')
        const dummySummitLpToken = await ethers.getContract('DummySUMMITLP')

        await cartographer.connect(user1).deposit(DUMMY_SUMMIT_LP_2K, e18(3), 0, 0)

        const [plainsSummitLpStakedInit] = await getSubCartographerStaked(cartographerElevation, Contracts.CartographerElevation, DUMMY_SUMMIT_LP_2K, user1)
        const [oasisSummitLpStakedInit] = await getSubCartographerStaked(cartographerOasis, Contracts.CartographerOasis, DUMMY_SUMMIT_LP_OASIS, user1)
        const cartographerSummitLpInit = await dummySummitLpToken.balanceOf(cartographer.address)



        await expect(
            cartographer.connect(user1).elevate(DUMMY_SUMMIT_LP_2K, DUMMY_SUMMIT_LP_OASIS, e18(3), summitToken.address, 0)
        ).to.emit(cartographer, EVENT.Elevate).withArgs(user1.address, DUMMY_SUMMIT_LP_2K, DUMMY_SUMMIT_LP_OASIS, 0, e18(3))

        const [plainsSummitLpStakedMid] = await getSubCartographerStaked(cartographerElevation, Contracts.CartographerElevation, DUMMY_SUMMIT_LP_2K, user1)
        const [oasisSummitLpStakedMid] = await getSubCartographerStaked(cartographerOasis, Contracts.CartographerOasis, DUMMY_SUMMIT_LP_OASIS, user1)
        const cartographerSummitLpMid = await dummySummitLpToken.balanceOf(cartographer.address)

        consoleLog({
            summitStaked: `${toDecimal(plainsSummitLpStakedInit)} --> ${toDecimal(plainsSummitLpStakedMid)}`,
            oasisSummitLpStaked: `${toDecimal(oasisSummitLpStakedInit)} --> ${toDecimal(oasisSummitLpStakedMid)}`
        })

        expect(deltaBN(cartographerSummitLpMid, cartographerSummitLpInit)).to.equal(e18(0))
        expect(deltaBN(plainsSummitLpStakedInit, plainsSummitLpStakedMid)).to.equal(e18(3))
        expect(deltaBN(oasisSummitLpStakedInit, oasisSummitLpStakedMid)).to.equal(e18(3))



        await expect(
            cartographer.connect(user1).elevate(DUMMY_SUMMIT_LP_OASIS, DUMMY_SUMMIT_LP_2K, e18(3), summitToken.address, 0)
        ).to.emit(cartographer, EVENT.Elevate).withArgs(user1.address, DUMMY_SUMMIT_LP_OASIS, DUMMY_SUMMIT_LP_2K, 0, e18(3))

        const [plainsSummitLpStakedFinal] = await getSubCartographerStaked(cartographerElevation, Contracts.CartographerElevation, DUMMY_SUMMIT_LP_2K, user1)
        const [oasisSummitLpStakedFinal] = await getSubCartographerStaked(cartographerOasis, Contracts.CartographerOasis, DUMMY_SUMMIT_LP_OASIS, user1)
        const cartographerSummitLpFinal = await dummySummitLpToken.balanceOf(cartographer.address)

        consoleLog({
            summitStaked: `${toDecimal(plainsSummitLpStakedInit)} --> ${toDecimal(plainsSummitLpStakedMid)} --> ${toDecimal(plainsSummitLpStakedFinal)}`,
            oasisSummitLpStaked: `${toDecimal(oasisSummitLpStakedInit)} --> ${toDecimal(oasisSummitLpStakedMid)} --> ${toDecimal(oasisSummitLpStakedFinal)}`
        })

        expect(deltaBN(cartographerSummitLpFinal, cartographerSummitLpMid)).to.equal(e18(0))
        expect(deltaBN(plainsSummitLpStakedMid, plainsSummitLpStakedFinal)).to.equal(e18(3))
        expect(deltaBN(oasisSummitLpStakedMid, oasisSummitLpStakedFinal)).to.equal(e18(3))

        // Before and After match
        expect(deltaBN(cartographerSummitLpFinal, cartographerSummitLpInit)).to.equal(e18(0))
        expect(deltaBN(plainsSummitLpStakedFinal, plainsSummitLpStakedInit)).to.equal(e18(0))
        expect(deltaBN(oasisSummitLpStakedFinal, oasisSummitLpStakedInit)).to.equal(e18(0))
    })  


    // Elevating SUMMIT LP from Expedition to NON SUMMIT LP pool should fail
    it(`ELEVATE SUMMIT LP: Elevating SUMMIT LP from Expedition to NON SUMMIT LP pool should fail with error "${ERR.ELEV_SWITCH.DIFFERENT_TOKEN}"`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const dummySummitLpToken = await ethers.getContract('DummySUMMITLP')

        await expect(
            cartographer.connect(user1).elevate(PID.DUMMY_BIFI_EXPEDITION, PID.SUMMIT_OASIS, e18(3), dummySummitLpToken.address, 0)
        ).to.be.revertedWith(ERR.ELEV_SWITCH.DIFFERENT_TOKEN)
    })




    it(`SUMMIT LP EQUIVALENCE: SUMMIT LP behaves like SUMMIT token`, async function () {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const summitToken = await ethers.getContract('SummitToken')
        const cartographerExpedition = await ethers.getContract('CartographerExpedition')
        const dummySummitLpToken = await ethers.getContract('DummySUMMITLP')

        const users = [user1, user2, user3]

        await cartographer.connect(user1).deposit(PID.DUMMY_BIFI_EXPEDITION, e18(1), e18(1), 0)
        await cartographer.connect(user2).deposit(PID.DUMMY_BIFI_EXPEDITION, e18(2), e18(5), 0)
        await cartographer.connect(user3).deposit(PID.DUMMY_BIFI_EXPEDITION, e18(0), e18(2), 1)

        const underlyingSummitInLpMult = await getUnderlyingSummitInLpMult(cartographerExpedition, dummySummitLpToken, summitToken)
        consoleLog({
            underlyingSummitInLpMult: toDecimal(underlyingSummitInLpMult),
        })

        // Validate Hypothetical Winnings Match Expected
        const usersSummitBalancesAndHypotheticals = await promiseSequenceMap(
            users,
            async (user, index) => {
                const [summitTokenBalance, summitLpBalance] = await getExpeditionStaked(cartographerExpedition, PID.DUMMY_BIFI_EXPEDITION, user)
                const underlyingSummitInLp = getUnderlyingSummitAmountInLp(summitLpBalance, underlyingSummitInLpMult)

                const combinedEquivalentSummit = summitTokenBalance.add(underlyingSummitInLp)

                const [expedCombinedSummit, hypotheticalWinnings] = await cartographer.connect(user).hypotheticalRewards(PID.DUMMY_BIFI_EXPEDITION, user.address)

                consoleLog({
                    user: index,
                    summitTokenBalance: toDecimal(summitTokenBalance),
                    summitLpBalance: toDecimal(summitLpBalance),
                    combinedEquivalentSummit: toDecimal(combinedEquivalentSummit),
                    expedCombinedSummit: toDecimal(expedCombinedSummit),
                    hypotheticalWinnings: toDecimal(hypotheticalWinnings)
                })
                
                expect(combinedEquivalentSummit).to.equal(expedCombinedSummit)

                return {
                    summitTokenBalance,
                    summitLpBalance,
                    combinedSummit: combinedEquivalentSummit,
                    hypotheticalWinnings,
                }
            }
        )


        const trueRoundEmission = (await cartographerExpedition.expeditionPoolInfo(PID.DUMMY_BIFI_EXPEDITION)).roundEmission

        expect6FigBigNumberAllEqual([
            trueRoundEmission,
            usersSummitBalancesAndHypotheticals[0].hypotheticalWinnings.add(
                usersSummitBalancesAndHypotheticals[1].hypotheticalWinnings
            ),
            usersSummitBalancesAndHypotheticals[2].hypotheticalWinnings
        ])

        const [totem0Supply, totem1Supply] = await cartographerExpedition.totemSupplies(PID.DUMMY_BIFI_EXPEDITION)
        expect(totem0Supply).to.equal(
            usersSummitBalancesAndHypotheticals[0].combinedSummit.add(
                usersSummitBalancesAndHypotheticals[1].combinedSummit
            )
        )
        expect(totem1Supply).to.equal(usersSummitBalancesAndHypotheticals[2].combinedSummit)
    })

    it(`SUMMIT LP EQUIVALENCE: Rolling over a round updates the winnings multipliers correctly`, async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const summitToken = await ethers.getContract('SummitToken')
        const cartographerExpedition = await ethers.getContract('CartographerExpedition')
        const elevationHelper = await ethers.getContract('ElevationHelper')
        const dummySummitLpToken = await ethers.getContract('DummySUMMITLP')

        const users = [user1, user2, user3]

        const underlyingSummitInLpMult = await getUnderlyingSummitInLpMult(cartographerExpedition, dummySummitLpToken, summitToken)

        // Validate Hypothetical Winnings Match Expected
        const usersSummitBalancesAndHypotheticals = await promiseSequenceMap(
            users,
            async (user) => {
                const [summitTokenBalance, summitLpBalance] = await getExpeditionStaked(cartographerExpedition, PID.DUMMY_BIFI_EXPEDITION, user)
                const underlyingSummitInLp = getUnderlyingSummitAmountInLp(summitLpBalance, underlyingSummitInLpMult)
                const combinedEquivalentSummit = summitTokenBalance.add(underlyingSummitInLp)
                const [expedCombinedSummit, hypotheticalWinnings] = await cartographer.connect(user).hypotheticalRewards(PID.DUMMY_BIFI_EXPEDITION, user.address)
                return {
                    summitTokenBalance,
                    summitLpBalance,
                    combinedSummit: combinedEquivalentSummit,
                    hypotheticalWinnings,
                }
            }
        )

        await promiseSequenceMap(
            [0, 1],
            async (winningTotem) => {
                const winningUsers = winningTotem === 0 ? [user1, user2, null] : [null, null, user3]

                // Clear Winnings from previous iterations
                await promiseSequenceMap(
                    winningUsers,
                    async (user) => {
                        if (user == null) return
                        await cartographer.connect(user).deposit(PID.DUMMY_BIFI_EXPEDITION, 0, 0, winningTotem) 
                    }
                )

                // Rollover Round
                await rolloverRoundUntilWinningTotem(Contracts.CartographerExpedition, cartographer, cartographerExpedition, elevationHelper, PID.DUMMY_BIFI_EXPEDITION, winningTotem)

                // Validate Winnings match hypotheticals
                await promiseSequenceMap(
                    winningUsers,
                    async (user, index) => {
                        if (user == null) return
                        const [winnings] = await cartographer.rewards(PID.DUMMY_BIFI_EXPEDITION, user.address)
                        expect6FigBigNumberEquals(winnings, usersSummitBalancesAndHypotheticals[index].hypotheticalWinnings)
                    }
                )
            }
        )
        
    })
    it(`SUMMIT LP EQUIVALENCE: Equivalent amounts of SUMMIT and SUMMIT LP should yield the same rewards`, async function () {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const summitToken = await ethers.getContract('SummitToken')
        const cartographerExpedition = await ethers.getContract('CartographerExpedition')
        const elevationHelper = await ethers.getContract('ElevationHelper')
        const dummySummitLpToken = await ethers.getContract('DummySUMMITLP')

        const users = [user1, user2, user3]
        await cartographer.connect(user1).withdraw(PID.DUMMY_BIFI_EXPEDITION, e18(1), e18(7))
        await cartographer.connect(user2).withdraw(PID.DUMMY_BIFI_EXPEDITION, e18(2), e18(5))

        const underlyingSummitInLpMult = await getUnderlyingSummitInLpMult(cartographerExpedition, dummySummitLpToken, summitToken)
        const equivalentSummit = getUnderlyingSummitAmountInLp(e18(5), underlyingSummitInLpMult)

        await cartographer.connect(user1).deposit(PID.DUMMY_BIFI_EXPEDITION, e18(0), e18(5), 0)
        await cartographer.connect(user2).deposit(PID.DUMMY_BIFI_EXPEDITION, equivalentSummit, e18(0), 0)

        const [user1ExpedCombinedSummit, user1HypotheticalWinnings] = await cartographer.connect(user1).hypotheticalRewards(PID.DUMMY_BIFI_EXPEDITION, user1.address)
        const [user2ExpedCombinedSummit, user2HypotheticalWinnings] = await cartographer.connect(user2).hypotheticalRewards(PID.DUMMY_BIFI_EXPEDITION, user2.address)

        consoleLog({
            summitAmount: toDecimal(e18(5)),
            equivalentSummit: toDecimal(equivalentSummit),
            combinedSummit: `USER 1: ${toDecimal(user1ExpedCombinedSummit)}, USER 2: ${toDecimal(user2ExpedCombinedSummit)}`,
            hypotheticalWinnings: `USER 1: ${toDecimal(user1HypotheticalWinnings)}, USER 2: ${toDecimal(user2HypotheticalWinnings)}`,
        })

        expect(user1ExpedCombinedSummit).to.equal(user2ExpedCombinedSummit)
        expect(user1HypotheticalWinnings).to.equal(user2HypotheticalWinnings)


        // Rollover Round
        await rolloverRoundUntilWinningTotem(Contracts.CartographerExpedition, cartographer, cartographerExpedition, elevationHelper, PID.DUMMY_BIFI_EXPEDITION, 0)
        await rolloverRoundUntilWinningTotem(Contracts.CartographerExpedition, cartographer, cartographerExpedition, elevationHelper, PID.DUMMY_BIFI_EXPEDITION, 0)

        const [user1Winnings] = await cartographer.rewards(PID.DUMMY_BIFI_EXPEDITION, user1.address)
        expect6FigBigNumberEquals(user1Winnings, user1HypotheticalWinnings.mul(2))
        const [user2Winnings] = await cartographer.rewards(PID.DUMMY_BIFI_EXPEDITION, user2.address)
        expect6FigBigNumberEquals(user2Winnings, user2HypotheticalWinnings.mul(2))

        consoleLog({
            user1: `${toDecimal(user1HypotheticalWinnings)} * 3 = ${toDecimal(user1Winnings)}`,
            user2: `${toDecimal(user2HypotheticalWinnings)} * 3 = ${toDecimal(user2Winnings)}`,
        })

        expect(user1Winnings).to.equal(user2Winnings)
    })


    // The SUMMIT - [NATIVE token, SUMMIT token] ratio changing in the SUMMIT LP token
    it(`SUMMIT LP RATIO: SUMMIT LP ratio changing updates hypothetical rewards`, async function() {
        const { user1, user2 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const summitToken = await ethers.getContract('SummitToken')
        const cartographerExpedition = await ethers.getContract('CartographerExpedition')
        const dummySummitLpToken = await ethers.getContract('DummySUMMITLP')

        // Update SUMMIT LP ratio
        await dummySummitLpToken.setReserves(
            e18(200),   // SUMMIT token
            e18(125)    // NATIVE token
        )

        const underlyingSummitInLpMult = await getUnderlyingSummitInLpMult(cartographerExpedition, dummySummitLpToken, summitToken)
        const [user1ExpedCombinedSummit, user1HypotheticalWinnings] = await cartographer.connect(user1).hypotheticalRewards(PID.DUMMY_BIFI_EXPEDITION, user1.address)
        const [user2ExpedCombinedSummit, user2HypotheticalWinnings] = await cartographer.connect(user2).hypotheticalRewards(PID.DUMMY_BIFI_EXPEDITION, user2.address)

        consoleLog({
            underlyingSummitInLpMult: toDecimal(underlyingSummitInLpMult),
            user1: `SUMMIT LP   : ${toDecimal(e18(5))}, combinedSummit ${toDecimal(user1ExpedCombinedSummit)}, hypotheticalWinnings: ${toDecimal(user1HypotheticalWinnings)}`,
            user2: `SUMMIT Token: ${toDecimal(e18(10))}, combinedSummit ${toDecimal(user2ExpedCombinedSummit)}, hypotheticalWinnings: ${toDecimal(user2HypotheticalWinnings)}`,
        })

        expect(user1ExpedCombinedSummit).to.equal(getUnderlyingSummitAmountInLp(e18(5), underlyingSummitInLpMult))
        expect(user2ExpedCombinedSummit).to.equal(e18(10))
        expect6FigBigNumberEquals(
            user1HypotheticalWinnings.div(getUnderlyingSummitAmountInLp(e18(5), underlyingSummitInLpMult)),
            user2HypotheticalWinnings.div(e18(10))
        )        
    })
    it(`SUMMIT LP RATIO: SUMMIT LP ratio changing after round end doesn't change winnings`, async function() {
        const { user1, user2 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const cartographerExpedition = await ethers.getContract('CartographerExpedition')
        const elevationHelper = await ethers.getContract('ElevationHelper')
        const dummySummitLpToken = await ethers.getContract('DummySUMMITLP')

        
        // Revert SUMMIT LP ratio for initial values
        await dummySummitLpToken.setReserves(
            e18(100),   // SUMMIT token
            e18(150)    // NATIVE token
        )

        
        await rolloverRoundUntilWinningTotem(Contracts.CartographerExpedition, cartographer, cartographerExpedition, elevationHelper, PID.DUMMY_BIFI_EXPEDITION, 0)
        const [user1WinningsInit] = await cartographer.rewards(PID.DUMMY_BIFI_EXPEDITION, user1.address)
        const [user2WinningsInit] = await cartographer.rewards(PID.DUMMY_BIFI_EXPEDITION, user2.address)


        // Update SUMMIT LP ratio
        await dummySummitLpToken.setReserves(
            e18(200),   // SUMMIT token
            e18(125)    // NATIVE token
        )

        const [user1WinningsFinal] = await cartographer.rewards(PID.DUMMY_BIFI_EXPEDITION, user1.address)
        const [user2WinningsFinal] = await cartographer.rewards(PID.DUMMY_BIFI_EXPEDITION, user2.address)

        expect(user1WinningsInit).to.equal(user1WinningsFinal)
        expect(user2WinningsInit).to.equal(user2WinningsFinal)
        
        // Final Revert SUMMIT LP ratio back to initial values
        await dummySummitLpToken.setReserves(
            e18(100),   // SUMMIT token
            e18(150)    // NATIVE token
        )

        expect(true).to.be.true
    })
    


    // Updating Summit in Lp Incentive Multiplier
    it(`INCENTIVE MULTIPLIER: SUMMIT LP Incentive multiplier can be updated`, async function() {
        const { dev, user1, user2 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const summitToken = await ethers.getContract('SummitToken')
        const cartographerExpedition = await ethers.getContract('CartographerExpedition')
        const dummySummitLpToken = await ethers.getContract('DummySUMMITLP')

        // Only callable by owner
        await expect(
            cartographerExpedition.connect(user1).setSummitInLpIncentiveMultiplier(200)
        ).to.be.revertedWith(ERR.NON_OWNER)

        // Only valid values for incentive multiplier
        await expect(
            cartographerExpedition.connect(dev).setSummitInLpIncentiveMultiplier(50)
        ).to.be.revertedWith(ERR.INVALID_INCENTIVE_MULT)
        await expect(
            cartographerExpedition.connect(dev).setSummitInLpIncentiveMultiplier(250)
        ).to.be.revertedWith(ERR.INVALID_INCENTIVE_MULT)
        
        // Setting lp incentive multiplier should succeed
        await expect(
            cartographerExpedition.connect(dev).setSummitInLpIncentiveMultiplier(130)
        ).to.emit(cartographerExpedition, EVENT.SET_EXPED_SUMMIT_LP_INCENTIVE_MULT).withArgs(dev.address, 130)

        // Updated incentive multiplier should be reflected in combined staked and hypothetical winnings
        const underlyingSummitInLpMult = await getUnderlyingSummitInLpMult(cartographerExpedition, dummySummitLpToken, summitToken)
        const [user1ExpedCombinedSummit, user1HypotheticalWinnings] = await cartographer.connect(user1).hypotheticalRewards(PID.DUMMY_BIFI_EXPEDITION, user1.address)
        const [user2ExpedCombinedSummit, user2HypotheticalWinnings] = await cartographer.connect(user2).hypotheticalRewards(PID.DUMMY_BIFI_EXPEDITION, user2.address)

        consoleLog({
            underlyingSummitInLpMult: toDecimal(underlyingSummitInLpMult),
            user1: `SUMMIT LP   : ${toDecimal(e18(5))}, combinedSummit ${toDecimal(user1ExpedCombinedSummit)}, hypotheticalWinnings: ${toDecimal(user1HypotheticalWinnings)}`,
            user2: `SUMMIT Token: ${toDecimal(e18(10))}, combinedSummit ${toDecimal(user2ExpedCombinedSummit)}, hypotheticalWinnings: ${toDecimal(user2HypotheticalWinnings)}`,
        })

        expect(user1ExpedCombinedSummit).to.equal(getUnderlyingSummitAmountInLp(e18(5), underlyingSummitInLpMult))
        expect(user2ExpedCombinedSummit).to.equal(e18(10))
        expect6FigBigNumberEquals(
            user1HypotheticalWinnings.div(getUnderlyingSummitAmountInLp(e18(5), underlyingSummitInLpMult)),
            user2HypotheticalWinnings.div(e18(10))
        )        
    })
})
