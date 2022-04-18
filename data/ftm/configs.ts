import { e18, PassthroughType, PoolConfig, ExpeditionConfig } from "../../utils";

export const ftmPools: PoolConfig[] = [
    {
        name: 'SUMMIT',
        token: '0xSUMMIT',
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
        depositFeeBP: 0,
        native: true,
    },
    {
        name: 'EVEREST',
        token: '0xEVEREST',
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
            target: '0xAe0AB718971bb2BAd88AE6Bdc4D0eA63F3CD53Ee',
        },
    },
    {
        name: 'The Grand Orchestra',
        token: '0xd47d2791d3b46f9452709fa41855a045304d6f9d',
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
        allocation: 0,
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
        taxBP: 50,
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
        allocation: 0,
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
        taxBP: 50,
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
        allocation: 0,
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
        taxBP: 50,
        depositFeeBP: 0,
        native: false,
        passthroughStrategy: {
            type: PassthroughType.BeefyVaultV6,
            target: '0xf3A72885cB383543AEE60f44Ca51C760f0bC3b9b',
        },
    },
    {
        name: 'PAE-FTM',
        token: '0x2DC234DbfC085DdbC36a6EACC061D7333Cd397b0',
        allocation: 250,
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
            target: '0x1f01078af0b8a4e7E2BA6211Bda7e92F89393284',
        },
    },
    {
        name: 'pFTM-FTM',
        token: '0x9ce8e9b090e8AF873e793e0b78C484076F8CEECE',
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
            target: '0xb97C963834319e1E07d4F241F1F42f6a41CAEB85',
        },
    },

    {
        name: 'BOO-xBOO',
        getUrl: 'https://solidly.exchange/liquidity/create',
        passthroughUrl: 'https://yieldwolf.finance/fantom/solidexfinance/431',
        token: '0x5804F6C40f44cF7593F73cf3aa16F7037213A623',
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
            type: PassthroughType.YieldWolf,
            target: '0x876F890135091381c23Be437fA1cec2251B7c117',
            pid: 431,
        },
    },
    {
        name: 'USDC-MIM',
        getUrl: 'https://solidly.exchange/liquidity/create',
        passthroughUrl: 'https://yieldwolf.finance/fantom/solidexfinance/419',
        token: '0xbcab7d083Cf6a01e0DdA9ed7F8a02b47d125e682',
        allocation: 50,
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
            type: PassthroughType.YieldWolf,
            target: '0x876F890135091381c23Be437fA1cec2251B7c117',
            pid: 419,
        },
    },
    {
        name: 'FTM-BSHARE',
        getUrl: 'https://spookyswap.finance/add/0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83/0x49C290Ff692149A4E16611c694fdED42C954ab7a',
        passthroughUrl: 'https://yieldwolf.finance/fantom/solidexfinance/359',
        token: '0x6F607443DC307DCBe570D0ecFf79d65838630B56',
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
        native: false,
        passthroughStrategy: {
            type: PassthroughType.YieldWolf,
            target: '0x876F890135091381c23Be437fA1cec2251B7c117',
            pid: 359,
        },
    },
    {
        name: 'TOMB-BASED',
        getUrl: 'https://spookyswap.finance/add/0x6c021Ae822BEa943b2E66552bDe1D2696a53fbB7/0x8D7d3409881b51466B483B11Ea1B8A03cdEd89ae',
        passthroughUrl: 'https://yieldwolf.finance/fantom/solidexfinance/358',
        token: '0xaB2ddCBB346327bBDF97120b0dD5eE172a9c8f9E',
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
        native: false,
        passthroughStrategy: {
            type: PassthroughType.YieldWolf,
            target: '0x876F890135091381c23Be437fA1cec2251B7c117',
            pid: 358,
        },
    },
    {
        name: 'LQDR-FTM',
        getUrl: 'https://swap.spiritswap.finance/#/add/0x10b620b2dbAC4Faa7D7FFD71Da486f5D44cd86f9/0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
        passthroughUrl: 'https://yieldwolf.finance/fantom/liquiddriver/205',
        token: '0x4Fe6f19031239F105F753D1DF8A0d24857D0cAA2',
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
            type: PassthroughType.YieldWolf,
            target: '0x876F890135091381c23Be437fA1cec2251B7c117',
            pid: 205,
        },
    },
    {
        name: 'TOMB-MAI',
        getUrl: 'https://swap.tomb.com/#/add/0x6c021Ae822BEa943b2E66552bDe1D2696a53fbB7/0xfB98B335551a418cD0737375a2ea0ded62Ea213b',
        passthroughUrl: 'https://app.beefy.com/#/fantom/vault/tomb-tomb-mai',
        token: '0x45f4682b560d4e3b8ff1f1b3a38fdbe775c7177b',
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
            target: '0xb2be5Cd33DBFf412Bce9587E44b5647a4BdA6a66',
        },
    },
    {
        name: 'BASED-MAI',
        getUrl: 'https://swap.tomb.com/#/add/0xfB98B335551a418cD0737375a2ea0ded62Ea213b/0x8D7d3409881b51466B483B11Ea1B8A03cdEd89ae',
        passthroughUrl: 'https://app.beefy.com/#/fantom/vault/based-based-mai',
        token: '0x7b5b3751550be4ff87ac6bda89533f7a0c9825b3',
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
            target: '0x5Ddb9a342672ecEe80a028CE40500F16ba1Bca44',
        },
    },
    {
        name: 'TOMB-BAEP',
        getUrl: 'https://spookyswap.finance/add/0x6c021Ae822BEa943b2E66552bDe1D2696a53fbB7/0x8E11FF9a74Ae97b295e14f8D9d48E3A3d72CE890',
        passthroughUrl: 'https://yieldwolf.finance/fantom/baefinance/517',
        token: '0xbA1891E4Bc2B80B40f317BAe059C04be1D76eF72',
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
            type: PassthroughType.YieldWolf,
            target: '0x876F890135091381c23Be437fA1cec2251B7c117',
            pid: 517,
        },
    },
    {
        name: 'FTM-BAE',
        getUrl: 'https://spookyswap.finance/add/0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83/0xEc2Bf1C23188e78B8E187146d14c823679Df01fd',
        passthroughUrl: 'https://yieldwolf.finance/fantom/baefinance/518',
        token: '0x5847a16cdc8A9FfEdA9F7d27Ab50B212e6F0D9B2',
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
            type: PassthroughType.YieldWolf,
            target: '0x876F890135091381c23Be437fA1cec2251B7c117',
            pid: 518,
        },
    },
    {
        name: 'BAEP-MAI',
        getUrl: 'https://swap.tomb.com/#/add/0x8E11FF9a74Ae97b295e14f8D9d48E3A3d72CE890/0xfB98B335551a418cD0737375a2ea0ded62Ea213b',
        passthroughUrl: 'https://yieldwolf.finance/fantom/baefinance/520',
        token: '0x5dE7D8ceBA0203a807DB53F2B78368F826355F1c',
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
            type: PassthroughType.YieldWolf,
            target: '0x876F890135091381c23Be437fA1cec2251B7c117',
            pid: 520,
        },
    },
]