//! ZK-SNARK proof verification for the withdraw circuit.
//!
//! Accepts proofs in a compact 256-byte binary format (8 × 32-byte big-endian
//! field elements). The CLI/frontend converts the snarkjs JSON output into
//! this layout before submitting, which keeps the on-chain args well under
//! Casper's per-transaction size cap and removes verbose string parsing from
//! the contract (smaller WASM, lower gas).
//!
//! Byte layout (each segment is a Fq big-endian, padded to 32 bytes):
//!   [  0..32 ] = A.x
//!   [ 32..64 ] = A.y
//!   [ 64..96 ] = B.x.c0
//!   [ 96..128] = B.x.c1
//!   [128..160] = B.y.c0
//!   [160..192] = B.y.c1
//!   [192..224] = C.x
//!   [224..256] = C.y

use casper_types::{U256, U512};
use odra::prelude::*;
use ark_groth16::{prepare_verifying_key, Groth16, Proof};
use ark_bn254::{Bn254, Fr, Fq, Fq2, G1Affine, G2Affine};
use ark_ff::PrimeField;
use ark_snark::SNARK;
use ark_std::vec::Vec;

use crate::vk::get_verification_key;

pub const PROOF_BYTES_LEN: usize = 256;

pub struct Verifier;

impl Verifier {
    /// Verify a Groth16 proof for a withdrawal.
    ///
    /// # Arguments
    /// * `proof_bytes` - 256-byte binary proof (see module docs for layout)
    /// * `root` - Merkle tree root
    /// * `nullifier_hash` - Hash of the nullifier
    /// * `recipient` - Address to receive funds
    /// * `relayer` - Address that submitted the proof (may equal recipient for self-withdrawal)
    /// * `fee` - Relayer fee in motes
    ///
    /// # Returns
    /// `true` if the proof is valid, `false` otherwise
    pub fn verify(
        proof_bytes: &[u8],
        root: U256,
        nullifier_hash: U256,
        recipient: Address,
        relayer: Address,
        fee: U512,
    ) -> bool {
        let proof = match parse_binary_proof(proof_bytes) {
            Some(p) => p,
            None => return false,
        };

        let vk = get_verification_key();
        let pvk = prepare_verifying_key(&vk);

        // Public inputs order matches circuit: root, nullifierHash, recipient, relayer, fee
        let mut public_inputs: Vec<Fr> = Vec::with_capacity(5);
        public_inputs.push(u256_to_fr(root));
        public_inputs.push(u256_to_fr(nullifier_hash));
        public_inputs.push(address_to_fr(recipient));
        public_inputs.push(address_to_fr(relayer));
        public_inputs.push(Fr::from(fee.as_u64()));

        Groth16::<Bn254>::verify_with_processed_vk(&pvk, &public_inputs, &proof)
            .unwrap_or(false)
    }
}

fn parse_binary_proof(bytes: &[u8]) -> Option<Proof<Bn254>> {
    if bytes.len() != PROOF_BYTES_LEN {
        return None;
    }
    let a_x = Fq::from_be_bytes_mod_order(&bytes[0..32]);
    let a_y = Fq::from_be_bytes_mod_order(&bytes[32..64]);
    let b_x_c0 = Fq::from_be_bytes_mod_order(&bytes[64..96]);
    let b_x_c1 = Fq::from_be_bytes_mod_order(&bytes[96..128]);
    let b_y_c0 = Fq::from_be_bytes_mod_order(&bytes[128..160]);
    let b_y_c1 = Fq::from_be_bytes_mod_order(&bytes[160..192]);
    let c_x = Fq::from_be_bytes_mod_order(&bytes[192..224]);
    let c_y = Fq::from_be_bytes_mod_order(&bytes[224..256]);

    Some(Proof {
        a: G1Affine::new_unchecked(a_x, a_y),
        b: G2Affine::new_unchecked(Fq2::new(b_x_c0, b_x_c1), Fq2::new(b_y_c0, b_y_c1)),
        c: G1Affine::new_unchecked(c_x, c_y),
    })
}

fn u256_to_fr(val: U256) -> Fr {
    let mut bytes = [0u8; 32];
    val.to_little_endian(&mut bytes);
    Fr::from_le_bytes_mod_order(&bytes)
}

