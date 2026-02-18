use anchor_lang::prelude::*;

#[error_code]
pub enum PayrollError {

    #[msg("Unauthorised access")]
    Unauthorised,
     
    // Error code for invalid organisation name length
    #[msg("Invalid organisation name length")]
    InvalidName,

    // Error when salary amount is 0 or invalid
    #[msg("Invalid salary amount")]
    InvalidSalary,

    // Error when amount parameter is 0 or invalid
    #[msg("Invalid amount")]
    InvalidAmount,

    // Error when treasury has insufficient funds
    #[msg("Insufficient funds in treasury")]
    InsufficientFunds,

    // Error when worker accounts are missing in remaining_accounts
    #[msg("Missing worker account in remaining accounts")]
    MissingWorkerAccount,

    // Error when provided worker PDA does not match the expected PDA
    #[msg("Invalid worker PDA")]
    InvalidWorkerPDA,

    // Error when worker wallet pubkey is invalid
    #[msg("Invalid worker wallet pubkey")]
    InvalidWorkerWallet,
}