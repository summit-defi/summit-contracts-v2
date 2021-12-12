import { PLAINS, MESA, SUMMIT, elevationTests, passthroughTests, SubCartographer, cartographerSetParam, Contracts } from "..";
import { fiveThousandUnlockedFixture, tenThousandUnlockedFixture, twoThousandUnlockedFixture } from "../../test/fixtures";

const getElevationDiffedVariables = (elevation: number) => {
    switch (elevation) {
        case SUMMIT:
            return {
                fixture: tenThousandUnlockedFixture,
                meters: '10K',
                onlyTwoPoolTests: true,
            }
        case MESA:
            return {
                fixture: fiveThousandUnlockedFixture,
                meters: '5K',
                onlyTwoPoolTests: true,
            }
        default:
        case PLAINS:
            return {
                fixture: twoThousandUnlockedFixture,
                meters: '2K',
                onlyTwoPoolTests: false,
            }
    }
}

describe("ELEVATION FARMING", function() {
    [PLAINS, MESA, SUMMIT].forEach(async(elevation) => {
        const {
            fixture,
            meters,
            onlyTwoPoolTests,
        } = getElevationDiffedVariables(elevation)
        describe(`- ${meters} ELEVATION`, async function() {
            describe('- Elevation Farming Tests', async function() {
                before(async function() {
                    const { dev, summitToken, cakeToken, bifiToken } = await fixture()
                    await cartographerSetParam.setTokenIsNativeFarm({
                        dev,
                        tokenAddress: summitToken.address,
                        tokenIsNativeFarm: true
                    })

                    await cartographerSetParam.setTokenDepositFee({
                        dev,
                        tokenAddress: summitToken.address,
                        feeBP: 0
                    })
                    await cartographerSetParam.setTokenDepositFee({
                        dev,
                        tokenAddress: cakeToken.address,
                        feeBP: 100
                    })
                    await cartographerSetParam.setTokenDepositFee({
                        dev,
                        tokenAddress: bifiToken.address,
                        feeBP: 100
                    })

                    await cartographerSetParam.setTokenWithdrawTax({
                        dev,
                        tokenAddress: summitToken.address,
                        taxBP: 700
                    })
                    await cartographerSetParam.setTokenWithdrawTax({
                        dev,
                        tokenAddress: cakeToken.address,
                        taxBP: 700
                    })
                    await cartographerSetParam.setTokenWithdrawTax({
                        dev,
                        tokenAddress: bifiToken.address,
                        taxBP: 700
                    })
                })

                elevationTests.totemTests(Contracts.SummitToken, elevation)

                elevationTests.standardDepositShouldSucceed(Contracts.SummitToken, elevation)
                elevationTests.depositShouldUpdatePoolAndTotemInfo(Contracts.SummitToken, elevation)
                elevationTests.elevationPoolRewardsShouldIncreaseEachBlock(Contracts.SummitToken, elevation)

                if (!onlyTwoPoolTests) {
                    elevationTests.vestedWinningsIncreaseOverDurationOfRound(Contracts.SummitToken, elevation)
                    elevationTests.winningsMatchHypotheticalWinnings(Contracts.SummitToken, elevation)

                    elevationTests.withdrawingVestedWinningsRevestsRemaining(Contracts.SummitToken, elevation)
                    elevationTests.winningsVestAndAccumulateOverMultipleRounds(Contracts.SummitToken, elevation)

                    elevationTests.rolloverMultipleRounds(Contracts.SummitToken, elevation)
                    elevationTests.switchingTotems(Contracts.SummitToken, elevation)

                }

                elevationTests.correctWinnersHistoricalData(Contracts.SummitToken, elevation)

            })

            describe('- Totem In Use', async function() {
                before(async function() {
                    await fixture()
                })

                elevationTests.initialTotemInUseShouldBeFalse(elevation)
                elevationTests.totemInUseShouldUpdateOnDeposit(Contracts.SummitToken, elevation)
                elevationTests.totemInUseShouldPreventIncorrectPondDeposit(Contracts.SummitToken, elevation)
                elevationTests.withdrawToZeroShouldUpdateTotemInUse(Contracts.SummitToken, elevation)
            })

            describe('- Elevation Passthrough Staking', async function() {
                before(async function() {
                    await fixture()
                })

                passthroughTests.vaultTests(passthroughPid, passthroughPoolFee)
                passthroughTests.switchPassthroughStrategyVaultToMasterChef(passthroughPid, passthroughPoolFee)
                passthroughTests.masterChefTests(passthroughPid, passthroughPoolFee)
                passthroughTests.switchPassthroughStrategyMasterChefToVault(passthroughPid)
            })
        })
    })
})
