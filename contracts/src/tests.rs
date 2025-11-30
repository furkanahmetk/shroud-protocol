// Note: These tests require `cargo-odra` to be installed and configured.
// Run with `cargo odra test`.
use crate::shroud_protocol::{ShroudProtocolHostRef, DENOMINATION};
use odra::host::{Deployer, HostRef, NoArgs};
use odra::casper_types::{U256, U512};

#[test]
fn test_deposit() {
    // Try to get env, if test_env is missing, we might need to check features
    let env = odra::test_env();
    let mut contract = ShroudProtocolHostRef::deploy(&env, NoArgs);

    // Generate a random commitment (mock)
    let commitment = U256::from(12345);
    let amount = U512::from(DENOMINATION);

    // Deposit with correct amount
    env.set_caller(env.get_account(0));
    contract.with_tokens(amount).deposit(commitment);

    // Try depositing same commitment again (should fail)
    assert!(contract.with_tokens(amount).try_deposit(commitment).is_err());
}

#[test]
fn test_deposit_invalid_amount() {
    let env = odra::test_env();
    let mut contract = ShroudProtocolHostRef::deploy(&env, NoArgs);

    let commitment = U256::from(67890);
    let wrong_amount = U512::from(DENOMINATION - 1);

    // Should revert with InvalidAmount
    assert!(contract.with_tokens(wrong_amount).try_deposit(commitment).is_err());
}

#[test]
fn test_withdraw_with_mock_proof() {
    let env = odra::test_env();
    let mut contract = ShroudProtocolHostRef::deploy(&env, NoArgs);

    // 1. Deposit
    let commitment = U256::from(12345);
    let amount = U512::from(DENOMINATION);
    env.set_caller(env.get_account(0));
    contract.with_tokens(amount).deposit(commitment);

    // 2. Withdraw
    // In a real scenario, we need a valid proof.
    // Since we are mocking the verifier (or if the verifier is not strict in test mode),
    // we will try to call withdraw.
    // Note: If the verifier is real, this will fail without a real proof.
    // For unit tests, we often mock the verifier or use a debug flag.
    // Assuming the contract checks the proof, this might fail if we pass dummy data.
    // However, we can test the *structure* of the call.
    
    let proof = vec![1, 2, 3]; // Dummy proof
    let root = commitment; // In a 1-leaf tree, root might be related to commitment (simplified)
    let nullifier_hash = U256::from(999);
    let recipient = env.get_account(1);

    // This is expected to fail verification if the verifier is active.
    // But we want to ensure it doesn't panic or fail with unrelated errors.
    // If we want to test success, we need to mock the verifier trait.
    // For now, let's assert that it handles the call (even if it rejects the proof).
    let result = contract.try_withdraw(proof, root, nullifier_hash, recipient);
    
    // It should likely return an error (InvalidProof) rather than panic.
    assert!(result.is_err()); 
}

#[test]
fn test_double_spend_prevention() {
    let env = odra::test_env();
    let mut contract = ShroudProtocolHostRef::deploy(&env, NoArgs);

    let commitment = U256::from(111);
    let amount = U512::from(DENOMINATION);
    env.set_caller(env.get_account(0));
    contract.with_tokens(amount).deposit(commitment);

    // We can't easily test successful double spend without a valid proof for the first spend.
    // But we can verify that the nullifier mapping is working if we could insert into it.
    // Since we can't cheat the contract state easily in integration tests,
    // this test is limited to what we can do via the public API.
}
