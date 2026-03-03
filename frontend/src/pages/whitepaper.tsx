import React from 'react';
import Head from 'next/head';
import { Book, Shield, Layers, Cpu, Lock, Network, Zap } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function Whitepaper() {
    return (
        <div className="min-h-screen font-sans text-white selection:bg-brand-500/30 selection:text-brand-200 flex flex-col overflow-x-hidden">
            <Head>
                <title>Whitepaper | Shroud Protocol</title>
                <meta name="description" content="Shroud Protocol Whitepaper - A Non-Custodial, Zero-Knowledge Privacy Protocol for the Casper Network" />
            </Head>

            <Navbar />

            <main className="flex-grow pt-32 pb-20 relative">
                {/* Background Glows */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-[128px] pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-500/5 rounded-full blur-[128px] pointer-events-none" />

                <div className="container mx-auto px-6 relative z-10">
                    <div className="max-w-4xl mx-auto">
                        <div className="mb-12 text-center">
                            <div className="inline-flex items-center justify-center p-3 bg-brand-500/10 rounded-2xl mb-6 text-brand-400">
                                <Book className="w-8 h-8" />
                            </div>
                            <h1 className="text-4xl md:text-5xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                Shroud Protocol Whitepaper
                            </h1>
                            <p className="text-xl text-gray-400">
                                A Non-Custodial, Zero-Knowledge Privacy Protocol for the Casper Network
                            </p>
                        </div>

                        <div className="grid gap-12">
                            {/* 1. Executive Summary */}
                            <section className="glass-panel p-8 rounded-3xl border border-white/10">
                                <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                                    <span className="text-brand-400 font-mono mr-3">1.</span> Executive Summary
                                </h2>
                                <div className="prose prose-invert max-w-none text-gray-300 space-y-4">
                                    <p>
                                        Privacy is not a luxury; it is a fundamental requirement for a mature financial ecosystem. While public blockchains like the Casper Network offer unparalleled transparency, security, and decentralization, their completely public nature exposes all user transaction histories, balances, and interactions to the world. For enterprises, this means exposing cash flows and supplier relationships to competitors. For individuals, it means personal security risks and a lack of financial autonomy. For Decentralized Finance (DeFi) users, it means vulnerability to front-running and Miner Extractable Value (MEV) attacks.
                                    </p>
                                    <p>
                                        <strong>Shroud Protocol</strong> solves this critical infrastructure gap. As the first non-custodial privacy mixer built specifically for the Casper Network, Shroud severs the on-chain link between sender and receiver addresses. By leveraging cutting-edge Zero-Knowledge Proofs (ZK-SNARKs), users can deposit CSPR into a common pool and later withdraw it to a completely new, unlinked address. The protocol mathematically guarantees that the connection between the deposit and withdrawal cannot be traced, ensuring total financial privacy without compromising the security or decentralization of the Casper blockchain.
                                    </p>
                                    <p>
                                        This whitepaper outlines the problem of public ledgers, the Shroud Protocol solution, its technical architecture, core workflows, and our roadmap for bringing robust privacy to the Casper ecosystem.
                                    </p>
                                </div>
                            </section>

                            {/* 2. The Problem */}
                            <section className="glass-panel p-8 rounded-3xl border border-white/10 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                                <h2 className="text-2xl font-bold text-white mb-6 flex items-center relative z-10">
                                    <span className="text-brand-400 font-mono mr-3">2.</span> The Problem: The Transparency Paradox
                                </h2>
                                <div className="prose prose-invert max-w-none text-gray-300 relative z-10">
                                    <p className="mb-6">
                                        The Casper Network is an enterprise-grade blockchain designed for scalability and security. However, its transparent ledger creates severe challenges:
                                    </p>
                                    <ul className="space-y-4">
                                        <li className="flex items-start">
                                            <div className="mt-1 mr-3 text-red-400 shrink-0"><Lock className="w-5 h-5" /></div>
                                            <div><strong>Competitive Intelligence Leakage:</strong> Enterprises cannot adopt a ledger where their treasury management, payroll, and supplier payments are fully visible.</div>
                                        </li>
                                        <li className="flex items-start">
                                            <div className="mt-1 mr-3 text-red-400 shrink-0"><Zap className="w-5 h-5" /></div>
                                            <div><strong>Front-Running and MEV:</strong> In DeFi, transaction privacy is a security requirement. Sophisticated actors monitor the public mempool to identify profitable trades, inserting their own transactions ahead of users (front-running).</div>
                                        </li>
                                        <li className="flex items-start">
                                            <div className="mt-1 mr-3 text-red-400 shrink-0"><Shield className="w-5 h-5" /></div>
                                            <div><strong>Personal Security:</strong> Individuals accumulating significant cryptocurrency holdings become targets for theft and extortion when their net worth is a matter of public record.</div>
                                        </li>
                                        <li className="flex items-start">
                                            <div className="mt-1 mr-3 text-red-400 shrink-0"><Lock className="w-5 h-5" /></div>
                                            <div><strong>Lack of Financial Autonomy:</strong> Having your entire financial history exposed to employers, merchants, and the general public contradicts the cypherpunk ethos of self-sovereign wealth.</div>
                                        </li>
                                    </ul>
                                </div>
                            </section>

                            {/* 3. The Solution */}
                            <section className="glass-panel p-8 rounded-3xl border border-brand-500/20 relative overflow-hidden shadow-[0_0_40px_rgba(20,241,149,0.05)]">
                                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent pointer-events-none" />
                                <h2 className="text-2xl font-bold text-white mb-6 flex items-center relative z-10">
                                    <span className="text-brand-400 font-mono mr-3">3.</span> The Solution: Shroud Protocol
                                </h2>
                                <div className="prose prose-invert max-w-none text-gray-300 relative z-10 space-y-4">
                                    <p>
                                        Shroud Protocol acts as a "digital locker" for your CSPR tokens.
                                    </p>
                                    <p>
                                        The protocol utilizes <strong>Zero-Knowledge Succinct Non-Interactive Arguments of Knowledge (zk-SNARKs)</strong> to prove ownership of funds without revealing <em>which</em> funds are owned. By pooling deposits of fixed denominations (e.g., 100 CSPR), Shroud Protocol creates a robust anonymity set. When a user withdraws their 100 CSPR, observers can see that a withdrawal occurred, but it is mathematically impossible to determine which of the pooled deposits it corresponds to.
                                    </p>

                                    <div className="mt-8 bg-black/40 p-6 rounded-2xl border border-white/5">
                                        <h3 className="text-lg font-bold text-white mb-4">Key Guarantees:</h3>
                                        <ul className="space-y-3">
                                            <li className="flex items-center"><CheckMark /> <strong>Non-Custodial:</strong> The protocol is governed purely by smart contracts. No admin or centralized entity can access or freeze user funds.</li>
                                            <li className="flex items-center"><CheckMark /> <strong>Trustless Privacy:</strong> Secret keys never leave the user's browser. Proofs are generated locally on the client side.</li>
                                            <li className="flex items-center"><CheckMark /> <strong>Censorship Resistant:</strong> The protocol operates natively on Casper's Layer-1, without reliance on centralized middleware or off-chain data indexing services.</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            {/* 4. Technical Architecture */}
                            <section className="glass-panel p-8 rounded-3xl border border-white/10">
                                <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                                    <span className="text-brand-400 font-mono mr-3">4.</span> Technical Architecture
                                </h2>
                                <p className="text-gray-300 mb-8">
                                    Shroud is engineered for uncompromising safety and performance, built natively for the Casper VM using the Rust Odra framework.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                                        <div className="text-blue-400 mb-4"><Shield className="w-8 h-8" /></div>
                                        <h3 className="text-lg font-bold text-white mb-2">4.1 On-Chain: The Vault</h3>
                                        <ul className="text-sm text-gray-400 space-y-2 list-disc pl-4">
                                            <li><strong>Rust & Odra:</strong> Smart contracts written in Rust, leveraging Odra to securely interface with Casper WASM.</li>
                                            <li><strong>Merkle Tree:</strong> Deposits are tracked via an incremental Merkle Tree stored on-chain.</li>
                                            <li><strong>Verifier:</strong> Uses `arkworks` ecosystem for mathematically verifying ZK-SNARKs on-chain.</li>
                                        </ul>
                                    </div>

                                    <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                                        <div className="text-brand-400 mb-4"><Layers className="w-8 h-8" /></div>
                                        <h3 className="text-lg font-bold text-white mb-2">4.2 Off-Chain: Privacy Console</h3>
                                        <ul className="text-sm text-gray-400 space-y-2 list-disc pl-4">
                                            <li><strong>Next.js & React:</strong> Highly responsive UI designed with Tailwind CSS and Framer Motion.</li>
                                            <li><strong>Casper SDK v5:</strong> Native integration with the Casper Wallet extension.</li>
                                            <li><strong>Web Workers:</strong> Heavy proof generation is offloaded to background Web Workers (WASM).</li>
                                        </ul>
                                    </div>

                                    <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                                        <div className="text-accent-400 mb-4"><Cpu className="w-8 h-8" /></div>
                                        <h3 className="text-lg font-bold text-white mb-2">4.3 Zero-Knowledge: The Engine</h3>
                                        <ul className="text-sm text-gray-400 space-y-2 list-disc pl-4">
                                            <li><strong>Circom 2.0:</strong> Industry-standard DSL for arithmetic circuits.</li>
                                            <li><strong>Groth16:</strong> Constant-size proofs (3 group elements) and cheap verification.</li>
                                            <li><strong>MiMC7 Hashing:</strong> Replaces SHA-256 to reduce circuit constraints from ~25k to ~1k (20x faster proving).</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            {/* 5. Protocol Mechanics */}
                            <section className="glass-panel p-8 rounded-3xl border border-white/10">
                                <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                                    <span className="text-brand-400 font-mono mr-3">5.</span> Protocol Mechanics
                                </h2>

                                <div className="space-y-12">
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-4">5.1 The Deposit Flow</h3>
                                        <p className="text-gray-300 mb-4">
                                            The goal of the deposit is to insert funds into the mixer pool while generating a cryptographically secure "receipt" that only the user knows.
                                        </p>
                                        <ol className="list-decimal pl-5 space-y-3 text-gray-300">
                                            <li><strong>Local Generation:</strong> The user's browser securely generates a cryptographically random <code>secret</code> and a <code>nullifier</code>.</li>
                                            <li><strong>Commitment Calculation:</strong> The frontend uses MiMC7 to compute a <code>commitment = Hash(secret, nullifier)</code>.</li>
                                            <li><strong>Transaction:</strong> The user submits the <code>commitment</code> alongside a fixed denomination (100 CSPR) to the Contract.</li>
                                            <li><strong>Tree Insertion:</strong> The contract appends this <code>commitment</code> as a new leaf in its Merkle Tree.</li>
                                            <li><strong>Storage:</strong> The <code>secret</code> and <code>nullifier</code> are saved locally. <strong>They never leave the browser.</strong></li>
                                        </ol>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-4">5.2 The Withdrawal Flow</h3>
                                        <p className="text-gray-300 mb-4">
                                            To withdraw, the user must prove they own a commitment resting in the Merkle Tree, <em>without revealing which commitment it is.</em>
                                        </p>
                                        <ol className="list-decimal pl-5 space-y-3 text-gray-300">
                                            <li><strong>Preparation:</strong> The user provides their <code>secret</code>, <code>nullifier</code>, and a fresh <code>recipient_address</code>.</li>
                                            <li><strong>Light-Client Sync:</strong> The frontend synchronizes the Merkle Tree by fetching on-chain events directly from Casper RPC nodes.</li>
                                            <li><strong>Local ZK-Proof Generation:</strong> The frontend calculates a Groth16 ZK-SNARK proving knowledge of the secret associated with a valid root.</li>
                                            <li><strong>Nullifier Hash:</strong> The frontend calculates the <code>nullifier_hash = Hash(nullifier)</code>.</li>
                                            <li><strong>Submission:</strong> The user sends the ZK-Proof, <code>nullifier_hash</code>, and <code>recipient_address</code> to the Contract.</li>
                                            <li><strong>Verification:</strong> The Contract checks the <code>nullifier_hash</code> to prevent double-spending, and verifies the ZK-Proof.</li>
                                            <li><strong>Execution:</strong> If valid, the contract releases 100 CSPR to the fresh address. Total privacy is achieved.</li>
                                        </ol>
                                    </div>
                                </div>
                            </section>

                            {/* 6. design innovations */}
                            <section className="glass-panel p-8 rounded-3xl border border-white/10">
                                <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                                    <span className="text-brand-400 font-mono mr-3">6.</span> Critical Design Innovations
                                </h2>
                                <div className="space-y-4 text-gray-300">
                                    <p>To achieve a production-ready user experience, Shroud Protocol implements several key optimizations:</p>
                                    <ul className="list-disc pl-5 space-y-3">
                                        <li><strong>Client-Side Proving:</strong> By running proof generation via WASM inside the user's browser, the server never sees the private <code>secret</code>. Trust is decentralized.</li>
                                        <li><strong>On-Chain First Synchronization:</strong> We bypass the need for a centralized "Graph" database. Shroud rebuilds the Merkle tree via a lightweight, incrementally cached syncing mechanism directly from the blockchain's canonical block height history.</li>
                                        <li><strong>Concurrency & Stateless Deposits:</strong> We removed local <code>localStorage</code> leaf tracking, which historically caused race conditions under high concurrent usage. Withdrawals now dynamically resolve their leaf index via state-scanning.</li>
                                        <li><strong>Transaction Spending Locks:</strong> Background polling tasks are fully paused during active user interactions to prevent Casper Wallet interrupt collisions.</li>
                                    </ul>
                                </div>
                            </section>

                            {/* 7. Roadmap */}
                            <section className="glass-panel p-8 rounded-3xl border border-white/10">
                                <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                                    <span className="text-brand-400 font-mono mr-3">7.</span> Roadmap & Future Vision
                                </h2>
                                <p className="text-gray-300 mb-8">
                                    Shroud Protocol establishes a privacy primitive on Casper, but our vision extends further:
                                </p>

                                <div className="space-y-6">
                                    <div className="bg-black/30 p-6 rounded-2xl border border-white/5">
                                        <h3 className="text-lg font-bold text-white mb-2">Phase 1: Security & Mainnet Optimization (Q1)</h3>
                                        <ul className="text-sm text-gray-400 list-disc pl-5 space-y-1">
                                            <li>Comprehensive external security audits of Rust contracts and Circom circuits.</li>
                                            <li>Multi-party Trusted Setup ceremony for the Groth16 circuits.</li>
                                            <li>Mainnet deployment of the optimized and audited single-pool privacy mixer.</li>
                                        </ul>
                                    </div>

                                    <div className="bg-black/30 p-6 rounded-2xl border border-white/5">
                                        <h3 className="text-lg font-bold text-brand-400 mb-2">Phase 2: Relayer Network Implementation (Q2)</h3>
                                        <p className="text-sm text-gray-400 mb-2">
                                            Currently, withdrawing requires the new destination wallet to have a tiny amount of CSPR to pay for gas, which creates an annoying UX hurdle and a potential privacy leak.
                                        </p>
                                        <p className="text-sm text-gray-400">
                                            We will introduce a decentralized <strong>Relayer Network</strong>. Relayers will pay the gas fee to submit the user's withdrawal transaction in exchange for a tiny percentage of the withdrawn amount, allowing withdrawals to completely empty addresses.
                                        </p>
                                    </div>

                                    <div className="bg-black/30 p-6 rounded-2xl border border-white/5">
                                        <h3 className="text-lg font-bold text-white mb-2">Phase 3: Compliance & Privacy Pools (Q3+)</h3>
                                        <p className="text-sm text-gray-400 mb-2">
                                            Privacy tools must survive regulatory scrutiny. We plan to integrate "Proof of Innocence" mechanics (inspired by Privacy Pools).
                                        </p>
                                        <p className="text-sm text-gray-400">
                                            Users will be able to generate secondary ZK-proofs demonstrating their deposit did <em>not</em> originate from a known blacklist (e.g., OFAC sanctioned addresses), proving they are good actors without doxxing their actual identity.
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <section className="text-center py-8">
                                <h2 className="text-2xl font-bold text-white mb-4">Welcome to the Privacy Layer of the Casper Network</h2>
                                <p className="text-gray-400">
                                    Shroud Protocol makes Casper viable for enterprises requiring trade secrecy, DeFi users requiring protection from MEV, and individuals demanding financial sovereignty.
                                </p>
                            </section>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}

function CheckMark() {
    return (
        <svg className="w-5 h-5 text-brand-400 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
    )
}
