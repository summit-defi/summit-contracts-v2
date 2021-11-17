import { ftmPools, ftmExpeditions } from "./ftm/configs"
import { PoolConfig, ExpeditionConfig } from "../utils"

export const getConfigs = (chainId: string): { pools: PoolConfig[], expeditions: ExpeditionConfig[] } => {
    switch (chainId) {
        case '250': return { pools: ftmPools, expeditions: ftmExpeditions }
        default: throw new Error('Invalid Chain Id')
    }
}