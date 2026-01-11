#![cfg_attr(not(test), no_std)]
#![cfg_attr(not(test), no_main)]

extern crate alloc;

pub mod shroud_protocol;
pub mod merkle_tree;
pub mod verifier;
pub mod mimc;

pub use shroud_protocol::ShroudProtocol;
pub use merkle_tree::MerkleTree;
