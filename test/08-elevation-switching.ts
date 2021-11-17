import { Contract } from "@ethersproject/contracts";
import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { e18, ERR, EVENT, OASIS, PID, POOL_FEE, TWOTHOUSAND, FIVETHOUSAND, TENTHOUSAND, EXPEDITION, depositedAfterFee, mineBlockWithTimestamp, toDecimal, expect6FigBigNumberEquals, deltaBN, expect6FigBigNumberAllEqual, promiseSequenceMap, rolloverIfAvailable, consoleLog, Contracts, getSubCartographerStaked } from "../utils";
import { expeditionUnlockedFixture } from "./fixtures";


const elevateTestSeries = async (elevationPids: number[], depositFee: number, token: Contract) => {
    const { user1 } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')
    const cartographerOasis = await ethers.getContract('CartographerOasis')
    const cartographerElevation = await ethers.getContract('CartographerElevation')

    const amountAfterFee = depositedAfterFee(e18(5), depositFee)

    await cartographer.connect(user1).deposit(elevationPids[OASIS], e18(5), 0, 0)

    const oasisStaked0 = (await cartographerOasis.userInfo(elevationPids[OASIS], user1.address)).staked
    expect(oasisStaked0).to.equal(amountAfterFee)
    const twoKStaked0 = (await cartographerElevation.userInfo(elevationPids[TWOTHOUSAND], user1.address)).staked
    expect(twoKStaked0).to.equal(0)
    const fiveKStaked0 = (await cartographerElevation.userInfo(elevationPids[FIVETHOUSAND], user1.address)).staked
    expect(fiveKStaked0).to.equal(0)
    const tenKStaked0 = (await cartographerElevation.userInfo(elevationPids[TENTHOUSAND], user1.address)).staked
    expect(tenKStaked0).to.equal(0)

    await expect (
        cartographer.connect(user1).elevate(elevationPids[OASIS], elevationPids[TWOTHOUSAND], amountAfterFee, token.address, 0)
    ).to.emit(cartographer, EVENT.Elevate).withArgs(user1.address, elevationPids[OASIS], elevationPids[TWOTHOUSAND], 0, amountAfterFee)
    const oasisStaked1 = (await cartographerOasis.userInfo(elevationPids[OASIS], user1.address)).staked
    expect(oasisStaked1).to.equal(0)
    const twoKStaked1 = (await cartographerElevation.userInfo(elevationPids[TWOTHOUSAND], user1.address)).staked
    expect(twoKStaked1).to.equal(amountAfterFee)
    const fiveKStaked1 = (await cartographerElevation.userInfo(elevationPids[FIVETHOUSAND], user1.address)).staked
    expect(fiveKStaked1).to.equal(0)
    const tenKStaked1 = (await cartographerElevation.userInfo(elevationPids[TENTHOUSAND], user1.address)).staked
    expect(tenKStaked1).to.equal(0)

    await expect (
        cartographer.connect(user1).elevate(elevationPids[TWOTHOUSAND], elevationPids[FIVETHOUSAND], amountAfterFee, token.address, 0)
    ).to.emit(cartographer, EVENT.Elevate).withArgs(user1.address, elevationPids[TWOTHOUSAND], elevationPids[FIVETHOUSAND], 0, amountAfterFee)
    const oasisStaked2 = (await cartographerOasis.userInfo(elevationPids[OASIS], user1.address)).staked
    expect(oasisStaked2).to.equal(0)
    const twoKStaked2 = (await cartographerElevation.userInfo(elevationPids[TWOTHOUSAND], user1.address)).staked
    expect(twoKStaked2).to.equal(0)
    const fiveKStaked2 = (await cartographerElevation.userInfo(elevationPids[FIVETHOUSAND], user1.address)).staked
    expect(fiveKStaked2).to.equal(amountAfterFee)
    const tenKStaked2 = (await cartographerElevation.userInfo(elevationPids[TENTHOUSAND], user1.address)).staked
    expect(tenKStaked2).to.equal(0)

    await expect (
        cartographer.connect(user1).elevate(elevationPids[FIVETHOUSAND], elevationPids[TENTHOUSAND], amountAfterFee, token.address, 0)
    ).to.emit(cartographer, EVENT.Elevate).withArgs(user1.address, elevationPids[FIVETHOUSAND], elevationPids[TENTHOUSAND], 0, amountAfterFee)
    const oasisStaked3 = (await cartographerOasis.userInfo(elevationPids[OASIS], user1.address)).staked
    expect(oasisStaked3).to.equal(0)
    const twoKStaked3 = (await cartographerElevation.userInfo(elevationPids[TWOTHOUSAND], user1.address)).staked
    expect(twoKStaked3).to.equal(0)
    const fiveKStaked3 = (await cartographerElevation.userInfo(elevationPids[FIVETHOUSAND], user1.address)).staked
    expect(fiveKStaked3).to.equal(0)
    const tenKStaked3 = (await cartographerElevation.userInfo(elevationPids[TENTHOUSAND], user1.address)).staked
    expect(tenKStaked3).to.equal(amountAfterFee)

    await expect (
        cartographer.connect(user1).elevate(elevationPids[TENTHOUSAND], elevationPids[OASIS], amountAfterFee, token.address, 0)
    ).to.emit(cartographer, EVENT.Elevate).withArgs(user1.address, elevationPids[TENTHOUSAND], elevationPids[OASIS], 0, amountAfterFee)
    const oasisStaked4 = (await cartographerOasis.userInfo(elevationPids[OASIS], user1.address)).staked
    expect(oasisStaked4).to.equal(amountAfterFee)
    const twoKStaked4 = (await cartographerElevation.userInfo(elevationPids[TWOTHOUSAND], user1.address)).staked
    expect(twoKStaked4).to.equal(0)
    const fiveKStaked4 = (await cartographerElevation.userInfo(elevationPids[FIVETHOUSAND], user1.address)).staked
    expect(fiveKStaked4).to.equal(0)
    const tenKStaked4 = (await cartographerElevation.userInfo(elevationPids[TENTHOUSAND], user1.address)).staked
    expect(tenKStaked4).to.equal(0)
}


