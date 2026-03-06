use crate::errors::PayrollError;
use crate::states::{Organisation, Worker};
use anchor_lang::prelude::*;


// Main handler function for processing payroll
pub fn process_payroll<'info>(ctx: Context<'_,'_, 'info, 'info, ProcessPayrollCtx<'info>>,
cycle_timestamp: u64,
) -> Result<()> {
    // Get the number of workers from organisation
    let num_workers = ctx.accounts.org.workers_count as usize;

    // Each worker needs 2 accounts: their PDA and their wallet
    // Calculate expected number of remaining accounts
    let num_expected_accounts = num_workers * 2;

    // Validate: correct number of worker accounts provided
    require!(
        ctx.remaining_accounts.len() == num_expected_accounts,
        PayrollError::MissingWorkerAccount
    );

    // Cache organisation key and program ID for PDA verification
    let org_key = ctx.accounts.org.key();
    let program_id = ctx.program_id;

    // FIRST PASS: Validate and Calculate Total Payout
    // We do this separately to ensure all accounts are valid before transferring.
    let mut total_payout = 0u64;

    for i in 0..num_workers {
        // Calculate indices: workers are in alternating pairs
        let pda_idx = i * 2;          // Even index for PDA
        let wallet_idx = pda_idx + 1; // Odd index for wallet

        let pda_ai = &ctx.remaining_accounts[pda_idx];
        let wallet_ai = &ctx.remaining_accounts[wallet_idx];

        // Verify the worker PDA is correctly derived 
        // Reconstruct the expected PDA address
        let worker_wallet_key = wallet_ai.key();
        let worker_pda_seeds = &[
            b"worker".as_ref(),
            org_key.as_ref(),
            worker_wallet_key.as_ref()
        ];
        let (expected_pda, _) = Pubkey::find_program_address(worker_pda_seeds, &program_id);

        // Ensure the provided PDA matches the expected one
        require_keys_eq!(pda_ai.key(), expected_pda, PayrollError::InvalidWorkerPDA);

        // Deserialize the worker data from the PDA
        let worker = Account::<Worker>::try_from(pda_ai)?;

        // Check if worker needs to be paid in this cycle
        // Only pay if last_paid_cycle is before the current cycle_timestamp
        if worker.last_paid_cycle < cycle_timestamp {
            // Add worker's salary to total payout
            total_payout = total_payout.checked_add(worker.salary).ok_or(PayrollError::InsufficientFunds)?;
        }

       
    }

    // Validate: organisation has enough funds for all payouts
    require!(
        ctx.accounts.org.treasury >= total_payout,
        PayrollError::InsufficientFunds 
    );

     // SECOND PASS: Process Payouts
     for i in 0..num_workers {
        // Calculate indices: workers are in altering pairs
        let pda_idx = i * 2;
        let wallet_idx = pda_idx + 1;
        let pda_ai = &ctx.remaining_accounts[pda_idx];
        let wallet_ai = &ctx.remaining_accounts[wallet_idx];

        let mut worker = Account::<Worker>::try_from(pda_ai)?;

        if worker.last_paid_cycle < cycle_timestamp {
            // Get the salary amount before updating
            let salary_amount = worker.salary;

            // Update the worker's last paid cycle
            worker.last_paid_cycle = cycle_timestamp;
            
            // Serialize updated worker data back to the account
            let mut data = pda_ai.try_borrow_mut_data()?;
            worker.try_serialize(&mut &mut data[..])?;
            drop(data);

            // Transfer lamports directly (manual transfer)
            // Decrease organisation's balance
            **ctx.accounts.org.to_account_info().try_borrow_mut_lamports()? -= salary_amount;

            // Increase worker's wallet balance
            **wallet_ai.to_account_info().try_borrow_mut_lamports()? += salary_amount;

            // Update the organisation's treasury tracking
            ctx.accounts.org.treasury = ctx.accounts.org.treasury.saturating_sub(salary_amount);


        }
    }

    // Log payroll completion
    msg!(
        "Payroll processed for org '{}' : {} lamports paid to {} workers",
        ctx.accounts.org.name,
        total_payout,
        num_workers
    ); 
    Ok(())

}
// Context struct: defines required accounts for this instruction
#[derive(Accounts)]
pub struct ProcessPayrollCtx<'info> {
    // The organisation account (treasury being debited)
    // has_one = authority: only organisation owner can process payroll
    // seeds: ensures this is the correct organisation PDA
    #[account(
        mut,
        has_one = authority @PayrollError::Unauthorised,
        seeds = [b"org", authority.key().as_ref(), org.name.as_bytes()],
        bump = org.bump
    )]
    pub org: Account<'info, Organisation>,

    // The transaction signer (must be orgaisation authority)
    #[account(mut)]
    pub authority: Signer<'info>,

    // System program
    pub system_program: Program<'info, System>,
    // Note: Worker PDAs and wallet accounts are passed as remaining_accounts
    // They must be in alternating order: [worker_pda_1, wallet_1, worker_pda_2, wallet_2, ...]
    // This keeps the transaction flexible for any number of workers

}