import { useState, useEffect, useCallback } from 'react';
import { Transaction, PublicKey } from '../utils/casper';

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

    const getProvider = useCallback(() => {
        if (typeof window !== 'undefined' && 'CasperWalletProvider' in window) {
            // @ts-ignore
            return window.CasperWalletProvider();
        }
        return null;
    }, []);

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

        checkConnection();
        const interval = setInterval(checkConnection, 1000);

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
    }, [getProvider]);

    const connect = async (): Promise<boolean> => {
        const provider = getProvider();
        if (!provider) {
            alert('Casper Wallet extension not found! Please install it from https://casper.network/wallet');
            return false;
        }

        try {
            const connected = await provider.requestConnection();
            if (connected) {
                const activeKey = await provider.getActivePublicKey();
                setWalletState({
                    isConnected: true,
                    activeKey: activeKey,
                    isLocked: false,
                });
            }
            return connected;
        } catch (e) {
            console.error("Connection failed:", e);
            return false;
        }
    };

    const disconnect = async (): Promise<void> => {
        const provider = getProvider();
        if (provider) {
            await provider.disconnectFromSite();
            setWalletState({
                isConnected: false,
                activeKey: null,
                isLocked: false,
            });
        }
    };

    /**
     * Sign a transaction using the Casper Wallet
     * Uses SDK v5 Transaction API for wallet compatibility
     */
    const signTransaction = async (transaction: Transaction, signingPublicKeyHex: string): Promise<Transaction> => {
        const provider = getProvider();
        if (!provider) throw new Error("Wallet not connected");

        try {
            // Convert transaction to JSON string for wallet
            // Note: Transaction has toJSON method
            const transactionJson = transaction.toJSON();
            const transactionJsonString = JSON.stringify(transactionJson);

            console.log("Transaction JSON:", transactionJson);
            console.log("Signing with key:", signingPublicKeyHex);
            console.log("Provider methods:", Object.keys(provider));

            // Sign using wallet's sign method
            console.log("Requesting wallet signature...");
            const signResult = await provider.sign(transactionJsonString, signingPublicKeyHex);

            console.log("Sign result:", signResult);

            if (signResult.cancelled) {
                throw new Error("User cancelled the signing request");
            }

            // Apply signature to transaction (mutates in place)
            if (signResult.signature) {
                const publicKey = PublicKey.fromHex(signingPublicKeyHex);
                // setSignature modifies the transaction in place
                transaction.setSignature(signResult.signature, publicKey);
                return transaction;
            }

            throw new Error("No signature returned from wallet");

        } catch (e: any) {
            console.error("Signing failed:", e);
            throw new Error(`Signing failed: ${e.message || 'Unknown error'}`);
        }
    };

    return {
        ...walletState,
        connect,
        disconnect,
        signTransaction
    };
};
