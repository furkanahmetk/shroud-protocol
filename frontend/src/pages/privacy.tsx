import React from 'react';
import Head from 'next/head';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Shield, Lock, Eye, FileText } from 'lucide-react';

export default function Privacy() {
    return (
        <div className="min-h-screen font-sans text-white selection:bg-brand-500/30 selection:text-brand-200 flex flex-col overflow-x-hidden">
            <Head>
                <title>Privacy Policy | Shroud Protocol</title>
                <meta name="description" content="Privacy Policy for Shroud Protocol" />
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
                                Privacy Policy
                            </h1>
                            <p className="text-xl text-gray-400">
                                How we protect your data and privacy.
                            </p>
                        </div>

                        <div className="glass-panel p-8 md:p-12 rounded-3xl border border-white/10 prose prose-invert max-w-none">
                            <div className="flex items-center space-x-4 mb-8">
                                <div className="p-3 bg-brand-500/10 rounded-xl text-brand-400">
                                    <Shield className="w-8 h-8" />
                                </div>
                                <h2 className="text-2xl font-bold text-white m-0">Commitment to Privacy</h2>
                            </div>

                            <p>
                                At Shroud Protocol, privacy is not just a feature; it is our core mission. We are dedicated to building decentralized infrastructure that preserves the anonymity of its users. This Privacy Policy outlines how Shroud Protocol ("we", "our", or "us") handles information when you use our interface and smart contracts.
                            </p>

                            <h3>1. No Data Collection</h3>
                            <p>
                                Shroud Protocol is a non-custodial, decentralized application. We do not collect, store, or process any personal information (PII) such as:
                            </p>
                            <ul>
                                <li>Names</li>
                                <li>Email addresses</li>
                                <li>IP addresses (we do not use tracking cookies or analytics that log IP addresses)</li>
                                <li>Wallet private keys</li>
                            </ul>

                            <h3>2. On-Chain Data</h3>
                            <p>
                                When you interact with Shroud Protocol, you are interacting directly with the Casper Network blockchain. Please be aware that:
                            </p>
                            <ul>
                                <li><strong>Public Ledger:</strong> All transactions on the Casper Network are public. While Shroud Protocol breaks the link between deposit and withdrawal addresses, the initial deposit and final withdrawal transactions are visible on the blockchain.</li>
                                <li><strong>Smart Contract Interactions:</strong> Your wallet address and transaction data associated with deposits and withdrawals are recorded on the blockchain.</li>
                            </ul>

                            <h3>3. Local Storage</h3>
                            <p>
                                We may use local storage on your device solely to improve your user experience, such as remembering your theme preference or temporary session state. This data never leaves your device.
                            </p>

                            <h3>4. Third-Party Services</h3>
                            <p>
                                <strong>Casper Wallet:</strong> To use our application, you must use a third-party wallet provider (e.g., Casper Wallet). Your interactions with these wallets are governed by their respective privacy policies. We do not have access to your private keys or funds.
                            </p>
                            <p>
                                <strong>RPC Nodes:</strong> Our frontend connects to public RPC nodes to communicate with the Casper Network. These nodes may log your IP address and request data.
                            </p>

                            <h3>5. Changes to This Policy</h3>
                            <p>
                                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. You are advised to review this Privacy Policy periodically for any changes.
                            </p>

                            <div className="mt-12 pt-8 border-t border-white/10 text-sm text-gray-500">
                                Last updated: December 1, 2025
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
