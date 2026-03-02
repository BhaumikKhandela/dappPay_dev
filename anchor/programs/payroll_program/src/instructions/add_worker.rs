use anchor_lang::prelude::*;
use crate::states::{Organisation, Worker};
use crate::errors::PayrollError;
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
    pub worker: Account<'info, Worker>
}