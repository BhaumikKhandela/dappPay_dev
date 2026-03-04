use crate::errors::PayrollError;
use crate::states::{Organisation, Worker};
use anchor_lang::prelude::*;
use anchor_lang::system_program;


// Main handler function for funding the treasury
pub fn fund_treasury(ctx: Context<FundTreasuryCtx>, amount: u64) -> Result<()> {
    // Validate amount must be greater than 0
    require!(
        amount > 0,
        PayrollError::InvalidAmount
    );

    // Prepare CPI (Cross-Program Invocation) to system program
    // We're calling system program's transfer instruction 
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            // Transfer from authority's wallet
            from: ctx.accounts.auhtority.to_account_info(),
            // Transfer to the organisation's PDA account
            to: ctx.accounts.org.to_account_info(),
        }
    );

    // Execute the transfer 
    system_program::transfer(cpi_ctx, amount)?;

    // Update the organisation's treasury balance 
    ctx.accounts.org.treasury += amount;

    // Log the funding event
    msg!("Treasury funded by {} lamports", amount);
    Ok(())

}
// Context struct: defines all accounts needed for this instruction
#[derive(Accounts)]
pub struct FundTreasuryCtx<'info> {
    // The organisation account receiving funds
    // has_one = authority ensures authority signer is the organisation owner
    // seeds: ensures this is the correct organisation PDA
    #[account(
        mut,
        has_one = auhtority @ PayrollError::Unauthorised,
        seeds = [b"org", auhtority.key().as_ref(), org.name.as_bytes()],
        bump = org.bump
    )]
    pub org: Account<'info, Organisation>,

    // The account sending the funds (must be transaction signer)
    #[account(mut)]
    pub authority: Signer<'info>,

    // System program (needed for transfer)
    pub system_program: Program<'info, System>,
}