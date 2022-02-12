

import { failableVerify, getCartographer, getElevationHelper, getExpedition } from "../utils";

async function main() {

    const ElevationHelper = await getElevationHelper()
    const Cartographer = await getCartographer()
    const ExpeditionV2 = await getExpedition()

    await failableVerify({
        address: ElevationHelper.address,
        constructorArguments: [Cartographer.address, ExpeditionV2.address],
    })
};

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
