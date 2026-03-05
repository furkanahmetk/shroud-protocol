import type { NextApiRequest, NextApiResponse } from 'next';

type DataSource = 'cloud' | 'legacy';
type DataSourceMode = 'hybrid' | 'cloud-only' | 'legacy-only';
type ExplorerPathKind = 'transfers' | 'deploy';

const NODE_RPC_URL =
    process.env.CASPER_NODE_RPC_URL ||
    process.env.NEXT_PUBLIC_NODE_URL ||
    'https://node.testnet.casper.network/rpc';
const CSPR_CLOUD_REST_BASE_URL =
    process.env.CSPR_CLOUD_REST_BASE_URL || 'https://api.testnet.cspr.cloud';
const LEGACY_EXPLORER_API_URL =
    process.env.LEGACY_EXPLORER_API_URL ||
    process.env.NEXT_PUBLIC_EXPLORER_API_URL ||
    'https://api.testnet.cspr.live';
const CSPR_DATA_SOURCE_MODE: DataSourceMode =
    process.env.CSPR_DATA_SOURCE_MODE === 'cloud-only' ||
    process.env.CSPR_DATA_SOURCE_MODE === 'legacy-only' ||
    process.env.CSPR_DATA_SOURCE_MODE === 'hybrid'
        ? process.env.CSPR_DATA_SOURCE_MODE
        : 'hybrid';
const CSPR_CLOUD_API_TOKEN = process.env.CSPR_CLOUD_API_TOKEN || '';

const cache = new Map<string, { data: any; expiry: number; source: DataSource }>();
const CACHE_TTL_MS = 5_000;

