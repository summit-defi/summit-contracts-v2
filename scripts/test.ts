import { ethers } from "hardhat";
import { Contracts } from "../utils";
import { syncTimelockFunctionSpecificDelays } from "./scriptUtils";

async function main() {
    await syncTimelockFunctionSpecificDelays()   
};

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
