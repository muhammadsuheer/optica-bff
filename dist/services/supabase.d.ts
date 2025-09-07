import { SupabaseClient } from '@supabase/supabase-js';
interface Database {
    public: {
        Tables: {
            products: {
                Row: {
                    id: number;
                    wc_id: number;
                    name: string;
                    slug: string;
                    description: string | null;
                    short_description: string | null;
                    price: number | null;
                    regular_price: number | null;
                    sale_price: number | null;
                    status: string;
                    stock_quantity: number | null;
                    stock_status: string;
                    manage_stock: boolean;
                    categories: any;
                    tags: any;
                    images: any;
                    attributes: any;
                    variations: any;
                    meta_data: any;
                    search_vector: string | null;
                    created_at: string;
                    updated_at: string;
                    synced_at: string;
                };
                Insert: {
                    wc_id: number;
                    name: string;
                    slug: string;
                    description?: string | null;
                    short_description?: string | null;
                    price?: number | null;
                    regular_price?: number | null;
                    sale_price?: number | null;
                    status?: string;
                    stock_quantity?: number | null;
                    stock_status?: string;
                    manage_stock?: boolean;
                    categories?: any;
                    tags?: any;
                    images?: any;
                    attributes?: any;
                    variations?: any;
                    meta_data?: any;
                    search_vector?: string | null;
                    created_at?: string;
                    updated_at?: string;
                    synced_at?: string;
                };
                Update: {
                    wc_id?: number;
                    name?: string;
                    slug?: string;
                    description?: string | null;
                    short_description?: string | null;
                    price?: number | null;
                    regular_price?: number | null;
                    sale_price?: number | null;
                    status?: string;
                    stock_quantity?: number | null;
                    stock_status?: string;
                    manage_stock?: boolean;
                    categories?: any;
                    tags?: any;
                    images?: any;
                    attributes?: any;
                    variations?: any;
                    meta_data?: any;
                    search_vector?: string | null;
                    created_at?: string;
                    updated_at?: string;
                    synced_at?: string;
                };
            };
            orders: {
                Row: {
                    id: number;
                    wc_id: number;
                    order_key: string;
                    status: string;
                    currency: string;
                    total: number;
                    subtotal: number;
                    tax_total: number;
                    shipping_total: number;
                    customer_id: number | null;
                    customer_note: string | null;
                    billing: any;
                    shipping: any;
                    line_items: any;
                    shipping_lines: any;
                    tax_lines: any;
                    fee_lines: any;
                    coupon_lines: any;
                    payment_method: string | null;
                    payment_method_title: string | null;
                    transaction_id: string | null;
                    date_created: string;
                    date_modified: string;
                    date_completed: string | null;
                    date_paid: string | null;
                    synced_at: string;
                };
                Insert: {
                    wc_id: number;
                    order_key: string;
                    status: string;
                    currency: string;
                    total: number;
                    subtotal: number;
                    tax_total?: number;
                    shipping_total?: number;
                    customer_id?: number | null;
                    customer_note?: string | null;
                    billing: any;
                    shipping: any;
                    line_items: any;
                    shipping_lines?: any;
                    tax_lines?: any;
                    fee_lines?: any;
                    coupon_lines?: any;
                    payment_method?: string | null;
                    payment_method_title?: string | null;
                    transaction_id?: string | null;
                    date_created: string;
                    date_modified: string;
                    date_completed?: string | null;
                    date_paid?: string | null;
                    synced_at?: string;
                };
                Update: {
                    wc_id?: number;
                    order_key?: string;
                    status?: string;
                    currency?: string;
                    total?: number;
                    subtotal?: number;
                    tax_total?: number;
                    shipping_total?: number;
                    customer_id?: number | null;
                    customer_note?: string | null;
                    billing?: any;
                    shipping?: any;
                    line_items?: any;
                    shipping_lines?: any;
                    tax_lines?: any;
                    fee_lines?: any;
                    coupon_lines?: any;
                    payment_method?: string | null;
                    payment_method_title?: string | null;
                    transaction_id?: string | null;
                    date_created?: string;
                    date_modified?: string;
                    date_completed?: string | null;
                    date_paid?: string | null;
                    synced_at?: string;
                };
            };
            carts: {
                Row: {
                    id: number;
                    session_id: string;
                    user_id: number | null;
                    items: any;
                    totals: any;
                    coupons: any;
                    shipping: any;
                    billing: any;
                    status: string;
                    expires_at: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    session_id: string;
                    user_id?: number | null;
                    items: any;
                    totals: any;
                    coupons?: any;
                    shipping?: any;
                    billing?: any;
                    status?: string;
                    expires_at?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    session_id?: string;
                    user_id?: number | null;
                    items?: any;
                    totals?: any;
                    coupons?: any;
                    shipping?: any;
                    billing?: any;
                    status?: string;
                    expires_at?: string;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            api_keys: {
                Row: {
                    id: number;
                    key_hash: string;
                    name: string;
                    permissions: any;
                    rate_limit: number;
                    rate_window: number;
                    is_active: boolean;
                    last_used_at: string | null;
                    usage_count: number;
                    created_at: string;
                    expires_at: string | null;
                };
                Insert: {
                    key_hash: string;
                    name: string;
                    permissions: any;
                    rate_limit?: number;
                    rate_window?: number;
                    is_active?: boolean;
                    last_used_at?: string | null;
                    usage_count?: number;
                    created_at?: string;
                    expires_at?: string | null;
                };
                Update: {
                    key_hash?: string;
                    name?: string;
                    permissions?: any;
                    rate_limit?: number;
                    rate_window?: number;
                    is_active?: boolean;
                    last_used_at?: string | null;
                    usage_count?: number;
                    created_at?: string;
                    expires_at?: string | null;
                };
            };
            cache_index: {
                Row: {
                    id: number;
                    cache_key: string;
                    resource_type: string;
                    resource_ids: number[];
                    tags: string[];
                    data: any;
                    expires_at: string;
                    created_at: string;
                    accessed_at: string;
                    hit_count: number;
                };
                Insert: {
                    cache_key: string;
                    resource_type: string;
                    resource_ids?: number[];
                    tags?: string[];
                    data: any;
                    expires_at: string;
                    created_at?: string;
                    accessed_at?: string;
                    hit_count?: number;
                };
                Update: {
                    cache_key?: string;
                    resource_type?: string;
                    resource_ids?: number[];
                    tags?: string[];
                    data?: any;
                    expires_at?: string;
                    created_at?: string;
                    accessed_at?: string;
                    hit_count?: number;
                };
            };
            webhooks_log: {
                Row: {
                    id: number;
                    webhook_id: string | null;
                    topic: string;
                    resource: string;
                    resource_id: number;
                    event: string;
                    payload: any;
                    signature: string | null;
                    processed: boolean;
                    processed_at: string | null;
                    error_message: string | null;
                    retry_count: number;
                    created_at: string;
                };
                Insert: {
                    webhook_id?: string | null;
                    topic: string;
                    resource: string;
                    resource_id: number;
                    event: string;
                    payload: any;
                    signature?: string | null;
                    processed?: boolean;
                    processed_at?: string | null;
                    error_message?: string | null;
                    retry_count?: number;
                    created_at?: string;
                };
                Update: {
                    webhook_id?: string | null;
                    topic?: string;
                    resource?: string;
                    resource_id?: number;
                    event?: string;
                    payload?: any;
                    signature?: string | null;
                    processed?: boolean;
                    processed_at?: string | null;
                    error_message?: string | null;
                    retry_count?: number;
                    created_at?: string;
                };
            };
            rate_limits: {
                Row: {
                    id: number;
                    client_id: string;
                    endpoint: string;
                    method: string;
                    status_code: number | null;
                    user_agent: string | null;
                    ip_address: string | null;
                    created_at: string;
                };
                Insert: {
                    client_id: string;
                    endpoint: string;
                    method: string;
                    status_code?: number | null;
                    user_agent?: string | null;
                    ip_address?: string | null;
                    created_at?: string;
                };
                Update: {
                    client_id?: string;
                    endpoint?: string;
                    method?: string;
                    status_code?: number | null;
                    user_agent?: string | null;
                    ip_address?: string | null;
                    created_at?: string;
                };
            };
            metrics: {
                Row: {
                    id: number;
                    name: string;
                    value: number;
                    tags: any;
                    timestamp: string;
                };
                Insert: {
                    name: string;
                    value: number;
                    tags?: any;
                    timestamp: string;
                };
                Update: {
                    name?: string;
                    value?: number;
                    tags?: any;
                    timestamp?: string;
                };
            };
        };
    };
}
declare class SupabaseService {
    private client;
    private backupClients;
    private currentClientIndex;
    constructor();
    getClient(): SupabaseClient<Database>;
    executeWithFailover<T>(operation: (client: SupabaseClient<Database>) => Promise<T>, maxRetries?: number): Promise<T>;
    healthCheck(): Promise<{
        primary: {
            healthy: boolean;
            latency: number;
            error?: string;
        };
        backups: Array<{
            healthy: boolean;
            latency: number;
            error?: string;
        }>;
    }>;
    from<T extends keyof Database['public']['Tables']>(table: T): Promise<import("@supabase/postgrest-js").PostgrestQueryBuilder<{
        PostgrestVersion: "12";
    }, never, never[T], T, never[T] extends infer T_1 ? T_1 extends never[T] ? T_1 extends {
        Relationships: infer R;
    } ? R : unknown : never : never>>;
    rpc(fn: string, args?: any): Promise<any>;
    transaction<T>(operations: (client: SupabaseClient<Database>) => Promise<T>): Promise<T>;
    channel(topic: string): import("@supabase/realtime-js").RealtimeChannel;
    get storage(): import("@supabase/storage-js").StorageClient;
    get auth(): import("@supabase/supabase-js/dist/module/lib/SupabaseAuthClient").SupabaseAuthClient;
}
export declare const supabase: SupabaseService;
export declare const supabaseClient: SupabaseClient<Database, "public", "public", never, {
    PostgrestVersion: "12";
}>;
export type { Database };
//# sourceMappingURL=supabase.d.ts.map