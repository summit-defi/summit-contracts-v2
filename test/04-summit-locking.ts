import { BigNumber } from "@ethersproject/bignumber";
import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre from "hardhat";
import { e18, ERR, toDecimal, INF_APPROVE, getTimestamp, deltaBN, expect6FigBigNumberAllEqual, mineBlockWithTimestamp, promiseSequenceMap, consoleLog, getSummitToken, everestGet, everestMethod, days, everestSetParams, getSummitBalance, getEverestBalance, userPromiseSequenceMap, usersSummitBalances, usersEverestBalances, userPromiseSequenceReduce, getEverestToken, elevationPromiseSequenceMap, elevationHelperGet, SUMMIT, cartographerMethod, rolloverRoundUntilWinningTotem, getUserTotems, OASIS, mineBlocks, getCakeToken, getBifiToken, epochDuration, getSummitLocking, rolloverIfAvailable, rolloverRound, subCartGet, claimAmountWithBonusAdded, sumBigNumbers, tokenPromiseSequenceMap, cartographerGet, expect6FigBigNumberEquals, BURNADD } from "../utils";
import { summitLockingGet, summitLockingMethod } from "../utils/summitLockingUtils";
import { expeditionUnlockedFixture, oasisUnlockedFixture, tenThousandUnlockedFixture } from "./fixtures";



