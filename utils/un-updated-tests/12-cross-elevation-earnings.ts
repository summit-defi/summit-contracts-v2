import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import hre, { ethers } from "hardhat";
import { Contracts, PID, e18, rolloverRoundUntilWinningTotem, toDecimal, rolloverRound, deltaBN, expect6FigBigNumberAllEqual, rolloverRoundUntilLosingTotem, consoleLog } from "../utils";
import { twoThousandUnlockedFixture } from "./fixtures";


describe("Cross Elevation Winnings", function() {
  before(async function() {
      await twoThousandUnlockedFixture()
  })
  it(`WINNINGS: Winnings are earned and shared across elevation at the end of rounds`, async function() {
    const { user1, user2 } = await getNamedSigners(hre)
    const cartographer = await getCartographer()
    const cartographerElevation = await ethers.getContract(Contracts.CartographerElevation)
    const elevationHelper = await getElevationHelper()


    // INDIVIDUAL WINNINGS

    
    // BASELINE USER 1
    await cartographer.connect(user1).deposit(PID.SUMMIT_2K, e18(5), 0, 0)

    await rolloverRound(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, PID.SUMMIT_2K)
    const [user1BaselineHarvestableInit, user1BaselineVestingInit] = await cartographer.connect(user1).rewards(PID.SUMMIT_2K, user1.address)
    const user1BaselineWinningsInit = user1BaselineHarvestableInit.add(user1BaselineVestingInit)

    await rolloverRoundUntilWinningTotem(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, PID.SUMMIT_2K, 0)
    const [user1BaselineHarvestableFinal, user1BaselineVestingFinal] = await cartographer.connect(user1).rewards(PID.SUMMIT_2K, user1.address)
    const user1BaselineWinningsFinal = user1BaselineHarvestableFinal.add(user1BaselineVestingFinal)
    const user1BaselineWinnings = user1BaselineWinningsFinal.sub(user1BaselineWinningsInit)
    
    
    // BASELINE USER 2
    await cartographer.connect(user1).withdraw(PID.SUMMIT_2K, e18(5), 0) // Remove deposited from user 1
    await cartographer.connect(user2).deposit(PID.DUMMY_BIFI_2K, e18(5), 0, 1)

    await rolloverRound(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, PID.SUMMIT_2K)
    const [user2BaselineHarvestableInit, user2BaselineVestingInit] = await cartographer.connect(user2).rewards(PID.DUMMY_BIFI_2K, user2.address)
    const user2BaselineWinningsInit = user2BaselineHarvestableInit.add(user2BaselineVestingInit)

    await rolloverRoundUntilWinningTotem(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, PID.DUMMY_BIFI_2K, 1)
    const [user2BaselineHarvestableFinal, user2BaselineVestingFinal] = await cartographer.connect(user2).rewards(PID.DUMMY_BIFI_2K, user2.address)
    const user2BaselineWinningsFinal = user2BaselineHarvestableFinal.add(user2BaselineVestingFinal)
    const user2BaselineWinnings = user2BaselineWinningsFinal.sub(user2BaselineWinningsInit)

    consoleLog({
        user1: toDecimal(user1BaselineWinnings),
        user2: toDecimal(user2BaselineWinnings),
        combined: toDecimal(user1BaselineWinnings.add(user2BaselineWinnings)),
    })


    // COMBINED WINNINGS


    // USER 1 wins rewards of USER 2
    await cartographer.connect(user1).deposit(PID.SUMMIT_2K, e18(5), 0, 0)
    await rolloverRoundUntilLosingTotem(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, PID.SUMMIT_2K, 0)
    const [user1HarvestableInit, user1VestingInit] = await cartographer.connect(user1).rewards(PID.SUMMIT_2K, user1.address)
    const user1WinningsInit = user1HarvestableInit.add(user1VestingInit)
    
    await rolloverRoundUntilWinningTotem(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, PID.SUMMIT_2K, 0)
    
    const [user1HarvestableFinal, user1VestingFinal] = await cartographer.connect(user1).rewards(PID.SUMMIT_2K, user1.address)
    const user1WinningsFinal = user1HarvestableFinal.add(user1VestingFinal)


    // USER 2 wins rewards of USER 1
    await rolloverRoundUntilLosingTotem(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, PID.DUMMY_BIFI_2K, 1)
    const [user2HarvestableInit, user2VestingInit] = await cartographer.connect(user2).rewards(PID.DUMMY_BIFI_2K, user2.address)
    const user2WinningsInit = user2HarvestableInit.add(user2VestingInit)
    
    await rolloverRoundUntilWinningTotem(Contracts.CartographerElevation, cartographer, cartographerElevation, elevationHelper, PID.DUMMY_BIFI_2K, 1)
    
    const [user2HarvestableFinal, user2VestingFinal] = await cartographer.connect(user2).rewards(PID.DUMMY_BIFI_2K, user2.address)
    const user2WinningsFinal = user2HarvestableFinal.add(user2VestingFinal)


    consoleLog({
        user1: `${toDecimal(user1WinningsInit)} => ${toDecimal(user1WinningsFinal)}: ${toDecimal(deltaBN(user1WinningsInit, user1WinningsFinal))}`,
        user2: `${toDecimal(user2WinningsInit)} => ${toDecimal(user2WinningsFinal)}: ${toDecimal(deltaBN(user2WinningsInit, user2WinningsFinal))}`,
        expectedDelta: toDecimal(user1BaselineWinnings.add(user2BaselineWinnings)),
    })


    expect6FigBigNumberAllEqual([
        deltaBN(user1WinningsInit, user1WinningsFinal),
        deltaBN(user2WinningsInit, user2WinningsFinal),
        user1BaselineWinnings.add(user2BaselineWinnings),
    ])
  })
})