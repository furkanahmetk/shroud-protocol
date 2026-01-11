# Deployment Guide

This guide details how to deploy the Shroud Protocol to the Casper Testnet and host the frontend.

## 1. Prerequisites

- **Rust**: Installed with nightly toolchain (`rustup default nightly`)
- **wasm32 target**: `rustup target add wasm32-unknown-unknown`
- **Casper Wallet**: A funded account on Casper Testnet
  - [Create Wallet](https://cspr.live/)
  - [Faucet](https://testnet.cspr.live/tools/faucet)
- **Node.js**: v18+ (for frontend and circuits)
- **Circom**: For circuit compilation (see `scripts/setup_circuits.sh`)

## 2. Deploying Smart Contracts

### Step 1: Prepare Keys

1. Download your secret key from the Casper Wallet/CSPR.live
2. Save it as `Account1_secret_key.pem` in the repository root (DO NOT COMMIT THIS FILE)

### Step 2: Configure Environment

Create or update `contracts/casper_livenet.env`:

```env
ODRA_CASPER_LIVENET_NODE_ADDRESS=https://node.testnet.casper.network
ODRA_CASPER_LIVENET_EVENTS_URL=https://node.testnet.casper.network/events
ODRA_CASPER_LIVENET_CHAIN_NAME=casper-test
ODRA_CASPER_LIVENET_SECRET_KEY_PATH=/path/to/your/Account1_secret_key.pem
```

### Step 3: Build & Deploy

```bash
# Option 1: Use the deploy script (recommended)
./scripts/deploy.sh

# Option 2: Manual deployment
cd contracts
cargo odra build
cargo run --bin deploy
```

The script will output the **Contract Package Hash**.

### Step 4: Update Frontend Config

Open `frontend/src/utils/casper.ts` and update:

```typescript
export const CONTRACT_HASH = "hash-YOUR_NEW_CONTRACT_HASH...";
```

## 3. Key Files

| File | Purpose |
|------|---------|
| `contracts/Odra.toml` | Contract configuration with FQN paths |
| `contracts/build.rs` | Critical for WASM entry point generation |
| `contracts/bin/deploy.rs` | Odra-based deployment script |
| `contracts/casper_livenet.env` | Network configuration |

## 4. Deploying Frontend

### Option A: Vercel (Recommended)

```bash
cd frontend
npm install
npx vercel
```

### Option B: Local Development

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

## 5. Troubleshooting

### "Module doesn't have export call"
Ensure `contracts/build.rs` exists and contains the ODRA_MODULE forwarding logic.

### "Out of gas"
Increase gas in `contracts/bin/deploy.rs`:
```rust
env.set_gas(600_000_000_000u64); // 600 CSPR
```

### "Missing argument"
Use Odra CLI (`cargo run --bin deploy`) instead of casper-client for proper argument handling.
