import React from 'react';
import Head from 'next/head';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Activity, Users, DollarSign, Clock, Shield, Lock, ExternalLink, CheckCircle } from 'lucide-react';
import { getContractHash } from '@/utils/casper';

export default function Statistics() {
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
        { label: 'Deposit Amount', value: contractInfo.depositAmount, icon: DollarSign, color: 'text-brand-400', bg: 'bg-brand-500/10' },
        { label: 'Network', value: 'Testnet', icon: Shield, color: 'text-green-400', bg: 'bg-green-500/10' },
        { label: 'Contract Status', value: 'Deployed ✓', icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
        { label: 'Proof System', value: contractInfo.proofSystem, icon: Lock, color: 'text-accent-400', bg: 'bg-accent-500/10' },
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
                            <h1 className="text-4xl font-extrabold mb-4 text-white">Protocol Information</h1>
                            <p className="text-gray-400 text-lg">Contract details and protocol specifications.</p>
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

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Contract Details */}
                            <div className="glass-panel p-8 rounded-3xl border border-white/10">
                                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                                    <Shield className="w-5 h-5 mr-2 text-brand-400" /> Contract Details
                                </h2>
                                <div className="space-y-4">
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                        <div className="text-gray-400 text-sm mb-1">Package Hash</div>
                                        <div className="font-mono text-sm text-white break-all">
                                            {contractInfo.packageHash}
                                        </div>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                        <div className="text-gray-400 text-sm mb-1">Network</div>
                                        <div className="font-medium text-white">{contractInfo.network}</div>
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

                            {/* Technical Specifications */}
                            <div className="glass-panel p-8 rounded-3xl border border-white/10">
                                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                                    <Activity className="w-5 h-5 mr-2 text-brand-400" /> Technical Specifications
                                </h2>
                                <div className="space-y-4">
                                    {[
                                        { label: 'ZK Proof System', value: 'Groth16' },
                                        { label: 'Hash Function', value: 'MiMC7' },
                                        { label: 'Merkle Tree Depth', value: '20 levels' },
                                        { label: 'Circuit Constraints', value: '~15,695' },
                                        { label: 'Framework', value: 'Odra 2.4.0' },
                                    ].map((spec, i) => (
                                        <div key={i} className="flex justify-between items-center p-3 rounded-xl hover:bg-white/5 transition-colors">
                                            <span className="text-gray-400">{spec.label}</span>
                                            <span className="text-white font-medium">{spec.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Activity Notice */}
                        <div className="mt-8 p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
                            <div className="flex items-start space-x-3">
                                <Clock className="w-5 h-5 text-yellow-400 mt-0.5" />
                                <div>
                                    <h3 className="text-yellow-400 font-bold mb-1">Testnet Mode</h3>
                                    <p className="text-yellow-200/80 text-sm">
                                        This contract is deployed on Casper Testnet. Activity statistics will be available
                                        once the protocol has real user activity. Use the testnet faucet to get test CSPR.
                                    </p>
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
