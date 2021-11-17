## SUMMIT TEST SUITE

This folder contains the testing suite of the Summit DeFi ecosystem. Summit DeFi has near 100% coverage of the functionality of the smart contracts.

## TESTS OUTPUT

Below is an example output of the test runs:

```
$ npx hardhat test

  Base Pools
    - Pool Creation
      ✓ Pool creation without a token alloc should fail
      ✓ Creation of tokenAlloc should succeed
      ✓ Creation of duplicated tokenAlloc should fail with error Duplicated token alloc
      ✓ Pool creation without already existing tokenAlloc should fail with error Invalid token alloc
      ✓ Non-Admin pool creation should fail
      ✓ Admin pool creation should succeed
      ✓ Deploying another OASIS SUMMIT Pool should fail with error Duplicated
    - Pool Verification
      ✓ Number of pools should be correct
      ✓ Pool Allocation Points should be correct
      ✓ Pools can be disabled and reenabled
      ✓ Tokens total alloc points can be updated

  OASIS Pools
    - Pre Summit Enabled
      ✓ DEPOSIT: Deposit before summit enabled should succeed
    - Summit Enabled
      ✓ DEPOSIT: Incorrect pid should fail with error "Pool doesnt exist"
      ✓ DEPOSIT: Standard deposit should succeed
      ✓ DEPOSIT: Incorrect totem deposit should succeed
      ✓ PENDING: Users pending SUMMIT should increase each block
      ✓ DEPOSIT / REDEEM: User should redeem pending on further deposit
      ✓ REDEEM: Redeeming rewards transfers correct amount to addresses
      ✓ WITHDRAW: Withdrawing 0 should fail with error Bad withdrawal
      ✓ WITHDRAW: Withdrawing with nothing deposited should fail with error Bad withdrawal
      ✓ WITHDRAW: Withdrawing amount higher than staked should fail with error Bad withdrawal
      ✓ WITHDRAW: Withdrawing from a pool that doesnt exist should fail with error Pool doesnt exist
      ✓ WITHDRAW / REDEEM: User should redeem pending on withdraw
      ✓ LPSUPPLY: Should increase and decrease with deposits and withdrawals
      ✓ DEPOSITFEE: Deposit fee should be taken correctly
      ✓ WITHDRAWFEE: Withdraw fee should be taken correctly
      ✓ REWARDS: Rewards are correctly distributed among pool members
      ✓ ALLOCPOINT: Only owner can update alloc points
      ✓ ALLOCPOINT: Updated alloc points is reflected in cartographer
      ✓ ALLOCPOINT: Rewards change based on allocpoint share
      ✓ ALLOCPOINT: No rewards are earned on 0 alloc point
    - Oasis Passthrough Staking
      ✓ SET PASSTHROUGH STRATEGY: Setting passthrough strategy is successful
      ✓ VAULT DEPOSIT: Depositing into pool with passthrough vault transfers funds correctly
      ✓ VAULT WITHDRAW: Withdrawing from passthrough vault transfers funds correctly
      ✓ RETIRE PASSTHROUGH STRATEGY: Retiring transfers users funds back to cartographer
      ✓ SET PASSTHROUGH STRATEGY: Setting new passthrough strategy transfers funds to masterchef
      ✓ MASTER CHEF DEPOSIT: Depositing into pool with passthrough masterChef transfers funds correctly
      ✓ MASTER CHEF WITHDRAW: Withdrawing from passthrough masterChef transfers funds correctly
      ✓ SWITCH PASSTHROUGH STRATEGY: Switching transfers users funds to vault directly

  Referrals
    ✓ REFERRAL BURN: Attempting to burn before summit enabled should fail with error Referral burn not available
    ✓ REFERRAL: Attempting to refer self Should fail with error "Cant refer yourself"
    ✓ REFERRAL: Valid referral should succeed
    ✓ REFERRAL: Attempting to create another referral should fail with error "Already been referred"
    ✓ REFERRAL: Attempting to refer your referrer should fail with error "No reciprocal referrals"
    ✓ REFERRAL: Users referrer and referral status should be correct
    ✓ REFERRAL REWARDS: User1 and User2 should earn referral rewards on User1 reward withdraw
    ✓ REFERRAL REWARDS: User1 and User2 can withdraw the correct amount of referral rewards
    ✓ REFERRAL REWARDS: User3 attempting to redeem rewards should fail with error "No referral rewards to redeem"
    ✓ REFERRAL BURN: Burning the rewards eliminates users rewards and sends a reward to burner
    ✓ REFERRAL BURN: Attempting to burn before round ends should fail with error Referral burn not available

  ELEVATION Unlocks
    ✓ UNLOCK: Before summit enabled all elevations should fail with error "Pool not launched yet"
    ✓ UNLOCK: Before 2K rollover, all elevations should fail with error "Pool not launched yet"
    - Two Thousand Meters
      ✓ UNLOCK: 2K Rollover should only be available after 2K elevation unlocks, else fails with error "Elevation locked"
      ✓ UNLOCK: Rolling over first 2K round, 2K pools should switch from failing ("Pool not launched yet") to succeeding
      ✓ UNLOCK: 2K Rollover should increase totalAllocPoint
    - Five Thousand Meters
      ✓ UNLOCK: 5K Rollover should only be available after 5K elevation unlocks, else fails with error "Elevation locked"
      ✓ UNLOCK: Rolling over first 5K round, 5K pools should switch from failing ("Pool not launched yet") to succeeding
      ✓ UNLOCK: 5K Rollover should increase totalAllocPoint
    - Ten Thousand Meters
      ✓ UNLOCK: Rolling over first 10K round, 10K pools should switch from failing ("Pool not launched yet") to succeeding
      ✓ UNLOCK: 10K Rollover should only be available after 10K elevation unlocks, else fails with error "Elevation locked"
      ✓ UNLOCK: 10K Rollover should increase totalAllocPoint
    - Round End Lockout
      ✓ LOCKOUT: Elevation pools lockout 1 minute before round end until rollover

  ELEVATION FARMING
    - 2K ELEVATION
      - Elevation Farming Tests
        ✓ DEPOSIT: Standard deposit should succeed
        ✓ DEPOSIT: Deposit should update pool and totem info
        ✓ VALIDTOTEM: Valid totem deposit should succeed
        ✓ VALIDTOTEM: Invalid totem deposit should fail with error "Invalid totem"
        ✓ VALIDTOTEM: Deposit to different totem than current should fail with error "Cant switch totem during deposit"
        ✓ PENDING: Elevation pool struct rewards should increase each block
        ✓ PENDING: Users hypothetical rewards should increase each block proportionally
        ✓ VESTING: Winnings vest over duration of round
        ✓ WINNINGS: Winnings match hypothetical winnings before round end
        ✓ VESTING: Withdrawing partially vesting winnings re-vests remaining
        ✓ VESTING: Re-vested winnings increase over duration of vesting
        ✓ VESTING: Vest and accumulate over multiple rounds
        ✓ ROLLOVER: Rolling over multiple rounds yields correct rewards
        ✓ TOTEMS: Switching to invalid totem should fail with error Invalid totem
        ✓ TOTEMS: Users should be able to switch to valid totems
        ✓ HISTORICAL DATA: Single-rollovers update historical data correctly
        ✓ HISTORICAL DATA: Multi-rollover updates historical data correctly
      - Totem In Use
        ✓ TOTEMINUSE: Initial TotemInUse should be false
        ✓ TOTEMINUSE: TotemInUse should update on deposit
        ✓ TOTEMINUSE: TotemInUse should prevent incorrect pond deposits
        ✓ TOTEMINUSE: TotemInUse should be false after withdrawal to zero
      - Elevation Passthrough Staking
        ✓ SET PASSTHROUGH STRATEGY: Setting passthrough strategy is successful
        ✓ VAULT DEPOSIT: Depositing into pool with passthrough vault transfers funds correctly
        ✓ VAULT WITHDRAW: Withdrawing from passthrough vault transfers funds correctly
        ✓ RETIRE PASSTHROUGH STRATEGY: Retiring transfers users funds back to cartographer
        ✓ SET PASSTHROUGH STRATEGY: Setting new passthrough strategy transfers funds to masterchef
        ✓ MASTER CHEF DEPOSIT: Depositing into pool with passthrough masterChef transfers funds correctly
        ✓ MASTER CHEF WITHDRAW: Withdrawing from passthrough masterChef transfers funds correctly
        ✓ SWITCH PASSTHROUGH STRATEGY: Switching transfers users funds to vault directly
    - 5K ELEVATION
      - Elevation Farming Tests
        ✓ DEPOSIT: Standard deposit should succeed
        ✓ DEPOSIT: Deposit should update pool and totem info
        ✓ VALIDTOTEM: Valid totem deposit should succeed
        ✓ VALIDTOTEM: Invalid totem deposit should fail with error "Invalid totem"
        ✓ VALIDTOTEM: Deposit to different totem than current should fail with error "Cant switch totem during deposit"
        ✓ PENDING: Elevation pool struct rewards should increase each block
        ✓ PENDING: Users hypothetical rewards should increase each block proportionally
        ✓ HISTORICAL DATA: Single-rollovers update historical data correctly
        ✓ HISTORICAL DATA: Multi-rollover updates historical data correctly
      - Totem In Use
        ✓ TOTEMINUSE: Initial TotemInUse should be false
        ✓ TOTEMINUSE: TotemInUse should update on deposit
        ✓ TOTEMINUSE: TotemInUse should prevent incorrect pond deposits
        ✓ TOTEMINUSE: TotemInUse should be false after withdrawal to zero
      - Elevation Passthrough Staking
        ✓ SET PASSTHROUGH STRATEGY: Setting passthrough strategy is successful
        ✓ VAULT DEPOSIT: Depositing into pool with passthrough vault transfers funds correctly
        ✓ VAULT WITHDRAW: Withdrawing from passthrough vault transfers funds correctly
        ✓ RETIRE PASSTHROUGH STRATEGY: Retiring transfers users funds back to cartographer
        ✓ SET PASSTHROUGH STRATEGY: Setting new passthrough strategy transfers funds to masterchef
        ✓ MASTER CHEF DEPOSIT: Depositing into pool with passthrough masterChef transfers funds correctly
        ✓ MASTER CHEF WITHDRAW: Withdrawing from passthrough masterChef transfers funds correctly
        ✓ SWITCH PASSTHROUGH STRATEGY: Switching transfers users funds to vault directly
    - 10K ELEVATION
      - Elevation Farming Tests
        ✓ DEPOSIT: Standard deposit should succeed
        ✓ DEPOSIT: Deposit should update pool and totem info
        ✓ VALIDTOTEM: Valid totem deposit should succeed
        ✓ VALIDTOTEM: Invalid totem deposit should fail with error "Invalid totem"
        ✓ VALIDTOTEM: Deposit to different totem than current should fail with error "Cant switch totem during deposit"
        ✓ PENDING: Elevation pool struct rewards should increase each block
        ✓ PENDING: Users hypothetical rewards should increase each block proportionally
        ✓ HISTORICAL DATA: Single-rollovers update historical data correctly
        ✓ HISTORICAL DATA: Multi-rollover updates historical data correctly
      - Totem In Use
        ✓ TOTEMINUSE: Initial TotemInUse should be false
        ✓ TOTEMINUSE: TotemInUse should update on deposit
        ✓ TOTEMINUSE: TotemInUse should prevent incorrect pond deposits
        ✓ TOTEMINUSE: TotemInUse should be false after withdrawal to zero
      - Elevation Passthrough Staking
        ✓ SET PASSTHROUGH STRATEGY: Setting passthrough strategy is successful
        ✓ VAULT DEPOSIT: Depositing into pool with passthrough vault transfers funds correctly
        ✓ VAULT WITHDRAW: Withdrawing from passthrough vault transfers funds correctly
        ✓ RETIRE PASSTHROUGH STRATEGY: Retiring transfers users funds back to cartographer
        ✓ SET PASSTHROUGH STRATEGY: Setting new passthrough strategy transfers funds to masterchef
        ✓ MASTER CHEF DEPOSIT: Depositing into pool with passthrough masterChef transfers funds correctly
        ✓ MASTER CHEF WITHDRAW: Withdrawing from passthrough masterChef transfers funds correctly
        ✓ SWITCH PASSTHROUGH STRATEGY: Switching transfers users funds to vault directly

  Seeding Random Numbers
    ✓ SEEDING: Sending sealed and unsealed seed should fail until nextSeedRoundAvailable returns true
    ✓ SEEDING: nextSeedRoundAvailable should become true only within 60 seconds of end of round
    ✓ SEEDING: Sending a sealed seed should succeed, and nextSeedRoundAvailable should become false
    ✓ SEEDING: Sending another sealed seed should fail with error Already sealed seeded
    ✓ SEEDING: After sealed seed received, the future block mined should become true
    ✓ SEEDING: Sending incorrect unsealed seed should fail with error Unsealed seed does not match
    ✓ SEEDING: After future block mined, sending the unsealed seed should succeed
    ✓ SEEDING: Non trusted seeder attempting to seed should fail with error Only trusted seeder
    ✓ SEEDING: Trusted seeding address can be updated
    ✓ SEEDING: Sending unsealed seed before future block reached should fail with error Future block not reached

  ELEVATION Switching
    ✓ Standard elevation switch should succeed
    ✓ Passthrough elevation switch should succeed with deposit fee taken
    ✓ Switching must be to a valid totem, or will fail with error Invalid totem
    ✓ Switching to a pool at the current elevation will fail with error Must change elev
    ✓ Switching SUMMIT to and from expeditions should succeed
    ✓ Switching with zero amount will fail with error Transfer non zero amount
    ✓ Switching more than staked will fail with error Bad transfer
    ✓ Switching to different totem than currently staked will fail with error Cant switch totem during elevate
    ✓ Can only switch between pools of the same token, or will fail with error Different token

  EXPEDITION FARMING
    ✓ EXPEDITION: Creating a valid expedition works
    ✓ EXPEDITION: Deposits unlock when expedition rolls over
    ✓ EXPEDITION: Expeditions automatically end after the final round
    ✓ EXPEDITION: Expeditions can be restarted after they end
    ✓ EXPEDITION: Expeditions can be extended while they are running
    ✓ DEPOSIT: Standard deposit should succeed
    ✓ DEPOSIT: Deposit should update pool and totem info
    ✓ VALIDTOTEM: Valid totem deposit should succeed
    ✓ VALIDTOTEM: Invalid totem deposit should fail with error "Invalid totem"
    ✓ VALIDTOTEM: Deposit to different totem than current should fail with error "Cant switch totem during deposit"
    ✓ EXPEDITION: Rounds yield correct winnings
    ✓ EXPEDITION: Winnings are withdrawn correctly
    ✓ DEITIES: Switching to invalid deity should fail with error Invalid totem
    ✓ TOTEMS: Users should be able to switch to valid totems
    ✓ HISTORICAL DATA: Single-rollovers update historical data correctly
    ✓ HISTORICAL DATA: Multi-rollover updates historical data correctly

  EXPEDITION MULTI STAKING
    ✓ DEPOSIT SUMMIT LP: Depositing SUMMIT LP alone into an Expedition succeeds
    ✓ DEPOSIT SUMMIT + SUMMIT LP: Depositing SUMMIT LP and SUMMIT TOKEN simultaneously into an Expedition succeeds
    ✓ WITHDRAW SUMMIT LP: Withdrawing more than staked should still fail
    ✓ WITHDRAW SUMMIT LP: Withdrawing SUMMIT LP alone from an Expedition succeeds
    ✓ WITHDRAW SUMMIT + SUMMIT LP: Withdrawing SUMMIT LP and SUMMIT TOKEN simultaneously from an Expedition succeeds
    ✓ ELEVATE SUMMIT LP: Elevating SUMMIT LP to an Oasis farm and back should succeed
    ✓ ELEVATE SUMMIT LP: Elevating SUMMIT LP to an Elevation farm and back should succeed
    ✓ ELEVATE SUMMIT LP: Elevating SUMMIT LP from an elevation to an oasis farm and back should succeed
    ✓ ELEVATE SUMMIT LP: Elevating SUMMIT LP from Expedition to NON SUMMIT LP pool should fail with error "Different token"
    ✓ SUMMIT LP EQUIVALENCE: SUMMIT LP behaves like SUMMIT token
    ✓ SUMMIT LP EQUIVALENCE: Rolling over a round updates the winnings multipliers correctly
    ✓ SUMMIT LP EQUIVALENCE: Equivalent amounts of SUMMIT and SUMMIT LP should yield the same rewards
    ✓ SUMMIT LP RATIO: SUMMIT LP ratio changing updates hypothetical rewards
    ✓ SUMMIT LP RATIO: SUMMIT LP ratio changing after round end doesn't change winnings
    ✓ INCENTIVE MULTIPLIER: SUMMIT LP Incentive multiplier can be updated

  CROSS COMPOUNDING
    - Cross Compound Validations
      ✓ CROSS COMPOUND: Attempting to switch totem during cross compound should fail with error Cant switch totem during deposit
      ✓ CROSS COMPOUND: Attempting to cross compound an expedition pool should fail with error Invalid elev
    - Oasis Cross Compound
      ✓ OASIS SELF COMPOUND: Cross compounding from within SUMMIT pool should succeed
      ✓ OASIS CROSS COMPOUND: Cross compounding from outside SUMMIT pool should succeed

  UPDATE EXPEDITION TREASURY ADDRESS
    ✓ UPDATE EXPED TREASURY: Only callable by owner and must supply valid address
    ✓ SUCCESSFUL UPDATE: Calling setExpedAdd with correct parameters should update exped add

  Cross Elevation Winnings
    ✓ WINNINGS: Winnings are earned and shared across elevation at the end of rounds

  GAS STRESS TESTS
    ✓ GAS STRESS POOLS: Plains will allow up to 24 active pools
    ✓ ACTIVE POOLS CAP: Attempting to add another pool should fail with error "Too many active pools"
    ✓ ACTIVE POOLS CAP: Removing a pool should preserve active pools count until rollover, at which point it should decrement
    ✓ ACTIVE POOLS CAP: Setting a pool live should add it to the active pools count instantly
    ✓ ROLLOVER 24 POOLS: Rolling over all active pools should have a reasonable gas usage
    ✓ INTERACTING POOLS CAP: Attempting to add another pool should fail with error "Staked pool cap (12) reached"
    ✓ INTERACTING POOLS: Exiting a pool should reduce interacting pools count when there are no winnings to harvest or rewards generated in current round
    ✓ INTERACTING POOLS: Exiting a pool should reduce interacting pools count only after all winnings are harvested
    ✓ SWITCH TOTEM: Switching totem with 12 active pools with winnings should succeed
    ✓ HARVEST ALL: Harvesting all winnings from 12 active pools with winnings should succeed
    ✓ CROSS COMPOUND ALL: Cross compounding all winnings from 12 active pools with winnings should succeed

  201 passing (1m)
```