describe("SUMMIT-LOCKING INTERACTIONS", async function() {
    before(async function () {
        const { user1 } = await tenThousandUnlockedFixture()
        const userTotems = await getUserTotems()

        await elevationPromiseSequenceMap(
            async (elevation) => rolloverIfAvailable(elevation)
        )

        await userPromiseSequenceMap(
            async (user) => {
                await elevationPromiseSequenceMap(
                    async (elevation) => {
                        await cartographerMethod.switchTotem({
                            user,
                            elevation,
                            totem: userTotems[user.address]
                        })
                    }
                )
            }
        )

        await everestMethod.lockSummit({
            user: user1,
            amount: e18(1),
            lockDuration: days(30),
        })
    })

    it(`LOCKING: getCurrentEpoch returns correct epoch`, async function() {
        const timestamp = await getTimestamp()
        const currentEpoch = Math.floor(timestamp / epochDuration)

        const summitLockingCurrentEpoch = await summitLockingGet.getCurrentEpoch()

        expect(currentEpoch).to.equal(summitLockingCurrentEpoch)
    })

    it(`LOCKING: Claiming summit transfers correct amount to summit-locking contract`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()
        const cakeToken = await getCakeToken()
        const bifiToken = await getBifiToken()
        const summitLocking = await getSummitLocking()

        // Deposit into oasis
        await elevationPromiseSequenceMap(
            async (elevation) => {
                // Rollover Elevation
                await rolloverRound(elevation)

                // Deposit token
                await promiseSequenceMap(
                    [summitToken, cakeToken, bifiToken],
                    async (token) => await cartographerMethod.deposit({
                        user: user1,
                        tokenAddress: token.address,
                        elevation,
                        amount: e18(5),
                    })
                )
                
                const currentTimestamp = await getTimestamp()
                await mineBlockWithTimestamp(currentTimestamp + 50)

                // Ensure winnings to claim
                if (elevation !== OASIS) {
                    await rolloverRoundUntilWinningTotem(elevation, 0)
                }

                const summitLockingContractSummit0 = await getSummitBalance(summitLocking.address)
                const currentEpoch = await summitLockingGet.getCurrentEpoch()
                const lockedSummit0 = await summitLockingGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)
                const lockedSummitTest0 = await summitLockingGet.getUserCurrentEpochHarvestableWinnings(user1.address)
                expect(lockedSummit0).to.equal(lockedSummitTest0)
                
                // Claim from single farm
                await cartographerMethod.claimSingleFarm({
                    user: user1,
                    tokenAddress: summitToken.address,
                    elevation: OASIS
                })
                
                const summitLockingContractSummit1 = await getSummitBalance(summitLocking.address)
                
                const lockedSummit1 = await summitLockingGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)
                const lockedSummitTest1 = await summitLockingGet.getUserCurrentEpochHarvestableWinnings(user1.address)
                expect(lockedSummit1).to.equal(lockedSummitTest1)
                expect(deltaBN(summitLockingContractSummit0, summitLockingContractSummit1)).to.equal(deltaBN(lockedSummit0, lockedSummit1))
                
                // Claim from remaining farms
                await cartographerMethod.claimElevation({
                    user: user1,
                    elevation: OASIS,
                })

                const summitLockingContractSummit2 = await getSummitBalance(summitLocking.address)
                
                const lockedSummit2 = await summitLockingGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)
                const lockedSummitTest2 = await summitLockingGet.getUserCurrentEpochHarvestableWinnings(user1.address)
                expect(lockedSummit2).to.equal(lockedSummitTest2)
                expect(deltaBN(summitLockingContractSummit1, summitLockingContractSummit2)).to.equal(deltaBN(lockedSummit1, lockedSummit2))
            }
        )
    })

    it(`LOCKING: Epochs mature after the correct duration (hasEpochMatured)`, async function() {
        // Correct epoch being selected by timestamp
        const currentEpoch = await summitLockingGet.getCurrentEpoch()
        const currentTimestamp = await getTimestamp()
        const currentEpochStartTimestamp = await summitLockingGet.getEpochStartTimestamp(currentEpoch)
        const nextEpochStartTimestamp = await summitLockingGet.getEpochStartTimestamp(currentEpoch + 1)

        expect(currentTimestamp >= currentEpochStartTimestamp).to.be.true
        expect(currentTimestamp <= nextEpochStartTimestamp).to.be.true

        // Epoch Maturation
        const epochLockCount = await summitLockingGet.getYieldLockEpochCount()
        const epochLockDuration = await summitLockingGet.getEpochDuration()
        const currentEpochMatureTimestamp = await summitLockingGet.getEpochMatureTimestamp(currentEpoch)

        expect(currentEpochMatureTimestamp - currentEpochStartTimestamp).to.equal(epochLockCount * epochLockDuration)

        const currentEpochMature0 = await summitLockingGet.getHasEpochMatured(currentEpoch)
        expect(currentEpochMature0).to.be.false
        
        await mineBlockWithTimestamp(currentEpochMatureTimestamp - 1)

        const currentEpochMature1 = await summitLockingGet.getHasEpochMatured(currentEpoch)
        expect(currentEpochMature1).to.be.false

        await mineBlockWithTimestamp(currentEpochMatureTimestamp)

        const currentEpochMature2 = await summitLockingGet.getHasEpochMatured(currentEpoch)
        expect(currentEpochMature2).to.be.true
    })

    it(`LOCKING: Updating yield lock epoch count changes duration of locking time`, async function() {
        const { dev } = await getNamedSigners(hre)

        const currentEpoch = await summitLockingGet.getCurrentEpoch()
        const currentEpochStartTimestamp = await summitLockingGet.getEpochStartTimestamp(currentEpoch)

        const epochLockCount = await summitLockingGet.getYieldLockEpochCount()
        const epochLockDuration = await summitLockingGet.getEpochDuration()
        const currentEpochMatureTimestamp0 = await summitLockingGet.getEpochMatureTimestamp(currentEpoch)

        expect(currentEpochMatureTimestamp0 - currentEpochStartTimestamp).to.equal(epochLockCount * epochLockDuration)
        const hasEpochMatured0 = await summitLockingGet.getHasEpochMatured(currentEpoch)
        expect(hasEpochMatured0).to.be.false

        // Update yield lock epoch count
        await summitLockingMethod.setYieldLockEpochCount({
            dev,
            yieldLockEpochCount: 2,
        })

        const currentEpochMatureTimestamp1 = await summitLockingGet.getEpochMatureTimestamp(currentEpoch)
        expect(currentEpochMatureTimestamp1 - currentEpochStartTimestamp).to.equal(2 * epochLockDuration)
        const hasEpochMatured1 = await summitLockingGet.getHasEpochMatured(currentEpoch)
        expect(hasEpochMatured1).to.be.false

        // Update yield lock epoch count
        await summitLockingMethod.setYieldLockEpochCount({
            dev,
            yieldLockEpochCount: 0,
        })

        const currentEpochMatureTimestamp2 = await summitLockingGet.getEpochMatureTimestamp(currentEpoch)
        expect(currentEpochMatureTimestamp2 - currentEpochStartTimestamp).to.equal(0 * epochLockDuration)
        const hasEpochMatured2 = await summitLockingGet.getHasEpochMatured(currentEpoch)
        expect(hasEpochMatured2).to.be.true

        // Update yield lock epoch count
        await summitLockingMethod.setYieldLockEpochCount({
            dev,
            yieldLockEpochCount: epochLockCount,
        })

        const currentEpochMatureTimestamp3 = await summitLockingGet.getEpochMatureTimestamp(currentEpoch)
        expect(currentEpochMatureTimestamp3 - currentEpochStartTimestamp).to.equal(epochLockCount * epochLockDuration)
        const hasEpochMatured3 = await summitLockingGet.getHasEpochMatured(currentEpoch)
        expect(hasEpochMatured3).to.be.false
    })

    it(`LOCKING: User interacting epochs are added and removed, and fetched correctly`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const interactingEpochs0 = await summitLockingGet.getUserInteractingEpochs(user1.address)
        const interactingEpoch0 = interactingEpochs0[0]
        const currentEpoch = await summitLockingGet.getCurrentEpoch()

        const epoch0Harvestable = await summitLockingGet.getUserEpochHarvestableWinnings(user1.address, interactingEpoch0)

        console.log({
            interactingEpochs0,
            currentEpoch,
        })

        expect(interactingEpochs0.includes(interactingEpoch0)).to.be.true

        // Harvest entirety of first interacting epoch
        await summitLockingMethod.harvestWinnings({
            user: user1,
            epoch: interactingEpoch0,
            amount: epoch0Harvestable
        })

        // Expect first interacting epoch to be removed from the user's interacting epochs list
        const interactingEpochs1 = await summitLockingGet.getUserInteractingEpochs(user1.address)
        expect(interactingEpochs1.includes(interactingEpoch0)).to.be.false

        // Claim OASIS to interact with current epoch
        await cartographerMethod.claimElevation({
            user: user1,
            elevation: OASIS,
        })

        const interactingEpochs2 = await summitLockingGet.getUserInteractingEpochs(user1.address)
        expect(interactingEpochs2.includes(currentEpoch)).to.be.true

        // Harvest half of current epoch winnings
        const currentEpochHarvestable = await summitLockingGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)
        await summitLockingMethod.harvestWinnings({
            user: user1,
            epoch: currentEpoch,
            amount: currentEpochHarvestable.div(2)
        })

        // Expect user to still be interacting with the current epoch
        const interactingEpochs3 = await summitLockingGet.getUserInteractingEpochs(user1.address)
        expect(interactingEpochs3.includes(currentEpoch)).to.be.true


        // Harvest remainder of current epoch winnings
        const currentEpochRemainingHarvestable = await summitLockingGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)
        await summitLockingMethod.harvestWinnings({
            user: user1,
            epoch: currentEpoch,
            amount: currentEpochRemainingHarvestable
        })

        // Expect user to still be interacting with the current epoch
        const interactingEpochs4 = await summitLockingGet.getUserInteractingEpochs(user1.address)
        expect(interactingEpochs4.includes(currentEpoch)).to.be.false
    })

    it(`LOCKING: Lifetime winnings and Lifetime bonuses increments correctly`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const currentTimestamp = await getTimestamp()
        await mineBlockWithTimestamp(currentTimestamp + days(14))

        const lifetimeWinnings0 = await summitLockingGet.getUserLifetimeWinnings(user1.address)
        const lifetimeBonuses0 = await summitLockingGet.getUserLifetimeBonusWinnings(user1.address)
        
        // Total claimable
        const oasisTokenClaimableWithBonuses = await tokenPromiseSequenceMap(
            async (token) => await cartographerGet.getTokenClaimableWithBonus(user1.address, token.address, OASIS)
        )
        const oasisClaimableWithBonuses = sumBigNumbers(oasisTokenClaimableWithBonuses)

        // Claimable bonuses
        const oasisTokenClaimableBonuses = await tokenPromiseSequenceMap(
            async (token) => await cartographerGet.getTokenClaimableBonus(user1.address, token.address, OASIS)
        )
        const oasisClaimableBonuses = sumBigNumbers(oasisTokenClaimableBonuses)
        
        
        await cartographerMethod.claimElevation({
            user: user1,
            elevation: OASIS
        }) 
        
        const lifetimeWinnings1 = await summitLockingGet.getUserLifetimeWinnings(user1.address)
        const lifetimeBonuses1 = await summitLockingGet.getUserLifetimeBonusWinnings(user1.address)

        console.log({
            lifetimeBonuses: toDecimal(deltaBN(lifetimeBonuses0, lifetimeBonuses1)),
            oasisClaimableBonuses: toDecimal(oasisClaimableBonuses),
        })

        expect6FigBigNumberEquals(deltaBN(lifetimeWinnings0, lifetimeWinnings1), oasisClaimableWithBonuses)        
        expect6FigBigNumberEquals(deltaBN(lifetimeBonuses0, lifetimeBonuses1), oasisClaimableBonuses)        
    })

    it(`ACCESS: Only Cartographer and ExpeditionV2 can add locked winnings`, async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitLocking = await getSummitLocking()

        await expect(
            summitLocking.connect(user1).addLockedWinnings(e18(5), e18(1), user1.address)
        ).to.be.revertedWith(ERR.ONLY_CARTOGRAPHER_OR_EXPEDITION)
    })


    it(`HARVEST: Harvesting summit before the lock period has matured incurs 50% tax`, async function() {
        const { user1, exped } = await getNamedSigners(hre)
        const currentEpoch = await summitLockingGet.getCurrentEpoch()

        const currentTimestamp = await getTimestamp()
        await mineBlockWithTimestamp(currentTimestamp + 120)
        await cartographerMethod.claimElevation({
            user: user1,
            elevation: OASIS
        }) 


        const userLockedInit = await summitLockingGet.getUserCurrentEpochHarvestableWinnings(user1.address)
        const userSummitInit = await getSummitBalance(user1.address)
        const expedSummitInit = await getSummitBalance(exped.address)
        const burnedSummitInit = await getSummitBalance(BURNADD)

        // Harvest available locked summit
        const harvestable = await summitLockingGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)
        await summitLockingMethod.harvestWinnings({
            user: user1,
            epoch: currentEpoch,
            amount: harvestable
        })

        const userLockedFinal = await summitLockingGet.getUserCurrentEpochHarvestableWinnings(user1.address)
        const userSummitFinal = await getSummitBalance(user1.address)
        const expedSummitFinal = await getSummitBalance(exped.address)
        const burnedSummitFinal = await getSummitBalance(BURNADD)

        expect(deltaBN(userLockedInit, userLockedFinal)).to.equal(harvestable)  
        expect(deltaBN(userSummitInit, userSummitFinal)).to.equal(harvestable.mul(50).div(100))  
        expect(deltaBN(expedSummitInit, expedSummitFinal)).to.equal(harvestable.mul(25).div(100))  
        expect(deltaBN(burnedSummitInit, burnedSummitFinal)).to.equal(harvestable.mul(25).div(100))  
    })

    it(`HARVEST: Harvesting summit after lock matures transfers 100% of funds correctly to user`, async function() {
        const { user1, exped } = await getNamedSigners(hre)
        const currentEpoch = await summitLockingGet.getCurrentEpoch()

        const currentTimestamp = await getTimestamp()
        await mineBlockWithTimestamp(currentTimestamp + 120)
        await cartographerMethod.claimElevation({
            user: user1,
            elevation: OASIS
        }) 


        const userLockedInit = await summitLockingGet.getUserCurrentEpochHarvestableWinnings(user1.address)
        const userSummitInit = await getSummitBalance(user1.address)
        const expedSummitInit = await getSummitBalance(exped.address)
        const burnedSummitInit = await getSummitBalance(BURNADD)

        // Mature the current epoch
        const currentEpochMatureTimestamp = await summitLockingGet.getEpochMatureTimestamp(currentEpoch)
        await mineBlockWithTimestamp(currentEpochMatureTimestamp)

        // Harvest available locked summit
        const harvestable = await summitLockingGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)
        await summitLockingMethod.harvestWinnings({
            user: user1,
            epoch: currentEpoch,
            amount: harvestable
        })

        const userLockedFinal = await summitLockingGet.getUserCurrentEpochHarvestableWinnings(user1.address)
        const userSummitFinal = await getSummitBalance(user1.address)
        const expedSummitFinal = await getSummitBalance(exped.address)
        const burnedSummitFinal = await getSummitBalance(BURNADD)

        expect(deltaBN(userLockedInit, userLockedFinal)).to.equal(harvestable)  
        expect(deltaBN(userSummitInit, userSummitFinal)).to.equal(harvestable)  
        expect(deltaBN(expedSummitInit, expedSummitFinal)).to.equal(0)  
        expect(deltaBN(burnedSummitInit, burnedSummitFinal)).to.equal(0) 
    })


    it(`COMPOUND: Compounding summit for everest is available at any time regardless of lock period maturity`, async function() {
        const { user1, exped } = await getNamedSigners(hre)
        const currentEpoch = await summitLockingGet.getCurrentEpoch()

        const currentTimestamp = await getTimestamp()
        await mineBlockWithTimestamp(currentTimestamp + 120)
        await cartographerMethod.claimElevation({
            user: user1,
            elevation: OASIS
        }) 


        const userLockedInit = await summitLockingGet.getUserCurrentEpochHarvestableWinnings(user1.address)
        const userEverestInfoSummitLockedInit = (await everestGet.userEverestInfo(user1.address)).summitLocked
        const expedSummitInit = await getSummitBalance(exped.address)
        const burnedSummitInit = await getSummitBalance(BURNADD)

        // Harvest half of available locked summit
        const harvestable = await summitLockingGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)
        expect(await summitLockingGet.getHasEpochMatured(currentEpoch)).to.be.false
        await summitLockingMethod.harvestWinnings({
            user: user1,
            epoch: currentEpoch,
            amount: harvestable.div(2),
            lockForEverest: true
        })

        // Mature the current epoch
        const currentEpochMatureTimestamp = await summitLockingGet.getEpochMatureTimestamp(currentEpoch)
        await mineBlockWithTimestamp(currentEpochMatureTimestamp)

        // Harvest available locked summit
        expect(await summitLockingGet.getHasEpochMatured(currentEpoch)).to.be.true
        await summitLockingMethod.harvestWinnings({
            user: user1,
            epoch: currentEpoch,
            amount: harvestable.div(2),
            lockForEverest: true
        })

        const userLockedFinal = await summitLockingGet.getUserCurrentEpochHarvestableWinnings(user1.address)
        const userEverestInfoSummitLockedFinal = (await everestGet.userEverestInfo(user1.address)).summitLocked
        const expedSummitFinal = await getSummitBalance(exped.address)
        const burnedSummitFinal = await getSummitBalance(BURNADD)

        console.log({
            userLocked: `${toDecimal(userLockedInit)} --> ${toDecimal(userLockedFinal)}: ${toDecimal(deltaBN(userLockedInit, userLockedFinal))}`,
            userEverestInfoSummitLocked: `${toDecimal(userEverestInfoSummitLockedInit)} --> ${toDecimal(userEverestInfoSummitLockedFinal)}: ${toDecimal(deltaBN(userEverestInfoSummitLockedInit, userEverestInfoSummitLockedFinal))}`,
        })

        expect(deltaBN(userLockedInit, userLockedFinal)).to.equal(harvestable)  
        expect(deltaBN(userEverestInfoSummitLockedInit, userEverestInfoSummitLockedFinal)).to.equal(harvestable)  
        expect(deltaBN(expedSummitInit, expedSummitFinal)).to.equal(0)  
        expect(deltaBN(burnedSummitInit, burnedSummitFinal)).to.equal(0) 
    })

    it(`COMPOUND: Compounding summit for everest increases everest lock time correctly`, async function() {})

    //      Current lock duration < 30 days -> Earns Everest, lock release 30 days from current timestamp
    //      Current lock duration > 30 days -> No everest earned, lock release remains the same
    //      Current lock duration > 30 days but time remaining < 30 days -> Extends lock release, lock duration unchanged, No everest earned
    it(`COMPOUND: Compounding summit for everest awards the correct amount of everest`, async function() {})


    it(`PANIC: Panic can be turned on and off`, async function() {})

    it(`PANIC: When in panic users can harvest their un-matured locked winnings without the tax`, async function() {})
})
