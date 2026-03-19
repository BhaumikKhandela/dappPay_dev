import { tool } from "ai";
import { z } from "zod";
import { PublicKey, Transaction }  from '@solana/web3.js';
import { 
    getProvider,
    fetchUserOrganisations,
    fetchOrganisationDetails,
    createOrganisation,
    addWorker,
    fundTreasury,
    processPayroll,
    withdrawFromTreasury,
    fetchAllOrganisations,
    fetchOrganisationWorkers,
    fetchWorkerDetails,
    fetchWorkersByWallet,
    calculateNextPayrollCycle,
    checkPayrollDue,
    getOrgsanisationBalance,
    calculatePayrollCost,
    deriveOrganisationPda,
    deriveWorkerPda,
    getProviderReadOnly
 } from '@/services/blockchain';


 let walletContext: {
    publicKey: PublicKey | null;
    signTransaction: ((tx: Transaction) => Promise<Transaction>) | null;
 } = {
    publicKey: null,
    signTransaction: null,
 }

export const setWalletContext = (
    publicKey: PublicKey | null,
    signTransaction: ((tx: Transaction) => Promise<Transaction>) | null,
) => {
    walletContext = { publicKey, signTransaction}
}

const getWritableProgram = () => {
    if (!walletContext.publicKey || !walletContext.signTransaction) {
        return {
            error: 'Wallet not connected. Please connect your wallet first.'
        } as const;
    }

    const program = getProvider(walletContext.publicKey, walletContext.signTransaction);
    if (!program) {
        return {
            error: 'Failed to initialize blockchain program.'
        } as const;
    }

    return { program } as const;
};

const getReadOnlyProgram = () => {
    const program = getProviderReadOnly();
    if (!program) {
        return {
            error: 'Failed to initialize read-only blockchain program.'
        } as const;
    }

    return { program } as const;
};

const parsePublicKey = (value: string, fieldName: string) => {
    try {
        return new PublicKey(value);
    } catch {
        throw new Error(`Invalid ${fieldName}: "${value}"`);
    }
};

const formatError = (prefix: string, error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `${prefix}: ${errorMessage}`;
};

