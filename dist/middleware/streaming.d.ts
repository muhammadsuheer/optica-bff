/**
 * Streaming Response Middleware for Edge Runtime
 *
 * Features:
 * - NDJSON streaming for large datasets
 * - Web Streams API (Edge-compatible)
 * - Backpressure handling
 * - Error recovery
 */
import { Context } from 'hono';
export interface StreamingOptions {
    batchSize?: number;
    delayMs?: number;
    contentType?: string;
}
/**
 * Create a streaming response for large datasets
 */
export declare function createStreamingResponse<T>(data: T[] | AsyncIterable<T>, options?: StreamingOptions): Response;
/**
 * Streaming middleware factory
 */
export declare function streamingMiddleware(): (c: Context, next: Function) => Promise<void>;
/**
 * Server-Sent Events streaming
 */
export declare function createSSEResponse<T>(dataSource: AsyncIterable<T>, options?: {
    keepAliveMs?: number;
}): Response;
/**
 * Async generator for paginated data
 */
export declare function paginatedDataGenerator<T>(fetchPage: (page: number, perPage: number) => Promise<T[]>, perPage?: number): AsyncGenerator<T, void, unknown>;
export type { StreamingOptions };
//# sourceMappingURL=streaming.d.ts.map