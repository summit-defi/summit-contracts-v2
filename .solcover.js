module.exports = {
    skipFiles: ['contracts/dummy/*.sol', 'contracts/interfaces/*.sol', 'contracts/libs/Multicall.sol', 'contracts/Timelock.sol', 'contracts/BeefyVaultV2Passthrough.sol'],
    configureYulOptimizer: true
};