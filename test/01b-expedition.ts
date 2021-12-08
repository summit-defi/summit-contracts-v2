import { BigNumber } from "@ethersproject/bignumber";
import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { e18, ERR, EVENT, toDecimal, Contracts, INF_APPROVE, getTimestamp, deltaBN, expect6FigBigNumberAllEqual, mineBlockWithTimestamp, e36, EXPEDITION, promiseSequenceMap, expect6FigBigNumberEquals, e12, e0, consoleLog, expectAllEqual, getBifiToken, getCakeToken, getCartographer, getElevationHelper, getEverestToken, getExpedition, getSummitToken, everestGet, everestMethod, expeditionMethod, expeditionGet, getSummitBalance, getUsdcBalance, UserExpeditionInfo, elevationHelperGet, expeditionSynth, days } from "../utils";
import { userPromiseSequenceMap, userPromiseSequenceReduce, usersClaimedSummitBalances, usersExpeditionHypotheticalRewards, usersExpeditionInfo, usersExpeditionRewards, usersSummitBalances, usersUsdcBalances } from "../utils/users";
import { oasisUnlockedFixture } from "./fixtures";





describe("EXPEDITION V2", async function() {
    before(async function () {
        const { summitToken, everestToken, user1, user2, user3 } = await oasisUnlockedFixture()

        await everestToken.connect(user1).approve(everestToken.address, INF_APPROVE)
        await everestToken.connect(user2).approve(everestToken.address, INF_APPROVE)
        await everestToken.connect(user3).approve(everestToken.address, INF_APPROVE)

        await summitToken.connect(user1).approve(everestToken.address, INF_APPROVE)
        await summitToken.connect(user2).approve(everestToken.address, INF_APPROVE)
        await summitToken.connect(user3).approve(everestToken.address, INF_APPROVE)
    })

    it(`EXPEDITION ADD FUNDS: Adding incorrect funds fails with error "${ERR.EXPEDITION_V2.INVALID_EXPED_TOKEN}"`, async function() {
        const { dev } = await getNamedSigners(hre)
        const bifiToken = await getBifiToken()
        
        await expeditionMethod.addExpeditionFunds({
            user: dev,
            tokenAddress: bifiToken.address,
            amount: e18(500),
            revertErr: ERR.EXPEDITION_V2.INVALID_EXPED_TOKEN
        })
    })
    it(`EXPEDITION ADD FUNDS: Adding funds to the expedition recalculates emissions correctly`, async function() {
        const { dev } = await getNamedSigners(hre)
        const expedition = await getExpedition()
        const cakeToken = await getCakeToken()
        const summitToken = await getSummitToken()

        const expeditionRunwayRounds = await expeditionGet.expeditionRunwayRounds()
        const expeditionInfoInit = await expeditionGet.expeditionInfo()

        expect(expeditionInfoInit.roundsRemaining).to.equal(0)
        expect(expeditionInfoInit.summitExpeditionToken.emissionsRemaining).to.equal(e18(0))
        expect(expeditionInfoInit.summitExpeditionToken.roundEmission).to.equal(e18(0))
        expect(expeditionInfoInit.usdcExpeditionToken.emissionsRemaining).to.equal(e18(0))
        expect(expeditionInfoInit.usdcExpeditionToken.roundEmission).to.equal(e18(0))

        await cakeToken.connect(dev).approve(expedition.address, e18(500))
        await expeditionMethod.addExpeditionFunds({
            user: dev,
            tokenAddress: cakeToken.address,
            amount: e18(500),
        })

        const expectedEmissionsMid = await expeditionSynth.getExpeditionExpectedEmissions()
        const expeditionInfoMid = await expeditionGet.expeditionInfo()

        expect(expeditionInfoMid.roundsRemaining).to.equal(expeditionRunwayRounds)
        expect(expeditionInfoMid.summitExpeditionToken.emissionsRemaining).to.equal(e18(0))
        expect(expeditionInfoMid.summitExpeditionToken.roundEmission).to.equal(e18(0))
        expect(expeditionInfoMid.usdcExpeditionToken.emissionsRemaining).to.equal(e18(500))
        expect(expeditionInfoMid.usdcExpeditionToken.roundEmission).to.equal(expectedEmissionsMid.usdcEmission)

        await summitToken.connect(dev).approve(expedition.address, e18(300))
        await expeditionMethod.addExpeditionFunds({
            user: dev,
            tokenAddress: summitToken.address,
            amount: e18(300),
        })

        const expectedEmissionsFinal = await expeditionSynth.getExpeditionExpectedEmissions()
        const expeditionInfoFinal = await expeditionGet.expeditionInfo()

        expect(expeditionInfoFinal.roundsRemaining).to.equal(expeditionRunwayRounds)
        expect(expeditionInfoFinal.summitExpeditionToken.emissionsRemaining).to.equal(e18(300))
        expect(expeditionInfoFinal.summitExpeditionToken.roundEmission).to.equal(expectedEmissionsFinal.summitEmission)
        expect(expeditionInfoFinal.usdcExpeditionToken.emissionsRemaining).to.equal(e18(500))
        expect(expeditionInfoFinal.usdcExpeditionToken.roundEmission).to.equal(expectedEmissionsFinal.usdcEmission)
    })

    it('EXPEDITION: Users can only enter expedition if they own everest, have selected a deity, and have selected a safety factor', async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        
        const expectMetRequirementsMatch = async (user: SignerWithAddress, userMetRequirements: any) => {
            const userEligibleToJoinExpedition = await expeditionGet.userSatisfiesExpeditionRequirements(user.address)

            expect(userEligibleToJoinExpedition.everest).to.equal(userMetRequirements.everest)
            expect(userEligibleToJoinExpedition.deity).to.equal(userMetRequirements.deity)
            expect(userEligibleToJoinExpedition.safetyFactor).to.equal(userMetRequirements.safetyFactor)
        }

        const getRequirementPrioritizedRevertErr = (userMetRequirements: any) => {
            if (!userMetRequirements.everest) return ERR.EVEREST.MUST_OWN_EVEREST
            if (!userMetRequirements.deity) return ERR.EXPEDITION_V2.NO_DEITY
            if (!userMetRequirements.safetyFactor) return ERR.EXPEDITION_V2.NO_SAFETY_FACTOR
            return undefined
        }

        const userParams = {
            [user1.address]: {
                deity: 0,
                safetyFactor: 100,
                summitAmount: e18(10),
                lockDuration: days(7),
            },
            [user2.address]: {
                deity: 0,
                safetyFactor: 0,
                summitAmount: e18(30),
                lockDuration: days(365),
            },
            [user3.address]: {
                deity: 1,
                safetyFactor: 50,
                summitAmount: e18(22.5),
                lockDuration: days(30),
            }
        }

        await userPromiseSequenceMap(
            async (user) => {

                let userMetRequirements = {
                    everest: false,
                    deity: false,
                    safetyFactor: false,
                }

                let userExpeditionInfo = await expeditionGet.userExpeditionInfo(user.address)
                expect(userExpeditionInfo.entered).to.equal(false)
        
                await expectMetRequirementsMatch(user, userMetRequirements)
                
                await expeditionMethod.joinExpedition({
                    user,
                    revertErr: getRequirementPrioritizedRevertErr(userMetRequirements)
                })
        
                await everestMethod.lockSummit({
                    user,
                    amount: userParams[user.address].summitAmount,
                    lockDuration: userParams[user.address].lockDuration,
                })
        
                userMetRequirements.everest = true;
                await expectMetRequirementsMatch(user, userMetRequirements)      
        
                await expeditionMethod.joinExpedition({
                    user,
                    revertErr: getRequirementPrioritizedRevertErr(userMetRequirements)
                })
        
                await expeditionMethod.selectDeity({
                    user,
                    deity: userParams[user.address].deity,
                })
        
                userMetRequirements.deity = true;
                await expectMetRequirementsMatch(user, userMetRequirements)      
        
        
                await expeditionMethod.joinExpedition({
                    user,
                    revertErr: getRequirementPrioritizedRevertErr(userMetRequirements)
                })
        
                await expeditionMethod.selectSafetyFactor({
                    user,
                    safetyFactor: userParams[user.address].safetyFactor,
                })
        
                userMetRequirements.safetyFactor = true;
                await expectMetRequirementsMatch(user, userMetRequirements)
        
                const expedInfoInit = await expeditionGet.userExpeditionInfo(user.address)
                expect(expedInfoInit.entered).to.be.false
        
                await expeditionMethod.joinExpedition({ user })
        
                const expedInfoFinal = await expeditionGet.userExpeditionInfo(user.address)
                expect(expedInfoFinal.entered).to.be.true
        
                await expeditionSynth.expectUserAndExpedSuppliesToMatch()
            }
        )

    })

    it(`EXPEDITION: Expedition safe and deitied supplies match combined user's supplies`, async function () {
        await expeditionSynth.expectUserAndExpedSuppliesToMatch()
    })

    it(`EXPEDITION: Rounds yield correct winnings`, async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        
        const userParams = {
            [user1.address]: {
                deity: 0,
            },
            [user2.address]: {
                deity: 0,
            },
            [user3.address]: {
                deity: 1,
            }
        }
        
        const expeditionInfo = await expeditionGet.expeditionInfo()
        
        await userPromiseSequenceMap(
            async (user) => await expeditionMethod.harvestExpedition({ user })
        )

        const hypothetical = await usersExpeditionHypotheticalRewards()

        await expeditionSynth.rolloverExpedition()
        const prevWinningTotem = await elevationHelperGet.prevWinningTotem(EXPEDITION)

        const rewards = await usersExpeditionRewards()

        await userPromiseSequenceMap(
            async (_, userIndex) => consoleLog({
                user: userIndex,
                hypotheticalSummit: `Safe: ${toDecimal(hypothetical[userIndex].safeSummit)}, Deity: ${toDecimal(hypothetical[userIndex].deitiedSummit)}: Total ${toDecimal(hypothetical[userIndex].safeSummit.add(hypothetical[userIndex].deitiedSummit))}`,
                hypotheticalUsdc: `Safe: ${toDecimal(hypothetical[userIndex].safeUsdc)}, Deity: ${toDecimal(hypothetical[userIndex].deitiedUsdc)}: Total ${toDecimal(hypothetical[userIndex].safeUsdc.add(hypothetical[userIndex].deitiedUsdc))}`,
                rewardsSummit: toDecimal(rewards[userIndex].summit),
                rewardsUsdc: toDecimal(rewards[userIndex].usdc),
            })
        )

        const summations = await userPromiseSequenceReduce(
            (acc, _, userIndex) => ({
                summit: acc.summit.add(rewards[userIndex].summit) as BigNumber,
                usdc: acc.usdc.add(rewards[userIndex].usdc) as BigNumber,
            }),
            {
                summit: e18(0),
                usdc: e18(0)
            }
        )

        consoleLog({
            totalSummitRewards: toDecimal(summations.summit),
            totalUsdcRewards: toDecimal(summations.usdc),
            summitEmission: toDecimal(expeditionInfo.summitExpeditionToken.roundEmission),
            usdcEmission: toDecimal(expeditionInfo.usdcExpeditionToken.roundEmission),
        })

        expect6FigBigNumberEquals(
            summations.summit,
            expeditionInfo.summitExpeditionToken.roundEmission
        )
        expect6FigBigNumberEquals(
            summations.usdc,
            expeditionInfo.usdcExpeditionToken.roundEmission
        )

        await userPromiseSequenceMap(
            async (user, userIndex) => {
                expect6FigBigNumberEquals(rewards[userIndex].summit, hypothetical[userIndex].safeSummit.add(prevWinningTotem === userParams[user.address].deity ? hypothetical[userIndex].deitiedSummit : 0))
                expect6FigBigNumberEquals(rewards[userIndex].usdc, hypothetical[userIndex].safeUsdc.add(prevWinningTotem === userParams[user.address].deity ? hypothetical[userIndex].deitiedUsdc : 0))
            }
        )
    })
    it(`EXPEDITION: Winnings are harvested correctly`, async function() {
        const expeditionRewards = await usersExpeditionRewards()

        const summitClaimedInit = await usersClaimedSummitBalances()
        const usdcBalancesInit = await usersUsdcBalances()
        
        await userPromiseSequenceMap(
            async (user) => await expeditionMethod.harvestExpedition({ user })
        )
            
        const summitClaimedFinal = await usersClaimedSummitBalances()
        const usdcBalancesFinal = await usersUsdcBalances()

        await userPromiseSequenceMap(
            async (_, userIndex) => {
                console.log({
                    summitBalance: `${toDecimal(summitClaimedInit[userIndex])} --> ${toDecimal(summitClaimedFinal[userIndex])}: delta ${toDecimal(deltaBN(summitClaimedInit[userIndex], summitClaimedFinal[userIndex]))}`,
                    usdcBalance: `${toDecimal(usdcBalancesInit[userIndex])} --> ${toDecimal(usdcBalancesFinal[userIndex])}: delta ${toDecimal(deltaBN(usdcBalancesInit[userIndex], usdcBalancesFinal[userIndex]))}`,
                    summitRewards: toDecimal(expeditionRewards[userIndex].summit),
                    usdcRewards: toDecimal(expeditionRewards[userIndex].usdc),
                })
                expect(deltaBN(summitClaimedInit[userIndex], summitClaimedFinal[userIndex])).to.equal(expeditionRewards[userIndex].summit)
                expect(deltaBN(usdcBalancesInit[userIndex], usdcBalancesFinal[userIndex])).to.equal(expeditionRewards[userIndex].usdc)
            }
        )
    })



    // UPDATING DEITY / SAFETY FACTOR / EVEREST OWNED


    it(`DEITIES: Switching to invalid deity should fail with error ${ERR.EXPEDITION_V2.INVALID_DEITY}`, async function() {
        const { user1 } = await getNamedSigners(hre)

        await expeditionMethod.selectDeity({
            user: user1,
            deity: 2,
            revertErr: ERR.EXPEDITION_V2.INVALID_DEITY
        })
    })

    it('DEITIES: Users should be able to switch to valid deities', async function() {
        const { user1 } = await getNamedSigners(hre)

        await expeditionSynth.rolloverExpedition()
        await expeditionSynth.expectUserAndExpedSuppliesToMatch()

        const expedInfoInit = await expeditionGet.userExpeditionInfo(user1.address)


        // SWITCH TOTEM FROM 0 --> TARGET TOTEM
        await expeditionMethod.selectDeity({
            user: user1,
            deity: 1
        })

        await expeditionSynth.expectUserAndExpedSuppliesToMatch()

        const expedInfoMid = await expeditionGet.userExpeditionInfo(user1.address)
        
        
        // SWITCH BACK TO TOTEM 0 FROM TARGET TOTEM
        await expeditionMethod.selectDeity({
            user: user1,
            deity: 0
        })

        
        await expeditionSynth.expectUserAndExpedSuppliesToMatch()

        const expedInfoFinal = await expeditionGet.userExpeditionInfo(user1.address)

        // DEITY changes
        expectAllEqual([0, expedInfoInit.deity, expedInfoFinal.deity])
        expectAllEqual([1, expedInfoMid.deity])

        // Other User Exped Info doesnt change
        expect6FigBigNumberAllEqual([expedInfoInit.everestOwned, expedInfoMid.everestOwned, expedInfoFinal.everestOwned])
        expectAllEqual([expedInfoInit.safetyFactor, expedInfoMid.safetyFactor, expedInfoFinal.safetyFactor])
        expect6FigBigNumberAllEqual([expedInfoInit.safeSupply, expedInfoMid.safeSupply, expedInfoFinal.safeSupply])
        expect6FigBigNumberAllEqual([expedInfoInit.deitiedSupply, expedInfoMid.deitiedSupply, expedInfoFinal.deitiedSupply])
    })

    it('SAFETY FACTOR: Users should be able to switch to valid safety factors', async function() {
        const { user1 } = await getNamedSigners(hre)

        await expeditionSynth.rolloverExpedition()
        
        await expeditionSynth.expectUserAndExpedSuppliesToMatch()

        const expedInfoInit = await expeditionGet.userExpeditionInfo(user1.address)
        const { safe: safeInit, deitied: deitiedInit } = await expeditionSynth.calcUserSafeAndDeitiedEverest(user1.address)

        expect(safeInit).to.equal(expedInfoInit.safeSupply)
        expect(deitiedInit).to.equal(expedInfoInit.deitiedSupply)

        // Switch safety factor to 0
        await expeditionMethod.selectSafetyFactor({
            user: user1,
            safetyFactor: 0
        })

        await expeditionSynth.expectUserAndExpedSuppliesToMatch()

        const expedInfoMid = await expeditionGet.userExpeditionInfo(user1.address)
        const { safe: safeMid, deitied: deitiedMid } = await expeditionSynth.calcUserSafeAndDeitiedEverest(user1.address)

        expect(safeMid).to.equal(expedInfoMid.safeSupply)
        expect(deitiedMid).to.equal(expedInfoMid.deitiedSupply)
        
        // Switch safety factor to 100
        await expeditionMethod.selectSafetyFactor({
            user: user1,
            safetyFactor: 100
        })

        await expeditionSynth.expectUserAndExpedSuppliesToMatch()

        const expedInfoMid2 = await expeditionGet.userExpeditionInfo(user1.address)
        const { safe: safeMid2, deitied: deitiedMid2 } = await expeditionSynth.calcUserSafeAndDeitiedEverest(user1.address)

        expect(safeMid2).to.equal(expedInfoMid2.safeSupply)
        expect(deitiedMid2).to.equal(expedInfoMid2.deitiedSupply)
        
        
        // Switch safety factor back to 50
        await expeditionMethod.selectSafetyFactor({
            user: user1,
            safetyFactor: 50
        })
        
        await expeditionSynth.expectUserAndExpedSuppliesToMatch()

        const expedInfoFinal = await expeditionGet.userExpeditionInfo(user1.address)
        const { safe: safeFinal, deitied: deitiedFinal } = await expeditionSynth.calcUserSafeAndDeitiedEverest(user1.address)

        expect(safeFinal).to.equal(expedInfoFinal.safeSupply)
        expect(deitiedFinal).to.equal(expedInfoFinal.deitiedSupply)


        // Safety factor changes
        expectAllEqual([100, expedInfoInit.safetyFactor, expedInfoMid2.safetyFactor])
        expectAllEqual([0, expedInfoMid.safetyFactor])
        expectAllEqual([50, expedInfoFinal.safetyFactor])


        // User Exped Info doesnt change
        expectAllEqual([expedInfoInit.deity, expedInfoMid.deity, expedInfoMid2.deity, expedInfoFinal.deity])
        expect6FigBigNumberAllEqual([expedInfoInit.everestOwned, expedInfoMid.everestOwned, expedInfoMid2.everestOwned, expedInfoFinal.everestOwned])
    })

    // it('EVEREST CHANGE: Users should be able to increase or remove locked everest and update expeditions', async function() {
    //     const { user1 } = await getNamedSigners(hre)
    //     const expeditionV2 = await getExpedition()
    //     const cakeToken = await getCakeToken()

    //     await expeditionSynth.rolloverExpedition()
        
    //     await expeditionSynth.expectUserAndExpedSuppliesToMatch()

    //     const expedInfoInit = await expeditionGet.userExpeditionInfo(user1.address)
    //     const { safe: safeInit, deitied: deitiedInit } = await expeditionSynth.calcUserSafeAndDeitiedEverest(user1.address)

    //     consoleLog({
    //         safeInit: toDecimal(safeInit),
    //         expedInfoSafeInit: toDecimal(expedInfoInit.safeSupply),
    //         summitInit: toDecimal(expedInfoInit.summitLocked),
    //         summitLpInit: toDecimal(expedInfoInit.summitLpLocked),
    //     })

    //     expect(safeInit).to.equal(expedInfoInit.safeSupply)
    //     expect(deitiedInit).to.equal(expedInfoInit.deitiedSupply)

    //     // Increase locked summit
    //     await expeditionV2.connect(user1).increaseLockedSummit(e18(30), e18(0))

    //     await expeditionSynth.expectUserAndExpedSuppliesToMatch()

    //     const expedInfoMid = await expeditionGet.userExpeditionInfo(user1.address)
    //     const { safe: safeMid, deitied: deitiedMid } = await expeditionSynth.calcUserSafeAndDeitiedEverest(user1.address)

    //     expect(safeMid).to.equal(expedInfoMid.safeSupply)
    //     expect(deitiedMid).to.equal(expedInfoMid.deitiedSupply)

    //     consoleLog({
    //         safeMid: toDecimal(safeMid),
    //         expedInfoSafeMid: toDecimal(expedInfoMid.safeSupply),
    //         summitMid: toDecimal(expedInfoMid.summitLocked),
    //         summitLpMid: toDecimal(expedInfoMid.summitLpLocked),
    //     })



    //     // DECREASE LOCKED SUMMIT by half
    //     await mineBlockWithTimestamp(expedInfoInit.lockRelease)
    //     const halfEverestAmount = expedInfoMid.everestOwned.div(2)

    //     await expeditionV2.connect(user1).decreaseLockedSummit(halfEverestAmount)

    //     await expeditionSynth.expectUserAndExpedSuppliesToMatch()

    //     const expedInfoMid2 = await expeditionGet.userExpeditionInfo(user1.address)
    //     const { safe: safeMid2, deitied: deitiedMid2 } = await expeditionSynth.calcUserSafeAndDeitiedEverest(user1.address)

    //     consoleLog({
    //         safeMid2: toDecimal(safeMid2),
    //         expedInfoSafeMid2: toDecimal(expedInfoMid2.safeSupply),
    //         summitMid2: toDecimal(expedInfoMid2.summitLocked),
    //         summitLpMid2: toDecimal(expedInfoMid2.summitLpLocked),
    //     })

    //     expect(safeMid2).to.equal(expedInfoMid2.safeSupply)
    //     expect(deitiedMid2).to.equal(expedInfoMid2.deitiedSupply)
        
        
    //     // Decrease locked summit to 0
    //     await expeditionV2.connect(user1).decreaseLockedSummit(halfEverestAmount)
        
    //     await expeditionSynth.expectUserAndExpedSuppliesToMatch()

    //     const expedInfoFinal = await expeditionGet.userExpeditionInfo(user1.address)
    //     const { safe: safeFinal, deitied: deitiedFinal } = await expeditionSynth.calcUserSafeAndDeitiedEverest(user1.address)

    //     consoleLog({
    //         safeFinal: toDecimal(safeFinal),
    //         expedInfoSafeFinal: toDecimal(expedInfoFinal.safeSupply),
    //         summitFinal: toDecimal(expedInfoFinal.summitLocked),
    //         summitLpFinal: toDecimal(expedInfoFinal.summitLpLocked),
    //     })

    //     expect(safeFinal).to.equal(expedInfoFinal.safeSupply)
    //     expect(deitiedFinal).to.equal(expedInfoFinal.deitiedSupply)


    //     // Safety factor changes
    //     expect6FigBigNumberAllEqual([expedInfoMid.everestOwned, expedInfoMid2.everestOwned.mul(2)])
    //     expect(expedInfoFinal.summitLocked).to.equal(0)
    //     expect(expedInfoFinal.summitLpLocked).to.equal(0)
    //     expect(expedInfoFinal.everestOwned).to.equal(0)
    //     expectAllEqual([1, expedInfoInit.interactingExpedCount, expedInfoMid.interactingExpedCount, expedInfoMid2.interactingExpedCount])
    //     expectAllEqual([0, expedInfoFinal.interactingExpedCount])


    //     // User Everest Info doesnt change
    //     expectAllEqual([expedInfoInit.deity, expedInfoMid.deity, expedInfoMid2.deity, expedInfoFinal.deity])
    //     expectAllEqual([expedInfoInit.everestLockMultiplier, expedInfoMid.everestLockMultiplier, expedInfoMid2.everestLockMultiplier, expedInfoFinal.everestLockMultiplier])
    //     expect6FigBigNumberAllEqual([expedInfoInit.lockRelease, expedInfoMid.lockRelease, expedInfoMid2.lockRelease, expedInfoFinal.lockRelease])
    //     expectAllEqual([expedInfoInit.safetyFactor, expedInfoMid.safetyFactor, expedInfoMid2.safetyFactor, expedInfoFinal.safetyFactor])
    // })
})
