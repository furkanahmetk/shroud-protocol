import { useState, useEffect, useCallback } from 'react';
import { Transaction, PublicKey, Deploy, getBalance } from '../utils/casper';

export interface WalletState {
    isConnected: boolean;
    activeKey: string | null;
    isLocked: boolean;
    balance: string | null;
}

export const useWallet = () => {
    const [walletState, setWalletState] = useState<WalletState>({
        isConnected: false,
        activeKey: null,
        isLocked: false,
        balance: null,
    });

    const getProvider = useCallback(() => {
        if (typeof window !== 'undefined' && 'CasperWalletProvider' in window) {
            // @ts-ignore
            return window.CasperWalletProvider();
        }
        return null;
    }, []);

    const updateBalance = useCallback(async (activeKey: string) => {
        try {
            const balance = await getBalance(activeKey);
            setWalletState(prev => ({ ...prev, balance }));
        } catch (e) {
            console.error("Failed to update balance", e);
        }
    }, []);

    useEffect(() => {
        const checkConnection = async () => {
            const provider = getProvider();

            if (provider) {
                try {
                    const isConnected = await provider.isConnected();
                    if (isConnected) {
                        const activeKey = await provider.getActivePublicKey();

                        // Check if we need to update balance (if key changed or balance is null)
                        const shouldUpdateBalance = activeKey !== walletState.activeKey || walletState.balance === null;

                        setWalletState(prev => ({
                            ...prev,
                            isConnected: true,
                            activeKey: activeKey,
                            isLocked: false,
                        }));

                        if (shouldUpdateBalance) {
                            updateBalance(activeKey);
                        }
                    } else {
                        setWalletState(prev => ({
                            ...prev,
                            isConnected: false,
                            activeKey: null,
                            balance: null
                        }));
                    }
                } catch (e) {
                    console.error("Error checking wallet connection:", e);
                }
            }
        };

        checkConnection();
        const interval = setInterval(checkConnection, 5000); // Check every 5s

        const handleActiveKeyChanged = (event: any) => {
            console.log("Active key changed:", event.detail);
            checkConnection();
        };

        const handleDisconnected = () => {
            setWalletState(prev => ({ ...prev, isConnected: false, activeKey: null, balance: null }));
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
    }, [getProvider, updateBalance]); // removed walletState from deps to avoid infinite loop

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
                    balance: null // will trigger update in effect
                });
                await updateBalance(activeKey);
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
                balance: null
            });
        }
    };

    /**
     * Sign a transaction using the Casper Wallet
     * Supports both SDK v5 Transaction and Legacy Deploy
     */
    const signTransaction = async (transaction: Transaction | Deploy, signingPublicKeyHex: string): Promise<Transaction | Deploy> => {
        const provider = getProvider();
        if (!provider) throw new Error("Wallet not connected");

        try {
            let transactionJsonString: string;

            if (transaction instanceof Transaction) {
                const transactionJson = transaction.toJSON();
                transactionJsonString = JSON.stringify(transactionJson);
            } else {
                // Legacy Deploy - use SDK's built-in toJSON method
                const deployJson = Deploy.toJSON(transaction);
                transactionJsonString = JSON.stringify(deployJson);
            }

            console.log("Requesting wallet signature with:", transactionJsonString);

            // @ts-ignore - The types might be slightly off for the provider
            const signResult = await provider.sign(transactionJsonString, signingPublicKeyHex);

            console.log("Sign result:", signResult);

            if (signResult.cancelled) {
                throw new Error("User cancelled the signing request");
            }

            // Apply signature
            if (signResult.signature) {
                const publicKey = PublicKey.fromHex(signingPublicKeyHex);

                // The signature needs to be prefixed with the key type byte
                // Key type is the first byte of the public key hex: 01 = Ed25519, 02 = Secp256k1
                const keyTypeByte = parseInt(signingPublicKeyHex.substring(0, 2), 16);
                const prefixedSignature = new Uint8Array([keyTypeByte, ...signResult.signature]);
                console.log('[signTransaction] Key type:', keyTypeByte, 'Signature length:', signResult.signature.length);

                if (transaction instanceof Transaction) {
                    transaction.setSignature(prefixedSignature, publicKey);
                    return transaction;
                } else {
                    // Legacy Deploy signing - use Deploy.setSignature static method
                    const signedDeploy = Deploy.setSignature(
                        transaction,
                        prefixedSignature,
                        publicKey
                    );
                    return signedDeploy;
                }
            }

            throw new Error("No signature returned from wallet");

        } catch (e: any) {
            console.error("Signing failed:", e);
            console.dir(e);
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
