# Shroud Protocol Usage Guide

This guide provides detailed scenarios and examples for using the Shroud Protocol.

## 🌟 Scenario 1: The Basic Privacy Flow (Alice & Bob)

**Goal**: Alice wants to send 100 CSPR to Bob without anyone knowing she is the sender.

1.  **Alice Deposits**:
    -   Alice connects her wallet (Address A) to the Shroud Frontend.
    -   She navigates to the **Deposit** tab.
    -   She clicks "Deposit 100 CSPR".
    -   **Crucial Step**: The app generates a **Secret Key**. Alice saves this securely (e.g., in a password manager).
    -   The transaction is confirmed on-chain. Everyone sees that Address A deposited 100 CSPR, but they don't know who it's for.

2.  **The Wait**:
    -   Alice waits for a few other users to deposit. This increases the "anonymity set". If she withdraws immediately, it's easier to guess the link.

3.  **Alice Withdraws (to Bob)**:
    -   Alice sends the **Secret Key** to Bob (off-chain, via a secure channel like Signal).
    -   **OR** Alice acts as the relayer herself.
    -   Let's assume Alice wants to withdraw to Bob's address (Address B).
    -   Alice (or Bob) opens the **Withdraw** tab.
    -   She enters the **Secret Key**.
    -   She enters **Bob's Address (Address B)** as the recipient.
    -   She clicks "Withdraw".
    -   The app generates a ZK Proof that says "I know a secret for *one* of the deposits, but I won't tell you which one."
    -   The contract verifies the proof and sends 100 CSPR to Address B.

**Result**: The blockchain shows Address A deposited, and Address B received funds. There is no on-chain link between A and B.

## 🛡️ Scenario 2: Recovering from a Lost Connection

**Goal**: You made a deposit, but your browser crashed before you could save the secret.

**Status**: ⚠️ **CRITICAL RISK**
-   If you did not save the secret *before* the transaction was signed, the funds are **LOST FOREVER**.
-   The secret is generated client-side and never leaves your browser. The contract only stores the "commitment" (a hash of the secret).
-   **Best Practice**: The UI forces you to copy the secret before enabling the "Deposit" button (in a production app). Always double-check you have it saved.

## 🔧 Scenario 3: CLI Automation for Power Users

**Goal**: You want to programmatically deposit funds every week.

1.  **Setup**:
    -   Ensure you have the CLI installed and built.
    -   Create a script `weekly_deposit.sh`:

    ```bash
    #!/bin/bash
    DATE=$(date +%F)
    SECRET_FILE="./secrets/deposit_$DATE.json"
    
    npm start -- prefix -- deposit \
      --node http://127.0.0.1:11101 \
      --contract <CONTRACT_HASH> \
      --key ./my_wallet_key.pem \
      --output $SECRET_FILE
      
    echo "Deposited! Secret saved to $SECRET_FILE"
    ```

2.  **Run**:
    -   Set up a cron job to run this script.

## ❌ Scenario 4: Double Spending Attempt

**Goal**: A malicious user tries to withdraw the same deposit twice.

1.  **First Withdrawal**:
    -   The user withdraws successfully using their Secret Key.
    -   The contract records the `nullifier_hash` (derived from the secret) as "spent".

2.  **Second Withdrawal**:
    -   The user tries to use the same Secret Key again.
    -   They generate a valid ZK Proof (the math still works).
    -   They submit the transaction.
    -   **Contract Check**: The contract checks if `nullifier_hash` exists in the `nullifiers` mapping.
    -   **Result**: The transaction REVERTS with error `DoubleSpend`.

## 🔒 Privacy Best Practices

1.  **Fresh Addresses**: Always withdraw to a completely new address that has no history with your deposit address.
2.  **Time Delays**: Wait for multiple other deposits to occur between your deposit and withdrawal.
3.  **Standard Amounts**: The protocol uses fixed amounts (100 CSPR) to prevent amount-based correlation (e.g., depositing 123.45 and withdrawing 123.45 is obvious).
