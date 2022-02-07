import hre, { ethers } from 'hardhat'

async function main() {
  console.log('Enabling Summit Ecosystem on Fantom')
  const { dev } = await ethers.getNamedSigners()
  const Cartographer = await getCartographer()

  const enableSummitEcosystemTx = await Cartographer.connect(dev).enable()
  console.log({
    enableSummitEcosystemTx
  })
  await enableSummitEcosystemTx.wait(10)

  console.log('\tdone.')
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });