
#[cfg(not(target_arch = "wasm32"))]
fn main() {
    use odra::host::{Deployer, NoArgs};
    use odra::prelude::*;
    use shroud_protocol::shroud_protocol::ShroudProtocol;
    use std::env;

    // Set the env var for Odra to pick up the livenet config file
    env::set_var("ODRA_CASPER_LIVENET_ENV", "contracts/casper_livenet.env");

    println!("Initializing Odra Livenet Environment...");
    
    // Use the explicitly exported env() from the backend crate
    let env = odra_casper_livenet_env::env();
    
    // Set gas for deployment (400 CSPR)
    env.set_gas(400_000_000_000u64); // 400 * 10^9

    println!("Deploying Shroud Protocol...");
    let contract = ShroudProtocol::deploy(&env, NoArgs);

    println!("✅ Deployment Successful!");
    let address = format!("{:?}", contract.address());
    println!("Contract Address: {}", address);
    // Write address to file for verification
    std::fs::write("deployment_address.txt", address).expect("Unable to write file");
}

#[cfg(target_arch = "wasm32")]
fn main() {}
