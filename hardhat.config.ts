import "@nomiclabs/hardhat-waffle"
import 'hardhat-deploy'
import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-ganache"
import "@nomiclabs/hardhat-etherscan"
import 'hardhat-abi-exporter'
import 'hardhat-contract-sizer'
import 'hardhat-gas-reporter'
import 'solidity-coverage'
import { task } from 'hardhat/config'
import { HardhatUserConfig } from "hardhat/types";
import { apiKey, mnemonics, namedAddresses } from './secrets'
import { ethers } from "ethers"

process.env['HARDHAT_VERBOSE'] = 'true'

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.2",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      }
    },
  },
  // defaultNetwork: 'ganache',
  // networks: {
  //   ganache: {
  //     url: 'http://127.0.0.1:7545',
  //     saveDeployments: false,
  //   },
  // },
  networks: {
    hardhat: {
      throwOnCallFailures: true,
      throwOnTransactionFailures: true,
      allowUnlimitedContractSize: true,
      // forking: {
      //   url: "https://bsc.getblock.io/?api_key=4c801b23-8ca3-45a4-a13a-426d8a0c7ac6",
      //   // blockNumber: 8401715,
      // },
      tags: ['LOCALHOST'],
    },
    bsc_testnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      gasPrice: ethers.utils.parseUnits('20', 'gwei').toNumber(),
      accounts: { mnemonic: mnemonics.bsc_testnet },
      tags: ['TESTNET'],
    },
    bsc_mainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      gasPrice: 20000000000,
      accounts: {mnemonic: 'mnemonic'},
      tags: ['MAINNET'],
    },
    ftm_testnet: {
      url: "https://rpc.testnet.fantom.network/",
      chainId: 0xfa2,
      gasPrice: 20000000000,
      accounts: { mnemonic: mnemonics.ftm_testnet },
      tags: ['TESTNET'],
    },
    ftm_mainnet: {
      url: "https://rpc.ftm.tools/",
      chainId: 250,
      gasPrice: ethers.utils.parseUnits('10000', 'gwei').toNumber(),
      accounts: { mnemonic: mnemonics.ftm_testnet },
      tags: ['MAINNET'],
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    deploy: "./deploy",
    artifacts: "./artifacts",
  },  
  namedAccounts: {
    dev: {
      default: 0,
      bsc_testnet: namedAddresses.dev,
      bsc_mainnet: namedAddresses.dev,
      ftm_testnet: namedAddresses.dev,
      ftm_mainnet: namedAddresses.dev,
    },
    exped: {
      default: 1,
      bsc_testnet: namedAddresses.exped,
      bsc_mainnet: namedAddresses.exped,
      ftm_testnet: namedAddresses.exped,
      ftm_mainnet: namedAddresses.exped,
    },
    user1: {
      default: 2,
      bsc_testnet: namedAddresses.user1,
      bsc_mainnet: namedAddresses.user1,
      ftm_testnet: namedAddresses.user1,
      ftm_mainnet: namedAddresses.user1,
    },
    user2: {
      default: 3,
      bsc_testnet: namedAddresses.user2,
      bsc_mainnet: namedAddresses.user2,
      ftm_testnet: namedAddresses.user2,
      ftm_mainnet: namedAddresses.user2,
    },
    user3: {
      default: 4,
      bsc_testnet: namedAddresses.user3,
      bsc_mainnet: namedAddresses.user3,
      ftm_testnet: namedAddresses.user3,
      ftm_mainnet: namedAddresses.user3,
    },
    trustedSeeder: {
      default: 5,
      bsc_testnet: namedAddresses.trustedSeeder,
      bsc_mainnet: namedAddresses.trustedSeeder,
      ftm_testnet: namedAddresses.trustedSeeder,
      ftm_mainnet: namedAddresses.trustedSeeder,
    },
    lpGenerator: {
      default: 6,
      bsc_testnet: namedAddresses.lpGenerator,
      bsc_mainnet: namedAddresses.lpGenerator,
      ftm_testnet: namedAddresses.lpGenerator,
      ftm_mainnet: namedAddresses.lpGenerator,
    }
  },
  etherscan: {
    apiKey: apiKey.bscscan
  },
  abiExporter: {
    path: './data/abi',
    clear: false,
    flat: true,
    only: [':ERC20$', ':Cartographer$', ':CartographerOasis$', ':CartographerElevation$', ':ElevationHelper$', ':Multicall$', ':SummitToken$', ':EverestToken$', ':ExpeditionV2$', 'SummitGlacier$'],
    spacing: 2
  },
  gasReporter: {
    enabled: false,
    excludeContracts: ['dummy/', 'PCS/', 'libs/'],
  },
  // contractSizer: {
  //   alphaSort: true,
  //   runOnCompile: true,
  //   disambiguatePaths: false,
  // },
  mocha: {
    timeout: 100000
  },
};

export default config


/* RUNNABLES

npx hardhat test
npx hardhat run scripts/fantom-deploy-summit-ecosystem.ts --network ftm_mainnet
npx hardhat run scripts/fantom-enable-summit-ecosystem.ts --network ftm_mainnet

*/
