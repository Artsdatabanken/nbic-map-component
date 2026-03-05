/**
 * Handles fetching, storing, and renewing tokens for Norge i Bilder aerial photo services.
 */

export interface NibTokenConfig {
    tokenUrl?: string;
    storageKey?: string;
    expiryMarginMinutes?: number;
    retryIntervalMs?: number;
    onTokenFetched?: (token: string) => void;
    onError?: (error: Error) => void;
}

/**
 * Token object stored in localStorage
 */
export interface NibToken {
    value: string;
    expires: number;
    when: number;
}

interface TokenApiResponse {
    ClientId: string;
    ExpireTimestamp: string;
    TokenValue: string;
}

export interface NibTokenManager {
    init(): Promise<void>;
    getToken(): string;
    getTokenInfo(): NibToken | null;
    refreshToken(force?: boolean): Promise<string>;
    onTokenChange(callback: (token: string) => void): () => void;
    dispose(): void;
    isInitialized(): boolean;
}

const DEFAULT_CONFIG: Required<Omit<NibTokenConfig, 'onTokenFetched' | 'onError'>> = {
    tokenUrl: 'https://artskart.artsdatabanken.no/appapi/api/token/gettoken2',
    storageKey: 'nbic-map-nib-token',
    expiryMarginMinutes: 10,
    retryIntervalMs: 60000,
};

/**
 * Create a NiB token manager instance
 */
export function createNibToken(config?: NibTokenConfig): NibTokenManager {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    let currentToken: NibToken | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let isRefreshing = false;
    let refreshPromise: Promise<string> | null = null;
    let abortController: AbortController | null = null;
    let initialized = false;
    const listeners: Array<(token: string) => void> = [];

    function loadStoredToken(): NibToken | null {
        try {
            if (typeof localStorage === 'undefined') return null;
            const stored = localStorage.getItem(cfg.storageKey);
            if (!stored) return null;
            const parsed = JSON.parse(stored) as NibToken;
            if (typeof parsed.value === 'string' &&
                typeof parsed.expires === 'number' &&
                typeof parsed.when === 'number') {
                return parsed;
            }
            return null;
        } catch {
            return null;
        }
    }

    function storeToken(token: NibToken): void {
        try {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem(cfg.storageKey, JSON.stringify(token));
        } catch {
            // localStorage might be unavailable or full
        }
    }

    function isTokenValid(token: NibToken | null): boolean {
        if (!token?.value || !token.expires) return false;
        const marginMs = cfg.expiryMarginMinutes * 60 * 1000;
        return token.expires > (Date.now() + marginMs);
    }

    async function fetchToken(): Promise<NibToken> {
        abortController = new AbortController();
        const response = await fetch(cfg.tokenUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
            signal: abortController.signal,
        });

        if (!response.ok) {
            throw new Error(`Token fetch failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as TokenApiResponse;

        if (!data.TokenValue) {
            throw new Error('Invalid token response: missing TokenValue');
        }

        if (data.ClientId === 'Could Not Get Client IP address' ||
            data.TokenValue === 'Could Not Get Client IP address') {
            throw new Error('Server could not determine client IP address for token generation');
        }

        return {
            value: data.TokenValue,
            expires: new Date(data.ExpireTimestamp).getTime(),
            when: Date.now(),
        };
    }

    function notifyListeners(token: string): void {
        for (const cb of listeners) {
            try {
                cb(token);
            } catch {
                // Ignore listener errors
            }
        }
    }

    function scheduleRefresh(): void {
        if (refreshTimer) {
            clearTimeout(refreshTimer);
            refreshTimer = null;
        }

        if (!currentToken?.expires) return;

        const marginMs = cfg.expiryMarginMinutes * 60 * 1000;
        const refreshIn = Math.max(
            currentToken.expires - Date.now() - marginMs,
            cfg.retryIntervalMs
        );

        refreshTimer = setTimeout(() => {
            refreshToken().catch(() => {
                // Error already handled in refreshToken
            });
        }, refreshIn);
    }

    async function init(): Promise<void> {
        if (initialized) return;

        currentToken = loadStoredToken();

        if (isTokenValid(currentToken)) {
            initialized = true;
            scheduleRefresh();
            return;
        }

        try {
            await refreshToken();
        } catch {
            // Continue even if initial fetch fails - will retry later
        }

        initialized = true;
    }

    function getToken(): string {
        return currentToken?.value ?? '';
    }

    function getTokenInfo(): NibToken | null {
        return currentToken ? { ...currentToken } : null;
    }

    async function refreshToken(force = false): Promise<string> {
        // If already refreshing, wait for the existing promise
        if (isRefreshing && refreshPromise) {
            return refreshPromise;
        }

        // Rate limit check (skip if force=true)
        if (!force && currentToken?.when && (Date.now() - currentToken.when) < cfg.retryIntervalMs) {
            return currentToken?.value ?? '';
        }

        isRefreshing = true;

        refreshPromise = (async () => {
            try {
                const newToken = await fetchToken();
                currentToken = newToken;
                storeToken(newToken);
                notifyListeners(newToken.value);
                config?.onTokenFetched?.(newToken.value);
                scheduleRefresh();
                return newToken.value;
            } catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                config?.onError?.(err);
                if (currentToken) {
                    scheduleRefresh();
                }
                throw err;
            } finally {
                isRefreshing = false;
                refreshPromise = null;
                abortController = null;
            }
        })();

        return refreshPromise;
    }

    function onTokenChange(callback: (token: string) => void): () => void {
        listeners.push(callback);
        return () => {
            const idx = listeners.indexOf(callback);
            if (idx >= 0) {
                listeners.splice(idx, 1);
            }
        };
    }

    function dispose(): void {
        if (refreshTimer) {
            clearTimeout(refreshTimer);
            refreshTimer = null;
        }
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
        listeners.length = 0;
        currentToken = null;
        refreshPromise = null;
        isRefreshing = false;
        initialized = false;
    }

    function isInitialized(): boolean {
        return initialized;
    }

    return {
        init,
        getToken,
        getTokenInfo,
        refreshToken,
        onTokenChange,
        dispose,
        isInitialized,
    };
}

