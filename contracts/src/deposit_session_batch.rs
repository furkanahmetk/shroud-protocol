#![cfg_attr(target_arch = "wasm32", no_std)]
#![cfg_attr(target_arch = "wasm32", no_main)]

#[cfg(target_arch = "wasm32")]
extern crate alloc;

#[cfg(target_arch = "wasm32")]
use alloc::vec::Vec;
#[cfg(target_arch = "wasm32")]
use casper_contract::{
    contract_api::{account, runtime, system},
    unwrap_or_revert::UnwrapOrRevert,
};
#[cfg(target_arch = "wasm32")]
use casper_types::{contracts::ContractPackageHash, runtime_args, U256, U512, URef};

#[cfg(target_arch = "wasm32")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[cfg(target_arch = "wasm32")]
#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}

#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn call() {
    let contract_package_hash: ContractPackageHash = runtime::get_named_arg("contract_package_hash");
    let commitments: Vec<U256> = runtime::get_named_arg("commitments");
    let amount: U512 = runtime::get_named_arg("amount");

    let main_purse: URef = account::get_main_purse();
    let cargo_purse: URef = system::create_purse();
    system::transfer_from_purse_to_purse(main_purse, cargo_purse, amount, None).unwrap_or_revert();

    let args = runtime_args! {
        "commitments" => commitments,
        "amount" => amount,
        "cargo_purse" => cargo_purse,
    };

    runtime::call_versioned_contract::<()>(contract_package_hash, None, "deposit_batch", args);
}

#[cfg(not(target_arch = "wasm32"))]
fn main() {}
