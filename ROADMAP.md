# Shroud Protocol: Development Roadmap

This document outlines the strategic phases and technical milestones for bringing Shroud Protocol from its current proof-of-concept phase to a fully audited, production-ready release on the Casper Mainnet.

**Operational playbooks** (drafted Phase 1, executed in Phase 2-3):
- [`docs/BETA_LAUNCH.md`](docs/BETA_LAUNCH.md) — public testnet beta checklist
- [`docs/BUG_BOUNTY.md`](docs/BUG_BOUNTY.md) — mini bounty program scope & payouts
- [`docs/AUDIT_RFP.md`](docs/AUDIT_RFP.md) — auditor shortlist + outreach RFP
- [`docs/MPC_CEREMONY.md`](docs/MPC_CEREMONY.md) — MPC trusted setup plan

---

## Phase 1: Core Protocol Enhancements & Integrations (Q1/Q2)

The immediate focus is to refine the protocol's economic model and streamline the user experience by deeply integrating with the modern Casper ecosystem toolkit.

*   **Commission Fee Integration**: 
    *   Design and implement a fee-sharing mechanism within the smart contracts.
    *   Allow the protocol to sustainably collect a small percentage of transactions or fixed fees per pool to fund ongoing development and relayer networks.
*   **Transaction Amount Adjustment**: 
    *   Evaluate and finalize the single fixed-denomination amount (currently 100 CSPR) to best serve user needs while strictly maintaining a single, unified pool to maximize the anonymity set.
*   **Infrastructure Modernization (cspr.cloud & cspr.click)**: 
    *   Deprecate the custom backend proxy and legacy wallet integration scripts.
    *   Integrate **cspr.cloud** for reliable, scalable on-chain data indexing and Merkle tree synchronization.
    *   Integrate **cspr.click** to provide a seamless, unified wallet connection experience across all supported Casper wallets.
*   **Batch Transfer Functionality**: 
    *   Implement capabilities for users to execute batch transfers, optimizing gas costs and improving the UX for users managing multiple commitments simultaneously.

---

## Phase 2: Community Testing & Hardening (Q2/Q3)

Before Mainnet deployment, the protocol must be rigorously tested by the community in a live, adversarial environment.

*   **Public Testnet Open Beta**: 
    *   Deploy the enhanced smart contracts and modern frontend (featuring cspr.cloud/click) to the Casper Testnet.
    *   Open access to the broader community for organic stress-testing of the deposit and withdrawal flows.
*   **Mini Bug Bounty Program**: 
    *   Launch an incentivized testing program rewarding developers and security researchers for identifying vulnerabilities, edge cases, or UX flaws.
*   **Iterative Issue Resolution**: 
    *   Systematic triage and patching of all bugs, performance bottlenecks, and UI/UX issues reported during the Open Beta and Bug Bounty. 
    *   Finalize the codebase architecture seal based on community feedback.

---

## Phase 3: Security, Audit, and Mainnet Launch (Q3/Q4)

The final phase ensures the mathematical and infrastructural security of Shroud Protocol before handling real user funds on Mainnet.

*   **Comprehensive Security Audit**: 
    *   Engage with top-tier smart contract and cryptography auditing firms.
    *   Conduct a deep-dive review of the Rust Odra contracts, Circom ZK-circuits, and frontend proof-generation mechanics.
*   **Audit Remediation**: 
    *   Apply all necessary fixes, architecture adjustments, and optimizations mandated by the security audit reports.
    *   Publish the final audit report for total transparency.
*   **Trusted Setup Ceremony (Optional but Recommended)**:
    *   Execute a multi-party computation (MPC) Trusted Setup for the Groth16 circuits to ensure the zero-knowledge parameters cannot be compromised.
*   **Mainnet Launch**: 
    *   Deploy the finalized, audited, and hardened protocol to the Casper Mainnet.
    *   Begin the liquidity bootstrapping phase to build initial anonymity sets.
