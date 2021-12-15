import { BigNumber } from "@ethersproject/bignumber";
import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre from "hardhat";
import { e18, ERR, toDecimal, INF_APPROVE, getTimestamp, deltaBN, expect6FigBigNumberAllEqual, mineBlockWithTimestamp, promiseSequenceMap, consoleLog, getSummitToken, everestGet, everestMethod, days, everestSetParams, getSummitBalance, getEverestBalance, userPromiseSequenceMap, usersSummitBalances, usersEverestBalances, userPromiseSequenceReduce, getEverestToken, getDummyEverestExtension, ZEROADD, expectAllEqual, erc20Method, Contracts } from "../utils";
import { oasisUnlockedFixture } from "./fixtures";



describe("EVEREST", async function() {
    before(async function () {
        const { everestToken, summitToken, user1, user2, user3 } = await oasisUnlockedFixture()

        await everestToken.connect(user1).approve(everestToken.address, INF_APPROVE)
        await everestToken.connect(user2).approve(everestToken.address, INF_APPROVE)
        await everestToken.connect(user3).approve(everestToken.address, INF_APPROVE)

        await summitToken.connect(user1).approve(everestToken.address, INF_APPROVE)
        await summitToken.connect(user2).approve(everestToken.address, INF_APPROVE)
        await summitToken.connect(user3).approve(everestToken.address, INF_APPROVE)
    })


    it(`EVEREST: Locking for invalid lock duration throws error "${ERR.EVEREST.INVALID_LOCK_DURATION}"`, async function () {
        const { user1 } = await getNamedSigners(hre)

        await everestMethod.lockSummit({
            user: user1,
            amount: e18(1),
            lockDuration: days(0.5),
            revertErr: ERR.EVEREST.INVALID_LOCK_DURATION
        })

        await everestMethod.lockSummit({
            user: user1,
            amount: e18(1),
            lockDuration: days(400),
            revertErr: ERR.EVEREST.INVALID_LOCK_DURATION
        })
    })
    it(`EVEREST: Locking more than user's balance throws error "${ERR.ERC20.EXCEEDS_BALANCE}"`, async function () {
        const { user1 } = await getNamedSigners(hre)

        await everestMethod.lockSummit({
            user: user1,
            amount: e18(1000000),
            lockDuration: days(7),
            revertErr: ERR.ERC20.EXCEEDS_BALANCE
        })
    })
    it(`REMOVE EVEREST: User without locked everest cannot withdraw, or throws "${ERR.EVEREST.USER_DOESNT_EXIST}"`, async function () {
        const { user1 } = await getNamedSigners(hre)

        await everestMethod.withdrawLockedSummit({
            user: user1,
            everestAmount: e18(1),
            revertErr: ERR.EVEREST.USER_DOESNT_EXIST
        })
    })



    it(`LOCK EVEREST: Depositing SUMMIT for EVEREST for different lock periods should succeed`, async function() {
        const lockingData = [
            { amount: e18(1), lockDuration: days(7) }, // USER 1
            { amount: e18(1), lockDuration: days(30) }, // USER 2
            { amount: e18(1), lockDuration: days(365) }, // USER 3
        ]

        const userExpectedEverest = await userPromiseSequenceMap(
            async (_, userIndex) => await everestGet.getExpectedEverestAward(lockingData[userIndex].amount, lockingData[userIndex].lockDuration)
        )
        const userExpectedEverestLockMultiplier = await userPromiseSequenceMap(
            async (_, userIndex) => await everestGet.getLockDurationMultiplier(lockingData[userIndex].lockDuration)
        )
        const userSummitInit = await usersSummitBalances()
        const userEverestInit = await usersEverestBalances()



        const userLockTimestamp = await userPromiseSequenceMap(
            async (user, userIndex) => {
                await everestMethod.lockSummit({
                    user,
                    ...lockingData[userIndex],
                })
                
                return await getTimestamp()
            }
        )


        const userEverestInfo = await userPromiseSequenceMap(
            async (user) => await everestGet.userEverestInfo(user.address)
        )

        const userSummitFinal = await usersSummitBalances()
        const userEverestFinal = await usersEverestBalances()

        await userPromiseSequenceMap(
            async (_, userIndex) => {
                expect(userEverestInfo[userIndex].everestOwned).to.equal(userExpectedEverest[userIndex])
                expect(userEverestInfo[userIndex].everestLockMultiplier).to.equal(userExpectedEverestLockMultiplier[userIndex])
                expect(userEverestInfo[userIndex].lockRelease).to.equal(userLockTimestamp[userIndex] + lockingData[userIndex].lockDuration)
                expect(userEverestInfo[userIndex].lockDuration).to.equal(lockingData[userIndex].lockDuration)
                expect(userEverestInfo[userIndex].summitLocked).to.equal(lockingData[userIndex].amount)


                expect(deltaBN(userSummitInit[userIndex], userSummitFinal[userIndex])).to.equal(lockingData[userIndex].amount)
                expect(deltaBN(userEverestInit[userIndex], userEverestFinal[userIndex])).to.equal(userExpectedEverest[userIndex])
            }
        )
    })

    it(`INCREASE EVEREST: User with already locked summit cannot do another initial lock, or throws "${ERR.EVEREST.ALREADY_LOCKING_SUMMIT}"`, async function () {
        const { user1 } = await getNamedSigners(hre)

        await everestMethod.lockSummit({
            user: user1,
            amount: e18(5),
            lockDuration: days(300),
            revertErr: ERR.EVEREST.ALREADY_LOCKING_SUMMIT
        })
    })

    it(`INCREASE LOCK DURATION: Users should be able to increase their lock duration and earn more EVEREST`, async function() {
        const { user2 } = await getNamedSigners(hre)

        await everestMethod.increaseLockDuration({
            user: user2,
            lockDuration: days(30) - 1,
            revertErr: ERR.EVEREST.LOCK_DURATION_STRICTLY_INCREASE,
        })

        const userEverestInit = await getEverestBalance(user2.address)
        const userEverestInfoInit = await everestGet.userEverestInfo(user2.address)
        const expectedEverestAward = await everestGet.getAdditionalEverestAwardForLockDurationIncrease(user2.address, days(60))

        await everestMethod.increaseLockDuration({
            user: user2,
            lockDuration: days(60),
        })
        const increaseLockTimestamp = await getTimestamp()

        const userEverestFinal = await getEverestBalance(user2.address)
        const userEverestInfoFinal = await everestGet.userEverestInfo(user2.address)

        expectAllEqual([
            deltaBN(userEverestInit, userEverestFinal),
            deltaBN(userEverestInfoInit.everestOwned, userEverestInfoFinal.everestOwned),
            expectedEverestAward
        ])
        expectAllEqual([
            userEverestInfoInit.summitLocked,
            userEverestInfoFinal.summitLocked
        ])
        expect(userEverestInfoInit.lockDuration).to.equal(days(30))
        expect(userEverestInfoFinal.lockDuration).to.equal(days(60))
        expect(userEverestInfoFinal.lockRelease).to.equal(increaseLockTimestamp + days(60))
    })

    it(`INCREASE EVEREST: User with already locked summit should be able to lock more summit`, async function() {
        const { user1 } = await getNamedSigners(hre)
        
        const userSummitInit = await getSummitBalance(user1.address)
        const userEverestInit = await getEverestBalance(user1.address)
        const everestInfoInit = await everestGet.userEverestInfo(user1.address)

        const userSummitAmount = e18(5)
        const userSummitLockDuration = days(7)
        
        const userExpectedEverest = await everestGet.getExpectedEverestAward(userSummitAmount, userSummitLockDuration)

        consoleLog({
            user1ExpectedEverest: toDecimal(userExpectedEverest),
        })

        await everestMethod.increaseLockedSummit({
            user: user1,
            amount: userSummitAmount,
        })

        const userSummitFinal = await getSummitBalance(user1.address)
        const userEverestFinal = await getEverestBalance(user1.address)
        const everestInfoFinal = await everestGet.userEverestInfo(user1.address)

        expect6FigBigNumberAllEqual([
            userExpectedEverest,
            deltaBN(userEverestInit, userEverestFinal),
            deltaBN(everestInfoInit.everestOwned, everestInfoFinal.everestOwned),
        ])
        expect6FigBigNumberAllEqual([
            userEverestFinal,
            everestInfoFinal.everestOwned,
        ])
        expect6FigBigNumberAllEqual([
            deltaBN(userSummitInit, userSummitFinal),
            deltaBN(everestInfoInit.summitLocked, everestInfoFinal.summitLocked)
        ])
    })

    it(`REMOVE EVEREST: User's lock must mature before decreasing locked summit, or throws "${ERR.EVEREST.EVEREST_LOCKED}"`, async function () {
        const { user1 } = await getNamedSigners(hre)

        await everestMethod.withdrawLockedSummit({
            user: user1,
            everestAmount: e18(1),
            revertErr: ERR.EVEREST.EVEREST_LOCKED
        })
    })

    it(`REMOVE EVEREST: After lock matured, User cannot withdraw 0 or more than their locked everest, or throws "${ERR.EVEREST.BAD_WITHDRAW}"`, async function () {
        const { user1 } = await getNamedSigners(hre)

        const everestInfo = await everestGet.userEverestInfo(user1.address)
        await mineBlockWithTimestamp(everestInfo.lockRelease)

        await everestMethod.withdrawLockedSummit({
            user: user1,
            everestAmount: e18(0),
            revertErr: ERR.EVEREST.BAD_WITHDRAW
        })

        await everestMethod.withdrawLockedSummit({
            user: user1,
            everestAmount: e18(10000),
            revertErr: ERR.EVEREST.BAD_WITHDRAW
        })
    })

    it(`REMOVE EVEREST: Valid summit withdraw is successful`, async function () {
        const { user1 } = await getNamedSigners(hre)

        const everestInfoInit = await everestGet.userEverestInfo(user1.address)
        const halfEverestAmount = everestInfoInit.everestOwned.div(2)
        const everestInit = await getEverestBalance(user1.address)
        const summitInit = await getSummitBalance(user1.address)
        expect(halfEverestAmount).to.equal(everestInit.div(2))

        // WITHDRAW HALF
        const expectedSummitWithdrawal1 = everestInfoInit.summitLocked.div(2)

        await everestMethod.withdrawLockedSummit({
            user: user1,
            everestAmount: halfEverestAmount,
        })

        const everestInfoMid = await everestGet.userEverestInfo(user1.address)
        const everestMid = await getEverestBalance(user1.address)
        const summitMid = await getSummitBalance(user1.address)

        expect6FigBigNumberAllEqual([
            expectedSummitWithdrawal1,
            deltaBN(summitInit, summitMid),
            deltaBN(everestInfoInit.summitLocked, everestInfoMid.summitLocked)
        ])
        expect6FigBigNumberAllEqual([
            halfEverestAmount,
            deltaBN(everestInit, everestMid),
            deltaBN(everestInfoInit.everestOwned, everestInfoMid.everestOwned)
        ])

        // WITHDRAW REMAINING
        const expectedSummitWithdrawal2 = everestInfoMid.summitLocked

        await everestMethod.withdrawLockedSummit({
            user: user1,
            everestAmount: halfEverestAmount,
        })

        const everestInfoFinal = await everestGet.userEverestInfo(user1.address)
        const everestFinal = await getEverestBalance(user1.address)
        const summitFinal = await getSummitBalance(user1.address)

        consoleLog({
            summit: `${toDecimal(summitMid)} ==> ${toDecimal(summitFinal)}: ${toDecimal(deltaBN(summitFinal, summitMid))}`,
            everest: `${toDecimal(everestMid)} ==> ${toDecimal(everestFinal)}: ${toDecimal(deltaBN(everestFinal, everestMid))}`,
            summitEverestInfo: `${toDecimal(everestInfoMid.summitLocked)} ==> ${toDecimal(everestInfoFinal.summitLocked)}: ${toDecimal(deltaBN(everestInfoMid.summitLocked, everestInfoFinal.summitLocked))}`,
            everestEverestInfo: `${toDecimal(everestInfoMid.everestOwned)} ==> ${toDecimal(everestInfoFinal.everestOwned)}: ${toDecimal(deltaBN(everestInfoMid.everestOwned, everestInfoFinal.everestOwned))}`,
            expectedSummitWithdrawal2: toDecimal(expectedSummitWithdrawal2),
            everestMid: toDecimal(everestMid),
        })

        expect6FigBigNumberAllEqual([
            expectedSummitWithdrawal2,
            deltaBN(summitFinal, summitMid),
            deltaBN(everestInfoFinal.summitLocked, everestInfoMid.summitLocked)
        ])
        expect6FigBigNumberAllEqual([
            everestMid,
            deltaBN(everestFinal, everestMid),
            deltaBN(everestInfoFinal.everestOwned, everestInfoMid.everestOwned)
        ])
    })
})


