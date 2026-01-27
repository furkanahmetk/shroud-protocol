import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
    return (
        <footer className="bg-dark-bg border-t border-white/5 pt-20 pb-10">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                    <div className="col-span-1 md:col-span-1">
                        <Link href="/" className="flex items-center space-x-2 mb-4 group cursor-pointer">
                            <Image
                                src="/logo.png"
                                alt="Shroud Protocol"
                                width={32}
                                height={32}
                                className="group-hover:scale-105 transition-transform"
                            />
                            <span className="text-lg font-bold text-white group-hover:text-brand-400 transition-colors">Shroud</span>
                        </Link>
                        <p className="text-gray-500 text-sm leading-relaxed">
                            Privacy-preserving infrastructure for the Casper Network.
                        </p>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-4">Platform</h4>
                        <ul className="space-y-2 text-sm text-gray-500">
                            <li>
                                <Link href="/#app-interface" className="hover:text-brand-400 transition-colors">
                                    Deposit
                                </Link>
                            </li>
                            <li>
                                <Link href="/#app-interface" className="hover:text-brand-400 transition-colors">
                                    Withdraw
                                </Link>
                            </li>
                            <li>
                                <Link href="/statistics" className="hover:text-brand-400 transition-colors">
                                    Statistics
                                </Link>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-4">Resources</h4>
                        <ul className="space-y-2 text-sm text-gray-500">
                            <li>
                                <Link href="/docs" className="hover:text-brand-400 transition-colors">
                                    Documentation
                                </Link>
                            </li>
                            <li>
                                <a href="#" className="hover:text-brand-400 transition-colors">
                                    GitHub
                                </a>
                            </li>
                            <li>
                                <a href="#" className="hover:text-brand-400 transition-colors">
                                    Audits
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-4">Community</h4>
                        <ul className="space-y-2 text-sm text-gray-500">
                            <li><a href="#" className="hover:text-brand-400 transition-colors">Discord</a></li>
                            <li><a href="#" className="hover:text-brand-400 transition-colors">Twitter</a></li>
                            <li><a href="https://t.me/shroud_protocol" target="_blank" rel="noopener noreferrer" className="hover:text-brand-400 transition-colors">Telegram</a></li>
                        </ul>
                    </div>
                </div>
                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-sm text-gray-600">
                    <p>© 2025 Shroud Protocol. All rights reserved.</p>
                    <div className="flex items-center space-x-6 mt-4 md:mt-0">
                        <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
