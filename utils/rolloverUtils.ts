import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { cartographerMethod, elevationHelperGet, mineBlockWithTimestamp } from "."

export const rolloverRound = async (elevation: number) => {
    const nextRoundTime = await elevationHelperGet.roundEndTimestamp(elevation)
    await mineBlockWithTimestamp(nextRoundTime)
    await cartographerMethod.rollover({ elevation })
  }
  export const rolloverRounds = async (elevation: number, rounds: number) => {
    for (let i = 0; i < rounds; i++) {
      await rolloverRound(elevation)
    }
  }
  export const getPrevRoundWinner = async (elevation: number) => {
    const roundNumber = await elevationHelperGet.roundNumber(elevation)
    return await elevationHelperGet.winningTotem(elevation, roundNumber - 1)
  }
  export const rolloverRoundUntilWinningTotem = async (elevation: number, targetWinningTotem: number) => {
    let winningTotem
    do {
      await rolloverRound(elevation)
      winningTotem = await getPrevRoundWinner(elevation)
    } while (winningTotem !== targetWinningTotem)
  }
  export const rolloverRoundUntilLosingTotem = async(elevation: number, targetLosingTotem: number) => {
    let winningTotem
    do {
      await rolloverRound(elevation)
      winningTotem = await getPrevRoundWinner(elevation)
    } while (winningTotem === targetLosingTotem)
  }