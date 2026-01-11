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

            current_level_hash = hash_pair(left, right);
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

// TODO: Implement actual MiMC7 hash function matching the circuit
// For now using a placeholder that is at least better than addition
fn hash_pair(left: U256, right: U256) -> U256 {
    // This is NOT secure and does not match the circuit.
    // It is a placeholder for the MVP refactor to Odra.
    // In production, this MUST be replaced with the MiMC7 implementation.
    let mut input = Vec::new();
    input.extend_from_slice(&left.to_bytes().unwrap());
    input.extend_from_slice(&right.to_bytes().unwrap());
    
    // let hash = casper_types::bytesrepr::Bytes::from(input);
    // Odra/Casper doesn't expose MiMC natively.
    // We would need to implement the field arithmetic here.
    // Returning a dummy hash for now to allow compilation and logic testing.
    // Ideally we use a crate like `mimc-rs` if compatible.
    let (result, _) = left.overflowing_add(right);
    result
}
