import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai"
import hre, { ethers } from "hardhat";
import { e18, ERR, EVENT, mineBlock, oasisTests, toDecimal, passthroughTests, consoleLog, Contracts, OASIS, cartographerMethod, cartographerGet, subCartGet, mineBlocks } from "../utils";
import { getCartographer, getSummitToken } from "../utils/contracts";
import { oasisUnlockedFixture, poolsFixture } from "./fixtures";


describe("OASIS Pools", function() {
  describe('- Pre Summit Enabled', async function() {
    before(async function () {
      await poolsFixture()
    })

    it(`DEPOSIT: Deposit before summit enabled should succeed`, async function() {
      const { user1 } = await getNamedSigners(hre)
      const summitToken = await getSummitToken()

      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: summitToken.address,
        elevation: OASIS,
        amount: e18(5)
      })
    })
  })

  describe('- Summit Enabled', async function () {
    before(async function () {
      await oasisUnlockedFixture()
    })

  
    // DEPOSIT
    it(`DEPOSIT: Incorrect token deposit should fail with error "${ERR.POOL_DOESNT_EXIST}"`, async function() {
      const { user1 } = await getNamedSigners(hre)

      await cartographerMethod.deposit({
        user: user1,
        tokenAddress: (await getCartographer()).address,
        elevation: OASIS,
        amount: e18(5),
        revertErr: ERR.POOL_DOESNT_EXIST
      })
    })
    

    oasisTests.standardDepositShouldSucceed(Contracts.SummitToken)

  
    // PENDING
    oasisTests.pendingSUMMITShouldIncreaseEachBlock(Contracts.SummitToken)
    oasisTests.pendingSUMMITRedeemedOnDeposit(Contracts.SummitToken)
    oasisTests.redeemTransfersCorrectSUMMITToAddresses(Contracts.SummitToken)


    // WITHDRAW
    it(`WITHDRAW: Withdrawing 0 should fail with error ${ERR.BAD_WITHDRAWAL}`, async function() {
      const { user1 } = await getNamedSigners(hre)
      await cartographerMethod.withdraw({
        user: user1,
        tokenAddress: (await getSummitToken()).address,
        elevation: OASIS,
        amount: e18(0),
        revertErr: ERR.BAD_WITHDRAWAL,        
      })
    })
    it(`WITHDRAW: Withdrawing with nothing deposited should fail with error ${ERR.BAD_WITHDRAWAL}`, async function() {
      const { user2 } = await getNamedSigners(hre)
      await cartographerMethod.withdraw({
        user: user2,
        tokenAddress: (await getSummitToken()).address,
        elevation: OASIS,
        amount: e18(5),
        revertErr: ERR.BAD_WITHDRAWAL,        
      })
    })
    it(`WITHDRAW: Withdrawing amount higher than staked should fail with error ${ERR.BAD_WITHDRAWAL}`, async function() {
      const { user1 } = await getNamedSigners(hre)
      await cartographerMethod.withdraw({
        user: user1,
        tokenAddress: (await getSummitToken()).address,
        elevation: OASIS,
        amount: e18(100),
        revertErr: ERR.BAD_WITHDRAWAL,        
      })
    })
    it(`WITHDRAW: Withdrawing from a pool that doesnt exist should fail with error ${ERR.POOL_DOESNT_EXIST}`, async function() {
      const { user1 } = await getNamedSigners(hre)
      await cartographerMethod.withdraw({
        user: user1,
        tokenAddress: (await getCartographer()).address,
        elevation: OASIS,
        amount: e18(0),
        revertErr: ERR.POOL_DOESNT_EXIST,        
      })
    })
    
    oasisTests.pendingSUMMITRedeemedOnWithdrawal(Contracts.SummitToken)


    // RUNNING LP SUPPLY
    oasisTests.lpSupplyUpdatesWithDepositsAndWithdrawals(Contracts.SummitToken)


    // TODO: Deposit fee tests

    // REWARDS UPDATING AND SPLITTING
    oasisTests.rewardsCorrectlyDistributed(Contracts.SummitToken)


    // ALLOCPOINT
    it('ALLOCPOINT: Only owner can update alloc points', async function () {
      const { dev, user1 } = await getNamedSigners(hre)
      const summitToken = await getSummitToken()

      await cartographerMethod.setTokenAllocation({
        dev: user1,
        tokenAddress: summitToken.address,
        allocation: 2000,
        revertErr: ERR.NON_OWNER
      })

      await cartographerMethod.setTokenAllocation({
        dev: dev,
        tokenAddress: summitToken.address,
        allocation: 2000,
      })
    })
    it('ALLOCPOINT: Updated alloc points is reflected in cartographer', async function () {
      const { dev } = await getNamedSigners(hre)
      const summitToken = await getSummitToken()
      
      const tokenAllocInit = await cartographerGet.tokenAlloc(summitToken.address)
      const oasisAllocInit = await cartographerGet.elevAlloc(OASIS)

      await cartographerMethod.setTokenAllocation({
        dev: dev,
        tokenAddress: summitToken.address,
        allocation: 1000,
      })

      const tokenAllocFinal = await cartographerGet.tokenAlloc(summitToken.address)
      const oasisAllocFinal = await cartographerGet.elevAlloc(OASIS)

      expect(tokenAllocInit - tokenAllocFinal).to.equal(1000)
      expect(oasisAllocInit - oasisAllocFinal).to.equal(1000)
    })
    it('ALLOCPOINT: No rewards are earned on 0 alloc point', async function () {
      const { dev, user1 } = await getNamedSigners(hre)
      const summitToken = await getSummitToken()
      
      await cartographerMethod.setTokenAllocation({
        dev: dev,
        tokenAddress: summitToken.address,
        allocation: 0,
      })

      const userHarvestable0 = (await subCartGet.rewards(summitToken.address, OASIS, user1.address)).harvestable
      await mineBlock()
      const userHarvestable1 = (await subCartGet.rewards(summitToken.address, OASIS, user1.address)).harvestable
      const userDelta0 = userHarvestable1.sub(userHarvestable0)

      expect(userDelta0).to.equal(0)
    })
  })

  describe('- Oasis Passthrough Staking', async function() {
    before(async function() {
        await oasisUnlockedFixture()
    })
    passthroughTests.vaultTests(OASIS)
    passthroughTests.switchPassthroughStrategyVaultToMasterChef(OASIS)
    passthroughTests.masterChefTests(OASIS)
    passthroughTests.switchPassthroughStrategyMasterChefToVault(OASIS)
  })
})

