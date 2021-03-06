export const FULL_TESTS = false

export const FORCE_VERIFY = false
export const FORKED_MAINNET = true



export const Contracts = {
    Cartographer: 'Cartographer',
    ElevationHelper: 'ElevationHelper',
    SummitToken: 'SummitToken',
    DummySUMMITLP: 'DummySUMMITLP',

    DummyBIFI: 'DummyBIFI',
    BeefyVault: 'BeefyVaultV6',
    BeefyVaultPassthrough: 'BeefyVaultV6Passthrough',

    DummyCAKE: 'DummyCAKE',
    DummyMasterChef: 'MasterChef',
    MasterChefPassthrough: 'MasterChefPassthrough',
    
    Timelock: 'Timelock',
    
    EverestToken: 'EverestToken',
    DummyEverestExtension: 'DummyEverestExtension',
    
    DummyUSDC: 'DummyUSDC',
    ExpeditionV2: 'ExpeditionV2',

    SummitGlacier: 'SummitGlacier',
    SummitTrustedSeederRNGModule: 'SummitTrustedSeederRNGModule',
}

export const hardhatChainId = '31337'

export const OASIS = 0
export const PLAINS = 1
export const MESA = 2
export const SUMMIT = 3
export const EXPEDITION = 4

export const epochDuration = 3600 * 24 * 7;

export enum NamedElevations {
    OASIS = 'OASIS',
    PLAINS = 'PLAINS',
    MESA = 'MESA',
    SUMMIT = 'SUMMIT',
}

export const getElevationOrExpeditionName = (elev: number): NamedElevations | 'EXPEDITION' => {
    switch (elev) {
        case 1: return NamedElevations.PLAINS
        case 2: return NamedElevations.MESA
        case 3: return NamedElevations.SUMMIT
        case 4: return 'EXPEDITION'
        case 0:
        default: return NamedElevations.OASIS
    }
}
export const getElevationName = (elev: number): NamedElevations => {
    switch (elev) {
        case 1: return NamedElevations.PLAINS
        case 2: return NamedElevations.MESA
        case 3: return NamedElevations.SUMMIT
        case 0:
        default: return NamedElevations.OASIS
    }
}

export const TOTEM_COUNT = [0, 2, 5, 10, 2]

export const PassthroughType = {
    MasterChef: 'MasterChef',
    BeefyVaultV2: 'BeefyVaultV2',
    BeefyVaultV6: 'BeefyVaultV6',
    BeefyVaultV6Native: 'BeefyVaultV6Native',
    YieldWolf: 'YieldWolf',
}

export const SubCartographer = {
    OASIS: 'CartographerOasis',
    ELEVATION: 'CartographerElevation',
    EXPEDITION: 'CartographerExpedition',
}
export const SubCartographerPoolInfo = {
    CartographerOasis: 'oasisPoolInfo',
    CartographerElevation: 'elevationPoolInfo',
}

export const getTotemCount = (elevation: number): number => {
    switch(elevation) {
        case EXPEDITION:
        case PLAINS: return 2
        case MESA: return 5
        case SUMMIT: return 10
        case OASIS:
        default: return 0
    }
}

export const ZEROADD = '0x0000000000000000000000000000000000000000'
export const BURNADD = '0x000000000000000000000000000000000000dEaD'
export const INF_APPROVE = '115792089237316195423570985008687907853269984665640564039457584007913129639935'

