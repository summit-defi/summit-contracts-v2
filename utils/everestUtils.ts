import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { Contracts, e0, e12, e18 } from ".";

export const everestSummitLpEverestIncentiveMult = 200;
export const everestMinLockTime = 3600 * 24;
export const everestMaxLockTime = 3600 * 24 * 365;
export const everestMinLockMult = 1000;
export const everestMaxLockMult = 10000;
export const everestExpeditionRiskedEverestWinningsMult = 120;


export const getSummitInLp = async (amount: BigNumber) => {
    const summitToken = await ethers.getContract(Contracts.SummitToken)
    const dummySummitLpToken = await ethers.getContract(Contracts.DummySUMMITLP)

    const summitTokenInLpIndex = (await dummySummitLpToken.token0()) === summitToken.address ? 0 : 1
    const [reserve0, reserve1] = await dummySummitLpToken.getReserves()
    const summitReserve = summitTokenInLpIndex === 0 ? await reserve0 : await reserve1
    const totalSummitLpSupply = await dummySummitLpToken.totalSupply()
    return amount.mul(summitReserve).mul(everestSummitLpEverestIncentiveMult).div(100).div(totalSummitLpSupply)    
}

export const getEverestLockMultiplier = async (lockPeriod: number): Promise<BigNumber> => {
    return e0(lockPeriod).sub(everestMinLockTime)
        .mul(e12(1))
        .div(e0(everestMaxLockTime).sub(e0(everestMinLockTime)))
        .mul(e0(everestMaxLockMult).sub(e0(everestMinLockMult)))
        .div(e12(1))
        .add(e0(everestMinLockMult))
}

export const getExpectedEverest = async (summitAmount: BigNumber, summitLpAmount: BigNumber, lockPeriod: number, initialMinting = true) => {
    const summitToken = await ethers.getContract(Contracts.SummitToken)
    const summitSupply = await summitToken.totalSupply()
    const summitInLpAmount = await getSummitInLp(summitLpAmount)
    const lockMult = await getEverestLockMultiplier(lockPeriod)
    console.log({
        lockMult: lockMult.toNumber()
    })
    return summitAmount.add(summitInLpAmount)
        .mul(e18(100000))
        .div(summitSupply)
        .mul(lockMult)
        .div(1000)
}