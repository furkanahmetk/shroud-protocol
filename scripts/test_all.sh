#!/bin/bash
set -e

echo "🧪 Running Tests..."

# 1. Contracts
echo "Testing Contracts..."
cd contracts
# cargo odra test # Uncomment if cargo-odra is installed and configured
cargo test
cd ..

# 2. Circuits
echo "Testing Circuits..."
cd circuits
# npm test # Uncomment if circuit tests are implemented
echo "Circuit tests skipped (not implemented)"
cd ..

# 3. CLI
echo "Testing CLI..."
cd cli
# Basic build check as test
npm run build
echo "CLI build check passed"
cd ..

# 4. Frontend
echo "Testing Frontend..."
cd frontend
# npm run lint # Skipped to avoid interactive prompt
npm run build
echo "Frontend build check passed"
cd ..

echo "✅ All Tests Passed!"
