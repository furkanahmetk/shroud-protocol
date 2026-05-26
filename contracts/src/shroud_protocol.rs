use odra::prelude::*;
use casper_types::{U256, U512, CLTyped};
use casper_types::bytesrepr::{ToBytes, FromBytes};
use crate::merkle_tree::MerkleTree;
use crate::verifier::Verifier;

pub const DENOMINATION: u64 = 100_000_000_000; // 100 CSPR
pub const PROTOCOL_FEE_BPS: u64 = 25;          // 0.25% protocol fee
pub const BPS_DENOMINATOR: u64 = 10_000;
pub const MAX_BATCH_SIZE: u32 = 10;            // Per-tx cap on batch ops (gas DoS guard)

#[odra::odra_error]
pub enum Error {
    InvalidAmount = 1,
    DuplicateCommitment = 2,
    AlreadySpent = 3,
    UnknownRoot = 4,
    InvalidProof = 5,
    FeeTooHigh = 6,
    InvalidBatchSize = 7,
    BatchLengthMismatch = 8,
}



#[odra::module(events = [Deposit, Withdrawal])]
pub struct ShroudProtocol {
    pub merkle_tree: Var<MerkleTree>,
    pub commitments: Mapping<U256, bool>,
    pub spent_nullifiers: Mapping<U256, bool>,
    pub treasury: Var<Address>,
}

#[odra::module]
impl ShroudProtocol {
    pub fn init(&mut self, treasury: Address) {
        self.treasury.set(treasury);
    }

    pub fn get_treasury(&self) -> Address {
        self.treasury.get().unwrap_or_revert(&self.env())
    }

    pub fn get_protocol_fee_bps(&self) -> u64 {
        PROTOCOL_FEE_BPS
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
        relayer: Address,
        fee: U512,
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

        // 3. Compute fees. Protocol fee is deterministic from DENOMINATION + PROTOCOL_FEE_BPS,
        //    so it does NOT need to be in the ZK circuit's public inputs. The relayer `fee`
        //    IS in the circuit (anti-tampering), so we pass it through to the verifier as-is.
        let protocol_fee = U512::from(DENOMINATION) * U512::from(PROTOCOL_FEE_BPS) / U512::from(BPS_DENOMINATOR);
        let total_fees = fee + protocol_fee;
        if total_fees >= U512::from(DENOMINATION) {
            self.env().revert(Error::FeeTooHigh);
        }
        let recipient_amount = U512::from(DENOMINATION) - total_fees;

        // 4. Verify Proof (includes relayer + fee as public inputs — must match what
        //    the prover committed to, otherwise an attacker could redirect funds)
        if !Verifier::verify(&proof, root, nullifier_hash, recipient, relayer, fee) {
            self.env().revert(Error::InvalidProof);
        }

        // 5. Mark nullifier as spent BEFORE transfers (reentrancy guard)
        self.spent_nullifiers.set(&nullifier_hash, true);

        // 6. Transfer funds: recipient gets DENOMINATION - relayer_fee - protocol_fee
        self.env().transfer_tokens(&recipient, &recipient_amount);

        if fee > U512::zero() {
            self.env().transfer_tokens(&relayer, &fee);
        }

        let treasury = self.treasury.get().unwrap_or_revert(&self.env());
        self.env().transfer_tokens(&treasury, &protocol_fee);

        // 7. Emit event
        self.env().emit_event(Withdrawal {
            nullifier_hash,
            recipient,
            relayer,
            relayer_fee: fee,
            protocol_fee,
        });
    }

    /// Batch deposit: insert N commitments in a single transaction.
    /// Requires `attached_value == N * DENOMINATION`.
    /// Atomic: if any commitment is a duplicate, the whole batch reverts.
    ///
    /// Privacy note: batching N deposits together does NOT degrade anonymity
    /// for the deposit side (commitments are public anyway). It DOES save
    /// the deploy fee N-1 times.
    #[odra(payable)]
    pub fn deposit_batch(&mut self, commitments: Vec<U256>) {
        let n = commitments.len() as u32;
        if n == 0 || n > MAX_BATCH_SIZE {
            self.env().revert(Error::InvalidBatchSize);
        }

        let amount = self.env().attached_value();
        let expected = U512::from(DENOMINATION) * U512::from(n);
        if amount != expected {
            self.env().revert(Error::InvalidAmount);
        }

        // Load tree once, insert all leaves in memory, persist once at the end.
        let mut tree = self.merkle_tree.get().unwrap_or_default();
        let starting_index = tree.next_index;

        for (i, commitment) in commitments.iter().enumerate() {
            if self.commitments.get(commitment).unwrap_or(false) {
                self.env().revert(Error::DuplicateCommitment);
            }
            tree.insert(*commitment);
            self.commitments.set(commitment, true);

            self.env().emit_event(Deposit {
                commitment: *commitment,
                leaf_index: starting_index + i as u32,
            });
        }

        self.merkle_tree.set(tree);
    }

