/**
 * WooCommerce Features Routes - High Performance Implementation
 *
 * Features:
 * - WooCommerce specific functionality (coupons, shipping, taxes, etc.)
 * - Response caching with intelligent TTL
 * - Advanced discount calculations
 * - Performance monitoring per endpoint
 * - Integration with WooCommerce REST API
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest.js';
import { CacheService } from '../services/cacheService.js';
// Pre-compiled validation schemas
const couponParamsSchema = z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
}).strict();
const couponQuerySchema = z.object({
    code: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    type: z.enum(['percent', 'fixed_cart', 'fixed_product']).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
    per_page: z.string().regex(/^\d+$/).transform(Number).optional().default(20),
}).strict();
const validateCouponSchema = z.object({
    code: z.string().min(1),
    cart_total: z.number().min(0),
    product_ids: z.array(z.number()).optional(),
    customer_email: z.string().email().optional(),
}).strict();
const shippingCalculateSchema = z.object({
    country: z.string().length(2),
    state: z.string().optional(),
    postcode: z.string().optional(),
    city: z.string().optional(),
    items: z.array(z.object({
        product_id: z.number(),
        quantity: z.number().positive(),
        weight: z.number().min(0).optional(),
        dimensions: z.object({
            length: z.number().min(0),
            width: z.number().min(0),
            height: z.number().min(0),
        }).optional(),
    })),
}).strict();
// Performance monitoring
const routeStats = {
    couponsList: { requests: 0, avgTime: 0, errors: 0 },
    couponValidate: { requests: 0, avgTime: 0, errors: 0 },
    shippingZones: { requests: 0, avgTime: 0, errors: 0 },
    shippingCalculate: { requests: 0, avgTime: 0, errors: 0 },
    taxRates: { requests: 0, avgTime: 0, errors: 0 },
    taxCalculate: { requests: 0, avgTime: 0, errors: 0 },
    paymentGateways: { requests: 0, avgTime: 0, errors: 0 },
    webhookEvents: { requests: 0, avgTime: 0, errors: 0 },
};
// Mock data for development (replace with actual WooCommerce service)
const mockCoupons = [
    {
        id: 1,
        code: 'SUMMER2024',
        type: 'percent',
        amount: 20,
        description: '20% off summer sale',
        usage_limit: 100,
        usage_count: 15,
        individual_use: false,
        product_ids: [],
        excluded_product_ids: [],
        minimum_amount: 50,
        maximum_amount: 500,
        email_restrictions: [],
        used_by: [],
        date_expires: '2024-08-31T23:59:59Z',
        status: 'active',
        created_at: '2024-06-01T00:00:00Z',
        updated_at: '2024-06-01T00:00:00Z',
    },
    {
        id: 2,
        code: 'NEWCUSTOMER',
        type: 'fixed_cart',
        amount: 10,
        description: '$10 off for new customers',
        usage_limit: 1,
        usage_count: 0,
        individual_use: true,
        product_ids: [],
        excluded_product_ids: [],
        minimum_amount: 25,
        email_restrictions: [],
        used_by: [],
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
    },
];
const mockShippingZones = [
    {
        id: 1,
        name: 'United States',
        order: 0,
        locations: [
            { code: 'US', type: 'country' }
        ],
        methods: [
            {
                id: 1,
                title: 'Free Shipping',
                method_id: 'free_shipping',
                cost: 0,
                enabled: true,
            },
            {
                id: 2,
                title: 'Standard Shipping',
                method_id: 'flat_rate',
                cost: 10,
                enabled: true,
            },
        ],
    },
];
const mockTaxRates = [
    {
        id: 1,
        country: 'US',
        state: 'CA',
        postcode: '',
        city: '',
        rate: 8.75,
        name: 'California Tax',
        priority: 1,
        compound: false,
        shipping: true,
        order: 0,
        class: 'standard',
    },
];
const mockPaymentGateways = [
    {
        id: 'stripe',
        title: 'Credit Card (Stripe)',
        description: 'Pay securely with your credit card',
        order: 1,
        enabled: true,
        method_title: 'Stripe',
        method_description: 'Stripe payment gateway',
        supports: ['products', 'subscriptions', 'refunds'],
    },
    {
        id: 'paypal',
        title: 'PayPal',
        description: 'Pay with your PayPal account',
        order: 2,
        enabled: true,
        method_title: 'PayPal Standard',
        method_description: 'PayPal Standard payment gateway',
        supports: ['products', 'refunds'],
    },
];
/**
 * WooCommerce Features routes with high performance optimizations
 */
