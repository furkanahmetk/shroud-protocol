# Shroud Protocol

Shroud Protocol is a privacy-preserving mixer built on the Casper Network. It allows users to deposit CSPR into a smart contract and withdraw it later to a different address, effectively breaking the on-chain link between the depositor and the recipient. This is achieved using Zero-Knowledge Proofs (ZK-SNARKs) powered by Groth16 and MiMC hashing.

## 🌟 Features

- **Privacy**: Uses ZK-SNARKs (Groth16) to prove ownership of funds without revealing the deposit source.
- **Security**: Implements the MiMC7 hash function for efficient and secure in-circuit hashing.
- **Non-Custodial**: Users maintain full control of their funds via a secret key.
- **User-Friendly**: Includes a modern Web App and a CLI for advanced users.
- **Developer-Ready**: Built with the Odra framework for robust smart contract development.

## � User Interface
 
 The frontend features a **Premium Dark Theme** designed for a modern, immersive experience:
 
 - **Cosmic Aesthetic**: Deep black backgrounds with rich blue/purple mesh gradients.
 - **Glassmorphism**: Translucent cards and panels with subtle glowing borders.
 - **Interactive Elements**: Animated buttons, glowing text, and smooth transitions.
 
 ![Shroud Protocol UI](frontend/public/hero_shield_3d_1764582011240.png)
 *(Note: The above image is the 3D asset used in the Hero section)*
 
 ## �🏗️ Architecture

The protocol consists of three main components:

```mermaid
graph TD
    User[User] -->|Deposit| Frontend
    User -->|Withdraw| Frontend
    Frontend -->|Interacts| Contract[Smart Contract (Odra)]
    Frontend -->|Generates Proof| Circuits[ZK Circuits (Circom)]
    Contract -->|Verifies Proof| Verifier[Groth16 Verifier]
    Contract -->|Manages| MerkleTree[Merkle Tree]
```

- **Smart Contracts (`contracts/`)**: Written in Rust using the Odra framework. Handles deposits, manages the Merkle Tree state, and verifies ZK proofs to authorize withdrawals.
- **Circuits (`circuits/`)**: Written in Circom. Defines the constraints for the ZK proof, ensuring that the user knows the secret corresponding to a valid leaf in the Merkle Tree.
- **Frontend (`frontend/`)**: A Next.js web application featuring a **Premium Dark Theme** with a "Cosmic" aesthetic. It manages the user's wallet connection, generates secrets, computes ZK proofs in the browser using `snarkjs`, and submits transactions.
- **CLI (`cli/`)**: A TypeScript-based command-line tool for automated interactions and testing.

## 📂 Project Structure

- `contracts/`: Rust smart contracts (Odra).
- `circuits/`: Circom circuits and trusted setup scripts.
- `cli/`: TypeScript CLI for interacting with the protocol.
- `frontend/`: Next.js web interface.
- `scripts/`: Automation scripts for building, testing, and setup.
- `docs/`: Detailed developer documentation.

## Getting Started

### 📦 Dependencies

We provide a script to install all necessary dependencies (Rust, Odra, Casper Client, npm packages).

1.  **Run the installation script**:
    ```bash
    ./scripts/install_dependencies.sh
    ```

**Manual Installation Details:**

| Tool | Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | v18+ | Runtime for CLI and Frontend |
| **Rust** | v1.70+ | Language for Smart Contracts |
| **Cargo Odra** | Latest | Framework for Casper Contracts |
| **Casper Client**| Latest | Tool for interacting with Casper Network |
| **Circom** | v2.0+ | Compiler for ZK Circuits |
| **SnarkJS** | v0.7.0+ | ZK Proof generation and verification |

### 🚀 Quick Start (Automated)

We provide scripts to automate the build and setup process.

1.  **Build Everything**:
    ```bash
    ./scripts/build_all.sh
    ```
2.  **Run Tests**:
    ```bash
    ./scripts/test_all.sh
    ```
3.  **Setup Circuits (Trusted Setup)**:
    ```bash
    ./scripts/setup_circuits.sh
    ```

### 🛠️ Manual Installation

If you prefer to install components manually:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/shroud-protocol.git
    cd shroud-protocol
    ```

2.  **Install Dependencies**:
    ```bash
    # CLI
    cd cli && npm install && cd ..
    
    # Frontend
    cd frontend && npm install && cd ..
    ```

## 📖 Usage

#### 1. Frontend (Recommended)

The easiest way to use Shroud Protocol is via the web interface.

**Prerequisites:**
- Install the [Casper Wallet Extension](https://www.casperwallet.io/).
- Create a wallet and fund it with CSPR (Testnet).

**Steps:**
1.  **Start the App**:
    ```bash
    cd frontend
    npm install
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
    - **IMPORTANT**: The app will display your **Secret Key** (JSON format). Copy and save it securely! You need this to withdraw.
4.  **Withdraw**:
    - Go to the **Withdraw** tab.
    - Paste your **Secret Key JSON** into the text area.
    - Enter the **Recipient Address** (a fresh address for privacy).
    - Click **"Withdraw"**.
    - The app will generate a Zero-Knowledge Proof (this may take a few seconds) and submit the transaction.

#### 2. CLI (Advanced)

For developers or automated scripts.

See [USAGE.md](./USAGE.md) for detailed scenarios and examples.

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
