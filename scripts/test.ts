import { ethers, getChainId } from "hardhat";
import { getPoolConfigs } from "../data";
import { Contracts } from "../utils";
import { syncPools, syncTimelockFunctionSpecificDelays } from "./scriptUtils";

async function main() {
    // await syncTimelockFunctionSpecificDelays() 

    const chainId = await getChainId()
    const mainnetPools = getPoolConfigs(chainId)
    await syncPools(mainnetPools, true)  
};

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