describe("EVEREST RUNNING AVERAGE", async function() {
    before(async function () {
        const { everestToken, summitToken, user1, user2, user3 } = await oasisUnlockedFixture()

        await everestToken.connect(user1).approve(everestToken.address, INF_APPROVE)
        await everestToken.connect(user2).approve(everestToken.address, INF_APPROVE)
        await everestToken.connect(user3).approve(everestToken.address, INF_APPROVE)

        await summitToken.connect(user1).approve(everestToken.address, INF_APPROVE)
        await summitToken.connect(user2).approve(everestToken.address, INF_APPROVE)
        await summitToken.connect(user3).approve(everestToken.address, INF_APPROVE)
    })
    it('EVEREST RUNNING AVG: Lock / withdraw events should update the running average', async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)

        let totalSummitLocked = e18(0)

        const userLockInfo = {
            [user1.address]: {
                amount: e18(5),
                lockDuration: days(7),
            },
            [user2.address]: {
                amount: e18(10),
                lockDuration: days(15),
            },
            [user3.address]: {
                amount: e18(15),
                lockDuration: days(30)
            },
        }
        await userPromiseSequenceMap(
            async (user) => {
                await everestMethod.lockSummit({
                    user,
                    amount: userLockInfo[user.address].amount,
                    lockDuration: userLockInfo[user.address].lockDuration,
                })
                totalSummitLocked = totalSummitLocked.add(userLockInfo[user.address].amount)
            }
        )

        const currentTimestamp = await getTimestamp()
        await mineBlockWithTimestamp(currentTimestamp + days(30))

        const lockWithdrawEvents = [
            { user: user1, lock: true, amount: e18(20) },
            { user: user2, lock: false, amount: 7 },
            { user: user3, lock: true, amount: e18(10) },
            { user: user1, lock: false, amount: 99 },
            { user: user2, lock: false, amount: 50 },
            { user: user3, lock: false, amount: 66 },
            { user: user1, lock: true, amount: e18(11.6576) },
            { user: user2, lock: false, amount: 22 },
            { user: user3, lock: true, amount: e18(0.458) },
            { user: user3, lock: false, amount: 99 },
            { user: user1, lock: true, amount: e18(74) },
            { user: user2, lock: false, amount: 50 },
            { user: user2, lock: false, amount: 25 },
            { user: user1, lock: true, amount: e18(54) },
        ]
        
        await promiseSequenceMap(
            lockWithdrawEvents,
            async ({ user, lock, amount }) => {
                if (lock) {
                    await everestMethod.increaseLockedSummit({
                        user,
                        amount: amount as BigNumber,
                    })
                    userLockInfo[user.address].amount = userLockInfo[user.address].amount.add(amount)
                    totalSummitLocked = totalSummitLocked.add(amount)

                } else {
                    const userEverestInfo = await everestGet.userEverestInfo(user.address)
                    const everestAmount = userEverestInfo.everestOwned.mul(amount).div(100)
                    const expectedWithdrawnSummit = await everestGet.getExpectedWithdrawnSummit(user.address, everestAmount)
                    await everestMethod.withdrawLockedSummit({
                        user,
                        everestAmount,
                    })
                    userLockInfo[user.address].amount = userLockInfo[user.address].amount.sub(expectedWithdrawnSummit)
                    totalSummitLocked = totalSummitLocked.sub(expectedWithdrawnSummit)
                }

                // Validate total summit
                const trueSummitLocked = await everestGet.totalSummitLocked()
                expect(totalSummitLocked).to.equal(trueSummitLocked)

                // Validate updated average
                const weightedTotal = await userPromiseSequenceReduce(
                    (acc, user) => acc.add(userLockInfo[user.address].amount.mul(userLockInfo[user.address].lockDuration)),
                    e18(0)
                )
                const expectedAvg = weightedTotal.div(totalSummitLocked)

                const trueAverageLockDuration = await everestGet.avgSummitLockDuration()
                expect(expectedAvg.div(60)).to.equal(trueAverageLockDuration.div(60))
            }
        )
    })
})


