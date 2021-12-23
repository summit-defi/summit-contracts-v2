import { BigNumber } from '@ethersproject/bignumber';
import { NamedElevations } from '.';

export interface PassthroughStrategyConfig {
    type: string
    target: string
    pid?: number
    rewardToken?: string
}

interface ElevationExistsLive {
    exists: boolean
    live: boolean
}

export interface PoolConfig {
    name: string
    token: string
    allocation: number
    taxBP: number
    depositFeeBP: number
    native: boolean
    elevations: {
        [NamedElevations.OASIS]: ElevationExistsLive
        [NamedElevations.PLAINS]: ElevationExistsLive
        [NamedElevations.MESA]: ElevationExistsLive
        [NamedElevations.SUMMIT]: ElevationExistsLive
    }
    passthroughStrategy?: PassthroughStrategyConfig
}

export interface ExpeditionConfig {
    name: string
    token: string
    rewardAmount: BigNumber
    rounds: number
}


export enum UpdatePoolTxType {
    createTokenAllocationTxHash = 'createTokenAllocationTxHash',
    setTokenAllocationTxHash = 'setTokenAllocationTxHash',
    addFarmTxHash = 'addFarmTxHash',
    setFarmTxHash = 'setFarmTxHash',
    setTokenPassthroughStrategyTxHash = 'setTokenPassthroughStrategyTxHash'
}

export interface TxHashAndNote {
    txHash: string,
    note: string,
}

export interface UpdatePoolTxHashes {
    [UpdatePoolTxType.createTokenAllocationTxHash]?: TxHashAndNote
    [UpdatePoolTxType.setTokenAllocationTxHash]?: TxHashAndNote
    [UpdatePoolTxType.addFarmTxHash]?: TxHashAndNote
    [UpdatePoolTxType.setFarmTxHash]?: TxHashAndNote
    [UpdatePoolTxType.setTokenPassthroughStrategyTxHash]?: TxHashAndNote
}