## GAS STRESS TEST RESULTS

The test suite also tests the gas consumption during stress tests of absolute worst case scenarios, with the following results:

```
·---------------------------------------------------------------|---------------------------|-------------|-----------------------------·
|                     Solc version: 0.8.0                      ·  Optimizer enabled: true  ·  Runs: 200  ·  Block limit: 12450000 gas  │
································································|···························|·············|······························
|  Methods                                                                                                                              │
···························|····································|·············|·············|·············|···············|··············
|  Contract                ·  Method                            ·  Min        ·  Max        ·  Avg        ·  # calls      ·  eur (avg)  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  rollover (max active pools)       ·     123886  ·    5960809  ·     955064  ·          144  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  harvestElevation (max pools)      ·    3149048  ·    3229362  ·    3189205  ·            4  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  switchTotem (max pools)           ·      97661  ·    2010587  ·     783289  ·            6  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  add                               ·     313972  ·     769261  ·     533505  ·           47  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  addExpedition                     ·     400765  ·     468700  ·     451716  ·            8  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  createTokenAllocation             ·      99583  ·     116707  ·     104348  ·           36  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  crossCompound                     ·     193807  ·     338860  ·     263484  ·           12  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  deposit                           ·      95211  ·     685797  ·     346530  ·          202  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  elevate                           ·     121287  ·     604082  ·     442238  ·           32  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  enable                            ·          -  ·          -  ·     387579  ·            3  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  initialize                        ·          -  ·          -  ·     401680  ·            2  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  retireTokenPassthroughStrategy    ·      56264  ·      73364  ·      64814  ·            8  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  rolloverReferral                  ·      96758  ·     144513  ·     120636  ·            4  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  set                               ·     116003  ·     340107  ·     251410  ·            7  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  setExpedAdd                       ·          -  ·          -  ·      30578  ·            2  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  setTokenPassthroughStrategy       ·     131596  ·     258893  ·     185932  ·           24  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  setTokenSharedAlloc               ·      26276  ·      86824  ·      54592  ·            4  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  setTrustedSeederAdd               ·          -  ·          -  ·      44683  ·            1  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  transferOwnership                 ·          -  ·          -  ·      28712  ·            4  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  Cartographer            ·  withdraw                          ·      85649  ·     505524  ·     323462  ·           64  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  CartographerElevation   ·  updatePool                        ·     201918  ·     263926  ·     225895  ·           18  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  CartographerExpedition  ·  extendExpeditionPool              ·          -  ·          -  ·      64444  ·            2  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  CartographerExpedition  ·  restartExpeditionPool             ·          -  ·          -  ·     117385  ·            2  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  CartographerExpedition  ·  setSummitInLpIncentiveMultiplier  ·          -  ·          -  ·      30309  ·            2  ·          -  │
···························|····································|·············|·············|·············|···············|··············
|  CartographerOasis       ·  updatePool                        ·          -  ·          -  ·     165998  ·           19  ·          -  │
·---------------------------------------------------------------|-------------|-------------|-------------|---------------|-------------·

```