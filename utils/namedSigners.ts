import hre, { ethers, getChainId } from 'hardhat'
import { chainIdIsMainnet } from '.'

export const getNoncedNamedSigners = async () => {
    const {
        dev,
        exped,
        user1,
        user2,
        user3,
        trustedSeeder
    } = await ethers.getNamedSigners()
    const chainId = await getChainId()
    if (chainIdIsMainnet(chainId)) {
        return {
            dev,
            exped,
            user1,
            user2,
            user3,
            trustedSeeder,
        }
    }
    return {
        dev,
        exped,
        user1,
        user2,
        user3,
        trustedSeeder,
    }
}