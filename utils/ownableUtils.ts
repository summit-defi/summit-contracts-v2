import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { getContract, executeTxExpectEvent, executeTxExpectReversion, ZEROADD } from "."

export const ownableMethod = {
    transferOwnership: async ({
        dev,
        contractName,
        newOwnerAddress,
        revertErr,
    }: {
        dev: SignerWithAddress
        contractName: string,
        newOwnerAddress: string,
        revertErr?: string,
    }) => {
        const contract = await getContract(contractName)
        const currentOwnerAddress = await contract.owner()
        const tx = contract.connect(dev).transferOwnership
        const txArgs = [newOwnerAddress]
        
        if (revertErr != null) {
            await executeTxExpectReversion(tx, txArgs, revertErr)
        } else {
            await executeTxExpectEvent(tx, txArgs, contract, 'OwnershipTransferred', [currentOwnerAddress, newOwnerAddress], true)
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
            await executeTxExpectReversion(tx, [], revertErr)
        } else {
            await executeTxExpectEvent(tx, [], contract, 'OwnershipTransferred', [currentOwnerAddress, ZEROADD], true)
        }
    },
}

export const ownableGet = {
    owner: async (contractName: string) => {
        return await (await getContract(contractName)).owner()
    }
}