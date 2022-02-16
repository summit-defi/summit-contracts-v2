import { e18, PassthroughType, PoolConfig, ExpeditionConfig } from "../../utils";

export const ftmPools: PoolConfig[] = [
    {
        name: 'SUMMIT',
        token: '0xSUMMIT',
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
        depositFeeBP: 0,
        native: true,
    },
    {
        name: 'EVEREST',
        token: '0xEVEREST',
        allocation: 900,
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
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0xae94e96bF81b3a43027918b138B71a771D381150',
        }
    },
    {
        name: 'FTM-BOO',
        token: '0xEc7178F4C41f346b2721907F5cF7628E388A7a58',
        allocation: 100,
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
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0xEe3a7c885Fd3cc5358FF583F2DAB3b8bC473316f',
        }
    },
    {
        name: 'Fidelio Duetto',
        token: '0xcde5a11a4acb4ee4c805352cec57e236bdbc3837',
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
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0xAe0AB718971bb2BAd88AE6Bdc4D0eA63F3CD53Ee',
        },
    },
    {
        name: 'The Grand Orchestra',
        token: '0xd47d2791d3b46f9452709fa41855a045304d6f9d',
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
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x0ab24Bfc2503bB536ad667c00685BBB70fA90433',
        },
    },
    {
        name: 'Fantom of the Opera',
        token: '0xcdF68a4d525Ba2E90Fe959c74330430A5a6b8226',
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
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0xB40c339e2b0a8513152F68082D3c87314E03776D',
        },
    },
    {
        name: 'BOO',
        token: '0x841fad6eae12c286d1fd18d1d525dffa75c7effe',
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
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x15DD4398721733D8273FD4Ed9ac5eadC6c018866',
        },
    },
    {
        name: 'Battle of the Bands',
        token: '0x9af1f0e9ac9c844a4a4439d446c1437807183075',
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
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x0139C853539bF1EDf221cf9d665F282C2701335a',
        },
    },
    {
        name: '2SHARES-FTM',
        token: '0x6398ACBBAB2561553a9e458Ab67dCFbD58944e52',
        allocation: 800,
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
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x03668Bd5dc63B1e15c39619b599091A4f68cAFB3',
        },
    },
    {
        name: '2OMB-FTM',
        token: '0xbdC7DFb7B88183e87f003ca6B5a2F81202343478',
        allocation: 800,
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
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0xf3A72885cB383543AEE60f44Ca51C760f0bC3b9b',
        },
    },
    {
        name: 'PAE-FTM',
        token: '0x8a41f13a4FaE75ca88B1ee726ee9D52B148b0498',
        allocation: 800,
        elevations: {
            OASIS: {
                exists: false,
                live: true,
            },
            PLAINS: {
                exists: false,
                live: true,
            },
            MESA: {
                exists: false,
                live: true,
            },
            SUMMIT: {
                exists: false,
                live: true,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0x1f01078af0b8a4e7E2BA6211Bda7e92F89393284',
        },
    },
    {
        name: 'pFTM-FTM',
        token: '0x112dF7E3b4B7Ab424F07319D4E92F41e6608c48B',
        allocation: 800,
        elevations: {
            OASIS: {
                exists: false,
                live: true,
            },
            PLAINS: {
                exists: false,
                live: true,
            },
            MESA: {
                exists: false,
                live: true,
            },
            SUMMIT: {
                exists: false,
                live: true,
            },
        },
        taxBP: 700,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0xb97C963834319e1E07d4F241F1F42f6a41CAEB85',
        },
    },
]