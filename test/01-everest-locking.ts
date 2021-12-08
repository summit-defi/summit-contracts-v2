import { BigNumber } from "@ethersproject/bignumber";
import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { e18, ERR, EVENT, toDecimal, Contracts, INF_APPROVE, getTimestamp, deltaBN, expect6FigBigNumberAllEqual, mineBlockWithTimestamp, e36, EXPEDITION, promiseSequenceMap, expect6FigBigNumberEquals, e12, e0, consoleLog, expectAllEqual, getBifiToken, getCakeToken, getCartographer, getElevationHelper, getEverestToken, getExpedition, getSummitToken, everestGet, everestMethod, days, everestSetParams } from "../utils";
import { userPromiseSequenceMap, userPromiseSequenceReduce } from "../utils/users";
import { oasisUnlockedFixture } from "./fixtures";


const rolloverExpedition = async () => {
    const elevationHelper = await getElevationHelper()
    const expeditionV2 = await getExpedition()
    const cartographer = await getCartographer()

    const expeditionRoundEndTime = (await elevationHelper.roundEndTimestamp(EXPEDITION)).toNumber()
    await mineBlockWithTimestamp(expeditionRoundEndTime)

    await cartographer.rollover(EXPEDITION)
    await expeditionV2.rollover()
}
const rolloverExpeditionMultiRounds = async (roundsToRollover: number) => {
    for (let i = 0; i < roundsToRollover; i++) {
        await rolloverExpedition()
    }
}
const expeditionPrevWinningTotem = async () => {
    const elevationHelper = await getElevationHelper()
    const round = await elevationHelper.roundNumber(EXPEDITION)
    return await elevationHelper.winningTotem(EXPEDITION, round - 1)
}
const _getUserSafeAmount = (everestInfo: any) => {
    return everestInfo.everestOwned.mul(everestInfo.safetyFactor).div(100)
}
const _getUserDeitiedAmount = (everestInfo: any) => {
    return everestInfo.everestOwned.mul(e0(100).sub(everestInfo.safetyFactor)).div(100).mul(120).div(100)
}
const getUserSafeAmount = async (user: SignerWithAddress) => {
    const expeditionV2 = await getExpedition()
    const everestInfo = await everestGet.userEverestInfo(user.address)

    return _getUserSafeAmount(everestInfo)
}
const getUserDeitiedAmount = async (user: SignerWithAddress) => {
    const expeditionV2 = await getExpedition()
    const everestInfo = await everestGet.userEverestInfo(user.address)

    return _getUserDeitiedAmount(everestInfo)
}
const getUserSafeAndDeitiedAmount = async (user: SignerWithAddress) => {
    const expeditionV2 = await getExpedition()
    const everestInfo = await everestGet.userEverestInfo(user.address)
    
    return {
        safe: _getUserSafeAmount(everestInfo),
        deitied: _getUserDeitiedAmount(everestInfo)
    }
}
const expectUserAndExpedSuppliesToMatch = async () => {
    const { user1, user2, user3 } = await getNamedSigners(hre)
    const expeditionV2 = await getExpedition()
    const cakeToken = await getCakeToken()

    const users = [user1, user2, user3]

    const usersEverestInfo = await promiseSequenceMap(
        users,
        async (user) => await everestGet.userEverestInfo(user.address)
    )
    const { safeSupply, deity0Supply, deity1Supply } = usersEverestInfo.reduce((acc, everestInfo) => ({
        safeSupply: acc.safeSupply.add(everestInfo.everestOwned.mul(everestInfo.safetyFactor).div(100)),
        deity0Supply: acc.deity0Supply.add(everestInfo.deity !== 0 ? 0 : _getUserDeitiedAmount(everestInfo)),
        deity1Supply: acc.deity1Supply.add(everestInfo.deity !== 1 ? 0 : _getUserDeitiedAmount(everestInfo)),
    }), { safeSupply: e18(0), deity0Supply: e18(0), deity1Supply: e18(0) })

    const [expedSafeSupply, expedDeitiedSupply, expedDeity0Supply, expedDeity1Supply] = await expeditionV2.supply(cakeToken.address)

    consoleLog({
        SafeSupply: `${toDecimal(expedSafeSupply)} should equal ${toDecimal(safeSupply)}`,
        Deity0Supply: `${toDecimal(expedDeity0Supply)} should equal ${toDecimal(deity0Supply)}`,
        Deity1Supply: `${toDecimal(expedDeity1Supply)} should equal ${toDecimal(deity1Supply)}`,
        DeitiedSupply: `${toDecimal(expedDeitiedSupply)} should equal ${toDecimal(deity0Supply.add(deity1Supply))}`,
    })

    expect(expedSafeSupply).to.equal(safeSupply)
    expect(expedDeity0Supply).to.equal(deity0Supply)
    expect(expedDeity1Supply).to.equal(deity1Supply)
    expect(expedDeitiedSupply).to.equal(deity0Supply.add(deity1Supply))
}

