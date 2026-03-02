#![no_std]
#![no_main]

extern crate alloc;

use casper_contract::{
    contract_api::{runtime, system, account},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    runtime_args, URef, U256, U512, contracts::ContractPackageHash,
};

// Use wee_alloc as the global allocator
#[cfg(target_arch = "wasm32")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// Panic handler required for no_std
#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}

// Entry point for deposit session code
// This creates a cargo_purse, transfers CSPR to it, then calls the contract's deposit
#[no_mangle]
pub extern "C" fn call() {
    // Get arguments
    let contract_package_hash: ContractPackageHash = runtime::get_named_arg("contract_package_hash");
    let commitment: U256 = runtime::get_named_arg("commitment");
    let amount: U512 = runtime::get_named_arg("amount");
    
    // Get the account's main purse
    let main_purse: URef = account::get_main_purse();
    
    // Create a temporary purse (cargo_purse) and transfer the deposit amount to it
    let cargo_purse: URef = system::create_purse();
    system::transfer_from_purse_to_purse(main_purse, cargo_purse, amount, None)
        .unwrap_or_revert();
    
    // Call the contract's deposit entry point with the cargo_purse
    // Odra expects "cargo_purse" as a named argument for payable functions
    let args = runtime_args! {
        "commitment" => commitment,
        "amount" => amount,
        "cargo_purse" => cargo_purse,
    };
    
    runtime::call_versioned_contract::<()>(
        contract_package_hash,
        None, // Use latest version
        "deposit",
        args,
    );
}
