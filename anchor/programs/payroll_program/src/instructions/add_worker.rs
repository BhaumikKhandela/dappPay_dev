use anchor_lang::prelude::*;
use crate::states::{Organisation, Worker};
use crate::errors::PayrollError;

// Main handler function for adding a worker
pub fn add_worker(ctx: Context<AddWorkerCtx>, salary: u64) -> Result<()> {
    // Validate salary must be greater than 0
    require!(
        salary > 0,
        PayrollError::InvalidSalary
    );

    // Get mutable reference to the worker account being created
    let worker = &mut ctx.accounts.worker;

    // Set which organisation this worker belongs to
    worker.org = ctx.accounts.org.key();

    // Set the worker's wallet address
    worker.worker_pubkey = ctx.accounts.worker_pubkey.key();

    // Set the worker's salary per cycle
    worker.salary = salary;

    // Initialize last_paid_cycle to 0 (never paid before)
    worker.last_paid_cycle = 0;

    // Set creation timestamp
    worker.created_at = Clock::get()?.unix_timestamp;

    // Store the bump seed
    worker.bump = ctx.bumps.worker;

    // Increment the organisation's worker count
    let org = &mut ctx.accounts.org;
    org.workers_count += 1;

    // Log the new worker 
    msg!(
        "Worker {} added with salary {}",
        worker.worker_pubkey,
        salary,
    );

    Ok(())
}


// Context struct: defines all accounts needed for this instruction
#[derive(Accounts)]
pub struct AddWorkerCtx<'info> {
    // The organisation account (must exist and must have correct authority)
    // has_one = authority @ PayrollError::Unauthorised: ensures the organisation account has the correct authority
    // seeds: ensures this is the correct organisation PDA
    #[account(
        mut,
        has_one = authority @ PayrollError::Unauthorised,
        seeds = [b"org", authority.key().as_ref(), org.name.as_bytes()],
        bump = org.bump
    )]
    pub org: Account<'info, Organisation>,

    // The worker account being created 
    // init: create a new account 
    // payer: authority pays for the account
    // space: allocate space for worker struct
    // seeds: PDA derived from organisation key and worker wallet
    // bump: store the bump seed
    #[account(
        init,
        payer = authority,
        space = 8 + Worker::INIT_SPACE,
        seeds = [b"worker", org.key().as_ref(), worker_pubkey.key().as_ref()],
        bump
    )]
    pub worker: Account<'info, Worker>,

    // The worker's wallet address (receives payments)
    // CHECK: We validate this through the seeds constraint
    // No data deserialization needed-just used as part of PDA
    // CHECK: Worker wallet pubkey (validated in seeds)
    pub worker_pubkey: AccountInfo<'info>,

    // The transaction signer (must be the authority)
    // mut: allows modification of account (needed to deduct rent)
    #[account(mut)]
    pub authority: Signer<'info>,

    // System program for account creation
    pub system_program: Program<'info, System>


}