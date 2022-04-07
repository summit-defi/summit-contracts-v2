import { BigNumber } from "@ethersproject/bignumber"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers"
import { expect } from "chai"
import { e18, EVENT, executeTx, executeTxExpectEvent, executeTxExpectReversion, getContract, getEverestToken } from "."

export const pausableGet = {
    paused: async (contractName: string) => {
        return await (await getContract(contractName)).paused()
    },
    pauserRole: async (contractName: string) => {
        return await (await getContract(contractName)).PAUSER_ROLE()
    }
}

export const pausableMethod = {
    grantPauserRole: async ({
        admin,
        pauserAddress,
        contractName,
        expectRevert,
    }: {
        admin: SignerWithAddress,
        pauserAddress: string,
        contractName: string,
        expectRevert?: boolean,
    }) => {
        const contract = await getContract(contractName)
        const pauserRole = await pausableGet.pauserRole(contractName)
        const tx = contract.connect(admin).grantRole
        const txArgs = [pauserRole, pauserAddress]
        
        if (expectRevert) {
            await expect(
                tx(...txArgs)
            ).to.be.reverted
        } else {
            const eventArgs = [pauserRole, pauserAddress, admin.address]
            await executeTxExpectEvent(admin, tx, txArgs, contract, 'RoleGranted', eventArgs, false)
        }
    },
    pause: async ({
        admin,
        contractName,
        revertErr,
    }: {
        admin: SignerWithAddress,
        contractName: string,
        revertErr?: string,
    }) => {
        const contract = await getContract(contractName)
        const tx = contract.connect(admin).pause
        const txArgs = [] as any[]
        
        if (revertErr != null) {
            await executeTxExpectReversion(admin, tx, txArgs, revertErr)
        } else {
            const eventArgs = [admin.address]
            await executeTxExpectEvent(admin, tx, txArgs, contract, 'Paused', eventArgs, false)
        }
    },
    unpause: async ({
        admin,
        contractName,
        revertErr,
    }: {
        admin: SignerWithAddress,
        contractName: string,
        revertErr?: string,
    }) => {
        const contract = await getContract(contractName)
        const tx = contract.connect(admin).unpause
        const txArgs = [] as any[]
        
        if (revertErr != null) {
            await executeTxExpectReversion(admin, tx, txArgs, revertErr)
        } else {
            const eventArgs = [admin.address]
            await executeTxExpectEvent(admin, tx, txArgs, contract, 'Unpaused', eventArgs, false)
        }
    },
}