use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Organisation {
    pub authority: Pubkey,

    #[max_len(100)]
    pub name: String,

    // Total treasury balance in lamports
    pub treasury: u64,

    pub workers_count: u64,

    // Unix timestamp of when the organisation was created
    pub created_at: i64,

    // Bump seed for the PDA [internally used by anchor]
    pub bump: u8,
}

impl Organisation {
    pub const MAX_NAME_LEN: usize = 100;
    // Total space required for the organisation account (in bytes)
    pub const INIT_SPACE: usize = 32 // Pubkey
     + 4 + 100                       // Name (String with max length of 100)
     + 8                             // Treasury (u64)
     + 8                             // Workers count (u64)
     + 8                             // Created at (i64)
     + 1;                            // Bump (u8)
}