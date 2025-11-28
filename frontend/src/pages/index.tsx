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
        <div className="min-h-screen bg-shroud-black text-white selection:bg-shroud-accent selection:text-black">
            <Head>
                <title>Shroud Protocol | Privacy Mixer</title>
                <meta name="description" content="Privacy-preserving transactions on Casper Network" />
            </Head>

            <header className="container mx-auto px-4 py-6 flex justify-between items-center">
                <div className="flex items-center">
                    <Shield className="w-8 h-8 text-shroud-accent mr-2" />
                    <span className="text-xl font-bold">Shroud Protocol</span>
                </div>
                <button
                    onClick={connect}
                    className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${isConnected
                            ? 'bg-gray-800 text-shroud-accent border border-shroud-accent/50'
                            : 'bg-shroud-accent text-black hover:bg-green-400'
                        }`}
                >
                    <Wallet className="w-4 h-4 mr-2" />
                    {isConnected
                        ? `${activeKey?.slice(0, 6)}...${activeKey?.slice(-4)}`
                        : 'Connect Wallet'}
                </button>
            </header>

            <main className="container mx-auto px-4 py-12 flex flex-col items-center">
                <div className="mb-12 text-center">
                    <div className="flex items-center justify-center mb-4">
                        <Shield className="w-12 h-12 text-shroud-accent mr-3" />
                        <h1 className="text-5xl font-bold tracking-tighter">Shroud Protocol</h1>
                    </div>
                    <p className="text-gray-400 text-lg max-w-xl">
                        Break the link between your deposit and withdrawal.
                        Zero-knowledge privacy for the Casper Network.
                    </p>
                </div>

                <div className="w-full max-w-md bg-shroud-gray rounded-2xl p-1 border border-gray-800">
                    <div className="flex mb-6 bg-black/50 rounded-xl p-1">
                        <button
                            onClick={() => setActiveTab('deposit')}
                            className={`flex-1 py-3 rounded-lg font-medium transition-all duration-200 ${activeTab === 'deposit'
                                ? 'bg-shroud-accent text-black shadow-lg shadow-shroud-accent/20'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Deposit
                        </button>
                        <button
                            onClick={() => setActiveTab('withdraw')}
                            className={`flex-1 py-3 rounded-lg font-medium transition-all duration-200 ${activeTab === 'withdraw'
                                ? 'bg-shroud-accent text-black shadow-lg shadow-shroud-accent/20'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Withdraw
                        </button>
                    </div>

                    <div className="p-4">
                        {activeTab === 'deposit' ? (
                            <Deposit isConnected={isConnected} activeKey={activeKey} />
                        ) : (
                            <Withdraw isConnected={isConnected} activeKey={activeKey} />
                        )}
                    </div>
                </div>

                <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-center max-w-4xl">
                    <div className="p-6 rounded-xl bg-shroud-gray/50 border border-gray-800">
                        <h3 className="text-xl font-bold mb-2 text-shroud-accent">Zero Knowledge</h3>
                        <p className="text-gray-400 text-sm">
                            Mathematical proof that you own funds without revealing which funds are yours.
                        </p>
                    </div>
                    <div className="p-6 rounded-xl bg-shroud-gray/50 border border-gray-800">
                        <h3 className="text-xl font-bold mb-2 text-shroud-accent">Non-Custodial</h3>
                        <p className="text-gray-400 text-sm">
                            You maintain full control of your funds at all times via your secret key.
                        </p>
                    </div>
                    <div className="p-6 rounded-xl bg-shroud-gray/50 border border-gray-800">
                        <h3 className="text-xl font-bold mb-2 text-shroud-accent">Open Source</h3>
                        <p className="text-gray-400 text-sm">
                            Fully transparent and auditable code for maximum security and trust.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
