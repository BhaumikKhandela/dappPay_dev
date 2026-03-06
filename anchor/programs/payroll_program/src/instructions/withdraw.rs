use crate::errors::PayrollError;
use crate::states::Organisation;
use anchor_lang::prelude::*;

// Main header function for withdrawing from treasury

pub fn withdraw(ctx: Context<WithdrawCtx>, amount: u64) -> Result<()> {
    // Validate amount must be greater than 0
    require!(
        amount > 0,
        PayrollError::InvalidAmount
    );

    // Validate: treasury must have sufficient funds
    require!(
        ctx.accounts.org.treasury >= amount,
        PayrollError::InsufficientFunds
    );

    // Transfer lamports directly by manipulating account balances
    // We do this manually (not using system_program::transfer) because
    // the organisation account contains program data, which would cause 
    // conflicts with system program's transfer logic

    // Decrease organisation's lamport balance by amount
    **ctx.accounts.org.to_account_info().try_borrow_mut_lamports()? -= amount;

    // Increase authority's lamport balance by amount
    **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? += amount;

    // Update the organisation's treasury balance
    ctx.accounts.org.treasury -= amount;

    // Log the withdrawal event
    msg!("Withdrawn {} lamports from treasury", amount);
    Ok(())

}


#[derive(Accounts)]
pub struct WithdrawCtx<'info> {
    // The organisation account (funds being withdrawn from here)
    // has_one = authority : ensure only the organisation owner can withdraw
    // seeds: ensures this is the correct organisation PDA
    #[account(
        mut,
        has_one = authority @ PayrollError::Unauthorised,
        seeds = [b"org", authority.key().as_ref(), org.name.as_bytes()],
        bump = org.bump
    )]
    pub org: Account<'info, Organisation>,

    // The transaction signer (authority) receiving the withdrawal
    #[account(mut)]
    pub authority: Signer<'info> ,

    // System program (included for consistency)
    pub system_program: Program<'info, System>,   
}