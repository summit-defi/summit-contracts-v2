import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre from "hardhat";
import { e18, getTimestamp,  mineBlockWithTimestamp, getSummitToken, everestMethod, days, cartographerMethod, OASIS, getCakeToken, rolloverRound, cartographerGet, PLAINS, cartographerSetParam, sumBigNumbers, getSummitBalance, getTokenBalance, tokenAmountAfterWithdrawTax, pausableMethod, Contracts, ERR, mineBlocks } from "../utils";
import { mesaUnlockedFixture } from "./fixtures";

describe("PAUSABLE", async function() {
    before(async function () {
        await mesaUnlockedFixture()
    })

    it(`PAUSABLE: Adding a pause role is successful`, async function() {
        const { dev, user1 } = await getNamedSigners(hre)

        await pausableMethod.grantPauserRole({
            admin: user1,
            pauserAddress: user1.address,
            contractName: Contracts.Cartographer,
            expectRevert: true 
        })
        await pausableMethod.grantPauserRole({
            admin: dev,
            pauserAddress: user1.address,
            contractName: Contracts.Cartographer,
        })
    })

    it('PAUSE: Pause can be enabled', async function() {
        const { dev, user2 } = await getNamedSigners(hre)

        console.log('user2')
        await pausableMethod.pause({
            admin: user2,
            contractName: Contracts.Cartographer,
            revertErr: 'Must have pauser role',
        })
        console.log('should succeeed')
        await pausableMethod.pause({
            admin: dev,
            contractName: Contracts.Cartographer,
        })
        console.log('fail already paused')
        await pausableMethod.pause({
            admin: dev,
            contractName: Contracts.Cartographer,
            revertErr: ERR.PAUSED
        })
    })

    it('UNPAUSE: Pause can be cancelled', async function() {
        const { dev, user2 } = await getNamedSigners(hre)

        await pausableMethod.unpause({
            admin: user2,
            contractName: Contracts.Cartographer,
            revertErr: 'Must have pauser role',
        })
        await pausableMethod.unpause({
            admin: dev,
            contractName: Contracts.Cartographer,
        })
        await pausableMethod.unpause({
            admin: dev,
            contractName: Contracts.Cartographer,
            revertErr: 'Pausable: not paused'
        })
    })

    it('CARTOGRAPHER: Pausing shuts down functionality', async function() {
        const { dev, user2 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        await rolloverRound(PLAINS)

        // UNPAUSED METHODS
        await cartographerMethod.switchTotem({
            user: user2,
            elevation: PLAINS,
            totem: 0,
        })
        await cartographerMethod.deposit({
            user: user2,
            tokenAddress: summitToken.address,
            elevation: PLAINS,
            amount: e18(5)
        })
        await cartographerMethod.elevate({
            user: user2,
            tokenAddress: summitToken.address,
            sourceElevation: PLAINS,
            targetElevation: OASIS,
            amount: e18(1)
        })
        await mineBlocks(3)
        await cartographerMethod.claimElevation({
            user: user2,
            elevation: OASIS
        })
        await cartographerMethod.withdraw({
            user: user2,
            tokenAddress: summitToken.address,
            elevation: PLAINS,
            amount: e18(2)
        })
        await cartographerMethod.emergencyWithdraw({
            user: user2,
            tokenAddress: summitToken.address,
            elevation: PLAINS,
        })
        await cartographerMethod.deposit({
            user: user2,
            tokenAddress: summitToken.address,
            elevation: PLAINS,
            amount: e18(5)
        })

        // PAUSE
        await pausableMethod.pause({
            admin: dev,
            contractName: Contracts.Cartographer,
        })

        // PAUSED SHOULD REVERT
        await cartographerMethod.switchTotem({
            user: user2,
            elevation: PLAINS,
            totem: 0,
            revertErr: ERR.PAUSED
        })
        await cartographerMethod.deposit({
            user: user2,
            tokenAddress: summitToken.address,
            elevation: PLAINS,
            amount: e18(5),
            revertErr: ERR.PAUSED
        })
        await cartographerMethod.elevate({
            user: user2,
            tokenAddress: summitToken.address,
            sourceElevation: PLAINS,
            targetElevation: OASIS,
            amount: e18(1),
            revertErr: ERR.PAUSED
        })
        await mineBlocks(3)
        await cartographerMethod.claimElevation({
            user: user2,
            elevation: OASIS,
            revertErr: ERR.PAUSED
        })
        await cartographerMethod.withdraw({
            user: user2,
            tokenAddress: summitToken.address,
            elevation: PLAINS,
            amount: e18(2),
            revertErr: ERR.PAUSED
        })

        // EMERGENCY WITHDRAW STILL WORKS
        await cartographerMethod.emergencyWithdraw({
            user: user2,
            tokenAddress: summitToken.address,
            elevation: PLAINS
        })
    })
})