function getCloudAuthHeaderValue(): string {
    if (!CSPR_CLOUD_API_TOKEN) return '';
    // Casper Cloud expects raw key in Authorization header (no Bearer prefix).
    return CSPR_CLOUD_API_TOKEN.trim().replace(/^bearer\s+/i, '');
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeErrorText(source: DataSource, text: string | undefined): string {
    if (!text) return 'request_failed';
    let safe = text;

    if (source === 'cloud') {
        if (CSPR_CLOUD_API_TOKEN) {
            const rawToken = CSPR_CLOUD_API_TOKEN.trim().replace(/^bearer\s+/i, '');
            if (rawToken) {
                safe = safe.replace(new RegExp(escapeRegExp(rawToken), 'gi'), '[REDACTED]');
            }
        }
        safe = safe.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]');
        safe = safe.replace(/Authorization:\s*[^\s"']+/gi, 'Authorization: [REDACTED]');
    }

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

function mapPathForSource(path: string, source: DataSource): string {
    const url = parseRelativeUrl(path);
    const pathname = url.pathname;

    if (source === 'cloud' && /^\/purses\/[^/]+\/transfers$/i.test(pathname)) {
        const purse = pathname.split('/')[2];
        url.pathname = `/purse-urefs/${purse}/transfers`;
    }

    if (source === 'legacy' && /^\/purse-urefs\/[^/]+\/transfers$/i.test(pathname)) {
        const purse = pathname.split('/')[2];
        url.pathname = `/purses/${purse}/transfers`;
    }

    // Compatibility mapping across providers.
    if (source === 'cloud' && url.searchParams.has('page_size') && !url.searchParams.has('limit')) {
        url.searchParams.set('limit', url.searchParams.get('page_size') || '100');
        url.searchParams.delete('page_size');
    }
    if (source === 'legacy' && url.searchParams.has('limit') && !url.searchParams.has('page_size')) {
        url.searchParams.set('page_size', url.searchParams.get('limit') || '100');
        url.searchParams.delete('limit');
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

function explorerSourcesByMode(mode: DataSourceMode): DataSource[] {
    if (mode === 'legacy-only') return ['legacy'];
    if (mode === 'cloud-only') return ['cloud'];
    return ['cloud', 'legacy'];
}

function baseUrlForSource(source: DataSource): string {
    return source === 'cloud' ? CSPR_CLOUD_REST_BASE_URL : LEGACY_EXPLORER_API_URL;
}

function shouldUseFallback(mode: DataSourceMode, currentSource: DataSource): boolean {
    return mode === 'hybrid' && currentSource === 'cloud';
}

function buildCacheKey(source: DataSource, method: string, path: string): string {
    return `${method.toUpperCase()}:${source}:${path}`;
}

async function fetchExplorerFromSource(
    source: DataSource,
    path: string,
    method: string
): Promise<{ ok: boolean; status: number; data?: any; errorText?: string; latencyMs: number; targetUrl: string }> {
    const mappedPath = mapPathForSource(path, source);
    const targetUrl = `${baseUrlForSource(source)}${mappedPath}`;
    const startedAt = Date.now();

    const headers: Record<string, string> = {
        Accept: 'application/json'
    };
    if (source === 'cloud') {
        const auth = getCloudAuthHeaderValue();
        if (auth) headers.Authorization = auth;
    }

    try {
        const response = await fetch(targetUrl, { method, headers });
        const elapsed = Date.now() - startedAt;
        if (!response.ok) {
            const text = await response.text();
            return {
                ok: false,
                status: response.status,
                errorText: sanitizeErrorText(source, text),
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

function setSourceResponseHeaders(res: NextApiResponse, source: DataSource, fallbackUsed: boolean) {
    res.setHeader('x-shroud-data-source', source);
    res.setHeader('x-shroud-fallback-used', String(fallbackUsed));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { useExplorer, path } = req.query;

    try {
        if (useExplorer) {
            if (req.method !== 'GET') {
                res.status(405).json({ error: 'Method Not Allowed', message: 'Explorer proxy supports GET only.' });
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

            const sources = explorerSourcesByMode(CSPR_DATA_SOURCE_MODE);
            let fallbackUsed = false;
            const sourceErrors: Array<{ source: DataSource; status: number; details: string }> = [];

            for (const source of sources) {
                if (source === 'cloud' && !CSPR_CLOUD_API_TOKEN) {
                    if (shouldUseFallback(CSPR_DATA_SOURCE_MODE, source)) {
                        fallbackUsed = true;
                        sourceErrors.push({ source, status: 0, details: 'CSPR_CLOUD_API_TOKEN is missing' });
                        continue;
                    }
                    res.status(500).json({
                        error: 'Server Misconfiguration',
                        source,
                        details: 'CSPR_CLOUD_API_TOKEN is required for cloud data source mode.'
                    });
                    return;
                }

                const mappedPath = mapPathForSource(requestedPath, source);
                const method = (req.method || 'GET').toUpperCase();
                const cacheKey = buildCacheKey(source, method, mappedPath);

                if (method === 'GET') {
                    const cached = cache.get(cacheKey);
                    if (cached && Date.now() < cached.expiry) {
                        console.log(`[Proxy] CACHE HIT source=${cached.source} path=${mappedPath}`);
                        setSourceResponseHeaders(res, cached.source, fallbackUsed);
                        res.status(200).json(cached.data);
                        return;
                    }
                }

                const result = await fetchExplorerFromSource(source, requestedPath, method);
                const isFallback = shouldUseFallback(CSPR_DATA_SOURCE_MODE, source);

                if (!result.ok) {
                    sourceErrors.push({
                        source,
                        status: result.status,
                        details: result.errorText || 'request_failed'
                    });

                    console.warn(
                        `[Proxy] source=${source} status=${result.status} latency=${result.latencyMs}ms path=${result.targetUrl}`
                    );

                    if (isFallback) {
                        fallbackUsed = true;
                        continue;
                    }

                    res.status(result.status || 502).json({
                        error: 'Target error',
                        source,
                        status: result.status || 502,
                        details: result.errorText || 'request_failed'
                    });
                    return;
                }

                const normalized = normalizeExplorerResponse(kind, result.data);
                if (method === 'GET') {
                    cache.set(cacheKey, {
                        data: normalized,
                        expiry: Date.now() + CACHE_TTL_MS,
                        source
                    });
                }

                console.log(
                    `[Proxy] source=${source} fallback=${fallbackUsed} status=${result.status} latency=${result.latencyMs}ms path=${result.targetUrl}`
                );

                setSourceResponseHeaders(res, source, fallbackUsed);
                res.status(200).json(normalized);
                return;
            }

            res.status(502).json({
                error: 'Explorer upstream unavailable',
                source: CSPR_DATA_SOURCE_MODE,
                details: sourceErrors
            });
            return;
        }

        const fetchOptions: any = {
            method: req.method,
            headers: {
                Accept: 'application/json'
            }
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
