import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { getContract, executeTxExpectEvent, executeTxExpectReversion, ZEROADD, Contracts } from "."
import { TimelockTxSig } from "./timelockConstants"
import { timelockMethod } from "./timelockUtilsV2"

export const ownableMethod = {
    transferOwnership: async ({
        dev,
        contractName,
        newOwnerAddress,
        revertErr,
        callAsTimelock = false,
        dryRun = false,
    }: {
        dev: SignerWithAddress
        contractName: string,
        newOwnerAddress: string,
        revertErr?: string,
        callAsTimelock?: boolean,
        dryRun?: boolean,
    }) => {
        const contract = await getContract(contractName)
        const currentOwnerAddress = await contract.owner()
        const tx = contract.connect(dev).transferOwnership
        const txArgs = [newOwnerAddress]

        if (callAsTimelock) {
            const note = `Transfer Ownership: ${contractName} - NewOwner:${newOwnerAddress}`
            return await timelockMethod.queue({
                dev,
                targetContractName: contractName,
                txName: TimelockTxSig.Ownable.TransferOwnership,
                txParams: txArgs,
                note,
                dryRun,
            })
        }
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, txArgs, revertErr)
        } else {
            await executeTxExpectEvent(dev, tx, txArgs, contract, 'OwnershipTransferred', [currentOwnerAddress, newOwnerAddress], true)
        }
    },
    renounceOwnership: async ({
        dev,
        contractName,
        revertErr,
    }: {
        dev: SignerWithAddress
        contractName: string,
        revertErr?: string,
    }) => {
        const contract = await getContract(contractName)
        const currentOwnerAddress = await contract.owner()
        const tx = contract.connect(dev).renounceOwnership
        
        if (revertErr != null) {
            await executeTxExpectReversion(dev, tx, [], revertErr)
        } else {
            await executeTxExpectEvent(dev, tx, [], contract, 'OwnershipTransferred', [currentOwnerAddress, ZEROADD], true)
        }
    },
}

export const ownableGet = {
    owner: async (contractName: string) => {
        return await (await getContract(contractName)).owner()
    }
}