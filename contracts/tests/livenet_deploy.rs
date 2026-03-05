#![cfg(feature = "livenet-tests")]

use odra::host::{Deployer, HostRef, NoArgs};
use shroud_protocol::shroud_protocol::ShroudProtocolHostRef;
use std::env;

#[test]
#[ignore = "requires livenet env configuration and should not run in default CI"]
fn deploy_to_livenet() {
    env::set_var("ODRA_CASPER_LIVENET_ENV", "contracts/casper_livenet.env");
    let env = odra::test_env();
    let contract = ShroudProtocolHostRef::deploy(&env, NoArgs);
    let address = format!("{:?}", contract.address());
    std::fs::write("deployment_output.txt", address).expect("Unable to write file");
}
