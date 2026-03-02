use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Worker {

    // Pubkey of the organisation this worker belongs to
    pub org: Pubkey,

    // Pubkey of the worker's wallet
    pub worker_pubkey: Pubkey,

    // Worker's salary per payroll cycle (in lamports)
    pub salary: u64,

    // Timestamp of the last payroll cycle
    // Prevents paying the same worker twice in the same cycle
    pub last_paid_cycle: u64,

    // Unix timestamp when the worker was added
    pub created_at: i64,

    // Bump seed for the PDA derivation
    pub bump: u8,
}

impl Worker {
    // Total space this account will occupy on-chain (in bytes)
    
    pub const INIT_SPACE: usize = 32 // org (Pubkey)
     + 32 // worker_pubkey (Pubkey)
     + 8 // salary (u64)
     + 8 // last_paid_cycle (u64)
     + 8 // created_at (i64)
     + 1; // bump (u8)
}