export const ERR = {
    NON_OWNER: 'Ownable: caller is not the owner',
    ALREADY_INITIALIZED: 'Initializable: contract is already initialized',
    MISSING_ADDRESS: 'Missing address',
    DUPLICATED_TOKEN_ALLOC: 'Duplicated token alloc',
    INVALID_TOKEN_ALLOC: 'Invalid token alloc',
    POOL_DOESNT_EXIST: 'Pool doesnt exist',
    SUMMIT_NOT_STARTED: 'Summit not started',
    BAD_WITHDRAWAL: 'Bad withdrawal',
    DUPLICATED: 'Duplicated',
    ONLY_CARTOGRAPHER_OR_EXPEDITION: 'Only cartographer or expedition',
    TOTEM_NOT_SELECTED: 'Totem not selected',
    PAUSED: 'Pausable: paused',

    // Elevation
    INVALID_ELEV: 'Invalid elev',
    ELEVATION_LOCKED: 'Elevation locked',
    NO_TOTEM_SWITCH_ON_DEPOSIT: 'Cant switch totem during deposit',
    INVALID_TOTEM: 'Invalid totem',
    ELEVATION_LOCKED_UNTIL_ROLLOVER: 'Elev locked until rollover',

    // Expedition
    EXPEDITION_FUNDS_REQUIRED: 'Must have funds to cover expedition',
    EXPEDITION_ALREADY_RUNNING: 'Expedition already running',

    ERC20: {
        EXCEEDS_BALANCE: 'Exceeds balance',
    },

    // Switch Elevation
    ELEVATE: {
        NO_SAME_ELEV_TRANSFER: 'Must change elev',
        NO_EXPEDITION: 'No exped elev switch',
        NON_ZERO_AMOUNT: 'Transfer non zero amount',
        NO_SUMMIT_AND_LP_ELEVATE: 'Cannot elevate SUMMIT and SUMMIT LP simultaneously',
        BAD_TRANSFER: 'Bad transfer',
        NO_TOTEM_SWITCH: 'Cant switch totem during elevate',
        DIFFERENT_TOKEN: 'Different token',
        DIFFERENT_PASSTHROUGH: 'Different passthrough targets',
        INVALID_TOTEM: 'Invalid totem',
    },

    // Seeding
    SEEDING: {
        ALREADY_SEALED_SEEDED: 'Already sealed seeded',
        ALREADY_UNSEALED_SEEDED: 'Already unsealed seeded',
        FUTURE_BLOCK_NOT_REACHED: 'Future block not reached',
        UNSEALED_SEED_NOT_MATCH: 'Unsealed seed does not match',
        ONLY_TRUSTED_SEEDER: 'Only trusted seeder',
    },
    
    INVALID_INCENTIVE_MULT: 'Incentive multiplier must be between 1x and 2x',
    TOO_MANY_ACTIVE_POOLS: 'Too many active pools',
    TOO_MANY_STAKED_POOLS: 'Staked pool cap (12) reached',

    TIMELOCK: {
        SET_DELAY_MUST_COME_FROM_TIMELOCK: 'Timelock::setDelay: Call must come from Timelock.',
        SET_DELAY_MUST_EXCEED_MIN_DELAY: 'Timelock::setDelay: Delay must exceed minimum delay.',
        SET_DELAY_MUST_NOT_EXCEED_MAX_DELAY: 'Timelock::setDelay: Delay must not exceed maximum delay.',
        SIG_SPECIFIC_MUST_EXCEED_MIN_DELAY: 'Timelock::setDelay: Signature specific delay must exceed base delay.',
        SIG_SPECIFIC_MUST_NOT_EXCEED_MAX_DELAY: 'Timelock::setDelay: Signature specific delay must not exceed maximum delay.',
        QUEUE_MUST_COME_FROM_ADMIN: 'Timelock::queueTransaction: Call must come from admin.',
        QUEUE_MUST_SATISFY_DELAY: 'Timelock::queueTransaction: Estimated execution block must satisfy delay.',
        CANCEL_MUST_COME_FROM_ADMIN: 'Timelock::cancelTransaction: Call must come from admin.',
        EXECUTE_MUST_COME_FROM_ADMIN: 'Timelock::executeTransaction: Call must come from admin.',
        EXECUTE_HASNT_BEEN_QUEUED: 'Timelock::executeTransaction: Transaction hasn\'t been queued.',
        EXECUTE_HASNT_MATURED: 'Timelock::executeTransaction: Transaction hasn\'t surpassed time lock.',
        EXECUTE_STALE: 'Timelock::executeTransaction: Transaction is stale.',
    },

    EVEREST: {
        USER_DOESNT_EXIST: 'User doesnt exist',
        MUST_OWN_EVEREST: 'Must own everest',
        ALREADY_LOCKING_SUMMIT: 'Already locking summit',
        INVALID_LP_INCENTIVE_MULT: 'Incentive multiplier must be between 1x and 4x',
        INVALID_LOCK_DURATION: 'Invalid lock duration',
        LOCK_DURATION_STRICTLY_INCREASE: 'Lock duration must strictly increase',
        EVEREST_LOCKED: 'Lock still in effect',
        BAD_WITHDRAW: 'Bad withdraw',
        INVALID_SAFETY_FACTOR: 'Invalid safety factor',
        NOT_IN_PANIC: 'Not in panic',
        NOT_AVAILABLE_DURING_PANIC: 'Not available during panic',

        MISSING_EXTENSION: 'Missing extension',
        EXTENSION_CAP_REACHED: 'Max extension cap reached',
        EXPEDITION_ALREADY_EXISTS: 'Extension already exists',
        EXTENSION_DOESNT_EXIST: 'Extension doesnt exist',
    },

    EXPEDITION_V2: {
        INVALID_EXPED_TOKEN: 'Invalid token to add to expedition',
        NOT_ACTIVE: 'Expedition not active',
        DOESNT_EXIST: 'Expedition doesnt exist',
        NO_DEITY: 'No deity selected',
        NO_SAFETY_FACTOR: 'No safety factor selected',
        INVALID_DEITY: "Invalid deity",
    },

    ELEVATION_HELPER: {
        MULT_CANT_EXCEED_3X: 'Multiplier cannot exceed 3X',
        ROUND_DURATION_NON_ZERO: 'Duration mult must be non zero',
    },
}

