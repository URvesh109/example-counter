/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  Keypair,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import fs from 'mz/fs';
import path from 'path';
import * as borsh from 'borsh';

import {getPayer, getRpcUrl, createKeypairFromFile} from './utils';

/**
 * Connection to the network
 */
let connection: Connection;

/**
 * Keypair associated to the fees' payer
 */
let payer: Keypair;

/**
 * Hello world's program id
 */
let programId: PublicKey;

/**
 * The public key of the account we are saying hello to
 */
let counterPubkey: PublicKey;

/**
 * Path to program files
 */
const PROGRAM_PATH = path.resolve(__dirname, '../../dist/program');

/**
 * Path to program shared object file which should be deployed on chain.
 * This file is created when running either:
 *   - `npm run build:program-c`
 *   - `npm run build:program-rust`
 */
const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, 'counter.so');

/**
 * Path to the keypair of the deployed program.
 * This file is created when running `solana program deploy dist/program/counter.so`
 */
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, 'counter-keypair.json');

/**
 * The state of a greeting account managed by the hello world program
 */
class Counter {
  count = 0;
  constructor(fields: {counter: number} | undefined = undefined) {
    if (fields) {
      this.count = fields.counter;
    }
  }
}

/**
 * Borsh schema definition for greeting accounts
 */
const CounterSchema = new Map([
  [Counter, {kind: 'struct', fields: [['count', 'u64']]}],
]);

/**
 * The expected size of each greeting account.
 */
const COUNTER_SIZE = borsh.serialize(CounterSchema, new Counter()).length;

/**
 * Establish a connection to the cluster
 */
export async function establishConnection(): Promise<void> {
  const rpcUrl = await getRpcUrl();
  connection = new Connection(rpcUrl, 'confirmed');
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', rpcUrl, version);
}

/**
 * Establish an account to pay for everything
 */
export async function establishPayer(): Promise<void> {
  let fees = 0;
  if (!payer) {
    const {feeCalculator} = await connection.getRecentBlockhash();

    // Calculate the cost to fund the greeter account
    fees += await connection.getMinimumBalanceForRentExemption(COUNTER_SIZE);

    // Calculate the cost of sending transactions
    fees += feeCalculator.lamportsPerSignature * 100; // wag

    payer = await getPayer();
  }

  let lamports = await connection.getBalance(payer.publicKey);
  if (lamports < fees) {
    // If current balance is not enough to pay for fees, request an airdrop
    const sig = await connection.requestAirdrop(
      payer.publicKey,
      fees - lamports,
    );
    await connection.confirmTransaction(sig);
    lamports = await connection.getBalance(payer.publicKey);
  }

  console.log(
    'Using account',
    payer.publicKey.toBase58(),
    'containing',
    lamports / LAMPORTS_PER_SOL,
    'SOL to pay for fees',
  );
}

/**
 * Check if the hello world BPF program has been deployed
 */
export async function checkProgram(): Promise<void> {
  // Read program id from keypair file
  try {
    const programKeypair = await createKeypairFromFile(PROGRAM_KEYPAIR_PATH);
    programId = programKeypair.publicKey;
  } catch (err) {
    const errMsg = (err as Error).message;
    throw new Error(
      `Failed to read program keypair at '${PROGRAM_KEYPAIR_PATH}' due to error: ${errMsg}. Program may need to be deployed with \`solana program deploy dist/program/helloworld.so\``,
    );
  }

  // Check if the program has been deployed
  const programInfo = await connection.getAccountInfo(programId);
  if (programInfo === null) {
    if (fs.existsSync(PROGRAM_SO_PATH)) {
      throw new Error(
        'Program needs to be deployed with `solana program deploy dist/program/helloworld.so`',
      );
    } else {
      throw new Error('Program needs to be built and deployed');
    }
  } else if (!programInfo.executable) {
    throw new Error(`Program is not executable`);
  }
  console.log(`Using program ${programId.toBase58()}`);

  // Derive the address (public key) of a greeting account from the program so that it's easy to find later.
  const COUNTER_SEED = 'counter';
  counterPubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    COUNTER_SEED,
    programId,
  );

  // Check if the greeting account has already been created
  const counterAccount = await connection.getAccountInfo(counterPubkey);
  if (counterAccount === null) {
    console.log(
      'Creating account',
      counterPubkey.toBase58(),
      'to say hello to',
    );
    const lamports = await connection.getMinimumBalanceForRentExemption(
      COUNTER_SIZE,
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: payer.publicKey,
        newAccountPubkey: counterPubkey,
        basePubkey: payer.publicKey,
        seed: COUNTER_SEED,
        lamports,
        space: COUNTER_SIZE,
        programId,
      }),
    );
    await sendAndConfirmTransaction(connection, transaction, [payer]);
  }
}

/**
 * Say hello
 */
export async function sayHello(): Promise<void> {
  console.log('Incrementing counter', counterPubkey.toBase58());
  const value = new Counter({counter: 1});
  const idx = Buffer.from(borsh.serialize(CounterSchema, value));
  const instruction = new TransactionInstruction({
    keys: [{pubkey: counterPubkey, isSigner: false, isWritable: true}],
    programId,
    data: Buffer.from(new Uint8Array([0])), // All instructions are hellos
  });
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer],
  );
}

/**
 * Report the number of times the greeted account has been said hello to
 */
export async function reportGreetings(): Promise<void> {
  const accountInfo = await connection.getAccountInfo(counterPubkey);
  if (accountInfo === null) {
    throw 'Error: cannot find the greeted account';
  }
  const counter = borsh.deserialize(CounterSchema, Counter, accountInfo.data);
  console.log(
    counterPubkey.toBase58(),
    'has been greeted',
    counter.count,
    'time(s)',
  );
}
