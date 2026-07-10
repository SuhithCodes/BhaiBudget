/**
 * Retry helper for transient failures (rate limits, 5xx, network errors).
 * Never retries other 4xx errors — those are deterministic and retrying
 * would just burn quota.
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    for (let i = 0; ; i++) {
        try {
            return await fn();
        } catch (e: unknown) {
            const err = e as { status?: number; response?: { status?: number } };
            const status = err?.status ?? err?.response?.status;
            const retryable = status === 429 || (typeof status === 'number' && status >= 500) || status === undefined;
            if (!retryable || i >= attempts - 1) throw e;
            await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** i));
        }
    }
}
