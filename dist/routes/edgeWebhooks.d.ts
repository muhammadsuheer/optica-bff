/**
 * Edge Webhook Handler - Fast Response with Job Enqueuing
 *
 * Features:
 * - WebCrypto signature verification
 * - Sub-500ms response time
 * - Idempotency protection
 * - Job enqueuing to background workers
 */
import { Hono } from 'hono';
declare const webhooks: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export default webhooks;
//# sourceMappingURL=edgeWebhooks.d.ts.map