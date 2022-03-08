use borsh::BorshDeserialize;
use counter::{state::Counter};
use solana_program_test::*;
use solana_sdk::{
    account::Account,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::Signer,
    transaction:: Transaction,
};

use std::mem;


#[tokio::test]
async fn test_counter() {
    let program_id = Pubkey::new_unique();
    let counter_pubkey = Pubkey::new_unique();
    let mut program_test = ProgramTest::new(
        "counter",
        program_id,
        None
    );
    program_test.add_account(
        counter_pubkey,
        Account {
            lamports: 5,
            data: vec![0_u8; mem::size_of::<u64>()],
            owner: program_id,
            ..Account::default()
        },
    );
    let (mut banks_client, payer, recent_blockhash) = program_test.start().await;
    let counter_account = banks_client
        .get_account(counter_pubkey)
        .await
        .expect("get account")
        .expect("counter account not found");
        assert_eq!(
            Counter::try_from_slice(&counter_account.data).unwrap().count,
            0
        );

    let mut transaction = Transaction::new_with_payer(
        &[Instruction::new_with_bincode(
            program_id,
            &[0_u8],
            vec![AccountMeta::new(counter_pubkey, false)],
        )],
        Some(&payer.pubkey()),
    );
    transaction.sign(&[&payer], recent_blockhash);
    banks_client.process_transaction(transaction).await.unwrap();

    let counter_account = banks_client
        .get_account(counter_pubkey)
        .await
        .expect("get account")
        .expect("counter account not found");
        assert_eq!(
            Counter::try_from_slice(&counter_account.data).unwrap().count,
            1
        );
    
    let mut transaction = Transaction::new_with_payer(
        &[Instruction::new_with_bincode(
            program_id,
            &[0_u8],
            vec![AccountMeta::new(counter_pubkey, false)],
        )],
        Some(&payer.pubkey()),
    );
    transaction.sign(&[&payer], recent_blockhash);
    banks_client.process_transaction(transaction).await.unwrap();
}