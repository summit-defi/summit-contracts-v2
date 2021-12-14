import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers"
import { expect } from "chai"
import hre from 'hardhat'
import { e18, getCakeToken, ZEROADD, getSummitToken, INF_APPROVE, getSummitBalance, deltaBN, cartographerMethod } from "../utils"
import { summitTokenMethod } from "../utils/summitTokenUtils"
import { plainsUnlockedFixture } from "./fixtures"

describe("SUMMIT TOKEN SWAP", function() {
    before(async function() {
        const { dev } = await plainsUnlockedFixture()

        // Transfer summit ownership to dev
        await cartographerMethod.migrateSummitOwnership({
            dev,
            summitOwner: dev.address,
        })
    })
    it('SUMMIT TOKEN SWAP: Should fail before initialized', async function() {
        const { user1 } = await getNamedSigners(hre)
        await summitTokenMethod.tokenSwap({
            user: user1,
            oldSummitAmount: e18(5),
            revertErr: 'Old SUMMIT not set',
        })
    })
    it('INITIALIZE: Initialization should succeed', async function() {
        const { dev } = await getNamedSigners(hre)
        const cakeToken = await getCakeToken()

        await summitTokenMethod.initialize({
            dev,
            oldSummitAddress: ZEROADD,
            revertErr: 'Missing Old Summit',
        })
        await summitTokenMethod.initialize({
            dev,
            oldSummitAddress: cakeToken.address,
        })
    })
    it('SUMMIT TOKEN SWAP: Should succeed and return the correct amount of SUMMIT', async function() {
        const { user1 } = await getNamedSigners(hre)
        const cakeToken = await getCakeToken()
        const summitToken = await getSummitToken()
        
        await cakeToken.connect(user1).approve(summitToken.address, INF_APPROVE)
        await summitTokenMethod.tokenSwap({
            user: user1,
            oldSummitAmount: e18(500000000),
            revertErr: 'Not enough SUMMIT',
        })

        const summitBalanceInit = await getSummitBalance(user1.address)
        
        await summitTokenMethod.tokenSwap({
            user: user1,
            oldSummitAmount: e18(50),
        })
        
        const summitBalanceFinal = await getSummitBalance(user1.address)
        const expectedSummitReward = e18(50).div(10)

        expect(deltaBN(summitBalanceInit, summitBalanceFinal)).to.equal(expectedSummitReward)
    })
})