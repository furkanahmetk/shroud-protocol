import React from 'react';
import Head from 'next/head';
import Navbar from '@/components/Navbar';
import { Activity, Users, DollarSign, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function Statistics() {
    // Mock Data
    const stats = [
        { label: 'Total Volume', value: '1,240,500 CSPR', change: '+12.5%', icon: DollarSign, color: 'text-brand-400', bg: 'bg-brand-500/10' },
        { label: 'Total Deposits', value: '8,420', change: '+5.2%', icon: ArrowDownRight, color: 'text-green-400', bg: 'bg-green-500/10' },
        { label: 'Total Withdrawals', value: '6,150', change: '+3.8%', icon: ArrowUpRight, color: 'text-red-400', bg: 'bg-red-500/10' },
        { label: 'Anonymity Set', value: '1,420', change: '+1.2%', icon: Users, color: 'text-accent-400', bg: 'bg-accent-500/10' },
    ];

    const recentActivity = [
        { type: 'Deposit', amount: '100 CSPR', time: '2 mins ago', hash: '0x123...abc' },
        { type: 'Withdraw', amount: '100 CSPR', time: '5 mins ago', hash: '0x456...def' },
        { type: 'Deposit', amount: '1000 CSPR', time: '12 mins ago', hash: '0x789...ghi' },
        { type: 'Deposit', amount: '100 CSPR', time: '15 mins ago', hash: '0xabc...123' },
        { type: 'Withdraw', amount: '1000 CSPR', time: '25 mins ago', hash: '0xdef...456' },
    ];

    return (
        <div className="min-h-screen font-sans text-white selection:bg-brand-500/30 selection:text-brand-200 flex flex-col overflow-x-hidden">
            <Head>
                <title>Statistics | Shroud Protocol</title>
                <meta name="description" content="Protocol statistics and analytics" />
            </Head>

            <Navbar />

            <main className="flex-grow pt-32 pb-20 relative">
                {/* Background Glows */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-[128px] pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-500/5 rounded-full blur-[128px] pointer-events-none" />

                <div className="container mx-auto px-6 relative z-10">
                    <div className="max-w-6xl mx-auto">
                        <div className="mb-12">
                            <h1 className="text-4xl font-extrabold mb-4 text-white">Protocol Statistics</h1>
                            <p className="text-gray-400 text-lg">Real-time insights into Shroud Protocol activity.</p>
                        </div>

                        {/* Key Metrics Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                            {stats.map((stat, i) => (
                                <div key={i} className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-brand-500/30 transition-colors">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                                            <stat.icon className="w-6 h-6" />
                                        </div>
                                        <span className="text-xs font-medium text-green-400 bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/20">
                                            {stat.change}
                                        </span>
                                    </div>
                                    <h3 className="text-gray-400 text-sm font-medium mb-1">{stat.label}</h3>
                                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Volume Chart (Mock) */}
                            <div className="lg:col-span-2 glass-panel p-8 rounded-3xl border border-white/10">
                                <div className="flex justify-between items-center mb-8">
                                    <h2 className="text-xl font-bold text-white flex items-center">
                                        <Activity className="w-5 h-5 mr-2 text-brand-400" /> Volume History
                                    </h2>
                                    <div className="flex space-x-2">
                                        {['24h', '7d', '30d', 'All'].map((period) => (
                                            <button key={period} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${period === '7d' ? 'bg-brand-500 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
                                                {period}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Simple CSS Bar Chart */}
                                <div className="h-64 flex items-end justify-between space-x-2">
                                    {[35, 45, 30, 60, 75, 50, 65, 80, 70, 90, 85, 100].map((height, i) => (
                                        <div key={i} className="w-full bg-white/5 rounded-t-lg relative group">
                                            <div
                                                className="absolute bottom-0 w-full bg-gradient-to-t from-brand-600 to-brand-400 rounded-t-lg transition-all duration-500 group-hover:opacity-80"
                                                style={{ height: `${height}%` }}
                                            />
                                            <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs py-1 px-2 rounded border border-white/10 transition-opacity whitespace-nowrap z-10">
                                                {height * 1000} CSPR
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between mt-4 text-xs text-gray-500">
                                    <span>Nov 1</span>
                                    <span>Nov 15</span>
                                    <span>Dec 1</span>
                                </div>
                            </div>

                            {/* Recent Activity */}
                            <div className="glass-panel p-8 rounded-3xl border border-white/10">
                                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                                    <Clock className="w-5 h-5 mr-2 text-brand-400" /> Recent Activity
                                </h2>
                                <div className="space-y-4">
                                    {recentActivity.map((tx, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                            <div className="flex items-center space-x-3">
                                                <div className={`p-2 rounded-lg ${tx.type === 'Deposit' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                    {tx.type === 'Deposit' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-white">{tx.type}</div>
                                                    <div className="text-xs text-gray-500">{tx.time}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-bold text-white">{tx.amount}</div>
                                                <div className="text-xs text-gray-500 font-mono">{tx.hash}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button className="w-full mt-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-all text-gray-400 hover:text-white">
                                    View All Activity
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="bg-dark-bg border-t border-white/5 py-12">
                <div className="container mx-auto px-6 text-center text-gray-600 text-sm">
                    <p>© 2025 Shroud Protocol. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
