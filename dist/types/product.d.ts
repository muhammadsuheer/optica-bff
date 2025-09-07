import { SyncMetadata } from './api';
export interface ProductCategory {
    id: number;
    name: string;
    slug: string;
    description?: string;
    image?: ProductImage;
    count?: number;
}
export interface ProductTag {
    id: number;
    name: string;
    slug: string;
    description?: string;
    count?: number;
}
export interface ProductImage {
    id: number;
    src: string;
    alt: string;
    position: number;
    name?: string;
}
export interface ProductAttribute {
    id?: number;
    name: string;
    slug?: string;
    position?: number;
    visible?: boolean;
    variation?: boolean;
    options: string[];
}
export interface ProductVariation {
    id: number;
    sku?: string;
    price: string;
    regular_price?: string;
    sale_price?: string;
    stock_quantity?: number;
    stock_status: 'instock' | 'outofstock' | 'onbackorder';
    manage_stock?: boolean;
    attributes: Record<string, string>;
    image?: ProductImage;
    weight?: string;
    dimensions?: {
        length: string;
        width: string;
        height: string;
    };
    downloadable?: boolean;
    virtual?: boolean;
    created_at: string;
    updated_at: string;
}
export interface Product {
    id: number;
    wc_id: number;
    name: string;
    slug: string;
    permalink?: string;
    type: 'simple' | 'grouped' | 'external' | 'variable';
    status: 'draft' | 'pending' | 'private' | 'publish';
    featured: boolean;
    catalog_visibility: 'visible' | 'catalog' | 'search' | 'hidden';
    description?: string;
    short_description?: string;
    sku?: string;
    price: string;
    regular_price?: string;
    sale_price?: string;
    price_html?: string;
    on_sale: boolean;
    purchasable: boolean;
    total_sales: number;
    virtual: boolean;
    downloadable: boolean;
    downloads?: any[];
    download_limit?: number;
    download_expiry?: number;
    external_url?: string;
    button_text?: string;
    tax_status: 'taxable' | 'shipping' | 'none';
    tax_class?: string;
    manage_stock: boolean;
    stock_quantity?: number;
    stock_status: 'instock' | 'outofstock' | 'onbackorder';
    backorders: 'no' | 'notify' | 'yes';
    backorders_allowed: boolean;
    backordered: boolean;
    low_stock_amount?: number;
    sold_individually: boolean;
    weight?: string;
    dimensions: {
        length: string;
        width: string;
        height: string;
    };
    shipping_required: boolean;
    shipping_taxable: boolean;
    shipping_class?: string;
    shipping_class_id?: number;
    reviews_allowed: boolean;
    average_rating: string;
    rating_count: number;
    upsell_ids: number[];
    cross_sell_ids: number[];
    parent_id: number;
    purchase_note?: string;
    categories: ProductCategory[];
    tags: ProductTag[];
    images: ProductImage[];
    attributes: ProductAttribute[];
    default_attributes: Record<string, string>;
    variations: number[];
    grouped_products: number[];
    menu_order: number;
    price_range?: {
        min: string;
        max: string;
    };
    related_ids?: number[];
    meta_data?: Array<{
        id: number;
        key: string;
        value: any;
    }>;
    search_vector?: string;
    created_at: string;
    updated_at: string;
    synced_at: string;
    sync_metadata?: SyncMetadata;
}
export interface ProductQuery {
    page?: number;
    per_page?: number;
    search?: string;
    after?: string;
    before?: string;
    exclude?: number[];
    include?: number[];
    offset?: number;
    order?: 'asc' | 'desc';
    orderby?: 'date' | 'id' | 'include' | 'title' | 'slug' | 'price' | 'popularity' | 'rating' | 'menu_order';
    parent?: number[];
    parent_exclude?: number[];
    slug?: string;
    status?: 'draft' | 'pending' | 'private' | 'publish';
    type?: 'simple' | 'grouped' | 'external' | 'variable';
    sku?: string;
    featured?: boolean;
    category?: string;
    tag?: string;
    shipping_class?: string;
    attribute?: string;
    attribute_term?: string;
    tax_class?: 'standard' | 'reduced-rate' | 'zero-rate';
    on_sale?: boolean;
    min_price?: string;
    max_price?: string;
    stock_status?: 'instock' | 'outofstock' | 'onbackorder';
    in_stock?: boolean;
    manage_stock?: boolean;
    low_stock?: boolean;
}
export interface ProductCreateData {
    name: string;
    type?: 'simple' | 'grouped' | 'external' | 'variable';
    status?: 'draft' | 'pending' | 'private' | 'publish';
    featured?: boolean;
    catalog_visibility?: 'visible' | 'catalog' | 'search' | 'hidden';
    description?: string;
    short_description?: string;
    sku?: string;
    regular_price?: string;
    sale_price?: string;
    virtual?: boolean;
    downloadable?: boolean;
    downloads?: any[];
    download_limit?: number;
    download_expiry?: number;
    external_url?: string;
    button_text?: string;
    tax_status?: 'taxable' | 'shipping' | 'none';
    tax_class?: string;
    manage_stock?: boolean;
    stock_quantity?: number;
    stock_status?: 'instock' | 'outofstock' | 'onbackorder';
    backorders?: 'no' | 'notify' | 'yes';
    low_stock_amount?: number;
    sold_individually?: boolean;
    weight?: string;
    dimensions?: {
        length?: string;
        width?: string;
        height?: string;
    };
    shipping_class?: string;
    reviews_allowed?: boolean;
    upsell_ids?: number[];
    cross_sell_ids?: number[];
    parent_id?: number;
    purchase_note?: string;
    categories?: Array<{
        id: number;
        name?: string;
    }>;
    tags?: Array<{
        id?: number;
        name: string;
    }>;
    images?: Array<{
        src: string;
        alt?: string;
        position?: number;
    }>;
    attributes?: ProductAttribute[];
    default_attributes?: Record<string, string>;
    menu_order?: number;
    meta_data?: Array<{
        key: string;
        value: any;
    }>;
}
export interface ProductUpdateData extends Partial<ProductCreateData> {
    id?: number;
}
export interface ProductSearchResult {
    products: Product[];
    total: number;
    facets: {
        categories: Array<{
            slug: string;
            name: string;
            count: number;
        }>;
        tags: Array<{
            slug: string;
            name: string;
            count: number;
        }>;
        price_ranges: Array<{
            min: number;
            max: number;
            count: number;
        }>;
        attributes: Record<string, Array<{
            value: string;
            count: number;
        }>>;
    };
    suggestions: string[];
}
export interface ProductStockUpdate {
    product_id: number;
    variation_id?: number;
    stock_quantity: number;
    stock_status?: 'instock' | 'outofstock' | 'onbackorder';
    manage_stock?: boolean;
    low_stock_amount?: number;
}
export interface ProductPriceUpdate {
    product_id: number;
    variation_id?: number;
    regular_price?: string;
    sale_price?: string;
    date_on_sale_from?: string;
    date_on_sale_to?: string;
}
export interface ProductBulkOperation {
    action: 'update' | 'delete' | 'duplicate';
    product_ids: number[];
    data?: Partial<ProductUpdateData>;
}
export interface ProductImportData {
    products: ProductCreateData[];
    options: {
        update_existing?: boolean;
        skip_duplicates?: boolean;
        validate_only?: boolean;
    };
}
export interface ProductExportOptions {
    format: 'json' | 'csv' | 'xml';
    fields?: string[];
    filters?: ProductQuery;
    include_variations?: boolean;
    include_images?: boolean;
    include_metadata?: boolean;
}
//# sourceMappingURL=product.d.ts.map