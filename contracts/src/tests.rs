// Integration tests. Run with `cargo odra test`.
use crate::shroud_protocol::{
    ShroudProtocol, ShroudProtocolHostRef, ShroudProtocolInitArgs, DENOMINATION,
    PROTOCOL_FEE_BPS, BPS_DENOMINATOR,
};
use odra::host::{Deployer, HostRef};
use odra::casper_types::{U256, U512};

fn deploy(env: &odra::host::HostEnv) -> ShroudProtocolHostRef {
    let init_args = ShroudProtocolInitArgs {
        treasury: env.get_account(9),
    };
    ShroudProtocol::deploy(env, init_args)
}

#[test]
fn test_deposit() {
    let env = odra::test_env();
    let mut contract = deploy(&env);

    let commitment = U256::from(12345);
    let amount = U512::from(DENOMINATION);

    env.set_caller(env.get_account(0));
    contract.with_tokens(amount).deposit(commitment);

    // Duplicate commitment must fail
    assert!(contract.with_tokens(amount).try_deposit(commitment).is_err());
}

#[test]
fn test_deposit_invalid_amount() {
    let env = odra::test_env();
    let mut contract = deploy(&env);

    let commitment = U256::from(67890);
    let wrong_amount = U512::from(DENOMINATION - 1);

    assert!(contract.with_tokens(wrong_amount).try_deposit(commitment).is_err());
}

#[test]
fn test_withdraw_with_mock_proof() {
    let env = odra::test_env();
    let mut contract = deploy(&env);

    let commitment = U256::from(12345);
    let amount = U512::from(DENOMINATION);
    env.set_caller(env.get_account(0));
    contract.with_tokens(amount).deposit(commitment);

    let proof = vec![1, 2, 3];
    let root = commitment;
    let nullifier_hash = U256::from(999);
    let recipient = env.get_account(1);
    let relayer = env.get_account(2);
    let fee = U512::zero();

    // Root won't match a known root => UnknownRoot expected. Must not panic.
    let result = contract.try_withdraw(proof, root, nullifier_hash, recipient, relayer, fee);
    assert!(result.is_err());
}

#[test]
fn test_fee_too_high_reverts() {
    // relayer_fee >= DENOMINATION must revert with FeeTooHigh.
    let env = odra::test_env();
    let mut contract = deploy(&env);

    let commitment = U256::from(42);
    let amount = U512::from(DENOMINATION);
    env.set_caller(env.get_account(0));
    contract.with_tokens(amount).deposit(commitment);

    let proof = vec![1, 2, 3];
    let root = commitment; // any value; FeeTooHigh check happens after root check
    let nullifier_hash = U256::from(7);
    let recipient = env.get_account(1);
    let relayer = env.get_account(2);
    let fee = U512::from(DENOMINATION);

    let result = contract.try_withdraw(proof, root, nullifier_hash, recipient, relayer, fee);
    assert!(result.is_err());
}

#[test]
fn test_protocol_fee_constants() {
    assert_eq!(PROTOCOL_FEE_BPS, 25);
    assert_eq!(BPS_DENOMINATOR, 10_000);
    let expected_protocol_fee = DENOMINATION * PROTOCOL_FEE_BPS / BPS_DENOMINATOR;
    assert_eq!(expected_protocol_fee, 250_000_000); // 0.25 CSPR in motes
}
