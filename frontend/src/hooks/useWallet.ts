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

    useEffect(() => {
        const checkConnection = async () => {
            // @ts-ignore
            const provider = window.CasperWalletProvider;
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

        checkConnection();
        // Listen for events if supported by the provider
        // window.addEventListener('casper-wallet:activeKeyChanged', ...);
    }, []);

    const connect = async () => {
        // @ts-ignore
        const provider = window.CasperWalletProvider;
        if (!provider) {
            alert("Casper Wallet extension not found! Please install it.");
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
        // @ts-ignore
        const provider = window.CasperWalletProvider;
        if (!provider) throw new Error("Wallet not connected");

        return await provider.sign(JSON.stringify(deployJson), activeKey);
    };

    return {
        ...walletState,
        connect,
        signDeploy
    };
};
