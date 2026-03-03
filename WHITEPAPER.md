# Shroud Protocol Whitepaper

**A Non-Custodial, Zero-Knowledge Privacy Protocol for the Casper Network**

---

## 1. Executive Summary

Privacy is not a luxury; it is a fundamental requirement for a mature financial ecosystem. While public blockchains like the Casper Network offer unparalleled transparency, security, and decentralization, their completely public nature exposes all user transaction histories, balances, and interactions to the world. For enterprises, this means exposing cash flows and supplier relationships to competitors. For individuals, it means personal security risks and a lack of financial autonomy. For Decentralized Finance (DeFi) users, it means vulnerability to front-running and Miner Extractable Value (MEV) attacks.

**Shroud Protocol** solves this critical infrastructure gap. As the first non-custodial privacy mixer built specifically for the Casper Network, Shroud severs the on-chain link between sender and receiver addresses. By leveraging cutting-edge Zero-Knowledge Proofs (ZK-SNARKs), users can deposit CSPR into a common pool and later withdraw it to a completely new, unlinked address. The protocol mathematically guarantees that the connection between the deposit and withdrawal cannot be traced, ensuring total financial privacy without compromising the security or decentralization of the Casper blockchain.

This whitepaper outlines the problem of public ledgers, the Shroud Protocol solution, its technical architecture, core workflows, and our roadmap for bringing robust privacy to the Casper ecosystem.

---

## 2. The Problem: The Transparency Paradox

The Casper Network is an enterprise-grade blockchain designed for scalability and security. However, its transparent ledger creates severe challenges:

1.  **Competitive Intelligence Leakage**: Enterprises cannot adopt a ledger where their treasury management, payroll, and supplier payments are fully visible. Such transparency gives competitors an unacceptable advantage.
2.  **Front-Running and MEV**: In DeFi, transaction privacy is a security requirement. Sophisticated actors monitor the public mempool to identify profitable trades, inserting their own transactions ahead of users (front-running).
3.  **Personal Security**: Individuals accumulating significant cryptocurrency holdings become targets for theft and extortion when their net worth is a matter of public record.
4.  **Lack of Financial Autonomy**: Having your entire financial history exposed to employers, merchants, and the general public contradicts the cypherpunk ethos of self-sovereign wealth.

Currently, Casper users seeking privacy are forced to rely on centralized exchanges (introducing custody risks), cumbersome multi-wallet manual mixing (which provides weak privacy bounds against chain-analysis), or cross-chain bridges (which are expensive and risky).

---

## 3. The Solution: Shroud Protocol

Shroud Protocol acts as a "digital locker" for your CSPR tokens. 

The protocol utilizes **Zero-Knowledge Succinct Non-Interactive Arguments of Knowledge (zk-SNARKs)** to prove ownership of funds without revealing *which* funds are owned. By pooling deposits of fixed denominations (e.g., 100 CSPR), Shroud Protocol creates a robust anonymity set. When a user withdraws their 100 CSPR, observers can see that a withdrawal occurred, but it is mathematically impossible to determine which of the pooled deposits it corresponds to.

### Key Guarantees:
*   **Non-Custodial**: The protocol is governed purely by smart contracts. No admin or centralized entity can access or freeze user funds.
*   **Trustless Privacy**: Secret keys never leave the user's browser. Proofs are generated locally on the client side.
*   **Censorship Resistant**: The protocol operates natively on Casper's Layer-1, without reliance on centralized middleware or off-chain data indexing services.

---

## 4. Technical Architecture

Shroud is engineered for uncompromising safety and performance, built natively for the Casper VM using the Rust Odra framework.

### 4.1 On-Chain: The "Vault" (Smart Contracts)
*   **Rust & Odra Framework**: The protocol's smart contracts are written in Rust, leveraging the Odra framework to securely interface with Casper's highly optimized WebAssembly (WASM) execution environment. This drastically reduces boilerplate and mitigates memory safety bugs.
*   **Merkle Tree Storage**: Deposits are tracked via an incremental Merkle Tree stored on-chain.
*   **On-Chain Verifier**: We utilize the battle-tested `arkworks` ecosystem (`ark-groth16`, `ark-bn254`) to mathematically verify ZK-SNARKs on-chain efficiently.

### 4.2 Off-Chain: The "Privacy Console" (Frontend)
*   **Next.js & React**: A premium, highly responsive user interface designed with Tailwind CSS and Framer Motion to provide a seamless "Cosmic" aesthetic.
*   **Casper JS SDK v5**: Native integration with the Casper Wallet extension for transaction signing.
*   **Web Workers & WebAssembly**: Proof generation is computationally heavy and is offloaded to background Web Workers running WASM, ensuring the UI remains perfectly fluid at 60fps.

### 4.3 Zero-Knowledge: The "Engine"
*   **Circom 2.0**: The industry-standard DSL is used to write our arithmetic circuits.
*   **Groth16 Proof System**: Selected for its constant-size proofs (merely 3 group elements) and cheap on-chain verification costs, regardless of the anonymity set size.
*   **MiMC7 Hashing**: We specifically replaced standard SHA-256 with MiMC7—a SNARK-friendly symmetric encryption function. This reduces circuit constraints from ~25,000 to ~1,000, resulting in **20x faster client-side proof generation**, making the protocol accessible even on modern mobile devices.