describe("ELEVATION Switching", function() {
    before(async function() {
        const { cartographer } = await expeditionUnlockedFixture()
        await cartographer.rollover(TENTHOUSAND)
        await cartographer.rollover(FIVETHOUSAND)
        await cartographer.rollover(TWOTHOUSAND)
    })

    it('Standard elevation switch should succeed', async function() {
        const summitToken = await ethers.getContract('SummitToken')
        await elevateTestSeries([
            PID.SUMMIT_OASIS,
            PID.SUMMIT_2K,
            PID.SUMMIT_5K,
            PID.SUMMIT_10K
        ], 0, summitToken)
    })
    it('Passthrough elevation switch should succeed with deposit fee taken', async function() {
        const dummyBifiToken = await ethers.getContract('DummyBIFI')
        await elevateTestSeries([
            PID.DUMMY_BIFI_OASIS,
            PID.DUMMY_BIFI_2K,
            PID.DUMMY_BIFI_5K,
            PID.DUMMY_BIFI_10K
        ], POOL_FEE.DUMMY_BIFI_OASIS, dummyBifiToken)
    })
    it(`Switching must be to a valid totem, or will fail with error ${ERR.ELEV_SWITCH.INVALID_TOTEM}`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const summitToken = await ethers.getContract('SummitToken')

        await expect (
            cartographer.connect(user1).elevate(PID.SUMMIT_OASIS, PID.SUMMIT_2K, e18(5), summitToken.address, 2)
        ).to.be.revertedWith(ERR.ELEV_SWITCH.INVALID_TOTEM)
    })
    it(`Switching to a pool at the current elevation will fail with error ${ERR.ELEV_SWITCH.NO_SAME_ELEV_TRANSFER}`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const summitToken = await ethers.getContract('SummitToken')

        await expect (
            cartographer.connect(user1).elevate(PID.SUMMIT_OASIS, PID.SUMMIT_OASIS, e18(5), summitToken.address, 0)
        ).to.be.revertedWith(ERR.ELEV_SWITCH.NO_SAME_ELEV_TRANSFER)
    })
    it(`Switching SUMMIT to and from expeditions should succeed`, async function() {
        const { user1, dev } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const cartographerOasis = await ethers.getContract('CartographerOasis')
        const cartographerElevation = await ethers.getContract('CartographerElevation')
        const cartographerExpedition = await ethers.getContract('CartographerExpedition')
        const summitToken = await ethers.getContract('SummitToken')
        const dummyBifiToken = await ethers.getContract('DummyBIFI')
        const elevationHelper = await ethers.getContract('ElevationHelper')

        await dummyBifiToken.connect(dev).approve(cartographerExpedition.address, e18(500))
        await dummyBifiToken.connect(dev).transfer(cartographerExpedition.address, e18(500))
        await expect(
            cartographer.connect(dev).addExpedition(0, dummyBifiToken.address, e18(500), 9)
        ).to.emit(cartographer, EVENT.ExpeditionCreated).withArgs(PID.DUMMY_BIFI_EXPEDITION, dummyBifiToken.address, e18(500), 9);
        const expeditionRoundEndTime = (await elevationHelper.roundEndTimestamp(EXPEDITION)).toNumber()

        await mineBlockWithTimestamp(expeditionRoundEndTime)

        await cartographer.rollover(EXPEDITION)
        await cartographer.rollover(TENTHOUSAND)
        await cartographer.rollover(FIVETHOUSAND)
        await cartographer.rollover(TWOTHOUSAND)

        // TESTING BEGINS HERE
        await cartographer.connect(user1).deposit(PID.DUMMY_BIFI_OASIS, e18(5), 0, 0)

        await expect (
            cartographer.connect(user1).elevate(PID.DUMMY_BIFI_OASIS, PID.DUMMY_BIFI_EXPEDITION, e18(5), dummyBifiToken.address, 0)
        ).to.be.revertedWith(ERR.ELEV_SWITCH.DIFFERENT_TOKEN)

        // TESTING WORKING TRANSFERS
        await cartographer.connect(user1).deposit(PID.SUMMIT_OASIS, e18(5), 0, 0)

        const elevates = [
            [PID.SUMMIT_OASIS, PID.DUMMY_BIFI_EXPEDITION],
            [PID.DUMMY_BIFI_EXPEDITION, PID.SUMMIT_2K],
            [PID.SUMMIT_2K, PID.DUMMY_BIFI_EXPEDITION],
            [PID.DUMMY_BIFI_EXPEDITION, PID.SUMMIT_OASIS],
        ]

        const fetchBalances = async () => {
            consoleLog('Fetch balances')
            summitBalances.oasis.push((await getSubCartographerStaked(cartographerOasis, Contracts.CartographerOasis, PID.SUMMIT_OASIS, user1))[0])
            summitBalances.plains.push((await getSubCartographerStaked(cartographerElevation, Contracts.CartographerElevation, PID.SUMMIT_2K, user1))[0])
            summitBalances.expedition.push((await getSubCartographerStaked(cartographerExpedition, Contracts.CartographerExpedition, PID.DUMMY_BIFI_EXPEDITION, user1))[0])

        }

        const summitBalances = {
            oasis: <any[]>[],
            plains: <any[]>[],
            expedition: <any[]>[],
        }

        await fetchBalances()

        await promiseSequenceMap(
            elevates,
            async (elevatePoints) => {
                await cartographer.connect(user1).elevate(elevatePoints[0], elevatePoints[1], e18(5), summitToken.address, 0)
                await fetchBalances()
            }
        )

        consoleLog({
            summitOasis: summitBalances.oasis
        })

        elevates.forEach((elevatePoints, i) => {
            const fromElev = elevatePoints[0] === PID.SUMMIT_OASIS ? 'oasis' : elevatePoints[0] === PID.SUMMIT_2K ? 'plains' : 'expedition'
            const toElev = elevatePoints[1] === PID.SUMMIT_OASIS ? 'oasis' : elevatePoints[1] === PID.SUMMIT_2K ? 'plains' : 'expedition'
            consoleLog({
                txNumber: i,
                from: fromElev,
                to: toElev,
                [fromElev]: `${toDecimal(summitBalances[fromElev][i])} --> ${toDecimal(summitBalances[fromElev][i + 1])}`,
                [toElev]: `${toDecimal(summitBalances[toElev][i])} --> ${toDecimal(summitBalances[toElev][i + 1])}`,
            })
            expect6FigBigNumberAllEqual([
                // transfer amount
                e18(5),

                // from delta
                deltaBN(summitBalances[fromElev][i], summitBalances[fromElev][i + 1]),

                // to delta
                deltaBN(summitBalances[toElev][i], summitBalances[toElev][i + 1]),
            ])
        })
    })
    it(`Switching with zero amount will fail with error ${ERR.ELEV_SWITCH.NON_ZERO_AMOUNT}`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await ethers.getContract('SummitToken')
        const cartographer = await ethers.getContract('Cartographer')

        await expect (
            cartographer.connect(user1).elevate(PID.SUMMIT_OASIS, PID.SUMMIT_2K, e18(0), summitToken.address, 0)
        ).to.be.revertedWith(ERR.ELEV_SWITCH.NON_ZERO_AMOUNT)
    })
    it(`Switching more than staked will fail with error ${ERR.ELEV_SWITCH.BAD_TRANSFER}`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await ethers.getContract('SummitToken')
        const cartographer = await ethers.getContract('Cartographer')

        await expect (
            cartographer.connect(user1).elevate(PID.SUMMIT_OASIS, PID.SUMMIT_2K, e18(100), summitToken.address, 0)
        ).to.be.revertedWith(ERR.ELEV_SWITCH.BAD_TRANSFER)
    })
    it(`Switching to different totem than currently staked will fail with error ${ERR.ELEV_SWITCH.NO_TOTEM_SWITCH}`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await ethers.getContract('SummitToken')
        const cartographer = await ethers.getContract('Cartographer')

        await cartographer.connect(user1).deposit(PID.SUMMIT_2K, e18(5), 0, 0)

        await expect (
            cartographer.connect(user1).elevate(PID.SUMMIT_OASIS, PID.SUMMIT_2K, e18(5), summitToken.address, 1)
        ).to.be.revertedWith(ERR.ELEV_SWITCH.NO_TOTEM_SWITCH)
    })
    it(`Can only switch between pools of the same token, or will fail with error ${ERR.ELEV_SWITCH.DIFFERENT_TOKEN}`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await ethers.getContract('SummitToken')
        const cartographer = await ethers.getContract('Cartographer')

        await expect (
            cartographer.connect(user1).elevate(PID.SUMMIT_OASIS, PID.DUMMY_BIFI_2K, e18(5), summitToken.address, 0)
        ).to.be.revertedWith(ERR.ELEV_SWITCH.DIFFERENT_TOKEN)
    })
})
