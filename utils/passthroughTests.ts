import { getNamedSigners } from '@nomiclabs/hardhat-ethers/dist/src/helpers';
import { expect } from 'chai'
import hre, { ethers } from 'hardhat';
import { consoleLog, deltaBN, depositedAfterFee, e18, toDecimal } from '.';
import { Contracts, EVENT, EXPEDITION, FIVETHOUSAND, TENTHOUSAND, TWOTHOUSAND, ZEROADD } from './constants';
import { amountAfterFullFee, e16, expect6FigBigNumberAllEqual, expect6FigBigNumberEquals, getBlockNumber, getTimestamp, mineBlock, mineBlockWithTimestamp, promiseSequenceMap, rolloverIfAvailable, withdrawnAfterFee } from './utils';

// VAULT TESTING
const vaultTests = (pid: number, poolFee: number) => {
    it('SET PASSTHROUGH STRATEGY: Setting passthrough strategy is successful', async function() {
        const cartographer = await ethers.getContract(Contracts.Cartographer)
        const elevationHelper = await ethers.getContract(Contracts.ElevationHelper)

        const BeefyVaultV6Passthrough = await ethers.getContract(Contracts.BeefyVaultV6Passthrough)
        const dummyBifiToken = await ethers.getContract(Contracts.DummyBIFI)

        await expect(
            cartographer.setTokenPassthroughStrategy(dummyBifiToken.address, BeefyVaultV6Passthrough.address)
        ).to.emit(cartographer, EVENT.SET_PASSTHROUGH_STRATEGY).withArgs(dummyBifiToken.address, BeefyVaultV6Passthrough.address)

        await rolloverIfAvailable(cartographer, elevationHelper, TWOTHOUSAND)
        await rolloverIfAvailable(cartographer, elevationHelper, FIVETHOUSAND)
        await rolloverIfAvailable(cartographer, elevationHelper, TENTHOUSAND)
        await rolloverIfAvailable(cartographer, elevationHelper, EXPEDITION)

    })
    it('VAULT DEPOSIT: Depositing into pool with passthrough vault transfers funds correctly', async function() {
        const { user1, user2, user3, exped, dev } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract(Contracts.Cartographer)
        const bifiVault = await ethers.getContract(Contracts.DummyVault)
        const bifiVaultPassthrough = await ethers.getContract(Contracts.BeefyVaultV6Passthrough)
        const dummyBifiToken = await ethers.getContract(Contracts.DummyBIFI)

        const users = [user1, user2, user3]

        const usersBifiInit = await Promise.all(users.map(async (user) => await dummyBifiToken.balanceOf(user.address)))
        const vaultBifiInit = await dummyBifiToken.balanceOf(bifiVault.address)

        const usersDepositedAmount = await promiseSequenceMap(
            users,
            async (user, index) => {
                const amount = e18(index + 1)
                const transferAmountAfterFee = depositedAfterFee(amount, poolFee)
                const balanceInit = await bifiVaultPassthrough.balance()
                
                await expect(
                    cartographer.connect(user).deposit(pid, amount, 0, 0)
                ).to.emit(cartographer, EVENT.Deposit).withArgs(user.address, pid, transferAmountAfterFee, 0)

                const balanceFinal = await bifiVaultPassthrough.balance()

                // Running users tokens in vault increases correctly
                expect(deltaBN(balanceInit, balanceFinal)).to.equal(transferAmountAfterFee)

                // Shares in passthrough contract matches users tokens in vault + new mint
                const sharesInVault = await bifiVault.balanceOf(bifiVaultPassthrough.address)
                const bifiPerShare = await bifiVault.getPricePerFullShare()
                const bifiInVault = sharesInVault.mul(bifiPerShare).div(e18(1))
                const trueBifiInVault = await dummyBifiToken.balanceOf(bifiVault.address)
                expect6FigBigNumberEquals(trueBifiInVault, bifiInVault)

                return transferAmountAfterFee
            }
        )
        
        await bifiVault.updatePool()
        await bifiVault.updatePool()
        await bifiVault.updatePool()

        const usersBifiFinal = await Promise.all(users.map(async (user) => await dummyBifiToken.balanceOf(user.address)))
        const usersBifiDelta = await Promise.all(users.map(async (_, index) => deltaBN(usersBifiInit[index], usersBifiFinal[index])))

        users.forEach((_, index) => {
            expect(usersBifiDelta[index]).to.equal(e18(index + 1))
        })

        const timestampFinal = await getTimestamp()
        const vaultBifiFinal = await dummyBifiToken.balanceOf(bifiVault.address)
        const totalUsersDepositedAfterFee = usersDepositedAmount.reduce((accum, depositedAfterFee) => accum.add(depositedAfterFee), e18(0))

        consoleLog({
            vaultInit: toDecimal(vaultBifiInit),
            vaultFinal: toDecimal(vaultBifiFinal),
        })

        expect(deltaBN(vaultBifiInit, vaultBifiFinal)).to.equal(totalUsersDepositedAfterFee.add(e16(3)))
    })
    it('VAULT WITHDRAW: Withdrawing from passthrough vault transfers funds correctly', async function() {
        const { user1, user2, exped, dev } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract(Contracts.Cartographer)
        const bifiVault = await ethers.getContract(Contracts.DummyVault)
        const bifiVaultPassthrough = await ethers.getContract(Contracts.BeefyVaultV6Passthrough)
        const dummyBifiToken = await ethers.getContract(Contracts.DummyBIFI)

        const users = [user1, user2]

        const usersBifiInit = await Promise.all(users.map(async (user) => await dummyBifiToken.balanceOf(user.address)))

        const expedBalanceInit = await dummyBifiToken.balanceOf(exped.address)
        const devBalanceInit = await dummyBifiToken.balanceOf(dev.address)

        await promiseSequenceMap(
            users,
            async (user, index) => {
                const amount = depositedAfterFee(e18(index + 1), poolFee)
                const transferAmountAfterFee = withdrawnAfterFee(amount, poolFee)
                consoleLog({
                    amount: toDecimal(amount),
                    transferAmountAfterFee: toDecimal(transferAmountAfterFee),
                })
                const vaultedBalanceInit = await bifiVaultPassthrough.balance()
                
                await expect(
                    cartographer.connect(user).withdraw(pid, amount, 0)
                ).to.emit(cartographer, EVENT.Withdraw).withArgs(user.address, pid, transferAmountAfterFee, 0)

                const vaultedBalanceFinal = await bifiVaultPassthrough.balance()

                // Running users tokens in vault decreases correctly
                expect6FigBigNumberEquals(deltaBN(vaultedBalanceInit, vaultedBalanceFinal), amount)

                // Shares in passthrough contract matches users tokens in vault + new mint
                const sharesInVault = await bifiVault.balanceOf(bifiVaultPassthrough.address)
                const bifiPerShare = await bifiVault.getPricePerFullShare()
                const bifiInVault = sharesInVault.mul(bifiPerShare).div(e18(1))
                const trueBifiInVault = await dummyBifiToken.balanceOf(bifiVault.address)

                expect6FigBigNumberEquals(trueBifiInVault, bifiInVault)

                return transferAmountAfterFee
            }
        )

        const usersBifiFinal = await Promise.all(users.map(async (user) => await dummyBifiToken.balanceOf(user.address)))
        const usersBifiDelta = await Promise.all(users.map(async (_, index) => deltaBN(usersBifiInit[index], usersBifiFinal[index])))

        users.forEach((_, index) => {
            expect(usersBifiDelta[index]).to.equal(amountAfterFullFee(e18(index + 1), poolFee))
        })

        const expedBalanceFinal = await dummyBifiToken.balanceOf(exped.address)
        const devBalanceFinal = await dummyBifiToken.balanceOf(dev.address)

        consoleLog({
            expedAccum: `${toDecimal(expedBalanceInit)} --> ${toDecimal(expedBalanceFinal)}: ${toDecimal(deltaBN(expedBalanceInit, expedBalanceFinal))}`,
            devAccum: `${toDecimal(devBalanceInit)} --> ${toDecimal(devBalanceFinal)}: ${toDecimal(deltaBN(devBalanceInit, devBalanceFinal))}`,
        })

        expect(expedBalanceFinal.gt(expedBalanceInit)).to.be.true
        expect(devBalanceFinal.gt(devBalanceInit)).to.be.true
    })
}

const switchPassthroughStrategyVaultToMasterChef = (pid: number, poolFee: number) => {
    it('RETIRE PASSTHROUGH STRATEGY: Retiring transfers users funds back to cartographer', async function() {
        const { dev } = await getNamedSigners(hre)

        const cartographer = await ethers.getContract(Contracts.Cartographer)

        const BeefyVaultV6Passthrough = await ethers.getContract(Contracts.BeefyVaultV6Passthrough)
        const dummyBifiToken = await ethers.getContract(Contracts.DummyBIFI)

        const vaultFee = 50
        const user3AmountAfterVaultFee = withdrawnAfterFee(depositedAfterFee(e18(3), poolFee), vaultFee)
        const cartographerBifiInit = await dummyBifiToken.balanceOf(cartographer.address)

        await expect(
            cartographer.connect(dev).retireTokenPassthroughStrategy(dummyBifiToken.address)
        ).to.emit(cartographer, EVENT.RETIRE_PASSTHROUGH_STRATEGY).withArgs(dummyBifiToken.address, BeefyVaultV6Passthrough.address)

        const cartographerBifiFinal = await dummyBifiToken.balanceOf(cartographer.address)
        const cartographerBifiDelta = deltaBN(cartographerBifiInit, cartographerBifiFinal)

        expect6FigBigNumberEquals(cartographerBifiDelta, user3AmountAfterVaultFee)
    })
    it('SET PASSTHROUGH STRATEGY: Setting new passthrough strategy transfers funds to masterchef', async function() {
        const { dev } = await getNamedSigners(hre)

        const cartographer = await ethers.getContract(Contracts.Cartographer)
        const elevationHelper = await ethers.getContract(Contracts.ElevationHelper)

        const masterChefPassthrough = await ethers.getContract(Contracts.MasterChefPassthrough)
        const masterChef = await ethers.getContract(Contracts.DummyMasterChef)
        const dummyBifiToken = await ethers.getContract(Contracts.DummyBIFI)

        const vaultFee = 50
        const user3AmountAfterVaultFee = withdrawnAfterFee(depositedAfterFee(e18(3), poolFee), vaultFee)
        const cartographerBifiInit = await dummyBifiToken.balanceOf(cartographer.address)
        const masterChefBifiInit = await dummyBifiToken.balanceOf(masterChef.address)

        await expect(
            cartographer.connect(dev).setTokenPassthroughStrategy(dummyBifiToken.address, masterChefPassthrough.address)
        ).to.emit(cartographer, EVENT.SET_PASSTHROUGH_STRATEGY).withArgs(dummyBifiToken.address, masterChefPassthrough.address)

        await rolloverIfAvailable(cartographer, elevationHelper, TWOTHOUSAND)
        await rolloverIfAvailable(cartographer, elevationHelper, FIVETHOUSAND)
        await rolloverIfAvailable(cartographer, elevationHelper, TENTHOUSAND)
        await rolloverIfAvailable(cartographer, elevationHelper, EXPEDITION)

        const cartographerBifiFinal = await dummyBifiToken.balanceOf(cartographer.address)
        const cartographerBifiDelta = deltaBN(cartographerBifiInit, cartographerBifiFinal)

        const masterChefBifiFinal = await dummyBifiToken.balanceOf(masterChef.address)
        const masterChefBifiDelta = deltaBN(masterChefBifiInit, masterChefBifiFinal)

        expect6FigBigNumberAllEqual([masterChefBifiDelta, cartographerBifiDelta, user3AmountAfterVaultFee])    
    })
}

const masterChefTests = (pid: number, poolFee: number) => {
    it('MASTER CHEF DEPOSIT: Depositing into pool with passthrough masterChef transfers funds correctly', async function() {
        const { user1, user2, user3, exped, dev } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract(Contracts.Cartographer)

        const masterChef = await ethers.getContract(Contracts.DummyMasterChef)
        const masterChefPassthrough = await ethers.getContract(Contracts.MasterChefPassthrough)
        const dummyBifiToken = await ethers.getContract(Contracts.DummyBIFI)
        const dummyCakeToken = await ethers.getContract(Contracts.DummyCAKE)

        const users = [user1, user2, user3]

        const usersBifiInit = await Promise.all(users.map(async (user) => await dummyBifiToken.balanceOf(user.address)))


        const masterChefBifiInit = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount

        const expedBalanceInit = await dummyCakeToken.balanceOf(exped.address)
        const devBalanceInit = await dummyCakeToken.balanceOf(dev.address)

        const usersDepositedAmount = await promiseSequenceMap(
            users,
            async (user, index) => {
                const amount = e18(index + 1)
                const transferAmountAfterFee = depositedAfterFee(amount, poolFee)
                
                const masterChefBalanceInit = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount
                const balanceInit = await masterChefPassthrough.balance()
                
                await expect(
                    cartographer.connect(user).deposit(pid, amount, 0, 0)
                ).to.emit(cartographer, EVENT.Deposit).withArgs(user.address, pid, transferAmountAfterFee, 0)

                const masterChefBalanceFinal = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount
                const balanceFinal = await masterChefPassthrough.balance()

                // Running users tokens in vault increases correctly
                expect(deltaBN(balanceInit, balanceFinal)).to.equal(transferAmountAfterFee)
                expect(deltaBN(masterChefBalanceInit, masterChefBalanceFinal)).to.equal(transferAmountAfterFee)

                return transferAmountAfterFee
            }
        )

        const usersBifiFinal = await Promise.all(users.map(async (user) => await dummyBifiToken.balanceOf(user.address)))
        const usersBifiDelta = await Promise.all(users.map(async (_, index) => deltaBN(usersBifiInit[index], usersBifiFinal[index])))
        const masterChefBifiFinal = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount

        users.forEach((_, index) => {
            expect(usersBifiDelta[index]).to.equal(e18(index + 1))
        })

        const totalUsersDepositedAfterFee = usersDepositedAmount.reduce((accum, depositedAfterFee) => accum.add(depositedAfterFee), e18(0))

        expect(deltaBN(masterChefBifiInit, masterChefBifiFinal)).to.equal(totalUsersDepositedAfterFee)

        const expedBalanceFinal = await dummyCakeToken.balanceOf(exped.address)
        const devBalanceFinal = await dummyCakeToken.balanceOf(dev.address)

        consoleLog({
            expedAccum: `${toDecimal(expedBalanceInit)} --> ${toDecimal(expedBalanceFinal)}: ${toDecimal(deltaBN(expedBalanceInit, expedBalanceFinal))}`,
            devAccum: `${toDecimal(devBalanceInit)} --> ${toDecimal(devBalanceFinal)}: ${toDecimal(deltaBN(devBalanceInit, devBalanceFinal))}`,
        })

        expect(expedBalanceFinal.sub(expedBalanceInit).gt(0)).to.be.true
        expect(devBalanceFinal.sub(devBalanceInit).gt(0)).to.be.true
    })
    it('MASTER CHEF WITHDRAW: Withdrawing from passthrough masterChef transfers funds correctly', async function() {
        const { user1, user2, exped, dev } = await getNamedSigners(hre)
        const cartographer = await ethers.getContract(Contracts.Cartographer)
        
        const masterChef = await ethers.getContract(Contracts.DummyMasterChef)
        const masterChefPassthrough = await ethers.getContract(Contracts.MasterChefPassthrough)
        const dummyBifiToken = await ethers.getContract(Contracts.DummyBIFI)
        const dummyCakeToken = await ethers.getContract(Contracts.DummyCAKE)

        const users = [user1, user2]

        const usersBifiInit = await Promise.all(users.map(async (user) => await dummyBifiToken.balanceOf(user.address)))

        const masterChefBifiInit = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount

        const expedBalanceInit = await dummyCakeToken.balanceOf(exped.address)
        const devBalanceInit = await dummyCakeToken.balanceOf(dev.address)

        await promiseSequenceMap(
            users,
            async (user, index) => {
                const amount = depositedAfterFee(e18(index + 1), poolFee)
                const transferAmountAfterFee = withdrawnAfterFee(amount, poolFee)

                const masterChefBalanceInit = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount
                const balanceInit = await masterChefPassthrough.balance()
                
                await expect(
                    cartographer.connect(user).withdraw(pid, amount, 0)
                ).to.emit(cartographer, EVENT.Withdraw).withArgs(user.address, pid, transferAmountAfterFee, 0)

                const masterChefBalanceFinal = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount
                const balanceFinal = await masterChefPassthrough.balance()

                // Running users tokens in vault decreases correctly
                expect6FigBigNumberEquals(deltaBN(balanceInit, balanceFinal), amount)
                expect6FigBigNumberEquals(deltaBN(masterChefBalanceInit, masterChefBalanceFinal), amount)
            }
        )

        const usersBifiFinal = await Promise.all(users.map(async (user) => await dummyBifiToken.balanceOf(user.address)))
        const usersBifiDelta = await Promise.all(users.map(async (_, index) => deltaBN(usersBifiInit[index], usersBifiFinal[index])))
        const masterChefBifiFinal = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount

        users.forEach((_, index) => {
            expect(usersBifiDelta[index]).to.equal(amountAfterFullFee(e18(index + 1), poolFee))
        })

        expect(deltaBN(masterChefBifiInit, masterChefBifiFinal)).to.equal(depositedAfterFee(e18(3), poolFee))

        const expedBalanceFinal = await dummyCakeToken.balanceOf(exped.address)
        const devBalanceFinal = await dummyCakeToken.balanceOf(dev.address)

        consoleLog({
            expedAccum: `${toDecimal(expedBalanceInit)} --> ${toDecimal(expedBalanceFinal)}: ${toDecimal(deltaBN(expedBalanceInit, expedBalanceFinal))}`,
            devAccum: `${toDecimal(devBalanceInit)} --> ${toDecimal(devBalanceFinal)}: ${toDecimal(deltaBN(devBalanceInit, devBalanceFinal))}`,
        })

        expect(expedBalanceFinal.sub(expedBalanceInit).gt(0)).to.be.true
        expect(devBalanceFinal.sub(devBalanceInit).gt(0)).to.be.true
    })
}

const switchPassthroughStrategyMasterChefToVault = (pid: number) => {
    it('SWITCH PASSTHROUGH STRATEGY: Switching transfers users funds to vault directly', async function() {
        const { dev } = await getNamedSigners(hre)

        const cartographer = await ethers.getContract(Contracts.Cartographer)
        const elevationHelper = await ethers.getContract(Contracts.ElevationHelper)

        const dummyBifiToken = await ethers.getContract(Contracts.DummyBIFI)

        const masterChefPassthrough = await ethers.getContract(Contracts.MasterChefPassthrough)
        const masterChef = await ethers.getContract(Contracts.DummyMasterChef)

        const BeefyVaultV6Passthrough = await ethers.getContract(Contracts.BeefyVaultV6Passthrough)
        const bifiVault = await ethers.getContract(Contracts.DummyVault)

        await bifiVault.updatePool()

        const masterChefBifiInit = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount
        const vaultBifiInit = await dummyBifiToken.balanceOf(bifiVault.address)
        const masterChefUsersTokensInVaultInit = await masterChefPassthrough.balance()
        const vaultUsersTokensInVaultInit = await BeefyVaultV6Passthrough.balance()
        
        await expect(
            cartographer.connect(dev).setTokenPassthroughStrategy(dummyBifiToken.address, BeefyVaultV6Passthrough.address)
        ).to.emit(cartographer, EVENT.SET_PASSTHROUGH_STRATEGY).withArgs(dummyBifiToken.address, BeefyVaultV6Passthrough.address)

        await rolloverIfAvailable(cartographer, elevationHelper, TWOTHOUSAND)
        await rolloverIfAvailable(cartographer, elevationHelper, FIVETHOUSAND)
        await rolloverIfAvailable(cartographer, elevationHelper, TENTHOUSAND)
        await rolloverIfAvailable(cartographer, elevationHelper, EXPEDITION)
        
        const masterChefBifiFinal = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount
        const vaultBifiFinal = await dummyBifiToken.balanceOf(bifiVault.address)
        const masterChefUsersTokensInVaultFinal = await masterChefPassthrough.balance()
        const vaultUsersTokensInVaultFinal = await BeefyVaultV6Passthrough.balance()

        consoleLog({
            masterChefBifiInit: toDecimal(masterChefBifiInit),
            masterChefBifi: toDecimal(deltaBN(masterChefBifiInit, masterChefBifiFinal)),
            vaultBifi: toDecimal(deltaBN(vaultBifiInit, vaultBifiFinal)),
            mCUsersTokensInVault: toDecimal(deltaBN(masterChefUsersTokensInVaultInit, masterChefUsersTokensInVaultFinal)),
            vaultUsersTokensInVault: toDecimal(deltaBN(vaultUsersTokensInVaultInit, vaultUsersTokensInVaultFinal))
        })

        expect6FigBigNumberAllEqual([
            masterChefBifiInit,
            deltaBN(masterChefBifiInit, masterChefBifiFinal),
            deltaBN(vaultBifiInit, vaultBifiFinal),
            deltaBN(masterChefUsersTokensInVaultInit, masterChefUsersTokensInVaultFinal),
            deltaBN(vaultUsersTokensInVaultInit, vaultUsersTokensInVaultFinal)
        ])             
    })
}

export const passthroughTests = {
    vaultTests,
    switchPassthroughStrategyVaultToMasterChef,
    masterChefTests,
    switchPassthroughStrategyMasterChefToVault,
}