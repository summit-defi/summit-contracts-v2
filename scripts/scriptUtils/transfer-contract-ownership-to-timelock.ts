import hre, { ethers } from 'hardhat'
import { Contracts, getTimelock, ownableGet, ownableMethod, promiseSequenceMap } from "../../utils"

export const transferContractOwnershipToTimelock = async () => {
    const { dev } = await ethers.getNamedSigners()
    const timelock = await getTimelock()

    await promiseSequenceMap(
        [Contracts.Cartographer, Contracts.ElevationHelper, Contracts.EverestToken, Contracts.SummitGlacier, Contracts.ExpeditionV2, Contracts.SummitTrustedSeederRNGModule],
        async (contractName) => {
            console.log(`\n\t- Transfer ${contractName} ownership to Timelock: ${timelock.address} -`)
            const owner = await ownableGet.owner(contractName)

            if (owner !== timelock.address) {
                await ownableMethod.transferOwnership({
                    dev,
                    contractName,
                    newOwnerAddress: timelock.address
                })
                console.log('\t\tdone.')
            } else {
                console.log('\t\tpassed.')
            }
        }
    )
}