import type { NextApiRequest, NextApiResponse } from 'next';

const NODE_URL = process.env.NEXT_PUBLIC_NODE_URL || 'https://node.testnet.casper.network/rpc';
const EXPLORER_API_URL = process.env.NEXT_PUBLIC_EXPLORER_API_URL || 'https://api.testnet.cspr.live';

// Simple in-memory cache: { url: { data, expiry } }
const cache = new Map<string, { data: any, expiry: number }>();
const CACHE_TTL_MS = 5000; // 5 seconds

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const { useExplorer, path } = req.query;
    let targetUrl = useExplorer ? `${EXPLORER_API_URL}${path || ''}` : NODE_URL;

    try {
        const fetchOptions: any = {
            method: req.method,
            headers: {
                'Accept': 'application/json',
            }
        };

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            fetchOptions.headers['Content-Type'] = 'application/json';
            const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            if (body && body !== '{}' && body !== '""') {
                fetchOptions.body = body;
            }
        }

        // Check cache for GET requests
        if (req.method === 'GET') {
            const cached = cache.get(targetUrl);
            if (cached && Date.now() < cached.expiry) {
                console.log(`[Proxy] CACHE HIT -> ${targetUrl}`);
                res.status(200).json(cached.data);
                return;
            }
        }

        console.log(`[Proxy] ${req.method} -> ${targetUrl}`);

        const response = await fetch(targetUrl, fetchOptions);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Proxy] Target ${targetUrl} returned ${response.status}: ${errorText.substring(0, 100)}`);
            res.status(response.status).json({
                error: `Target error: ${response.status}`,
                details: errorText.substring(0, 200)
            });
            return;
        }

        const data = await response.json();

        // Update cache for GET requests
        if (req.method === 'GET') {
            cache.set(targetUrl, {
                data,
                expiry: Date.now() + CACHE_TTL_MS
            });
        }

        res.status(200).json(data);
    } catch (error: any) {
        console.error("[Proxy] Unexpected Error:", error.message);
        res.status(500).json({
            error: 'Internal Proxy Error',
            message: error.message
        });
    }
}