---

## 5. Protocol Mechanics

The protocol workflow is split into two distinct phases: **Deposit** and **Withdrawal**.

### 5.1 The Deposit Flow
The goal of the deposit is to insert funds into the mixer pool while generating a cryptographically secure "receipt" that only the user knows.

1.  **Local Generation**: The user's browser securely generates a cryptographically random `secret` and a `nullifier`. 
2.  **Commitment Calculation**: The frontend uses the MiMC7 algorithm to compute a `commitment` hash: `Commitment = Hash(secret, nullifier)`.
3.  **Transaction**: The user submits the `commitment` alongside a fixed denomination of 100 CSPR to the Shroud Smart Contract.
4.  **Tree Insertion**: The contract appends this `commitment` as a new leaf in its on-chain incremental Merkle Tree.
5.  **Storage**: The `secret` and `nullifier` are saved locally by the user (or downloaded as a backup). **They never leave the browser.**

### 5.2 The Withdrawal Flow
To withdraw, the user must prove they own a commitment currently resting in the Merkle Tree, *without revealing which commitment it is.*

1.  **Preparation**: The user provides their `secret`, `nullifier`, and a fresh, completely unconnected `recipient_address`.
2.  **Light-Client Sync**: The frontend synchronizes the Merkle Tree by fetching on-chain events directly from Casper RPC nodes, reconstructing the tree state locally without relying on centralized indexing servers.
3.  **Local ZK-Proof Generation**: The frontend calculates a Groth16 ZK-SNARK. Mathematically, it proves: *"I know a secret and nullifier that combine into a commitment that exists within the current Merkle Root."*
4.  **Nullifier Hash**: The frontend also calculates the `nullifier_hash = Hash(nullifier)`.
5.  **Submission**: The user sends the ZK-Proof, the `nullifier_hash`, and the `recipient_address` to the Contract.
6.  **Verification**: 
    *   The Contract checks the `nullifier_hash` against a registry of spent nullifiers to prevent double-spending.
    *   The Contract mathematically verifies the ZK-Proof against the current Merkle Root.
7.  **Execution**: If valid, the contract marks the `nullifier_hash` as spent and releases the 100 CSPR to the fresh `recipient_address`. Total privacy is achieved.

---

## 6. Critical Design Innovations

To achieve a production-ready user experience, Shroud Protocol implements several key optimizations:

1.  **Client-Side Proving**: By running proof generation via WASM inside the user's browser, the server never sees the private `secret`. Trust is completely decentralized.
2.  **On-Chain First Synchronization**: We bypass the need for a centralized "Graph" database. Shroud rebuilds the Merkle tree via a lightweight, incrementally cached syncing mechanism directly from the blockchain's canonical block height history. This ensures maximum censorship resistance.
3.  **Concurrency & Stateless Deposits**: We removed local `localStorage` leaf tracking, which historically caused race conditions under high concurrent usage. Withdrawals now dynamically resolve their leaf index via state-scanning.
4.  **Transaction Spending Locks**: Background polling tasks are fully paused (`SpendingLock`) during active user Wallet interactions to prevent Casper Wallet interrupt collisions.

---

## 7. Roadmap & Future Vision

 shroud protocol establishes a privacy primitive on Casper, but our vision extends further:

### Phase 1: Security & Mainnet Optimization (Q1)
*   Comprehensive external security audits of Rust contracts and Circom circuits.
*   Execution of a multi-party Trusted Setup ceremony for the Groth16 circuits.
*   Mainnet deployment of the optimized and audited single-pool privacy mixer.

### Phase 2: Relayer Network Implementation (Q2)
*   **The Gas Problem**: Currently, withdrawing requires the new destination wallet to have a tiny amount of CSPR to pay for gas, which creates an annoying UX hurdle and a potential privacy leak if funded from a known exchange.
*   **The Solution**: Shroud will introduce a decentralized Relayer Network. Relayers will pay the gas fee to submit the user's withdrawal transaction in exchange for a tiny percentage of the withdrawn amount. The user can withdraw to a completely empty address.

### Phase 3: Compliance & Privacy Pools (Q3+)
*   Privacy tools must survive regulatory scrutiny. We plan to integrate "Proof of Innocence" mechanics (inspired by Privacy Pools). 
*   Users will be able to generate secondary ZK-proofs demonstrating their deposit did *not* originate from a known blacklist (e.g., OFAC sanctioned addresses or known hacker wallets), proving they are good actors without doxxing their actual identity.

---

## 8. Conclusion

The Casper Network was built for adoption at scale. By introducing Shroud Protocol, Casper gains a critical infrastructure layer that makes it viable for enterprises requiring trade secrecy, DeFi users requiring protection from MEV, and individuals demanding financial sovereignty. 

Welcome to the privacy layer of the Casper Network.
