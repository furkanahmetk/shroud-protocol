
#[odra::test]
fn deploy_to_livenet(env: odra::test_env::TestEnv) {
    use odra::prelude::*;
    use odra::host::NoArgs;
    use shroud_protocol::shroud_protocol::ShroudProtocol;
    use std::env;

    // Set the env var for Odra to pick up the livenet config file
    // Note: In a test, this might run before backend init? 
    // Usually backend choice happens at compile time or process start.
    // Setting it here might be too late if the backend initializes globally.
    // But we'll try.
    env::set_var("ODRA_CASPER_LIVENET_ENV", "contracts/casper_livenet.env");

    println!("Attempting Livenet Deployment...");

    // Deploy
    let contract = ShroudProtocol::deploy(&env, NoArgs);

    println!("✅ Deployment Successful!");
    let address = format!("{:?}", contract.address());
    println!("Contract Address: {}", address);
    std::fs::write("deployment_output.txt", address).expect("Unable to write file");
}
