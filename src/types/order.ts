import { SyncMetadata } from './api'

// Order status types
export type OrderStatus = 
  | 'pending'
  | 'processing' 
  | 'on-hold'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'failed'
  | 'checkout-draft'

// Address types
export interface Address {
  first_name: string
  last_name: string
  company?: string
  address_1: string
  address_2?: string
  city: string
  state: string
  postcode: string
  country: string
  email?: string
  phone?: string
}

// Line item types
export interface OrderLineItem {
  id: number
  name: string
  product_id: number
  variation_id?: number
  quantity: number
  tax_class?: string
  subtotal: string
  subtotal_tax: string
  total: string
  total_tax: string
  taxes: Array<{
    id: number
    total: string
    subtotal: string
  }>
  meta_data: Array<{
    id: number
    key: string
    value: any
    display_key?: string
    display_value?: string
  }>
  sku?: string
  price: string
  image?: {
    id: string
    src: string
  }
  parent_name?: string
}

// Shipping line types
export interface OrderShippingLine {
  id: number
  method_title: string
  method_id: string
  instance_id?: string
  total: string
  total_tax: string
  taxes: Array<{
    id: number
    total: string
  }>
  meta_data: Array<{
    id: number
    key: string
    value: any
  }>
}

// Tax line types
export interface OrderTaxLine {
  id: number
  rate_code: string
  rate_id: number
  label: string
  compound: boolean
  tax_total: string
  shipping_tax_total: string
  rate_percent: number
  meta_data: Array<{
    id: number
    key: string
    value: any
  }>
}

// Fee line types
export interface OrderFeeLine {
  id: number
  name: string
  tax_class?: string
  tax_status: 'taxable' | 'none'
  total: string
  total_tax: string
  taxes: Array<{
    id: number
    total: string
    subtotal: string
  }>
  meta_data: Array<{
    id: number
    key: string
    value: any
  }>
}

// Coupon line types
export interface OrderCouponLine {
  id: number
  code: string
  discount: string
  discount_tax: string
  meta_data: Array<{
    id: number
    key: string
    value: any
  }>
}

// Refund types
export interface OrderRefund {
  id: number
  date_created: string
  // date_created_gmt: string // Duplicate removed
  amount: string
  reason?: string
  refunded_by: number
  refunded_payment?: boolean
  meta_data: Array<{
    id: number
    key: string
    value: any
  }>
  line_items: Array<{
    id: number
    name: string
    product_id: number
    variation_id?: number
    quantity: number
    tax_class?: string
    subtotal: string
    subtotal_tax: string
    total: string
    total_tax: string
    taxes: Array<{
      id: number
      total: string
      subtotal: string
    }>
    meta_data: Array<{
      id: number
      key: string
      value: any
    }>
  }>
}

// Main order interface
export interface Order {
  id: number
  wc_id: number
  parent_id: number
  status: OrderStatus
  currency: string
  version: string
  prices_include_tax: boolean
  date_created: string
  date_modified: string
  discount_total: string
  discount_tax: string
  shipping_total: string
  shipping_tax: string
  cart_tax: string
  total: string
  total_tax: string
  customer_id: number
  order_key: string
  billing: Address
  shipping: Address
  payment_method: string
  payment_method_title: string
  transaction_id?: string
  customer_ip_address?: string
  customer_user_agent?: string
  created_via: string
  customer_note?: string
  date_completed?: string
  date_paid?: string
  cart_hash?: string
  number: string
  line_items: OrderLineItem[]
  tax_lines: OrderTaxLine[]
  shipping_lines: OrderShippingLine[]
  fee_lines: OrderFeeLine[]
  coupon_lines: OrderCouponLine[]
  refunds: OrderRefund[]
  payment_url?: string
  is_editable: boolean
  needs_payment: boolean
  needs_processing: boolean
  // date_created_gmt: string // Duplicate removed
  date_modified_gmt: string
  date_completed_gmt?: string
  date_paid_gmt?: string
  currency_symbol?: string
  meta_data: Array<{
    id: number
    key: string
    value: any
  }>
  synced_at: string
  sync_metadata?: SyncMetadata
}

