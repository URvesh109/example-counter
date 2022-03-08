use num_derive::FromPrimitive;
use solana_program::{
    decode_error::DecodeError,
    msg,
    program_error::{PrintProgramError, ProgramError},
};
use thiserror::Error;

#[derive(Clone, Debug, Eq, Error, FromPrimitive, PartialEq)]
pub enum CounterError {
    #[error("Instruction not implemented")]
    NotImplemented,
}

impl PrintProgramError for CounterError {
    fn print<E>(&self) {
        msg!(&self.to_string());
    }
}

impl From<CounterError> for ProgramError {
    fn from(e: CounterError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

impl<T> DecodeError<T> for CounterError {
    fn type_of() -> &'static str {
        "Counter Error"
    }
}
