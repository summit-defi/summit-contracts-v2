import hre, { artifacts, ethers, getChainId } from "hardhat";
import { writeContractAddresses } from "../../utils";

export const createLpPair = async (summitAddress: string, tokenBAddress: string, factoryAddress: string, writeAddresses: boolean) => {
    const { dev } = await ethers.getNamedSigners()
    const factoryArtifact = await artifacts.readArtifact("IPancakeFactory")
    const factory = await new ethers.Contract(factoryAddress, factoryArtifact.abi, ethers.provider)

    console.log(`\tCreate Lp Pair: ${summitAddress}-${tokenBAddress}`)

    const createPairTx = await factory.connect(dev).createPair(summitAddress, tokenBAddress, {
        gasLimit: 5000000,
    })
    await createPairTx.wait(10)

    console.log('\t\tCreated')

    return await getLpPair(summitAddress, tokenBAddress, factoryAddress, writeAddresses)
}

export const getLpPair = async (summitAddress: string, tokenBAddress: string, factoryAddress: string, writeAddresses: boolean) => {
    const factoryArtifact = await artifacts.readArtifact("IPancakeFactory")
    const factory = await new ethers.Contract(factoryAddress, factoryArtifact.abi, ethers.provider)

    console.log(`\tGet Lp Pair: ${summitAddress}-${tokenBAddress}`)

    const summitLpAddress = await factory.getPair(summitAddress, tokenBAddress)

    console.log(`\t\tLP Address: ${summitLpAddress}`)

    if (writeAddresses) {
        const chainId = await getChainId()
        writeContractAddresses(chainId, [
            ['summitToken', summitAddress],
            ['summitLpToken', summitLpAddress],
        ])
    }
    return summitLpAddress
}