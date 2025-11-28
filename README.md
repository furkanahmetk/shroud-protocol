# Shroud Protocol

Shroud Protocol is a privacy mixer for the Casper Network, enabling users to break the on-chain link between deposits and withdrawals using Zero-Knowledge Proofs (Groth16).

## Features

- **Deposit**: Deposit 100 CSPR into the mixer.
- **Withdraw**: Withdraw 100 CSPR to a fresh address using a ZK proof.
- **Privacy**: Uses MiMC hash and Merkle Trees to ensure anonymity.
- **CLI**: Command-line interface for easy interaction.
- **Web App**: Modern React/Next.js interface.

## Project Structure

- `contracts/`: Rust smart contracts for Casper Network.
- `circuits/`: Circom circuits for ZK proofs.
- `cli/`: TypeScript CLI tool.
- `frontend/`: Next.js web application.
- `scripts/`: Utility scripts.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following tools installed:

1.  **Node.js & npm** (v18+)
    -   Download: [https://nodejs.org/](https://nodejs.org/)
    -   Verify: `node -v` and `npm -v`

2.  **Rust & Cargo** (v1.70+)
    -   Install (Linux/macOS): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
    -   Install (Windows): Download `rustup-init.exe` from [https://rustup.rs/](https://rustup.rs/)
    -   Add WASM target: `rustup target add wasm32-unknown-unknown`
    -   Verify: `rustc --version` and `cargo --version`

3.  **Circom** (v2.0+)
    -   Install Rust first.
    -   Clone: `git clone https://github.com/iden3/circom.git`
    -   Build: `cd circom && cargo build --release`
    -   Install: `cargo install --path circom`
    -   Verify: `circom --version`

4.  **Casper Client**
    -   Install: `cargo install casper-client`
    -   Verify: `casper-client --version`

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   cd cli && npm install
   cd ../frontend && npm install
   ```

### Usage

#### 1. Frontend (Recommended)

The easiest way to use Shroud Protocol is via the web interface.

**Prerequisites:**
- Install the [Casper Wallet Extension](https://www.casperwallet.io/).
- Create a wallet and fund it with CSPR (Testnet).

**Steps:**
1.  **Start the App**:
    ```bash
    cd frontend
    npm run dev
    ```
2.  **Connect Wallet**:
    - Open `http://localhost:3000`.
    - Click **"Connect Wallet"** in the top right.
    - Approve the connection in the popup.
3.  **Deposit**:
    - Go to the **Deposit** tab.
    - Click **"Deposit 100 CSPR"**.
    - Sign the transaction in your wallet.
    - **IMPORTANT**: Save the "Secret Key" displayed. You need this to withdraw!
4.  **Withdraw**:
    - Go to the **Withdraw** tab.
    - Enter your **Secret Key**.
    - Enter the **Recipient Address** (a fresh address for privacy).
    - Click **"Withdraw"**.
    - The ZK proof will be generated and the transaction submitted.

#### 2. CLI (Advanced)

For developers or automated scripts.

**Setup:**
```bash
cd cli
npm install
npm run build
```

**Commands:**

*   **Deposit**:
    ```bash
    # Generates a secret, saves it to output, and deposits 100 CSPR
    npm start -- deposit \
      --node http://127.0.0.1:11101 \
      --contract <CONTRACT_HASH> \
      --key ./path/to/secret_key.pem \
      --output ./my_secret.json
    ```

*   **Withdraw**:
    ```bash
    # Uses the secret to generate a proof and withdraw to a recipient
    npm start -- withdraw \
      --node http://127.0.0.1:11101 \
      --contract <CONTRACT_HASH> \
      --secrets ./my_secret.json \
      --recipient <RECIPIENT_PUBLIC_KEY_HEX> \
      --wasm ../circuits/withdraw.wasm \
      --zkey ../circuits/withdraw_final.zkey \
      --key ./path/to/payer_key.pem
    ```

## License

MIT
