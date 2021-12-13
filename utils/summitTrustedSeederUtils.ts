import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import web3 from "web3"
import { EVENT, executeTx, executeTxExpectEvent, executeTxExpectReversion, getSummitTrustedSeeder } from "."


export const getSeeds = (input: string, seeder: string): { unsealedSeed: string, sealedSeed: string } => {
    const unsealedSeed = web3.utils.keccak256(input)
    const encoded = web3.utils.encodePacked(unsealedSeed, seeder)
    const sealedSeed = web3.utils.keccak256(encoded!)
    return { unsealedSeed, sealedSeed }
}

export const summitTrustedSeederGet = {
    seedRoundEndTimestamp: async (): Promise<number> => {
        return (await (await getSummitTrustedSeeder()).seedRoundEndTimestamp()).toNumber()
    },
    seedRound: async (): Promise<number> => {
        return (await (await getSummitTrustedSeeder()).seedRound()).toNumber()
    },
    futureBlockMined: async (): Promise<boolean> => {
        return await (await getSummitTrustedSeeder()).futureBlockMined()
    },
    nextSeedRoundAvailable: async (): Promise<boolean> => {
        return await (await getSummitTrustedSeeder()).nextSeedRoundAvailable()
    }
}

export const summitTrustedSeederMethod = {
    setTrustedSeederAdd: async ({
        dev,
        trustedSeeder,
        revertErr,
    }: {
        dev: SignerWithAddress,
        trustedSeeder: string,
        revertErr?: string,
    }) => {
        const summitTrustedSeeder = await getSummitTrustedSeeder()
        const tx = summitTrustedSeeder.connect(dev).setTrustedSeederAdd
        const txArgs = [trustedSeeder]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            await executeTx(tx, txArgs)
        }
    },
    receiveSealedSeed: async ({
        trustedSeeder,
        sealedSeed,
        revertErr,
    }: {
        trustedSeeder: SignerWithAddress,
        sealedSeed: string,
        revertErr?: string,
    }) => {
        const summitTrustedSeeder = await getSummitTrustedSeeder()
        const tx = summitTrustedSeeder.connect(trustedSeeder).receiveSealedSeed
        const txArgs = [sealedSeed]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            await executeTx(tx, txArgs)
        }
    },
    receiveUnsealedSeed: async ({
        trustedSeeder,
        unsealedSeed,
        revertErr,
    }: {
        trustedSeeder: SignerWithAddress,
        unsealedSeed: string,
        revertErr?: string,
    }) => {
        const summitTrustedSeeder = await getSummitTrustedSeeder()
        const tx = summitTrustedSeeder.connect(trustedSeeder).receiveUnsealedSeed
        const txArgs = [unsealedSeed]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            await executeTx(tx, txArgs)
        }
    },
}