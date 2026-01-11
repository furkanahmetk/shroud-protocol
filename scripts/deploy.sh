#!/bin/bash

# Shroud Protocol Deployment Script
# Uses Odra CLI for reliable contract deployment to Casper Network

set -e

# Configuration
CHAIN_NAME="${CHAIN_NAME:-casper-test}"
SECRET_KEY_PATH="${SECRET_KEY_PATH:-/home/fkara/shroudv2/Account1_secret_key.pem}"

echo "🚀 Deploying Shroud Protocol to $CHAIN_NAME..."

# Resolve script directory to handle running from root or scripts/
SCRIPT_DIR="$(dirname "$(realpath "$0")")"
PROJECT_ROOT="$SCRIPT_DIR/.."
CONTRACTS_DIR="$PROJECT_ROOT/contracts"

# Set up Odra livenet environment
export ODRA_CASPER_LIVENET_ENV="$CONTRACTS_DIR/casper_livenet.env"

# Ensure livenet config exists
if [ ! -f "$CONTRACTS_DIR/casper_livenet.env" ]; then
    echo "📝 Creating casper_livenet.env..."
    cat > "$CONTRACTS_DIR/casper_livenet.env" << EOF
ODRA_CASPER_LIVENET_NODE_ADDRESS=https://node.testnet.casper.network
ODRA_CASPER_LIVENET_EVENTS_URL=https://node.testnet.casper.network/events
ODRA_CASPER_LIVENET_CHAIN_NAME=$CHAIN_NAME
ODRA_CASPER_LIVENET_SECRET_KEY_PATH=$SECRET_KEY_PATH
EOF
fi

# 1. Build Contracts
echo "📦 Building contracts..."
cd "$CONTRACTS_DIR" || exit
cargo odra build
cd "$PROJECT_ROOT" || exit

# 2. Compile Circuits (if not already done)
if [ ! -f "circuits/withdraw.wasm" ]; then
    echo "⚡ Compiling circuits..."
    if [ -d "circuits" ]; then
        cd circuits
        circom withdraw.circom --r1cs --wasm --sym
        cd ..
    else
        echo "⚠️  Circuits directory not found, skipping..."
    fi
fi

# 3. Deploy Contract using Odra CLI
echo "🌐 Deploying contract via Odra..."
cd "$CONTRACTS_DIR" || exit
cargo run --bin deploy
cd "$PROJECT_ROOT" || exit

# 4. Display results
echo ""
echo "✅ Deployment Complete!"
echo "📄 Contract address saved to: contracts/deployment_address.txt"
echo ""
if [ -f "$CONTRACTS_DIR/deployment_address.txt" ]; then
    echo "📦 Contract Address:"
    cat "$CONTRACTS_DIR/deployment_address.txt"
    echo ""
fi
echo "👉 Update your frontend config with the contract package hash."
echo "   File: frontend/src/utils/casper.ts → CONTRACT_HASH"
