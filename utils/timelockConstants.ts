import { Contracts } from "."

export enum TimelockSigs {
    SetFunctionSpecificDelay = 'setFunctionSpecificDelay',
    SetDelay = 'setDelay',
    SetPendingAdmin = 'setPendingAdmin',
}
export enum OwnedContractSigs {
    TransferOwnership = 'transferOwnership',
    RenounceOwnership = 'renounceOwnership',
}
export enum CartographerSigs {
    Enable = 'enable',
    MigrateSummitOwnership = 'migrateSummitOwnership',
    SetTreasuryAdd = 'setTreasuryAdd',
    SetExpeditionTreasuryAdd = 'setExpeditionTreasuryAdd',
    SetLpGeneratorAdd = 'setLpGeneratorAdd',
    SetRolloverReward = 'setRolloverReward',
    SetTotalSummitPerSecond = 'setTotalSummitPerSecond',
    SetSummitDistributionProfile = 'setSummitDistributionBPs',
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
    AddWhitelistedTransferAddress = 'addWhitelistedTransferAddress',
    AddEverestExtension = 'addEverestExtension',
    RemoveEverestExtension = 'removeEverestExtension',
    SetPanic = 'setPanic',
}
export enum SummitGlacierSigs {
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
    SummitGlacier: SummitGlacierSigs,
    Expedition: ExpeditionSigs,
    SummitTrustedSeederRNGModule: SummitTrustedSeederRNGModuleSigs,
}

const week = 24 * 7
const three_days = 24 * 3

export const TimelockTxSigSpecificDelay = {
    Timelock: {
        [TimelockSigs.SetFunctionSpecificDelay]: null,
        [TimelockSigs.SetDelay]: null,
        [TimelockSigs.SetPendingAdmin]: week,
    },
    Cartographer: {
        [OwnedContractSigs.TransferOwnership]: week,
        [OwnedContractSigs.RenounceOwnership]: week,
        [CartographerSigs.MigrateSummitOwnership]: week,
        [CartographerSigs.SetTreasuryAdd]: null,
        [CartographerSigs.SetExpeditionTreasuryAdd]: null,
        [CartographerSigs.SetLpGeneratorAdd]: null,
        [CartographerSigs.SetRolloverReward]: null,
        [CartographerSigs.SetTotalSummitPerSecond]: three_days,
        [CartographerSigs.SetSummitDistributionProfile]: null,
        [CartographerSigs.SetTokenAllocation]: null,
        [CartographerSigs.SetTokenPassthroughStrategy]: three_days,
        [CartographerSigs.RetireTokenPassthroughStrategy]: three_days,
        [CartographerSigs.AddFarm]: null,
        [CartographerSigs.SetFarm]: null,
        [CartographerSigs.SetTokenDepositFee]: null,
        [CartographerSigs.SetTokenWithdrawTax]: null,
        [CartographerSigs.SetTaxDecayDuration]: null,
        [CartographerSigs.SetBaseMinimumWithdrawalTax]: null,
        [CartographerSigs.SetTokenIsNativeFarm]: null,
        [CartographerSigs.SetMaxBonusBP]: null,
    },
    ElevationHelper: {
        [OwnedContractSigs.TransferOwnership]: week,
        [OwnedContractSigs.RenounceOwnership]: week,
        [ElevationHelperSigs.UpgradeSummitRNGModule]: three_days,
        [ElevationHelperSigs.SetElevationRoundDurationMult]: null,
        [ElevationHelperSigs.SetElevationAllocMultiplier]: null,
    },
    EverestToken: {
        [OwnedContractSigs.TransferOwnership]: week,
        [OwnedContractSigs.RenounceOwnership]: week,
        [EverestTokenSigs.SetMinLockTime]: null,
        [EverestTokenSigs.SetInflectionLockTime]: null,
        [EverestTokenSigs.SetMaxLockTime]: null,
        [EverestTokenSigs.SetMinEverestLockMult]: null,
        [EverestTokenSigs.SetInflectionEverestLockMult]: null,
        [EverestTokenSigs.SetMaxEverestLockMult]: null,
        [EverestTokenSigs.AddWhitelistedTransferAddress]: null,
        [EverestTokenSigs.AddEverestExtension]: null,
        [EverestTokenSigs.RemoveEverestExtension]: null,
        [EverestTokenSigs.SetPanic]: null,
    },
    SummitGlacier: {
        [OwnedContractSigs.TransferOwnership]: week,
        [OwnedContractSigs.RenounceOwnership]: week,
        [SummitGlacierSigs.SetPanic]: null,
        [SummitGlacierSigs.SetYieldLockEpochCount]: three_days,
    },
    Expedition: {
        [OwnedContractSigs.TransferOwnership]: week,
        [OwnedContractSigs.RenounceOwnership]: week,
        [ExpeditionSigs.SetExpeditionDeityWinningsMult]: null,
        [ExpeditionSigs.SetExpeditionRunwayRounds]: null,
        [ExpeditionSigs.RecalculateExpeditionEmissions]: null,
        [ExpeditionSigs.DisableExpedition]: null,
        [ExpeditionSigs.EnableExpedition]: null,
    },
    SummitTrustedSeederRNGModule: {
        [OwnedContractSigs.TransferOwnership]: week,
        [OwnedContractSigs.RenounceOwnership]: week,
        [SummitTrustedSeederRNGModuleSigs.SetElevationHelper]: null,
        [SummitTrustedSeederRNGModuleSigs.SetTrustedSeederAdd]: null,
    },
}