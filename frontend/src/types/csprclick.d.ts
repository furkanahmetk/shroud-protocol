// Window augmentation for cspr.click CDN SDK
interface Window {
    csprclick: CsprClickSDK;
    csprClickSDKAsyncInit: () => void;
}

// SDK instance
interface CsprClickSDK {
    init(options: CsprClickInitOptions): void;
    on(event: string, handler: (...args: any[]) => void): void;
    once(event: string, handler: (...args: any[]) => void): void;
    off(event: string, handler: (...args: any[]) => void): void;
    sign(deployJson: any, publicKeyHex: string): Promise<CsprClickSignResult>;
    signOut(): void;
    connect(providerKey: string): Promise<void>;
    switchAccount(provider: string): Promise<void>;
    getActiveAccount(): CsprClickAccount | null;
    getActiveAccountAsync(opts?: { withBalance?: boolean }): Promise<CsprClickAccount | null>;
    getSignInOptions(includeAccounts?: boolean): Promise<CsprClickSignInOptions>;
}

interface CsprClickInitOptions {
    appName: string;
    appId: string;
    contentMode: 'iframe' | 'popup';
    providers: string[];
    chainName: 'casper' | 'casper-test';
}

interface CsprClickAccount {
    provider: string;
    public_key: string;
    balance?: string;
    liquid_balance?: string;
    connected_at?: number;
}

interface CsprClickSignResult {
    cancelled: boolean;
    signature: Uint8Array | null;
    signatureHex: string | null;
    deploy: any | null;
    error: string | null;
}

interface CsprClickSignInOptions {
    providers: Array<{ key: string; text: string; icon: string; connected: boolean }>;
    accounts: Array<CsprClickAccount>;
}
