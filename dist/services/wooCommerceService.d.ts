/**
 * WooCommerce Service - Edge Runtime Compatible
 *
 * Features:
 * - WooCommerce API integration
 * - Product synchronization
 * - Order management
 * - Customer management
 * - Webhook handling
 */
export interface WooCommerceProduct {
    id: number;
    name: string;
    slug: string;
    permalink: string;
    date_created: string;
    date_created_gmt: string;
    date_modified: string;
    date_modified_gmt: string;
    type: string;
    status: string;
    featured: boolean;
    catalog_visibility: string;
    description: string;
    short_description: string;
    sku: string;
    price: string;
    regular_price: string;
    sale_price: string;
    date_on_sale_from: string | null;
    date_on_sale_to: string | null;
    on_sale: boolean;
    purchasable: boolean;
    total_sales: number;
    virtual: boolean;
    downloadable: boolean;
    downloads: any[];
    download_limit: number;
    download_expiry: number;
    external_url: string;
    button_text: string;
    tax_status: string;
    tax_class: string;
    manage_stock: boolean;
    stock_quantity: number | null;
    stock_status: string;
    backorders: string;
    backorders_allowed: boolean;
    backordered: boolean;
    sold_individually: boolean;
    weight: string;
    dimensions: {
        length: string;
        width: string;
        height: string;
    };
    shipping_required: boolean;
    shipping_taxable: boolean;
    shipping_class: string;
    shipping_class_id: number;
    reviews_allowed: boolean;
    average_rating: string;
    rating_count: number;
    related_ids: number[];
    upsell_ids: number[];
    cross_sell_ids: number[];
    parent_id: number;
    purchase_note: string;
    categories: Array<{
        id: number;
        name: string;
        slug: string;
    }>;
    tags: Array<{
        id: number;
        name: string;
        slug: string;
    }>;
    images: Array<{
        id: number;
        date_created: string;
        date_created_gmt: string;
        date_modified: string;
        date_modified_gmt: string;
        src: string;
        name: string;
        alt: string;
    }>;
    attributes: Array<{
        id: number;
        name: string;
        position: number;
        visible: boolean;
        variation: boolean;
        options: string[];
    }>;
    default_attributes: any[];
    variations: number[];
    grouped_products: number[];
    menu_order: number;
    meta_data: Array<{
        id: number;
        key: string;
        value: any;
    }>;
}
export interface WooCommerceOrder {
    id: number;
    parent_id: number;
    status: string;
    currency: string;
    date_created: string;
    date_created_gmt: string;
    date_modified: string;
    date_modified_gmt: string;
    discount_total: string;
    discount_tax: string;
    shipping_total: string;
    shipping_tax: string;
    cart_tax: string;
    total: string;
    total_tax: string;
    customer_id: number;
    order_key: string;
    billing: {
        first_name: string;
        last_name: string;
        company: string;
        address_1: string;
        address_2: string;
        city: string;
        state: string;
        postcode: string;
        country: string;
        email: string;
        phone: string;
    };
    shipping: {
        first_name: string;
        last_name: string;
        company: string;
        address_1: string;
        address_2: string;
        city: string;
        state: string;
        postcode: string;
        country: string;
    };
    payment_method: string;
    payment_method_title: string;
    transaction_id: string;
    customer_ip_address: string;
    customer_user_agent: string;
    created_via: string;
    customer_note: string;
    date_completed: string | null;
    date_paid: string | null;
    cart_hash: string;
    number: string;
    meta_data: Array<{
        id: number;
        key: string;
        value: any;
    }>;
    line_items: Array<{
        id: number;
        name: string;
        product_id: number;
        variation_id: number;
        quantity: number;
        tax_class: string;
        subtotal: string;
        subtotal_tax: string;
        total: string;
        total_tax: string;
        taxes: any[];
        meta_data: Array<{
            id: number;
            key: string;
            value: any;
        }>;
        sku: string;
        price: number;
    }>;
    tax_lines: any[];
    shipping_lines: any[];
    fee_lines: any[];
    coupon_lines: any[];
    refunds: any[];
    payment_url: string;
    is_editable: boolean;
    needs_payment: boolean;
    needs_processing: boolean;
    date_created_gmt: string;
    date_modified_gmt: string;
    date_completed_gmt: string | null;
    date_paid_gmt: string | null;
    currency_symbol: string;
}
declare class WooCommerceService {
    private baseUrl;
    private consumerKey;
    private consumerSecret;
    constructor();
    /**
     * Make authenticated request to WooCommerce API
     */
    private makeRequest;
    /**
     * Get products from WooCommerce
     */
    getProducts(params?: {
        page?: number;
        per_page?: number;
        search?: string;
        status?: string;
        featured?: boolean;
        category?: string;
        orderby?: string;
        order?: 'asc' | 'desc';
    }): Promise<WooCommerceProduct[]>;
    /**
     * Get a single product from WooCommerce
     */
    getProduct(id: number): Promise<WooCommerceProduct | null>;
    /**
     * Get orders from WooCommerce
     */
    getOrders(params?: {
        page?: number;
        per_page?: number;
        status?: string;
        customer?: number;
        orderby?: string;
        order?: 'asc' | 'desc';
    }): Promise<WooCommerceOrder[]>;
    /**
     * Get a single order from WooCommerce
     */
    getOrder(id: number): Promise<WooCommerceOrder | null>;
    /**
     * Update order status
     */
    updateOrderStatus(id: number, status: string): Promise<WooCommerceOrder | null>;
    /**
     * Sync product from WooCommerce to local database
     */
    syncProduct(wcProduct: WooCommerceProduct): Promise<boolean>;
    /**
     * Sync multiple products from WooCommerce
     */
    syncProducts(wcProducts: WooCommerceProduct[]): Promise<{
        synced: number;
        failed: number;
    }>;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        healthy: boolean;
        latency: number;
        error?: string;
    }>;
}
export declare const wooCommerceService: WooCommerceService;
export { WooCommerceService };
export type { WooCommerceProduct, WooCommerceOrder };
//# sourceMappingURL=wooCommerceService.d.ts.map