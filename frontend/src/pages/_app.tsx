import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { Inter } from 'next/font/google'
import { CommitmentProvider } from '../context/CommitmentContext'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export default function App({ Component, pageProps }: AppProps) {
    return (
        <main className={`${inter.variable} font-sans`}>
            <CommitmentProvider>
                <Component {...pageProps} />
            </CommitmentProvider>
        </main>
    )
}
