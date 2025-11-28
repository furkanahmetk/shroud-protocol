#![no_std]
#![no_main]

extern crate alloc;

mod merkle;
mod deposit;
mod withdraw;
mod verifier;

use casper_contract::contract_api::{runtime, storage};
use casper_types::{Key, U256, U512, account::AccountHash, CLType, EntryPoint, EntryPointAccess, EntryPointType, EntryPoints, Parameter, contracts::NamedKeys};
use alloc::{string::String, vec::Vec, vec};

#[no_mangle]
pub extern "C" fn deposit() {
    deposit::deposit();
}

#[no_mangle]
pub extern "C" fn withdraw() {
    withdraw::withdraw();
}

#[no_mangle]
pub extern "C" fn call() {
    let mut entry_points = EntryPoints::new();

    entry_points.add_entry_point(EntryPoint::new(
        "deposit",
        vec![
            Parameter::new("amount", CLType::U512),
            Parameter::new("commitment", CLType::U256),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "withdraw",
        vec![
            Parameter::new("proof", CLType::List(Box::new(CLType::U8))),
            Parameter::new("root", CLType::U256),
            Parameter::new("nullifier_hash", CLType::U256),
            Parameter::new("recipient", CLType::Key),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // Initialize Merkle Tree
    let tree = merkle::MerkleTree::new();
    let tree_key = storage::new_uref(tree).into();
    
    // Initialize other storage
    let commitments: Vec<U256> = Vec::new();
    let commitments_key = storage::new_uref(commitments).into();

    let spent_nullifiers: Vec<U256> = Vec::new();
    let spent_nullifiers_key = storage::new_uref(spent_nullifiers).into();

    let mut named_keys = NamedKeys::new();
    named_keys.insert("merkle_tree".into(), tree_key);
    named_keys.insert("commitments".into(), commitments_key);
    named_keys.insert("spent_nullifiers".into(), spent_nullifiers_key);

    storage::new_contract(
        entry_points,
        Some(named_keys),
        Some("shroud_protocol_package".into()),
        Some("shroud_protocol_access_token".into()),
    );
}
