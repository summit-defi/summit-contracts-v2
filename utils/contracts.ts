import { ethers } from "hardhat"
import { Contracts } from "."

export const getContract = async (contractName: string) => {
    return await ethers.getContract(contractName)
}

export const getCartographer = async () => await getContract(Contracts.Cartographer)
export const getElevationHelper = async () => await getContract(Contracts.ElevationHelper)
export const getSummitTrustedSeeder = async () => await getContract(Contracts.SummitTrustedSeederRNGModule)
export const getSummitToken = async () => await getContract(Contracts.SummitToken)
export const getBifiToken = async () => await getContract(Contracts.DummyBIFI)
export const getBifiVault = async () => await getContract(Contracts.BeefyVault)
export const getBifiVaultPassthrough = async () => await getContract(Contracts.BeefyVaultPassthrough)
export const getUSDCToken = async () => await getContract(Contracts.DummyUSDC)
export const getCakeToken = async () => await getContract(Contracts.DummyCAKE)
export const getMasterChef = async () => await getContract(Contracts.DummyMasterChef)
export const getMasterChefPassthrough = async () => await getContract(Contracts.MasterChefPassthrough)
export const getTimelock = async () => await getContract(Contracts.Timelock)
export const getEverestToken = async () => await getContract(Contracts.EverestToken)
export const getExpedition = async () => await getContract(Contracts.ExpeditionV2)
export const getSummitGlacier = async () => await getContract(Contracts.SummitGlacier)
export const getDummyEverestExtension = async () => await getContract(Contracts.DummyEverestExtension)