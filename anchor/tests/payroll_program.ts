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

   // Invalid salary amount
   const invalidSalary = new BN(0);
   const negativeSalary = new BN(-1 * LAMPORTS_PER_SOL);
  
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
        });
    });

    describe('2. Worker Management (add_worker)', () => {
        it('Should successfully add worker to organisation', async () => {
            // Call the add_worker with worker's salary
            await program.methods.addWorker(salary1).accountsPartial({
                org: orgPda,
                workerPubkey: worker1.publicKey,
                authority: authority.publicKey
            }).rpc();

            // Fetch the worker account and verify
            const workerAccount = await program.account.worker.fetch(worker1Pda);
            const orgAccount = await program.account.organisation.fetch(orgPda);

            assert.equal(workerAccount.org.toBase58(), orgPda.toBase58(), 'Worker organisation mismatch');
            assert.equal(workerAccount.workerPubkey.toBase58(), worker1.publicKey.toBase58(), 'Worker public key mismatch');
            assert.equal(workerAccount.lastPaidCycle.toNumber(), 0, 'Worker last paid cycle should be 0');
            assert.equal(orgAccount.workersCount.toNumber(), 1, 'Organisation workers count should be 1');
            assert.equal(workerAccount.salary.toNumber(), salary1.toNumber(), 'Worker salary mismatch');
        });

        it('Should add multiple workers to the same organisation', async () => {
            // Call add_worker for worker 2 and 3
            await program.methods.addWorker(salary2).accountsPartial({
                org: orgPda,
                workerPubkey: worker2.publicKey,
                authority: authority.publicKey
            }).rpc();

            await program.methods.addWorker(salary3).accountsPartial({
                org: orgPda,
                workerPubkey: worker3.publicKey,
                authority: authority.publicKey,
            }).rpc();

            // fetch the organisation account and verify
            const orgAccount = await program.account.organisation.fetch(orgPda);
            const worker2Account = await program.account.worker.fetch(worker2Pda);
            const worker3Account = await program.account.worker.fetch(worker3Pda);

            assert.equal(orgAccount.workersCount.toNumber(), 3, 'Organisation workers count should be 3');
            assert.equal(worker2Account.org.toBase58(), orgPda.toBase58(), 'Worker 2 organisation mismatch');
            assert.equal(worker3Account.org.toBase58(), orgPda.toBase58(), 'Worker 3 organisation mismatch');
            assert.equal(worker2Account.salary.toNumber(), salary2.toNumber(), 'Worker 2 salary mismatch');
            assert.equal(worker3Account.salary.toNumber(), salary3.toNumber(), 'Worker 3 salary mismatch');
            assert.equal(worker2Account.lastPaidCycle.toNumber(), 0, 'Worker 2 last paid cycle should be 0');
            assert.equal(worker3Account.lastPaidCycle.toNumber(), 0, 'Worker 3 last paid cycle should be 0');
            assert.equal(worker2Account.workerPubkey.toBase58(), worker2.publicKey.toBase58(), 'Worker 2 public key mismatch');
            assert.equal(worker3Account.workerPubkey.toBase58(), worker3.publicKey.toBase58(), 'Worker 3 public key mismatch');
        });

        it('Should fail to add worker with 0 salary', async () => {
            try {
                await program.methods.addWorker(invalidSalary).accountsPartial({
                    org: orgPda,
                    workerPubkey: Keypair.generate().publicKey,
                    authority: authority.publicKey,
                }).rpc();

                assert.fail('Should have failed with InvalidSalary error');
            } catch (error: unknown) {
                const errorStr = (error as Error).toString();

                assert.include(errorStr, 'InvalidSalary');
            }
        });

        it('Should fail to add worker with negative salary', async () => {
            try {
                await program.methods.addWorker(negativeSalary).accountsPartial({
                    org: orgPda,
                    workerPubkey: Keypair.generate().publicKey,
                    authority: authority.publicKey,
                }).rpc();
            } catch (error: unknown) {
                const errorStr = (error as Error).toString();

                assert.include(errorStr, 'InvalidSalary');
            }
        });

        it('Should fail seeds creation when an unauthorised passed as authority to add worker', async () => {
            try {
                const unauthorisedKeypair = Keypair.generate();
                await airdrop(unauthorisedKeypair.publicKey);
                await program.methods.addWorker(salary1).accountsPartial({
                    org: orgPda,
                    workerPubkey: Keypair.generate().publicKey,
                    authority: unauthorisedKeypair.publicKey,
                }).signers([unauthorisedKeypair]).rpc();
                assert.fail('Should have failed with seeds constraint error');
            } catch (error: unknown) {
                console.log('Error:', error);
                assert.isDefined(error, 'Expected an error to be thrown');

                const errorStr = (error as Error).toString();
                assert.include(errorStr, 'ConstraintSeeds');
            }
        });
    });

    describe('3. Treasury Funding (fund_treasury)', () => {
        const fundingAmount = new BN(10 * LAMPORTS_PER_SOL);
        it('Should successfully fund organisation treasury', async () => {
            // Get balances before transaction
            const treasuryBefore = await getBalance(orgPda);
            const authorityBalanceBefore = await getBalance(authority.publicKey);
            // Fund the treasury
           const txnSig = await program.methods.fundTreasury(fundingAmount).accountsPartial({
                org: orgPda
            }).rpc();

            // Wait for the blockhash to be processed by the network
            const latestBlockHash = await provider.connection.getLatestBlockhash();
            await provider.connection.confirmTransaction({
                signature: txnSig,
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
            }, 'confirmed');
            
            // Fetch the transaction details (use 'confirmed' or 'finalized' commitment)
            const txDetails = await provider.connection.getTransaction(txnSig, {
                commitment: "confirmed",
                maxSupportedTransactionVersion: 0
            });
            console.log('Transaction details:', txDetails);
            const actualFee = txDetails?.meta?.fee;
            console.log('Actual fee:', actualFee);
            // Get balances after and compare
            const orgAccount = await program.account.organisation.fetch(orgPda);
            const treasuryAfter = await getBalance(orgPda);
            const authorityBalanceAfter = await getBalance(authority.publicKey);
            assert.equal(orgAccount.treasury.toNumber(), fundingAmount.toNumber(), 'organisation treasury should increase');
            assert.equal(treasuryAfter, treasuryBefore + fundingAmount.toNumber(), 'treasury should increase');
            assert.isTrue(authorityBalanceAfter < authorityBalanceBefore, 'authority balance should decrease');
            assert.equal(authorityBalanceAfter, authorityBalanceBefore - actualFee! - fundingAmount.toNumber(), 'authority balance should decrease by the actual fee and the funding amount');
        });

        it('Should accumulate multiple funding transactions', async () => {
            const additionalFund = new BN(5 * LAMPORTS_PER_SOL);

            await program.methods.fundTreasury(additionalFund).accountsPartial({
                org: orgPda,
                authority: authority.publicKey,
            }).rpc();

            const orgAccount = await program.account.organisation.fetch(orgPda);
            const expectedTotal = fundingAmount.add(additionalFund);

            assert.equal(orgAccount.treasury.toNumber(), expectedTotal.toNumber(), 'Treasury should accumulate funds')
        });

        it('Should fail to fund with zero amount', async () => {
            try {
                await program.methods.fundTreasury(new BN(0)).accountsPartial({
                    org: orgPda,
                    authority: authority.publicKey
                });
                assert.fail('Should have failed with InvalidAmount error');
            } catch (error: unknown) {
                const errorStr = (error as Error).toString();
                assert.include(errorStr, 'InvalidAmount');
            }
        });

        it('Should fail when unauthroised user tries to fund treasury', async () => {
            try {
                const unauthorisedKeypair = Keypair.generate();
                await airdrop(unauthorisedKeypair.publicKey);

                await program.methods.fundTreasury(fundingAmount).accountsPartial({
                    org: orgPda,
                    authority: unauthorisedKeypair.publicKey,
                }).signers([unauthorisedKeypair]).rpc();
                assert.fail('Should have failed with seeds constraint error');
            } catch (error: unknown) {
                assert.isDefined(error, 'Expected an error to be thrown');
                const errorStr = (error as Error).toString();
                assert.include(errorStr, 'ConstraintSeeds');
            }
        });
    });
    describe('4. Payroll Processing (process_payroll)', () => {
        it('Should successfully process payroll for all workers', async () => {
            
            const allWorkers = await program.account.worker.all();

            const filteredWorkers = allWorkers.filter(worker => worker.account.org.toBase58() === orgPda.toBase58());
            const cycleTimestamp = new BN (Math.floor(Date.now() / 1000));
            const workersTotalSalary = filteredWorkers.reduce((acc, worker) => acc.add(worker.account.salary), new BN(0));
            
            const orgBalanceBefore = await getBalance(orgPda);
            const worker1BalanceBefore = await getBalance(worker1.publicKey);
            const worker2BalanceBefore = await getBalance(worker2.publicKey);
            const worker3BalanceBefore = await getBalance(worker3.publicKey);

            await program.methods.processPayroll(cycleTimestamp).accountsPartial({
                org: orgPda,
            }).remainingAccounts(filteredWorkers.flatMap(worker => [
                {
                    pubkey: worker.publicKey,
                    isSigner: false,
                    isWritable: true,
                },
                {
                    pubkey: worker.account.workerPubkey,
                    isSigner: false,
                    isWritable: true,
                }
            ])).rpc();

            
            const orgBalanceAfter = await getBalance(orgPda);
            const worker1BalanceAfter = await getBalance(worker1.publicKey);
            const worker2BalanceAfter = await getBalance(worker2.publicKey);
            const worker3BalanceAfter = await getBalance(worker3.publicKey);

             assert.equal(orgBalanceAfter, orgBalanceBefore - workersTotalSalary.toNumber(), 'Organisation treasury should decrease by the total salary amount');
             assert.equal(worker1BalanceAfter, worker1BalanceBefore + salary1.toNumber(), 'Worker 1 balance should increase by their salary');
             assert.equal(worker2BalanceAfter, worker2BalanceBefore + salary2.toNumber(), 'Worker 2 balance should increase by their salary');
             assert.equal(worker3BalanceAfter, worker3BalanceBefore + salary3.toNumber(), 'Worker 3 balance should increase by their salary');

        });
        it("Should correctly update treasury after payroll processing", async () => {

            // Fetch organisation before payroll
            const orgBefore = await program.account.organisation.fetch(orgPda);
            const treasuryBefore = orgBefore.treasury;
        
            console.log("Treasury before payroll:", treasuryBefore.toString());
        
            const allWorkers = await program.account.worker.all();
        
            const filteredWorkers = allWorkers.filter(
                w => w.account.org.toBase58() === orgPda.toBase58()
            );
        
            console.log("Number of workers:", filteredWorkers.length);
        
            // Print each worker salary
            filteredWorkers.forEach((worker, index) => {
                console.log(
                    `Worker ${index + 1} salary:`,
                    worker.account.salary.toString()
                );
            });
        
            const cycleTimestamp = new BN(Math.floor(Date.now() / 1000));
            console.log("Payroll cycle timestamp:", cycleTimestamp.toString());
        
            // Calculate total salary
            const workersTotalSalary = filteredWorkers.reduce(
                (acc, worker) => acc.add(worker.account.salary),
                new BN(0)
            );
        
            console.log("Total salary to be paid:", workersTotalSalary.toString());
        
            // Process payroll
           const txnSig = await program.methods
                .processPayroll(cycleTimestamp)
                .accountsPartial({
                    org: orgPda,
                })
                .remainingAccounts(
                    filteredWorkers.flatMap(worker => [
                        {
                            pubkey: worker.publicKey,
                            isSigner: false,
                            isWritable: true,
                        },
                        {
                            pubkey: worker.account.workerPubkey,
                            isSigner: false,
                            isWritable: true,
                        }
                    ])
                )
                .rpc();
                const latestBlockHash = await provider.connection.getLatestBlockhash();
                await provider.connection.confirmTransaction({
                    signature: txnSig,
                    blockhash: latestBlockHash.blockhash,
                    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                }, 'confirmed');
        
            // Fetch organisation after payroll
            const orgAfter = await program.account.organisation.fetch(orgPda);
            const treasuryAfter = orgAfter.treasury;
        
            console.log("Treasury after payroll:", treasuryAfter.toString());
        
            const expectedTreasury = treasuryBefore.sub(workersTotalSalary);
        
            console.log("Expected treasury after payroll:", expectedTreasury.toString());
        
            // Assertion
            assert.equal(
                treasuryAfter.toString(),
                expectedTreasury.toString(),
                "Treasury should decrease by the total salary paid"
            );
        });
      })
});