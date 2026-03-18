import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import type { PayrollProgram } from "../anchor/target/types/payroll_program";
import idlJson from '@/anchor/target/idl/payroll_program.json';
import {
    Connection,
    PublicKey,
    SystemProgram,
    TransactionSignature,
    Transaction,
    AccountMeta,
} from '@solana/web3.js';
import { Organization, Worker } from '@/utils/interface';
import { getClusterUrl } from '../utils/helper';

// RawOrganisation matches the data structure from our solana program
// These are the exact fields stored on-chain for organisations
type RawOrganisation = {
    authority: PublicKey;
    name: string;
    treasury: BN;
    workersCount: BN;
    createdAt: BN;
    bump: number;
} 

// RawWorker matches the data structure for employee records on-chain
type RawWorker = {
    org: PublicKey;
    workerPubkey: PublicKey;
    salary: BN;
    lastPaidCycle: BN;
    createdAt: BN;
    bump: number;
}

// Load IDL as our PayrollProgram Type
const idl = idlJson as PayrollProgram;

// The public key of our deployed solana program
const PROGRAM_ID = new PublicKey(idlJson.address);

const CLUSTER: string = process.env.NEXT_PUBLIC_CLUSTER || 'devnet';

const RPC_URL: string = getClusterUrl(CLUSTER);

// Log these for debugging purposes
console.log('Cluster:', CLUSTER);
console.log('RPC URL:', RPC_URL);
console.log('Program ID:', PROGRAM_ID.toBase58());

interface SignerWallet {
    publicKey: PublicKey;
    signTransaction: (tx: Transaction) => Promise<Transaction>;
    signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
}

export const getProvider = (publicKey: PublicKey | null,
    signTransaction: (tx: Transaction) => Promise<Transaction>,
 ): Program<PayrollProgram> | null => {

    // Check if the wallet is connected - without this we cant sign transactions
    if (!publicKey || !signTransaction) {
        console.error('Wallet not connected or missing signTransaction');
        return null;
    }

    // Validate the RPC URL format
    if(!RPC_URL || !RPC_URL.startsWith('http://') && !RPC_URL.startsWith('https://')) {
        console.error('Invalid RPC URL:', RPC_URL);
        throw new Error('Invalid RPC endpoints: ${RPC_URL}...');
    }

    // Create connection to Solana cluster
    // 'confirmed' commitment means we wait for blockconfirmation 
    const connection = new Connection(RPC_URL, 'confirmed');

    // Create wallet object compatible with Anchor
    const wallet: SignerWallet = {
        publicKey,
        signTransaction,
        signAllTransactions: async (txs: Transaction[]) => {
            // Sign multiple transactions sequentially
            const signed: Transaction[] = [];
            for (const tx of txs) {
                signed.push(await signTransaction(tx));
            }
            return signed;
        }
    }

    // Create Anchor provider - this combines connection + wallet + commitment level
    const provider = new AnchorProvider(
        connection,
        wallet as unknown as Wallet,
        { commitment: 'processed' } // Process transactions quickly 

    );

    // Return the program instance - this is our main interface to the smart contract
    return new Program(idl, provider);

 }

 export const getProviderReadOnly = (): Program<PayrollProgram> | null => {

    // Validate the RPC URL format
    if(!RPC_URL || !RPC_URL.startsWith('http://') && !RPC_URL.startsWith('https://')) {
        console.error('Invalid RPC URL:', RPC_URL);
        throw new Error('Invalid RPC endpoints: ${RPC_URL}...');
    }

    const connection = new Connection(RPC_URL, 'confirmed');

    const wallet: SignerWallet = {
        publicKey: PublicKey.default,
        signTransaction: async () => {
            throw new Error('Read-only provider cannot sign transactions.')
        },
        signAllTransactions: async () => {
            throw new Error('Read-only provider cannot sign transactions.');
        }
    }

    // Create Anchor provider - this combines connection + wallet + commitment level
    const provider = new AnchorProvider(
        connection,
        wallet as unknown as Wallet,
        { commitment: 'processed' } // Process transactions quickly 

    );

    // Return the program instance - this is our main interface to the smart contract
    return new Program(idl, provider);

 }