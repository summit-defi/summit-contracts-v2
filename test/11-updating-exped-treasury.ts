import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { e18, ERR, EVENT, expect6FigBigNumberEquals, mineBlock, oasisTests, OASIS, PID, toDecimal, POOL_FEE, passthroughTests, SubCartographer, Contracts, EXPEDITION, FIVETHOUSAND, mineBlockWithTimestamp, TENTHOUSAND, TWOTHOUSAND, getTimestamp, rolloverRoundUntilWinningTotem, promiseSequenceMap, deltaBN, ZEROADD } from "../utils";
import { expeditionUnlockedFixture, oasisUnlockedFixture, poolsFixture, twoThousandUnlockedFixture } from "./fixtures";


describe("UPDATE EXPEDITION TREASURY ADDRESS", function() {
    before(async function() {
        await oasisUnlockedFixture()
    })
    it(`UPDATE EXPED TREASURY: Only callable by owner and must supply valid address`, async function() {
        const { dev, user1 } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract('Cartographer')

        await expect(
            cartographer.connect(user1).setExpedAdd(user1.address)
        ).to.be.revertedWith(ERR.NON_OWNER)

        await expect(
            cartographer.connect(dev).setExpedAdd(ZEROADD)
        ).to.be.revertedWith(ERR.MISSING_ADDRESS)
    })
    it(`SUCCESSFUL UPDATE: Calling setExpedAdd with correct parameters should update exped add`, async function () {
        const { dev, exped, user2 } = await getNamedSigners(hre) 

        const cartographer = await ethers.getContract('Cartographer')

        const expedTreasuryAddInit = await cartographer.expedAdd()
        expect(expedTreasuryAddInit).to.equal(exped.address)
        
        await expect(
            cartographer.connect(dev).setExpedAdd(user2.address)
        ).to.emit(cartographer, EVENT.SetExpeditionTreasuryAddress).withArgs(dev.address, user2.address)
        
        const expedTreasuryAddFinal = await cartographer.expedAdd()
        expect(expedTreasuryAddFinal).to.equal(user2.address)
    })
})

