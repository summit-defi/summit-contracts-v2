import { getNamedSigners } from '@nomiclabs/hardhat-ethers/dist/src/helpers';
import hre, { getChainId, ethers, deployments, artifacts } from 'hardhat'
import { consoleLog, e18, FIVETHOUSAND, OASIS, TENTHOUSAND, toDecimal, TWOTHOUSAND, writeContractAddresses } from '../utils';


