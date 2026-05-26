import { useState, useEffect, useCallback, useRef } from 'react';
import { Transaction, PublicKey, Deploy } from 'casper-js-sdk';
import { SigningLock } from '../utils/signingLock';
import { useCsprClick } from '../context/CsprClickContext';

// cspr.click event types (inline to avoid turbopack resolution issues)
interface ClickAccount {
    provider: string;
    public_key: string;
    balance?: string;
    liquid_balance?: string;
}
interface SignedInClickEvent { account: ClickAccount; }
interface SwitchedAccountClickEvent { account: ClickAccount; }
interface DisconnectedClickEvent { provider: string; }
interface UnsolicitedAccountChangeClickEvent { account: ClickAccount; }

export interface WalletState {
    isConnected: boolean;
    activeKey: string | null;
    isLocked: boolean;
    balance: string | null;
}

const motesToCspr = (motes: string | undefined): string | null => {
    if (!motes) return null;
    try {
        const cspr = parseInt(motes) / 1_000_000_000;
        return cspr.toFixed(2);
    } catch {
        return null;
    }
};

export const useWallet = () => {
    const clickRef = useCsprClick();

    const [walletState, setWalletState] = useState<WalletState>({
        isConnected: false,
        activeKey: null,
        isLocked: false,
        balance: null,
    });

    const connectedRef = useRef(false);

    const refreshBalance = useCallback(async () => {
        if (!clickRef || SigningLock.isLocked()) return;
        try {
            const account = await clickRef.getActiveAccountAsync({ withBalance: true });
            if (account?.liquid_balance || account?.balance) {
                const balance = motesToCspr(account.liquid_balance || account.balance);
                if (balance !== null) {
                    setWalletState(prev => ({ ...prev, balance }));
                }
            }
        } catch (e) {
            console.error('[useWallet] Failed to refresh balance', e);
        }
    }, [clickRef]);

    useEffect(() => {
        if (!clickRef) return;

        // Check if already signed in (e.g., persistent session on page reload)
        const existing = clickRef.getActiveAccount();
        if (existing?.public_key) {
            connectedRef.current = true;
            setWalletState({
                isConnected: true,
                activeKey: existing.public_key,
                isLocked: false,
                balance: motesToCspr(existing.liquid_balance || existing.balance),
            });
            refreshBalance();
        }

        const handleSignedIn = (evt: SignedInClickEvent) => {
            console.log('[useWallet] csprclick:signed_in', evt.account.public_key);
            connectedRef.current = true;
            setWalletState({
                isConnected: true,
                activeKey: evt.account.public_key,
                isLocked: false,
                balance: motesToCspr(evt.account.liquid_balance || evt.account.balance),
            });
            if (!evt.account.liquid_balance && !evt.account.balance) {
                refreshBalance();
            }
        };

        const handleSwitchedAccount = (evt: SwitchedAccountClickEvent) => {
            console.log('[useWallet] csprclick:switched_account', evt.account.public_key);
            if (!SigningLock.isLocked()) {
                setWalletState(prev => ({
                    ...prev,
                    activeKey: evt.account.public_key,
                    balance: motesToCspr(evt.account.liquid_balance || evt.account.balance),
                }));
                if (!evt.account.liquid_balance && !evt.account.balance) {
                    refreshBalance();
                }
            }
        };

        const handleUnsolicitedChange = (evt: UnsolicitedAccountChangeClickEvent) => {
            console.log('[useWallet] csprclick:unsolicited_account_change', evt.account.public_key);
            if (!SigningLock.isLocked()) {
                setWalletState(prev => ({
                    ...prev,
                    activeKey: evt.account.public_key,
                    balance: motesToCspr(evt.account.liquid_balance || evt.account.balance),
                }));
            }
        };

        const handleSignedOut = () => {
            console.log('[useWallet] csprclick:signed_out');
            connectedRef.current = false;
            setWalletState({ isConnected: false, activeKey: null, isLocked: false, balance: null });
        };

        const handleDisconnected = (evt: DisconnectedClickEvent) => {
            console.log('[useWallet] csprclick:disconnected', evt.provider);
            connectedRef.current = false;
            setWalletState({ isConnected: false, activeKey: null, isLocked: false, balance: null });
        };

        clickRef.on('csprclick:signed_in', handleSignedIn);
        clickRef.on('csprclick:switched_account', handleSwitchedAccount);
        clickRef.on('csprclick:unsolicited_account_change', handleUnsolicitedChange);
        clickRef.on('csprclick:signed_out', handleSignedOut);
        clickRef.on('csprclick:disconnected', handleDisconnected);

        // Balance polling fallback (30s)
        const balanceInterval = setInterval(() => {
            if (connectedRef.current && !SigningLock.isLocked()) {
                refreshBalance();
            }
        }, 30000);

        return () => {
            clickRef.off('csprclick:signed_in', handleSignedIn);
            clickRef.off('csprclick:switched_account', handleSwitchedAccount);
            clickRef.off('csprclick:unsolicited_account_change', handleUnsolicitedChange);
            clickRef.off('csprclick:signed_out', handleSignedOut);
            clickRef.off('csprclick:disconnected', handleDisconnected);
            clearInterval(balanceInterval);
        };
    }, [clickRef, refreshBalance]);

    const [signInModalOpen, setSignInModalOpen] = useState(false);

    const connect = useCallback(async (): Promise<boolean> => {
        if (!clickRef) {
            console.error('[useWallet] cspr.click SDK not initialized');
            return false;
        }
        setSignInModalOpen(true);
        return true;
    }, [clickRef]);

    const disconnect = useCallback(async (): Promise<void> => {
        if (!clickRef) return;
        clickRef.signOut();
    }, [clickRef]);

    const switchAccount = useCallback(async (): Promise<void> => {
        if (!clickRef) return;
        const account = clickRef.getActiveAccount();
        if (account?.provider) {
            try {
                await clickRef.switchAccount(account.provider);
            } catch (e) {
                console.error('[useWallet] switchAccount failed, falling back to modal:', e);
                setSignInModalOpen(true);
            }
        } else {
            setSignInModalOpen(true);
        }
    }, [clickRef]);

    const signTransaction = useCallback(async (
        transaction: Transaction | Deploy,
        signingPublicKeyHex: string
    ): Promise<Transaction | Deploy> => {
        if (!clickRef) throw new Error("cspr.click SDK not initialized");

        SigningLock.acquire();
        console.log('[useWallet] Signing started - pausing background requests');

        try {
            let deployJson: any;

            if (transaction instanceof Transaction) {
                deployJson = transaction.toJSON();
            } else {
                // Casper Wallet expects the legacy v1 Deploy JSON layout
                // (args as `[name, clvalue]` tuples). SDK v5's `Deploy.toJSON()`
                // emits v5 structure which the wallet validator rejects with
                // "arg not valid, got:undefined". `deployToLegacyJson` is the
                // existing in-repo helper that emits the format the wallet
                // already accepts via the RPC submit path.
                const { deployToLegacyJson } = await import('../utils/casper');
                deployJson = deployToLegacyJson(transaction);

                // HACK: Ensure version is null for StoredVersionedContractByHash if missing
                if (deployJson.session?.StoredVersionedContractByHash &&
                    deployJson.session.StoredVersionedContractByHash.version === undefined) {
                    console.log('[useWallet] Patching missing version in StoredVersionedContractByHash');
                    deployJson.session.StoredVersionedContractByHash.version = null;
                }
            }

            console.log('[useWallet] deployJson preview:', JSON.stringify(deployJson).slice(0, 400));

            console.log("Requesting cspr.click signature...");

            const signResult = await clickRef.sign(deployJson, signingPublicKeyHex);

            console.log("Sign result:", signResult);

            if (!signResult) {
                throw new Error("No sign result returned from cspr.click");
            }

            if (signResult.cancelled) {
                throw new Error("User cancelled the signing request");
            }

            if (signResult.error) {
                throw new Error(signResult.error);
            }

            // Extract signature — prefer Uint8Array, fall back to hex
            const rawSignature = signResult.signature ||
                (signResult.signatureHex
                    ? Uint8Array.from(Buffer.from(signResult.signatureHex, 'hex'))
                    : null);

            if (!rawSignature) {
                throw new Error("No signature returned from cspr.click");
            }

            const publicKey = PublicKey.fromHex(signingPublicKeyHex);

            // cspr.click may return algo-tagged (65 bytes: prefix + 64 raw) or raw (64 bytes).
            // Only add the key type prefix if the signature is raw (64 bytes).
            const keyTypeByte = parseInt(signingPublicKeyHex.substring(0, 2), 16);
            let prefixedSignature: Uint8Array;
            if (rawSignature.length === 64) {
                prefixedSignature = new Uint8Array([keyTypeByte, ...rawSignature]);
            } else {
                // Already algo-tagged (65 bytes) — use as-is
                prefixedSignature = rawSignature;
            }
            console.log('[signTransaction] Key type:', keyTypeByte, 'Raw sig length:', rawSignature.length, 'Final sig length:', prefixedSignature.length);

            if (transaction instanceof Transaction) {
                transaction.setSignature(prefixedSignature, publicKey);
                return transaction;
            } else {
                const signedDeploy = Deploy.setSignature(
                    transaction,
                    prefixedSignature,
                    publicKey
                );
                return signedDeploy;
            }
        } catch (e: any) {
            console.error("Signing failed:", e);
            throw new Error(`Signing failed: ${e.message || 'Unknown error'}`);
        } finally {
            SigningLock.release();
            console.log('[useWallet] Signing finished - resuming background requests');
        }
    }, [clickRef]);

    const closeSignInModal = useCallback(() => {
        setSignInModalOpen(false);
    }, []);

    return {
        ...walletState,
        connect,
        disconnect,
        switchAccount,
        signTransaction,
        signInModalOpen,
        closeSignInModal,
    };
};
