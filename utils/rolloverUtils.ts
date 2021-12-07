import { cartographerMethod, elevationHelperGet, EXPEDITION, expeditionMethod, getTimestamp, mineBlockWithTimestamp } from "."

export const rolloverRound = async (elevation: number) => {
    const nextRoundTime = await elevationHelperGet.roundEndTimestamp(elevation)
    await mineBlockWithTimestamp(nextRoundTime)
    if (elevation === EXPEDITION) {
      await expeditionMethod.rollover({})
    } else {
      await cartographerMethod.rollover({ elevation })
    }
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
  export const rolloverRoundUntilLosingTotem = async (elevation: number, targetLosingTotem: number) => {
    let winningTotem
    do {
      await rolloverRound(elevation)
      winningTotem = await getPrevRoundWinner(elevation)
    } while (winningTotem === targetLosingTotem)
  }
  export const rolloverIfAvailable = async (elevation: number) => {
    const timestamp = await getTimestamp()
    const roundEndTimestamp = await elevationHelperGet.roundEndTimestamp(elevation)
    const elevationUnlock = await elevationHelperGet.unlockTimestamp(elevation)
    if (timestamp >= roundEndTimestamp && timestamp >= elevationUnlock) {
        await rolloverRound(elevation)
    }
  }