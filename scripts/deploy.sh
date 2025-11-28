#!/bin/bash

# Configuration
NODE_ADDRESS="http://127.0.0.1:11101" # Default to local, change for testnet (e.g., http://rpc.testnet.casperlabs.io:7777)
CHAIN_NAME="casper-net-1" # Change to casper-test for testnet
SECRET_KEY_PATH="./secret_key.pem" # Path to your faucet/deployer key
CONTRACT_NAME="shroud_protocol"

echo "🚀 Deploying Shroud Protocol to $CHAIN_NAME..."

# 1. Build Contracts
echo "📦 Building contracts..."
cd contracts
cargo build --release --target wasm32-unknown-unknown
cd ..

# 2. Compile Circuits (Optional if already done)
if [ ! -f "circuits/withdraw.wasm" ]; then
    echo "⚡ Compiling circuits..."
    cd circuits
    circom withdraw.circom --r1cs --wasm --sym
    # Note: Trusted setup commands should be run manually or via a separate setup script
    cd ..
fi

# 3. Deploy Contract
echo "🌐 Sending deploy transaction..."
# This command deploys the compiled WASM to the network
casper-client put-deploy \
    --node-address "$NODE_ADDRESS" \
    --chain-name "$CHAIN_NAME" \
    --secret-key "$SECRET_KEY_PATH" \
    --payment-amount 150000000000 \
    --session-path "contracts/target/wasm32-unknown-unknown/release/contract.wasm"

echo "⏳ Waiting for deployment..."
# In a real script, we would query the node to get the deploy status and contract hash
# For now, we instruct the user to check the deploy hash returned above

echo "✅ Deploy command sent!"
echo "👉 Please check your block explorer or use 'casper-client get-deploy' to get the contract hash."
echo "   Once you have the hash, update your CLI and Frontend configuration."
