import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { e18, ERR, EVENT, expect6FigBigNumberEquals, mineBlock, oasisTests, OASIS, PID, toDecimal, POOL_FEE, passthroughTests, SubCartographer, Contracts, EXPEDITION, MESA, mineBlockWithTimestamp, SUMMIT, PLAINS, getTimestamp, rolloverRoundUntilWinningTotem, promiseSequenceMap, deltaBN, ZEROADD } from "../utils";
import { expeditionUnlockedFixture, oasisUnlockedFixture, poolsFixture, twoThousandUnlockedFixture } from "./fixtures";


describe("UPDATE EXPEDITION TREASURY ADDRESS", function() {
    before(async function() {
        await oasisUnlockedFixture()
    })
    it(`UPDATE EXPED TREASURY: Only callable by owner and must supply valid address`, async function() {
        const { dev, user1 } = await getNamedSigners(hre)
        const cartographer = await getCartographer()

        await expect(
            cartographer.connect(user1).setexpeditionTreasuryAdd(user1.address)
        ).to.be.revertedWith(ERR.NON_OWNER)

        await expect(
            cartographer.connect(dev).setexpeditionTreasuryAdd(ZEROADD)
        ).to.be.revertedWith(ERR.MISSING_ADDRESS)
    })
    it(`SUCCESSFUL UPDATE: Calling setexpeditionTreasuryAdd with correct parameters should update exped add`, async function () {
        const { dev, exped, user2 } = await getNamedSigners(hre) 

        const cartographer = await getCartographer()

        const expedTreasuryAddInit = await cartographer.expeditionTreasuryAdd()
        expect(expedTreasuryAddInit).to.equal(exped.address)
        
        await expect(
            cartographer.connect(dev).setexpeditionTreasuryAdd(user2.address)
        ).to.emit(cartographer, EVENT.SetExpeditionTreasuryAddress).withArgs(dev.address, user2.address)
        
        const expedTreasuryAddFinal = await cartographer.expeditionTreasuryAdd()
        expect(expedTreasuryAddFinal).to.equal(user2.address)
    })
})

