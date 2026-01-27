use odra::prelude::Vec;
use casper_types::U256;
use casper_types::bytesrepr::ToBytes;

pub const TREE_LEVELS: u32 = 20;
pub const ZERO_VALUE: U256 = U256::zero();

#[odra::odra_type]
pub struct MerkleTree {
    pub next_index: u32,
    pub filled_subtrees: Vec<U256>,
    pub roots: Vec<U256>,
}

impl Default for MerkleTree {
    fn default() -> Self {
        let mut filled_subtrees = Vec::with_capacity(TREE_LEVELS as usize);
        for _ in 0..TREE_LEVELS {
            filled_subtrees.push(ZERO_VALUE);
        }
        
        Self {
            next_index: 0,
            filled_subtrees,
            roots: Vec::new(),
        }
    }
}

impl MerkleTree {
    pub fn insert(&mut self, leaf: U256) {
        // Initialize constants ONCE per transaction
        let constants = mimc::get_constants();

        let mut current_index = self.next_index;
        let mut current_level_hash = leaf;
        let mut left;
        let mut right;

        for i in 0..TREE_LEVELS {
            if current_index % 2 == 0 {
                left = current_level_hash;
                right = self.filled_subtrees[i as usize];
                self.filled_subtrees[i as usize] = current_level_hash;
            } else {
                left = self.filled_subtrees[i as usize];
                right = current_level_hash;
            }

            current_level_hash = hash_pair(left, right, &constants);
            current_index /= 2;
        }

        self.roots.push(current_level_hash);
        if self.roots.len() > 30 {
            self.roots.remove(0);
        }

        self.next_index += 1;
    }

    pub fn is_known_root(&self, root: U256) -> bool {
        if root == ZERO_VALUE {
            return false;
        }
        self.roots.contains(&root)
    }

    pub fn get_last_root(&self) -> U256 {
        if self.roots.is_empty() {
            return ZERO_VALUE;
        }
        self.roots[self.roots.len() - 1]
    }
}

use crate::mimc;
use ark_bn254::Fr;
use ark_ff::{PrimeField, BigInteger};
use casper_types::bytesrepr::FromBytes;

fn hash_pair(left: U256, right: U256, constants: &[Fr]) -> U256 {
    // Convert U256 to Fr using raw little-endian bytes (NO length prefix)
    let mut left_bytes = [0u8; 32];
    left.to_little_endian(&mut left_bytes);

    let mut right_bytes = [0u8; 32];
    right.to_little_endian(&mut right_bytes);

    // ark-bn254 from_le_bytes_mod_order
    let left_fr = Fr::from_le_bytes_mod_order(&left_bytes);
    let right_fr = Fr::from_le_bytes_mod_order(&right_bytes);

    let res_fr = mimc::multi_hash(&[left_fr, right_fr], constants);

    // Convert back to U256
    let res_bytes = res_fr.into_bigint().to_bytes_le();

    // Safely construct U256 from bytes, handling potential length mismatch
    let mut padded_bytes = [0u8; 32];
    let len = res_bytes.len().min(32);
    padded_bytes[..len].copy_from_slice(&res_bytes[..len]);

    U256::from_little_endian(&padded_bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_merkle_tree_root() {
        let mut tree = MerkleTree::default();

        // Insert a test commitment (same value we'll test in frontend)
        // This is commitment = multiHash([1, 2]) from our MiMC test
        let commitment = U256::from_dec_str(
            "5233261170300319370386085858846328736737478911451874673953613863492170606314"
        ).unwrap();

        tree.insert(commitment);

        let root = tree.get_last_root();
        println!("Merkle root after inserting commitment:");
        println!("  Commitment (dec): {}", commitment);
        println!("  Root (dec):       {}", root);

        // The frontend should produce the same root
        // We'll print it here and compare manually
        println!("\n--- Compare this root with frontend output ---");
    }

    #[test]
    fn test_hash_pair_u256_conversion() {
        let constants = mimc::get_constants();

        // Test that hash_pair([0, 0]) matches multiHash([0, 0])
        let zero = U256::zero();
        let result = hash_pair(zero, zero, &constants);

        // Expected from circomlibjs/Rust test: 3089049976446759283073903078838002107081160427222305800976141688008169211302
        let expected = U256::from_dec_str(
            "3089049976446759283073903078838002107081160427222305800976141688008169211302"
        ).unwrap();

        println!("hash_pair([0, 0]):");
        println!("  Expected: {}", expected);
        println!("  Got:      {}", result);

        assert_eq!(result, expected, "hash_pair U256 conversion mismatch!");

        println!("\n✅ hash_pair U256 conversion test passed!");
    }
}
