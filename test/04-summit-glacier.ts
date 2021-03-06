import hre, { ethers } from "hardhat";
import { expect } from "chai"
import { e18, ERR, toDecimal, getTimestamp, deltaBN, mineBlockWithTimestamp, promiseSequenceMap, getSummitToken, everestGet, everestMethod, days, getSummitBalance, getEverestBalance, userPromiseSequenceMap, allElevationPromiseSequenceMap, cartographerMethod, rolloverRoundUntilWinningTotem, getUserTotems, OASIS, getCakeToken, getBifiToken, epochDuration, getSummitGlacier, rolloverIfAvailable, rolloverRound, sumBigNumbers, tokenPromiseSequenceMap, cartographerGet, expect6FigBigNumberEquals, BURNADD, expectAllEqual } from "../utils";
import { summitGlacierGet, summitGlacierMethod } from "../utils/summitGlacierUtils";
import { oasisUnlockedFixture, summitUnlockedFixture } from "./fixtures";



describe("SUMMIT LOCKING", async function() {
    before(async function () {
        const { user1 } = await summitUnlockedFixture()
        const userTotems = await getUserTotems()

        await allElevationPromiseSequenceMap(
            async (elevation) => rolloverIfAvailable(elevation)
        )

        await userPromiseSequenceMap(
            async (user) => {
                await allElevationPromiseSequenceMap(
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

        const summitGlacierCurrentEpoch = await summitGlacierGet.getCurrentEpoch()

        expect(currentEpoch).to.equal(summitGlacierCurrentEpoch)
    })

    it(`LOCKING: Claiming summit transfers correct amount to summit-glacier contract`, async function() {
        const { user1 } = await ethers.getNamedSigners()
        const summitToken = await getSummitToken()
        const cakeToken = await getCakeToken()
        const bifiToken = await getBifiToken()
        const summitGlacier = await getSummitGlacier()

        // Deposit into oasis
        await allElevationPromiseSequenceMap(
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

                const summitGlacierContractSummit0 = await getSummitBalance(summitGlacier.address)
                const currentEpoch = await summitGlacierGet.getCurrentEpoch()
                const lockedSummit0 = await summitGlacierGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)
                const lockedSummitTest0 = await summitGlacierGet.getUserCurrentEpochHarvestableWinnings(user1.address)
                expect(lockedSummit0).to.equal(lockedSummitTest0)
                
                // Claim from single farm
                await cartographerMethod.claimSingleFarm({
                    user: user1,
                    tokenAddress: summitToken.address,
                    elevation: OASIS
                })
                
                const summitGlacierContractSummit1 = await getSummitBalance(summitGlacier.address)
                
                const lockedSummit1 = await summitGlacierGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)
                const lockedSummitTest1 = await summitGlacierGet.getUserCurrentEpochHarvestableWinnings(user1.address)
                expect(lockedSummit1).to.equal(lockedSummitTest1)
                expect(deltaBN(summitGlacierContractSummit0, summitGlacierContractSummit1)).to.equal(deltaBN(lockedSummit0, lockedSummit1))
                
                // Claim from remaining farms
                await cartographerMethod.claimElevation({
                    user: user1,
                    elevation: OASIS,
                })

                const summitGlacierContractSummit2 = await getSummitBalance(summitGlacier.address)
                
                const lockedSummit2 = await summitGlacierGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)
                const lockedSummitTest2 = await summitGlacierGet.getUserCurrentEpochHarvestableWinnings(user1.address)
                expect(lockedSummit2).to.equal(lockedSummitTest2)
                expect(deltaBN(summitGlacierContractSummit1, summitGlacierContractSummit2)).to.equal(deltaBN(lockedSummit1, lockedSummit2))
            }
        )
    })

    it(`LOCKING: Epochs mature after the correct duration (hasEpochMatured)`, async function() {
        // Correct epoch being selected by timestamp
        const currentEpoch = await summitGlacierGet.getCurrentEpoch()
        const currentTimestamp = await getTimestamp()
        const currentEpochStartTimestamp = await summitGlacierGet.getEpochStartTimestamp(currentEpoch)
        const nextEpochStartTimestamp = await summitGlacierGet.getEpochStartTimestamp(currentEpoch + 1)

        expect(currentTimestamp >= currentEpochStartTimestamp).to.be.true
        expect(currentTimestamp <= nextEpochStartTimestamp).to.be.true

        // Epoch Maturation
        const epochLockCount = await summitGlacierGet.getYieldLockEpochCount()
        const epochLockDuration = await summitGlacierGet.getEpochDuration()
        const currentEpochMatureTimestamp = await summitGlacierGet.getEpochMatureTimestamp(currentEpoch)

        expect(currentEpochMatureTimestamp - currentEpochStartTimestamp).to.equal(epochLockCount * epochLockDuration)

        const currentEpochMature0 = await summitGlacierGet.getHasEpochMatured(currentEpoch)
        expect(currentEpochMature0).to.be.false
        
        await mineBlockWithTimestamp(currentEpochMatureTimestamp - 1)

        const currentEpochMature1 = await summitGlacierGet.getHasEpochMatured(currentEpoch)
        expect(currentEpochMature1).to.be.false

        await mineBlockWithTimestamp(currentEpochMatureTimestamp)

        const currentEpochMature2 = await summitGlacierGet.getHasEpochMatured(currentEpoch)
        expect(currentEpochMature2).to.be.true
    })

    it(`LOCKING: Updating yield lock epoch count changes duration of locking time`, async function() {
        const { dev } = await ethers.getNamedSigners()

        const currentEpoch = await summitGlacierGet.getCurrentEpoch()
        const currentEpochStartTimestamp = await summitGlacierGet.getEpochStartTimestamp(currentEpoch)

        const epochLockCount = await summitGlacierGet.getYieldLockEpochCount()
        const epochLockDuration = await summitGlacierGet.getEpochDuration()
        const currentEpochMatureTimestamp0 = await summitGlacierGet.getEpochMatureTimestamp(currentEpoch)

        expect(currentEpochMatureTimestamp0 - currentEpochStartTimestamp).to.equal(epochLockCount * epochLockDuration)
        const hasEpochMatured0 = await summitGlacierGet.getHasEpochMatured(currentEpoch)
        expect(hasEpochMatured0).to.be.false

        // Update yield lock epoch count
        await summitGlacierMethod.setYieldLockEpochCount({
            dev,
            yieldLockEpochCount: 2,
        })

        const currentEpochMatureTimestamp1 = await summitGlacierGet.getEpochMatureTimestamp(currentEpoch)
        expect(currentEpochMatureTimestamp1 - currentEpochStartTimestamp).to.equal(2 * epochLockDuration)
        const hasEpochMatured1 = await summitGlacierGet.getHasEpochMatured(currentEpoch)
        expect(hasEpochMatured1).to.be.false

        // Update yield lock epoch count
        await summitGlacierMethod.setYieldLockEpochCount({
            dev,
            yieldLockEpochCount: 0,
        })

        const currentEpochMatureTimestamp2 = await summitGlacierGet.getEpochMatureTimestamp(currentEpoch)
        expect(currentEpochMatureTimestamp2 - currentEpochStartTimestamp).to.equal(0 * epochLockDuration)
        const hasEpochMatured2 = await summitGlacierGet.getHasEpochMatured(currentEpoch)
        expect(hasEpochMatured2).to.be.true

        // Update yield lock epoch count
        await summitGlacierMethod.setYieldLockEpochCount({
            dev,
            yieldLockEpochCount: epochLockCount,
        })

        const currentEpochMatureTimestamp3 = await summitGlacierGet.getEpochMatureTimestamp(currentEpoch)
        expect(currentEpochMatureTimestamp3 - currentEpochStartTimestamp).to.equal(epochLockCount * epochLockDuration)
        const hasEpochMatured3 = await summitGlacierGet.getHasEpochMatured(currentEpoch)
        expect(hasEpochMatured3).to.be.false
    })

    it(`LOCKING: User interacting epochs are added and removed, and fetched correctly`, async function() {
        const { user1 } = await ethers.getNamedSigners()
        const interactingEpochs0 = await summitGlacierGet.getUserInteractingEpochs(user1.address)
        const interactingEpoch0 = interactingEpochs0[0]
        const currentEpoch = await summitGlacierGet.getCurrentEpoch()

        const epoch0Harvestable = await summitGlacierGet.getUserEpochHarvestableWinnings(user1.address, interactingEpoch0)

        console.log({
            interactingEpochs0,
            currentEpoch,
        })

        expect(interactingEpochs0.includes(interactingEpoch0)).to.be.true

        // Harvest entirety of first interacting epoch
        await summitGlacierMethod.harvestWinnings({
            user: user1,
            epoch: interactingEpoch0,
            amount: epoch0Harvestable
        })

        // Expect first interacting epoch to be removed from the user's interacting epochs list
        const interactingEpochs1 = await summitGlacierGet.getUserInteractingEpochs(user1.address)
        expect(interactingEpochs1.includes(interactingEpoch0)).to.be.false

        // Claim OASIS to interact with current epoch
        await cartographerMethod.claimElevation({
            user: user1,
            elevation: OASIS,
        })

        const interactingEpochs2 = await summitGlacierGet.getUserInteractingEpochs(user1.address)
        expect(interactingEpochs2.includes(currentEpoch)).to.be.true

        // Harvest half of current epoch winnings
        const currentEpochHarvestable = await summitGlacierGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)
        await summitGlacierMethod.harvestWinnings({
            user: user1,
            epoch: currentEpoch,
            amount: currentEpochHarvestable.div(2)
        })

        // Expect user to still be interacting with the current epoch
        const interactingEpochs3 = await summitGlacierGet.getUserInteractingEpochs(user1.address)
        expect(interactingEpochs3.includes(currentEpoch)).to.be.true


        // Harvest remainder of current epoch winnings
        const currentEpochRemainingHarvestable = await summitGlacierGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)
        await summitGlacierMethod.harvestWinnings({
            user: user1,
            epoch: currentEpoch,
            amount: currentEpochRemainingHarvestable
        })

        // Expect user to still be interacting with the current epoch
        const interactingEpochs4 = await summitGlacierGet.getUserInteractingEpochs(user1.address)
        expect(interactingEpochs4.includes(currentEpoch)).to.be.false
    })

    it(`LOCKING: Lifetime winnings and Lifetime bonuses increments correctly`, async function() {
        const { user1 } = await ethers.getNamedSigners()
        const currentTimestamp = await getTimestamp()
        await mineBlockWithTimestamp(currentTimestamp + days(14))

        const lifetimeWinnings0 = await summitGlacierGet.getUserLifetimeWinnings(user1.address)
        const lifetimeBonuses0 = await summitGlacierGet.getUserLifetimeBonusWinnings(user1.address)
        
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
            elevation: OASIS,
            eventOnly: true
        }) 
        
        const lifetimeWinnings1 = await summitGlacierGet.getUserLifetimeWinnings(user1.address)
        const lifetimeBonuses1 = await summitGlacierGet.getUserLifetimeBonusWinnings(user1.address)

        console.log({
            lifetimeBonuses: toDecimal(deltaBN(lifetimeBonuses0, lifetimeBonuses1)),
            oasisClaimableBonuses: toDecimal(oasisClaimableBonuses),
        })

        expect6FigBigNumberEquals(deltaBN(lifetimeWinnings0, lifetimeWinnings1), oasisClaimableWithBonuses)        
        expect6FigBigNumberEquals(deltaBN(lifetimeBonuses0, lifetimeBonuses1), oasisClaimableBonuses)        
    })

    it(`ACCESS: Only Cartographer and ExpeditionV2 can add locked winnings`, async function() {
        const { user1 } = await ethers.getNamedSigners()
        const summitGlacier = await getSummitGlacier()

        await expect(
            summitGlacier.connect(user1).addLockedWinnings(e18(5), e18(1), user1.address)
        ).to.be.revertedWith(ERR.ONLY_CARTOGRAPHER_OR_EXPEDITION)
    })


    it(`HARVEST: Harvesting summit before the lock period has matured incurs 50% tax`, async function() {
        const { user1, exped } = await ethers.getNamedSigners()
        const currentEpoch = await summitGlacierGet.getCurrentEpoch()

        const currentTimestamp = await getTimestamp()
        await mineBlockWithTimestamp(currentTimestamp + 120)
        await cartographerMethod.claimElevation({
            user: user1,
            elevation: OASIS
        }) 


        const userLockedInit = await summitGlacierGet.getUserCurrentEpochHarvestableWinnings(user1.address)
        const userSummitInit = await getSummitBalance(user1.address)
        const expedSummitInit = await getSummitBalance(exped.address)
        const burnedSummitInit = await getSummitBalance(BURNADD)

        // Harvest available locked summit
        const harvestable = await summitGlacierGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)
        await summitGlacierMethod.harvestWinnings({
            user: user1,
            epoch: currentEpoch,
            amount: harvestable
        })

        const userLockedFinal = await summitGlacierGet.getUserCurrentEpochHarvestableWinnings(user1.address)
        const userSummitFinal = await getSummitBalance(user1.address)
        const expedSummitFinal = await getSummitBalance(exped.address)
        const burnedSummitFinal = await getSummitBalance(BURNADD)

        expect(deltaBN(userLockedInit, userLockedFinal)).to.equal(harvestable)  
        expect(deltaBN(userSummitInit, userSummitFinal)).to.equal(harvestable.mul(50).div(100))  
        expect(deltaBN(expedSummitInit, expedSummitFinal)).to.equal(harvestable.mul(25).div(100))  
        expect(deltaBN(burnedSummitInit, burnedSummitFinal)).to.equal(harvestable.mul(25).div(100))  
    })

    it(`HARVEST: Harvesting summit after lock matures transfers 100% of funds correctly to user`, async function() {
        const { user1, exped } = await ethers.getNamedSigners()
        const currentEpoch = await summitGlacierGet.getCurrentEpoch()

        const currentTimestamp = await getTimestamp()
        await mineBlockWithTimestamp(currentTimestamp + 120)
        await cartographerMethod.claimElevation({
            user: user1,
            elevation: OASIS
        }) 


        const userLockedInit = await summitGlacierGet.getUserCurrentEpochHarvestableWinnings(user1.address)
        const userSummitInit = await getSummitBalance(user1.address)
        const expedSummitInit = await getSummitBalance(exped.address)
        const burnedSummitInit = await getSummitBalance(BURNADD)

        // Mature the current epoch
        const currentEpochMatureTimestamp = await summitGlacierGet.getEpochMatureTimestamp(currentEpoch)
        await mineBlockWithTimestamp(currentEpochMatureTimestamp)

        // Harvest available locked summit
        const harvestable = await summitGlacierGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)
        await summitGlacierMethod.harvestWinnings({
            user: user1,
            epoch: currentEpoch,
            amount: harvestable
        })

        const userLockedFinal = await summitGlacierGet.getUserCurrentEpochHarvestableWinnings(user1.address)
        const userSummitFinal = await getSummitBalance(user1.address)
        const expedSummitFinal = await getSummitBalance(exped.address)
        const burnedSummitFinal = await getSummitBalance(BURNADD)

        expect(deltaBN(userLockedInit, userLockedFinal)).to.equal(harvestable)  
        expect(deltaBN(userSummitInit, userSummitFinal)).to.equal(harvestable)  
        expect(deltaBN(expedSummitInit, expedSummitFinal)).to.equal(0)  
        expect(deltaBN(burnedSummitInit, burnedSummitFinal)).to.equal(0) 
    })


    it(`COMPOUND: Compounding summit for everest is available at any time regardless of lock period maturity`, async function() {
        const { user1, exped } = await ethers.getNamedSigners()
        const currentEpoch = await summitGlacierGet.getCurrentEpoch()

        const currentTimestamp = await getTimestamp()
        await mineBlockWithTimestamp(currentTimestamp + 120)
        await cartographerMethod.claimElevation({
            user: user1,
            elevation: OASIS
        }) 


        const userLockedInit = await summitGlacierGet.getUserCurrentEpochHarvestableWinnings(user1.address)
        const userEverestInfoSummitLockedInit = (await everestGet.userEverestInfo(user1.address)).summitLocked
        const expedSummitInit = await getSummitBalance(exped.address)
        const burnedSummitInit = await getSummitBalance(BURNADD)

        // Harvest half of available locked summit
        const harvestable = await summitGlacierGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)
        expect(await summitGlacierGet.getHasEpochMatured(currentEpoch)).to.be.false
        await summitGlacierMethod.harvestWinnings({
            user: user1,
            epoch: currentEpoch,
            amount: harvestable.div(2),
            lockForEverest: true
        })

        // Mature the current epoch
        const currentEpochMatureTimestamp = await summitGlacierGet.getEpochMatureTimestamp(currentEpoch)
        await mineBlockWithTimestamp(currentEpochMatureTimestamp)

        // Harvest available locked summit
        expect(await summitGlacierGet.getHasEpochMatured(currentEpoch)).to.be.true
        await summitGlacierMethod.harvestWinnings({
            user: user1,
            epoch: currentEpoch,
            amount: harvestable.div(2),
            lockForEverest: true
        })

        const userLockedFinal = await summitGlacierGet.getUserCurrentEpochHarvestableWinnings(user1.address)
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
})

