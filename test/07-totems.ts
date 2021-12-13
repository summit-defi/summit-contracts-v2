import { getNamedSigner, getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import hre from 'hardhat'
import { expect } from "chai"
import { userPromiseSequenceMap, allElevationPromiseSequenceMap, cartographerMethod, getUserTotems, usersTotemInfos, OASIS, elevationHelperGet, mineBlockWithTimestamp, PLAINS, rolloverRound, subCartGet, ERR, e18, getSummitToken } from "../utils";
import { oasisUnlockedFixture, twoThousandUnlockedFixture } from "./fixtures";



describe("TOTEMS", async function() {
    describe("TOTEM PRE SELECTION", async function() {
        before(async function () {
            const { user1 } = await oasisUnlockedFixture()
        })
        it('TOTEM SELECTION: Totems can be selected before elevation unlocks', async function() {
            const userTotems = await getUserTotems()

            await allElevationPromiseSequenceMap(
                async (elevation) => {
                    if (elevation === OASIS) return

                    const usersTotemInfosInit = await usersTotemInfos(elevation)

                    await userPromiseSequenceMap(
                        async (user, userIndex) => {
                            expect(usersTotemInfosInit[userIndex].totem).to.equal(0)
                            expect(usersTotemInfosInit[userIndex].totemSelected).to.equal(false)
                            expect(usersTotemInfosInit[userIndex].totemSelectionRound).to.equal(0)
                        }
                    )

                    // Select Totem
                    await userPromiseSequenceMap(
                        async (user) => await cartographerMethod.switchTotem({
                            user,
                            elevation,
                            totem: userTotems[user.address]
                        })
                    )

                    const usersTotemInfosFinal = await usersTotemInfos(elevation)
                    await userPromiseSequenceMap(
                        async (user, userIndex) => {
                            expect(usersTotemInfosFinal[userIndex].totem).to.equal(userTotems[user.address])
                            expect(usersTotemInfosFinal[userIndex].totemSelected).to.equal(true)
                            expect(usersTotemInfosFinal[userIndex].totemSelectionRound).to.equal(0)
                        }
                    )
                }
            )
        })
        it('TOTEM SELECTION: Switching totems updates users totem selection round', async function() {
            const { user1 } = await getNamedSigners(hre)

            const twoThousandUnlockTime = await elevationHelperGet.unlockTimestamp(PLAINS)
            await mineBlockWithTimestamp(twoThousandUnlockTime)
            await rolloverRound(PLAINS)
            await rolloverRound(PLAINS)

            const currentRound = await elevationHelperGet.roundNumber(PLAINS)

            await cartographerMethod.switchTotem({
                user: user1,
                elevation: PLAINS,
                totem: 1,
            })

            const userTotemInfo = await subCartGet.userTotemInfo(PLAINS, user1.address)

            expect(userTotemInfo.totem).to.equal(1)
            expect(userTotemInfo.totemSelected).to.equal(true)
            expect(userTotemInfo.totemSelectionRound).to.equal(currentRound)
        })
    })
    describe("TOTEM SELECTION BEFORE DEPOSIT", async function() {
        before(async function () {
            await twoThousandUnlockedFixture()
        })
        it('TOTEM SELECTION: Totems must be selected before deposit is allowed', async function() {
            const { user1 } = await getNamedSigners(hre)
            const summitToken = await getSummitToken()

            await cartographerMethod.deposit({
                user: user1,
                tokenAddress: summitToken.address,
                elevation: PLAINS,
                amount: e18(5),
                revertErr: ERR.TOTEM_MUST_BE_SELECTED
            })

            await cartographerMethod.switchTotem({
                user: user1,
                elevation: PLAINS,
                totem: 0
            })

            await cartographerMethod.deposit({
                user: user1,
                tokenAddress: summitToken.address,
                elevation: PLAINS,
                amount: e18(5),
            })
        })
    })
})