import { useState, useEffect } from 'react';

export interface WalletState {
    isConnected: boolean;
    activeKey: string | null;
    isLocked: boolean;
}

export const useWallet = () => {
    const [walletState, setWalletState] = useState<WalletState>({
        isConnected: false,
        activeKey: null,
        isLocked: false,
    });

    const getProvider = () => {
        if (typeof window !== 'undefined' && 'CasperWalletProvider' in window) {
            // @ts-ignore
            return window.CasperWalletProvider();
        }
        return null;
    };

    useEffect(() => {
        const checkConnection = async () => {
            const provider = getProvider();

            if (provider) {
                try {
                    const isConnected = await provider.isConnected();
                    if (isConnected) {
                        const activeKey = await provider.getActivePublicKey();
                        setWalletState({
                            isConnected: true,
                            activeKey: activeKey,
                            isLocked: false,
                        });
                    }
                } catch (e) {
                    console.error("Error checking wallet connection:", e);
                }
            }
        };

        // Initial check
        checkConnection();

        // Poll for provider (common fix for injection latency)
        const interval = setInterval(checkConnection, 1000);

        // Listen for events
        const handleActiveKeyChanged = (event: any) => {
            console.log("Active key changed:", event.detail);
            checkConnection();
        };

        const handleDisconnected = () => {
            setWalletState(prev => ({ ...prev, isConnected: false, activeKey: null }));
        };

        const handleConnected = () => {
            checkConnection();
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('casper-wallet:activeKeyChanged', handleActiveKeyChanged);
            window.addEventListener('casper-wallet:disconnected', handleDisconnected);
            window.addEventListener('casper-wallet:connected', handleConnected);
        }

        return () => {
            clearInterval(interval);
            if (typeof window !== 'undefined') {
                window.removeEventListener('casper-wallet:activeKeyChanged', handleActiveKeyChanged);
                window.removeEventListener('casper-wallet:disconnected', handleDisconnected);
                window.removeEventListener('casper-wallet:connected', handleConnected);
            }
        };
    }, []);

    const connect = async () => {
        const provider = getProvider();
        if (!provider) {
            alert("Casper Wallet extension not found! Please install it.");
            window.open('https://www.casperwallet.io/', '_blank');
            return;
        }

        try {
            await provider.requestConnection();
            const activeKey = await provider.getActivePublicKey();
            setWalletState({
                isConnected: true,
                activeKey: activeKey,
                isLocked: false,
            });
        } catch (e) {
            console.error("Connection failed:", e);
        }
    };

    const signDeploy = async (deployJson: any, activeKey: string) => {
        const provider = getProvider();
        if (!provider) throw new Error("Wallet not connected");

        return await provider.sign(JSON.stringify(deployJson), activeKey);
    };

    return {
        ...walletState,
        connect,
        signDeploy
    };
};
