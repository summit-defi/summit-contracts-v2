import hre, { ethers } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai"
import { e18, ERR, toDecimal, INF_APPROVE, deltaBN, expect6FigBigNumberAllEqual, mineBlockWithTimestamp, EXPEDITION, promiseSequenceMap, expect6FigBigNumberEquals, consoleLog, expectAllEqual, getBifiToken, getUSDCToken, getExpedition, getSummitToken, everestGet, everestMethod, expeditionMethod, expeditionGet, elevationHelperGet, expeditionSynth, days, rolloverRound } from "../utils";
import { userPromiseSequenceMap, userPromiseSequenceReduce, usersLockedSummitBalances, usersExpeditionPotentialWinnings, usersExpeditionRewards, usersUsdcBalances } from "../utils/users";
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
        const { dev } = await ethers.getNamedSigners()
        const bifiToken = await getBifiToken()
        
        await expeditionMethod.addExpeditionFunds({
            user: dev,
            tokenAddress: bifiToken.address,
            amount: e18(500),
            revertErr: ERR.EXPEDITION_V2.INVALID_EXPED_TOKEN
        })
    })
    it(`EXPEDITION ADD FUNDS: Adding funds to the expedition recalculates emissions correctly`, async function() {
        const { dev } = await ethers.getNamedSigners()
        const expedition = await getExpedition()
        const usdcToken = await getUSDCToken()
        const summitToken = await getSummitToken()

        const expeditionRunwayRounds = await expeditionGet.expeditionRunwayRounds()
        const expeditionInfoInit = await expeditionGet.expeditionInfo()

        expect(expeditionInfoInit.roundsRemaining).to.equal(0)
        expect(expeditionInfoInit.summitExpeditionToken.emissionsRemaining).to.equal(e18(0))
        expect(expeditionInfoInit.summitExpeditionToken.roundEmission).to.equal(e18(0))
        expect(expeditionInfoInit.usdcExpeditionToken.emissionsRemaining).to.equal(e18(0))
        expect(expeditionInfoInit.usdcExpeditionToken.roundEmission).to.equal(e18(0))

        await usdcToken.connect(dev).approve(expedition.address, e18(500))
        await expeditionMethod.addExpeditionFunds({
            user: dev,
            tokenAddress: usdcToken.address,
            amount: e18(500),
        })
        await expeditionMethod.recalculateExpeditionEmissions({ dev })

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
        await expeditionMethod.recalculateExpeditionEmissions({ dev })

        const expectedEmissionsFinal = await expeditionSynth.getExpeditionExpectedEmissions()
        const expeditionInfoFinal = await expeditionGet.expeditionInfo()

        expect(expeditionInfoFinal.roundsRemaining).to.equal(expeditionRunwayRounds)
        expect(expeditionInfoFinal.summitExpeditionToken.emissionsRemaining).to.equal(e18(300))
        expect(expeditionInfoFinal.summitExpeditionToken.roundEmission).to.equal(expectedEmissionsFinal.summitEmission)
        expect(expeditionInfoFinal.usdcExpeditionToken.emissionsRemaining).to.equal(e18(500))
        expect(expeditionInfoFinal.usdcExpeditionToken.roundEmission).to.equal(expectedEmissionsFinal.usdcEmission)
    })

    it('SYNC EVEREST: Sync everest keeps values correct', async function() {
        const { user1 } = await ethers.getNamedSigners()

        const expeditionInfoInit = await expeditionGet.expeditionInfo()
        const userExpedInfoInit = await expeditionGet.userExpeditionInfo(user1.address)

        await expeditionMethod.syncEverestAmount({
            user: user1
        })

        const expeditionInfoFinal = await expeditionGet.expeditionInfo()
        const userExpedInfoFinal = await expeditionGet.userExpeditionInfo(user1.address)

        expect(expeditionInfoInit.deitiedSupply).to.equal(expeditionInfoFinal.deitiedSupply)
        expect(expeditionInfoInit.deitySupply[userExpedInfoInit.deity]).to.equal(expeditionInfoFinal.deitySupply[userExpedInfoInit.deity])
        expect(expeditionInfoInit.safeSupply).to.equal(expeditionInfoFinal.safeSupply)
        expect(userExpedInfoInit.everestOwned).to.equal(userExpedInfoFinal.everestOwned)
        expect(userExpedInfoInit.safeSupply).to.equal(userExpedInfoFinal.safeSupply)
        expect(userExpedInfoInit.deitiedSupply).to.equal(userExpedInfoFinal.deitiedSupply)
    })

    it('EXPEDITION: Users can only enter expedition if they own everest, have selected a deity, and have selected a safety factor', async function() {
        const { user1, user2, user3 } = await ethers.getNamedSigners()

        enum RequirementStep {
            Everest,
            Deity,
            SafetyFactor,
        }
        
        const expectMetRequirementsMatch = async (user: SignerWithAddress, userMetRequirements: any) => {
            const userEligibleToJoinExpedition = await expeditionGet.userSatisfiesExpeditionRequirements(user.address)

            expect(userEligibleToJoinExpedition.everest).to.equal(userMetRequirements[RequirementStep.Everest])
            expect(userEligibleToJoinExpedition.deity).to.equal(userMetRequirements[RequirementStep.Deity])
            expect(userEligibleToJoinExpedition.safetyFactor).to.equal(userMetRequirements[RequirementStep.SafetyFactor])
        }

        const getRequirementPrioritizedRevertErr = (userMetRequirements: any) => {
            if (!userMetRequirements[RequirementStep.Everest]) return ERR.EVEREST.MUST_OWN_EVEREST
            if (!userMetRequirements[RequirementStep.Deity]) return ERR.EXPEDITION_V2.NO_DEITY
            if (!userMetRequirements[RequirementStep.SafetyFactor]) return ERR.EXPEDITION_V2.NO_SAFETY_FACTOR
            return undefined
        }

        const executeRequirementStep = async (user: SignerWithAddress, step: RequirementStep) => {
            switch (step) {
                case RequirementStep.Everest:
                    await everestMethod.lockSummit({
                        user,
                        amount: userParams[user.address].summitAmount,
                        lockDuration: userParams[user.address].lockDuration,
                    })
                    return
                case RequirementStep.Deity:
                    await expeditionMethod.selectDeity({
                        user,
                        deity: userParams[user.address].deity,
                    })
                    return
                case RequirementStep.SafetyFactor:
                    await expeditionMethod.selectSafetyFactor({
                        user,
                        safetyFactor: userParams[user.address].safetyFactor,
                    })
                    return
            }
        }

        const userParams = {
            [user1.address]: {
                deity: 0,
                safetyFactor: 100,
                summitAmount: e18(10),
                lockDuration: days(7),
                requirementsOrder: [RequirementStep.Everest, RequirementStep.Deity, RequirementStep.SafetyFactor]
            },
            [user2.address]: {
                deity: 0,
                safetyFactor: 0,
                summitAmount: e18(30),
                lockDuration: days(365),
                requirementsOrder: [RequirementStep.SafetyFactor, RequirementStep.Everest, RequirementStep.Deity]
            },
            [user3.address]: {
                deity: 1,
                safetyFactor: 50,
                summitAmount: e18(22.5),
                lockDuration: days(30),
                requirementsOrder: [RequirementStep.SafetyFactor, RequirementStep.Deity, RequirementStep.Everest]
            }
        }

        await userPromiseSequenceMap(
            async (user) => {

                let userMetRequirements = {
                    [RequirementStep.Everest]: false,
                    [RequirementStep.Deity]: false,
                    [RequirementStep.SafetyFactor]: false,
                }

                let userExpeditionInfo = await expeditionGet.userExpeditionInfo(user.address)
                expect(userExpeditionInfo.entered).to.equal(false)
                await expectMetRequirementsMatch(user, userMetRequirements)


                await promiseSequenceMap(
                    userParams[user.address].requirementsOrder,
                    async (step) => {

                        // Ensure user can't join expedition without requirement
                        await expeditionMethod.joinExpedition({
                            user,
                            revertErr: getRequirementPrioritizedRevertErr(userMetRequirements)
                        })

                        // Execute Step
                        await executeRequirementStep(user, step)

                        // Mark requirement as completed, ensure met requirements match
                        userMetRequirements[step] = true;
                        await expectMetRequirementsMatch(user, userMetRequirements)
                    }
                )

                // User should now be able to join expedition        
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

    it('BEFORE UNLOCK: Before the first round rolls over, potential winnings and actual winnings are 0', async function() {
        const potentialWinnings = await usersExpeditionPotentialWinnings()

        await userPromiseSequenceMap(
            async (_, userIndex) => {
                expect(potentialWinnings[userIndex].safeSummit).to.equal(0)
                expect(potentialWinnings[userIndex].safeUsdc).to.equal(0)
            }
        )

        await rolloverRound(EXPEDITION)

        const rewards = await usersExpeditionRewards()

        await userPromiseSequenceMap(
            async (_, userIndex) => {
                expect(rewards[userIndex].summit).to.equal(0)
                expect(rewards[userIndex].usdc).to.equal(0)
            }
        )
    })

    it(`EXPEDITION: Rounds yield correct winnings`, async function() {
        const { user1, user2, user3 } = await ethers.getNamedSigners()
        
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

        const potentialWinnings = await usersExpeditionPotentialWinnings()

        await expeditionSynth.rolloverExpedition()
        const prevWinningTotem = await elevationHelperGet.prevWinningTotem(EXPEDITION)

        const rewards = await usersExpeditionRewards()

        await userPromiseSequenceMap(
            async (_, userIndex) => consoleLog({
                user: userIndex,
                potentialWinningsSummit: `Safe: ${toDecimal(potentialWinnings[userIndex].safeSummit)}, Deity: ${toDecimal(potentialWinnings[userIndex].deitiedSummit)}: Total ${toDecimal(potentialWinnings[userIndex].safeSummit.add(potentialWinnings[userIndex].deitiedSummit))}`,
                potentialWinningsUsdc: `Safe: ${toDecimal(potentialWinnings[userIndex].safeUsdc)}, Deity: ${toDecimal(potentialWinnings[userIndex].deitiedUsdc)}: Total ${toDecimal(potentialWinnings[userIndex].safeUsdc.add(potentialWinnings[userIndex].deitiedUsdc))}`,
                rewardsSummit: toDecimal(rewards[userIndex].summit),
                rewardsUsdc: toDecimal(rewards[userIndex].usdc),
            })
        )

        const summations = await userPromiseSequenceReduce(
            (acc, user, userIndex) => ({
                summit: acc.summit.add(rewards[userIndex].summit) as BigNumber,
                usdc: acc.usdc.add(rewards[userIndex].usdc) as BigNumber,
                safeSummitRewards: acc.safeSummitRewards.add(potentialWinnings[userIndex].safeSummit),
                safeUsdcRewards: acc.safeUsdcRewards.add(potentialWinnings[userIndex].safeUsdc),
                deitiedSummitRewards: acc.deitiedSummitRewards.add(prevWinningTotem === userParams[user.address].deity ? potentialWinnings[userIndex].deitiedSummit : 0),
                deitiedUsdcRewards: acc.deitiedUsdcRewards.add(prevWinningTotem === userParams[user.address].deity ? potentialWinnings[userIndex].deitiedUsdc : 0)
            }),
            {
                summit: e18(0),
                usdc: e18(0),
                safeSummitRewards: e18(0),
                safeUsdcRewards: e18(0),
                deitiedSummitRewards: e18(0),
                deitiedUsdcRewards: e18(0),
            }
        )

        consoleLog({
            totalSummitRewards: toDecimal(summations.summit),
            totalUsdcRewards: toDecimal(summations.usdc),
            summitEmission: toDecimal(expeditionInfo.summitExpeditionToken.roundEmission),
            usdcEmission: toDecimal(expeditionInfo.usdcExpeditionToken.roundEmission),
        })

        console.log({
            summationsSummit: toDecimal(summations.summit),
            roundEmission: toDecimal(expeditionInfo.summitExpeditionToken.roundEmission)
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
                expect6FigBigNumberEquals(rewards[userIndex].summit, potentialWinnings[userIndex].safeSummit.add(prevWinningTotem === userParams[user.address].deity ? potentialWinnings[userIndex].deitiedSummit : 0))
                expect6FigBigNumberEquals(rewards[userIndex].usdc, potentialWinnings[userIndex].safeUsdc.add(prevWinningTotem === userParams[user.address].deity ? potentialWinnings[userIndex].deitiedUsdc : 0))
            }
        )


        // Correct amount is distributed to safe and deitied segments of staking
        const totalEverestStaked = expeditionInfo.safeSupply.add(expeditionInfo.deitiedSupply.mul(125).div(100))
        const safePerc = expeditionInfo.safeSupply.mul(100000).div(totalEverestStaked).toNumber() / 100000
        const deitiedPerc = expeditionInfo.deitiedSupply.mul(125).div(100).mul(100000).div(totalEverestStaked).toNumber() / 100000

        const totalSummit = summations.safeSummitRewards.add(summations.deitiedSummitRewards)
        const summitSafePerc = summations.safeSummitRewards.mul(100000).div(totalSummit).toNumber() / 100000
        const summitDeitiedPerc = summations.deitiedSummitRewards.mul(100000).div(totalSummit).toNumber() / 100000

        const totalUsdc = summations.safeUsdcRewards.add(summations.deitiedUsdcRewards)
        const usdcSafePerc = summations.safeUsdcRewards.mul(100000).div(totalUsdc).toNumber() / 100000
        const usdcDeitiedPerc = summations.deitiedUsdcRewards.mul(100000).div(totalUsdc).toNumber() / 100000

        expectAllEqual([safePerc, summitSafePerc, usdcSafePerc])
        expectAllEqual([deitiedPerc, summitDeitiedPerc, usdcDeitiedPerc])


        console.log({
            safePerc,
            deitiedPerc,
            summitSafePerc,
            summitDeitiedPerc,
            usdcSafePerc,
            usdcDeitiedPerc,
            safeSummitRewards: toDecimal(summations.safeSummitRewards),
            safeUsdcRewards: toDecimal(summations.safeUsdcRewards),
            deitiedSummitRewards: toDecimal(summations.deitiedSummitRewards),
            deitiedUsdcRewards: toDecimal(summations.deitiedUsdcRewards),
        })

    })
    it(`EXPEDITION: Winnings are harvested correctly`, async function() {
        const expeditionRewards = await usersExpeditionRewards()

        const summitClaimedInit = await usersLockedSummitBalances()
        const usdcBalancesInit = await usersUsdcBalances()
        
        await userPromiseSequenceMap(
            async (user) => await expeditionMethod.harvestExpedition({ user })
        )
            
        const summitClaimedFinal = await usersLockedSummitBalances()
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
        const { user1 } = await ethers.getNamedSigners()

        await expeditionMethod.selectDeity({
            user: user1,
            deity: 2,
            revertErr: ERR.EXPEDITION_V2.INVALID_DEITY
        })
    })

    it('DEITIES: Users should be able to switch to valid deities', async function() {
        const { user1 } = await ethers.getNamedSigners()

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
        const { user1 } = await ethers.getNamedSigners()

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

    it('SAFETY FACTOR: Users should be able to switch to both safety factor and deity', async function() {
        const { user1 } = await ethers.getNamedSigners()

        await expeditionSynth.rolloverExpedition()
        
        await expeditionSynth.expectUserAndExpedSuppliesToMatch()

        const expedInfoInit = await expeditionGet.userExpeditionInfo(user1.address)
        const { safe: safeInit, deitied: deitiedInit } = await expeditionSynth.calcUserSafeAndDeitiedEverest(user1.address)

        expect(safeInit).to.equal(expedInfoInit.safeSupply)
        expect(deitiedInit).to.equal(expedInfoInit.deitiedSupply)

        // Switch safety factor to 0
        await expeditionMethod.selectDeityAndSafetyFactor({
            user: user1,
            deity: 1,
            safetyFactor: 0
        })

        await expeditionSynth.expectUserAndExpedSuppliesToMatch()

        const expedInfoMid = await expeditionGet.userExpeditionInfo(user1.address)
        const { safe: safeMid, deitied: deitiedMid } = await expeditionSynth.calcUserSafeAndDeitiedEverest(user1.address)

        expect(safeMid).to.equal(expedInfoMid.safeSupply)
        expect(deitiedMid).to.equal(expedInfoMid.deitiedSupply)
        
        // Switch safety factor to 100
        await expeditionMethod.selectDeityAndSafetyFactor({
            user: user1,
            deity: 0,
            safetyFactor: 100
        })

        await expeditionSynth.expectUserAndExpedSuppliesToMatch()

        const expedInfoMid2 = await expeditionGet.userExpeditionInfo(user1.address)
        const { safe: safeMid2, deitied: deitiedMid2 } = await expeditionSynth.calcUserSafeAndDeitiedEverest(user1.address)

        expect(safeMid2).to.equal(expedInfoMid2.safeSupply)
        expect(deitiedMid2).to.equal(expedInfoMid2.deitiedSupply)
        
        
        // Switch safety factor back to 50
        await expeditionMethod.selectDeityAndSafetyFactor({
            user: user1,
            deity: 1,
            safetyFactor: 50
        })
        
        await expeditionSynth.expectUserAndExpedSuppliesToMatch()

        const expedInfoFinal = await expeditionGet.userExpeditionInfo(user1.address)
        const { safe: safeFinal, deitied: deitiedFinal } = await expeditionSynth.calcUserSafeAndDeitiedEverest(user1.address)

        expect(safeFinal).to.equal(expedInfoFinal.safeSupply)
        expect(deitiedFinal).to.equal(expedInfoFinal.deitiedSupply)


        // Safety factor changes
        expectAllEqual([50, expedInfoInit.safetyFactor, expedInfoFinal.safetyFactor])
        expectAllEqual([0, expedInfoMid.safetyFactor])
        expectAllEqual([100, expedInfoMid2.safetyFactor])


        // DEITY changes
        expectAllEqual([0, expedInfoInit.deity, expedInfoMid2.deity])
        expectAllEqual([1, expedInfoMid.deity, expedInfoFinal.deity])


        // User Exped Info doesnt change
        expect6FigBigNumberAllEqual([expedInfoInit.everestOwned, expedInfoMid.everestOwned, expedInfoMid2.everestOwned, expedInfoFinal.everestOwned])

        await expeditionMethod.selectDeity({
            user: user1,
            deity: 0,
        })
    })

    it('EVEREST CHANGE: Users should be able to increase or remove locked everest and update expeditions', async function() {
        const { user1 } = await ethers.getNamedSigners()

        await rolloverRound(EXPEDITION)
        
        await expeditionSynth.expectUserAndExpedSuppliesToMatch()

        const everestInfoInit = await everestGet.userEverestInfo(user1.address)
        const expedInfoInit = await expeditionGet.userExpeditionInfo(user1.address)
        expect(everestInfoInit.everestOwned).to.equal(expedInfoInit.everestOwned)
        const { safe: safeInit, deitied: deitiedInit } = await expeditionSynth.calcUserSafeAndDeitiedEverest(user1.address)

        consoleLog({
            safeInit: toDecimal(safeInit),
            expedInfoSafeInit: toDecimal(expedInfoInit.safeSupply),
        })

        expect(safeInit).to.equal(expedInfoInit.safeSupply)
        expect(deitiedInit).to.equal(expedInfoInit.deitiedSupply)

        // Increase locked summit
        await everestMethod.increaseLockedSummit({
            user: user1,
            amount: e18(30)
        })

        await expeditionSynth.expectUserAndExpedSuppliesToMatch()

        const everestInfoMid = await everestGet.userEverestInfo(user1.address)
        const expedInfoMid = await expeditionGet.userExpeditionInfo(user1.address)
        expect(everestInfoMid.everestOwned).to.equal(expedInfoMid.everestOwned)
        const { safe: safeMid, deitied: deitiedMid } = await expeditionSynth.calcUserSafeAndDeitiedEverest(user1.address)

        expect(safeMid).to.equal(expedInfoMid.safeSupply)
        expect(deitiedMid).to.equal(expedInfoMid.deitiedSupply)

        consoleLog({
            safeMid: toDecimal(safeMid),
            expedInfoSafeMid: toDecimal(expedInfoMid.safeSupply),
        })



        // DECREASE LOCKED SUMMIT by half
        await mineBlockWithTimestamp(everestInfoMid.lockRelease)
        const halfEverestAmount = everestInfoMid.everestOwned.div(2)
        
        await everestMethod.withdrawLockedSummit({
            user: user1,
            everestAmount: halfEverestAmount
        })
        
        await expeditionSynth.expectUserAndExpedSuppliesToMatch()
        
        const everestInfoMid2 = await everestGet.userEverestInfo(user1.address)
        const expedInfoMid2 = await expeditionGet.userExpeditionInfo(user1.address)
        expect(everestInfoMid2.everestOwned).to.equal(expedInfoMid2.everestOwned)
        const { safe: safeMid2, deitied: deitiedMid2 } = await expeditionSynth.calcUserSafeAndDeitiedEverest(user1.address)

        consoleLog({
            safeMid2: toDecimal(safeMid2),
            expedInfoSafeMid2: toDecimal(expedInfoMid2.safeSupply),
        })

        expect(safeMid2).to.equal(expedInfoMid2.safeSupply)
        expect(deitiedMid2).to.equal(expedInfoMid2.deitiedSupply)
        
        
        // Decrease locked summit to 0
        await everestMethod.withdrawLockedSummit({
            user: user1,
            everestAmount: halfEverestAmount
        })        
        await expeditionSynth.expectUserAndExpedSuppliesToMatch()

        const everestInfoFinal = await everestGet.userEverestInfo(user1.address)
        const expedInfoFinal = await expeditionGet.userExpeditionInfo(user1.address)
        expect(everestInfoFinal.everestOwned).to.equal(expedInfoFinal.everestOwned)
        const { safe: safeFinal, deitied: deitiedFinal } = await expeditionSynth.calcUserSafeAndDeitiedEverest(user1.address)

        consoleLog({
            safeFinal: toDecimal(safeFinal),
            expedInfoSafeFinal: toDecimal(expedInfoFinal.safeSupply),
        })

        expect(safeFinal).to.equal(expedInfoFinal.safeSupply)
        expect(deitiedFinal).to.equal(expedInfoFinal.deitiedSupply)

        expectAllEqual([
            everestInfoFinal.everestOwned,
            expedInfoFinal.everestOwned,
            e18(0)
        ])

        // Other User Exped Info doesnt change
        expectAllEqual([expedInfoInit.deity, expedInfoMid.deity, expedInfoMid2.deity, expedInfoFinal.deity])
        expectAllEqual([expedInfoInit.safetyFactor, expedInfoMid.safetyFactor, expedInfoMid2.safetyFactor, expedInfoFinal.safetyFactor])
    })
})
