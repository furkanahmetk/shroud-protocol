#[cfg(test)]
mod tests {
    use shroud_protocol::shroud_protocol::ShroudProtocol;
    use odra::host::{Deployer, NoArgs};

    #[test]
    fn test_deploy() {
        let env = odra_test::env();
        let _contract = ShroudProtocol::deploy(&env, NoArgs);
    }
}
