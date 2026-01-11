# Shroud CLI

Command-line interface for interacting with the Shroud Protocol on Casper Network.

## Installation

```bash
npm install
npm run build
```

## Commands

### Deposit

Deposit 100 CSPR into the mixer. Generates a secret key that must be saved to withdraw later.

```bash
npm start -- deposit \
  --node https://node.testnet.casper.network \
  --contract <CONTRACT_HASH> \
  --key <PATH_TO_SECRET_KEY.pem> \
  --output <OUTPUT_SECRETS_FILE.json> \
  --session ../contracts/wasm/deposit_session.wasm
```

**Options:**
| Option | Description | Required |
|--------|-------------|----------|
| `-n, --node <url>` | Casper node URL | Yes |
| `-c, --contract <hash>` | Contract package hash | Yes |
| `-k, --key <path>` | Path to sender secret key (PEM) | Yes |
| `-o, --output <path>` | Output file for secrets | Yes |
| `-S, --session <path>` | Path to session WASM for real CSPR transfer | **Required for real transfers** |

> **Important**: The `--session` flag is required to actually transfer CSPR. Without it, only the commitment is registered but no funds are transferred.

### Withdraw

Withdraw 100 CSPR from the mixer using your secret key.

```bash
npm start -- withdraw \
  --node https://node.testnet.casper.network \
  --contract <CONTRACT_HASH> \
  --key <PATH_TO_PAYER_KEY.pem> \
  --secrets <PATH_TO_SECRETS.json> \
  --recipient <RECIPIENT_PUBLIC_KEY_HEX> \
  --wasm ../circuits/withdraw_js/withdraw.wasm \
  --zkey ../circuits/withdraw_final.zkey
```

**Options:**
| Option | Description | Required |
|--------|-------------|----------|
| `-n, --node <url>` | Casper node URL | Yes |
| `-c, --contract <hash>` | Contract package hash | Yes |
| `-k, --key <path>` | Path to payer secret key (for gas fees) | Yes |
| `-s, --secrets <path>` | Path to secrets file from deposit | Yes |
| `-r, --recipient <key>` | Recipient public key (hex) | Yes |
| `-w, --wasm <path>` | Path to circuit WASM | Yes |
| `-z, --zkey <path>` | Path to proving key | Yes |

## Example Flow

```bash
# 1. Deposit (funds are transferred to contract)
npm start -- deposit \
  --node https://node.testnet.casper.network \
  --contract 35786c3636ef9c60c82dada99c94aa81a6c49ffaceaed2e6f157189dff161733 \
  --key ~/keys/my_wallet.pem \
  --output ./my_secret.json \
  --session ../contracts/wasm/deposit_session.wasm

# 2. Wait (for anonymity set to grow)

# 3. Withdraw (funds are transferred to recipient)
npm start -- withdraw \
  --node https://node.testnet.casper.network \
  --contract 35786c3636ef9c60c82dada99c94aa81a6c49ffaceaed2e6f157189dff161733 \
  --key ~/keys/my_wallet.pem \
  --secrets ./my_secret.json \
  --recipient 0203df00D558636BFCE196B83c8a518f483492eb0F07a2478d60f07d6c6A820183F5 \
  --wasm ../circuits/withdraw_js/withdraw.wasm \
  --zkey ../circuits/withdraw_final.zkey
```

## Secrets File Format

The secrets file generated during deposit contains:

```json
{
  "nullifier": "bigint as string",
  "secret": "bigint as string", 
  "commitment": "bigint as string",
  "leafIndex": 0,
  "timestamp": "ISO date string"
}
```

> ⚠️ **IMPORTANT**: Keep your secrets file safe! Anyone with this file can withdraw your funds.
