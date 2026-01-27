import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Wallet, Menu, X, ChevronDown, User, LogOut, RefreshCw, Copy, Check, Github } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';

export default function Navbar() {
    const { isConnected, activeKey, connect, disconnect } = useWallet();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const isActive = (path: string) => router.pathname === path;

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen]);

    const handleConnect = async () => {
        await connect();
        setIsDropdownOpen(false);
    };

    const handleDisconnect = async () => {
        await disconnect();
        setIsDropdownOpen(false);
    };

    const handleCopy = async () => {
        if (activeKey) {
            await navigator.clipboard.writeText(activeKey);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }
    };

    return (
        <header className="fixed top-0 w-full z-50 bg-dark-bg/80 backdrop-blur-md border-b border-white/5">
            <div className="container mx-auto px-6 h-20 flex justify-between items-center">
                <Link href="/" className="flex items-center space-x-3 cursor-pointer group">
                    <Image
                        src="/logo.png"
                        alt="Shroud Protocol"
                        width={40}
                        height={40}
                        className="group-hover:scale-105 transition-transform duration-300"
                    />
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
                    <a
                        href="https://github.com/furkanahmetk/shroud-protocol"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-white transition-colors"
                        title="View on GitHub"
                    >
                        <Github className="w-5 h-5" />
                    </a>
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => isConnected ? setIsDropdownOpen(!isDropdownOpen) : handleConnect()}
                            className={`flex items-center px-5 py-2.5 rounded-full font-medium text-sm transition-all duration-200 group ${isConnected
                                ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20 hover:bg-brand-500/20'
                                : 'bg-white text-dark-bg hover:bg-gray-100 shadow-lg shadow-white/10 hover:shadow-white/20'
                                }`}
                        >
                            <Wallet className="w-4 h-4 mr-2" />
                            {isConnected
                                ? `${activeKey?.slice(0, 6)}...${activeKey?.slice(-4)}`
                                : 'Connect Wallet'}
                            {isConnected && (
                                <ChevronDown className={`ml-2 w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            )}
                        </button>

                        {/* Wallet Dropdown */}
                        {isConnected && isDropdownOpen && (
                            <div className="absolute right-0 mt-3 w-64 glass-panel rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
                                <div className="p-3 border-b border-white/5 bg-white/5">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Active Account</p>
                                        <div className="flex items-center space-x-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-[10px] text-green-500 uppercase font-bold tracking-tight">Connected</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleCopy}
                                        className="w-full flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-all group"
                                    >
                                        <p className="text-xs font-mono text-white truncate text-left pr-2">{activeKey}</p>
                                        {isCopied ? (
                                            <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                        ) : (
                                            <Copy className="w-3.5 h-3.5 text-gray-500 group-hover:text-brand-400 shrink-0 transition-colors" />
                                        )}
                                    </button>
                                </div>
                                <div className="p-1">
                                    <button
                                        onClick={handleConnect}
                                        className="w-full flex items-center px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all group"
                                    >
                                        <RefreshCw className="w-4 h-4 mr-3 text-brand-400 group-hover:rotate-180 transition-transform duration-500" />
                                        <span>Change Account</span>
                                    </button>
                                    <button
                                        onClick={handleDisconnect}
                                        className="w-full flex items-center px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all group"
                                    >
                                        <LogOut className="w-4 h-4 mr-3" />
                                        <span>Disconnect</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
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
                        <a
                            href="https://github.com/furkanahmetk/shroud-protocol"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-base font-medium text-gray-400 hover:text-white transition-colors"
                        >
                            <Github className="w-5 h-5 mr-2" />
                            GitHub
                        </a>
                        <div className="space-y-2">
                            <button
                                onClick={handleConnect}
                                className={`w-full flex items-center justify-center px-5 py-3 rounded-xl font-medium text-sm transition-all ${isConnected
                                    ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                                    : 'bg-white text-dark-bg'}`}
                            >
                                <Wallet className="w-4 h-4 mr-2" />
                                {isConnected ? `${activeKey?.slice(0, 6)}...${activeKey?.slice(-4)}` : 'Connect Wallet'}
                            </button>

                            {isConnected && (
                                <>
                                    <button
                                        onClick={handleConnect}
                                        className="w-full flex items-center justify-center px-5 py-3 rounded-xl font-medium text-sm bg-white/5 text-gray-300 border border-white/10"
                                    >
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Change Account
                                    </button>
                                    <button
                                        onClick={handleDisconnect}
                                        className="w-full flex items-center justify-center px-5 py-3 rounded-xl font-medium text-sm bg-red-500/10 text-red-400 border border-red-500/20"
                                    >
                                        <LogOut className="w-4 h-4 mr-2" />
                                        Disconnect
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
