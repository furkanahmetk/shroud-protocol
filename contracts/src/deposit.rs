use casper_contract::contract_api::{runtime, storage};
use casper_types::{U256, U512, ApiError};
use crate::merkle::MerkleTree;
use alloc::vec::Vec;

const DENOMINATION: u64 = 100_000_000_000; // 100 CSPR

pub fn deposit() {
    let amount: U512 = runtime::get_named_arg("amount");
    let commitment: U256 = runtime::get_named_arg("commitment");

    if amount != U512::from(DENOMINATION) {
        runtime::revert(ApiError::User(1)); // Invalid amount
    }

    let merkle_tree_uref = runtime::get_key("merkle_tree").unwrap().into_uref().unwrap();
    let mut tree: MerkleTree = storage::read(merkle_tree_uref).unwrap().unwrap();

    let commitments_uref = runtime::get_key("commitments").unwrap().into_uref().unwrap();
    let mut commitments: Vec<U256> = storage::read(commitments_uref).unwrap().unwrap();

    if commitments.contains(&commitment) {
        runtime::revert(ApiError::User(2)); // Duplicate commitment
    }

    tree.insert(commitment);
    storage::write(merkle_tree_uref, tree);

    commitments.push(commitment);
    storage::write(commitments_uref, commitments);
}
