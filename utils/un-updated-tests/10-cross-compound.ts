import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { e18, ERR, EVENT, expect6FigBigNumberEquals, mineBlock, oasisTests, OASIS, PID, toDecimal, POOL_FEE, passthroughTests, SubCartographer, Contracts, EXPEDITION, MESA, mineBlockWithTimestamp, SUMMIT, PLAINS, getTimestamp, rolloverRoundUntilWinningTotem, promiseSequenceMap, deltaBN, consoleLog } from "../utils";
import { expeditionUnlockedFixture, oasisUnlockedFixture, poolsFixture, twoThousandUnlockedFixture } from "./fixtures";


describe("CROSS COMPOUNDING", function() {
  describe('- Cross Compound Validations', async function() {    
    it(`CROSS COMPOUND: Attempting to switch totem during cross compound should fail with error ${ERR.NO_TOTEM_SWITCH_ON_DEPOSIT}`, async function() {
        await twoThousandUnlockedFixture()

        const { user1 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const cartographerElevation = await ethers.getContract('CartographerElevation')
        const elevationHelper = await ethers.getContract('ElevationHelper')

        await cartographer.connect(user1).deposit(PID.SUMMIT_2K, e18(5), 0, 0)
        await rolloverRoundUntilWinningTotem(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, PID.SUMMIT_2K, 0)

        const timestamp = await getTimestamp()
        await mineBlockWithTimestamp(timestamp + 100)

        await expect(
        cartographer.connect(user1).crossCompound(PID.SUMMIT_2K, 1)
        ).to.be.revertedWith(ERR.NO_TOTEM_SWITCH_ON_DEPOSIT)
    })
    it(`CROSS COMPOUND: Attempting to cross compound an expedition pool should fail with error ${ERR.INVALID_ELEV}`, async function() {
        await expeditionUnlockedFixture()
        
        const { user1, dev } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const cartographerExpedition = await ethers.getContract('CartographerExpedition')
        const dummyBifiToken = await ethers.getContract('DummyBIFI')
        const elevationHelper = await ethers.getContract('ElevationHelper')

        await dummyBifiToken.connect(dev).approve(cartographerExpedition.address, e18(500))
        await dummyBifiToken.connect(dev).transfer(cartographerExpedition.address, e18(500))
        await cartographer.connect(dev).addExpedition(0, dummyBifiToken.address, e18(500), 9)

        const expeditionRoundEndTime = (await elevationHelper.roundEndTimestamp(EXPEDITION)).toNumber()
        await mineBlockWithTimestamp(expeditionRoundEndTime)

        await cartographer.rollover(EXPEDITION)
        await cartographer.rollover(SUMMIT)
        await cartographer.rollover(MESA)
        await cartographer.rollover(PLAINS)

        await expect(
        cartographer.connect(user1).crossCompound(PID.DUMMY_BIFI_EXPEDITION, 0)
        ).to.be.revertedWith(ERR.INVALID_ELEV)
    })
  })

  describe('- Oasis Cross Compound', async function() {
    before(async function() {
        await oasisUnlockedFixture()

        const { user1, user2, user3 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')

        const users = [user1, user2, user3]
        await promiseSequenceMap(
            users,
            async (user, index) => {
            await cartographer.connect(user).deposit(PID.SUMMIT_OASIS, e18(index + 3), 0, 0)
            await cartographer.connect(user).deposit(PID.DUMMY_BIFI_OASIS, e18(index + 3), 0, 0)
            }
        )
    })
    
    it('OASIS SELF COMPOUND: Cross compounding from within SUMMIT pool should succeed', async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const cartographerOasis = await ethers.getContract(Contracts.CartographerOasis)
    
        const users = [user1, user2, user3]
    
        const timestamp = await getTimestamp()
        await mineBlockWithTimestamp(timestamp + 300)
    
    
        await promiseSequenceMap(
          users,
          async (user, index) => {
            await cartographerOasis.updatePool(PID.SUMMIT_OASIS)
    
            const emissionPerSecondInit = (await cartographer.connect(user).rewards(PID.SUMMIT_OASIS, user.address))[0]
            await cartographerOasis.updatePool(PID.SUMMIT_OASIS)
            const emissionPerSecondDelta = deltaBN(
              emissionPerSecondInit,
              (await cartographer.connect(user).rewards(PID.SUMMIT_OASIS, user.address))[0]
            )
            
            await cartographerOasis.updatePool(PID.SUMMIT_OASIS)
    
            const stakedInit = (await cartographerOasis.connect(user).userInfo(PID.SUMMIT_OASIS, user.address)).staked
            const harvestableInit = (await cartographer.connect(user).rewards(PID.SUMMIT_OASIS, user.address))[0]
            
            await expect(
              cartographer.connect(user).crossCompound(PID.SUMMIT_OASIS, 0)
            ).to.emit(cartographer, EVENT.CROSS_COMPOUND).withArgs(user.address, PID.SUMMIT_OASIS, PID.SUMMIT_OASIS, harvestableInit.add(emissionPerSecondDelta))
    
            const stakedFinal = (await cartographerOasis.connect(user).userInfo(PID.SUMMIT_OASIS, user.address)).staked
            const harvestableFinal = (await cartographer.connect(user).rewards(PID.SUMMIT_OASIS, user.address))[0]
    
            consoleLog({
              [`user${index}`]: `${toDecimal(stakedInit.add(harvestableInit))} --> ${toDecimal(stakedFinal.add(harvestableFinal))} : ${toDecimal(deltaBN(stakedInit.add(harvestableInit), stakedFinal.add(harvestableFinal)))}`,
              singleEmissionSUMMIT: toDecimal(emissionPerSecondDelta),
            })
    
            expect6FigBigNumberEquals(
              stakedInit.add(harvestableInit).add(emissionPerSecondDelta),
              stakedFinal.add(harvestableFinal),
            )
          }
        )
    })

    it('OASIS CROSS COMPOUND: Cross compounding from outside SUMMIT pool should succeed', async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')
        const cartographerOasis = await ethers.getContract(Contracts.CartographerOasis)
    
        const users = [user1, user2, user3]
    
        const timestamp = await getTimestamp()
        await mineBlockWithTimestamp(timestamp + 300)
    
    
        await promiseSequenceMap(
          users,
          async (user, index) => {
            const summitBalance = (await cartographerOasis.connect(user).userInfo(PID.SUMMIT_OASIS, user.address)).staked
            await cartographer.connect(user).withdraw(PID.SUMMIT_OASIS, summitBalance, 0)
    
    
    
            await cartographerOasis.updatePool(PID.DUMMY_BIFI_OASIS)
            const emissionPerSecondInit = (await cartographer.connect(user).rewards(PID.DUMMY_BIFI_OASIS, user.address))[0]
            await cartographerOasis.updatePool(PID.DUMMY_BIFI_OASIS)
            const emissionPerSecondDelta = deltaBN(
              emissionPerSecondInit,
              (await cartographer.connect(user).rewards(PID.DUMMY_BIFI_OASIS, user.address))[0]
            )
            
            await cartographerOasis.updatePool(PID.DUMMY_BIFI_OASIS)
    
            const summitStakedInit = (await cartographerOasis.connect(user).userInfo(PID.SUMMIT_OASIS, user.address)).staked
    
            const sourceStakedInit = (await cartographerOasis.connect(user).userInfo(PID.DUMMY_BIFI_OASIS, user.address)).staked
            const sourceHarvestableInit = (await cartographer.connect(user).rewards(PID.DUMMY_BIFI_OASIS, user.address))[0]
    
            await expect(
              cartographer.connect(user).crossCompound(PID.DUMMY_BIFI_OASIS, 0)
            ).to.emit(cartographer, EVENT.CROSS_COMPOUND).withArgs(user.address, PID.DUMMY_BIFI_OASIS, PID.SUMMIT_OASIS, sourceHarvestableInit.add(emissionPerSecondDelta))
    
            const summitStakedFinal = (await cartographerOasis.connect(user).userInfo(PID.SUMMIT_OASIS, user.address)).staked
    
            const sourceStakedFinal = (await cartographerOasis.connect(user).userInfo(PID.DUMMY_BIFI_OASIS, user.address)).staked
    
            consoleLog({
              [`user${index}_harvestable`]: `${toDecimal(sourceHarvestableInit)} + ${toDecimal(emissionPerSecondDelta)} = ${toDecimal(sourceHarvestableInit.add(emissionPerSecondDelta))}`,
              [`user${index}_summitStaked`]: `${toDecimal(summitStakedInit)} --> ${toDecimal(summitStakedFinal)} : ${toDecimal(deltaBN(summitStakedInit, summitStakedFinal))}`,
            })
    
            expect6FigBigNumberEquals(
              sourceHarvestableInit.add(emissionPerSecondDelta),
              deltaBN(summitStakedInit, summitStakedFinal)
            )
            expect(sourceStakedInit).to.equal(sourceStakedFinal)
          }
        )
      })
  })
})

