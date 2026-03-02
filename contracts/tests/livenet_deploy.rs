#[test]
fn deploy_to_livenet() {
    use odra::prelude::*;
    use odra::host::{Deployer, NoArgs};
    use shroud_protocol::shroud_protocol::ShroudProtocol;
    use std::env;

    // Set the env var for Odra to pick up the livenet config file
    env::set_var("ODRA_CASPER_LIVENET_ENV", "contracts/casper_livenet.env");

    let env = odra_test::env();

    println!("Attempting Livenet Deployment...");

    // Deploy
    let contract = ShroudProtocol::deploy(&env, NoArgs);

    println!("✅ Deployment Successful!");
    let address = format!("{:?}", contract.address());
    println!("Contract Address: {}", address);
    std::fs::write("deployment_output.txt", address).expect("Unable to write file");
}
