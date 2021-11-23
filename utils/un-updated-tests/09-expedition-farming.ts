import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { e18, ERR, EVENT, PID, elevationTests, SubCartographer, EXPEDITION, rolloverRounds, rolloverRound, mineBlocks, toDecimal, mineBlockWithTimestamp, TOTEM_COUNT, Contracts, rolloverRoundUntilWinningTotem, expect6FigBigNumberAllEqual, deltaBN, promiseSequenceMap, e12, expect6FigBigNumberEquals, consoleLog } from "../utils";
import { expeditionUnlockedFixture } from "./fixtures";

describe("EXPEDITION FARMING", function() {
    before(async function() {
        await expeditionUnlockedFixture()
    })

    it('EXPEDITION: Creating a valid expedition works', async function() {
        const { user1, dev } = await getNamedSigners(hre)
        const cartographer = await getCartographer()
        const cartographerExpedition = await ethers.getContract('CartographerExpedition')
        const bifiToken = await ethers.getContract('DummyBIFI')
        const dummyCakeToken = await ethers.getContract('DummyCAKE')

        await expect(
            cartographer.connect(user1).addExpedition(0, dummyCakeToken.address, e18(100), 9)
        ).to.be.revertedWith(ERR.NON_OWNER)
        
        await expect(
            cartographer.connect(dev).addExpedition(0, bifiToken.address, e18(100), 9)
        ).to.be.revertedWith(ERR.EXPEDITION_FUNDS_REQUIRED)
        
        await bifiToken.connect(dev).approve(cartographerExpedition.address, e18(500000))
        await bifiToken.connect(dev).transfer(cartographerExpedition.address, e18(500000))
        await dummyCakeToken.connect(dev).approve(cartographerExpedition.address, e18(50000))
        await dummyCakeToken.connect(dev).transfer(cartographerExpedition.address, e18(50000))
        
        await expect(
            cartographer.connect(dev).addExpedition(0, bifiToken.address, e18(500000), 9)
        ).to.emit(cartographer, EVENT.ExpeditionCreated).withArgs(PID.DUMMY_BIFI_EXPEDITION, bifiToken.address, e18(500000), 9);
        await expect(
            cartographer.connect(dev).addExpedition(0, dummyCakeToken.address, e18(50000), 9)
        ).to.emit(cartographer, EVENT.ExpeditionCreated).withArgs(PID.DUMMY_CAKE_EXPEDITION, dummyCakeToken.address, e18(50000), 9);

        await expect(
            cartographer.connect(dev).addExpedition(0, dummyCakeToken.address, e18(50000), 9)
        ).to.be.revertedWith(ERR.DUPLICATED)
    })
    it('EXPEDITION: Deposits unlock when expedition rolls over', async function() {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await getCartographer()
        const elevationHelper = await ethers.getContract('ElevationHelper')

        await expect(
            cartographer.connect(user1).deposit(PID.DUMMY_BIFI_EXPEDITION, e18(3), 0, 0)
        ).to.be.revertedWith(ERR.POOL_NOT_AVAILABLE_YET)

        const expeditionRoundEndTime = (await elevationHelper.roundEndTimestamp(EXPEDITION)).toNumber()
        await mineBlockWithTimestamp(expeditionRoundEndTime)
  
        await cartographer.rollover(EXPEDITION)

        await expect(
            cartographer.connect(user1).deposit(PID.DUMMY_BIFI_EXPEDITION, e18(3), 0, 0)
        ).to.emit(cartographer, EVENT.Deposit).withArgs(user1.address, PID.DUMMY_BIFI_EXPEDITION, e18(3), 0)
    })
    it('EXPEDITION: Expeditions automatically end after the final round', async function() {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await getCartographer()
        const cartographerExpedition = await ethers.getContract('CartographerExpedition')
        const elevationHelper = await ethers.getContract('ElevationHelper')

        await rolloverRounds(8, SubCartographer.EXPEDITION, cartographer, cartographerExpedition, elevationHelper, PID.DUMMY_BIFI_EXPEDITION)
        
        await expect(
            cartographer.connect(user1).deposit(PID.DUMMY_BIFI_EXPEDITION, e18(1), 0, 0)
        ).to.emit(cartographer, EVENT.Deposit)

        const hypoWinnings0 = (await cartographer.hypotheticalRewards(PID.DUMMY_BIFI_EXPEDITION, user1.address))[1]

        expect(hypoWinnings0.gt(0)).to.be.true
        
        await rolloverRound(SubCartographer.EXPEDITION, cartographer, cartographerExpedition, elevationHelper, PID.DUMMY_BIFI_EXPEDITION)

        const hypoWinnings1 = (await cartographer.hypotheticalRewards(PID.DUMMY_BIFI_EXPEDITION, user1.address))[1]
        
        expect(hypoWinnings1).to.equal(0)
        
        await expect(
            cartographer.connect(user1).deposit(PID.DUMMY_BIFI_EXPEDITION, e18(1), 0, 0)
        ).to.be.revertedWith(ERR.POOL_NOT_AVAILABLE_YET)
    })
    it('EXPEDITION: Expeditions can be restarted after they end', async function() {
        const { dev } = await getNamedSigners(hre)
        const cartographer = await getCartographer()
        const elevationHelper = await ethers.getContract('ElevationHelper')
        const cartographerExpedition = await ethers.getContract('CartographerExpedition')

        await expect(
            cartographerExpedition.connect(dev).restartExpeditionPool(PID.DUMMY_BIFI_EXPEDITION, 0, e18(500000), 1)
        ).to.be.revertedWith(ERR.EXPEDITION_FUNDS_REQUIRED)

        await expect(
            cartographerExpedition.connect(dev).restartExpeditionPool(PID.DUMMY_BIFI_EXPEDITION, 0, e18(10), 1)
        ).to.emit(cartographerExpedition, EVENT.ExpeditionRestarted)

        await rolloverRound(SubCartographer.EXPEDITION, cartographer, cartographerExpedition, elevationHelper, PID.DUMMY_BIFI_EXPEDITION)

        await expect(
            cartographerExpedition.connect(dev).restartExpeditionPool(PID.DUMMY_BIFI_EXPEDITION, 0, e18(90), 1)
        ).to.be.revertedWith(ERR.EXPEDITION_ALREADY_RUNNING)
    })
    it('EXPEDITION: Expeditions can be extended while they are running', async function() {
        const { dev } = await getNamedSigners(hre)
        const cartographerExpedition = await ethers.getContract('CartographerExpedition')
        const bifiToken = await ethers.getContract('DummyBIFI')

        await bifiToken.connect(dev).approve(cartographerExpedition.address, e18(5000000))
        await bifiToken.connect(dev).transfer(cartographerExpedition.address, e18(5000000))
        
        await expect(
            cartographerExpedition.connect(dev).extendExpeditionPool(PID.DUMMY_BIFI_EXPEDITION, e18(5000000), 200)
        ).to.emit(cartographerExpedition, EVENT.ExpeditionExtended)
    })

    elevationTests.standardDepositShouldSucceed(SubCartographer.EXPEDITION, PID.DUMMY_BIFI_EXPEDITION, 0)
    elevationTests.depositShouldUpdatePoolAndTotemInfo(SubCartographer.EXPEDITION, PID.DUMMY_BIFI_EXPEDITION)
    elevationTests.validTotemDepositShouldSucceed(SubCartographer.EXPEDITION, PID.DUMMY_BIFI_EXPEDITION)
    elevationTests.invalidTotemDepositShouldFail(SubCartographer.EXPEDITION, PID.DUMMY_BIFI_EXPEDITION)
    elevationTests.depositToDifferentTotemShouldFail(SubCartographer.EXPEDITION, PID.DUMMY_BIFI_EXPEDITION)
    
    it(`EXPEDITION: Rounds yield correct winnings`, async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        const cartographer = await getCartographer()
        const cartographerExpedition = await ethers.getContract(Contracts.CartographerExpedition)
        const dummyBIFI = await getBifiToken()
        const elevationHelper = await getElevationHelper()

        const roundEmission = (await cartographerExpedition.expeditionPoolInfo(PID.DUMMY_BIFI_EXPEDITION)).roundEmission
    
        const users = [user1, user2, user3]

        await cartographer.connect(user1).deposit(PID.DUMMY_BIFI_EXPEDITION, 0, 0, 0)
        await cartographer.connect(user2).deposit(PID.DUMMY_BIFI_EXPEDITION, 0, 0, 0)
        await cartographer.connect(user3).deposit(PID.DUMMY_BIFI_EXPEDITION, 0, 0, 1)

        const usersHypotheticalRewards = await promiseSequenceMap(
            users,
            async (user) => await cartographer.hypotheticalRewards(PID.DUMMY_BIFI_EXPEDITION, user.address)
        )
        const usersStaked = usersHypotheticalRewards.map((hypotheticalReward) => hypotheticalReward[0])
        const usersExpectedWinnings = usersHypotheticalRewards.map((hypotheticalReward) => hypotheticalReward[1])

        const nextRoundTime = (await elevationHelper.roundEndTimestamp(EXPEDITION)).toNumber()
        const roundDuration = (await elevationHelper.roundDurationSeconds(EXPEDITION)).toNumber()
        await mineBlockWithTimestamp(nextRoundTime + (roundDuration * 5))
        await cartographer.rollover(EXPEDITION)


        const round = await elevationHelper.roundNumber(EXPEDITION)
        const prevWinningTotem = await elevationHelper.winningTotem(EXPEDITION, round - 1)


        const winnings = await promiseSequenceMap(
            users,
            async (user) => (await cartographer.connect(user).rewards(PID.DUMMY_BIFI_EXPEDITION, user.address))[0]
        )

        if (prevWinningTotem === 0) {
            expect6FigBigNumberEquals(winnings[0].add(winnings[1]), roundEmission)
            expect6FigBigNumberEquals(winnings[0].mul(e12(1)).div(winnings[1]), usersStaked[0].mul(e12(1)).div(usersStaked[1]))

            expect6FigBigNumberEquals(winnings[0], usersExpectedWinnings[0])
            expect6FigBigNumberEquals(winnings[1], usersExpectedWinnings[1])
        } else {
            expect6FigBigNumberEquals(winnings[2], roundEmission)

            expect6FigBigNumberEquals(winnings[2], usersExpectedWinnings[2])
        }
    })
    it(`EXPEDITION: Winnings are withdrawn correctly`, async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        const cartographer = await getCartographer()
        const dummyBIFI = await getBifiToken()

        const users = [user1, user2, user3]

        const rewardsInit = await promiseSequenceMap(
            users,
            async (user) => await dummyBIFI.balanceOf(user.address)
        )

        const winnings = await promiseSequenceMap(
            users,
            async (user) => (await cartographer.connect(user).rewards(PID.DUMMY_BIFI_EXPEDITION, user.address))[0]
        )

        await promiseSequenceMap(
            users,
            async (user, index) => await expect(
                cartographer.connect(user).deposit(PID.DUMMY_BIFI_EXPEDITION, 0, 0, index < 2 ? 0 : 1)
            ).to.emit(cartographer, EVENT.Deposit)
        )

        const rewardsFinal = await promiseSequenceMap(
            users,
            async (user) => await dummyBIFI.balanceOf(user.address)
        )

        users.forEach((_, index) => {
            expect(deltaBN(rewardsInit[index], rewardsFinal[index])).to.equal(winnings[index])
        })
    })

    it(`DEITIES: Switching to invalid deity should fail with error ${ERR.INVALID_TOTEM}`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await getCartographer()
        
        await expect(
          cartographer.connect(user1).switchTotem(EXPEDITION, TOTEM_COUNT[EXPEDITION])
        ).to.be.revertedWith(ERR.INVALID_TOTEM)
    })
    it('TOTEMS: Users should be able to switch to valid totems', async function() {
        const { user1 } = await getNamedSigners(hre)
        const cartographer = await getCartographer()
        const cartographerExpedition = await ethers.getContract(Contracts.CartographerExpedition)
        const dummyBIFI = await getBifiToken()
        const elevationHelper = await getElevationHelper()

        const targetTotem = TOTEM_COUNT[EXPEDITION] - 1

        await rolloverRound(Contracts.CartographerExpedition, cartographer, cartographerExpedition, elevationHelper, PID.DUMMY_BIFI_EXPEDITION)
        
        const [userStaked0] = await cartographer.hypotheticalRewards(PID.DUMMY_BIFI_EXPEDITION, user1.address)
        const totem0Supply0 = (await cartographerExpedition.totemSupplies(PID.DUMMY_BIFI_EXPEDITION))[0]
        const totem1Supply0 = (await cartographerExpedition.totemSupplies(PID.DUMMY_BIFI_EXPEDITION))[0]
        const totalSupply0 = (await cartographerExpedition.expeditionPoolInfo(PID.DUMMY_BIFI_EXPEDITION)).summitSupply
        

        // SWITCH TOTEM FROM 0 --> TARGET TOTEM
        await cartographer.connect(user1).switchTotem(EXPEDITION, targetTotem)
        
        const [userStaked1] = await cartographer.hypotheticalRewards(PID.DUMMY_BIFI_EXPEDITION, user1.address)
        const totem0Supply1 = (await cartographerExpedition.totemSupplies(PID.DUMMY_BIFI_EXPEDITION))[0]
        const totem1Supply1 = (await cartographerExpedition.totemSupplies(PID.DUMMY_BIFI_EXPEDITION))[0]
        const totalSupply1 = (await cartographerExpedition.expeditionPoolInfo(PID.DUMMY_BIFI_EXPEDITION)).summitSupply

        
        // SWITCH BACK TO TOTEM 0 FROM TARGET TOTEM
        await cartographer.connect(user1).switchTotem(EXPEDITION, 0)
        
        const [userStaked2] = await cartographer.hypotheticalRewards(PID.DUMMY_BIFI_EXPEDITION, user1.address)
        const totem0Supply2 = (await cartographerExpedition.totemSupplies(PID.DUMMY_BIFI_EXPEDITION))[0]
        const totem1Supply2 = (await cartographerExpedition.totemSupplies(PID.DUMMY_BIFI_EXPEDITION))[0]
        const totalSupply2 = (await cartographerExpedition.expeditionPoolInfo(PID.DUMMY_BIFI_EXPEDITION)).summitSupply

        consoleLog({
            userStaked: `${toDecimal(userStaked0)} --> ${toDecimal(userStaked1)} -> ${toDecimal(userStaked2)}`,
            totem0Supply: `${toDecimal(totem0Supply0)} --> ${toDecimal(totem0Supply1)} -> ${toDecimal(totem0Supply2)}`,
            totem1Supply: `${toDecimal(totem1Supply0)} --> ${toDecimal(totem1Supply1)} -> ${toDecimal(totem1Supply2)}`,
            totalSupply: `${toDecimal(totalSupply0)} --> ${toDecimal(totalSupply1)} -> ${toDecimal(totalSupply2)}`,
        })
        
        expect6FigBigNumberAllEqual([
            deltaBN(totem0Supply0, totem0Supply1),
            deltaBN(totem0Supply1, totem0Supply2),
            deltaBN(totem1Supply0, totem1Supply1),
            deltaBN(totem1Supply1, totem1Supply2),
            userStaked0,
        ])

        expect6FigBigNumberAllEqual([userStaked0, userStaked1, userStaked2])
        expect6FigBigNumberAllEqual([totalSupply0, totalSupply1, totalSupply2])
    })
    
    elevationTests.correctWinnersHistoricalData(SubCartographer.EXPEDITION, PID.DUMMY_BIFI_EXPEDITION)
})