export const blockchainMcpTools = {

    create_organisation: tool({
        description: 'Create a new organisation on the blockchain. Requires wallet connection.',
        inputSchema: z.object({
            name: z.string().describe('Name of the organisation to create.'),
        }),
        execute: async ({ name }) => {
            const writable = getWritableProgram();
            if ('error' in writable) return writable;

            try {
              const { program } = writable;
              const authority = walletContext.publicKey as PublicKey;
              const signature = await createOrganisation(
                program,
                authority,
                name
              );

              const [orgPda] = deriveOrganisationPda(authority, name);

              return {
                success: true,
                message: `Organisation "${name}" created successfully.`,
                signature,
                orgPda: orgPda.toBase58(),
              }

            } catch (error: unknown) {
                return {
                    error: formatError('Failed to create organisation', error),
                }
            }
        }
    }),

    add_worker: tool({
        description: 'Add a worker to an organisation. Requires wallet connection.',
        inputSchema: z.object({
            orgPda: z.string().describe('Organisation PDA in base58 format.'),
            workerPublicKey: z.string().describe('Worker wallet public key in base58 format.'),
            salaryInSol: z.number().positive().describe('Worker salary per cycle in SOL.'),
        }),
        execute: async ({ orgPda, workerPublicKey, salaryInSol }) => {
            const writable = getWritableProgram();
            if ('error' in writable) return writable;

            try {
                const { program } = writable;
                const authority = walletContext.publicKey as PublicKey;
                const workerPk = parsePublicKey(workerPublicKey, 'workerPublicKey');
                const signature = await addWorker(program, workerPk, salaryInSol, orgPda, authority);
                const [workerPda] = deriveWorkerPda(orgPda, workerPk);

                return {
                    success: true,
                    message: 'Worker added successfully.',
                    signature,
                    workerPda: workerPda.toBase58(),
                };
            } catch (error: unknown) {
                return {
                    error: formatError('Failed to add worker', error),
                };
            }
        },
    }),

    fund_treasury: tool({
        description: 'Fund an organisation treasury in SOL. Requires wallet connection.',
        inputSchema: z.object({
            orgPda: z.string().describe('Organisation PDA in base58 format.'),
            amountInSol: z.number().positive().describe('Amount in SOL to fund.'),
        }),
        execute: async ({ orgPda, amountInSol }) => {
            const writable = getWritableProgram();
            if ('error' in writable) return writable;

            try {
                const { program } = writable;
                const authority = walletContext.publicKey as PublicKey;
                const signature = await fundTreasury(program, authority, amountInSol, orgPda);

                try {
                    const newBalance = await getOrgsanisationBalance(program, orgPda);

                    return {
                        success: true,
                        message: 'Treasury funded successfully.',
                        signature,
                        balance: newBalance,
                    };
                } catch (balanceError: unknown) {
                    return {
                        success: true,
                        message: 'Treasury funded successfully, but failed to fetch updated balance.',
                        signature,
                        balance: null,
                        warning: formatError('Balance refresh failed', balanceError),
                    };
                }
            } catch (error: unknown) {
                return {
                    error: formatError('Failed to fund treasury', error),
                };
            }
        },
    }),

    process_payroll: tool({
        description: 'Process payroll for all workers in an organisation. Requires wallet connection.',
        inputSchema: z.object({
            orgPda: z.string().describe('Organisation PDA in base58 format.'),
            cycleTimestamp: z.number().int().positive().optional().describe('Unix timestamp for payroll cycle (seconds).'),
        }),
        execute: async ({ orgPda, cycleTimestamp }) => {
            const writable = getWritableProgram();
            if ('error' in writable) return writable;

            try {
                const { program } = writable;
                const authority = walletContext.publicKey as PublicKey;
                const signature = await processPayroll(program, orgPda, authority, cycleTimestamp);

                try {
                    const remainingBalance = await getOrgsanisationBalance(program, orgPda);

                    return {
                        success: true,
                        message: 'Payroll processed successfully.',
                        signature,
                        balance: remainingBalance,
                    };
                } catch (balanceError: unknown) {
                    return {
                        success: true,
                        message: 'Payroll processed successfully, but failed to fetch updated balance.',
                        signature,
                        balance: null,
                        warning: formatError('Balance refresh failed', balanceError),
                    };
                }
            } catch (error: unknown) {
                return {
                    error: formatError('Failed to process payroll', error),
                };
            }
        },
    }),

    withdraw_from_treasury: tool({
        description: 'Withdraw SOL from organisation treasury. Requires wallet connection.',
        inputSchema: z.object({
            orgPda: z.string().describe('Organisation PDA in base58 format.'),
            amountInSol: z.number().positive().describe('Amount in SOL to withdraw.'),
        }),
        execute: async ({ orgPda, amountInSol }) => {
            const writable = getWritableProgram();
            if ('error' in writable) return writable;

            try {
                const { program } = writable;
                const authority = walletContext.publicKey as PublicKey;
                const signature = await withdrawFromTreasury(program, orgPda, authority, amountInSol);

                try {
                    const remainingBalance = await getOrgsanisationBalance(program, orgPda);

                    return {
                        success: true,
                        message: 'Treasury withdrawal completed successfully.',
                        signature,
                        balance: remainingBalance,
                    };
                } catch (balanceError: unknown) {
                    return {
                        success: true,
                        message: 'Treasury withdrawal completed successfully, but failed to fetch updated balance.',
                        signature,
                        balance: null,
                        warning: formatError('Balance refresh failed', balanceError),
                    };
                }
            } catch (error: unknown) {
                return {
                    error: formatError('Failed to withdraw from treasury', error),
                };
            }
        },
    }),

    fetch_user_organisations: tool({
        description: 'Fetch organisations owned by the connected wallet.',
        inputSchema: z.object({}),
        execute: async () => {
            if (!walletContext.publicKey) {
                return {
                    error: 'Wallet not connected. Please connect your wallet first.'
                };
            }

            const readOnly = getReadOnlyProgram();
            if ('error' in readOnly) return readOnly;

            try {
                const { program } = readOnly;
                const authority = walletContext.publicKey as PublicKey;
                const organisations = await fetchUserOrganisations(program, authority);

                return {
                    success: true,
                    organisations,
                    count: organisations.length,
                };
            } catch (error: unknown) {
                return {
                    error: formatError('Failed to fetch user organisations', error),
                };
            }
        },
    }),

    fetch_all_organisations: tool({
        description: 'Fetch all organisations from the blockchain.',
        inputSchema: z.object({}),
        execute: async () => {
            const readOnly = getReadOnlyProgram();
            if ('error' in readOnly) return readOnly;

            try {
                const { program } = readOnly;
                const organisations = await fetchAllOrganisations(program);

                return {
                    success: true,
                    organisations,
                    count: organisations.length,
                };
            } catch (error: unknown) {
                return {
                    error: formatError('Failed to fetch organisations', error),
                };
            }
        },
    }),

    fetch_organisation_details: tool({
        description: 'Fetch details for a specific organisation.',
        inputSchema: z.object({
            orgPda: z.string().describe('Organisation PDA in base58 format.'),
        }),
        execute: async ({ orgPda }) => {
            const readOnly = getReadOnlyProgram();
            if ('error' in readOnly) return readOnly;

            try {
                const { program } = readOnly;
                const organisation = await fetchOrganisationDetails(program, orgPda);

                return {
                    success: true,
                    organisation,
                };
            } catch (error: unknown) {
                return {
                    error: formatError('Failed to fetch organisation details', error),
                };
            }
        },
    }),

    fetch_organisation_workers: tool({
        description: 'Fetch all workers for a specific organisation.',
        inputSchema: z.object({
            orgPda: z.string().describe('Organisation PDA in base58 format.'),
        }),
        execute: async ({ orgPda }) => {
            const readOnly = getReadOnlyProgram();
            if ('error' in readOnly) return readOnly;

            try {
                const { program } = readOnly;
                const workers = await fetchOrganisationWorkers(orgPda, program);

                return {
                    success: true,
                    workers,
                    count: workers.length,
                };
            } catch (error: unknown) {
                return {
                    error: formatError('Failed to fetch organisation workers', error),
                };
            }
        },
    }),

    fetch_worker_details: tool({
        description: 'Fetch details for a specific worker PDA.',
        inputSchema: z.object({
            workerPda: z.string().describe('Worker PDA in base58 format.'),
        }),
        execute: async ({ workerPda }) => {
            const readOnly = getReadOnlyProgram();
            if ('error' in readOnly) return readOnly;

            try {
                const { program } = readOnly;
                const worker = await fetchWorkerDetails(workerPda, program);

                return {
                    success: true,
                    worker,
                };
            } catch (error: unknown) {
                return {
                    error: formatError('Failed to fetch worker details', error),
                };
            }
        },
    }),

    fetch_workers_by_wallet: tool({
        description: 'Fetch worker records associated with a wallet address.',
        inputSchema: z.object({
            walletPublicKey: z.string().optional().describe('Wallet public key in base58 format. If not provided, the connected wallet will be used.'),
        }),
        execute: async ({ walletPublicKey }) => {
          
            const targetWalletPk = walletPublicKey ? parsePublicKey(walletPublicKey, 'walletPublicKey') : walletContext.publicKey;
            if (!targetWalletPk) {
                return {
                    error: 'Wallet not connected. Please connect your wallet first.'
                };
            }
            const readOnly = getReadOnlyProgram();
            if ('error' in readOnly) return readOnly;
            try {
                const { program } = readOnly;
                const workers = await fetchWorkersByWallet(targetWalletPk, program);

                return {
                    success: true,
                    workers,
                    count: workers.length,
                };
            } catch (error: unknown) {
                return {
                    error: formatError('Failed to fetch workers by wallet', error),
                };
            }
        },
    }),

    check_payroll_due: tool({
        description: 'Check whether payroll is due for an organisation.',
        inputSchema: z.object({
            orgPda: z.string().describe('Organisation PDA in base58 format.'),
            cycleType: z.enum(['weekly', 'bi-weekly', 'monthly']).optional().describe('Payroll cycle type.'),
        }),
        execute: async ({ orgPda, cycleType }) => {
            const readOnly = getReadOnlyProgram();
            if ('error' in readOnly) return readOnly;

            try {
                const { program } = readOnly;
                const result = await checkPayrollDue(orgPda, program, cycleType);

                return {
                    success: true,
                    ...result,
                    count: result.workers.length,
                };
            } catch (error: unknown) {
                return {
                    error: formatError('Failed to check payroll due status', error),
                };
            }
        },
    }),

    calculate_next_payroll_date: tool({
        description: 'Calculate the next payroll date from last paid cycle timestamp.',
        inputSchema: z.object({
            lastPaidCycle: z.number().int().nonnegative().describe('Unix timestamp (in seconds) for the last paid cycle.'),
            cycleType: z.enum(['weekly', 'bi-weekly', 'monthly']).optional().describe('Payroll cycle type.'),
        }),
        execute: async ({ lastPaidCycle, cycleType }) => {
            try {
                const nextPayrollDate = calculateNextPayrollCycle(lastPaidCycle, cycleType);

                return {
                    success: true,
                    nextPayrollDate: nextPayrollDate.toISOString(),
                    nextPayrollTimestamp: Math.floor(nextPayrollDate.getTime() / 1000),
                    cycleType: cycleType || 'monthly',
                };
            } catch (error: unknown) {
                return {
                    error: formatError('Failed to calculate next payroll date', error),
                };
            }
        },
    }),

    get_organisation_balance: tool({
        description: 'Get the current treasury balance of an organisation in SOL.',
        inputSchema: z.object({
            orgPda: z.string().describe('Organisation PDA in base58 format.'),
        }),
        execute: async ({ orgPda }) => {
            const readOnly = getReadOnlyProgram();
            if ('error' in readOnly) return readOnly;

            try {
                const { program } = readOnly;
                const balance = await getOrgsanisationBalance(program, orgPda);

                return {
                    success: true,
                    balance,
                };
            } catch (error: unknown) {
                return {
                    error: formatError('Failed to fetch organisation balance', error),
                };
            }
        },
    }),

    calculate_total_payroll_cost: tool({
        description: 'Calculate total payroll cost for an organisation.',
        inputSchema: z.object({
            orgPda: z.string().describe('Organisation PDA in base58 format.'),
        }),
        execute: async ({ orgPda }) => {
            const readOnly = getReadOnlyProgram();
            if ('error' in readOnly) return readOnly;

            try {
                const { program } = readOnly;
                const totalCost = await calculatePayrollCost(program, orgPda);

                return {
                    success: true,
                    totalCost,
                };
            } catch (error: unknown) {
                return {
                    error: formatError('Failed to calculate payroll cost', error),
                };
            }
        },
    }),

    derive_organisation_pda: tool({
        description: 'Derive an organisation PDA using authority wallet and organisation name.',
        inputSchema: z.object({
            authorityPublicKey: z.string().describe('Authority wallet public key in base58 format.'),
            name: z.string().describe('Organisation name used for PDA derivation.'),
        }),
        execute: async ({ authorityPublicKey, name }) => {
            try {
                const authority = parsePublicKey(authorityPublicKey, 'authorityPublicKey');
                const [pda, bump] = deriveOrganisationPda(authority, name);

                return {
                    success: true,
                    orgPda: pda.toBase58(),
                    bump,
                };
            } catch (error: unknown) {
                return {
                    error: formatError('Failed to derive organisation PDA', error),
                };
            }
        },
    }),

    derive_worker_pda: tool({
        description: 'Derive a worker PDA from organisation PDA and worker wallet.',
        inputSchema: z.object({
            orgPda: z.string().describe('Organisation PDA in base58 format.'),
            workerPublicKey: z.string().describe('Worker wallet public key in base58 format.'),
        }),
        execute: async ({ orgPda, workerPublicKey }) => {
            try {
                const workerPk = parsePublicKey(workerPublicKey, 'workerPublicKey');
                const [pda, bump] = deriveWorkerPda(orgPda, workerPk);

                return {
                    success: true,
                    workerPda: pda.toBase58(),
                    bump,
                };
            } catch (error: unknown) {
                return {
                    error: formatError('Failed to derive worker PDA', error),
                };
            }
        },
    }),

    get_connected_wallet: tool({
        description: 'Get the public key of the connected wallet.',
        inputSchema: z.object({}),
        execute: async () => {
            if (!walletContext.publicKey) {
                return {
                    error: 'Wallet not connected. Please connect your wallet first.'
                };
            }
            return {
                success: true,
                publicKey: walletContext.publicKey.toBase58(),
                message: 'Wallet is connected'
            };
        },
    }),
}