export function createWooCommerceRoutes(cacheService) {
    const woo = new Hono();
    /**
     * GET /woocommerce/coupons - Fetch WooCommerce coupons
     */
    woo.get('/coupons', validateRequest({ query: couponQuerySchema }), async (c) => {
        const startTime = Date.now();
        routeStats.couponsList.requests++;
        try {
            const query = c.req.query();
            const validatedQuery = couponQuerySchema.parse(query);
            // Create cache key based on filters
            const cacheKey = `woo:coupons:list:${JSON.stringify(validatedQuery)}`;
            // Try cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                const responseTime = Date.now() - startTime;
                c.header('X-Response-Time', `${responseTime}ms`);
                c.header('X-Cache-Status', 'hit');
                const response = {
                    success: true,
                    data: cached.coupons,
                    meta: {
                        total: cached.total,
                        page: validatedQuery.page,
                        perPage: validatedQuery.per_page,
                        totalPages: Math.ceil(cached.total / validatedQuery.per_page),
                    },
                };
                return c.json(response);
            }
            // Filter coupons based on query parameters
            let filteredCoupons = [...mockCoupons];
            if (validatedQuery.code) {
                filteredCoupons = filteredCoupons.filter(c => c.code.toLowerCase().includes(validatedQuery.code.toLowerCase()));
            }
            if (validatedQuery.status) {
                filteredCoupons = filteredCoupons.filter(c => c.status === validatedQuery.status);
            }
            if (validatedQuery.type) {
                filteredCoupons = filteredCoupons.filter(c => c.type === validatedQuery.type);
            }
            // Pagination
            const total = filteredCoupons.length;
            const startIndex = (validatedQuery.page - 1) * validatedQuery.per_page;
            const paginatedCoupons = filteredCoupons.slice(startIndex, startIndex + validatedQuery.per_page);
            // Cache result for 5 minutes
            await cacheService.set(cacheKey, { coupons: paginatedCoupons, total }, 300);
            const responseTime = Date.now() - startTime;
            routeStats.couponsList.avgTime = (routeStats.couponsList.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            c.header('X-Cache-Status', 'miss');
            c.header('Cache-Control', 'public, max-age=300');
            const response = {
                success: true,
                data: paginatedCoupons,
                meta: {
                    total,
                    page: validatedQuery.page,
                    perPage: validatedQuery.per_page,
                    totalPages: Math.ceil(total / validatedQuery.per_page),
                },
            };
            return c.json(response);
        }
        catch (error) {
            routeStats.couponsList.errors++;
            console.error('WooCommerce coupons list route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'WOO_COUPONS_FETCH_ERROR',
                    message: 'Failed to fetch coupons',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * POST /woocommerce/coupons/validate - Validate coupon code
     */
    woo.post('/coupons/validate', validateRequest({ body: validateCouponSchema }), async (c) => {
        const startTime = Date.now();
        routeStats.couponValidate.requests++;
        try {
            const body = await c.req.json();
            const data = validateCouponSchema.parse(body);
            const coupon = mockCoupons.find(c => c.code.toLowerCase() === data.code.toLowerCase() && c.status === 'active');
            if (!coupon) {
                const response = {
                    success: true,
                    data: {
                        valid: false,
                        reason: 'Coupon not found or inactive',
                    },
                };
                return c.json(response);
            }
            // Check expiry
            if (coupon.date_expires && new Date(coupon.date_expires) < new Date()) {
                const response = {
                    success: true,
                    data: {
                        valid: false,
                        reason: 'Coupon has expired',
                    },
                };
                return c.json(response);
            }
            // Check usage limit
            if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
                const response = {
                    success: true,
                    data: {
                        valid: false,
                        reason: 'Coupon usage limit reached',
                    },
                };
                return c.json(response);
            }
            // Check minimum amount
            if (coupon.minimum_amount && data.cart_total < coupon.minimum_amount) {
                const response = {
                    success: true,
                    data: {
                        valid: false,
                        reason: `Minimum order amount of $${coupon.minimum_amount} required`,
                    },
                };
                return c.json(response);
            }
            // Check maximum amount
            if (coupon.maximum_amount && data.cart_total > coupon.maximum_amount) {
                const response = {
                    success: true,
                    data: {
                        valid: false,
                        reason: `Maximum order amount of $${coupon.maximum_amount} exceeded`,
                    },
                };
                return c.json(response);
            }
            // Check email restrictions
            if (coupon.email_restrictions.length > 0 && data.customer_email) {
                const emailMatches = coupon.email_restrictions.some(email => data.customer_email.toLowerCase() === email.toLowerCase());
                if (!emailMatches) {
                    const response = {
                        success: true,
                        data: {
                            valid: false,
                            reason: 'Coupon not valid for this email address',
                        },
                    };
                    return c.json(response);
                }
            }
            // Calculate discount
            let discountAmount = 0;
            if (coupon.type === 'percent') {
                discountAmount = (data.cart_total * coupon.amount) / 100;
            }
            else if (coupon.type === 'fixed_cart') {
                discountAmount = Math.min(coupon.amount, data.cart_total);
            }
            else if (coupon.type === 'fixed_product') {
                // Simplified calculation for product-specific discount
                discountAmount = coupon.amount;
            }
            const responseTime = Date.now() - startTime;
            routeStats.couponValidate.avgTime = (routeStats.couponValidate.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            const response = {
                success: true,
                data: {
                    valid: true,
                    coupon,
                    discount_amount: discountAmount,
                },
            };
            return c.json(response);
        }
        catch (error) {
            routeStats.couponValidate.errors++;
            console.error('Coupon validate route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'COUPON_VALIDATE_ERROR',
                    message: 'Failed to validate coupon',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * GET /woocommerce/shipping/zones - Fetch shipping zones
     */
    woo.get('/shipping/zones', async (c) => {
        const startTime = Date.now();
        routeStats.shippingZones.requests++;
        try {
            const cacheKey = 'woo:shipping:zones';
            // Try cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                const responseTime = Date.now() - startTime;
                c.header('X-Response-Time', `${responseTime}ms`);
                c.header('X-Cache-Status', 'hit');
                return c.json({
                    success: true,
                    data: cached,
                });
            }
            // Cache for 30 minutes
            await cacheService.set(cacheKey, mockShippingZones, 1800);
            const responseTime = Date.now() - startTime;
            routeStats.shippingZones.avgTime = (routeStats.shippingZones.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            c.header('X-Cache-Status', 'miss');
            c.header('Cache-Control', 'public, max-age=1800');
            return c.json({
                success: true,
                data: mockShippingZones,
            });
        }
        catch (error) {
            routeStats.shippingZones.errors++;
            console.error('Shipping zones route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'SHIPPING_ZONES_ERROR',
                    message: 'Failed to fetch shipping zones',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * POST /woocommerce/shipping/calculate - Calculate shipping costs
     */
    woo.post('/shipping/calculate', validateRequest({ body: shippingCalculateSchema }), async (c) => {
        const startTime = Date.now();
        routeStats.shippingCalculate.requests++;
        try {
            const body = await c.req.json();
            const data = shippingCalculateSchema.parse(body);
            // Find matching shipping zone
            const matchingZone = mockShippingZones.find(zone => zone.locations.some(location => {
                if (location.type === 'country') {
                    return location.code === data.country;
                }
                // Add more location matching logic as needed
                return false;
            }));
            if (!matchingZone) {
                const response = {
                    success: true,
                    data: { methods: [] },
                };
                return c.json(response);
            }
            // Calculate shipping for each method
            const availableMethods = matchingZone.methods
                .filter(method => method.enabled)
                .map(method => ({
                id: method.id,
                title: method.title,
                method_id: method.method_id,
                cost: method.cost,
                description: `Estimated delivery cost for ${method.title}`,
            }));
            const responseTime = Date.now() - startTime;
            routeStats.shippingCalculate.avgTime = (routeStats.shippingCalculate.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            const response = {
                success: true,
                data: { methods: availableMethods },
            };
            return c.json(response);
        }
        catch (error) {
            routeStats.shippingCalculate.errors++;
            console.error('Shipping calculate route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'SHIPPING_CALCULATE_ERROR',
                    message: 'Failed to calculate shipping',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * GET /woocommerce/tax/rates - Fetch tax rates
     */
    woo.get('/tax/rates', async (c) => {
        const startTime = Date.now();
        routeStats.taxRates.requests++;
        try {
            const cacheKey = 'woo:tax:rates';
            // Try cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                const responseTime = Date.now() - startTime;
                c.header('X-Response-Time', `${responseTime}ms`);
                c.header('X-Cache-Status', 'hit');
                return c.json({
                    success: true,
                    data: cached,
                });
            }
            // Cache for 1 hour
            await cacheService.set(cacheKey, mockTaxRates, 3600);
            const responseTime = Date.now() - startTime;
            routeStats.taxRates.avgTime = (routeStats.taxRates.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            c.header('X-Cache-Status', 'miss');
            c.header('Cache-Control', 'public, max-age=3600');
            return c.json({
                success: true,
                data: mockTaxRates,
            });
        }
        catch (error) {
            routeStats.taxRates.errors++;
            console.error('Tax rates route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'TAX_RATES_ERROR',
                    message: 'Failed to fetch tax rates',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * POST /woocommerce/tax/calculate - Calculate tax for order
     */
    woo.post('/tax/calculate', validateRequest({
        body: z.object({
            country: z.string().length(2),
            state: z.string().optional(),
            postcode: z.string().optional(),
            city: z.string().optional(),
            line_items: z.array(z.object({
                product_id: z.number(),
                quantity: z.number().positive(),
                price: z.number().min(0),
                tax_class: z.string().optional(),
            })),
            shipping_cost: z.number().min(0).optional(),
        })
    }), async (c) => {
        const startTime = Date.now();
        routeStats.taxCalculate.requests++;
        try {
            const body = await c.req.json();
            const data = z.object({
                country: z.string().length(2),
                state: z.string().optional(),
                postcode: z.string().optional(),
                city: z.string().optional(),
                line_items: z.array(z.object({
                    product_id: z.number(),
                    quantity: z.number().positive(),
                    price: z.number().min(0),
                    tax_class: z.string().optional(),
                })),
                shipping_cost: z.number().min(0).optional(),
            }).parse(body);
            // Find applicable tax rates
            const applicableTaxRates = mockTaxRates.filter(rate => {
                if (rate.country && rate.country !== data.country)
                    return false;
                if (rate.state && data.state && rate.state !== data.state)
                    return false;
                return true;
            });
            let totalTax = 0;
            let shippingTax = 0;
            // Calculate tax for line items
            data.line_items.forEach(item => {
                const itemSubtotal = item.price * item.quantity;
                applicableTaxRates.forEach(rate => {
                    const taxAmount = (itemSubtotal * rate.rate) / 100;
                    totalTax += taxAmount;
                });
            });
            // Calculate shipping tax
            if (data.shipping_cost && data.shipping_cost > 0) {
                applicableTaxRates.forEach(rate => {
                    if (rate.shipping) {
                        const taxAmount = (data.shipping_cost * rate.rate) / 100;
                        shippingTax += taxAmount;
                        totalTax += taxAmount;
                    }
                });
            }
            const responseTime = Date.now() - startTime;
            routeStats.taxCalculate.avgTime = (routeStats.taxCalculate.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            const response = {
                success: true,
                data: {
                    total_tax: Math.round(totalTax * 100) / 100,
                    shipping_tax: Math.round(shippingTax * 100) / 100,
                    tax_lines: applicableTaxRates.map(rate => ({
                        rate_id: rate.id,
                        label: rate.name,
                        compound: rate.compound,
                        tax_total: '0.00', // Simplified for demo
                        shipping_tax_total: '0.00',
                    })),
                },
            };
            return c.json(response);
        }
        catch (error) {
            routeStats.taxCalculate.errors++;
            console.error('Tax calculate route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'TAX_CALCULATE_ERROR',
                    message: 'Failed to calculate tax',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * GET /woocommerce/payment/gateways - Fetch available payment gateways
     */
    woo.get('/payment/gateways', async (c) => {
        const startTime = Date.now();
        routeStats.paymentGateways.requests++;
        try {
            const cacheKey = 'woo:payment:gateways';
            // Try cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                const responseTime = Date.now() - startTime;
                c.header('X-Response-Time', `${responseTime}ms`);
                c.header('X-Cache-Status', 'hit');
                return c.json({
                    success: true,
                    data: cached,
                });
            }
            // Filter only enabled gateways
            const enabledGateways = mockPaymentGateways.filter(gateway => gateway.enabled);
            // Cache for 30 minutes
            await cacheService.set(cacheKey, enabledGateways, 1800);
            const responseTime = Date.now() - startTime;
            routeStats.paymentGateways.avgTime = (routeStats.paymentGateways.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            c.header('X-Cache-Status', 'miss');
            c.header('Cache-Control', 'public, max-age=1800');
            return c.json({
                success: true,
                data: enabledGateways,
            });
        }
        catch (error) {
            routeStats.paymentGateways.errors++;
            console.error('Payment gateways route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'PAYMENT_GATEWAYS_ERROR',
                    message: 'Failed to fetch payment gateways',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * GET /woocommerce/webhooks - Fetch webhook events
     */
    woo.get('/webhooks', async (c) => {
        const startTime = Date.now();
        routeStats.webhookEvents.requests++;
        try {
            const cacheKey = 'woo:webhooks';
            // Mock webhook events data
            const mockWebhooks = [
                {
                    id: 1,
                    name: 'Order Created',
                    status: 'active',
                    topic: 'order.created',
                    resource: 'order',
                    event: 'created',
                    hooks: 1,
                    delivery_url: 'https://example.com/webhooks/order-created',
                    date_created: '2024-01-01T00:00:00Z',
                    date_modified: '2024-01-01T00:00:00Z',
                },
            ];
            // Try cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                const responseTime = Date.now() - startTime;
                c.header('X-Response-Time', `${responseTime}ms`);
                c.header('X-Cache-Status', 'hit');
                return c.json({
                    success: true,
                    data: cached,
                });
            }
            // Cache for 15 minutes
            await cacheService.set(cacheKey, mockWebhooks, 900);
            const responseTime = Date.now() - startTime;
            routeStats.webhookEvents.avgTime = (routeStats.webhookEvents.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            c.header('X-Cache-Status', 'miss');
            c.header('Cache-Control', 'public, max-age=900');
            return c.json({
                success: true,
                data: mockWebhooks,
            });
        }
        catch (error) {
            routeStats.webhookEvents.errors++;
            console.error('Webhook events route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'WEBHOOK_EVENTS_ERROR',
                    message: 'Failed to fetch webhook events',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    return woo;
}
