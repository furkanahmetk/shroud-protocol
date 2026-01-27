#![cfg_attr(not(test), no_std)]
#![cfg_attr(not(test), no_main)]

extern crate alloc;

pub mod shroud_protocol;
pub mod merkle_tree;
pub mod mimc;

// Use mock verifier for testnet (real verifier too large)
// TODO: Switch to real verifier for mainnet
#[path = "verifier_mock.rs"]
pub mod verifier;

// Real verifier (commented out due to size constraints)
// pub mod verifier;
// pub mod vk;

pub use shroud_protocol::ShroudProtocol;
pub use merkle_tree::MerkleTree;
