import { ftmPools } from "./ftm/configs"
import { PoolConfig } from "../utils"

export const getPoolConfigs = (chainId: string): PoolConfig[] => {
    switch (chainId) {
        case '250': return ftmPools
        default: throw new Error('Invalid Chain Id')
    }
}