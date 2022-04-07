import { ftmPools } from "./ftm/configs"
import { polygonPools } from "./polygon/configs"
import { PoolConfig } from "../utils"

export const getPoolConfigs = (chainId: string): PoolConfig[] => {
    switch (chainId) {
        case '250': return ftmPools
        case '137': return polygonPools
        default: throw new Error('Invalid Chain Id')
    }
}