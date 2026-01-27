//! Mock ZK-SNARK proof verification for testing.
//!
//! WARNING: This verifier always returns `true` and should ONLY be used for testing.
//! Replace with the real verifier for production deployment.

use casper_types::U256;
use odra::prelude::*;

pub struct Verifier;

impl Verifier {
    /// MOCK: Always returns true for testing.
    ///
    /// WARNING: Replace with real verifier for production!
    pub fn verify(
        _proof_bytes: &[u8],
        _root: U256,
        _nullifier_hash: U256,
        _recipient: Address,
    ) -> bool {
        // MOCK: Accept all proofs for testing
        true
    }
}
