use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    pubkey::Pubkey,
    // program_error::ProgramError,
};

use crate::{
    instruction::CounterInstruction,
    state::Counter,
};


pub fn process_instruction<'a> (
    program_id: &'a Pubkey,
    accounts: &'a [AccountInfo<'a>],
    input: &[u8]
) -> ProgramResult {
    // let instruction = CounterInstruction::try_from_slice(input).map_err(|_| ProgramError::InvalidInstructionData)?;
    let instruction = CounterInstruction::try_from_slice(input)?;
    match instruction {
        CounterInstruction::Increment => {
            msg!("CounterInstruction is called 0");
            process_counter_increment(&program_id, &accounts)
        },
    }
}


pub fn process_counter_increment(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let counter_ai = next_account_info(accounts_iter)?;
    let mut counter = Counter::try_from_slice(&counter_ai.data.borrow())?;
    counter.count += 1;
    msg!("Updating count {}", counter.count);
    counter.serialize(&mut *counter_ai.data.borrow_mut())?;
    Ok(())
}