describe("EVEREST PANIC", async function() {
    before(async function () {
        const { everestToken, summitToken, user1 } = await oasisUnlockedFixture()

        await everestToken.connect(user1).approve(everestToken.address, INF_APPROVE)
        await summitToken.connect(user1).approve(everestToken.address, INF_APPROVE)
    })
    it('PANIC: Panic recover funds not callable when not in panic mode', async function() {
        const { user1 } = await getNamedSigners(hre)

        await everestMethod.lockSummit({
            user: user1,
            amount: e18(5),
            lockDuration: days(30),
        })

        await everestMethod.panicRecoverFunds({
            user: user1,
            revertErr: ERR.EVEREST.NOT_IN_PANIC
        })
    })
    it('PANIC: Panic can be turned on', async function () {
        const { user1, dev } = await getNamedSigners(hre)

        expect(await everestGet.panic()).to.be.false

        await everestSetParams.setPanic({
            dev: user1,
            panic: true,
            revertErr: ERR.NON_OWNER
        })

        expect(await everestGet.panic()).to.be.false

        await everestSetParams.setPanic({
            dev,
            panic: true,
        })

        expect(await everestGet.panic()).to.be.true

        await everestSetParams.setPanic({
            dev,
            panic: false,
        })

        expect(await everestGet.panic()).to.be.false

        await everestSetParams.setPanic({
            dev,
            panic: true,
        })

        expect(await everestGet.panic()).to.be.true
    })
    it('PANIC: Users can recover their SUMMIT without it maturing in panic mode', async function() {
        const { user1 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()

        const userEverestInfoInit = await everestGet.userEverestInfo(user1.address)
        const userSummitInit = await summitToken.balanceOf(user1.address)
        
        await everestMethod.panicRecoverFunds({
            user: user1,
        })

        const userEverestInfoFinal = await everestGet.userEverestInfo(user1.address)
        const userSummitFinal = await summitToken.balanceOf(user1.address)

        expect(deltaBN(userSummitInit, userSummitFinal)).to.equal(userEverestInfoInit.summitLocked)
        expect(userEverestInfoFinal.summitLocked).to.equal(0)
    })
    it(`PANIC: User facing functions all turn off in panic mode, throwing "${ERR.EVEREST.NOT_AVAILABLE_DURING_PANIC}"`, async function () {
        const { user1 } = await getNamedSigners(hre)

        await everestMethod.lockSummit({
            user: user1,
            amount: e18(1),
            lockDuration: days(30),
            revertErr: ERR.EVEREST.NOT_AVAILABLE_DURING_PANIC,
        })

        await everestMethod.increaseLockDuration({
            user: user1,
            lockDuration: days(30),
            revertErr: ERR.EVEREST.NOT_AVAILABLE_DURING_PANIC,
        })

        await everestMethod.increaseLockedSummit({
            user: user1,
            amount: e18(1),
            revertErr: ERR.EVEREST.NOT_AVAILABLE_DURING_PANIC,
        })

        await everestMethod.withdrawLockedSummit({
            user: user1,
            everestAmount: e18(1),
            revertErr: ERR.EVEREST.NOT_AVAILABLE_DURING_PANIC,
        })
    })
})


describe("EVEREST EXTENSIONS", async function() {
    before(async function () {
        const { everestToken, summitToken, user1 } = await oasisUnlockedFixture()

        await everestToken.connect(user1).approve(everestToken.address, INF_APPROVE)
        await summitToken.connect(user1).approve(everestToken.address, INF_APPROVE)
    })
    it(`EXTENSION: Adding an extension is successful`, async function() {
        const { dev, user1 } = await getNamedSigners(hre)
        const dummyEverestExtension = await getDummyEverestExtension()

        const everestExtensionsInit = await everestGet.getEverestExtensions()
        
        await everestMethod.addEverestExtension({
            dev: user1,
            extension: dummyEverestExtension.address,
            revertErr: ERR.NON_OWNER
        })

        await everestMethod.addEverestExtension({
            dev,
            extension: ZEROADD,
            revertErr: ERR.EVEREST.MISSING_EXTENSION
        })

        await everestMethod.addEverestExtension({
            dev,
            extension: dummyEverestExtension.address,
        })

        await everestMethod.addEverestExtension({
            dev,
            extension: dummyEverestExtension.address,
            revertErr: ERR.EVEREST.EXPEDITION_ALREADY_EXISTS
        })   
        
        const everestExtensionsFinal = await everestGet.getEverestExtensions()

        console.log({
            everestExtensionsInit,
            everestExtensionsFinal,
            dummyEverestExtension: dummyEverestExtension.address
        })

        expect(everestExtensionsInit.includes(dummyEverestExtension.address)).to.be.false
        expect(everestExtensionsInit.length + 1).to.equal(everestExtensionsFinal.length)
        expect(everestExtensionsFinal.includes(dummyEverestExtension.address)).to.be.true
    })
    it(`EXTENSION: Removing an everest extension is successful`, async function() {
        const { dev, user1 } = await getNamedSigners(hre)
        const dummyEverestExtension = await getDummyEverestExtension()

        const everestExtensionsInit = await everestGet.getEverestExtensions()
        
        await everestMethod.removeEverestExtension({
            dev: user1,
            extension: dummyEverestExtension.address,
            revertErr: ERR.NON_OWNER
        })

        await everestMethod.removeEverestExtension({
            dev,
            extension: ZEROADD,
            revertErr: ERR.EVEREST.MISSING_EXTENSION
        })

        await everestMethod.removeEverestExtension({
            dev,
            extension: dummyEverestExtension.address,
        })

        await everestMethod.removeEverestExtension({
            dev,
            extension: dummyEverestExtension.address,
            revertErr: ERR.EVEREST.EXTENSION_DOESNT_EXIST
        })   
        
        const everestExtensionsFinal = await everestGet.getEverestExtensions()

        console.log({
            everestExtensionsInit,
            everestExtensionsFinal,
            dummyEverestExtension: dummyEverestExtension.address
        })

        expect(everestExtensionsInit.includes(dummyEverestExtension.address)).to.be.true
        expect(everestExtensionsInit.length - 1).to.equal(everestExtensionsFinal.length)
        expect(everestExtensionsFinal.includes(dummyEverestExtension.address)).to.be.false
    })
    it(`EXTENSION: Updating user's everest amount updates extension's everest amounts`, async function() {
        const { dev, user1 } = await getNamedSigners(hre)
        const dummyEverestExtension = await getDummyEverestExtension()

        const userDummyExtEverest0 = await dummyEverestExtension.userEverest(user1.address)
        expect(userDummyExtEverest0).to.equal(0)

        // User Lock Summit
        await everestMethod.lockSummit({
            user: user1,
            amount: e18(5),
            lockDuration: days(7)
        })

        // Add Extension
        await everestMethod.addEverestExtension({
            dev,
            extension: dummyEverestExtension.address,
        })
        
        const userDummyExtEverest1 = await dummyEverestExtension.userEverest(user1.address)
        expect(userDummyExtEverest1).to.equal(0)


        // Join Dummy Extension
        const userEverestBalance2 = (await everestGet.userEverestInfo(user1.address)).everestOwned
        await dummyEverestExtension.connect(user1).joinDummyExtension()

        const userDummyExtEverest2 = await dummyEverestExtension.userEverest(user1.address)
        expect(userDummyExtEverest2).to.equal(userEverestBalance2)


        // Increase Lock Duration
        await everestMethod.increaseLockDuration({
            user: user1,
            lockDuration: days(30),
        })
        const userEverestBalance3 = (await everestGet.userEverestInfo(user1.address)).everestOwned
        const userDummyExtEverest3 = await dummyEverestExtension.userEverest(user1.address)
        expect(userDummyExtEverest3).to.equal(userEverestBalance3)


        // Increase Lock Duration
        await everestMethod.increaseLockedSummit({
            user: user1,
            amount: e18(20),
        })
        const userEverestInfo4 = await everestGet.userEverestInfo(user1.address)
        const userEverestBalance4 = userEverestInfo4.everestOwned
        const userDummyExtEverest4 = await dummyEverestExtension.userEverest(user1.address)
        expect(userDummyExtEverest4).to.equal(userEverestBalance4)


        // Withdraw Locked Summit
        const lockMatureTimestamp = userEverestInfo4.lockRelease
        await mineBlockWithTimestamp(lockMatureTimestamp)
        const halfEverestAmount = userEverestBalance4.div(2)
        await everestMethod.withdrawLockedSummit({
            user: user1,
            everestAmount: halfEverestAmount,
        })
        const userEverestBalance5 = (await everestGet.userEverestInfo(user1.address)).everestOwned
        const userDummyExtEverest5 = await dummyEverestExtension.userEverest(user1.address)
        expect(userDummyExtEverest5).to.equal(userEverestBalance5)


        consoleLog({
            Point0: `EverestInfo: ${toDecimal(e18(0))}, Ext: ${toDecimal(userDummyExtEverest0)}`,
            Point1: `EverestInfo: ${toDecimal(e18(0))}, Ext: ${toDecimal(userDummyExtEverest1)}`,
            Point2: `EverestInfo: ${toDecimal(userEverestBalance2)}, Ext: ${toDecimal(userDummyExtEverest2)}`,
            Point3: `EverestInfo: ${toDecimal(userEverestBalance3)}, Ext: ${toDecimal(userDummyExtEverest3)}`,
            Point4: `EverestInfo: ${toDecimal(userEverestBalance4)}, Ext: ${toDecimal(userDummyExtEverest4)}`,
            Point5: `EverestInfo: ${toDecimal(userEverestBalance5)}, Ext: ${toDecimal(userDummyExtEverest5)}`,
        })
    })
})



describe('EVEREST WHITELISTED TRANSFER ADDRESSES', async function() {
    before(async function () {
        const { everestToken, summitToken, user1 } = await oasisUnlockedFixture()

        await everestToken.connect(user1).approve(everestToken.address, INF_APPROVE)
        await summitToken.connect(user1).approve(everestToken.address, INF_APPROVE)
    })
    it('WHITELIST LOCK SUMMIT: Locking SUMMIT is successful', async function() {
        const { user1 } = await getNamedSigners(hre)

        await everestMethod.lockSummit({
            user: user1,
            amount: e18(5),
            lockDuration: days(365)
        })
    })

    it('WHITELIST WITHDRAW SUMMIT: Withdrawing locked SUMMIT is successful', async function() {
        const { user1 } = await getNamedSigners(hre)

        const userEverestInfo = await everestGet.userEverestInfo(user1.address)
        await mineBlockWithTimestamp(userEverestInfo.lockRelease)
        await everestMethod.withdrawLockedSummit({
            user: user1,
            everestAmount: e18(5),
        })
    })

    it(`WHITELIST: Transferring everest to a non-whitelisted address fails with error "Not a whitelisted transfer"`, async function() {
        const { user1, user2 } = await getNamedSigners(hre)

        await erc20Method.transfer({
            user: user1,
            tokenName: Contracts.EverestToken,
            recipientAddress: user2.address,
            amount: e18(1),
            revertErr: 'Not a whitelisted transfer'
        })
    })

    it(`WHITELIST: Adding a whitelisted address is successful`, async function() {
        const { dev, user1, user2 } = await getNamedSigners(hre)

        await everestMethod.addWhitelistedTransferAddress({
            dev: user1,
            whitelistedAddress: user2.address,
            revertErr: ERR.NON_OWNER
        })
        await everestMethod.addWhitelistedTransferAddress({
            dev,
            whitelistedAddress: ZEROADD,
            revertErr: 'Whitelisted Address missing'
        })
        await everestMethod.addWhitelistedTransferAddress({
            dev,
            whitelistedAddress: user2.address,
        })
    })

    it(`WHITELIST: Transferring everest to a whitelisted address should succeed`, async function() {
        const { user1, user2 } = await getNamedSigners(hre)

        await erc20Method.transfer({
            user: user1,
            tokenName: Contracts.EverestToken,
            recipientAddress: user2.address,
            amount: e18(1),
        })
    })
})
