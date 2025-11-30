#!/bin/bash
set -e

echo "🛠️  Installing Dependencies for Shroud Protocol..."

# 1. Check for Rust
if ! command -v rustc &> /dev/null; then
    echo "🦀 Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    echo "✅ Rust is already installed."
fi

# 2. Add WASM target
echo "🎯 Adding WASM target..."
rustup target add wasm32-unknown-unknown

# 3. Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js (v18+) manually from https://nodejs.org/"
    exit 1
else
    echo "✅ Node.js is installed."
fi

# 4. Install Cargo Odra
if ! command -v cargo-odra &> /dev/null; then
    echo "📦 Installing cargo-odra..."
    cargo install cargo-odra
else
    echo "✅ cargo-odra is already installed."
fi

# 5. Install Casper Client
if ! command -v casper-client &> /dev/null; then
    echo "👻 Installing casper-client..."
    cargo install casper-client
else
    echo "✅ casper-client is already installed."
fi

# 6. Install Circom (Binary)
if ! command -v circom &> /dev/null; then
    echo "🧮 Installing Circom..."
    echo "⚠️  Note: Installing circom via cargo is one option, but pre-built binaries are recommended for speed."
    echo "   Attempting cargo install (this may take a while)..."
    cargo install --git https://github.com/iden3/circom.git
else
    echo "✅ Circom is already installed."
fi

# 7. Install Project Dependencies
echo "📚 Installing project dependencies..."

echo "   - CLI..."
cd cli && npm install && cd ..

echo "   - Frontend..."
cd frontend && npm install && cd ..

echo "   - Circuits..."
cd circuits && npm install && cd ..

echo "🎉 All dependencies installed successfully!"
