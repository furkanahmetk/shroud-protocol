fn main() {
    println!("cargo:rerun-if-env-changed=ODRA_MODULE");

    // cargo-odra sets ODRA_MODULE=<ContractName> before building wasm binaries.
    // Odra-generated wasm entrypoints are gated behind cfg(odra_module = "<ContractName>"),
    // so we need to forward ODRA_MODULE into a rustc cfg flag.
    if let Ok(module) = std::env::var("ODRA_MODULE") {
        if !module.trim().is_empty() {
            println!("cargo:rustc-cfg=odra_module=\"{}\"", module);
        }
    }
}