fn address_to_fr(addr: Address) -> Fr {
    let hash_bytes = match addr {
        Address::Account(account_hash) => account_hash.value(),
        Address::Contract(contract_package_hash) => contract_package_hash.value(),
    };
    Fr::from_be_bytes_mod_order(&hash_bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ark_ff::MontFp;

    #[test]
    fn parse_binary_proof_rejects_wrong_length() {
        assert!(parse_binary_proof(&[]).is_none());
        assert!(parse_binary_proof(&[0u8; 255]).is_none());
        assert!(parse_binary_proof(&[0u8; 257]).is_none());
    }

    #[test]
    fn parse_binary_proof_accepts_256_zero_bytes() {
        let proof = parse_binary_proof(&[0u8; 256]);
        assert!(proof.is_some());
    }

    // NOTE: a `verifies_proof_captured_from_wire` diagnostic test used to live
    // here, holding bytes from the c70125a7… transaction. That tx was emitted
    // by the buggy CLI that passed `BigInt(publicKey)` instead of
    // `BigInt(accountHash)` as the recipient field, so those bytes are *not*
    // a valid proof against any public input — they only made sense as a
    // diagnostic during the bug hunt. The bug fix lives in
    // `cli/src/withdraw.ts::addressToNumeric` (use `toAccountHash()`); the
    // `verifies_known_good_proof_from_snarkjs` + `binary_roundtrip_preserves_proof`
    // tests below cover the verifier surface that test used to exercise.

    /// Roundtrip: emit the known-good proof as our 256-byte binary, parse it
    /// back, then run the same verify. If this fails but the
    /// `verifies_known_good_proof_from_snarkjs` test passes, the bug is in
    /// `parse_binary_proof`.
    #[test]
    fn binary_roundtrip_preserves_proof() {
        use ark_ff::BigInteger;
        // pi_a (G1)
        let a_x: Fq = MontFp!("17672698042362391269788118011598478849931315228758230396585616102053197763212");
        let a_y: Fq = MontFp!("4765600019813041237120139463874799435354509857047431681177554759282491914769");
        // pi_b (G2): Fq2 stored as (c0, c1) per ark-bn254
        let b_x_c0: Fq = MontFp!("19986189407163567588324826201147852767351196529652619757388746004836511036271");
        let b_x_c1: Fq = MontFp!("6439849559035229239440576017268623570573057903793037105399839913552417268953");
        let b_y_c0: Fq = MontFp!("16669669140253691305177968922961252549325248402439687076288276628920620909337");
        let b_y_c1: Fq = MontFp!("21206651656130213512046696983173767844998326339721117583139883259027007611192");
        // pi_c (G1)
        let c_x: Fq = MontFp!("17235594933163351208655352428042931083605305337685407832187307167659175001970");
        let c_y: Fq = MontFp!("1599836760472120907972326612842628323421551435384853469815606514475833061751");

        // Serialize as 8 × 32 byte BE
        let mut bytes = [0u8; 256];
        let mut write_be = |slot: usize, fq: Fq| {
            let mut be = fq.into_bigint().to_bytes_be();
            // ark's to_bytes_be returns leading-trimmed bytes; left-pad to 32.
            if be.len() < 32 {
                let mut pad = vec![0u8; 32 - be.len()];
                pad.extend_from_slice(&be);
                be = pad;
            }
            bytes[slot..slot + 32].copy_from_slice(&be);
        };
        write_be(0, a_x);
        write_be(32, a_y);
        write_be(64, b_x_c0);
        write_be(96, b_x_c1);
        write_be(128, b_y_c0);
        write_be(160, b_y_c1);
        write_be(192, c_x);
        write_be(224, c_y);

        let proof = parse_binary_proof(&bytes).expect("parse_binary_proof failed");

        let public_inputs: Vec<Fr> = vec![
            MontFp!("3181243540856879025946841239972296600665054404700836121323386710379861622545"),
            MontFp!("11466928731432946276719961441051605104213188726478797759565533992328374501088"),
            MontFp!("9853390606525154646148331562721914826251004107465306183516039446249523003424"),
            MontFp!("9853390606525154646148331562721914826251004107465306183516039446249523003424"),
            Fr::from(0u64),
        ];

        let vk = get_verification_key();
        let pvk = prepare_verifying_key(&vk);
        let ok = Groth16::<Bn254>::verify_with_processed_vk(&pvk, &public_inputs, &proof)
            .unwrap_or(false);
        assert!(ok, "Verifier rejected the proof after binary roundtrip");
    }

    /// Known-good proof + public signals captured from a snarkjs `groth16.verify`
    /// run that returned `true` against the same VK we ship in `vk.rs`. If this
    /// test fails, the bug is in the verifier or vk.rs (NOT in the wire
    /// encoding).
    #[test]
    fn verifies_known_good_proof_from_snarkjs() {
        let proof = Proof {
            a: G1Affine::new_unchecked(
                MontFp!("17672698042362391269788118011598478849931315228758230396585616102053197763212"),
                MontFp!("4765600019813041237120139463874799435354509857047431681177554759282491914769"),
            ),
            b: G2Affine::new_unchecked(
                Fq2::new(
                    MontFp!("19986189407163567588324826201147852767351196529652619757388746004836511036271"),
                    MontFp!("6439849559035229239440576017268623570573057903793037105399839913552417268953"),
                ),
                Fq2::new(
                    MontFp!("16669669140253691305177968922961252549325248402439687076288276628920620909337"),
                    MontFp!("21206651656130213512046696983173767844998326339721117583139883259027007611192"),
                ),
            ),
            c: G1Affine::new_unchecked(
                MontFp!("17235594933163351208655352428042931083605305337685407832187307167659175001970"),
                MontFp!("1599836760472120907972326612842628323421551435384853469815606514475833061751"),
            ),
        };

        let public_inputs: Vec<Fr> = vec![
            MontFp!("3181243540856879025946841239972296600665054404700836121323386710379861622545"),  // root
            MontFp!("11466928731432946276719961441051605104213188726478797759565533992328374501088"), // nullifierHash
            MontFp!("9853390606525154646148331562721914826251004107465306183516039446249523003424"),  // recipient
            MontFp!("9853390606525154646148331562721914826251004107465306183516039446249523003424"),  // relayer
            Fr::from(0u64),                                                                            // fee
        ];

        let vk = get_verification_key();
        let pvk = prepare_verifying_key(&vk);
        let ok = Groth16::<Bn254>::verify_with_processed_vk(&pvk, &public_inputs, &proof)
            .unwrap_or(false);
        assert!(ok, "Rust verifier rejected a proof that snarkjs verified as true");
    }
}
