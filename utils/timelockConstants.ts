import { Contracts } from "."

export enum TimelockSigs {
    SetFunctionSpecificDelay = 'setFunctionSpecificDelay',
    SetDelay = 'setDelay',
    SetPendingAdmin = 'setPendingAdmin',
}
export enum CartographerSigs {
    Enable = 'enable',
    MigrateSummitOwnership = 'migrateSummitOwnership',
    SetExpeditionTreasuryAdd = 'setExpeditionTreasuryAdd',
    SetRolloverRewardInNativeToken = 'setRolloverRewardInNativeToken',
    SetTotalSummitPerSecond = 'setTotalSummitPerSecond',
    SetSummitDistributionProfile = 'setSummitDistributionBPs',
    CreateTokenAllocation = 'createTokenAllocation',
    SetTokenAllocation = 'setTokenAllocation',
    SetTokenPassthroughStrategy = 'setTokenPassthroughStrategy',
    RetireTokenPassthroughStrategy = 'retireTokenPassthroughStrategy',
    AddFarm = 'add',
    SetFarm = 'set',
    SetTokenDepositFee = 'setTokenDepositFee',
    SetTokenWithdrawTax = 'setTokenWithdrawTax',
    SetTaxDecayDuration = 'setTaxDecayDuration',
    SetBaseMinimumWithdrawalTax = 'setBaseMinimumWithdrawalTax',
    SetTokenIsNativeFarm = 'setTokenIsNativeFarm',
    SetMaxBonusBP = 'setMaxBonusBP',
}
export enum ElevationHelperSigs {
    UpgradeSummitRNGModule = 'upgradeSummitRNGModule',
    SetElevationRoundDurationMult = 'setElevationRoundDurationMult',
    SetElevationAllocMultiplier = 'setElevationAllocMultiplier',
}
export enum EverestTokenSigs {
    SetMinLockTime = 'setMinLockTime',
    SetInflectionLockTime = 'setInflectionLockTime',
    SetMaxLockTime = 'setMaxLockTime',
    SetMinEverestLockMult = 'setMinEverestLockMult',
    SetInflectionEverestLockMult = 'setInflectionEverestLockMult',
    SetMaxEverestLockMult = 'setMaxEverestLockMult',
    AddEverestExtension = 'addEverestExtension',
    RemoveEverestExtension = 'removeEverestExtension',
    SetPanic = 'setPanic',
}
export enum SummitLockingSigs {
    SetPanic = 'setPanic',
    SetYieldLockEpochCount = 'setYieldLockEpochCount',
}
export enum ExpeditionSigs {
    SetExpeditionDeityWinningsMult = 'setExpeditionDeityWinningsMult',
    SetExpeditionRunwayRounds = 'setExpeditionRunwayRounds',
    RecalculateExpeditionEmissions = 'recalculateExpeditionEmissions',
    DisableExpedition = 'disableExpedition',
    EnableExpedition = 'enableExpedition',
}
export enum SummitTrustedSeederRNGModuleSigs {
    SetElevationHelper = 'setElevationHelper',
    SetTrustedSeederAdd = 'setTrustedSeederAdd',
}



export const TimelockTxSig = {
    Timelock: TimelockSigs,
    Cartographer: CartographerSigs,
    ElevationHelper: ElevationHelperSigs,
    EverestToken: EverestTokenSigs,
    SummitLocking: SummitLockingSigs,
    Expedition: ExpeditionSigs,
    SummitTrustedSeederRNGModule: SummitTrustedSeederRNGModuleSigs,
}

export const TimelockTxSigSpecificDelay = {
    Timelock: {},
    Cartographer: {},
    ElevationHelper: {},
    EverestToken: {},
    SummitLocking: {},
    Expedition: {},
    SummitTrustedSeederRNGModule: {},
}