const userSummitBalance = async (user: SignerWithAddress) => {
    return (await (await getSummitToken()).balanceOf(user.address))
}
const userEverestBalance = async (user: SignerWithAddress) => {
    return (await (await getEverestToken()).balanceOf(user.address))
}


describe("EVEREST", async function() {
    before(async function () {
        const { everestToken, summitToken, cakeToken, expeditionV2, user1, user2, user3 } = await oasisUnlockedFixture()

        await everestToken.connect(user1).approve(everestToken.address, INF_APPROVE)
        await everestToken.connect(user2).approve(everestToken.address, INF_APPROVE)
        await everestToken.connect(user3).approve(everestToken.address, INF_APPROVE)

        await summitToken.connect(user1).approve(everestToken.address, INF_APPROVE)
        await summitToken.connect(user2).approve(everestToken.address, INF_APPROVE)
        await summitToken.connect(user3).approve(everestToken.address, INF_APPROVE)

        await cakeToken.connect(user1).approve(expeditionV2.address, INF_APPROVE)
        await cakeToken.connect(user2).approve(expeditionV2.address, INF_APPROVE)
        await cakeToken.connect(user3).approve(expeditionV2.address, INF_APPROVE)
    })


    it(`EVEREST: Locking for invalid lock duration throws error "${ERR.EVEREST.INVALID_LOCK_PERIOD}"`, async function () {
        const { user1 } = await getNamedSigners(hre)

        await everestMethod.lockSummit({
            user: user1,
            amount: e18(1),
            lockPeriod: days(0.5),
            revertErr: ERR.EVEREST.INVALID_LOCK_PERIOD
        })

        await everestMethod.lockSummit({
            user: user1,
            amount: e18(1),
            lockPeriod: days(400),
            revertErr: ERR.EVEREST.INVALID_LOCK_PERIOD
        })
    })
    it(`EVEREST: Locking more than user's balance throws error "${ERR.ERC20.EXCEEDS_BALANCE}"`, async function () {
        const { user1 } = await getNamedSigners(hre)

        await everestMethod.lockSummit({
            user: user1,
            amount: e18(1000000),
            lockPeriod: days(7),
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
            { amount: e18(1), lockPeriod: days(7) }, // USER 1
            { amount: e18(1), lockPeriod: days(30) }, // USER 2
            { amount: e18(1), lockPeriod: days(365) }, // USER 3
        ]

        const userExpectedEverest = await userPromiseSequenceMap(
            async (_, userIndex) => await everestGet.getExpectedEverestAward(lockingData[userIndex].amount, lockingData[userIndex].lockPeriod)
        )
        const userExpectedEverestLockMultiplier = await userPromiseSequenceMap(
            async (_, userIndex) => await everestGet.getLockPeriodMultiplier(lockingData[userIndex].lockPeriod)
        )
        const userSummitInit = await userPromiseSequenceMap(
            async (user) => await userSummitBalance(user)
        )
        const userEverestInit = await userPromiseSequenceMap(
            async (user) => await userEverestBalance(user)
        )



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

        const userSummitFinal = await userPromiseSequenceMap(
            async (user) => await userSummitBalance(user)
        )
        const userEverestFinal = await userPromiseSequenceMap(
            async (user) => await userEverestBalance(user)
        )

        await userPromiseSequenceMap(
            async (_, userIndex) => {
                expect(userEverestInfo[userIndex].everestOwned).to.equal(userExpectedEverest[userIndex])
                expect(userEverestInfo[userIndex].everestLockMultiplier).to.equal(userExpectedEverestLockMultiplier[userIndex])
                expect(userEverestInfo[userIndex].lockRelease).to.equal(userLockTimestamp[userIndex] + lockingData[userIndex].lockPeriod)
                expect(userEverestInfo[userIndex].lockDuration).to.equal(lockingData[userIndex].lockPeriod)
                expect(userEverestInfo[userIndex].summitLocked).to.equal(lockingData[userIndex].amount)


                expect(deltaBN(userSummitInit[userIndex], userSummitFinal[userIndex])).to.equal(lockingData[userIndex].amount)
                expect(deltaBN(userEverestInit[userIndex], userEverestFinal[userIndex])).to.equal(userExpectedEverest[userIndex])
            }
        )
    })

    it(`INCREASE EVEREST: User with already locked summit cannot do another initial lock, or throws "${ERR.EVEREST.ALREADY_LOCKING_SUMMIT}"`, async function () {
        const { user1 } = await getNamedSigners(hre)
        const expeditionV2 = await getExpedition()

        await everestMethod.lockSummit({
            user: user1,
            amount: e18(5),
            lockPeriod: days(300),
            revertErr: ERR.EVEREST.ALREADY_LOCKING_SUMMIT
        })
    })

    it(`INCREASE EVEREST: User with already locked summit should be able to lock more summit`, async function() {
        const { user1 } = await getNamedSigners(hre)
        
        const userSummitInit = await userSummitBalance(user1)
        const userEverestInit = await userEverestBalance(user1)
        const everestInfoInit = await everestGet.userEverestInfo(user1.address)

        const userSummitAmount = e18(5)
        const userSummitLockPeriod = days(7)
        
        const userExpectedEverest = await everestGet.getExpectedEverestAward(userSummitAmount, userSummitLockPeriod)

        consoleLog({
            user1ExpectedEverest: toDecimal(userExpectedEverest),
        })

        await everestMethod.increaseLockedSummit({
            user: user1,
            amount: userSummitAmount,
        })

        const userSummitFinal = await userSummitBalance(user1)
        const userEverestFinal = await userEverestBalance(user1)
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
        const everestInit = await userEverestBalance(user1)
        const summitInit = await userSummitBalance(user1)
        expect(halfEverestAmount).to.equal(everestInit.div(2))

        // WITHDRAW HALF
        const expectedSummitWithdrawal1 = everestInfoInit.summitLocked.div(2)

        await everestMethod.withdrawLockedSummit({
            user: user1,
            everestAmount: halfEverestAmount,
        })

        const everestInfoMid = await everestGet.userEverestInfo(user1.address)
        const everestMid = await userEverestBalance(user1)
        const summitMid = await userSummitBalance(user1)

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
        const everestFinal = await userEverestBalance(user1)
        const summitFinal = await userSummitBalance(user1)

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
        const { everestToken, summitToken, expeditionV2, user1, user2, user3 } = await oasisUnlockedFixture()

        await everestToken.connect(user1).approve(expeditionV2.address, INF_APPROVE)
        await everestToken.connect(user2).approve(expeditionV2.address, INF_APPROVE)
        await everestToken.connect(user3).approve(expeditionV2.address, INF_APPROVE)

        await summitToken.connect(user1).approve(expeditionV2.address, INF_APPROVE)
        await summitToken.connect(user2).approve(expeditionV2.address, INF_APPROVE)
        await summitToken.connect(user3).approve(expeditionV2.address, INF_APPROVE)
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
                    lockPeriod: userLockInfo[user.address].lockDuration,
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
                console.log({
                    expected: expectedAvg,
                    contract: trueAverageLockDuration,
                    drift: Math.abs(expectedAvg - trueAverageLockDuration),
                })
                expect(expectedAvg.div(60)).to.equal(trueAverageLockDuration.div(60))
            }
        )
    })
})


describe("EVEREST PANIC", async function() {
    before(async function () {
        const { everestToken, summitToken, expeditionV2, user1, user2, user3 } = await oasisUnlockedFixture()

        await everestToken.connect(user1).approve(expeditionV2.address, INF_APPROVE)
        await summitToken.connect(user1).approve(expeditionV2.address, INF_APPROVE)
    })
    it('PANIC: Panic recover funds not callable when not in panic mode', async function() {
        const { user1 } = await getNamedSigners(hre)

        await everestMethod.lockSummit({
            user: user1,
            amount: e18(5),
            lockPeriod: days(30),
        })

        await everestMethod.panicRecoverFunds({
            user: user1,
            revertErr: ERR.EVEREST.NOT_IN_PANIC_MODE
        })
    })
    it('PANIC: Panic can be turned on', async function () {
        const { dev } = await getNamedSigners(hre)
        await everestSetParams.panicReleaseLocking({
            dev,
            releaseLockedSummit: true
        })
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
})
