export const TruncateAddress = (address: string): string  => {
    if (!address) {
        throw new Error('Invalid address')
    }

    const truncated = `${address.slice(0,4)}...${address.slice(-4)}`;
    return truncated;
}

export const getClusterUrl = (cluster: string): string => {

    const clusterUrls: { [key: string]: string } = {
        'mainnet-beta': 'https://api.mainnet-beta.solana.com',
        'devnet': 'https://api.devnet.solana.com',
        'testnet': 'https://api.testnet.solana.com',
        'localhost': 'http://localhost:8899',
    } 

    return clusterUrls[cluster]
}

export const getCluster = (cluster: string): string => {
    const clusters: { [key: string]: string } = {
        'https://api.mainnet-beta.solana.com': 'mainnet-beta',
        'https://api.devnet.solana.com': 'devnet',
        'https://api.testnet.solana.com': 'testnet',
        'http://localhost:8899': 'localhost',
    }
    return clusters[getClusterUrl(cluster)]
}