/**
 * Request Deduplication Middleware for Edge Runtime
 * Prevents duplicate in-flight requests
 */
import { Context, Next } from 'hono';
export declare function requestDeduplication(): (c: Context, next: Next) => Promise<Response | undefined>;
//# sourceMappingURL=deduplication.d.ts.map