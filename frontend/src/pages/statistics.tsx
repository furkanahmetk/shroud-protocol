import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Activity, Users, DollarSign, Clock, Shield, Lock, ExternalLink, CheckCircle, Database, Hash as HashIcon } from 'lucide-react';
import { getContractHash, CONTRACT_HASH } from '@/utils/casper';

export default function Statistics() {
    const [activity, setActivity] = useState<{ deposits: string[], withdrawals: any[] }>({ deposits: [], withdrawals: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals'>('deposits');

    useEffect(() => {
        const loadActivity = async () => {
            try {
                const { fetchProtocolActivity } = await import('@/utils/casper');
                const data = await fetchProtocolActivity(CONTRACT_HASH);
                setActivity(data);
            } catch (e) {
                console.error("Failed to fetch statistics:", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadActivity();
    }, []);

    // Contract information
    const contractInfo = {
        packageHash: getContractHash(),
        network: 'casper-test',
        depositAmount: '100 CSPR',
        proofSystem: 'Groth16 (ZK-SNARK)',
        hashFunction: 'MiMC7',
        merkleTreeDepth: 20,
    };

    const features = [
        { label: 'Total Deposits', value: activity.deposits.length.toString(), icon: Database, color: 'text-brand-400', bg: 'bg-brand-500/10' },
        { label: 'Total Withdrawals', value: activity.withdrawals.length.toString(), icon: ExternalLink, color: 'text-brand-400', bg: 'bg-brand-500/10' },
        { label: 'Network', value: 'Testnet', icon: Shield, color: 'text-green-400', bg: 'bg-green-500/10' },
        { label: 'Contract Status', value: 'Active', icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
    ];

    return (
        <div className="min-h-screen font-sans text-white selection:bg-brand-500/30 selection:text-brand-200 flex flex-col overflow-x-hidden">
            <Head>
                <title>Statistics | Shroud Protocol</title>
                <meta name="description" content="Protocol statistics and contract information" />
            </Head>

            <Navbar />

            <main className="flex-grow pt-32 pb-20 relative">
                {/* Background Glows */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-[128px] pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-500/5 rounded-full blur-[128px] pointer-events-none" />

                <div className="container mx-auto px-6 relative z-10">
                    <div className="max-w-6xl mx-auto">
                        <div className="mb-12">
                            <h1 className="text-4xl font-extrabold mb-4 text-white uppercase tracking-tighter">Protocol Activity</h1>
                            <p className="text-gray-400 text-lg">Real-time on-chain statistics and commitment history.</p>
                        </div>

                        {/* Key Features Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                            {features.map((feature, i) => (
                                <div key={i} className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-brand-500/30 transition-colors">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-xl ${feature.bg} ${feature.color}`}>
                                            <feature.icon className="w-6 h-6" />
                                        </div>
                                    </div>
                                    <h3 className="text-gray-400 text-sm font-medium mb-1">{feature.label}</h3>
                                    <p className="text-xl font-bold text-white">{feature.value}</p>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Activity Feed */}
                            <div className="lg:col-span-2 glass-panel p-8 rounded-3xl border border-white/10">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-white flex items-center">
                                        <Activity className="w-5 h-5 mr-2 text-brand-400" /> Recent Activity
                                    </h2>
                                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                                        <button
                                            onClick={() => setActiveTab('deposits')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'deposits' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-gray-500 hover:text-white'}`}
                                        >
                                            Deposits
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('withdrawals')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'withdrawals' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-gray-500 hover:text-white'}`}
                                        >
                                            Withdrawals
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                    {isLoading ? (
                                        <div className="py-20 text-center">
                                            <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mx-auto mb-4"></div>
                                            <p className="text-gray-500">Syncing with Casper Testnet...</p>
                                        </div>
                                    ) : (activeTab === 'deposits' ? activity.deposits : activity.withdrawals).length === 0 ? (
                                        <div className="py-20 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                                            <p className="text-gray-500">No {activeTab} found yet.</p>
                                        </div>
                                    ) : (
                                        (activeTab === 'deposits' ? activity.deposits : activity.withdrawals).map((item: any, i: number) => (
                                            <div key={i} className="group p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all duration-300 flex items-center space-x-4">
                                                <div className="w-10 h-10 bg-brand-500/20 rounded-full flex items-center justify-center text-brand-400 font-bold text-xs shrink-0 group-hover:bg-brand-500/30 transition-colors">
                                                    #{i}
                                                </div>
                                                <div className="min-w-0 flex-grow">
                                                    {activeTab === 'deposits' ? (
                                                        <>
                                                            <div className="flex items-center space-x-2 text-gray-400 text-[10px] uppercase tracking-widest mb-1">
                                                                <HashIcon className="w-3 h-3" />
                                                                <span>Commitment Hash</span>
                                                            </div>
                                                            <div className="font-mono text-xs text-white truncate">
                                                                {item}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="flex items-center space-x-2 text-gray-400 text-[10px] uppercase tracking-widest mb-1">
                                                                <Shield className="w-3 h-3" />
                                                                <span>Recipient: {item.recipient?.slice(0, 10)}...</span>
                                                            </div>
                                                            <div className="font-mono text-xs text-brand-400 truncate">
                                                                Nullifier: {item.nullifier?.slice(0, 32)}...
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-green-500 font-bold uppercase shrink-0 px-2 py-1 bg-green-500/10 rounded-md">
                                                    {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'Verified'}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Technical Details Sidebar */}
                            <div className="space-y-8">
                                <div className="glass-panel p-8 rounded-3xl border border-white/10">
                                    <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                                        <Shield className="w-5 h-5 mr-2 text-brand-400" /> Contract Details
                                    </h2>
                                    <div className="space-y-4">
                                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                            <div className="text-gray-400 text-sm mb-1 uppercase tracking-wider text-[10px]">Package Hash</div>
                                            <div className="font-mono text-xs text-white break-all leading-relaxed">
                                                {contractInfo.packageHash}
                                            </div>
                                        </div>
                                        <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center">
                                            <span className="text-gray-400 text-sm">Network</span>
                                            <span className="font-medium text-white text-sm">{contractInfo.network}</span>
                                        </div>
                                        <a
                                            href={`https://testnet.cspr.live/contract-package/${contractInfo.packageHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center w-full py-3 bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/30 rounded-xl text-sm font-medium transition-all text-brand-400 hover:text-white"
                                        >
                                            View on Explorer <ExternalLink className="w-4 h-4 ml-2" />
                                        </a>
                                    </div>
                                </div>

                                <div className="glass-panel p-8 rounded-3xl border border-white/10">
                                    <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                                        <Lock className="w-5 h-5 mr-2 text-brand-400" /> Protocol Specs
                                    </h2>
                                    <div className="space-y-3">
                                        {[
                                            { label: 'ZK Proof', value: 'Groth16' },
                                            { label: 'Hash Func', value: 'MiMC7' },
                                            { label: 'Depth', value: '20' },
                                            { label: 'Framework', value: 'Odra' },
                                        ].map((spec, i) => (
                                            <div key={i} className="flex justify-between items-center text-sm py-2 border-b border-white/5 last:border-0">
                                                <span className="text-gray-400">{spec.label}</span>
                                                <span className="text-white font-medium">{spec.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
