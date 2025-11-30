#!/bin/bash
set -e

echo "🚀 Building Shroud Protocol..."

# 1. Contracts
echo "📦 Building Contracts..."
cd contracts
cargo build --release --target wasm32-unknown-unknown
cd ..

# 2. Circuits
echo "⚡ Building Circuits..."
cd circuits
if ! command -v circom &> /dev/null; then
    echo "❌ circom not found. Please install it first."
    exit 1
fi
circom withdraw.circom --r1cs --wasm --sym --c
cd ..

# 3. CLI
echo "💻 Building CLI..."
cd cli
npm install
npm run build
cd ..

# 4. Frontend
echo "🎨 Building Frontend..."
cd frontend
npm install
npm run build
cd ..

echo "✅ Build Complete!"
