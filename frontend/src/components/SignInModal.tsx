import React, { useEffect, useState } from 'react';
import { X, Wallet, Key, Loader2 } from 'lucide-react';
import { useCsprClick } from '../context/CsprClickContext';

interface Provider {
    key: string;
    text: string;
    icon: string;
    connected: boolean;
}

interface Account {
    provider: string;
    public_key: string;
    balance?: string;
    liquid_balance?: string;
}

interface SignInOptions {
    providers: Provider[];
    accounts: Account[];
}

const PROVIDER_ICONS: Record<string, string> = {
    'casper-wallet': '/wallet-icons/casper-wallet.svg',
    'ledger': '/wallet-icons/ledger.svg',
    'metamask-snap': '/wallet-icons/metamask.svg',
};

interface SignInModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SignInModal({ isOpen, onClose }: SignInModalProps) {
    const clickRef = useCsprClick();
    const [options, setOptions] = useState<SignInOptions | null>(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !clickRef) return;
        setLoading(true);
        (async () => {
            try {
                const opts = await clickRef.getSignInOptions(true);
                setOptions(opts as any);
            } catch (e) {
                console.error('[SignInModal] Failed to get sign-in options:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, [isOpen, clickRef]);

    const handleProviderClick = async (providerKey: string) => {
        if (!clickRef) return;
        setConnecting(providerKey);
        try {
            await clickRef.connect(providerKey);
            onClose();
        } catch (e) {
            console.error('[SignInModal] Connect failed:', e);
        } finally {
            setConnecting(null);
        }
    };

    const handleAccountClick = async (account: Account) => {
        if (!clickRef) return;
        setConnecting(account.public_key);
        try {
            await (clickRef as any).signInWithAccount(account);
            onClose();
        } catch (e) {
            console.error('[SignInModal] Sign in with account failed:', e);
            // Fallback to connect with provider
            try {
                await clickRef.connect(account.provider);
                onClose();
            } catch (e2) {
                console.error('[SignInModal] Fallback connect failed:', e2);
            }
        } finally {
            setConnecting(null);
        }
    };

    if (!isOpen) return null;

    const knownAccounts = options?.accounts || [];
    const providers = options?.providers || [];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm mx-4 bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <h2 className="text-lg font-semibold text-white">Connect Wallet</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
                        </div>
                    ) : (
                        <>
                            {/* Known accounts */}
                            {knownAccounts.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold px-1">
                                        Recent Accounts
                                    </p>
                                    {knownAccounts.map((account) => (
                                        <button
                                            key={account.public_key}
                                            onClick={() => handleAccountClick(account)}
                                            disabled={!!connecting}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-brand-500/30 transition-all group disabled:opacity-50"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center shrink-0">
                                                <Key className="w-4 h-4 text-brand-400" />
                                            </div>
                                            <div className="flex-1 text-left min-w-0">
                                                <p className="text-xs font-mono text-white truncate">
                                                    {account.public_key.slice(0, 8)}...{account.public_key.slice(-6)}
                                                </p>
                                                <p className="text-[10px] text-gray-500 capitalize">{account.provider.replace('-', ' ')}</p>
                                            </div>
                                            {connecting === account.public_key && (
                                                <Loader2 className="w-4 h-4 text-brand-400 animate-spin shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Providers */}
                            <div className="space-y-2">
                                {knownAccounts.length > 0 && (
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold px-1 mt-2">
                                        Or connect with
                                    </p>
                                )}
                                {providers.map((provider) => (
                                    <button
                                        key={provider.key}
                                        onClick={() => handleProviderClick(provider.key)}
                                        disabled={!!connecting}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-brand-500/30 transition-all group disabled:opacity-50"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                            <Wallet className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="text-sm font-medium text-white">{provider.text}</p>
                                            {provider.connected && (
                                                <p className="text-[10px] text-green-500">Detected</p>
                                            )}
                                        </div>
                                        {connecting === provider.key && (
                                            <Loader2 className="w-4 h-4 text-brand-400 animate-spin shrink-0" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-white/5 bg-white/[0.02]">
                    <p className="text-[10px] text-gray-600 text-center">
                        Powered by cspr.click
                    </p>
                </div>
            </div>
        </div>
    );
}
