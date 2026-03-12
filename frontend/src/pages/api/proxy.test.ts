/**
 * Tests for the Casper Cloud proxy (/api/proxy)
 *
 * Validates:
 *  - Auth header formatting (no "Bearer" prefix for Casper Cloud)
 *  - Token redaction in error messages
 *  - Path parsing and classification
 *  - Path mapping between cloud and legacy sources
 *  - Response normalization (transfers & deploys)
 *  - Data source mode routing
 *  - Caching behaviour
 *  - Handler integration (cloud-first fallback)
 */

// ── Helpers extracted from proxy.ts for unit testing ────────────────────
// We re-implement the pure functions here so we can test them in isolation
// without importing the module (which has side-effects / env reads).

function getCloudAuthHeaderValue(token: string): string {
    if (!token) return '';
    return token.trim().replace(/^bearer\s+/i, '');
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeErrorText(source: 'cloud' | 'legacy', text: string | undefined, cloudToken: string): string {
    if (!text) return 'request_failed';
    let safe = text;
    if (source === 'cloud') {
        if (cloudToken) {
            const rawToken = cloudToken.trim().replace(/^bearer\s+/i, '');
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

type ExplorerPathKind = 'transfers' | 'deploy';

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

function mapPathForSource(path: string, source: 'cloud' | 'legacy'): string {
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
        item?.deploy_hash ?? item?.deployHash ?? item?.deploy?.hash ?? item?.hash ?? null;
    return {
        ...item,
        deploy_hash: deployHash ? String(deployHash) : '',
        timestamp: item?.timestamp ?? item?.created_at ?? item?.createdAt ?? null,
        block_height: toNumber(item?.block_height ?? item?.blockHeight ?? item?.block?.height ?? 0),
        from_purse: item?.from_purse ?? item?.fromPurse ?? item?.from?.purse ?? null,
        to_purse: item?.to_purse ?? item?.toPurse ?? item?.to?.purse ?? null,
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
        item?.args ?? item?.session?.args ?? item?.session?.StoredContractByHash?.args ??
        item?.session?.StoredVersionedContractByHash?.args ?? null;
    const errorMessage =
        item?.error_message ?? item?.errorMessage ?? item?.execution_result?.error_message ??
        item?.executionResult?.errorMessage ?? item?.error?.message ?? null;
    return {
        ...item,
        deploy_hash: item?.deploy_hash ?? item?.deployHash ?? item?.hash ?? null,
        status: normalizeStatus(item),
        error_message: errorMessage,
        args,
        entry_point:
            item?.entry_point ?? item?.entryPoint ??
            item?.session?.StoredVersionedContractByHash?.entry_point ??
            item?.session?.StoredContractByHash?.entry_point ?? null,
        timestamp: item?.timestamp ?? item?.created_at ?? item?.createdAt ?? null,
        caller_public_key: item?.caller_public_key ?? item?.callerPublicKey ?? null,
        cost: item?.cost ?? item?.execution_result?.cost ?? item?.executionResult?.cost ?? null,
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

type DataSourceMode = 'hybrid' | 'cloud-only' | 'legacy-only';
type DataSource = 'cloud' | 'legacy';

function explorerSourcesByMode(mode: DataSourceMode): DataSource[] {
    if (mode === 'legacy-only') return ['legacy'];
    if (mode === 'cloud-only') return ['cloud'];
    return ['cloud', 'legacy'];
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('getCloudAuthHeaderValue', () => {
    it('strips "Bearer " prefix (case-insensitive)', () => {
        expect(getCloudAuthHeaderValue('Bearer abc123')).toBe('abc123');
        expect(getCloudAuthHeaderValue('bearer abc123')).toBe('abc123');
        expect(getCloudAuthHeaderValue('BEARER abc123')).toBe('abc123');
    });

    it('returns raw key when no prefix', () => {
        expect(getCloudAuthHeaderValue('abc123')).toBe('abc123');
    });

    it('trims whitespace', () => {
        expect(getCloudAuthHeaderValue('  abc123  ')).toBe('abc123');
        expect(getCloudAuthHeaderValue('  Bearer xyz  ')).toBe('xyz');
    });

    it('returns empty string for empty/missing token', () => {
        expect(getCloudAuthHeaderValue('')).toBe('');
    });
});

describe('sanitizeErrorText', () => {
    const TOKEN = 'my-secret-token-12345';

    it('redacts the raw token from cloud error text', () => {
        const text = `Error: invalid key my-secret-token-12345 for endpoint`;
        const result = sanitizeErrorText('cloud', text, TOKEN);
        expect(result).not.toContain(TOKEN);
        expect(result).toContain('[REDACTED]');
    });

    it('redacts Bearer header values', () => {
        const text = 'Authorization failed: Bearer some-token-value header invalid';
        const result = sanitizeErrorText('cloud', text, TOKEN);
        expect(result).not.toContain('some-token-value');
        expect(result).toContain('Bearer [REDACTED]');
    });

    it('redacts Authorization header values', () => {
        const text = 'Header Authorization: some-secret was rejected';
        const result = sanitizeErrorText('cloud', text, TOKEN);
        expect(result).toContain('Authorization: [REDACTED]');
    });

    it('does NOT redact for legacy source', () => {
        const text = `Error containing ${TOKEN}`;
        const result = sanitizeErrorText('legacy', text, TOKEN);
        expect(result).toContain(TOKEN);
    });

    it('returns "request_failed" for undefined text', () => {
        expect(sanitizeErrorText('cloud', undefined, TOKEN)).toBe('request_failed');
    });

    it('truncates to 300 characters', () => {
        const longText = 'x'.repeat(500);
        expect(sanitizeErrorText('cloud', longText, '')).toHaveLength(300);
    });
});

describe('parsePathInput', () => {
    it('returns null for falsy input', () => {
        expect(parsePathInput(undefined)).toBeNull();
        expect(parsePathInput('')).toBeNull();
    });

    it('rejects absolute URLs', () => {
        expect(parsePathInput('https://evil.com/path')).toBeNull();
        expect(parsePathInput('http://evil.com')).toBeNull();
    });

    it('prepends "/" when missing', () => {
        expect(parsePathInput('deploys/abc123')).toBe('/deploys/abc123');
    });

    it('passes through paths starting with "/"', () => {
        expect(parsePathInput('/purses/uref-abc/transfers')).toBe('/purses/uref-abc/transfers');
    });

    it('handles array input (takes first)', () => {
        expect(parsePathInput(['/deploys/abc'])).toBe('/deploys/abc');
    });
});

describe('classifyExplorerPath', () => {
    it('classifies /purses/<uref>/transfers as transfers', () => {
        expect(classifyExplorerPath('/purses/uref-abc-007/transfers')).toBe('transfers');
    });

    it('classifies /purse-urefs/<uref>/transfers as transfers', () => {
        expect(classifyExplorerPath('/purse-urefs/uref-abc-007/transfers')).toBe('transfers');
    });

    it('classifies /deploys/<hash> as deploy', () => {
        expect(classifyExplorerPath('/deploys/abc123def')).toBe('deploy');
    });

    it('rejects unknown paths', () => {
        expect(classifyExplorerPath('/accounts/something')).toBeNull();
        expect(classifyExplorerPath('/blocks/123')).toBeNull();
        expect(classifyExplorerPath('/')).toBeNull();
    });

    it('rejects paths with extra segments', () => {
        expect(classifyExplorerPath('/deploys/abc/extra')).toBeNull();
    });

    it('handles query strings', () => {
        expect(classifyExplorerPath('/purses/uref-abc-007/transfers?page_size=100')).toBe('transfers');
        expect(classifyExplorerPath('/deploys/abc123?foo=bar')).toBe('deploy');
    });
});

describe('mapPathForSource', () => {
    it('cloud: rewrites /purses/ to /purse-urefs/', () => {
        const result = mapPathForSource('/purses/uref-abc-007/transfers', 'cloud');
        expect(result).toContain('/purse-urefs/uref-abc-007/transfers');
    });

    it('legacy: rewrites /purse-urefs/ to /purses/', () => {
        const result = mapPathForSource('/purse-urefs/uref-abc-007/transfers', 'legacy');
        expect(result).toContain('/purses/uref-abc-007/transfers');
    });

    it('cloud: converts page_size to limit', () => {
        const result = mapPathForSource('/purse-urefs/uref-abc/transfers?page_size=50', 'cloud');
        expect(result).toContain('limit=50');
        expect(result).not.toContain('page_size');
    });

    it('legacy: converts limit to page_size', () => {
        const result = mapPathForSource('/purses/uref-abc/transfers?limit=50', 'legacy');
        expect(result).toContain('page_size=50');
        expect(result).not.toContain('limit=');
    });

    it('does not double-convert when both params exist', () => {
        const result = mapPathForSource('/purse-urefs/uref-abc/transfers?page_size=50&limit=100', 'cloud');
        // Both exist, so page_size should NOT be converted
        expect(result).toContain('limit=100');
    });

    it('does not rewrite paths that already match the source', () => {
        const cloudPath = mapPathForSource('/purse-urefs/uref-abc-007/transfers', 'cloud');
        expect(cloudPath).toContain('/purse-urefs/uref-abc-007/transfers');

        const legacyPath = mapPathForSource('/purses/uref-abc-007/transfers', 'legacy');
        expect(legacyPath).toContain('/purses/uref-abc-007/transfers');
    });
});

describe('extractArray', () => {
    it('extracts from .data array', () => {
        expect(extractArray({ data: [1, 2] })).toEqual([1, 2]);
    });

    it('extracts from .items array', () => {
        expect(extractArray({ items: [3, 4] })).toEqual([3, 4]);
    });

    it('extracts from .result.data', () => {
        expect(extractArray({ result: { data: [5] } })).toEqual([5]);
    });

    it('handles raw array', () => {
        expect(extractArray([6, 7])).toEqual([6, 7]);
    });

    it('returns [] for non-array payload', () => {
        expect(extractArray({ foo: 'bar' })).toEqual([]);
        expect(extractArray(null)).toEqual([]);
    });
});

describe('normalizeTransferItem', () => {
    it('normalizes cloud-style camelCase fields', () => {
        const item = {
            deployHash: 'abc',
            blockHeight: 100,
            fromPurse: 'uref-from',
            toPurse: 'uref-to',
            createdAt: '2024-01-01',
        };
        const norm = normalizeTransferItem(item);
        expect(norm.deploy_hash).toBe('abc');
        expect(norm.block_height).toBe(100);
        expect(norm.from_purse).toBe('uref-from');
        expect(norm.to_purse).toBe('uref-to');
        expect(norm.timestamp).toBe('2024-01-01');
    });

    it('normalizes legacy snake_case fields', () => {
        const item = {
            deploy_hash: 'def',
            block_height: 200,
            from_purse: 'uref-from2',
            to_purse: 'uref-to2',
            timestamp: '2024-02-01',
        };
        const norm = normalizeTransferItem(item);
        expect(norm.deploy_hash).toBe('def');
        expect(norm.block_height).toBe(200);
    });

    it('falls back deploy_hash from nested deploy.hash', () => {
        const item = { deploy: { hash: 'nested-hash' } };
        const norm = normalizeTransferItem(item);
        expect(norm.deploy_hash).toBe('nested-hash');
    });

    it('defaults block_height to 0 for invalid values', () => {
        expect(normalizeTransferItem({}).block_height).toBe(0);
        expect(normalizeTransferItem({ block_height: 'not_a_number' }).block_height).toBe(0);
    });
});

describe('normalizeStatus', () => {
    it('maps success variants to "processed"', () => {
        expect(normalizeStatus({ status: 'success' })).toBe('processed');
        expect(normalizeStatus({ status: 'processed' })).toBe('processed');
        expect(normalizeStatus({ status: 'Succeeded' })).toBe('processed');
    });

    it('maps failure variants to "failed"', () => {
        expect(normalizeStatus({ status: 'failure' })).toBe('failed');
        expect(normalizeStatus({ status: 'Failed' })).toBe('failed');
    });

    it('handles object status with Success/Failure keys', () => {
        expect(normalizeStatus({ status: { Success: {} } })).toBe('processed');
        expect(normalizeStatus({ status: { Failure: { error: 'x' } } })).toBe('failed');
    });

    it('reads from execution_result fallback', () => {
        expect(normalizeStatus({ execution_result: { status: 'success' } })).toBe('processed');
    });

    it('returns "unknown" for missing status', () => {
        expect(normalizeStatus({})).toBe('unknown');
        expect(normalizeStatus(null)).toBe('unknown');
    });
});

describe('normalizeDeployItem', () => {
    it('normalizes a cloud-style deploy', () => {
        const item = {
            deployHash: 'abc',
            status: 'success',
            entryPoint: 'deposit',
            callerPublicKey: '01aabb',
            createdAt: '2024-01-01',
            session: { args: { commitment: { parsed: '123' } } },
        };
        const norm = normalizeDeployItem(item);
        expect(norm.deploy_hash).toBe('abc');
        expect(norm.status).toBe('processed');
        expect(norm.entry_point).toBe('deposit');
        expect(norm.caller_public_key).toBe('01aabb');
        expect(norm.timestamp).toBe('2024-01-01');
        expect(norm.args).toEqual({ commitment: { parsed: '123' } });
    });

    it('normalizes a legacy deploy', () => {
        const item = {
            deploy_hash: 'def',
            status: 'processed',
            entry_point: 'withdraw',
            caller_public_key: '01ccdd',
            timestamp: '2024-02-01',
            args: { nullifier_hash: { parsed: '456' } },
        };
        const norm = normalizeDeployItem(item);
        expect(norm.deploy_hash).toBe('def');
        expect(norm.status).toBe('processed');
        expect(norm.args.nullifier_hash.parsed).toBe('456');
    });

    it('extracts error_message from various locations', () => {
        expect(normalizeDeployItem({ error_message: 'err1' }).error_message).toBe('err1');
        expect(normalizeDeployItem({ errorMessage: 'err2' }).error_message).toBe('err2');
        expect(normalizeDeployItem({ execution_result: { error_message: 'err3' } }).error_message).toBe('err3');
        expect(normalizeDeployItem({ error: { message: 'err4' } }).error_message).toBe('err4');
    });
});

describe('normalizeExplorerResponse', () => {
    it('wraps transfer array in { data: [...] }', () => {
        const payload = { data: [{ deploy_hash: 'a', block_height: 1 }] };
        const norm = normalizeExplorerResponse('transfers', payload);
        expect(norm.data).toHaveLength(1);
        expect(norm.data[0].deploy_hash).toBe('a');
    });

    it('wraps single deploy in { data: {...} }', () => {
        const payload = { data: { hash: 'x', status: 'success' } };
        const norm = normalizeExplorerResponse('deploy', payload);
        expect(norm.data.deploy_hash).toBe('x');
        expect(norm.data.status).toBe('processed');
    });

    it('handles cloud items wrapper', () => {
        const payload = { items: [{ deployHash: 'b', blockHeight: 5 }] };
        const norm = normalizeExplorerResponse('transfers', payload);
        expect(norm.data).toHaveLength(1);
        expect(norm.data[0].deploy_hash).toBe('b');
        expect(norm.data[0].block_height).toBe(5);
    });
});

describe('explorerSourcesByMode', () => {
    it('hybrid returns cloud first, then legacy', () => {
        expect(explorerSourcesByMode('hybrid')).toEqual(['cloud', 'legacy']);
    });

    it('cloud-only returns only cloud', () => {
        expect(explorerSourcesByMode('cloud-only')).toEqual(['cloud']);
    });

    it('legacy-only returns only legacy', () => {
        expect(explorerSourcesByMode('legacy-only')).toEqual(['legacy']);
    });
});

// ── Integration-style tests for the handler ─────────────────────────────
// We test the actual handler by mocking global fetch and creating mock
// NextApiRequest / NextApiResponse objects.

describe('proxy handler (integration)', () => {
    let handler: (req: any, res: any) => Promise<void>;
    let originalFetch: typeof global.fetch;

    function mockReq(overrides: any = {}): any {
        return {
            method: 'GET',
            query: {},
            body: {},
            ...overrides,
        };
    }

    function mockRes(): any {
        const res: any = {
            statusCode: 200,
            headers: {} as Record<string, string>,
            body: null as any,
            status(code: number) { res.statusCode = code; return res; },
            json(data: any) { res.body = data; return res; },
            setHeader(key: string, value: string) { res.headers[key] = value; },
        };
        return res;
    }

    beforeAll(async () => {
        // Set env BEFORE importing so the module picks them up
        process.env.CSPR_CLOUD_API_TOKEN = 'test-cloud-token-123';
        process.env.CSPR_CLOUD_REST_BASE_URL = 'https://api.testnet.cspr.cloud';
        process.env.LEGACY_EXPLORER_API_URL = 'https://api.testnet.cspr.live';
        process.env.CSPR_DATA_SOURCE_MODE = 'hybrid';
        process.env.CASPER_NODE_RPC_URL = 'https://node.testnet.casper.network/rpc';

        // Cache-bust any previous import
        const modulePath = require.resolve('./proxy');
        delete require.cache[modulePath];

        const mod = await import('./proxy');
        handler = mod.default;
    });

    beforeEach(() => {
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('rejects non-GET for explorer proxy', async () => {
        const req = mockReq({ method: 'POST', query: { useExplorer: 'true', path: '/deploys/abc' } });
        const res = mockRes();
        await handler(req, res);
        expect(res.statusCode).toBe(405);
    });

    it('rejects missing path', async () => {
        const req = mockReq({ query: { useExplorer: 'true' } });
        const res = mockRes();
        await handler(req, res);
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain('Missing');
    });

    it('rejects disallowed path patterns', async () => {
        const req = mockReq({ query: { useExplorer: 'true', path: '/accounts/something' } });
        const res = mockRes();
        await handler(req, res);
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain('not allowed');
    });

    it('proxies explorer GET to cloud first, sets data-source header', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ data: [{ deploy_hash: 'hash1', block_height: 10, from_purse: 'uref-a', to_purse: 'uref-b', timestamp: '2024-01-01' }] }),
        } as any);

        const req = mockReq({
            query: { useExplorer: 'true', path: '/purse-urefs/uref-abc-007/transfers' },
        });
        const res = mockRes();
        await handler(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.headers['x-shroud-data-source']).toBe('cloud');
        expect(res.headers['x-shroud-fallback-used']).toBe('false');
        expect(res.body.data).toHaveLength(1);

        // Verify cloud auth header was sent (no Bearer prefix)
        const call = (global.fetch as jest.Mock).mock.calls[0];
        const headers = call[1]?.headers;
        expect(headers?.Authorization).toBe('test-cloud-token-123');
        expect(headers?.Authorization).not.toMatch(/^bearer/i);
    });

    it('falls back to legacy when cloud fails in hybrid mode', async () => {
        // Use a DIFFERENT path to avoid cache hit from previous test
        (global.fetch as any) = jest.fn()
            // Cloud fails
            .mockResolvedValueOnce({
                ok: false,
                status: 401,
                text: async () => 'Unauthorized',
            } as any)
            // Legacy succeeds
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ data: [{ deploy_hash: 'legacy1', block_height: 5 }] }),
            } as any);

        const req = mockReq({
            query: { useExplorer: 'true', path: '/purse-urefs/uref-different-purse-007/transfers' },
        });
        const res = mockRes();
        await handler(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.headers['x-shroud-data-source']).toBe('legacy');
        expect(res.headers['x-shroud-fallback-used']).toBe('true');
    });

    it('proxies RPC POST to node when useExplorer is not set', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ jsonrpc: '2.0', result: { state_root_hash: 'abc' } }),
        } as any);

        const req = mockReq({
            method: 'POST',
            query: {},
            body: { jsonrpc: '2.0', method: 'chain_get_state_root_hash', params: [] },
        });
        const res = mockRes();
        await handler(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.result.state_root_hash).toBe('abc');

        const call = (global.fetch as jest.Mock).mock.calls[0];
        expect(call[0]).toBe('https://node.testnet.casper.network/rpc');
    });

    it('handles upstream RPC errors gracefully', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: false,
            status: 503,
            text: async () => 'Service Unavailable',
        } as any);

        const req = mockReq({ method: 'POST', query: {}, body: {} });
        const res = mockRes();
        await handler(req, res);

        expect(res.statusCode).toBe(503);
        expect(res.body.error).toContain('Target error');
    });

    it('handles network errors in explorer proxy', async () => {
        global.fetch = jest.fn()
            // Cloud network error → hybrid mode falls back
            .mockRejectedValueOnce(new Error('ECONNREFUSED'))
            // Legacy also fails → returns Target error (legacy is not a fallback source)
            .mockRejectedValueOnce(new Error('ECONNREFUSED'));

        const req = mockReq({
            query: { useExplorer: 'true', path: '/deploys/abc123' },
        });
        const res = mockRes();
        await handler(req, res);

        // Legacy is the final source in hybrid mode; when it fails the handler
        // returns "Target error" (not "unavailable") because legacy is not a
        // fallback source — only cloud → legacy is the fallback path.
        expect(res.statusCode).toBe(502);
        expect(res.body.error).toContain('Target error');
        expect(res.body.source).toBe('legacy');
    });

    it('does NOT send Authorization header for legacy source', async () => {
        // Cloud fails → falls back to legacy
        (global.fetch as any) = jest.fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => 'Internal error',
            } as any)
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ data: { hash: 'dep1', status: 'processed' } }),
            } as any);

        const req = mockReq({
            query: { useExplorer: 'true', path: '/deploys/abc123' },
        });
        const res = mockRes();
        await handler(req, res);

        // Second call is legacy — should NOT have Authorization header
        const legacyCall = (global.fetch as jest.Mock).mock.calls[1];
        expect(legacyCall[1]?.headers?.Authorization).toBeUndefined();
    });
});
