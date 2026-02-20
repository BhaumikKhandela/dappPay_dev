use anchor_lang::prelude::*;
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
    pub org: Account<'info, Organisation>
}