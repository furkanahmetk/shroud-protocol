import React from 'react';
import Head from 'next/head';
import { Map, Rocket, ShieldCheck, Users, Zap, Coins, Box, GitMerge } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function Roadmap() {
    return (
        <div className="min-h-screen font-sans text-white selection:bg-brand-500/30 selection:text-brand-200 flex flex-col overflow-x-hidden">
            <Head>
                <title>Roadmap | Shroud Protocol</title>
                <meta name="description" content="Shroud Protocol Development Roadmap - The path to a fully audited, production-ready release on the Casper Mainnet." />
            </Head>

            <Navbar />

            <main className="flex-grow pt-32 pb-20 relative">
                {/* Background Glows */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-[128px] pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-brand-500/5 rounded-full blur-[128px] pointer-events-none" />

                <div className="container mx-auto px-6 relative z-10">
                    <div className="max-w-4xl mx-auto">
                        <div className="mb-16 text-center">
                            <div className="inline-flex items-center justify-center p-3 bg-accent-500/10 rounded-2xl mb-6 text-accent-400">
                                <Map className="w-8 h-8" />
                            </div>
                            <h1 className="text-4xl md:text-5xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                Development Roadmap
                            </h1>
                            <p className="text-xl text-gray-400">
                                Strategic phases and technical milestones for bringing Shroud Protocol to the Casper Mainnet.
                            </p>
                        </div>

                        <div className="relative border-l-2 border-white/10 md:pl-10 ml-4 md:ml-0 space-y-16">

                            {/* Phase 1 */}
                            <div className="relative group">
                                <div className="absolute -left-[2.8rem] md:-left-[3.5rem] bg-dark-bg p-2 rounded-full border-2 border-brand-400 text-brand-400 z-10">
                                    <Zap className="w-5 h-5" />
                                </div>
                                <div className="glass-panel p-8 rounded-3xl border border-brand-500/20 transition-all duration-300 hover:border-brand-500/40 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

                                    <div className="mb-2">
                                        <span className="text-brand-400 font-mono text-sm tracking-widest uppercase font-bold">Phase 1 (Q1/Q2)</span>
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-6">Core Protocol Enhancements & Integrations</h2>
                                    <p className="text-gray-400 mb-8">
                                        Refining the protocol's economic model and streamlining the user experience by deeply integrating with the modern Casper ecosystem toolkit.
                                    </p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-black/30 p-5 rounded-2xl border border-white/5">
                                            <div className="flex items-center mb-3">
                                                <Coins className="w-5 h-5 text-brand-400 mr-2" />
                                                <h3 className="text-lg font-bold text-white">Commission Fee Integration</h3>
                                            </div>
                                            <p className="text-sm text-gray-400">
                                                Implementing a fee-sharing mechanism within smart contracts to sustainably collect a small percentage of transactions or fixed fees to fund ongoing development and relayer networks.
                                            </p>
                                        </div>
                                        <div className="bg-black/30 p-5 rounded-2xl border border-white/5">
                                            <div className="flex items-center mb-3">
                                                <Box className="w-5 h-5 text-brand-400 mr-2" />
                                                <h3 className="text-lg font-bold text-white">Transaction Amount Adjustment</h3>
                                            </div>
                                            <p className="text-sm text-gray-400">
                                                Evaluating and finalizing the single fixed-denomination amount (currently 100 CSPR) to best serve user needs while strictly maintaining a unified pool to maximize the anonymity set.
                                            </p>
                                        </div>
                                        <div className="bg-black/30 p-5 rounded-2xl border border-white/5 md:col-span-2">
                                            <div className="flex items-center mb-3">
                                                <GitMerge className="w-5 h-5 text-brand-400 mr-2" />
                                                <h3 className="text-lg font-bold text-white">Infrastructure Modernization</h3>
                                            </div>
                                            <p className="text-sm text-gray-400">
                                                Deprecating custom backends. Integrating <strong>cspr.cloud</strong> for reliable, scalable on-chain data indexing and <strong>cspr.click</strong> to provide a seamless, unified wallet connection experience.
                                            </p>
                                        </div>
                                        <div className="bg-black/30 p-5 rounded-2xl border border-white/5 md:col-span-2">
                                            <div className="flex items-center mb-3">
                                                <Zap className="w-5 h-5 text-brand-400 mr-2" />
                                                <h3 className="text-lg font-bold text-white">Batch Transfer Functionality</h3>
                                            </div>
                                            <p className="text-sm text-gray-400">
                                                Implementing capabilities for users to execute batch transfers, optimizing gas costs and improving the UX for users managing multiple commitments simultaneously.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Phase 2 */}
                            <div className="relative group">
                                <div className="absolute -left-[2.8rem] md:-left-[3.5rem] bg-dark-bg p-2 rounded-full border-2 border-blue-400 text-blue-400 z-10">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div className="glass-panel p-8 rounded-3xl border border-blue-500/20 transition-all duration-300 hover:border-blue-500/40 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

                                    <div className="mb-2">
                                        <span className="text-blue-400 font-mono text-sm tracking-widest uppercase font-bold">Phase 2 (Q2/Q3)</span>
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-6">Community Testing & Hardening</h2>
                                    <p className="text-gray-400 mb-8">
                                        Rigorous testing by the community in a live, adversarial environment to ensure bulletproof logic.
                                    </p>

                                    <ul className="space-y-4 text-gray-300">
                                        <li className="flex items-start">
                                            <div className="mt-1 mr-3 text-blue-400 shrink-0"><CheckMark /></div>
                                            <div><strong>Public Testnet Open Beta:</strong> Deploying the enhanced contracts and modern frontend (cspr.cloud/click) to Testnet for organic stress-testing by the broader community.</div>
                                        </li>
                                        <li className="flex items-start">
                                            <div className="mt-1 mr-3 text-blue-400 shrink-0"><CheckMark /></div>
                                            <div><strong>Mini Bug Bounty Program:</strong> Launching an incentivized testing program rewarding developers and security researchers for identifying vulnerabilities, edge cases, or UX flaws.</div>
                                        </li>
                                        <li className="flex items-start">
                                            <div className="mt-1 mr-3 text-blue-400 shrink-0"><CheckMark /></div>
                                            <div><strong>Iterative Issue Resolution:</strong> Systematic triage and patching of all reported bugs and bottlenecks. Finalizing the codebase architecture seal based on feedback.</div>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            {/* Phase 3 */}
                            <div className="relative group">
                                <div className="absolute -left-[2.8rem] md:-left-[3.5rem] bg-dark-bg p-2 rounded-full border-2 border-accent-400 text-accent-400 z-10">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div className="glass-panel p-8 rounded-3xl border border-accent-500/20 transition-all duration-300 hover:border-accent-500/40 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-accent-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

                                    <div className="mb-2">
                                        <span className="text-accent-400 font-mono text-sm tracking-widest uppercase font-bold">Phase 3 (Q3/Q4)</span>
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-6">Security, Audit, and Mainnet Launch</h2>
                                    <p className="text-gray-400 mb-8">
                                        Mathematical and infrastructural security guarantees for handling real user funds on Mainnet.
                                    </p>

                                    <ul className="space-y-4 text-gray-300">
                                        <li className="flex items-start">
                                            <div className="mt-1 mr-3 text-accent-400 shrink-0"><CheckMark /></div>
                                            <div><strong>Comprehensive Security Audit:</strong> Engaging top-tier auditing firms for a deep-dive review of the Rust Odra contracts, Circom ZK-circuits, and frontend mechanics.</div>
                                        </li>
                                        <li className="flex items-start">
                                            <div className="mt-1 mr-3 text-accent-400 shrink-0"><CheckMark /></div>
                                            <div><strong>Audit Remediation:</strong> Applying all necessary fixes and optimizations mandated by the security audit reports. Publishing the final report.</div>
                                        </li>
                                        <li className="flex items-start">
                                            <div className="mt-1 mr-3 text-accent-400 shrink-0"><CheckMark /></div>
                                            <div><strong>Trusted Setup Ceremony:</strong> Executing a multi-party computation (MPC) Trusted Setup for the Groth16 circuits to ensure parameters cannot be compromised.</div>
                                        </li>
                                    </ul>

                                    <div className="mt-8 pt-8 border-t border-white/10 text-center">
                                        <div className="inline-flex items-center justify-center p-4 bg-gradient-to-r from-brand-500 to-accent-500 rounded-full mb-4 shadow-[0_0_30px_rgba(20,241,149,0.3)]">
                                            <Rocket className="w-8 h-8 text-white" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-white">Mainnet Launch</h3>
                                        <p className="text-gray-400 mt-2">Deploying the finalized, audited, and hardened protocol to the Casper Mainnet.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Line ending dot */}
                            <div className="absolute bottom-0 -left-[0.6rem] md:-left-[0.55rem] w-4 h-4 rounded-full bg-white/20" />
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
        <svg className="w-5 h-5 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
    )
}