    /// Batch withdraw: execute N independent withdrawals in one transaction.
    /// Each tuple is verified independently. Atomic: any invalid proof or
    /// already-spent nullifier reverts the whole batch.
    ///
    /// Privacy note: batching N withdrawals links them via the shared payer
    /// + block. Use ONLY when the linkage is acceptable (e.g. consolidating
    /// your own multiple deposits). For mixing across counterparties, use
    /// independent withdrawal transactions instead.
    pub fn withdraw_batch(
        &mut self,
        proofs: Vec<Vec<u8>>,
        roots: Vec<U256>,
        nullifier_hashes: Vec<U256>,
        recipients: Vec<Address>,
        relayers: Vec<Address>,
        fees: Vec<U512>,
    ) {
        let n = proofs.len() as u32;
        if n == 0 || n > MAX_BATCH_SIZE {
            self.env().revert(Error::InvalidBatchSize);
        }
        if roots.len() as u32 != n
            || nullifier_hashes.len() as u32 != n
            || recipients.len() as u32 != n
            || relayers.len() as u32 != n
            || fees.len() as u32 != n
        {
            self.env().revert(Error::BatchLengthMismatch);
        }

        let tree = self.merkle_tree.get().unwrap_or_default();
        let protocol_fee = U512::from(DENOMINATION) * U512::from(PROTOCOL_FEE_BPS)
            / U512::from(BPS_DENOMINATOR);
        let treasury = self.treasury.get().unwrap_or_revert(&self.env());

        for i in 0..(n as usize) {
            let nullifier_hash = nullifier_hashes[i];
            let root = roots[i];
            let recipient = recipients[i];
            let relayer = relayers[i];
            let fee = fees[i];

            if self.spent_nullifiers.get(&nullifier_hash).unwrap_or(false) {
                self.env().revert(Error::AlreadySpent);
            }
            if !tree.is_known_root(root) {
                self.env().revert(Error::UnknownRoot);
            }
            let total_fees = fee + protocol_fee;
            if total_fees >= U512::from(DENOMINATION) {
                self.env().revert(Error::FeeTooHigh);
            }
            let recipient_amount = U512::from(DENOMINATION) - total_fees;

            if !Verifier::verify(&proofs[i], root, nullifier_hash, recipient, relayer, fee) {
                self.env().revert(Error::InvalidProof);
            }

            self.spent_nullifiers.set(&nullifier_hash, true);
            self.env().transfer_tokens(&recipient, &recipient_amount);
            if fee > U512::zero() {
                self.env().transfer_tokens(&relayer, &fee);
            }
            self.env().transfer_tokens(&treasury, &protocol_fee);

            self.env().emit_event(Withdrawal {
                nullifier_hash,
                recipient,
                relayer,
                relayer_fee: fee,
                protocol_fee,
            });
        }
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
    pub relayer: Address,
    pub relayer_fee: U512,
    pub protocol_fee: U512,
}

#[cfg(test)]
mod fee_math_tests {
    use super::*;

    #[test]
    fn protocol_fee_is_25_bps_of_denomination() {
        // 100 CSPR * 25 / 10_000 = 0.25 CSPR = 250_000_000 motes
        let fee = DENOMINATION * PROTOCOL_FEE_BPS / BPS_DENOMINATOR;
        assert_eq!(fee, 250_000_000);
    }

    #[test]
    fn recipient_amount_with_zero_relayer_fee() {
        let protocol_fee = U512::from(DENOMINATION) * U512::from(PROTOCOL_FEE_BPS)
            / U512::from(BPS_DENOMINATOR);
        let relayer_fee = U512::zero();
        let recipient_amount = U512::from(DENOMINATION) - (relayer_fee + protocol_fee);
        // 100 CSPR - 0.25 CSPR = 99.75 CSPR
        assert_eq!(recipient_amount, U512::from(99_750_000_000u64));
    }

    #[test]
    fn recipient_amount_with_relayer_fee() {
        let protocol_fee = U512::from(DENOMINATION) * U512::from(PROTOCOL_FEE_BPS)
            / U512::from(BPS_DENOMINATOR);
        let relayer_fee = U512::from(1_000_000_000u64); // 1 CSPR relayer fee
        let recipient_amount = U512::from(DENOMINATION) - (relayer_fee + protocol_fee);
        // 100 - 1 - 0.25 = 98.75 CSPR
        assert_eq!(recipient_amount, U512::from(98_750_000_000u64));
    }

    #[test]
    fn batch_expected_amount_matches_n_times_denomination() {
        // deposit_batch attached_value check: amount must equal N * DENOMINATION
        for n in 1..=MAX_BATCH_SIZE {
            let expected = U512::from(DENOMINATION) * U512::from(n);
            assert_eq!(expected, U512::from(DENOMINATION as u128 * n as u128));
        }
    }

    #[test]
    fn batch_size_limit_is_ten() {
        // Gas-DoS guard: per-tx batch capped at MAX_BATCH_SIZE
        assert_eq!(MAX_BATCH_SIZE, 10);
    }

    #[test]
    fn fee_too_high_when_total_equals_denomination() {
        let protocol_fee = U512::from(DENOMINATION) * U512::from(PROTOCOL_FEE_BPS)
            / U512::from(BPS_DENOMINATOR);
        // relayer fee that pushes total to exactly DENOMINATION must be rejected
        let relayer_fee = U512::from(DENOMINATION) - protocol_fee;
        let total = relayer_fee + protocol_fee;
        assert!(total >= U512::from(DENOMINATION));
    }
}
