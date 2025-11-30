import React, { useState } from 'react';
import Head from 'next/head';
import Deposit from '@/components/Deposit';
import Withdraw from '@/components/Withdraw';
import { Shield, Wallet } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';

export default function Home() {
    const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
    const { isConnected, activeKey, connect } = useWallet();

    return (
        <div className="min-h-screen font-sans text-gray-900 selection:bg-brand-100 selection:text-brand-900">
            <Head>
                <title>Shroud Protocol | Privacy Mixer</title>
                <meta name="description" content="Privacy-preserving transactions on Casper Network" />
            </Head>

            <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-lg border-b border-gray-200/50">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-3 cursor-pointer">
                        <div className="bg-brand-50 p-2 rounded-lg">
                            <Shield className="w-6 h-6 text-brand-600" />
                        </div>
                        <span className="text-lg font-bold tracking-tight text-gray-900">
                            Shroud Protocol
                        </span>
                    </div>
                    <button
                        onClick={connect}
                        className={`flex items-center px-5 py-2.5 rounded-full font-medium text-sm transition-all duration-200 ${isConnected
                            ? 'bg-gray-50 text-brand-700 border border-brand-200 hover:bg-brand-50'
                            : 'bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/30 hover:shadow-brand-500/40'
                            }`}
                    >
                        <Wallet className="w-4 h-4 mr-2" />
                        {isConnected
                            ? `${activeKey?.slice(0, 6)}...${activeKey?.slice(-4)}`
                            : 'Connect Wallet'}
                    </button>
                </div>
            </header>

            <main className="container mx-auto px-4 pt-32 pb-20 flex flex-col items-center relative z-10">
                <div className="mb-12 text-center animate-fade-in max-w-2xl">
                    <div className="inline-flex items-center justify-center mb-8 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <Shield className="w-10 h-10 text-brand-600" />
                    </div>
                    <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 text-gray-900 leading-tight">
                        Privacy for the <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-400">Casper Network</span>
                    </h1>
                    <p className="text-gray-500 text-lg md:text-xl leading-relaxed">
                        Break the link between your deposit and withdrawal. <br className="hidden md:block" />
                        Secure, non-custodial, and zero-knowledge.
                    </p>
                </div>

                <div className="w-full max-w-lg glass-card rounded-3xl p-3 shadow-xl shadow-gray-200/50 animate-slide-up">
                    <div className="flex mb-4 bg-gray-100/50 rounded-2xl p-1.5">
                        <button
                            onClick={() => setActiveTab('deposit')}
                            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${activeTab === 'deposit'
                                ? 'bg-white text-brand-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                }`}
                        >
                            Deposit
                        </button>
                        <button
                            onClick={() => setActiveTab('withdraw')}
                            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${activeTab === 'withdraw'
                                ? 'bg-white text-brand-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                }`}
                        >
                            Withdraw
                        </button>
                    </div>

                    <div className="px-4 pb-4">
                        {activeTab === 'deposit' ? (
                            <Deposit isConnected={isConnected} activeKey={activeKey} />
                        ) : (
                            <Withdraw isConnected={isConnected} activeKey={activeKey} />
                        )}
                    </div>
                </div>

                <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 text-center max-w-5xl w-full">
                    {[
                        { title: "Zero Knowledge", desc: "Mathematical proof of ownership without revealing identity." },
                        { title: "Non-Custodial", desc: "Full control of your funds via your secret key." },
                        { title: "Open Source", desc: "Transparent and auditable code for maximum trust." }
                    ].map((item, i) => (
                        <div key={i} className="p-8 rounded-2xl bg-white border border-gray-100 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-300 group cursor-default">
                            <h3 className="text-lg font-bold mb-3 text-gray-900 group-hover:text-brand-600 transition-colors">{item.title}</h3>
                            <p className="text-gray-500 text-sm leading-relaxed">
                                {item.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
