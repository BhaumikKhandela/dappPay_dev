use anchor_lang::prelude::*;
use crate::errors::PayrollError;
use crate::states::Organisation;
pub fn create_org(ctx: Context<CreateOrgCtx>, name: String) -> Result<()> {

    // Validate: organisation name must not exceed maximum length

    require!(
        name.len() <= Organisation::MAX_NAME_LEN,
        PayrollError::InvalidName
    );

    // Get mutable reference to the organisation account
    let org = &mut ctx.accounts.org;

    // Set the authority (owner) to the transaction signer
    org.authority = ctx.accounts.authority.key();

    // Set the organisation name
    org.name = name.clone();

    // Initialize treasury to 0
    org.treasury = 0;

    // Initialize workers count to 0
    org.workers_count = 0;

    // Set the creation timestamp to the current block time
    org.created_at = Clock::get()?.unix_timestamp;

    // Store the bump seed (provided by Anchor)
    org.bump = ctx.bumps.org;

    // Log message for debugging and user feedback
    msg!("Organisation '{}' created", name);
    Ok(())
}

// Context struct: defines all accounts needed for this instruction
#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateOrgCtx<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Organisation::INIT_SPACE,
        seeds = [b"org", authority.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub org: Account<'info, Organisation>,

    // The transaction signer (authority)
    // mut: allows modification of account (needed to deduct rent)
    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,

}