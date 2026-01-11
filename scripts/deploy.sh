#!/bin/bash

# Configuration
NODE_ADDRESS="https://node.testnet.casper.network" # Default to local, change for testnet (e.g., http://rpc.testnet.casperlabs.io:7777)
CHAIN_NAME="casper-test" # Change to casper-test for testnet
SECRET_KEY_PATH="/home/fkara/shroudv2/Account1_secret_key.pem" # Path to your faucet/deployer key
CONTRACT_NAME="shroud_protocol"

echo "🚀 Deploying Shroud Protocol to $CHAIN_NAME..."

# Resolve script directory to handle running from root or scripts/
SCRIPT_DIR="$(dirname "$(realpath "$0")")"
PROJECT_ROOT="$SCRIPT_DIR/.."
CONTRACTS_DIR="$PROJECT_ROOT/contracts"
ARTIFACT_PATH="$CONTRACTS_DIR/wasm/ShroudProtocol.wasm"

# 1. Build Contracts
echo "📦 Building contracts..."
cd "$CONTRACTS_DIR" || exit
cargo odra build
cd "$PROJECT_ROOT" || exit

# 2. Compile Circuits (Optional if already done)
if [ ! -f "circuits/withdraw.wasm" ]; then
    echo "⚡ Compiling circuits..."
    if [ -d "circuits" ]; then
        cd circuits
        circom withdraw.circom --r1cs --wasm --sym
        # Note: Trusted setup commands should be run manually or via a separate setup script
        cd ..
    else
        echo "⚠️  Circuits directory not found, skipping..."
    fi
fi

# 3. Deploy Contract
echo "🌐 Sending deploy transaction..."
# This command deploys the compiled WASM to the network
casper-client put-transaction session \
    --node-address https://node.testnet.casper.network \
    --chain-name casper-test \
    --secret-key "$SECRET_KEY_PATH" \
    --payment-amount 150000000000 \
    --gas-price-tolerance 1 \
    --standard-payment true \
    --install-upgrade \
    --wasm-path "$ARTIFACT_PATH" \
    --ttl "5min" \
    --session-arg "odra_cfg_package_hash_key_name:opt_string='shroud_v11_package_hash'" \
    --session-arg "odra_cfg_allow_key_override:opt_bool='true'" \
    --session-arg "odra_cfg_is_upgradable:opt_bool='false'"

echo "⏳ Waiting for deployment..."
# In a real script, we would query the node to get the deploy status and contract hash
# For now, we instruct the user to check the deploy hash returned above

echo "✅ Deploy command sent!"
echo "👉 Please check your block explorer or use 'casper-client get-deploy' to get the contract hash."
echo "   Once you have the hash, update your CLI and Frontend configuration."
