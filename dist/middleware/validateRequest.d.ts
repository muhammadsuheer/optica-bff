/**
 * Request Validation Middleware for Edge Runtime
 * Uses Zod for schema validation
 */
import { Context, Next } from 'hono';
import { z } from 'zod';
export interface ValidationTarget {
    body?: z.ZodSchema;
    query?: z.ZodSchema;
    params?: z.ZodSchema;
    headers?: z.ZodSchema;
}
/**
 * Main validation middleware factory
 */
export declare function validateRequest(schemas: ValidationTarget): (c: Context, next: Next) => Promise<void>;
/**
 * Common validation schemas
 */
export declare const commonSchemas: {
    pagination: z.ZodObject<{
        page: z.ZodPipeline<z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodString>>, number, string | undefined>, z.ZodNumber>;
        limit: z.ZodPipeline<z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodString>>, number, string | undefined>, z.ZodNumber>;
        offset: z.ZodPipeline<z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>, z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
        offset: number;
    }, {
        page?: string | undefined;
        limit?: string | undefined;
        offset?: string | undefined;
    }>;
    sort: z.ZodObject<{
        sortBy: z.ZodOptional<z.ZodString>;
        sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["asc", "desc"]>>>;
    }, "strip", z.ZodTypeAny, {
        sortOrder: "asc" | "desc";
        sortBy?: string | undefined;
    }, {
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>;
    idParam: z.ZodObject<{
        id: z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: number;
    }, {
        id: string;
    }>;
    search: z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        query: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        q?: string | undefined;
        query?: string | undefined;
    }, {
        q?: string | undefined;
        query?: string | undefined;
    }>;
    dateRange: z.ZodObject<{
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
        dateFrom: z.ZodOptional<z.ZodString>;
        dateTo: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        startDate?: string | undefined;
        endDate?: string | undefined;
        dateFrom?: string | undefined;
        dateTo?: string | undefined;
    }, {
        startDate?: string | undefined;
        endDate?: string | undefined;
        dateFrom?: string | undefined;
        dateTo?: string | undefined;
    }>;
    apiKeyHeaders: z.ZodObject<{
        'x-api-key': z.ZodString;
    }, "strip", z.ZodTypeAny, {
        'x-api-key': string;
    }, {
        'x-api-key': string;
    }>;
    productFilters: z.ZodObject<{
        category: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<["publish", "draft", "private"]>>;
        featured: z.ZodOptional<z.ZodEffects<z.ZodString, boolean, string>>;
        inStock: z.ZodOptional<z.ZodEffects<z.ZodString, boolean, string>>;
        minPrice: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
        maxPrice: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        status?: "publish" | "draft" | "private" | undefined;
        category?: string | undefined;
        featured?: boolean | undefined;
        inStock?: boolean | undefined;
        minPrice?: number | undefined;
        maxPrice?: number | undefined;
    }, {
        status?: "publish" | "draft" | "private" | undefined;
        category?: string | undefined;
        featured?: string | undefined;
        inStock?: string | undefined;
        minPrice?: string | undefined;
        maxPrice?: string | undefined;
    }>;
};
/**
 * Validate body with schema
 */
export declare function validateBody<T extends z.ZodSchema>(schema: T): (c: Context, next: Next) => Promise<void>;
/**
 * Validate query parameters with schema
 */
export declare function validateQuery<T extends z.ZodSchema>(schema: T): (c: Context, next: Next) => Promise<void>;
/**
 * Validate path parameters with schema
 */
export declare function validateParams<T extends z.ZodSchema>(schema: T): (c: Context, next: Next) => Promise<void>;
/**
 * Get validated data from context
 */
export declare function getValidated<T = any>(c: Context, type: 'body' | 'query' | 'params' | 'headers'): T;
/**
 * Product creation/update schema
 */
export declare const productSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    short_description: z.ZodOptional<z.ZodString>;
    sku: z.ZodOptional<z.ZodString>;
    price: z.ZodOptional<z.ZodNumber>;
    sale_price: z.ZodOptional<z.ZodNumber>;
    stock_quantity: z.ZodOptional<z.ZodNumber>;
    status: z.ZodDefault<z.ZodEnum<["publish", "draft", "private"]>>;
    featured: z.ZodDefault<z.ZodBoolean>;
    categories: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    images: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    weight: z.ZodOptional<z.ZodNumber>;
    dimensions: z.ZodOptional<z.ZodObject<{
        length: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        length: number;
        width: number;
        height: number;
    }, {
        length: number;
        width: number;
        height: number;
    }>>;
    attributes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    status: "publish" | "draft" | "private";
    featured: boolean;
    name: string;
    description?: string | undefined;
    short_description?: string | undefined;
    sku?: string | undefined;
    price?: number | undefined;
    sale_price?: number | undefined;
    stock_quantity?: number | undefined;
    categories?: number[] | undefined;
    tags?: string[] | undefined;
    images?: string[] | undefined;
    weight?: number | undefined;
    dimensions?: {
        length: number;
        width: number;
        height: number;
    } | undefined;
    attributes?: Record<string, any> | undefined;
}, {
    name: string;
    status?: "publish" | "draft" | "private" | undefined;
    featured?: boolean | undefined;
    description?: string | undefined;
    short_description?: string | undefined;
    sku?: string | undefined;
    price?: number | undefined;
    sale_price?: number | undefined;
    stock_quantity?: number | undefined;
    categories?: number[] | undefined;
    tags?: string[] | undefined;
    images?: string[] | undefined;
    weight?: number | undefined;
    dimensions?: {
        length: number;
        width: number;
        height: number;
    } | undefined;
    attributes?: Record<string, any> | undefined;
}>;
/**
 * Cart item schema
 */