export const TOKEN_FEE = {
    FEE_TAKEN_DURING_WITHDRAW: 50,

    DUMMY_CAKE_OASIS: 400,
    DUMMY_CAKE_2K: 300,
    DUMMY_CAKE_5K: 200,
    DUMMY_CAKE_10K: 100,
    DUMMY_BIFI_OASIS: 200,
    DUMMY_BIFI_2K: 150,
    DUMMY_BIFI_5K: 100,
    DUMMY_BIFI_10K:  50,
}

export const EVENT = {
    PoolCreated: 'PoolCreated',
    PoolUpdated: 'PoolUpdated',
    Deposit: 'Deposit',
    SwitchTotem: 'SwitchTotem',
    EmergencyWithdraw: 'EmergencyWithdraw',
    Withdraw: 'Withdraw',
    SetExpeditionTreasuryAddress: 'SetExpeditionTreasuryAddress',
    SetFeeAddressSt: 'SetFeeAddressSt',
    Setdevress: 'Setdevress',
    ClaimElevation: 'ClaimElevation',
    ClaimWinnings: 'ClaimWinnings',
    Rollover: 'Rollover',
    Elevate: 'Elevate',
    ElevateAndLockStakedSummit: 'ElevateAndLockStakedSummit',
    SummitOwnershipTransferred: 'SummitOwnershipTransferred',
    
    ExpeditionCreated: 'ExpeditionCreated',
    ExpeditionExtended: 'ExpeditionExtended',
    ExpeditionRestarted: 'ExpeditionRestarted',

    SetTokenAllocation: 'SetTokenAllocation',

    SET_PASSTHROUGH_STRATEGY: 'PassthroughStrategySet',
    RETIRE_PASSTHROUGH_STRATEGY: 'PassthroughStrategyRetired',

    CROSS_COMPOUND: 'CrossCompound',

    SET_EXPED_SUMMIT_LP_INCENTIVE_MULT: 'SetSummitInLpIncentiveMultiplier',

    claimElevation: 'claimElevation',

    TIMELOCK_EXECUTE_TRANSACTION: 'ExecuteTransaction',

    SummitGlacier: {
        WinningsLocked: 'WinningsLocked',
        WinningsHarvested: 'WinningsHarvested',
        SetPanic: 'SetPanic',
        SetYieldLockEpochCount: 'SetYieldLockEpochCount',
    },

    Everest: {
        SummitLocked: 'SummitLocked',
        LockDurationIncreased: 'LockDurationIncreased',
        LockedSummitIncreased: 'LockedSummitIncreased',
        LockedSummitWithdrawn: 'LockedSummitWithdrawn',
        PanicFundsRecovered: 'PanicFundsRecovered',

        SetMinLockTime: 'SetMinLockTime',
        SetMaxLockTime: 'SetMaxLockTime',
        SetLockTimeRequiredForTaxlessSummitWithdraw: 'SetLockTimeRequiredForTaxlessSummitWithdraw',
        SetLockTimeRequiredForLockedSummitDeposit: 'SetLockTimeRequiredForLockedSummitDeposit',
        SetMinEverestLockMult: 'SetMinEverestLockMult',
        SetMaxEverestLockMult: 'SetMaxEverestLockMult',
        SetPanic: 'SetPanic',

        EverestExtensionAdded: 'EverestExtensionAdded',
        EverestExtensionRemoved: 'EverestExtensionRemoved',

        AddWhitelistedTransferAddress: 'AddWhitelistedTransferAddress',
    },

    Expedition: {
        
        UserJoinedExpedition: 'UserJoinedExpedition',
        UserHarvestedExpedition: 'UserHarvestedExpedition',

        ExpeditionInitialized: 'ExpeditionInitialized',
        ExpeditionEmissionsRecalculated: 'ExpeditionEmissionsRecalculated',
        ExpeditionFundsAdded: 'ExpeditionFundsAdded',
        ExpeditionDisabled: 'ExpeditionDisabled',
        ExpeditionEnabled: 'ExpeditionEnabled',
        Rollover: 'Rollover',
        DeitySelected: 'DeitySelected',
        SafetyFactorSelected: 'SafetyFactorSelected',

        SetExpeditionDeityWinningsMult: 'SetExpeditionDeityWinningsMult',
        SetExpeditionRunwayRounds: 'SetExpeditionRunwayRounds',
    },

    WinningsHarvested: 'WinningsHarvested',

    CartographerParam: {
        SetTokenDepositFee: 'SetTokenDepositFee',
        SetTokenWithdrawTax: 'SetTokenWithdrawTax',
        SetTaxDecayDuration: 'SetTaxDecayDuration',
        SetBaseMinimumWithdrawalTax: 'SetBaseMinimumWithdrawalTax',
        SetTokenIsNativeFarm: 'SetTokenIsNativeFarm',
        SetMaxBonusBP: 'SetMaxBonusBP',
    },

    ElevationHelper: {
        WinningTotemSelected: 'WinningTotemSelected',
        DeityDividerSelected: 'DeityDividerSelected',
        UpgradeSummitRNGModule: 'UpgradeSummitRNGModule',
        SetElevationRoundDurationMult: 'SetElevationRoundDurationMult',
        SetElevationAllocMultiplier: 'SetElevationAllocMultiplier',
    },
}

