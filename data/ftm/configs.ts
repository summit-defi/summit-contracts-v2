import { e18, PassthroughType, PoolConfig, ExpeditionConfig } from "../../utils";

export const ftmPools: PoolConfig[] = [
    {
        name: 'SUMMIT',
        token: '0xSUMMIT',
        allocation: 1000,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
    },
    {
        name: 'EVEREST',
        token: 'OxEVEREST',
        allocation: 2500,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 0,
        depositFeeBP: 0,
        native: true,
    },

    {
        name: 'TOMB-FTM',
        token: '0x2a651563c9d3af67ae0388a5c8f89b867038089e',
        allocation: 500,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x27c77411074ba90cA35e6f92A79dAd577c05A746',
        }
    },
    {
        name: 'TSHARE-FTM',
        token: '0x4733bc45ef91cf7ccecaeedb794727075fb209f2',
        allocation: 500,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0xae94e96bF81b3a43027918b138B71a771D381150',
        }
    },
    {
        name: 'FTM-BOO',
        token: '0xEc7178F4C41f346b2721907F5cF7628E388A7a58',
        allocation: 500,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0xEe3a7c885Fd3cc5358FF583F2DAB3b8bC473316f',
        }
    },
    {
        name: 'USDC-FTM',
        token: '0x2b4c76d0dc16be1c31d4c1dc53bf9b45987fc75c',
        allocation: 400,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x41D44B276904561Ac51855159516FD4cB2c90968',
        }
    },
    {
        name: 'FTM-wETH',
        token: '0xf0702249f4d3a25cd3ded7859a165693685ab577',
        allocation: 400,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x2a30C5e0d577108F694d2A96179cd73611Ee069b',
        }
    },
    {
        name: 'fUSDT-FTM',
        token: '0x5965e53aa80a0bcf1cd6dbdd72e6a9b2aa047410',
        allocation: 400,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x5d89017d2465115007AbA00da1E6446dF2C19f34',
        }
    },
    {
        name: 'FTM-DAI',
        token: '0xe120ffbda0d14f3bb6d6053e90e63c572a66a428',
        allocation: 300,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x8316b990De26eB530B7B1bb0d87f5b0a304637cd',
        }
    },

    {
        name: 'fUSDT-DAI-USDC',
        token: '0x92d5ebf3593a92888c25c0abef126583d4b5312e',
        allocation: 100,
        elevations: {
            OASIS: {
                exists: true,
                live: false,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0xBdA8bC79705BC60226adCA2766e94Eb5512949a3',
        }
    },
    {
        name: 'USDC',
        token: '0x04068da6c83afcfa0e13ba15a6696662335d5b75',
        allocation: 100,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x2438009ba14A93e82ab43c66838e57bE27A55Aa1',
        }
    },
    {
        name: 'fUSDT',
        token: '0x049d68029688eabf473097a2fc38ef61633a3c7a',
        allocation: 100,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0xb09cf345294aDD1066543B22FD7384185F7C6fCA',
        }
    },
    {
        name: 'DAI',
        token: '0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e',
        allocation: 100,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x920786cff2A6f601975874Bb24C63f0115Df7dc8',
        }
    },
    {
        name: 'BIFI',
        token: '0xd6070ae98b8069de6b494332d1a1a81b6179d960',
        allocation: 100,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0xbF07093ccd6adFC3dEB259C557b61E94c1F66945',
        }
    },
    {
        name: 'wFTM',
        token: '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83',
        allocation: 100,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        // passthroughStrategy: {
        //     type: PassthroughType.BeefyVaultV6Native,
        //     target: '0x49c68eDb7aeBd968F197121453e41b8704AcdE0C',
        // }
    },   
    {
        name: 'BOO',
        token: '0x841fad6eae12c286d1fd18d1d525dffa75c7effe',
        allocation: 100,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x15DD4398721733D8273FD4Ed9ac5eadC6c018866',
        },
    },
    {
        name: 'GRAND-ORCH',
        token: '0xd47d2791d3b46f9452709fa41855a045304d6f9d',
        allocation: 400,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x0ab24Bfc2503bB536ad667c00685BBB70fA90433',
        },
    },
    {
        name: 'BeetXLP_MIM_USDC_USDT',
        token: '0xd163415bd34ef06f57c58d2aed5a5478afb464cc',
        allocation: 400,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x4C25854f6DA3b5848F7B5C71dcb8EEe20b292d3E',
        },
    },
    {
        name: 'BPT-BEETS-FTM',
        token: '0xcde5a11a4acb4ee4c805352cec57e236bdbc3837',
        allocation: 400,
        elevations: {
            OASIS: {
                exists: true,
                live: true,
            },
            PLAINS: {
                exists: true,
                live: false,
            },
            MESA: {
                exists: true,
                live: false,
            },
            SUMMIT: {
                exists: true,
                live: false,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0xAe0AB718971bb2BAd88AE6Bdc4D0eA63F3CD53Ee',
        },
    },
]


export const ftmExpeditions: ExpeditionConfig[] = [
    {
        name: 'USDC',
        token: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
        rewardAmount: e18(0),
        rounds: 1,
    }
]