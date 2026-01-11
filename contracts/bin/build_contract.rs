#![doc = "Binary for building wasm files from odra contracts."]
#![no_std]
#![cfg_attr(target_arch = "wasm32", no_main)]
#![allow(unused_imports, clippy::single_component_path_imports)]

#[cfg(not(target_arch = "wasm32"))]
fn main() {}

#[cfg(target_arch = "wasm32")]
extern crate odra_casper_wasm_env;

#[cfg(target_arch = "wasm32")]
use shroud_protocol::shroud_protocol::ShroudProtocol;

#[cfg(target_arch = "wasm32")]
use odra_casper_wasm_env as _;

use shroud_protocol;
