import { PrismaClient } from '@prisma/client';
/**
 * TransformationService - Handles data transformation between WooCommerce APIs and database models
 */
export class TransformationService {
    /**
     * Transform WooCommerce product to database format
     */
    static transformProduct(wooProduct) {
        return {
            woocommerceId: parseInt(wooProduct.id?.toString() || '0'),
            name: wooProduct.name || '',
            description: wooProduct.description || null,
            price: parseFloat(wooProduct.price || '0'),
            salePrice: wooProduct.sale_price ? parseFloat(wooProduct.sale_price) : null,
            stockQuantity: wooProduct.stock_quantity || null,
            status: wooProduct.status || 'draft',
            categoryIds: wooProduct.categories?.map((cat) => parseInt(cat.id)) || [],
            images: wooProduct.images?.map((img) => img.src) || [],
            metadata: {
                sku: wooProduct.sku || '',
                slug: wooProduct.slug || '',
                permalink: wooProduct.permalink || '',
                type: wooProduct.type || 'simple',
                featured: wooProduct.featured || false,
                catalog_visibility: wooProduct.catalog_visibility || 'visible',
                short_description: wooProduct.short_description || '',
                regular_price: wooProduct.regular_price || '',
                on_sale: wooProduct.on_sale || false,
                purchasable: wooProduct.purchasable || false,
                total_sales: wooProduct.total_sales || 0,
                virtual: wooProduct.virtual || false,
                downloadable: wooProduct.downloadable || false,
                tax_status: wooProduct.tax_status || 'taxable',
                tax_class: wooProduct.tax_class || '',
                manage_stock: wooProduct.manage_stock || false,
                stock_status: wooProduct.stock_status || 'instock',
                backorders: wooProduct.backorders || 'no',
                sold_individually: wooProduct.sold_individually || false,
                weight: wooProduct.weight || '',
                dimensions: wooProduct.dimensions || {},
                shipping_required: wooProduct.shipping_required || true,
                shipping_taxable: wooProduct.shipping_taxable || true,
                shipping_class: wooProduct.shipping_class || '',
                reviews_allowed: wooProduct.reviews_allowed || true,
                average_rating: wooProduct.average_rating || '0',
                rating_count: wooProduct.rating_count || 0,
                related_ids: wooProduct.related_ids || [],
                upsell_ids: wooProduct.upsell_ids || [],
                cross_sell_ids: wooProduct.cross_sell_ids || [],
                parent_id: wooProduct.parent_id || 0,
                purchase_note: wooProduct.purchase_note || '',
                tags: wooProduct.tags || [],
                attributes: wooProduct.attributes || [],
                default_attributes: wooProduct.default_attributes || [],
                variations: wooProduct.variations || [],
                grouped_products: wooProduct.grouped_products || [],
                menu_order: wooProduct.menu_order || 0,
                price_html: wooProduct.price_html || '',
                meta_data: wooProduct.meta_data || []
            }
        };
    }
    /**
     * Transform WooCommerce category to database format
     */
    static transformCategory(wooCategory) {
        return {
            woocommerceId: parseInt(wooCategory.id?.toString() || '0'),
            name: wooCategory.name || '',
            slug: wooCategory.slug || '',
            description: wooCategory.description || null,
            parentId: wooCategory.parent ? parseInt(wooCategory.parent.toString()) : null,
            image: wooCategory.image?.src || null,
            count: parseInt(wooCategory.count?.toString() || '0'),
            metadata: {
                display: wooCategory.display || 'default',
                menu_order: wooCategory.menu_order || 0,
                meta_data: wooCategory.meta_data || []
            }
        };
    }
    /**
     * Transform WooCommerce order to database format
     */
    static transformOrder(wooOrder) {
        return {
            woocommerceId: parseInt(wooOrder.id?.toString() || '0'),
            status: wooOrder.status || 'pending',
            currency: wooOrder.currency || 'USD',
            total: parseFloat(wooOrder.total || '0'),
            subtotal: parseFloat(wooOrder.subtotal || '0'),
            totalTax: parseFloat(wooOrder.total_tax || '0'),
            shippingTotal: parseFloat(wooOrder.shipping_total || '0'),
            customerId: wooOrder.customer_id ? parseInt(wooOrder.customer_id.toString()) : null,
            customerEmail: wooOrder.billing?.email || '',
            billingAddress: wooOrder.billing || {},
            shippingAddress: wooOrder.shipping || {},
            lineItems: wooOrder.line_items || [],
            metadata: {
                number: wooOrder.number || '',
                order_key: wooOrder.order_key || '',
                date_created: wooOrder.date_created || '',
                date_modified: wooOrder.date_modified || '',
                date_completed: wooOrder.date_completed || null,
                date_paid: wooOrder.date_paid || null,
                cart_hash: wooOrder.cart_hash || '',
                payment_method: wooOrder.payment_method || '',
                payment_method_title: wooOrder.payment_method_title || '',
                transaction_id: wooOrder.transaction_id || '',
                customer_ip_address: wooOrder.customer_ip_address || '',
                customer_user_agent: wooOrder.customer_user_agent || '',
                created_via: wooOrder.created_via || '',
                customer_note: wooOrder.customer_note || '',
                discount_total: wooOrder.discount_total || '0',
                discount_tax: wooOrder.discount_tax || '0',
                shipping_lines: wooOrder.shipping_lines || [],
                tax_lines: wooOrder.tax_lines || [],
                fee_lines: wooOrder.fee_lines || [],
                coupon_lines: wooOrder.coupon_lines || [],
                refunds: wooOrder.refunds || [],
                meta_data: wooOrder.meta_data || []
            }
        };
    }
    /**
     * Transform WooCommerce customer to database format
     */
    static transformCustomer(wooCustomer) {
        return {
            woocommerceId: parseInt(wooCustomer.id?.toString() || '0'),
            email: wooCustomer.email || '',
            username: wooCustomer.username || '',
            firstName: wooCustomer.first_name || '',
            lastName: wooCustomer.last_name || '',
            role: wooCustomer.role || 'customer',
            billingAddress: wooCustomer.billing || {},
            shippingAddress: wooCustomer.shipping || {},
            avatarUrl: wooCustomer.avatar_url || null,
            metadata: {
                date_created: wooCustomer.date_created || '',
                date_modified: wooCustomer.date_modified || '',
                is_paying_customer: wooCustomer.is_paying_customer || false,
                orders_count: wooCustomer.orders_count || 0,
                total_spent: wooCustomer.total_spent || '0',
                meta_data: wooCustomer.meta_data || []
            }
        };
    }
    /**
     * Create webhook event record
     */
    static createWebhookEvent(eventType, resourceType, resourceId, payload) {
        return {
            id: `${eventType}_${resourceType}_${resourceId}_${Date.now()}`,
            eventType,
            resourceType,
            resourceId,
            payload,
            processed: false
        };
    }
}
