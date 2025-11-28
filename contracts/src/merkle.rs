use casper_types::{U256, bytesrepr::{self, ToBytes, FromBytes}};
use alloc::vec::Vec;
use alloc::vec;

const TREE_LEVELS: usize = 20;
// Simplified zero value for example
const ZERO_VALUE: u64 = 0; 

#[derive(Clone, Debug)]
pub struct MerkleTree {
    pub levels: usize,
    pub next_index: u32,
    pub filled_subtrees: Vec<U256>,
    pub roots: Vec<U256>,
}

impl MerkleTree {
    pub fn new() -> Self {
        let mut filled_subtrees = vec![U256::from(ZERO_VALUE); TREE_LEVELS];
        
        // In a real implementation we would precompute zero hashes
        // For MVP we just use 0
        
        MerkleTree {
            levels: TREE_LEVELS,
            next_index: 0,
            filled_subtrees,
            roots: Vec::new(),
        }
    }

    pub fn insert(&mut self, leaf: U256) {
        let mut current_index = self.next_index;
        let mut current_level_hash = leaf;
        let mut left;
        let mut right;

        for i in 0..self.levels {
            if current_index % 2 == 0 {
                left = current_level_hash;
                right = self.filled_subtrees[i];
                self.filled_subtrees[i] = current_level_hash;
            } else {
                left = self.filled_subtrees[i];
                right = current_level_hash;
            }

            current_level_hash = Self::hash_pair(left, right);
            current_index /= 2;
        }

        self.roots.push(current_level_hash);
        
        if self.roots.len() > 30 {
            self.roots.remove(0);
        }

        self.next_index += 1;
    }

    pub fn is_known_root(&self, root: U256) -> bool {
        if root == U256::zero() {
            return false;
        }
        self.roots.contains(&root)
    }

    fn hash_pair(left: U256, right: U256) -> U256 {
        // Simple XOR for MVP demonstration to avoid complex dependency issues in this environment
        // In production, use MiMC or Poseidon
        let mut result = U256::zero();
        // This is a placeholder. Real implementation needs a proper hash function.
        // Since we can't easily import a ZK-friendly hash in this environment without external crates setup,
        // we will assume a simple combination for now.
        // DO NOT USE IN PRODUCTION
        left + right 
    }
}

impl ToBytes for MerkleTree {
    fn to_bytes(&self) -> Result<Vec<u8>, bytesrepr::Error> {
        let mut buffer = Vec::new();
        buffer.extend(self.levels.to_bytes()?);
        buffer.extend(self.next_index.to_bytes()?);
        buffer.extend(self.filled_subtrees.to_bytes()?);
        buffer.extend(self.roots.to_bytes()?);
        Ok(buffer)
    }

    fn serialized_length(&self) -> usize {
        self.levels.serialized_length() +
        self.next_index.serialized_length() +
        self.filled_subtrees.serialized_length() +
        self.roots.serialized_length()
    }
}

impl FromBytes for MerkleTree {
    fn from_bytes(bytes: &[u8]) -> Result<(Self, &[u8]), bytesrepr::Error> {
        let (levels, remainder) = usize::from_bytes(bytes)?;
        let (next_index, remainder) = u32::from_bytes(remainder)?;
        let (filled_subtrees, remainder) = Vec::<U256>::from_bytes(remainder)?;
        let (roots, remainder) = Vec::<U256>::from_bytes(remainder)?;
        
        Ok((MerkleTree {
            levels,
            next_index,
            filled_subtrees,
            roots,
        }, remainder))
    }
}
