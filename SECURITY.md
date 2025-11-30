# Security Policy

## Supported Versions

The following versions of the Shroud Protocol are currently being supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Shroud Protocol seriously. If you discover a security vulnerability, please follow these steps:

1.  **Do NOT open a public issue.**
2.  Email the details of the vulnerability to `security@shroudprotocol.io` (or the maintainer's email).
3.  Include a detailed description of the vulnerability, steps to reproduce, and any potential impact.
4.  We will acknowledge your report within 48 hours and provide an estimated timeline for a fix.

## Critical Areas

Please pay special attention to the following components when auditing:

-   **ZK Circuits (`circuits/`)**: Ensure constraints are sufficient to prevent double-spending and invalid withdrawals.
-   **Smart Contracts (`contracts/`)**: Verify that the Merkle Tree logic and nullifier checks are robust.
-   **Cryptographic Primitives**: We use standard implementations (MiMC7, Groth16), but integration bugs are possible.

## Bounty Program

We currently do not have an official bug bounty program, but we appreciate responsible disclosure and will acknowledge your contribution in our security hall of fame.
