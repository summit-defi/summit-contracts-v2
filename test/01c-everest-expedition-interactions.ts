import { BigNumber } from "@ethersproject/bignumber";
import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre from "hardhat";
import { e18, ERR, toDecimal, INF_APPROVE, getTimestamp, deltaBN, expect6FigBigNumberAllEqual, mineBlockWithTimestamp, promiseSequenceMap, consoleLog, getSummitToken, everestGet, everestMethod, days, everestSetParams, getSummitBalance, getEverestBalance, userPromiseSequenceMap, usersSummitBalances, usersEverestBalances, userPromiseSequenceReduce, getEverestToken } from "../utils";
import { oasisUnlockedFixture } from "./fixtures";



describe("EVEREST-EXPEDITION INTERACTIONS", async function() {
    before(async function () {
        const { everestToken, summitToken, user1, user2, user3 } = await oasisUnlockedFixture()

        await everestToken.connect(user1).approve(everestToken.address, INF_APPROVE)
        await everestToken.connect(user2).approve(everestToken.address, INF_APPROVE)
        await everestToken.connect(user3).approve(everestToken.address, INF_APPROVE)

        await summitToken.connect(user1).approve(everestToken.address, INF_APPROVE)
        await summitToken.connect(user2).approve(everestToken.address, INF_APPROVE)
        await summitToken.connect(user3).approve(everestToken.address, INF_APPROVE)
    })


    // it(`EVEREST: Locking for invalid lock duration throws error "${ERR.EVEREST.INVALID_LOCK_DURATION}"`, async function () {
    //     const { user1 } = await getNamedSigners(hre)

    //     await everestMethod.lockSummit({
    //         user: user1,
    //         amount: e18(1),
    //         lockDuration: days(0.5),
    //         revertErr: ERR.EVEREST.INVALID_LOCK_DURATION
    //     })

    //     await everestMethod.lockSummit({
    //         user: user1,
    //         amount: e18(1),
    //         lockDuration: days(400),
    //         revertErr: ERR.EVEREST.INVALID_LOCK_DURATION
    //     })
    // })
})
