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
    LAMPORTS_PER_SOL,
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
        throw new Error(`Invalid RPC endpoints: ${RPC_URL}...`);
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
        throw new Error(`Invalid RPC endpoints: ${RPC_URL}...`);
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

 export const createOrganisation = async (
    program: Program<PayrollProgram>,
    publicKey: PublicKey,
    name: string
 ): Promise<TransactionSignature> => {
    const tx = await program.methods.createOrg(name).accounts({
        authority: publicKey,
    })
    .rpc();

    return tx;
 }

 export const addWorker = async (
    program: Program<PayrollProgram>,
    workerPublicKey: PublicKey,
    salaryInSol: number,
    orgPda: string,
    publicKey: PublicKey
 ): Promise<TransactionSignature> => {

    const tx = program.methods.addWorker(new BN(salaryInSol * LAMPORTS_PER_SOL)).accountsPartial({
        org: new PublicKey(orgPda),
        workerPubkey: workerPublicKey,
        authority: publicKey,
        systemProgram: SystemProgram.programId
    })
    .rpc();

    return tx;
 }

 export const fundTreasury = async (
    program: Program<PayrollProgram>, 
    publicKey: PublicKey, 
    amountInSol: number,
    orgPda: string): Promise<TransactionSignature> => {

    const tx = program.methods.fundTreasury(new BN(amountInSol * LAMPORTS_PER_SOL)).accountsPartial({
        org: new PublicKey(orgPda),
        authority: publicKey,
        systemProgram: SystemProgram.programId
    })
    .rpc();

    return tx;
 }

 export const processPayroll = async (
    program: Program<PayrollProgram>,
    orgPda: string,
    publicKey: PublicKey,
    cycleTimestamp?: number
 ): Promise<TransactionSignature> => {

    const timestamp = cycleTimestamp || Math.floor(Date.now() / 1000);

    // Fetch all the workers from blockchain
    const allWorkers = (await program.account.worker.all()) as {
        publicKey: PublicKey;
        account: RawWorker;
    }[];
    
    // Filter to only workers in the organisation
    const orgWorkers = allWorkers.filter(
        (w) => w.account.org.toBase58() === orgPda
    );

    // Build remaining accounts array
    // Smart contract expects alternating PDAs and wallet accounts
    const remainingAccounts: AccountMeta[] = orgWorkers.flatMap((w) => [
        { pubkey: w.publicKey, isSigner: false, isWritable: true},
        { pubkey: w.account.workerPubkey, isSigner: false, isWritable: true}
    ]);

    // Execute payroll processing
    const tx = await program.methods.processPayroll(new BN(timestamp)).accountsPartial({
        org: new PublicKey(orgPda),
        authority: publicKey,
        systemProgram: SystemProgram.programId
    })
    .remainingAccounts(remainingAccounts)
    .rpc();

    return tx;

 }

 export const withdrawFromTreasury = async (
    program: Program<PayrollProgram>,
    orgPda: string,
    publicKey: PublicKey,
    amountInSol: number
 ): Promise<TransactionSignature> => {

    const tx = await program.methods.withdraw(new BN(amountInSol * LAMPORTS_PER_SOL)).accountsPartial({
        org: new PublicKey(orgPda),
        authority: publicKey,
        systemProgram: SystemProgram.programId
    }).rpc();

    return tx;
 }

 export const fetchUserOrganisations = async (
    program: Program<PayrollProgram>,
    publicKey: PublicKey
 ): Promise<Organization[]> => {

   const organisations = await program.account.organisation.all() as {
    publicKey: PublicKey;
    account: RawOrganisation;
   }[];

  // Filter to only organisations where this wallet is the authority (creator)
  const userOrgs = organisations.filter((org) => org.account.authority.toBase58() === publicKey.toBase58());

  // Convert raw blockchain data to UI-friendly format
  return serializeOrganisation(userOrgs);
 }

 const serializeOrganisation = (
    organisations: {
        publicKey: PublicKey;
        account: RawOrganisation;
    }[]
 ): Organization[] => {
   
    return organisations.map((org) => ({
        publicKey: org.publicKey.toBase58(),
        authority: org.account.authority.toBase58(),
        name: org.account.name,
        treasury: org.account.treasury.toNumber() / LAMPORTS_PER_SOL,
        workersCount: org.account.workersCount.toNumber(),
        createdAt: Number(org.account.createdAt || 0),
        bump: org.account.bump
    }))
    .sort((a , b) => b.createdAt - a.createdAt);
 }
 
 export const fetchAllOrganisations = async (program: Program<PayrollProgram>): Promise<Organization[]> => {
    const organisations = await program.account.organisation.all() as {
        publicKey: PublicKey;
        account: RawOrganisation;
    }[];

    return serializeOrganisation(organisations);
 }

 export const fetchOrganisationDetails = async (
    program: Program<PayrollProgram>,
    orgPda: string
 ): Promise<Organization> => {

    const org = (await program.account.organisation.fetch(new PublicKey(orgPda))) as RawOrganisation;
    return {
        publicKey: orgPda,
        authority: org.authority.toBase58(),
        name: org.name,
        treasury: org.treasury.toNumber() / LAMPORTS_PER_SOL,
        workersCount: org.workersCount.toNumber(),
        createdAt: Number(org.createdAt || 0),
        bump: org.bump
    }
   
 }

 export const fetchOrganisationWorkers = async (
    orgPda: string,
    program: Program<PayrollProgram>
 ): Promise<Worker[]> => {

    const workers = (await program.account.worker.all()) as {
        publicKey: PublicKey;
        account: RawWorker
    }[];

    // Filter to only workers in the organisation
    const orgWorkers = workers.filter((w) => w.account.org.toBase58() === orgPda);

    return serializeWorkers(orgWorkers);
 }

 const serializeWorkers = (
    workers: {
        publicKey: PublicKey;
        account: RawWorker
    }[]
 ): Worker[] => {
    return workers.map((w) => ({
        publicKey: w.publicKey.toBase58(),
        org: w.account.org.toBase58(),
        workerPubkey: w.account.workerPubkey.toBase58(),
        salary: (w.account.salary.toNumber() / LAMPORTS_PER_SOL),
        lastPaidCycle: Number(w.account.lastPaidCycle || 0),
        createdAt: Number(w.account.createdAt || 0),
        bump: w.account.bump
    }))
    .sort((a , b) => b.createdAt - a.createdAt);
 }

 export const fetchWorkerDetails = async (
    workerPda: string,
    program: Program<PayrollProgram>
 ): Promise<Worker> => {
    const worker = (await program.account.worker.fetch(new PublicKey(workerPda))) as RawWorker;
    return {
        publicKey: workerPda,
        org: worker.org.toBase58(),
        workerPubkey: worker.workerPubkey.toBase58(),
        salary: (worker.salary.toNumber() / LAMPORTS_PER_SOL),
        lastPaidCycle: Number(worker.lastPaidCycle || 0),
        createdAt: Number(worker.createdAt || 0),
        bump: worker.bump
    }
 }

 export const fetchWorkersByWallet = async (
    walletPublicKey: PublicKey,
    program: Program<PayrollProgram>
 ): Promise<Worker[]> => {

    const allWorkers = (await program.account.worker.all()) as {
        publicKey: PublicKey;
        account: RawWorker;
    }[];

    const userWorkers = allWorkers.filter((w) => w.account.workerPubkey.toBase58() === walletPublicKey.toBase58());

    return serializeWorkers(userWorkers);
 }

 export const calculateNextPayrollCycle = (
    lastPaidCycle: number,
    cycleType: 'weekly' | 'bi-weekly' | 'monthly' = 'monthly',
 ): Date => {
    const lastPaid = new Date(lastPaidCycle * 1000);
    const next = new Date(lastPaid);

    switch (cycleType) {
        case 'weekly':
            next.setDate(next.getDate() + 7);
            break;
        case 'bi-weekly':
            next.setDate(next.getDate() + 14);
            break;
        case 'monthly':
            next.setMonth(next.getMonth() + 1);
            break;
    }

    return next;
 }

 export const checkPayrollDue = async (
    orgPda: string,
    program: Program<PayrollProgram>,
    cycleType: 'weekly' | 'bi-weekly' | 'monthly' = 'monthly',
 ): Promise<{ due: boolean, workers: Worker[] }> => {
    const workers = await fetchOrganisationWorkers(orgPda, program);

    const now = Date.now();
    const cycleMs = {
        weekly: 7 * 24 * 60 * 60 * 1000,
        'bi-weekly': 14 * 24 * 60 * 60 * 1000,
        monthly: 30 * 24 * 60 * 60 * 1000,
    }

    const dueWorkers = workers.filter((w) => {
        const timeSinceLastPaid = now - w.lastPaidCycle;
        return timeSinceLastPaid >= cycleMs[cycleType];
    });

    return {
        due: dueWorkers.length > 0,
        workers: dueWorkers,
    }
 }
 
 export const getOrgsanisationBalance = async (
    program: Program<PayrollProgram>,
    orgPda: string
 ) => {
    const org = await program.account.organisation.fetch(new PublicKey(orgPda)) as RawOrganisation;

    return org.treasury.toNumber() / LAMPORTS_PER_SOL;
 }

 export const calculatePayrollCost = async (
    program: Program<PayrollProgram>,
    orgPda: string
 ) => {
   const workers = await fetchOrganisationWorkers(orgPda, program);
   return workers.reduce((total, worker) => total + worker.salary, 0);
 }

 export const deriveOrganisationPda = (
    authority: PublicKey,
    name: string
 ): [PublicKey, number] => {

    return PublicKey.findProgramAddressSync(
        [Buffer.from('org'), authority.toBuffer(), Buffer.from(name)],
        PROGRAM_ID
    )
 }

 export const deriveWorkerPda = (
    orgPda: string,
    workerPublicKey: PublicKey
 ): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from('worker'), new PublicKey(orgPda).toBuffer(), workerPublicKey.toBuffer()],
        PROGRAM_ID
    )
 }