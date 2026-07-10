/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Good enough for a single serverless instance to stop bursts against the
 * email endpoints and the Groq-backed actions. Swap for a shared store
 * (e.g. Upstash) if the app runs on many concurrent instances.
 */

interface WindowState {
    count: number;
    resetAt: number;
}

const windows = new Map<string, WindowState>();

const MAX_TRACKED_KEYS = 10_000;

export interface RateLimitOptions {
    /** Max requests allowed per window. */
    limit: number;
    /** Window length in milliseconds. */
    windowMs: number;
}

/** Returns true if the request identified by `key` is allowed. */
export function checkRateLimit(key: string, { limit, windowMs }: RateLimitOptions): boolean {
    const now = Date.now();
    const state = windows.get(key);

    if (!state || now >= state.resetAt) {
        if (windows.size >= MAX_TRACKED_KEYS) {
            for (const [k, s] of windows) {
                if (now >= s.resetAt) windows.delete(k);
            }
            if (windows.size >= MAX_TRACKED_KEYS) windows.clear();
        }
        windows.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }

    if (state.count >= limit) return false;
    state.count++;
    return true;
}