export declare const cartItemSchema: z.ZodObject<{
    product_id: z.ZodNumber;
    quantity: z.ZodNumber;
    variation_id: z.ZodOptional<z.ZodNumber>;
    variation: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    product_id: number;
    quantity: number;
    variation_id?: number | undefined;
    variation?: Record<string, string> | undefined;
}, {
    product_id: number;
    quantity: number;
    variation_id?: number | undefined;
    variation?: Record<string, string> | undefined;
}>;
/**
 * Order schema
 */
export declare const orderSchema: z.ZodObject<{
    customer_id: z.ZodOptional<z.ZodNumber>;
    billing: z.ZodObject<{
        first_name: z.ZodString;
        last_name: z.ZodString;
        email: z.ZodString;
        phone: z.ZodOptional<z.ZodString>;
        address_1: z.ZodString;
        address_2: z.ZodOptional<z.ZodString>;
        city: z.ZodString;
        state: z.ZodString;
        postcode: z.ZodString;
        country: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        email: string;
        first_name: string;
        last_name: string;
        address_1: string;
        city: string;
        state: string;
        postcode: string;
        country: string;
        phone?: string | undefined;
        address_2?: string | undefined;
    }, {
        email: string;
        first_name: string;
        last_name: string;
        address_1: string;
        city: string;
        state: string;
        postcode: string;
        country: string;
        phone?: string | undefined;
        address_2?: string | undefined;
    }>;
    shipping: z.ZodOptional<z.ZodObject<{
        first_name: z.ZodString;
        last_name: z.ZodString;
        address_1: z.ZodString;
        address_2: z.ZodOptional<z.ZodString>;
        city: z.ZodString;
        state: z.ZodString;
        postcode: z.ZodString;
        country: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        first_name: string;
        last_name: string;
        address_1: string;
        city: string;
        state: string;
        postcode: string;
        country: string;
        address_2?: string | undefined;
    }, {
        first_name: string;
        last_name: string;
        address_1: string;
        city: string;
        state: string;
        postcode: string;
        country: string;
        address_2?: string | undefined;
    }>>;
    line_items: z.ZodArray<z.ZodObject<{
        product_id: z.ZodNumber;
        quantity: z.ZodNumber;
        variation_id: z.ZodOptional<z.ZodNumber>;
        variation: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        product_id: number;
        quantity: number;
        variation_id?: number | undefined;
        variation?: Record<string, string> | undefined;
    }, {
        product_id: number;
        quantity: number;
        variation_id?: number | undefined;
        variation?: Record<string, string> | undefined;
    }>, "many">;
    shipping_method: z.ZodOptional<z.ZodString>;
    payment_method: z.ZodOptional<z.ZodString>;
    currency: z.ZodDefault<z.ZodEffects<z.ZodString, string, string>>;
    coupon_codes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    billing: {
        email: string;
        first_name: string;
        last_name: string;
        address_1: string;
        city: string;
        state: string;
        postcode: string;
        country: string;
        phone?: string | undefined;
        address_2?: string | undefined;
    };
    line_items: {
        product_id: number;
        quantity: number;
        variation_id?: number | undefined;
        variation?: Record<string, string> | undefined;
    }[];
    currency: string;
    customer_id?: number | undefined;
    shipping?: {
        first_name: string;
        last_name: string;
        address_1: string;
        city: string;
        state: string;
        postcode: string;
        country: string;
        address_2?: string | undefined;
    } | undefined;
    shipping_method?: string | undefined;
    payment_method?: string | undefined;
    coupon_codes?: string[] | undefined;
}, {
    billing: {
        email: string;
        first_name: string;
        last_name: string;
        address_1: string;
        city: string;
        state: string;
        postcode: string;
        country: string;
        phone?: string | undefined;
        address_2?: string | undefined;
    };
    line_items: {
        product_id: number;
        quantity: number;
        variation_id?: number | undefined;
        variation?: Record<string, string> | undefined;
    }[];
    customer_id?: number | undefined;
    shipping?: {
        first_name: string;
        last_name: string;
        address_1: string;
        city: string;
        state: string;
        postcode: string;
        country: string;
        address_2?: string | undefined;
    } | undefined;
    shipping_method?: string | undefined;
    payment_method?: string | undefined;
    currency?: string | undefined;
    coupon_codes?: string[] | undefined;
}>;
//# sourceMappingURL=validateRequest.d.ts.map