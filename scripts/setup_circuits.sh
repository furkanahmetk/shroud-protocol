#!/bin/bash
set -e

echo "🔐 Setting up ZK Circuits..."

cd circuits

# Check for snarkjs
if [ ! -d "node_modules/snarkjs" ]; then
    echo "Installing snarkjs..."
    npm install snarkjs
fi

SNARKJS="./node_modules/.bin/snarkjs"

# 1. Powers of Tau (Phase 1)
# Using bn128 curve, power 16 (supports ~65k constraints, our circuit is ~16k)
if [ ! -f "pot16_final.ptau" ]; then
    echo "Generating Powers of Tau (Phase 1)..."
    $SNARKJS powersoftau new bn128 16 pot16_0000.ptau -v
    $SNARKJS powersoftau contribute pot16_0000.ptau pot16_final.ptau --name="Dev" -v -e="random"
    $SNARKJS powersoftau prepare phase2 pot16_final.ptau pot16_final_prepared.ptau -v
fi

# 2. Phase 2 (Circuit Specific)
echo "Generating Circuit Keys (Phase 2)..."
$SNARKJS groth16 setup withdraw.r1cs pot16_final_prepared.ptau withdraw_0000.zkey
$SNARKJS zkey contribute withdraw_0000.zkey withdraw_final.zkey --name="Dev" -v -e="random"
$SNARKJS zkey export verificationkey withdraw_final.zkey verification_key.json

# 3. Copy Assets to Frontend
echo "Copying assets to frontend..."
mkdir -p ../frontend/public
cp withdraw_js/withdraw.wasm ../frontend/public/
cp withdraw_final.zkey ../frontend/public/

echo "✅ Setup Complete!"
cd ..
