use casper_contract::contract_api::{runtime, storage, system};
use casper_types::{U256, U512, ApiError, Key, account::AccountHash};
use crate::merkle::MerkleTree;
use crate::verifier::Verifier;
use alloc::vec::Vec;

const DENOMINATION: u64 = 100_000_000_000; // 100 CSPR

pub fn withdraw() {
    let proof: Vec<u8> = runtime::get_named_arg("proof");
    let root: U256 = runtime::get_named_arg("root");
    let nullifier_hash: U256 = runtime::get_named_arg("nullifier_hash");
    let recipient_key: Key = runtime::get_named_arg("recipient");
    
    let recipient = recipient_key.into_account().unwrap();

    let spent_nullifiers_uref = runtime::get_key("spent_nullifiers").unwrap().into_uref().unwrap();
    let mut spent_nullifiers: Vec<U256> = storage::read(spent_nullifiers_uref).unwrap().unwrap();

    if spent_nullifiers.contains(&nullifier_hash) {
        runtime::revert(ApiError::User(3)); // Already spent
    }

    let merkle_tree_uref = runtime::get_key("merkle_tree").unwrap().into_uref().unwrap();
    let tree: MerkleTree = storage::read(merkle_tree_uref).unwrap().unwrap();

    if !tree.is_known_root(root) {
        runtime::revert(ApiError::User(4)); // Unknown root
    }

    // Verify Proof
    // In a real implementation, we would load the VK from storage or constants
    // For MVP, we mock the verification or use a simplified check
    if !Verifier::verify(&proof, root, nullifier_hash, recipient) {
        runtime::revert(ApiError::User(5)); // Invalid proof
    }

    spent_nullifiers.push(nullifier_hash);
    storage::write(spent_nullifiers_uref, spent_nullifiers);

    system::transfer_to_account(
        recipient,
        U512::from(DENOMINATION),
        None,
    ).unwrap_or_revert();
}
