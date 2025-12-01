import React, { useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Deposit from '@/components/Deposit';
import Withdraw from '@/components/Withdraw';
import { Shield, Wallet, ArrowRight, Lock, EyeOff, Code2, Activity, Users, Globe, ExternalLink, Menu, X, ChevronRight } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
    const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
    const { isConnected, activeKey, connect } = useWallet();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen font-sans text-white selection:bg-brand-500/30 selection:text-brand-200 flex flex-col overflow-x-hidden">
            <Head>
                <title>Shroud Protocol | Privacy Mixer</title>
                <meta name="description" content="Privacy-preserving transactions on Casper Network" />
            </Head>

            {/* Navbar */}
            <header className="fixed top-0 w-full z-50 bg-dark-bg/80 backdrop-blur-md border-b border-white/5">
                <div className="container mx-auto px-6 h-20 flex justify-between items-center">
                    <div className="flex items-center space-x-3 cursor-pointer group">
                        <div className="bg-gradient-to-br from-brand-600 to-accent-600 p-2 rounded-lg shadow-lg shadow-brand-500/20 group-hover:shadow-brand-500/40 transition-all duration-300">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white group-hover:text-brand-400 transition-colors">
                            Shroud Protocol
                        </span>
                    </div>

                    <nav className="hidden md:flex items-center space-x-8">
                        {['How it Works', 'Statistics', 'Docs'].map((item) => (
                            <a key={item} href="#" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                                {item}
                            </a>
                        ))}
                        <button
                            onClick={connect}
                            className={`flex items-center px-5 py-2.5 rounded-full font-medium text-sm transition-all duration-200 ${isConnected
                                ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20 hover:bg-brand-500/20'
                                : 'bg-white text-dark-bg hover:bg-gray-100 shadow-lg shadow-white/10 hover:shadow-white/20'
                                }`}
                        >
                            <Wallet className="w-4 h-4 mr-2" />
                            {isConnected
                                ? `${activeKey?.slice(0, 6)}...${activeKey?.slice(-4)}`
                                : 'Connect Wallet'}
                        </button>
                    </nav>

                    <button
                        className="md:hidden p-2 text-gray-400 hover:bg-white/5 rounded-lg"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X /> : <Menu />}
                    </button>
                </div>
            </header>

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
                                <button className="btn-primary px-8 py-4 rounded-xl text-lg flex items-center justify-center">
                                    Launch App <ArrowRight className="ml-2 w-5 h-5" />
                                </button>
                                <button className="btn-secondary px-8 py-4 rounded-xl text-lg flex items-center justify-center">
                                    View Documentation
                                </button>
                            </div>

                            <div className="mt-12 grid grid-cols-3 gap-8 border-t border-white/10 pt-8">
                                <div>
                                    <div className="text-3xl font-bold text-white">$1.2M+</div>
                                    <div className="text-sm text-gray-500 font-medium mt-1">Total Volume</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-bold text-white">1,420</div>
                                    <div className="text-sm text-gray-500 font-medium mt-1">Anonymity Set</div>
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
                <div className="container mx-auto px-4 max-w-lg relative z-10">
                    <div className="glass-card rounded-3xl p-2 mb-24 border border-white/10 shadow-2xl shadow-brand-900/20">
                        <div className="flex mb-2 bg-black/20 rounded-2xl p-1.5">
                            <button
                                onClick={() => setActiveTab('deposit')}
                                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${activeTab === 'deposit'
                                    ? 'bg-white/10 text-white shadow-lg shadow-black/10 ring-1 ring-white/5'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                    }`}
                            >
                                Deposit
                            </button>
                            <button
                                onClick={() => setActiveTab('withdraw')}
                                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${activeTab === 'withdraw'
                                    ? 'bg-white/10 text-white shadow-lg shadow-black/10 ring-1 ring-white/5'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                    }`}
                            >
                                Withdraw
                            </button>
                        </div>

                        <div className="p-6">
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
                </div>

                {/* Features */}
                <div className="bg-white/5 py-24 border-t border-white/5 backdrop-blur-sm">
                    <div className="container mx-auto px-6">
                        <div className="text-center max-w-2xl mx-auto mb-16">
                            <h2 className="text-3xl font-bold text-white mb-4">Why Shroud Protocol?</h2>
                            <p className="text-gray-400 text-lg">Built on the Casper Network, Shroud provides institutional-grade privacy with a seamless user experience.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[
                                { icon: EyeOff, title: "Zero Knowledge", desc: "Mathematical proof of ownership without revealing identity." },
                                { icon: Lock, title: "Non-Custodial", desc: "Full control of your funds via your secret key." },
                                { icon: Code2, title: "Open Source", desc: "Transparent and auditable code for maximum trust." }
                            ].map((item, i) => (
                                <div key={i} className="bg-white/5 p-8 rounded-2xl border border-white/5 hover:border-brand-500/30 hover:bg-white/10 hover:shadow-xl hover:shadow-brand-500/10 transition-all duration-300 group">
                                    <div className="w-12 h-12 bg-brand-500/10 rounded-xl flex items-center justify-center text-brand-400 mb-6 group-hover:scale-110 transition-transform">
                                        <item.icon className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                                    <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            <footer className="bg-dark-bg border-t border-white/5 py-12">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                        <div className="col-span-1 md:col-span-1">
                            <div className="flex items-center space-x-2 mb-4">
                                <div className="bg-brand-600 p-1.5 rounded-lg">
                                    <Shield className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-lg font-bold text-white">Shroud</span>
                            </div>
                            <p className="text-gray-500 text-sm leading-relaxed">
                                Privacy-preserving infrastructure for the Casper Network.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-4">Platform</h4>
                            <ul className="space-y-2 text-sm text-gray-500">
                                <li><a href="#" className="hover:text-brand-400 transition-colors">Deposit</a></li>
                                <li><a href="#" className="hover:text-brand-400 transition-colors">Withdraw</a></li>
                                <li><a href="#" className="hover:text-brand-400 transition-colors">Statistics</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-4">Resources</h4>
                            <ul className="space-y-2 text-sm text-gray-500">
                                <li><a href="#" className="hover:text-brand-400 transition-colors">Documentation</a></li>
                                <li><a href="#" className="hover:text-brand-400 transition-colors">GitHub</a></li>
                                <li><a href="#" className="hover:text-brand-400 transition-colors">Audits</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-white mb-4">Community</h4>
                            <ul className="space-y-2 text-sm text-gray-500">
                                <li><a href="#" className="hover:text-brand-400 transition-colors">Discord</a></li>
                                <li><a href="#" className="hover:text-brand-400 transition-colors">Twitter</a></li>
                                <li><a href="#" className="hover:text-brand-400 transition-colors">Telegram</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-sm text-gray-600">
                        <p>© 2025 Shroud Protocol. All rights reserved.</p>
                        <div className="flex items-center space-x-6 mt-4 md:mt-0">
                            <a href="#" className="hover:text-gray-400 transition-colors">Privacy Policy</a>
                            <a href="#" className="hover:text-gray-400 transition-colors">Terms of Service</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
