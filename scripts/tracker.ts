import erc20Abi from '../data/abi/ERC20.json'
import { Contract, ethers, EventFilter } from 'ethers';

export const promiseSequenceMap = async <T, R>(inputArray: T[], transformer: (element: T, index: number, array: T[]) => Promise<R>): Promise<R[]> => {
    const newArray: R[] = []
    for (let i = 0; i < inputArray.length; i++) {
        newArray[i] = await transformer(inputArray[i], i, inputArray)
    }
    return newArray
}

async function main() {
    const rpc = 'https://ftmrpc.ultimatenodes.io'
    const provider = new ethers.providers.JsonRpcProvider(rpc);

    const seedWallet = '0xbc58781993b3e78a1b0608f899320825189d3631'

    const blacklisted = [
        '0x6d0176c5ea1e44b08d3dd001b0784ce42f47a3a7', // Spooky Router
    ]

    const trackingTokens = {
        // USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        TOMB: '0x6c021ae822bea943b2e66552bde1d2696a53fbb7',
        miMATIC: '0xfB98B335551a418cD0737375a2ea0ded62Ea213b',
        // fUSDT: '0x049d68029688eabf473097a2fc38ef61633a3c7a',
    }

    const tokenContracts: { [key: string]: Contract } = {}
    const receiveFilters: { [key: string]: EventFilter } = {}
    const sendFilters: { [key: string]: EventFilter } = {}

    Object.entries(trackingTokens).map(([symbol, tokenAddress]: string[]) => {
        const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider)
        tokenContracts[symbol] = tokenContract
        receiveFilters[symbol] = tokenContract.filters.Transfer(null, seedWallet)
        sendFilters[symbol] = tokenContract.filters.Transfer(seedWallet, null)
    })

    const bloomedAddresses: string[] = []
    
    await promiseSequenceMap(
        Object.entries(trackingTokens),
        async ([symbol]) => {
            console.log({
                sedFilter: sendFilters[symbol],
                receiveFilter: receiveFilters[symbol],
                symbol,
            })
            // const received = await provider.getLogs(receiveFilters[symbol])
            // const sent = await provider.getLogs(sendFilters[symbol])
            const received = await tokenContracts[symbol].queryFilter(receiveFilters[symbol], 31640559)
            received.forEach((receiveEvent) => {
                bloomedAddresses.push(tokenContracts[symbol].interface.parseLog(receiveEvent).args.from)
            })
            const sent = await tokenContracts[symbol].queryFilter(sendFilters[symbol], 31640559)
            sent.forEach((sentEvent) => {
                bloomedAddresses.push(tokenContracts[symbol].interface.parseLog(sentEvent).args.to)
            })
        }
    )

    console.log({
        bloomedAddresses
    })

    
    //   const elevationHelperContract = new ethers.Contract(elevationHelperAddress, elevationHelperAbi, provider)
    //   const [
    //     elev,
    //     round,
    //     totem,
    //   ] = output.topics.slice(1).map((topic) => parseInt(topic))
    //   console.log({
    //     elev,
    //     round,
    //     totem,
    //   })
    
    
    //   provider.on(filter, (log, event) => {
    //     console.log({
    //       log,
    //       event,
    //     })
    //   })


};

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
