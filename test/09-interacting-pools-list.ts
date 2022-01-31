import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre from "hardhat";
import { e18, ERR, toDecimal, getTimestamp, deltaBN, mineBlockWithTimestamp, promiseSequenceMap, getSummitToken, everestGet, everestMethod, days, getSummitBalance, getEverestBalance, userPromiseSequenceMap, allElevationPromiseSequenceMap, cartographerMethod, rolloverRoundUntilWinningTotem, getUserTotems, OASIS, getCakeToken, getBifiToken, epochDuration, getSummitGlacier, rolloverIfAvailable, rolloverRound, sumBigNumbers, tokenPromiseSequenceMap, cartographerGet, expect6FigBigNumberEquals, BURNADD, expectAllEqual, usersInteractingPoolsLists, subCartGet, onlyElevationPromiseSequenceMap, getInvUserTotems } from "../utils";
import { summitGlacierGet, summitGlacierMethod } from "../utils/summitGlacierUtils";
import { oasisUnlockedFixture, summitUnlockedFixture } from "./fixtures";



describe("INTERACTING POOLS LIST", async function() {
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

    it(`INTERACTING POOLS: Oasis deposits updates interacting pools correctly`, async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()
        const cakeToken = await getCakeToken()
        const bifiToken = await getBifiToken()

        const usersPoolInteractions = {
            [user1.address]: [summitToken.address, cakeToken.address, bifiToken.address],
            [user2.address]: [cakeToken.address, bifiToken.address, summitToken.address],
            [user3.address]: [bifiToken.address, summitToken.address, cakeToken.address],
        }

        await userPromiseSequenceMap(
            async (user) => {
                await promiseSequenceMap(
                    usersPoolInteractions[user.address],
                    async (tokenAddress) => {
                        const interactingInit = await subCartGet.getUserInteractingPools(OASIS, user.address)
                        expect(interactingInit.includes(tokenAddress)).to.be.false

                        await cartographerMethod.deposit({
                            user,
                            tokenAddress,
                            elevation: OASIS,
                            amount: e18(1),
                        })

                        const interactingFinal = await subCartGet.getUserInteractingPools(OASIS, user.address)
                        expect(interactingFinal.includes(tokenAddress)).to.be.true
                    }
                )
            }
        )
    })

    it(`INTERACTING POOLS: Oasis withdrawals updates interacting pools correctly`, async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()
        const cakeToken = await getCakeToken()
        const bifiToken = await getBifiToken()

        const usersPoolInteractions = {
            [user1.address]: [summitToken.address, cakeToken.address, bifiToken.address],
            [user2.address]: [cakeToken.address, bifiToken.address, summitToken.address],
            [user3.address]: [bifiToken.address, summitToken.address, cakeToken.address],
        }

        await userPromiseSequenceMap(
            async (user) => {
                await promiseSequenceMap(
                    usersPoolInteractions[user.address],
                    async (tokenAddress) => {
                        const interactingInit = await subCartGet.getUserInteractingPools(OASIS, user.address)
                        expect(interactingInit.includes(tokenAddress)).to.be.true

                        await cartographerMethod.withdraw({
                            user,
                            tokenAddress,
                            elevation: OASIS,
                            amount: e18(0.5),
                        })

                        const interactingMid = await subCartGet.getUserInteractingPools(OASIS, user.address)
                        expect(interactingMid.includes(tokenAddress)).to.be.true

                        await cartographerMethod.withdraw({
                            user,
                            tokenAddress,
                            elevation: OASIS,
                            amount: e18(0.5),
                        })

                        const interactingFinal = await subCartGet.getUserInteractingPools(OASIS, user.address)
                        expect(interactingFinal.includes(tokenAddress)).to.be.false
                    }
                )
            }
        )
    })

    it('ELEVATION INTERACTING POOLS: Deposit should guarantee interaction', async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()
        const cakeToken = await getCakeToken()
        const bifiToken = await getBifiToken()

        const usersPoolInteractions = {
            [user1.address]: [summitToken.address, cakeToken.address, bifiToken.address],
            [user2.address]: [cakeToken.address, bifiToken.address, summitToken.address],
            [user3.address]: [bifiToken.address, summitToken.address, cakeToken.address],
        }

        await onlyElevationPromiseSequenceMap(
            async (elevation) => {
                await userPromiseSequenceMap(
                    async (user) => {
                        await promiseSequenceMap(
                            usersPoolInteractions[user.address],
                            async (tokenAddress) => {
                                const interactingInit = await subCartGet.getUserInteractingPools(elevation, user.address)
                                expect(interactingInit.includes(tokenAddress)).to.be.false
        
                                await cartographerMethod.deposit({
                                    user,
                                    tokenAddress,
                                    elevation,
                                    amount: e18(1),
                                })
        
                                const interactingFinal = await subCartGet.getUserInteractingPools(elevation, user.address)
                                expect(interactingFinal.includes(tokenAddress)).to.be.true
                            }
                        )
                    }
                )
            }
        )
    })
    it('ELEVATION INTERACTING POOLS: Emergency Withdraw should guarantee no interaction', async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()
        const cakeToken = await getCakeToken()
        const bifiToken = await getBifiToken()

        const usersPoolInteractions = {
            [user1.address]: [summitToken.address, cakeToken.address, bifiToken.address],
            [user2.address]: [cakeToken.address, bifiToken.address, summitToken.address],
            [user3.address]: [bifiToken.address, summitToken.address, cakeToken.address],
        }

        await onlyElevationPromiseSequenceMap(
            async (elevation) => {
                await userPromiseSequenceMap(
                    async (user) => {
                        await promiseSequenceMap(
                            usersPoolInteractions[user.address],
                            async (tokenAddress) => {
                                const interactingInit = await subCartGet.getUserInteractingPools(elevation, user.address)
                                expect(interactingInit.includes(tokenAddress)).to.be.true
        
                                await cartographerMethod.emergencyWithdraw({
                                    user,
                                    tokenAddress,
                                    elevation,
                                })
        
                                const interactingFinal = await subCartGet.getUserInteractingPools(elevation, user.address)
                                expect(interactingFinal.includes(tokenAddress)).to.be.false
                            }
                        )
                    }
                )
            }
        )
    })
    it('ELEVATION INTERACTING POOLS: Withdraw should not exit immediately, only after following round claim', async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()
        const cakeToken = await getCakeToken()
        const bifiToken = await getBifiToken()

        const usersPoolInteractions = {
            [user1.address]: [summitToken.address, cakeToken.address, bifiToken.address],
            [user2.address]: [cakeToken.address, bifiToken.address, summitToken.address],
            [user3.address]: [bifiToken.address, summitToken.address, cakeToken.address],
        }

        await onlyElevationPromiseSequenceMap(
            async (elevation) => {
                await userPromiseSequenceMap(
                    async (user) => {
                        await promiseSequenceMap(
                            usersPoolInteractions[user.address],
                            async (tokenAddress) => {
                                const interactingInit = await subCartGet.getUserInteractingPools(elevation, user.address)
                                expect(interactingInit.includes(tokenAddress)).to.be.false
        
                                await cartographerMethod.deposit({
                                    user,
                                    tokenAddress,
                                    elevation,
                                    amount: e18(1),
                                })
        
                                const interactingFinal = await subCartGet.getUserInteractingPools(elevation, user.address)
                                expect(interactingFinal.includes(tokenAddress)).to.be.true
                            }
                        )
                    }
                )
            }
        )

        const timestamp = await getTimestamp()
        await mineBlockWithTimestamp(timestamp + 200)

        await onlyElevationPromiseSequenceMap(
            async (elevation) => {
                await userPromiseSequenceMap(
                    async (user) => {
                        await promiseSequenceMap(
                            usersPoolInteractions[user.address],
                            async (tokenAddress) => {
                                const interactingInit = await subCartGet.getUserInteractingPools(elevation, user.address)
                                expect(interactingInit.includes(tokenAddress)).to.be.true
        
                                await cartographerMethod.withdraw({
                                    user,
                                    tokenAddress,
                                    elevation,
                                    amount: e18(1)
                                })
        
                                const interactingFinal = await subCartGet.getUserInteractingPools(elevation, user.address)
                                expect(interactingFinal.includes(tokenAddress)).to.be.true
                            }
                        )
                    }
                )
            }
        )

        await onlyElevationPromiseSequenceMap(
            async (elevation) => {
                await rolloverRound(elevation)
                await userPromiseSequenceMap(
                    async (user) => {
                        await promiseSequenceMap(
                            usersPoolInteractions[user.address],
                            async (tokenAddress) => {
                                const interactingInit = await subCartGet.getUserInteractingPools(elevation, user.address)
                                expect(interactingInit.includes(tokenAddress)).to.be.true
        
                                await cartographerMethod.claimSingleFarm({
                                    user,
                                    tokenAddress,
                                    elevation,
                                })
        
                                const interactingFinal = await subCartGet.getUserInteractingPools(elevation, user.address)
                                expect(interactingFinal.includes(tokenAddress)).to.be.false
                            }
                        )
                    }
                )
            }
        )
    })
    it('ELEVATION INTERACTING POOLS: Claim Elevation should exit all farms with nothing staked', async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()
        const cakeToken = await getCakeToken()
        const bifiToken = await getBifiToken()

        const usersPoolInteractions = {
            [user1.address]: [summitToken.address, cakeToken.address, bifiToken.address],
            [user2.address]: [cakeToken.address, bifiToken.address, summitToken.address],
            [user3.address]: [bifiToken.address, summitToken.address, cakeToken.address],
        }
        const usersExitingPools = {
            [user1.address]: [bifiToken.address],
            [user2.address]: [cakeToken.address, summitToken.address],
            [user3.address]: [bifiToken.address, summitToken.address, cakeToken.address],
        }

        await onlyElevationPromiseSequenceMap(
            async (elevation) => {
                await userPromiseSequenceMap(
                    async (user) => {
                        await promiseSequenceMap(
                            usersPoolInteractions[user.address],
                            async (tokenAddress) => {
                                const staked = (await subCartGet.userInfo(tokenAddress, elevation, user.address)).staked
                                if (staked.gt(0)) {
                                    await cartographerMethod.emergencyWithdraw({
                                        user,
                                        tokenAddress,
                                        elevation
                                    })
                                }

                                const interactingInit = await subCartGet.getUserInteractingPools(elevation, user.address)
                                expect(interactingInit.includes(tokenAddress)).to.be.false
        
                                await cartographerMethod.deposit({
                                    user,
                                    tokenAddress,
                                    elevation,
                                    amount: e18(1),
                                })
        
                                const interactingFinal = await subCartGet.getUserInteractingPools(elevation, user.address)
                                expect(interactingFinal.includes(tokenAddress)).to.be.true
                            }
                        )
                    }
                )
            }
        )

        const timestamp = await getTimestamp()
        await mineBlockWithTimestamp(timestamp + 200)

        await onlyElevationPromiseSequenceMap(
            async (elevation) => {
                await userPromiseSequenceMap(
                    async (user) => {
                        await promiseSequenceMap(
                            usersExitingPools[user.address],
                            async (tokenAddress) => {
                                const interactingInit = await subCartGet.getUserInteractingPools(elevation, user.address)
                                expect(interactingInit.includes(tokenAddress)).to.be.true
        
                                await cartographerMethod.withdraw({
                                    user,
                                    tokenAddress,
                                    elevation,
                                    amount: e18(1)
                                })
        
                                const interactingFinal = await subCartGet.getUserInteractingPools(elevation, user.address)
                                expect(interactingFinal.includes(tokenAddress)).to.be.true
                            }
                        )
                    }
                )
            }
        )

        await onlyElevationPromiseSequenceMap(
            async (elevation) => {
                await rolloverRound(elevation)

                await userPromiseSequenceMap(
                    async (user) => {
                        await cartographerMethod.claimElevation({
                            user,
                            elevation,
                        })

                        await promiseSequenceMap(
                            usersPoolInteractions[user.address],
                            async (tokenAddress) => {
                                const interactingInit = await subCartGet.getUserInteractingPools(elevation, user.address)
                                if (usersExitingPools[user.address].includes(tokenAddress)) {
                                    expect(interactingInit.includes(tokenAddress)).to.be.false
                                } else {
                                    expect(interactingInit.includes(tokenAddress)).to.be.true
                                }
                            }
                        )
                    }
                )
            }
        )
    })
    it('ELEVATION INTERACTING POOLS: Switch Totem should exit all farms with nothing staked', async function() {
        const { user1, user2, user3 } = await getNamedSigners(hre)
        const summitToken = await getSummitToken()
        const cakeToken = await getCakeToken()
        const bifiToken = await getBifiToken()
        const invUserTotems = await getInvUserTotems()

        const usersPoolInteractions = {
            [user1.address]: [summitToken.address, cakeToken.address, bifiToken.address],
            [user2.address]: [cakeToken.address, bifiToken.address, summitToken.address],
            [user3.address]: [bifiToken.address, summitToken.address, cakeToken.address],
        }
        const usersExitingPools = {
            [user1.address]: [cakeToken.address],
            [user2.address]: [summitToken.address, bifiToken.address],
            [user3.address]: [bifiToken.address, summitToken.address, cakeToken.address],
        }

        await onlyElevationPromiseSequenceMap(
            async (elevation) => {
                await userPromiseSequenceMap(
                    async (user) => {
                        await promiseSequenceMap(
                            usersPoolInteractions[user.address],
                            async (tokenAddress) => {
                                const staked = (await subCartGet.userInfo(tokenAddress, elevation, user.address)).staked
                                if (staked.gt(0)) {
                                    await cartographerMethod.emergencyWithdraw({
                                        user,
                                        tokenAddress,
                                        elevation
                                    })
                                }

                                const interactingInit = await subCartGet.getUserInteractingPools(elevation, user.address)
                                expect(interactingInit.includes(tokenAddress)).to.be.false
        
                                await cartographerMethod.deposit({
                                    user,
                                    tokenAddress,
                                    elevation,
                                    amount: e18(1),
                                })
        
                                const interactingFinal = await subCartGet.getUserInteractingPools(elevation, user.address)
                                expect(interactingFinal.includes(tokenAddress)).to.be.true
                            }
                        )
                    }
                )
            }
        )

        const timestamp = await getTimestamp()
        await mineBlockWithTimestamp(timestamp + 200)

        await onlyElevationPromiseSequenceMap(
            async (elevation) => {
                await userPromiseSequenceMap(
                    async (user) => {
                        await promiseSequenceMap(
                            usersExitingPools[user.address],
                            async (tokenAddress) => {
                                const interactingInit = await subCartGet.getUserInteractingPools(elevation, user.address)
                                expect(interactingInit.includes(tokenAddress)).to.be.true
        
                                await cartographerMethod.withdraw({
                                    user,
                                    tokenAddress,
                                    elevation,
                                    amount: e18(1)
                                })
        
                                const interactingFinal = await subCartGet.getUserInteractingPools(elevation, user.address)
                                expect(interactingFinal.includes(tokenAddress)).to.be.true
                            }
                        )
                    }
                )
            }
        )

        await onlyElevationPromiseSequenceMap(
            async (elevation) => {
                await rolloverRound(elevation)

                await userPromiseSequenceMap(
                    async (user) => {
                        await cartographerMethod.switchTotem({
                            user,
                            elevation,
                            totem: invUserTotems[user.address]
                        })

                        await promiseSequenceMap(
                            usersPoolInteractions[user.address],
                            async (tokenAddress) => {
                                const interactingInit = await subCartGet.getUserInteractingPools(elevation, user.address)
                                if (usersExitingPools[user.address].includes(tokenAddress)) {
                                    expect(interactingInit.includes(tokenAddress)).to.be.false
                                } else {
                                    expect(interactingInit.includes(tokenAddress)).to.be.true
                                }
                            }
                        )
                    }
                )
            }
        )
    })
})