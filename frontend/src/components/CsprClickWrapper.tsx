import React, { useEffect, useState } from 'react';
import { CsprClickContext } from '../context/CsprClickContext';

const SDK_URL = 'https://cdn.cspr.click/latest/csprclick-sdk-2.0.js';

const clickOptions = {
    appName: process.env.NEXT_PUBLIC_CSPRCLICK_APP_NAME || 'Shroud Protocol',
    appId: process.env.NEXT_PUBLIC_CSPRCLICK_APP_ID || 'csprclick-template',
    contentMode: 'iframe' as const,
    providers: ['casper-wallet', 'ledger', 'metamask-snap'],
    chainName: process.env.NEXT_PUBLIC_NETWORK_NAME === 'casper' ? 'casper' : 'casper-test',
};

export default function CsprClickWrapper({ children }: { children: React.ReactNode }) {
    const [clickRef, setClickRef] = useState<any>(null);

    useEffect(() => {
        // If SDK already loaded (e.g., HMR / fast refresh)
        if (window.csprclick) {
            console.log('[CsprClickWrapper] SDK already available');
            setClickRef(window.csprclick);
            return;
        }

        // Set up the async init callback the SDK calls when loaded
        window.csprClickSDKAsyncInit = () => {
            console.log('[CsprClickWrapper] csprClickSDKAsyncInit fired');
            if (window.csprclick) {
                window.csprclick.once('csprclick:loaded', () => {
                    console.log('[CsprClickWrapper] csprclick:loaded event');
                    setClickRef(window.csprclick);
                });
                window.csprclick.init(clickOptions);
            }
        };

        // Inject SDK script
        if (!document.getElementById('csprclick-sdk')) {
            const script = document.createElement('script');
            script.id = 'csprclick-sdk';
            script.src = SDK_URL;
            script.async = true;
            document.head.appendChild(script);
            console.log('[CsprClickWrapper] SDK script injected');
        }
    }, []);

    return (
        <CsprClickContext.Provider value={clickRef}>
            {children}
        </CsprClickContext.Provider>
    );
}
