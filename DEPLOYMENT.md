# Deployment Guide

This guide details how to deploy the Shroud Protocol to the Casper Testnet and host the frontend.

## 1. Prerequisites

-   **Casper Client**: Installed (`casper-client --version` should return 2.0+).
-   **Casper Wallet**: A funded account on Casper Testnet.
    -   [Create Wallet](https://cspr.live/)
    -   [Faucet](https://testnet.cspr.live/tools/faucet)
-   **Node.js**: v18+ installed.

## 2. Deploying Smart Contracts

### Step 1: Prepare Keys
You need the secret key of your funded account.
1.  Download your secret key from the Casper Wallet/CSPR.live.
2.  Save it as `secret_key.pem` in the project root (DO NOT COMMIT THIS FILE).

### Step 2: Build
```bash
./scripts/build_all.sh
```

### Step 3: Deploy
Run the deployment script. You may need to edit it to point to your key.

```bash
# Edit scripts/deploy.sh to set SECRET_KEY_PATH="./secret_key.pem"
./scripts/deploy.sh
```

The script will output a **Deploy Hash**.
1.  Check the status on [Testnet CSPR.live](https://testnet.cspr.live/).
2.  Once confirmed, get the **Contract Hash**.

### Step 4: Update Frontend Config
Open `frontend/src/utils/casper.ts` and update the `CONTRACT_HASH`:

```typescript
export const CONTRACT_HASH = "hash-YOUR_NEW_CONTRACT_HASH...";
```

## 3. Deploying Frontend

### Option A: Vercel (Recommended)
1.  Install Vercel CLI: `npm i -g vercel`
2.  Run deploy:
    ```bash
    cd frontend
    vercel
    ```
3.  Follow the prompts. Vercel will auto-detect the Next.js app.

### Option B: Netlify
1.  Drag and drop the `frontend` folder to Netlify Drop.
2.  Or use the CLI: `netlify deploy`.

### Option C: Static Export (IPFS)
1.  Update `frontend/next.config.js`:
    ```javascript
    output: 'export',
    images: { unoptimized: true }
    ```
2.  Build:
    ```bash
    cd frontend
    npm run build
    ```
3.  Upload the `out/` directory to IPFS (e.g., via Pinata or Fleek).

## 4. Running the Whole Project Locally

To run the full stack on your machine:

1.  **Start the Frontend**:
    ```bash
    cd frontend
    npm run dev
    ```
2.  **Access**: Open `http://localhost:3000`.
3.  **Interact**: Ensure your Casper Wallet extension is connected to Testnet.
