#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;

// Import all modules 
pub mod states;
pub mod errors;
pub mod instructions;

use instructions::*;
declare_id!("A9fnM3skS5kbECt2isFV2EGvS4D7hnsMjnqi2YBwaeed");

#[program]
pub mod payroll_program {
    use super::*;

    // Instruction 1: Create an organisation
    // Parameters: organisation name
    // Returns: Success or error
    pub fn create_org(ctx: Context<CreateOrgCtx>, name: String) -> Result<()> {
        instructions::create_org(ctx, name)
    }
    
    // Instruction 2: Add a worker to an organisation
    // Parameters: worker's salary (in lamports)
    // Returns: Success or error
    pub fn add_worker(ctx: Context<AddWorkerCtx>, salary: u64) -> Result<()> {
        instructions::add_worker(ctx, salary)
    }

    // Instruction 3: Fund the organisation's treasury
    pub fn fund_treasury(ctx: Context<FundTreasuryCtx>, amount: u64) -> Result<()> {
        instructions::fund_treasury(ctx, amount)
    }

    // Instruction 4: Process payroll for all workers in a batch
    // Parameters: cycle timestamp (where this payroll cycle started)
    // Returns: Success or error
    pub fn process_payroll<'info>(ctx: Context<'_,'_, 'info, 'info,ProcessPayrollCtx<'info>>, cycle_timestamp: u64) -> Result<()> {
        instructions::process_payroll(ctx, cycle_timestamp)
    }

    // Instruction 5: Withdraw funds from organisation's treasury
    // Parameters: amount to withdraw (in lamports)
    // Returns: Success or error
    pub fn withdraw(ctx: Context<WithdrawCtx>, amount: u64) -> Result<()> {
        instructions::withdraw(ctx, amount)
    }
}