describe("COMPOUNDING LOCKED SUMMIT & ELEVATING SUMMIT", async function() {
    it(`COMPOUND: Current lock duration < 30 days -> Earns Everest, lock release 30 days from current timestamp`, async function() {
        const { user1 } = await oasisUnlockedFixture()

        // Prime test: Current lock duration < 30 days
        await tokenPromiseSequenceMap(
            async (token) => await cartographerMethod.deposit({
                user: user1,
                tokenAddress: token.address,
                elevation: OASIS,
                amount: e18(5),
            })
        )
        await everestMethod.lockSummit({
            user: user1,
            amount: e18(1),
            lockDuration: days(7),
        })

        const currentTimestamp = await getTimestamp()
        await mineBlockWithTimestamp(currentTimestamp + 120)
        await cartographerMethod.claimElevation({
            user: user1,
            elevation: OASIS
        })

        const currentEpoch = await summitGlacierGet.getCurrentEpoch()
        expect(await summitGlacierGet.getHasEpochMatured(currentEpoch)).to.be.false

        const userEverestInit = await getEverestBalance(user1.address)
        const userEverestInfoInit = await everestGet.userEverestInfo(user1.address)

        
        // Compound locked summit
        const harvestable = await summitGlacierGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)

        const expectedEverestEarnedFromDurationIncrease = await everestGet.getAdditionalEverestAwardForLockDurationIncrease(user1.address, days(30))
        const expectedEverestFromCompound = await everestGet.getExpectedEverestAward(harvestable, days(30))
        const totalExpectedEverest = sumBigNumbers([expectedEverestEarnedFromDurationIncrease, expectedEverestFromCompound])
        
        await summitGlacierMethod.harvestWinnings({
            user: user1,
            epoch: currentEpoch,
            amount: harvestable,
            lockForEverest: true
        })

        const userEverestFinal = await getEverestBalance(user1.address)
        const userEverestInfoFinal = await everestGet.userEverestInfo(user1.address)

        console.log({
            expectedEverestEarnedFromDurationIncrease: toDecimal(expectedEverestEarnedFromDurationIncrease),
            expectedEverestFromCompound: toDecimal(expectedEverestFromCompound),
            totalExpectedEverest: toDecimal(totalExpectedEverest),
            userEverestToken: `${toDecimal(userEverestInit)} --> ${toDecimal(userEverestFinal)}: ${toDecimal(deltaBN(userEverestInit, userEverestFinal))}`,
            userEverestInfoEverestOwned: `${toDecimal(userEverestInfoInit.everestOwned)} --> ${toDecimal(userEverestInfoFinal.everestOwned)}: ${toDecimal(deltaBN(userEverestInfoInit.everestOwned, userEverestInfoFinal.everestOwned))}`,
            userLockDuration: `${userEverestInfoInit.lockDuration} --> ${userEverestInfoFinal.lockDuration}`
        })

        expectAllEqual([
            totalExpectedEverest,
            deltaBN(userEverestInit, userEverestFinal),
            deltaBN(userEverestInfoInit.everestOwned, userEverestInfoFinal.everestOwned),
        ])
        expect(userEverestInfoInit.lockDuration).to.equal(days(7))
        expect(userEverestInfoFinal.lockDuration).to.equal(days(30))
    })

    it(`COMPOUND: (Current timestamp + lock release) >= 30 days -> No Everest earned from duration increase, everest earned from lock amount, lock release remains the same`, async function() {
        const { user1 } = await oasisUnlockedFixture()

        // Prime test: Current lock duration > 30 days
        await tokenPromiseSequenceMap(
            async (token) => await cartographerMethod.deposit({
                user: user1,
                tokenAddress: token.address,
                elevation: OASIS,
                amount: e18(5),
            })
        )
        await everestMethod.lockSummit({
            user: user1,
            amount: e18(1),
            lockDuration: days(100),
        })

        const currentTimestamp = await getTimestamp()
        await mineBlockWithTimestamp(currentTimestamp + 120)
        await cartographerMethod.claimElevation({
            user: user1,
            elevation: OASIS
        })

        const currentEpoch = await summitGlacierGet.getCurrentEpoch()
        expect(await summitGlacierGet.getHasEpochMatured(currentEpoch)).to.be.false

        const userEverestInit = await getEverestBalance(user1.address)
        const userEverestInfoInit = await everestGet.userEverestInfo(user1.address)

        
        // Compound locked summit
        const harvestable = await summitGlacierGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)

        const expectedEverestEarnedFromDurationIncrease = await everestGet.getAdditionalEverestAwardForLockDurationIncrease(user1.address, days(30))
        const expectedEverestFromCompound = await everestGet.getExpectedEverestAward(harvestable, days(100))
        const totalExpectedEverest = sumBigNumbers([expectedEverestEarnedFromDurationIncrease, expectedEverestFromCompound])
        
        await summitGlacierMethod.harvestWinnings({
            user: user1,
            epoch: currentEpoch,
            amount: harvestable,
            lockForEverest: true
        })

        const userEverestFinal = await getEverestBalance(user1.address)
        const userEverestInfoFinal = await everestGet.userEverestInfo(user1.address)

        console.log({
            expectedEverestEarnedFromDurationIncrease: toDecimal(expectedEverestEarnedFromDurationIncrease),
            expectedEverestFromCompound: toDecimal(expectedEverestFromCompound),
            totalExpectedEverest: toDecimal(totalExpectedEverest),
            userEverestToken: `${toDecimal(userEverestInit)} --> ${toDecimal(userEverestFinal)}: ${toDecimal(deltaBN(userEverestInit, userEverestFinal))}`,
            userEverestInfoEverestOwned: `${toDecimal(userEverestInfoInit.everestOwned)} --> ${toDecimal(userEverestInfoFinal.everestOwned)}: ${toDecimal(deltaBN(userEverestInfoInit.everestOwned, userEverestInfoFinal.everestOwned))}`,
            userLockDuration: `${userEverestInfoInit.lockDuration} --> ${userEverestInfoFinal.lockDuration}`
        })

        expectAllEqual([
            totalExpectedEverest,
            expectedEverestFromCompound,
            deltaBN(userEverestInit, userEverestFinal),
            deltaBN(userEverestInfoInit.everestOwned, userEverestInfoFinal.everestOwned),
        ])
        expect(expectedEverestEarnedFromDurationIncrease).to.equal(0)
        expectAllEqual([
            userEverestInfoInit.lockDuration,
            userEverestInfoFinal.lockDuration,
            days(100)
        ])
        expectAllEqual([
            userEverestInfoInit.lockRelease,
            userEverestInfoFinal.lockRelease
        ])
    })

    it(`COMPOUND: Current lock duration >= 30 days but time remaining < 30 days -> Extends lock release without earning EVEREST, lock duration unchanged, EVEREST earned from compound`, async function() {
        const { user1 } = await oasisUnlockedFixture()

        // Prime test: Current lock duration > 30 days
        await tokenPromiseSequenceMap(
            async (token) => await cartographerMethod.deposit({
                user: user1,
                tokenAddress: token.address,
                elevation: OASIS,
                amount: e18(5),
            })
        )
        await everestMethod.lockSummit({
            user: user1,
            amount: e18(1),
            lockDuration: days(30),
        })

        const initialLockTimestamp = await getTimestamp()
        await mineBlockWithTimestamp(initialLockTimestamp + days(20))
        await cartographerMethod.claimElevation({
            user: user1,
            elevation: OASIS
        })

        const currentEpoch = await summitGlacierGet.getCurrentEpoch()
        const userEverestInit = await getEverestBalance(user1.address)
        const userEverestInfoInit = await everestGet.userEverestInfo(user1.address)

        
        // Compound locked summit
        const harvestable = await summitGlacierGet.getUserEpochHarvestableWinnings(user1.address, currentEpoch)

        const expectedEverestEarnedFromDurationIncrease = await everestGet.getAdditionalEverestAwardForLockDurationIncrease(user1.address, days(30))
        const expectedEverestFromCompound = await everestGet.getExpectedEverestAward(harvestable, days(30))
        const totalExpectedEverest = sumBigNumbers([expectedEverestEarnedFromDurationIncrease, expectedEverestFromCompound])
        
        await summitGlacierMethod.harvestWinnings({
            user: user1,
            epoch: currentEpoch,
            amount: harvestable,
            lockForEverest: true
        })
        const compoundSummitTimestamp = await getTimestamp()

        const userEverestFinal = await getEverestBalance(user1.address)
        const userEverestInfoFinal = await everestGet.userEverestInfo(user1.address)

        console.log({
            expectedEverestEarnedFromDurationIncrease: toDecimal(expectedEverestEarnedFromDurationIncrease),
            expectedEverestFromCompound: toDecimal(expectedEverestFromCompound),
            totalExpectedEverest: toDecimal(totalExpectedEverest),
            userEverestToken: `${toDecimal(userEverestInit)} --> ${toDecimal(userEverestFinal)}: ${toDecimal(deltaBN(userEverestInit, userEverestFinal))}`,
            userEverestInfoEverestOwned: `${toDecimal(userEverestInfoInit.everestOwned)} --> ${toDecimal(userEverestInfoFinal.everestOwned)}: ${toDecimal(deltaBN(userEverestInfoInit.everestOwned, userEverestInfoFinal.everestOwned))}`,
            userLockDuration: `${userEverestInfoInit.lockDuration} --> ${userEverestInfoFinal.lockDuration}`
        })

        expectAllEqual([
            totalExpectedEverest,
            expectedEverestFromCompound,
            deltaBN(userEverestInit, userEverestFinal),
            deltaBN(userEverestInfoInit.everestOwned, userEverestInfoFinal.everestOwned),
        ])
        expect(expectedEverestEarnedFromDurationIncrease).to.equal(0)
        expectAllEqual([
            userEverestInfoInit.lockDuration,
            userEverestInfoFinal.lockDuration,
            days(30)
        ])
        expect(userEverestInfoInit.lockRelease).to.equal(initialLockTimestamp + days(30))
        expect(userEverestInfoFinal.lockRelease).to.equal(compoundSummitTimestamp + days(30))
    })

    it(`ELEVATE: Elevating SUMMIT to lock for EVEREST succeeds`, async function() {
        const { user1, summitToken } = await oasisUnlockedFixture()

        await cartographerMethod.deposit({
            user: user1,
            tokenAddress: summitToken.address,
            elevation: OASIS,
            amount: e18(5),
        })
        await everestMethod.lockSummit({
            user: user1,
            amount: e18(1),
            lockDuration: days(7),
        })
        const initialLockTimestamp = await getTimestamp()


        const userEverestInit = await getEverestBalance(user1.address)
        const userEverestInfoInit = await everestGet.userEverestInfo(user1.address)

        // Validate SUMMIT tax is non-zero
        const summitTax = await cartographerGet.getUserTokenWithdrawalTax(user1.address, summitToken.address)
        console.log({
            summitTax
        })
        expect(summitTax).to.be.greaterThan(0)

        
        // Elevate summit to EVEREST

        const expectedEverestEarnedFromDurationIncrease = await everestGet.getAdditionalEverestAwardForLockDurationIncrease(user1.address, days(7))
        const expectedEverestFromCompound = await everestGet.getExpectedEverestAward(e18(5), days(7))
        const totalExpectedEverest = sumBigNumbers([expectedEverestEarnedFromDurationIncrease, expectedEverestFromCompound])
        
        await cartographerMethod.elevateAndLockStakedSummit({
            user: user1,
            elevation: OASIS,
            amount: e18(5),
        })
        const elevateSummitTimestamp = await getTimestamp()

        const userEverestFinal = await getEverestBalance(user1.address)
        const userEverestInfoFinal = await everestGet.userEverestInfo(user1.address)

        console.log({
            expectedEverestEarnedFromDurationIncrease: toDecimal(expectedEverestEarnedFromDurationIncrease),
            expectedEverestFromCompound: toDecimal(expectedEverestFromCompound),
            totalExpectedEverest: toDecimal(totalExpectedEverest),
            userEverestToken: `${toDecimal(userEverestInit)} --> ${toDecimal(userEverestFinal)}: ${toDecimal(deltaBN(userEverestInit, userEverestFinal))}`,
            userEverestInfoEverestOwned: `${toDecimal(userEverestInfoInit.everestOwned)} --> ${toDecimal(userEverestInfoFinal.everestOwned)}: ${toDecimal(deltaBN(userEverestInfoInit.everestOwned, userEverestInfoFinal.everestOwned))}`,
            userLockDuration: `${userEverestInfoInit.lockDuration} --> ${userEverestInfoFinal.lockDuration}`
        })

        expectAllEqual([
            totalExpectedEverest,
            deltaBN(userEverestInit, userEverestFinal),
            deltaBN(userEverestInfoInit.everestOwned, userEverestInfoFinal.everestOwned),
        ])
        expectAllEqual([
            userEverestInfoInit.lockDuration,
            userEverestInfoFinal.lockDuration,
            days(7)
        ])

        expect(userEverestInfoInit.lockRelease).to.equal(initialLockTimestamp + days(7))
        expect(userEverestInfoFinal.lockRelease).to.equal(elevateSummitTimestamp + days(7))
    })
})
