import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import hre, { getChainId, ethers } from "hardhat";
import { EXPEDITION, ExpeditionConfig, writeExpeditionPid } from "../../utils";

export const createExpedition = async (expedition: ExpeditionConfig) => {
    const chainId = await getChainId()
    const { dev } = await getNamedSigners(hre)
    const Cartographer = await ethers.getContract('Cartographer')

    console.log(`\tCreate Expedition: ${expedition.name}`)

    // Early exit if expedition already exists
    const expedExists = await Cartographer.tokenElevationPid(expedition.token, EXPEDITION)
    if (expedExists > 0) {
        console.log(`\t\tAlready exists.`)
        return
    }

    // Create Expedition
    const createExpedTx = await Cartographer.connect(dev).addExpedition(
        0,
        expedition.token,
        expedition.rewardAmount,
        expedition.rounds
    )
    await createExpedTx.wait(10)
    console.log(`\t\tdone.`)

    // Get newly created expedition Id
    const createdExpedPid = await Cartographer.tokenElevationPid(expedition.token, EXPEDITION)
    
    // Add expedition id to created expeditions list
    writeExpeditionPid(chainId, expedition.name, createdExpedPid)
}
