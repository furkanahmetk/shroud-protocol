
#[cfg(test)]
mod tests {
    use shroud_protocol::shroud_protocol::ShroudProtocol;
    use odra::host::Deployer;

    #[test]
    fn test_deploy() {
        let env = odra::test_env::get();
        // Attemp basic deployment
        // In Odra 2, deploy usually takes the args. 
        // If init() has no args, we pass ().
        let _contract = ShroudProtocol::deploy(&env, ());
    }
}
