import { PID, POOL_FEE, TWOTHOUSAND, FIVETHOUSAND, TENTHOUSAND, elevationTests, passthroughTests, SubCartographer } from "../utils";
import { fiveThousandUnlockedFixture, tenThousandUnlockedFixture, twoThousandUnlockedFixture } from "./fixtures";

const getElevationDiffedVariables = (elevation: number) => {
    switch (elevation) {
        case TENTHOUSAND:
            return {
                fixture: tenThousandUnlockedFixture,
                meters: '10K',
                onlyTwoPoolTests: true,
                summitPid: PID.SUMMIT_10K,
                passthroughPid: PID.DUMMY_BIFI_10K,
                passthroughPoolFee: POOL_FEE.DUMMY_BIFI_10K,
            }
        case FIVETHOUSAND:
            return {
                fixture: fiveThousandUnlockedFixture,
                meters: '5K',
                onlyTwoPoolTests: true,
                summitPid: PID.SUMMIT_5K,
                passthroughPid: PID.DUMMY_BIFI_5K,
                passthroughPoolFee: POOL_FEE.DUMMY_BIFI_5K,
            }
        default:
        case TWOTHOUSAND:
            return {
                fixture: twoThousandUnlockedFixture,
                meters: '2K',
                onlyTwoPoolTests: false,
                summitPid: PID.SUMMIT_2K,
                passthroughPid: PID.DUMMY_BIFI_2K,
                passthroughPoolFee: POOL_FEE.DUMMY_BIFI_2K,
            }
    }
}

describe("ELEVATION FARMING", function() {
    [TWOTHOUSAND, FIVETHOUSAND, TENTHOUSAND].forEach(async(elevation) => {
        const {
            fixture,
            meters,
            onlyTwoPoolTests,
            summitPid,
            passthroughPid,
            passthroughPoolFee,
        } = getElevationDiffedVariables(elevation)
        describe(`- ${meters} ELEVATION`, async function() {
            describe('- Elevation Farming Tests', async function() {
                before(async function() {
                    await fixture()
                })
            
                elevationTests.standardDepositShouldSucceed(SubCartographer.ELEVATION, summitPid, 0)
                elevationTests.depositShouldUpdatePoolAndTotemInfo(SubCartographer.ELEVATION, summitPid)
                elevationTests.validTotemDepositShouldSucceed(SubCartographer.ELEVATION, summitPid)
                elevationTests.invalidTotemDepositShouldFail(SubCartographer.ELEVATION, summitPid)
                elevationTests.depositToDifferentTotemShouldFail(SubCartographer.ELEVATION, summitPid)
                elevationTests.elevationPoolRewardsShouldIncreaseEachBlock(SubCartographer.ELEVATION, summitPid)
                
                if (!onlyTwoPoolTests) {
                    elevationTests.vestedWinningsIncreaseOverDurationOfRound(SubCartographer.ELEVATION, summitPid)
                    elevationTests.winningsMatchHypotheticalWinnings(SubCartographer.ELEVATION, summitPid)
                
                    elevationTests.withdrawingVestedWinningsRevestsRemaining(SubCartographer.ELEVATION, summitPid)
                    elevationTests.winningsVestAndAccumulateOverMultipleRounds(SubCartographer.ELEVATION, summitPid)
                
                    elevationTests.rolloverMultipleRounds(SubCartographer.ELEVATION, summitPid)
                    elevationTests.switchingTotems(SubCartographer.ELEVATION, "SummitToken", summitPid, elevation)

                }
            
                elevationTests.correctWinnersHistoricalData(SubCartographer.ELEVATION, summitPid)

            })

            describe('- Totem In Use', async function() {
                before(async function() {
                    await fixture()
                })

                elevationTests.initialTotemInUseShouldBeFalse(elevation)
                elevationTests.totemInUseShouldUpdateOnDeposit(summitPid, elevation)
                elevationTests.totemInUseShouldPreventIncorrectPondDeposit(summitPid, elevation)
                elevationTests.withdrawToZeroShouldUpdateTotemInUse(SubCartographer.ELEVATION, summitPid, elevation)
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
