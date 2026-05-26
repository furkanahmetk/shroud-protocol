#![cfg_attr(not(test), no_std)]
#![cfg_attr(not(test), no_main)]

extern crate alloc;

pub mod shroud_protocol;
pub mod merkle_tree;
pub mod mimc;

// Real Groth16 verifier (Phase 1: compact binary proof encoding makes the
// ark-groth16/ark-bn254 stack viable inside Casper's WASM size envelope).
pub mod verifier;
pub mod vk;

// NOTE: src/tests.rs contains integration test scaffolds for cargo-odra's
// host-env testing, but the test API surface changed between Odra 1.x and
// 2.6, so they currently don't compile. Kept as documentation of intended
// coverage; reconcile against the live odra-2.6 test API before re-enabling.
// #[cfg(test)] mod tests;

// Real verifier (commented out due to size constraints)
// pub mod verifier;
// pub mod vk;

pub use shroud_protocol::ShroudProtocol;
pub use merkle_tree::MerkleTree;
