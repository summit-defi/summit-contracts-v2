import { e18, PassthroughType, PoolConfig, ExpeditionConfig } from "../../utils";

export const polygonPools: PoolConfig[] = [
    {
        name: 'SUMMIT',
        token: '0xSUMMIT',
        allocation: 500,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: true,
            },
            MESA: {
                exists: true,
                live: true,
            },
            SUMMIT: {
                exists: true,
                live: true,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: true,
    },
    {
        name: 'SUMMIT-MATIC',
        token: '0xSUMMITLP',
        allocation: 1200,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: true,
            },
            MESA: {
                exists: true,
                live: true,
            },
            SUMMIT: {
                exists: true,
                live: true,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: true,
    },
    {
        name: 'EVEREST',
        token: '0xEVEREST',
        allocation: 500,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: true,
            },
            MESA: {
                exists: true,
                live: true,
            },
            SUMMIT: {
                exists: true,
                live: true,
            },
        },
        taxBP: 0,
        depositFeeBP: 0,
        native: true,
    },
    {
        name: 'MAI-USDC',
        token: '0x160532d2536175d65c03b97b0630a9802c274dad',
        allocation: 400,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: true,
            },
            MESA: {
                exists: true,
                live: true,
            },
            SUMMIT: {
                exists: true,
                live: true,
            },
        },
        taxBP: 700,
        depositFeeBP: 150,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.YieldWolf,
            target: '0xBF65023BcF48Ad0ab5537Ea39C9242de499386c9',
            pid: 305,
        },
    },
    {
        name: 'aTriCrypto',
        token: '0xdad97f7713ae9437fa9249920ec8507e5fbb23d3',
        allocation: 300,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: true,
            },
            MESA: {
                exists: true,
                live: true,
            },
            SUMMIT: {
                exists: true,
                live: true,
            },
        },
        taxBP: 700,
        depositFeeBP: 150,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x5A0801BAd20B6c62d86C566ca90688A6b9ea1d3f',
        },
    },
    {
        name: 'QI-MATIC',
        token: '0x9a8b2601760814019b7e6ee0052e25f1c623d1e6',
        allocation: 700,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: true,
            },
            MESA: {
                exists: true,
                live: true,
            },
            SUMMIT: {
                exists: true,
                live: true,
            },
        },
        taxBP: 700,
        depositFeeBP: 150,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x944A5C12cD4399ABC6883fF1ba40A14c23B2Fd37',
        },
    },
    {
        name: 'BIFI MAXI',
        token: '0xFbdd194376de19a88118e84E279b977f165d01b8',
        allocation: 200,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: true,
            },
            MESA: {
                exists: true,
                live: true,
            },
            SUMMIT: {
                exists: true,
                live: true,
            },
        },
        taxBP: 700,
        depositFeeBP: 150,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0xfEcf784F48125ccb7d8855cdda7C5ED6b5024Cb3',
        },
    },
    {
        name: 'QUICK',
        token: '0x831753DD7087CaC61aB5644b308642cc1c33Dc13',
        allocation: 500,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: true,
            },
            MESA: {
                exists: true,
                live: true,
            },
            SUMMIT: {
                exists: true,
                live: true,
            },
        },
        taxBP: 700,
        depositFeeBP: 150,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x659418cc3cf755f5367a51adb586a7f770da6d29',
        },
    },
    {
        name: 'MATIC-USDC',
        token: '0x6e7a5FAFcec6BB1e78bAE2A1F0B612012BF14827',
        allocation: 300,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: true,
            },
            MESA: {
                exists: true,
                live: true,
            },
            SUMMIT: {
                exists: true,
                live: true,
            },
        },
        taxBP: 700,
        depositFeeBP: 150,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0xC1A2e8274D390b67A7136708203D71BF3877f158',
        },
    },
    {
        name: 'ETH-MATIC',
        token: '0xadbf1854e5883eb8aa7baf50705338739e558e5b',
        allocation: 300,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: true,
            },
            MESA: {
                exists: true,
                live: true,
            },
            SUMMIT: {
                exists: true,
                live: true,
            },
        },
        taxBP: 700,
        depositFeeBP: 150,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.YieldWolf,
            target: '0xBF65023BcF48Ad0ab5537Ea39C9242de499386c9',
            pid: 309
        },
    },
    {
        name: 'EURt-DAI-USDC-USDT',
        token: '0x600743B1d8A96438bD46836fD34977a00293f6Aa',
        allocation: 300,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: true,
            },
            MESA: {
                exists: true,
                live: true,
            },
            SUMMIT: {
                exists: true,
                live: true,
            },
        },
        taxBP: 700,
        depositFeeBP: 150,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x108c7a293162Adff86DA216AB5F91e56723125dc',
        },
    },

]