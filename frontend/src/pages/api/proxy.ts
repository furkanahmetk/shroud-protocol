import type { NextApiRequest, NextApiResponse } from 'next';

// cspr.cloud-only data proxy. The legacy explorer fallback was deprecated per
// ROADMAP.md:16-19; see CHANGELOG entry "Deprecate Legacy Explorer Fallback".

type ExplorerPathKind = 'transfers' | 'deploy';

const NODE_RPC_URL =
    process.env.CASPER_NODE_RPC_URL ||
    process.env.NEXT_PUBLIC_NODE_URL ||
    'https://node.testnet.casper.network/rpc';
const CSPR_CLOUD_REST_BASE_URL =
    process.env.CSPR_CLOUD_REST_BASE_URL || 'https://api.testnet.cspr.cloud';
const CSPR_CLOUD_API_TOKEN = process.env.CSPR_CLOUD_API_TOKEN || '';

const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 5_000;

function getCloudAuthHeaderValue(): string {
    if (!CSPR_CLOUD_API_TOKEN) return '';
    // Casper Cloud expects raw key in Authorization header (no Bearer prefix).
    return CSPR_CLOUD_API_TOKEN.trim().replace(/^bearer\s+/i, '');
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeErrorText(text: string | undefined): string {
    if (!text) return 'request_failed';
    let safe = text;

    if (CSPR_CLOUD_API_TOKEN) {
        const rawToken = CSPR_CLOUD_API_TOKEN.trim().replace(/^bearer\s+/i, '');
        if (rawToken) {
            safe = safe.replace(new RegExp(escapeRegExp(rawToken), 'gi'), '[REDACTED]');
        }
    }
    safe = safe.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]');
    safe = safe.replace(/Authorization:\s*[^\s"']+/gi, 'Authorization: [REDACTED]');

    return safe.substring(0, 300);
}

function parsePathInput(pathQuery: string | string[] | undefined): string | null {
    if (!pathQuery) return null;
    const value = Array.isArray(pathQuery) ? pathQuery[0] : pathQuery;
    if (!value || typeof value !== 'string') return null;
    if (/^https?:\/\//i.test(value)) return null;
    return value.startsWith('/') ? value : `/${value}`;
}

function parseRelativeUrl(path: string): URL {
    return new URL(path, 'http://local-proxy');
}

function classifyExplorerPath(path: string): ExplorerPathKind | null {
    const url = parseRelativeUrl(path);
    const pathname = url.pathname;
    if (/^\/(purses|purse-urefs)\/[^/]+\/transfers$/i.test(pathname)) return 'transfers';
    if (/^\/deploys\/[^/]+$/i.test(pathname)) return 'deploy';
    return null;
}

function mapPathForCloud(path: string): string {
    const url = parseRelativeUrl(path);
    const pathname = url.pathname;

    // cspr.cloud uses /purse-urefs/{uref}/transfers; rewrite legacy-style /purses/...
    if (/^\/purses\/[^/]+\/transfers$/i.test(pathname)) {
        const purse = pathname.split('/')[2];
        url.pathname = `/purse-urefs/${purse}/transfers`;
    }

    // cspr.cloud accepts `limit` rather than `page_size`.
    if (url.searchParams.has('page_size') && !url.searchParams.has('limit')) {
        url.searchParams.set('limit', url.searchParams.get('page_size') || '100');
        url.searchParams.delete('page_size');
    }

    return `${url.pathname}${url.search}`;
}

function extractArray(payload: any): any[] {
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.result?.data)) return payload.result.data;
    if (Array.isArray(payload)) return payload;
    return [];
}

function extractObject(payload: any): any {
    if (payload?.data && typeof payload.data === 'object') return payload.data;
    if (payload?.deploy && typeof payload.deploy === 'object') return payload.deploy;
    if (payload?.result?.deploy && typeof payload.result.deploy === 'object') return payload.result.deploy;
    if (payload?.result && typeof payload.result === 'object') return payload.result;
    return payload;
}

function toNumber(value: any, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTransferItem(item: any): any {
    const deployHash =
        item?.deploy_hash ??
        item?.deployHash ??
        item?.deploy?.hash ??
        item?.hash ??
        null;
    return {
        ...item,
        deploy_hash: deployHash ? String(deployHash) : '',
        timestamp: item?.timestamp ?? item?.created_at ?? item?.createdAt ?? null,
        block_height: toNumber(item?.block_height ?? item?.blockHeight ?? item?.block?.height ?? 0),
        from_purse: item?.from_purse ?? item?.fromPurse ?? item?.from?.purse ?? null,
        to_purse: item?.to_purse ?? item?.toPurse ?? item?.to?.purse ?? null
    };
}

function normalizeStatus(deploy: any): string {
    const status = deploy?.status ?? deploy?.execution_result?.status ?? deploy?.executionResult?.status;
    if (!status) return 'unknown';
    if (typeof status === 'string') {
        const lowered = status.toLowerCase();
        if (lowered === 'success' || lowered === 'processed' || lowered === 'succeeded') return 'processed';
        if (lowered === 'failure' || lowered === 'failed') return 'failed';
        return lowered;
    }
    if (status.Success || status.success) return 'processed';
    if (status.Failure || status.failure) return 'failed';
    return 'unknown';
}

function normalizeDeployItem(item: any): any {
    const args =
        item?.args ??
        item?.session?.args ??
        item?.session?.StoredContractByHash?.args ??
        item?.session?.StoredVersionedContractByHash?.args ??
        null;

    const errorMessage =
        item?.error_message ??
        item?.errorMessage ??
        item?.execution_result?.error_message ??
        item?.executionResult?.errorMessage ??
        item?.error?.message ??
        null;

    return {
        ...item,
        deploy_hash: item?.deploy_hash ?? item?.deployHash ?? item?.hash ?? null,
        status: normalizeStatus(item),
        error_message: errorMessage,
        args,
        entry_point:
            item?.entry_point ??
            item?.entryPoint ??
            item?.session?.StoredVersionedContractByHash?.entry_point ??
            item?.session?.StoredContractByHash?.entry_point ??
            null,
        timestamp: item?.timestamp ?? item?.created_at ?? item?.createdAt ?? null,
        caller_public_key: item?.caller_public_key ?? item?.callerPublicKey ?? null,
        cost: item?.cost ?? item?.execution_result?.cost ?? item?.executionResult?.cost ?? null
    };
}

function normalizeExplorerResponse(kind: ExplorerPathKind, payload: any): any {
    if (kind === 'transfers') {
        const rows = extractArray(payload).map(normalizeTransferItem);
        return { data: rows };
    }
    if (kind === 'deploy') {
        const deploy = extractObject(payload);
        return { data: normalizeDeployItem(deploy) };
    }
    return payload;
}

function buildCacheKey(method: string, path: string): string {
    return `${method.toUpperCase()}:cloud:${path}`;
}

async function fetchCloud(
    path: string,
    method: string
): Promise<{ ok: boolean; status: number; data?: any; errorText?: string; latencyMs: number; targetUrl: string }> {
    const mappedPath = mapPathForCloud(path);
    const targetUrl = `${CSPR_CLOUD_REST_BASE_URL}${mappedPath}`;
    const startedAt = Date.now();

    const headers: Record<string, string> = { Accept: 'application/json' };
    const auth = getCloudAuthHeaderValue();
    if (auth) headers.Authorization = auth;

    try {
        const response = await fetch(targetUrl, { method, headers });
        const elapsed = Date.now() - startedAt;
        if (!response.ok) {
            const text = await response.text();
            return {
                ok: false,
                status: response.status,
                errorText: sanitizeErrorText(text),
                latencyMs: elapsed,
                targetUrl
            };
        }
        const data = await response.json();
        return { ok: true, status: response.status, data, latencyMs: elapsed, targetUrl };
    } catch (error: any) {
        return {
            ok: false,
            status: 0,
            errorText: error?.message || 'network_error',
            latencyMs: Date.now() - startedAt,
            targetUrl
        };
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { useExplorer, path } = req.query;

    try {
        if (useExplorer) {
            if (req.method !== 'GET') {
                res.status(405).json({ error: 'Method Not Allowed', message: 'Explorer proxy supports GET only.' });
                return;
            }
            if (!CSPR_CLOUD_API_TOKEN) {
                res.status(500).json({
                    error: 'Server Misconfiguration',
                    details: 'CSPR_CLOUD_API_TOKEN is required (set in .env).'
                });
                return;
            }

            const requestedPath = parsePathInput(path);
            if (!requestedPath) {
                res.status(400).json({ error: 'Bad Request', message: 'Missing or invalid explorer path.' });
                return;
            }

            const kind = classifyExplorerPath(requestedPath);
            if (!kind) {
                res.status(400).json({ error: 'Bad Request', message: 'Path is not allowed by proxy policy.' });
                return;
            }

            const mappedPath = mapPathForCloud(requestedPath);
            const method = (req.method || 'GET').toUpperCase();
            const cacheKey = buildCacheKey(method, mappedPath);

            if (method === 'GET') {
                const cached = cache.get(cacheKey);
                if (cached && Date.now() < cached.expiry) {
                    res.setHeader('x-shroud-data-source', 'cloud');
                    res.setHeader('x-shroud-cache', 'hit');
                    res.status(200).json(cached.data);
                    return;
                }
            }

            const result = await fetchCloud(requestedPath, method);
            if (!result.ok) {
                console.warn(
                    `[Proxy] cloud status=${result.status} latency=${result.latencyMs}ms path=${result.targetUrl}`
                );
                res.status(result.status || 502).json({
                    error: 'Cloud target error',
                    status: result.status || 502,
                    details: result.errorText || 'request_failed'
                });
                return;
            }

            const normalized = normalizeExplorerResponse(kind, result.data);
            if (method === 'GET') {
                cache.set(cacheKey, {
                    data: normalized,
                    expiry: Date.now() + CACHE_TTL_MS
                });
            }

            console.log(
                `[Proxy] cloud status=${result.status} latency=${result.latencyMs}ms path=${result.targetUrl}`
            );

            res.setHeader('x-shroud-data-source', 'cloud');
            res.status(200).json(normalized);
            return;
        }

        // RPC pass-through (POST → casper node)
        const fetchOptions: any = {
            method: req.method,
            headers: { Accept: 'application/json' }
        };

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            fetchOptions.headers['Content-Type'] = 'application/json';
            const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            if (body && body !== '{}' && body !== '""') {
                fetchOptions.body = body;
            }
        }

        const response = await fetch(NODE_RPC_URL, fetchOptions);

        if (!response.ok) {
            const errorText = await response.text();
            res.status(response.status).json({
                error: `Target error: ${response.status}`,
                details: errorText.substring(0, 200)
            });
            return;
        }

        const data = await response.json();
        res.status(200).json(data);
    } catch (error: any) {
        console.error('[Proxy] Unexpected Error:', error.message);
        res.status(500).json({
            error: 'Internal Proxy Error',
            message: error.message
        });
    }
}
