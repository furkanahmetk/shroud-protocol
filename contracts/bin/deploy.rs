
#[cfg(not(target_arch = "wasm32"))]
fn main() {
    use odra::host::Deployer;
    use odra::prelude::*;
    use shroud_protocol::shroud_protocol::{ShroudProtocol, ShroudProtocolInitArgs};
    use std::env;

    // Surface internal Odra/casper-client errors (otherwise log::error! is silenced).
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    // Set the env var for Odra to pick up the livenet config file
    env::set_var("ODRA_CASPER_LIVENET_ENV", "contracts/casper_livenet.env");

    println!("Initializing Odra Livenet Environment...");

    // Use the explicitly exported env() from the backend crate
    let env = odra_casper_livenet_env::env();

    // Set gas for deployment. Casper 2.0 testnet caps install_upgrade transactions
    // at the chainspec's category gas limit; 2000 CSPR (the v1 default) exceeds it
    // and the node returns "exceeds the network's block gas limit". 100 CSPR is
    // the standard ceiling for contract installs on testnet 2.0.
    env.set_gas(750_000_000_000u64); // 750 CSPR

    // Treasury receives the protocol fee (25 bps per withdrawal).
    // Defaults to the deployer; override via SHROUD_TREASURY_ADDRESS env var
    // (formatted as the standard Casper Address debug repr).
    let treasury = match env::var("SHROUD_TREASURY_ADDRESS") {
        Ok(addr_str) => parse_address(&addr_str).expect("Invalid SHROUD_TREASURY_ADDRESS"),
        Err(_) => env.caller(),
    };

    println!("Deploying Shroud Protocol (treasury: {:?})...", treasury);
    let contract = ShroudProtocol::deploy(&env, ShroudProtocolInitArgs { treasury });

    println!("✅ Deployment Successful!");
    let address = format!("{:?}", contract.address());
    println!("Contract Address: {}", address);
    // Write address to file for verification
    std::fs::write("deployment_address.txt", address).expect("Unable to write file");
}

#[cfg(not(target_arch = "wasm32"))]
fn parse_address(s: &str) -> Option<odra::prelude::Address> {
    // Accepts the standard `account-hash-…` / `hash-…` debug formats.
    use std::str::FromStr;
    odra::prelude::Address::from_str(s).ok()
}

#[cfg(target_arch = "wasm32")]
fn main() {}
