use anchor_lang::prelude::*;

declare_id!("A9fnM3skS5kbECt2isFV2EGvS4D7hnsMjnqi2YBwaeed");

#[program]
pub mod hello_world {
    use super::*;

    pub fn hello(_ctx: Context<Hello>) -> Result<()> {
        msg!("Hello, World!");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Hello {}