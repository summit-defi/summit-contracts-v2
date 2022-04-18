import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import web3 from "web3"
import { Contracts, EVENT, executeTx, executeTxExpectEvent, executeTxExpectReversion, getSummitTrustedSeeder } from "."
import { TimelockTxSig } from "./timelockConstants"
import { timelockMethod } from "./timelockUtilsV2"


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
        callAsTimelock = false,
        dryRun = false,
    }: {
        dev: SignerWithAddress,
        trustedSeeder: string,
        revertErr?: string,
        callAsTimelock?: boolean,
        dryRun?: boolean,
    }) => {
        const summitTrustedSeeder = await getSummitTrustedSeeder()
        const tx = summitTrustedSeeder.connect(dev).setTrustedSeederAdd
        const txArgs = [trustedSeeder]

        if (callAsTimelock) {
            const note = `Set Trusted Seeder: ${trustedSeeder}`
            return await timelockMethod.queue({
                dev,
                targetContractName: Contracts.SummitTrustedSeederRNGModule,
                txName: TimelockTxSig.SummitTrustedSeederRNGModule.SetTrustedSeederAdd,
                txParams: txArgs,
                note,
                dryRun,
            })
        }
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            await executeTx(dev, tx, txArgs)
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
            await executeTxExpectReversion(trustedSeeder, tx, txArgs, revertErr)
        } else {
            await executeTx(trustedSeeder, tx, txArgs)
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
            await executeTxExpectReversion(trustedSeeder, tx, txArgs, revertErr)
        } else {
            await executeTx(trustedSeeder, tx, txArgs)
        }
    },
}