export const EVM = {
    Mine: 'evm_mine',
    SetNextBlockTimestamp: 'evm_setNextBlockTimestamp',
    IncreaseTime: 'evm_increaseTime',
}

export const networksOnWhichToVerify = [
    97,     // BSC TESTNET
    56,     // BSC MAINNET
    250,    // FTM MAINNET
    137,    // POLYGON MAINNET
]

export const networkExportsAddresses = [
    97,     // BSC TESTNET
    56,     // BSC MAINNET
    250,    // FTM MAINNET
    137,    // POLYGON MAINNET
]

export const networksWhichExpectUsersToHaveSummit = [
    97,     // BSC TESTNET
    0xfa2,  // FTM TESTNET
    31337,  // HARDHAT
]

export const networksWhichRequireDummies = [
    97,     // BSC TESTNET
    31337,  // HARDHAT
]

export const mainnetNetworks = [
    250,    // FTM MAINNET
    56,     // BSC MAINNET
    137,    // POLYGON MAINNET
]

export const networkWrappedNativeTokens: { [key: string]: string } = {
    56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',   // BSC MAINNET
    97: '0xae13d989dac2f0debff460ac112a837c89baa7cd',   // BSC TESTNET
    250: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',  // FTM MAINNET
    137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',  // POLYGON MAINNET
}

export const networkAMMFactory: { [key: string]: string } = {
    137: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',  // POLYGON MAINNET - QUICKSWAP
}
export const networkAMMPairCodeHash: { [key: string]: string } = {
    137: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',  // POLYGON MAINNET - QUICKSWAP
}

export const networkUsdcAddress: { [key: string]: string } = {
    250: '0x04068da6c83afcfa0e13ba15a6696662335d5b75',  // FTM MAINNET
    137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',  // POLYGON MAINNET
}

export const chainTreasuryAddress: { [key: string]: string } = {
    250: '0x474332025Dd20D5F09FFd766b317F98A872D71e0',
    137: '0x474332025Dd20D5F09FFd766b317F98A872D71e0'
}

export const chainExpedTreasuryAddress: { [key: string]: string } = {
    250: '0x00676eF184C36EBf73d0F3059D2a6909F02AA893',
    137: '0x00676eF184C36EBf73d0F3059D2a6909F02AA893'
}

export const chainLpGeneratorAddress: { [key: string]: string } = {
    250: '0x50963e3c0899584a3EBD3226d976210aF0e42349',
    137: '0x50963e3c0899584a3EBD3226d976210aF0e42349'
}