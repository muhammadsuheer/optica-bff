/**
 * Health Check Routes for Edge Runtime
 * Provides system health, readiness, and liveness endpoints
 */
import { Hono } from 'hono';
declare const health: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export default health;
//# sourceMappingURL=health.d.ts.map