// Order query parameters
export interface OrderQuery {
  page?: number
  per_page?: number
  search?: string
  after?: string
  before?: string
  exclude?: number[]
  include?: number[]
  offset?: number
  order?: 'asc' | 'desc'
  orderby?: 'date' | 'id' | 'include' | 'title' | 'slug'
  parent?: number[]
  parent_exclude?: number[]
  status?: OrderStatus[]
  customer?: number
  product?: number
  dp?: number
  modified_after?: string
  modified_before?: string
  dates_are_gmt?: boolean
}

// Order creation data
export interface OrderCreateData {
  parent_id?: number
  status?: OrderStatus
  currency?: string
  customer_id?: number
  customer_note?: string
  billing: Address
  shipping?: Address
  payment_method?: string
  payment_method_title?: string
  transaction_id?: string
  line_items: Array<{
    product_id: number
    variation_id?: number
    quantity: number
    price?: string
    meta_data?: Array<{
      key: string
      value: any
    }>
  }>
  shipping_lines?: Array<{
    method_id: string
    method_title: string
    total: string
    meta_data?: Array<{
      key: string
      value: any
    }>
  }>
  fee_lines?: Array<{
    name: string
    tax_class?: string
    tax_status?: 'taxable' | 'none'
    total: string
    meta_data?: Array<{
      key: string
      value: any
    }>
  }>
  coupon_lines?: Array<{
    code: string
    meta_data?: Array<{
      key: string
      value: any
    }>
  }>
  set_paid?: boolean
  meta_data?: Array<{
    key: string
    value: any
  }>
}

// Order update data
export interface OrderUpdateData extends Partial<OrderCreateData> {
  id?: number
}

// Order note
export interface OrderNote {
  id: number
  author: string
  date_created: string
  // date_created_gmt: string // Duplicate removed
  note: string
  customer_note: boolean
  added_by_user: boolean
}

// Order note creation
export interface OrderNoteCreateData {
  note: string
  customer_note?: boolean
  added_by_user?: boolean
}

// Order statistics
export interface OrderStats {
  total_orders: number
  total_sales: string
  average_order_value: string
  orders_by_status: Record<OrderStatus, number>
  orders_by_period: Array<{
    period: string
    orders: number
    sales: string
  }>
  top_products: Array<{
    product_id: number
    name: string
    quantity: number
    total: string
  }>
  top_customers: Array<{
    customer_id: number
    name: string
    orders: number
    total: string
  }>
}

// Cart item (for optimistic updates)
export interface CartItem {
  item_id: string
  product_id: number
  variation_id?: number
  name: string
  quantity: number
  price: string
  total: string
  sku?: string
  image?: string
  attributes?: Record<string, string>
  meta_data?: Array<{
    key: string
    value: any
  }>
  status?: 'synced' | 'pending_sync' | 'failed'
}

// Cart totals
export interface CartTotals {
  subtotal: string
  subtotal_tax: string
  shipping_total: string
  shipping_tax: string
  discount_total: string
  discount_tax: string
  cart_contents_total: string
  cart_contents_tax: string
  cart_contents_count: number
  fee_total: string
  fee_tax: string
  total: string
  total_tax: string
}

// Cart session
export interface Cart {
  session_id: string
  user_id?: number
  items: CartItem[]
  totals: CartTotals
  coupons: Array<{
    code: string
    discount: string
  }>
  shipping: {
    method_id?: string
    method_title?: string
    total?: string
  }
  billing?: Partial<Address>
  status: 'active' | 'abandoned' | 'converted' | 'expired'
  expires_at: string
  created_at: string
  // updated_at: string // Optional field
}

// Cart operations
export interface CartAddItemData {
  product_id: number
  variation_id?: number
  quantity: number
  attributes?: Record<string, string>
  meta_data?: Array<{
    key: string
    value: any
  }>
  optimistic?: boolean
}

export interface CartUpdateItemData {
  item_id: string
  quantity: number
  optimistic?: boolean
}

export interface CartApplyCouponData {
  code: string
}

export interface CartUpdateShippingData {
  method_id: string
  method_title: string
  total: string
}

export interface CartUpdateBillingData {
  billing: Partial<Address>
}

// Order fulfillment
export interface OrderFulfillment {
  order_id: number
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  tracking_number?: string
  tracking_url?: string
  carrier?: string
  shipped_at?: string
  delivered_at?: string
  items: Array<{
    line_item_id: number
    quantity: number
  }>
  notes?: string
}
