#!/bin/bash
set -e

echo "🚀 Building Shroud Protocol..."

# Resolve script directory
SCRIPT_DIR="$(dirname "$(realpath "$0")")"
PROJECT_ROOT="$SCRIPT_DIR/.."

cd "$PROJECT_ROOT"

# 1. Contracts (using Odra)
echo "📦 Building Contracts..."
cd contracts
cargo odra build
cd "$PROJECT_ROOT"

# 2. Circuits
echo "⚡ Building Circuits..."
cd circuits
if ! command -v circom &> /dev/null; then
    echo "❌ circom not found. Please install it first."
    echo "   Run: ./scripts/setup_circuits.sh"
    exit 1
fi
circom withdraw.circom --r1cs --wasm --sym --c
cd "$PROJECT_ROOT"

# 3. CLI
echo "💻 Building CLI..."
cd cli
npm install
npm run build
cd "$PROJECT_ROOT"

# 4. Frontend
echo "🎨 Building Frontend..."
cd frontend
npm install
npm run build
cd "$PROJECT_ROOT"

echo "✅ Build Complete!"
echo ""
echo "📄 WASM artifacts: contracts/wasm/"
echo "🔗 To deploy: ./scripts/deploy.sh"
