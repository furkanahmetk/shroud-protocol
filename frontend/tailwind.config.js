/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-inter)', 'sans-serif'],
            },
            colors: {
                brand: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#3b82f6', // Electric Blue
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                    950: '#0f172a', // Deep Navy
                },
                accent: {
                    500: '#8b5cf6', // Violet
                    600: '#7c3aed',
                },
                dark: {
                    bg: '#030712', // Rich Black
                    card: '#111827', // Gray 900
                    border: '#1f2937', // Gray 800
                }
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'hero-glow': 'conic-gradient(from 180deg at 50% 50%, #2a8af6 0deg, #a853ba 180deg, #e92a67 360deg)',
                'mesh-dark': 'radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.15) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(139, 92, 246, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(59, 130, 246, 0.1) 0px, transparent 50%), radial-gradient(at 0% 100%, rgba(139, 92, 246, 0.1) 0px, transparent 50%)',
            },
            animation: {
                'fade-in': 'fadeIn 0.8s ease-out',
                'slide-up': 'slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                'float': 'float 6s ease-in-out infinite',
                'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'glow': 'glow 2s ease-in-out infinite alternate',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                glow: {
                    'from': { boxShadow: '0 0 10px -10px rgba(59, 130, 246, 0)' },
                    'to': { boxShadow: '0 0 20px 5px rgba(59, 130, 246, 0.3)' },
                }
            },
            boxShadow: {
                'glow': '0 0 40px -10px rgba(59, 130, 246, 0.3)',
                'glass': '0 8px 30px rgba(0, 0, 0, 0.3)',
                'neon': '0 0 10px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3)',
            }
        },
    },
    plugins: [],
}
