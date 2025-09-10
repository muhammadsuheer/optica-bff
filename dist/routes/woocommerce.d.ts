/**
 * WooCommerce Integration Routes for Edge Runtime
 * Handles WooCommerce API synchronization and webhooks
 */
import { Hono } from 'hono';
declare const woocommerce: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
export default woocommerce;
//# sourceMappingURL=woocommerce.d.ts.map