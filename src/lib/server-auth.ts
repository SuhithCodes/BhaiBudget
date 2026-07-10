/**
 * Server-side Firebase ID token verification.
 *
 * Verifies the JWT signature against Google's public securetoken JWKS, so no
 * service-account credentials are needed. API routes use this to derive the
 * caller's uid/email instead of trusting values in the request body.
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';

const FIREBASE_JWKS_URL =
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const jwks = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));

export interface VerifiedUser {
    uid: string;
    email: string | null;
}

/**
 * Verify a `Authorization: Bearer <idToken>` header value.
 * Returns the verified user, or null if the header is missing/invalid.
 */
export async function verifyIdToken(authorizationHeader: string | null): Promise<VerifiedUser | null> {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
        console.error('NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set; cannot verify ID tokens.');
        return null;
    }

    const token = authorizationHeader?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return null;

    try {
        const { payload } = await jwtVerify(token, jwks, {
            issuer: `https://securetoken.google.com/${projectId}`,
            audience: projectId,
            algorithms: ['RS256'],
        });
        if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
        return {
            uid: payload.sub,
            email: typeof payload.email === 'string' ? payload.email : null,
        };
    } catch {
        return null;
    }
}
