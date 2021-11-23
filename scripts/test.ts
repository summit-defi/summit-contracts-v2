import { ethers } from "hardhat";
import { Contracts } from "../utils";

async function main() {
    const cartographer = await getCartographer()

    const filter = cartographer.filters.CrossCompound(null, null, "0x0000000000000000000000000000000000000000000000000000000000000004", null)
    const filtered = await cartographer.queryFilter(filter)

    console.log({
        filtered
    })
    
};

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
