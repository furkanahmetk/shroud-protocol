import React from 'react'
import '@/styles/globals.css'
import '@fontsource/inter/index.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { CommitmentProvider } from '../context/CommitmentContext'

import dynamic from 'next/dynamic'

const CsprClickWrapper = dynamic(
    () => import('../components/CsprClickWrapper'),
    { ssr: false }
)

export default function App({ Component, pageProps }: AppProps) {
    return (
        <>
            <Head>
                <link rel="icon" href="/favicon.ico" sizes="any" />
                <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
                <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
                <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
            </Head>
            <main className="font-sans">
                <CommitmentProvider>
                    <CsprClickWrapper>
                        <Component {...pageProps} />
                    </CsprClickWrapper>
                </CommitmentProvider>
            </main>
        </>
    )
}
