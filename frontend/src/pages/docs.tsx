import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Shield, Wallet, Menu, X, Book, Code, Layers, Terminal, Cpu, FileText } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';

import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';

export default function Docs() {
    return (
        <div className="min-h-screen font-sans text-white selection:bg-brand-500/30 selection:text-brand-200 flex flex-col overflow-x-hidden">
            <Head>
                <title>Documentation | Shroud Protocol</title>
                <meta name="description" content="Technical documentation for Shroud Protocol" />
            </Head>

            <Navbar />

            <main className="flex-grow pt-32 pb-20 relative">
                {/* Background Glows */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-[128px] pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-500/5 rounded-full blur-[128px] pointer-events-none" />

                <div className="container mx-auto px-6 relative z-10">
                    <div className="max-w-4xl mx-auto">
                        <div className="mb-12 text-center">
                            <h1 className="text-4xl md:text-5xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                Documentation
                            </h1>
                            <p className="text-xl text-gray-400">
                                Everything you need to understand and build with Shroud Protocol.
                            </p>
                        </div>

                        <div className="grid gap-12">
                            {/* Introduction */}
                            <section className="glass-panel p-8 rounded-3xl border border-white/10">
                                <div className="flex items-center space-x-4 mb-6">
                                    <div className="p-3 bg-brand-500/10 rounded-xl text-brand-400">
                                        <Book className="w-6 h-6" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white">Introduction</h2>
                                </div>
                                <div className="prose prose-invert max-w-none text-gray-300">
                                    <p>
                                        Shroud Protocol is a privacy-preserving mixer built on the Casper Network. It allows users to deposit CSPR into a smart contract and withdraw it later to a different address, effectively breaking the on-chain link between the depositor and the recipient.
                                    </p>
                                    <p className="mt-4">
                                        This is achieved using <strong>Zero-Knowledge Proofs (ZK-SNARKs)</strong> powered by Groth16 and MiMC hashing, ensuring that the protocol is secure, non-custodial, and trustless.
                                    </p>
                                </div>
                            </section>

                            {/* How It Works */}
                            <section className="glass-panel p-8 rounded-3xl border border-white/10">
                                <div className="flex items-center space-x-4 mb-6">
                                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white">Usage Guide</h2>
                                </div>
                                <div className="prose prose-invert max-w-none text-gray-300 space-y-12">
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-4">1. Deposit (The "Locking" Phase)</h3>
                                        <div className="mb-6 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                                            <img src="/docs/deposit.png" alt="Deposit Interface" className="w-full" />
                                        </div>
                                        <p>
                                            When you deposit CSPR, the protocol generates a digital "secret note" for you.
                                        </p>
                                        <ul className="list-disc pl-5 space-y-2 mt-4">
                                            <li><strong>Secret Generation:</strong> Your browser generates two random numbers: a <code>secret</code> and a <code>nullifier</code>.</li>
                                            <li><strong>Commitment:</strong> These two numbers are hashed together to create a <strong>Commitment</strong>. Think of this as a sealed envelope containing your secret.</li>
                                            <li><strong>On-Chain Transaction:</strong> You send the Commitment and funds to the smart contract. The contract adds your commitment to a Merkle Tree but never sees your secret.</li>
                                            <li><strong>Persistence:</strong> Your commitment is stored on the Casper blockchain and can be recovered by the protocol even if you clear your browser cache.</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-4">2. Withdraw (The "Unlocking" Phase)</h3>
                                        <div className="mb-6 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                                            <img src="/docs/withdraw.png" alt="Withdraw Interface" className="w-full" />
                                        </div>
                                        <p>
                                            When you want to withdraw, you use your Secret Key to prove you own one of the deposits without revealing which one.
                                        </p>
                                        <ul className="list-disc pl-5 space-y-2 mt-4">
                                            <li><strong>Automatic On-Chain Sync:</strong> The protocol automatically fetches all historical commitments from the Casper Explorer API to rebuild the Merkle Tree.</li>
                                            <li><strong>Recipient Derivation:</strong> You enter a Casper Public Key. The protocol derives the <code>AccountHash</code> to ensure consistency between the ZK proof and the contract transaction.</li>
                                            <li><strong>ZK-SNARK Proof:</strong> Your browser generates a proof that you know a secret/nullifier pair for a valid commitment in the tree, without revealing your identity.</li>
                                            <li><strong>Break the Link:</strong> The smart contract verifies the proof and sends the funds to the new address, effectively breaking the on-chain link.</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            {/* Architecture */}
                            <section className="glass-panel p-8 rounded-3xl border border-white/10">
                                <div className="flex items-center space-x-4 mb-6">
                                    <div className="p-3 bg-accent-500/10 rounded-xl text-accent-400">
                                        <Layers className="w-6 h-6" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white">Architecture</h2>
                                </div>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                                            <h3 className="text-lg font-bold text-white mb-2 flex items-center">
                                                <Code className="w-4 h-4 mr-2 text-brand-400" /> Smart Contracts
                                            </h3>
                                            <p className="text-sm text-gray-400">
                                                Written in Rust using the Odra framework. Handles deposits, manages the Merkle Tree state, and verifies ZK proofs to authorize withdrawals.
                                            </p>
                                        </div>
                                        <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                                            <h3 className="text-lg font-bold text-white mb-2 flex items-center">
                                                <Cpu className="w-4 h-4 mr-2 text-brand-400" /> ZK Circuits
                                            </h3>
                                            <p className="text-sm text-gray-400">
                                                Written in Circom. Defines the constraints for the ZK proof, ensuring that the user knows the secret corresponding to a valid leaf in the Merkle Tree.
                                            </p>
                                        </div>
                                        <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                                            <h3 className="text-lg font-bold text-white mb-2 flex items-center">
                                                <Terminal className="w-4 h-4 mr-2 text-brand-400" /> Frontend & CLI
                                            </h3>
                                            <p className="text-sm text-gray-400">
                                                Interfaces for users to interact with the protocol. The frontend performs client-side proof generation using <code>snarkjs</code>.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Developer Guide */}
                            <section className="glass-panel p-8 rounded-3xl border border-white/10">
                                <div className="flex items-center space-x-4 mb-6">
                                    <div className="p-3 bg-green-500/10 rounded-xl text-green-400">
                                        <Terminal className="w-6 h-6" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white">Developer Guide</h2>
                                </div>
                                <div className="prose prose-invert max-w-none text-gray-300 space-y-4">
                                    <h3 className="text-xl font-bold text-white">Prerequisites</h3>
                                    <ul className="list-disc pl-5 space-y-2">
                                        <li>Node.js v18+</li>
                                        <li>Rust v1.70+ (for contracts)</li>
                                        <li>Casper Wallet Extension</li>
                                        <li>Casper Wallet Extension</li>
                                    </ul>

                                    <h3 className="text-xl font-bold text-white mt-6">Protocol Error Codes</h3>
                                    <div className="bg-black/30 p-4 rounded-xl border border-white/5 space-y-3">
                                        <div className="grid grid-cols-12 gap-2 text-sm">
                                            <div className="col-span-1 font-mono text-red-400">1</div>
                                            <div className="col-span-11"><span className="font-bold">InvalidAmount</span>: Deposit amount mismatch.</div>

                                            <div className="col-span-1 font-mono text-red-400">2</div>
                                            <div className="col-span-11"><span className="font-bold">DuplicateCommitment</span>: This deposit has already been processed.</div>

                                            <div className="col-span-1 font-mono text-red-400">3</div>
                                            <div className="col-span-11"><span className="font-bold">AlreadySpent</span>: This secret has already been withdrawn (Double Spend prevented).</div>

                                            <div className="col-span-1 font-mono text-red-400">4</div>
                                            <div className="col-span-11"><span className="font-bold">UnknownRoot</span>: The Merkle Root in your proof is not in the contract's history. <br /><span className="text-gray-500 italic">Fix: Clear browser cache and refresh to sync the latest tree.</span></div>

                                            <div className="col-span-1 font-mono text-red-400">5</div>
                                            <div className="col-span-11"><span className="font-bold">InvalidProof</span>: The ZK-SNARK verification failed.</div>
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-white mt-6">Installation</h3>
                                    <div className="bg-black/30 p-4 rounded-xl font-mono text-sm text-gray-300 border border-white/5">
                                        <p>git clone https://github.com/yourusername/shroud-protocol.git</p>
                                        <p>cd shroud-protocol</p>
                                        <p>./scripts/install_dependencies.sh</p>
                                    </div>

                                    <h3 className="text-xl font-bold text-white mt-6">Running Locally</h3>
                                    <div className="bg-black/30 p-4 rounded-xl font-mono text-sm text-gray-300 border border-white/5">
                                        <p>cd frontend</p>
                                        <p>npm install</p>
                                        <p>npm run dev</p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
