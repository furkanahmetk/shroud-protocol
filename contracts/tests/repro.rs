#![cfg(feature = "livenet-tests")]

use odra::host::{Deployer, NoArgs};
use shroud_protocol::shroud_protocol::ShroudProtocolHostRef;

#[test]
fn test_deploy() {
    let env = odra::test_env();
    let _contract = ShroudProtocolHostRef::deploy(&env, NoArgs);
}
