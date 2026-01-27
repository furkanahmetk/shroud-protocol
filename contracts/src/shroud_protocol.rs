use odra::prelude::*;
use casper_types::{U256, U512, CLTyped};
use casper_types::bytesrepr::{ToBytes, FromBytes};
use crate::merkle_tree::MerkleTree;
use crate::verifier::Verifier;

pub const DENOMINATION: u64 = 100_000_000_000; // 100 CSPR

#[odra::odra_error]
pub enum Error {
    InvalidAmount = 1,
    DuplicateCommitment = 2,
    AlreadySpent = 3,
    UnknownRoot = 4,
    InvalidProof = 5,
}



#[odra::module(events = [Deposit, Withdrawal])]
pub struct ShroudProtocol {
    pub merkle_tree: Var<MerkleTree>,
    pub commitments: Mapping<U256, bool>,
    pub spent_nullifiers: Mapping<U256, bool>,
}

#[odra::module]
impl ShroudProtocol {
    pub fn init(&mut self) {
        // self.merkle_tree.set(MerkleTree::default());
        // self.nullifiers.set(Mapping::default());
        // self.commitments.set(Mapping::default());
        // self.roots.set(Mapping::default());
        // // Initialize the first root as the default empty tree root?
        // // For now we just start empty.
    }

    /// Fund the contract's purse with CSPR for withdrawal payouts
    #[odra(payable)]
    pub fn fund(&mut self) {
        // Simply accept the attached value - Odra handles purse management
        // The attached CSPR will be available via self.env().transfer_tokens()
    }

    #[odra(payable)]
    pub fn deposit(&mut self, commitment: U256) {
        // 1. Check amount - CRITICAL: Prevents zero-deposit attacks
        let amount = self.env().attached_value();
        if amount != U512::from(DENOMINATION) {
            self.env().revert(Error::InvalidAmount);
        }

        // 2. Check commitment uniqueness
        if self.commitments.get(&commitment).unwrap_or(false) {
            self.env().revert(Error::DuplicateCommitment);
        }

        // 3. Update Merkle Tree
        let mut tree = self.merkle_tree.get().unwrap_or_default();
        tree.insert(commitment);
        self.merkle_tree.set(tree);

        // 4. Store commitment
        self.commitments.set(&commitment, true);

        // 5. Emit event
        self.env().emit_event(Deposit {
            commitment,
            leaf_index: self.merkle_tree.get().unwrap().next_index - 1,
        });
    }

    pub fn withdraw(
        &mut self,
        proof: Vec<u8>,
        root: U256,
        nullifier_hash: U256,
        recipient: Address,
    ) {
        // 1. Check nullifier
        if self.spent_nullifiers.get(&nullifier_hash).unwrap_or(false) {
            self.env().revert(Error::AlreadySpent);
        }

        // 2. Check root
        let tree = self.merkle_tree.get().unwrap_or_default();
        if !tree.is_known_root(root) {
            self.env().revert(Error::UnknownRoot);
        }

        // 3. Verify Proof
        if !Verifier::verify(&proof, root, nullifier_hash, recipient) {
            self.env().revert(Error::InvalidProof);
        }

        // 4. Mark nullifier as spent
        self.spent_nullifiers.set(&nullifier_hash, true);

        // 5. Transfer funds
        self.env().transfer_tokens(&recipient, &U512::from(DENOMINATION));

        // 6. Emit event
        self.env().emit_event(Withdrawal {
            nullifier_hash,
            recipient,
        });
    }
}

#[odra::event]
pub struct Deposit {
    pub commitment: U256,
    pub leaf_index: u32,
}

#[odra::event]
pub struct Withdrawal {
    pub nullifier_hash: U256,
    pub recipient: Address,
}
