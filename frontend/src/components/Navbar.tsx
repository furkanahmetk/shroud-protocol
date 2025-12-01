import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Shield, Wallet, Menu, X } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';

export default function Navbar() {
    const { isConnected, activeKey, connect } = useWallet();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const router = useRouter();

    const isActive = (path: string) => router.pathname === path;

    return (
        <header className="fixed top-0 w-full z-50 bg-dark-bg/80 backdrop-blur-md border-b border-white/5">
            <div className="container mx-auto px-6 h-20 flex justify-between items-center">
                <Link href="/" className="flex items-center space-x-3 cursor-pointer group">
                    <div className="bg-gradient-to-br from-brand-600 to-accent-600 p-2 rounded-lg shadow-lg shadow-brand-500/20 group-hover:shadow-brand-500/40 transition-all duration-300">
                        <Shield className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white group-hover:text-brand-400 transition-colors">
                        Shroud Protocol
                    </span>
                </Link>

                <nav className="hidden md:flex items-center space-x-8">
                    {[
                        { name: 'Home', path: '/' },
                        { name: 'Statistics', path: '/statistics' },
                        { name: 'Docs', path: '/docs' }
                    ].map((item) => (
                        <Link
                            key={item.name}
                            href={item.path}
                            className={`text-sm font-medium transition-colors ${isActive(item.path) ? 'text-white' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            {item.name}
                        </Link>
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

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden bg-dark-bg border-b border-white/5">
                    <div className="px-6 py-4 space-y-4">
                        {[
                            { name: 'Home', path: '/' },
                            { name: 'Statistics', path: '/statistics' },
                            { name: 'Docs', path: '/docs' }
                        ].map((item) => (
                            <Link
                                key={item.name}
                                href={item.path}
                                className="block text-base font-medium text-gray-400 hover:text-white"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                {item.name}
                            </Link>
                        ))}
                        <button
                            onClick={connect}
                            className="w-full flex items-center justify-center px-5 py-3 rounded-xl font-medium text-sm bg-white text-dark-bg"
                        >
                            <Wallet className="w-4 h-4 mr-2" />
                            {isConnected ? 'Connected' : 'Connect Wallet'}
                        </button>
                    </div>
                </div>
            )}
        </header>
    );
}
