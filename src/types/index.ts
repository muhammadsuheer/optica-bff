import type { Context } from 'hono';

/**
 * Pre-allocated error objects for performance optimization
 * Reduces garbage collection pressure by reusing error objects
 */
export const PreAllocatedErrors = {
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
  },
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required',
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    message: 'Access denied',
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    message: 'Resource not found',
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  },
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    message: 'Service temporarily unavailable',
  },
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    message: 'Token has expired',
  },
  PRODUCT_NOT_FOUND: {
    code: 'PRODUCT_NOT_FOUND',
    message: 'Product not found',
  },
} as const;

/**
 * Extended Hono context with auth user
 */
export interface AuthContext extends Context {
  user?: AuthUser;
}

/**
 * Authenticated user information
 */
export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  roles: string[];
}

/**
 * WooCommerce product from GraphQL
 */
export interface WPProduct {
  id: string;
  databaseId: number;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  sku: string;
  price: string;
  regularPrice: string;
  salePrice: string;
  onSale: boolean;
  status: string;
  catalogVisibility: string;
  featured: boolean;
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  image: {
    sourceUrl: string;
    altText: string;
  };
  galleryImages: {
    nodes: Array<{
      sourceUrl: string;
      altText: string;
    }>;
  };
  productCategories: {
    nodes: Array<{
      id: string;
      name: string;
      slug: string;
    }>;
  };
  productTags: {
    nodes: Array<{
      id: string;
      name: string;
      slug: string;
    }>;
  };
  attributes: {
    nodes: Array<{
      id: string;
      name: string;
      options: string[];
    }>;
  };
}

/**
 * WooCommerce product stock info from REST API
 */
export interface WooStockInfo {
  id: number;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  stock_quantity: number | null;
  manage_stock: boolean;
  backorders: 'no' | 'notify' | 'yes';
  backorders_allowed: boolean;
  backordered: boolean;
}

/**
 * Merged product data for API response
 */
/**
 * WooCommerce API compatible product interface
 */
export interface ApiProduct {
  id: number;
  name: string;
  slug: string;
  permalink?: string;
  date_created: string;
  date_modified: string;
  type: string;
  status: string;
  featured: boolean;
  catalog_visibility: string;
  description: string;
  short_description: string;
  sku: string;
  price: number;
  regular_price: string;
  sale_price: string | null;
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
  dimensions: any;
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
  tags: any[];
  images: Array<{
    id: number;
    date_created: string;
    date_modified: string;
    src: string;
    name: string;
    alt: string;
  }>;
  attributes: any[];
  default_attributes: any[];
  variations: any[];
  grouped_products: any[];
  menu_order: number;
  price_html: string;
  meta_data: any[];
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    total?: number;
    page?: number;
    perPage?: number;
    totalPages?: number;
  };
}

/**
 * Health check response
 */
export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    redis: 'connected' | 'disconnected';
    wordpress: 'connected' | 'disconnected';
    woocommerce: 'connected' | 'disconnected';
    database: 'connected' | 'disconnected';
  };
  uptime: number;
  version: string;
}

/**
 * Cache entry structure
 */
export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Rate limiter options
 */
export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (context: Context) => string;
}

/**
 * Cart item interface
 */
export interface CartItem {
  key: string;
  product_id: number;
  variation_id?: number;
  quantity: number;
  price: number;
  subtotal: number;
  name: string;
  image?: string | null;
  variation?: Record<string, string>;
}

/**
 * Cart coupon interface
 */
export interface CartCoupon {
  code: string;
  discount_type: 'percent' | 'fixed_cart' | 'fixed_product';
  discount_amount: number;
  description: string;
}

/**
 * Shopping cart interface
 */
export interface Cart {
  items: CartItem[];
  subtotal: number;
  total: number;
  tax_total: number;
  shipping_total: number;
  discount_total: number;
  coupons: CartCoupon[];
  currency: string;
  item_count: number;
}

/**
 * Order item interface
 */
export interface OrderItem {
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
  meta_data: any[];
  sku: string;
  price: number;
}

/**
 * Billing address interface
 */
export interface BillingAddress {
  first_name: string;
  last_name: string;
  company?: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email: string;
  phone?: string;
}

/**
 * Shipping address interface
 */
export interface ShippingAddress {
  first_name: string;
  last_name: string;
  company?: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

/**
 * Order interface
 */
export interface Order {
  id: number;
  number: string;
  status: 'pending' | 'processing' | 'on-hold' | 'completed' | 'cancelled' | 'refunded' | 'failed';
  currency: string;
  date_created: string;
  date_modified: string;
  discount_total: string;
  shipping_total: string;
  shipping_tax: string;
  cart_tax: string;
  total: string;
  total_tax: string;
  customer_id: number;
  billing: BillingAddress;
  shipping: ShippingAddress;
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
  line_items: OrderItem[];
  tax_lines: any[];
  shipping_lines: any[];
  fee_lines: any[];
  coupon_lines: any[];
  refunds: any[];
}

/**
 * Customer address interface
 */
export interface CustomerAddress {
  id: number;
  type: 'billing' | 'shipping';
  first_name: string;
  last_name: string;
  company?: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone?: string;
  is_default?: boolean;
}

/**
 * Customer interface
 */
export interface Customer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  username: string;
  avatar_url: string;
  date_created: string;
  date_modified: string;
  last_login: string | null;
  role: string;
  is_paying_customer: boolean;
  orders_count: number;
  total_spent: string;
  billing: BillingAddress;
  shipping: ShippingAddress;
  meta_data: any[];
}
