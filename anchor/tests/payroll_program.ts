// Import Anchor framework and web3.js libraries
import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PayrollProgram } from "../target/types/payroll_program";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

describe("Payroll Program - Comprehensive Tests", () => {
   // Provder connects us to the blockchain (local or devnet)
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    // Get the program instance to call its methods
    const program = anchor.workspace.PayrollProgram as Program<PayrollProgram>;

    // The authority is whoever is running the tests (wallet owner)
    const authority = provider.wallet as anchor.Wallet;

    // Organisation name and its derived account address (PDA)
    const orgName = 'TestOrg';
    let orgPda: PublicKey;
    let orgBump: number;

    // Create the workers for testing
    const worker1 = Keypair.generate();
    const worker2 = Keypair.generate();
    const worker3 = Keypair.generate();

    // PDAs (Program Derived Addresses) for each workers
    let worker1Pda: PublicKey;
    let worker2Pda: PublicKey;
    let worker3Pda: PublicKey;

   // Salary amounts in lamports (1 SOL = 1 billion lamports)
   const salary1 = new BN(1 * LAMPORTS_PER_SOL);
   const salary2 = new BN(1.5 * LAMPORTS_PER_SOL);
   const salary3 = new BN(2 * LAMPORTS_PER_SOL);

  
    // Get the sol balance of any account
    async function getBalance(pubkey: PublicKey): Promise<number> {
        return await provider.connection.getBalance(pubkey);
    }

    // Airdrop some SOL to the test accounts
    async function airdrop(pubkey: PublicKey, amount: number = 2 * LAMPORTS_PER_SOL) {
        const sig = await provider.connection.requestAirdrop(pubkey, amount);
        const latestBlockHash = await provider.connection.getLatestBlockhash();

        await provider.connection.confirmTransaction({
            signature: sig,
            blockhash: latestBlockHash.blockhash,
            lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        });
    }

    before('Setup test accounts', async () => {
        // Derive the organisation PDA using program-specific seeds
        // Seeds 'org' + authority wallet + organisation name

       ;[orgPda, orgBump] = PublicKey.findProgramAddressSync([
            Buffer.from('org'),
            authority.publicKey.toBuffer(),
            Buffer.from(orgName),
        ],
        program.programId);

        // Derive workers PDAs
        // Seeds: 'worker' + org address + worker public key
        ;[worker1Pda] = PublicKey.findProgramAddressSync([
            Buffer.from('worker'),
            orgPda.toBuffer(),
            worker1.publicKey.toBuffer()
        ],
        program.programId);

        ;[worker2Pda] = PublicKey.findProgramAddressSync([
            Buffer.from('worker'),
            orgPda.toBuffer(),
            worker2.publicKey.toBuffer()
        ],
        program.programId)

        ;[worker3Pda] = PublicKey.findProgramAddressSync([
            Buffer.from('worker'),
            orgPda.toBuffer(),
            worker3.publicKey.toBuffer()
        ],
        program.programId)
        });

    describe('1. Organisation Creation (create_org)', () => {
        it('should successfully create an organisation', async () => {
            // Call the create_org method on our smart contract

            await program.methods.createOrg(orgName).accounts({
                authority: authority.publicKey,
            }).rpc();

            // fetch the created organisation account
            const orgAccount = await program.account.organisation.fetch(orgPda);

            // Assert (verify) that all data was stored correctly
            assert.equal(orgAccount.name, orgName, 'Organisation name mismatch');
            assert.equal(orgAccount.treasury.toNumber(), 0, 'Initial treasury should be 0');
            assert.equal(orgAccount.workersCount.toNumber(), 0, 'Initial workers count should be 0');
            assert.equal(orgAccount.bump, orgBump, 'Bump seed mismatch');
        });

        it('Should fail to create org with name exceeding 100 characters', async () => {
            const longName = 'a'.repeat(101);
    
            try {
                await program.methods.createOrg(longName).accounts({
                    authority: authority.publicKey
                }).rpc();
    
                assert.fail('Should have failed with name length error');
            } catch (error: unknown) {
                const errorStr = (error as Error).toString();
                // Accept either InvalidName error or PDA seed length error
                assert.isTrue(
                    errorStr.includes('InvalidName') ||
                    errorStr.includes('Max seed length exceeded') ||
                    errorStr.includes('maximum') ||
                    errorStr.includes('seeds')
                )
            }
        });

        it('Should fail to create duplicate organisation with same name', async () => {
            try {
                await program.methods.createOrg(orgName).accounts({
                    authority: authority.publicKey
                }).rpc();

                assert.fail('Should have failed due to account already initialized');
            } catch (error: unknown) {
                assert.isTrue((error as Error).toString().includes('already in use'));
            }
        });

        it('Should allow different authorities to create orgs with same name', async () => {
            const newAuthority = Keypair.generate();
            await airdrop(newAuthority.publicKey);

            const [newOrgPda] = PublicKey.findProgramAddressSync([
                Buffer.from('org'),
                newAuthority.publicKey.toBuffer(),
                Buffer.from(orgName)
            ],
             program.programId);

            
            await program.methods.createOrg(orgName).accounts({
                authority: newAuthority.publicKey
            }).signers([newAuthority]).rpc();

            const orgAccount = await program.account.organisation.fetch(newOrgPda);
            assert.equal(orgAccount.authority.toBase58(), newAuthority.publicKey.toBase58())
        })
    });
    
})