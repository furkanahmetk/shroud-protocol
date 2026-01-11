import React, { useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import Deposit from '@/components/Deposit';
import Withdraw from '@/components/Withdraw';
import { Shield, Wallet, ArrowRight, Lock, EyeOff, Code2, Activity, Users, Globe, ExternalLink, Menu, X, ChevronRight } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { motion, AnimatePresence } from 'framer-motion';

import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';

export default function Home() {
    const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
    const { isConnected, activeKey } = useWallet();

    return (
        <div className="min-h-screen font-sans text-white selection:bg-brand-500/30 selection:text-brand-200 flex flex-col overflow-x-hidden">
            <Head>
                <title>Shroud Protocol | Privacy Mixer</title>
                <meta name="description" content="Privacy-preserving transactions on Casper Network" />
            </Head>

            <Navbar />

            <main className="flex-grow pt-32 pb-20 relative">
                {/* Background Glows */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/20 rounded-full blur-[128px] pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-[128px] pointer-events-none" />

                {/* Hero Section */}
                <div className="container mx-auto px-6 mb-24 relative z-10">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                        <div className="flex-1 max-w-2xl">
                            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-bold uppercase tracking-wide mb-8 backdrop-blur-sm">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                                </span>
                                <span>Casper Testnet Live</span>
                            </div>

                            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 text-white leading-[1.1]">
                                Privacy for the <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-accent-400 animate-pulse-slow">Casper Network</span>
                            </h1>
                            <p className="text-gray-400 text-lg md:text-xl leading-relaxed mb-10 max-w-lg">
                                Break the link between your deposit and withdrawal. Secure, non-custodial, and zero-knowledge.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <button
                                    onClick={() => document.getElementById('app-interface')?.scrollIntoView({ behavior: 'smooth' })}
                                    className="btn-primary px-8 py-4 rounded-xl text-lg flex items-center justify-center"
                                >
                                    Launch App <ArrowRight className="ml-2 w-5 h-5" />
                                </button>
                                <Link href="/docs" className="btn-secondary px-8 py-4 rounded-xl text-lg flex items-center justify-center">
                                    View Documentation
                                </Link>
                            </div>

                            <div className="mt-12 grid grid-cols-3 gap-8 border-t border-white/10 pt-8">
                                <div>
                                    <div className="text-3xl font-bold text-white">100</div>
                                    <div className="text-sm text-gray-500 font-medium mt-1">CSPR / Deposit</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-bold text-white">Testnet</div>
                                    <div className="text-sm text-gray-500 font-medium mt-1">Network</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-bold text-white">~2 min</div>
                                    <div className="text-sm text-gray-500 font-medium mt-1">Avg. Time</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 relative w-full max-w-xl aspect-square flex items-center justify-center">
                            {/* Abstract decorative elements */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/20 to-accent-500/20 rounded-full blur-3xl animate-pulse-slow" />
                            <div className="relative z-10 w-full h-full">
                                <div className="relative w-full h-full animate-float">
                                    <Image
                                        src="/hero_shield_3d_1764582011240.png"
                                        alt="Privacy Shield"
                                        fill
                                        className="object-contain drop-shadow-[0_0_50px_rgba(59,130,246,0.5)]"
                                        priority
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* App Interface */}
                <div id="app-interface" className="container mx-auto px-4 max-w-lg relative z-10">
                    <div className="glass-card rounded-3xl p-2 mb-24 border border-white/10 shadow-2xl shadow-brand-900/20">
                        <div className="flex mb-2 bg-black/20 rounded-2xl p-1.5">
                            <button
                                onClick={() => setActiveTab('deposit')}
                                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${activeTab === 'deposit'
                                    ? 'bg-white/10 text-white shadow-lg shadow-white/5'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                Deposit
                            </button>
                            <button
                                onClick={() => setActiveTab('withdraw')}
                                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${activeTab === 'withdraw'
                                    ? 'bg-white/10 text-white shadow-lg shadow-white/5'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                Withdraw
                            </button>
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                {activeTab === 'deposit' ? (
                                    <Deposit isConnected={isConnected} activeKey={activeKey} />
                                ) : (
                                    <Withdraw isConnected={isConnected} activeKey={activeKey} />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>

                {/* Features Section */}
                <div id="how-it-works" className="container mx-auto px-6 mb-24 relative z-10">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">
                            Zero Knowledge, <span className="text-brand-400">Maximum Privacy</span>
                        </h2>
                        <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                            Our protocol uses advanced cryptography to ensure your financial data remains completely private.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Lock,
                                title: "Deposit",
                                desc: "Deposit CSPR into the smart contract. You receive a secret key that proves your ownership.",
                                color: "text-brand-400",
                                bg: "bg-brand-500/10"
                            },
                            {
                                icon: EyeOff,
                                title: "Mix",
                                desc: "Your funds are pooled with others in a Merkle Tree, making it impossible to trace the source.",
                                color: "text-accent-400",
                                bg: "bg-accent-500/10"
                            },
                            {
                                icon: ArrowRight,
                                title: "Withdraw",
                                desc: "Use your secret key to generate a ZK proof and withdraw to a fresh address anonymously.",
                                color: "text-green-400",
                                bg: "bg-green-500/10"
                            }
                        ].map((feature, i) => (
                            <div key={i} className="glass-panel p-8 rounded-3xl border border-white/10 hover:border-brand-500/30 transition-all duration-300 group">
                                <div className={`w-14 h-14 rounded-2xl ${feature.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                                    <feature.icon className={`w-7 h-7 ${feature.color}`} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                                <p className="text-gray-400 leading-relaxed">
                                    {feature.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
