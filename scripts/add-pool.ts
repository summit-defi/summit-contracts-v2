import { getNamedSigners } from '@nomiclabs/hardhat-ethers/dist/src/helpers'
import hre, { ethers } from 'hardhat'
import { OASIS } from '../utils'


const withTokenAllocPoint = true
const tokenAlloc = 4000

const token = '0xaf1B7B111F72d2fd2a7e0Ed248BF95a9A4eD7FC3'
const elevation = OASIS
const depositFee = 0
const cakeChefPid = 0


async function main() {
    const { dev } = await getNamedSigners(hre)
    const cartographer = await ethers.getContract('Cartographer')

    if (withTokenAllocPoint) {
        await cartographer.connect(dev).createTokenAllocation(
            token,
            tokenAlloc,
        )
    }

    await cartographer.connect(dev).add(
        token,
        true,
        true,
        elevation,
    )
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });