import { getNamedSigners } from '@nomiclabs/hardhat-ethers/dist/src/helpers';
import { expect } from 'chai'
import hre, { ethers } from 'hardhat';
import { cartographerMethod, consoleLog, deltaBN, depositedAfterFee, e18, getBifiToken, getBifiVault, getBifiVaultPassthrough, getCakeToken, getCartographer, getMasterChef, getMasterChefPassthrough, rolloverIfAvailable, toDecimal } from '.';
import { Contracts, EVENT, EXPEDITION, MESA, SUMMIT, PLAINS, OASIS } from './constants';
import { userPromiseSequenceMap } from './users';
import { amountAfterFullFee, e16, expect6FigBigNumberAllEqual, expect6FigBigNumberEquals, getBlockNumber, getTimestamp, mineBlock, mineBlockWithTimestamp, promiseSequenceMap, withdrawnAfterFee } from './utils';

// VAULT TESTING
const vaultTests = (elevation: number) => {
    it('SET PASSTHROUGH STRATEGY: Setting passthrough strategy is successful', async function() {
        const { dev } = await getNamedSigners(hre)

        const beefyVaultPassthrough = await getBifiVaultPassthrough()
        const bifiToken = await getBifiToken()

        await cartographerMethod.setTokenPassthroughStrategy({
            dev,
            tokenAddress: bifiToken.address,
            passthroughTargetAddress: beefyVaultPassthrough.address,
        })

        await rolloverIfAvailable(OASIS)
        await rolloverIfAvailable(PLAINS)
        await rolloverIfAvailable(MESA)
        await rolloverIfAvailable(SUMMIT)
    })
    it('VAULT DEPOSIT: Depositing into pool with passthrough vault transfers funds correctly', async function() {
        const bifiVault = await getBifiVault()
        const bifiVaultPassthrough = await getBifiVaultPassthrough()
        const bifiToken = await getBifiToken()


        const usersBifiInit = await userPromiseSequenceMap(
            async (user) => await bifiToken.balanceOf(user.address)
        )
        const vaultBifiInit = await bifiToken.balanceOf(bifiVault.address)

        const usersDepositedAmount = await userPromiseSequenceMap(
            async (user, userIndex) => {
                const amount = e18(userIndex + 1)
                const balanceInit = await bifiVaultPassthrough.balance()

                await cartographerMethod.deposit({
                    user,
                    tokenAddress: bifiToken.address,
                    elevation,
                    amount,
                })

                const balanceFinal = await bifiVaultPassthrough.balance()

                // Running users tokens in vault increases correctly
                expect(deltaBN(balanceInit, balanceFinal)).to.equal(amount)

                // Shares in passthrough contract matches users tokens in vault + new mint
                const sharesInVault = await bifiVault.balanceOf(bifiVaultPassthrough.address)
                const bifiPerShare = await bifiVault.getPricePerFullShare()
                const bifiInVault = sharesInVault.mul(bifiPerShare).div(e18(1))
                const trueBifiInVault = await bifiToken.balanceOf(bifiVault.address)
                expect6FigBigNumberEquals(trueBifiInVault, bifiInVault)

                return amount
            }
        )
        
        await bifiVault.updatePool()
        await bifiVault.updatePool()
        await bifiVault.updatePool()

        const usersBifiFinal = await userPromiseSequenceMap(
            async (user) => await bifiToken.balanceOf(user.address)
        )
        const usersBifiDelta = await userPromiseSequenceMap(
            async (_, index) => deltaBN(usersBifiInit[index], usersBifiFinal[index])
        )

        await userPromiseSequenceMap(
            async (_, index) => expect(usersBifiDelta[index]).to.equal(e18(index + 1))
        )

        const vaultBifiFinal = await bifiToken.balanceOf(bifiVault.address)
        const totalUsersDepositedAfterFee = usersDepositedAmount.reduce((accum, depositedAfterFee) => accum.add(depositedAfterFee), e18(0))

        consoleLog({
            vaultInit: toDecimal(vaultBifiInit),
            vaultFinal: toDecimal(vaultBifiFinal),
        })

        expect(deltaBN(vaultBifiInit, vaultBifiFinal)).to.equal(totalUsersDepositedAfterFee.add(e16(3)))
    })
    it('VAULT WITHDRAW: Withdrawing from passthrough vault transfers funds correctly', async function() {
        const { exped, dev } = await getNamedSigners(hre)
        const bifiVault = await getBifiVault()
        const bifiVaultPassthrough = await getBifiVaultPassthrough()
        const bifiToken = await getBifiToken()

        const usersBifiInit = await userPromiseSequenceMap(
            async (user) => await bifiToken.balanceOf(user.address)
        )

        const expedBalanceInit = await bifiToken.balanceOf(exped.address)
        const devBalanceInit = await bifiToken.balanceOf(dev.address)

        await userPromiseSequenceMap(
            async (user, index) => {
                const amount = e18(index + 1)
                const transferAmountAfterFee = withdrawnAfterFee(amount, 0)
                consoleLog({
                    amount: toDecimal(amount),
                    transferAmountAfterFee: toDecimal(transferAmountAfterFee),
                })
                const vaultedBalanceInit = await bifiVaultPassthrough.balance()

                await cartographerMethod.withdraw({
                    user,
                    tokenAddress: bifiToken.address,
                    elevation,
                    amount,
                    eventOnly: true,
                })

                const vaultedBalanceFinal = await bifiVaultPassthrough.balance()

                // Running users tokens in vault decreases correctly
                expect6FigBigNumberEquals(deltaBN(vaultedBalanceInit, vaultedBalanceFinal), amount)

                // Shares in passthrough contract matches users tokens in vault + new mint
                const sharesInVault = await bifiVault.balanceOf(bifiVaultPassthrough.address)
                const bifiPerShare = await bifiVault.getPricePerFullShare()
                const bifiInVault = sharesInVault.mul(bifiPerShare).div(e18(1))
                const trueBifiInVault = await bifiToken.balanceOf(bifiVault.address)

                expect6FigBigNumberEquals(trueBifiInVault, bifiInVault)

                return transferAmountAfterFee
            }
        )

        const usersBifiFinal = await userPromiseSequenceMap(
            async (user) => await bifiToken.balanceOf(user.address)
        )
        const usersBifiDelta = await userPromiseSequenceMap(
            async (_, index) => deltaBN(usersBifiInit[index], usersBifiFinal[index])
        )

        await userPromiseSequenceMap(
            async (_, index) => expect6FigBigNumberEquals(usersBifiDelta[index], amountAfterFullFee(e18(index + 1), 0))
        )

        const expedBalanceFinal = await bifiToken.balanceOf(exped.address)
        const devBalanceFinal = await bifiToken.balanceOf(dev.address)

        consoleLog({
            expedAccum: `${toDecimal(expedBalanceInit)} --> ${toDecimal(expedBalanceFinal)}: ${toDecimal(deltaBN(expedBalanceInit, expedBalanceFinal))}`,
            devAccum: `${toDecimal(devBalanceInit)} --> ${toDecimal(devBalanceFinal)}: ${toDecimal(deltaBN(devBalanceInit, devBalanceFinal))}`,
        })

        expect(expedBalanceFinal.gt(expedBalanceInit)).to.be.true
        expect(devBalanceFinal.gt(devBalanceInit)).to.be.true
    })
}

const switchPassthroughStrategyVaultToMasterChef = (elevation: number) => {
    it('RETIRE PASSTHROUGH STRATEGY: Retiring transfers users funds back to cartographer', async function() {
        const { dev, user1 } = await getNamedSigners(hre)

        const cartographer = await getCartographer()

        const bifiToken = await getBifiToken()

        await cartographerMethod.deposit({
            user: user1,
            tokenAddress: bifiToken.address,
            elevation: elevation,
            amount: e18(5),
        })

        const cartographerBifiInit = await bifiToken.balanceOf(cartographer.address)

        await cartographerMethod.retireTokenPassthroughStrategy({
            dev,
            tokenAddress: bifiToken.address
        })

        const cartographerBifiFinal = await bifiToken.balanceOf(cartographer.address)
        const cartographerBifiDelta = deltaBN(cartographerBifiInit, cartographerBifiFinal)

        consoleLog({
            cartographerBifi: `${toDecimal(cartographerBifiInit)} -> ${toDecimal(cartographerBifiFinal)}: ${toDecimal(cartographerBifiDelta)}`
        })

        expect6FigBigNumberEquals(cartographerBifiDelta, e18(5))
    })
    it('SET PASSTHROUGH STRATEGY: Setting new passthrough strategy transfers funds to masterchef', async function() {
        const { dev } = await getNamedSigners(hre)

        const cartographer = await getCartographer()
        const masterChefPassthrough = await getMasterChefPassthrough()
        const masterChef = await getMasterChef()
        const bifiToken = await getBifiToken()

        const cartographerBifiInit = await bifiToken.balanceOf(cartographer.address)
        const masterChefBifiInit = await bifiToken.balanceOf(masterChef.address)

        await cartographerMethod.setTokenPassthroughStrategy({
            dev,
            tokenAddress: bifiToken.address,
            passthroughTargetAddress: masterChefPassthrough.address,
        })

        await rolloverIfAvailable(PLAINS)
        await rolloverIfAvailable(MESA)
        await rolloverIfAvailable(SUMMIT)
        await rolloverIfAvailable(EXPEDITION)

        const cartographerBifiFinal = await bifiToken.balanceOf(cartographer.address)
        const cartographerBifiDelta = deltaBN(cartographerBifiInit, cartographerBifiFinal)

        const masterChefBifiFinal = await bifiToken.balanceOf(masterChef.address)
        const masterChefBifiDelta = deltaBN(masterChefBifiInit, masterChefBifiFinal)

        const amountDepositedIntoFarm = e18(5)

        consoleLog({
            cartographerBifiDelta: toDecimal(cartographerBifiDelta),
            masterChefBifiDelta: toDecimal(masterChefBifiDelta),
            amountDepositedIntoFarm: toDecimal(amountDepositedIntoFarm),
        })

        expect6FigBigNumberAllEqual([masterChefBifiDelta, cartographerBifiDelta, amountDepositedIntoFarm])    
    })
}

const masterChefTests = (elevation: number) => {
    it('MASTER CHEF DEPOSIT: Depositing into pool with passthrough masterChef transfers funds correctly', async function() {
        const { exped, dev } = await getNamedSigners(hre)

        const masterChef = await getMasterChef()
        const masterChefPassthrough = await getMasterChefPassthrough()
        const bifiToken = await getBifiToken()
        const dummyCakeToken = await getCakeToken()


        const usersBifiInit = await userPromiseSequenceMap(
            async (user) => await bifiToken.balanceOf(user.address)
        )

        const masterChefBifiInit = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount

        const expedBalanceInit = await dummyCakeToken.balanceOf(exped.address)
        const devBalanceInit = await dummyCakeToken.balanceOf(dev.address)

        const usersDepositedAmount = await userPromiseSequenceMap(
            async (user, index) => {
                const amount = e18(index + 1)
                
                const masterChefBalanceInit = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount
                const balanceInit = await masterChefPassthrough.balance()

                await cartographerMethod.deposit({
                    user,
                    tokenAddress: bifiToken.address,
                    elevation,
                    amount,
                })

                const masterChefBalanceFinal = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount
                const balanceFinal = await masterChefPassthrough.balance()

                // Running users tokens in vault increases correctly
                expect(deltaBN(balanceInit, balanceFinal)).to.equal(amount)
                expect(deltaBN(masterChefBalanceInit, masterChefBalanceFinal)).to.equal(amount)

                return amount
            }
        )

        const usersBifiFinal = await userPromiseSequenceMap(
            async (user) => await bifiToken.balanceOf(user.address)
        )
        const usersBifiDelta = await userPromiseSequenceMap(
            async (_, index) => deltaBN(usersBifiInit[index], usersBifiFinal[index])
        )
        const masterChefBifiFinal = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount

        await userPromiseSequenceMap(
            async (_, index) => expect(usersBifiDelta[index]).to.equal(e18(index + 1))
        )

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
        const { exped, dev } = await getNamedSigners(hre)
        
        const masterChef = await getMasterChef()
        const masterChefPassthrough = await getMasterChefPassthrough()
        const bifiToken = await getBifiToken()
        const dummyCakeToken = await getCakeToken()

        const usersBifiInit = await userPromiseSequenceMap(
            async (user) => await bifiToken.balanceOf(user.address)
        )

        const masterChefBifiInit = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount

        const expedBalanceInit = await dummyCakeToken.balanceOf(exped.address)
        const devBalanceInit = await dummyCakeToken.balanceOf(dev.address)

        await userPromiseSequenceMap(
            async (user, index) => {
                const amount = e18(index + 1)

                const masterChefBalanceInit = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount
                const balanceInit = await masterChefPassthrough.balance()

                await cartographerMethod.withdraw({
                    user,
                    tokenAddress: bifiToken.address,
                    elevation,
                    amount,
                })

                const masterChefBalanceFinal = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount
                const balanceFinal = await masterChefPassthrough.balance()

                // Running users tokens in vault decreases correctly
                expect6FigBigNumberEquals(deltaBN(balanceInit, balanceFinal), amount)
                expect6FigBigNumberEquals(deltaBN(masterChefBalanceInit, masterChefBalanceFinal), amount)
            }
        )

        const usersBifiFinal = await userPromiseSequenceMap(
            async (user) => await bifiToken.balanceOf(user.address)
        )
        const usersBifiDelta = await userPromiseSequenceMap(
            async (_, index) => deltaBN(usersBifiInit[index], usersBifiFinal[index])
        )
        const masterChefBifiFinal = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount

        await userPromiseSequenceMap(
            async (_, index) => expect(usersBifiDelta[index]).to.equal(e18(index + 1))
        )

        expect(deltaBN(masterChefBifiInit, masterChefBifiFinal)).to.equal(e18(6))

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

const switchPassthroughStrategyMasterChefToVault = (elevation: number) => {
    it('SWITCH PASSTHROUGH STRATEGY: Switching transfers users funds to vault directly', async function() {
        const { dev } = await getNamedSigners(hre)

        const bifiToken = await getBifiToken()

        const masterChefPassthrough = await getMasterChefPassthrough()
        const masterChef = await getMasterChef()

        const beefyVaultPassthrough = await getBifiVaultPassthrough()
        const bifiVault = await getBifiVault()

        await bifiVault.updatePool()

        const masterChefBifiInit = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount
        const vaultBifiInit = await bifiToken.balanceOf(bifiVault.address)
        const masterChefUsersTokensInVaultInit = await masterChefPassthrough.balance()
        const vaultUsersTokensInVaultInit = await beefyVaultPassthrough.balance()

        await cartographerMethod.setTokenPassthroughStrategy({
            dev,
            tokenAddress: bifiToken.address,
            passthroughTargetAddress: beefyVaultPassthrough.address
        })

        await rolloverIfAvailable(PLAINS)
        await rolloverIfAvailable(MESA)
        await rolloverIfAvailable(SUMMIT)
        await rolloverIfAvailable(EXPEDITION)
        
        const masterChefBifiFinal = (await masterChef.userInfo(1, masterChefPassthrough.address)).amount
        const vaultBifiFinal = await bifiToken.balanceOf(bifiVault.address)
        const masterChefUsersTokensInVaultFinal = await masterChefPassthrough.balance()
        const vaultUsersTokensInVaultFinal = await beefyVaultPassthrough.balance()

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