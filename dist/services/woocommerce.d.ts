import type { Product, ProductQuery, ProductCreateData, ProductUpdateData } from '../types/product';
import type { Order, OrderQuery, OrderCreateData, OrderUpdateData } from '../types/order';
declare class WooCommerceService {
    private readOnlyClient;
    private readWriteClient;
    private lastKeyRotation;
    private readonly maxRetries;
    private readonly baseDelay;
    constructor();
    private createClient;
    private executeWithRetry;
    getProducts(params?: ProductQuery): Promise<{
        data: Product[];
        headers: any;
    }>;
    getProduct(id: number, params?: any): Promise<{
        data: Product;
        headers: any;
    }>;
    getProductVariations(productId: number, params?: any): Promise<{
        data: any[];
        headers: any;
    }>;
    getProductVariation(productId: number, variationId: number): Promise<{
        data: any;
        headers: any;
    }>;
    getProductCategories(params?: any): Promise<{
        data: any[];
        headers: any;
    }>;
    getProductTags(params?: any): Promise<{
        data: any[];
        headers: any;
    }>;
    getOrders(params?: OrderQuery): Promise<{
        data: Order[];
        headers: any;
    }>;
    getOrder(id: number, params?: any): Promise<{
        data: Order;
        headers: any;
    }>;
    getOrderNotes(orderId: number, params?: any): Promise<{
        data: any[];
        headers: any;
    }>;
    getCustomers(params?: any): Promise<{
        data: any[];
        headers: any;
    }>;
    getCustomer(id: number, params?: any): Promise<{
        data: any;
        headers: any;
    }>;
    createProduct(productData: ProductCreateData): Promise<{
        data: Product;
        headers: any;
    }>;
    updateProduct(id: number, productData: ProductUpdateData): Promise<{
        data: Product;
        headers: any;
    }>;
    deleteProduct(id: number, force?: boolean): Promise<{
        data: Product;
        headers: any;
    }>;
    batchUpdateProducts(data: {
        create?: ProductCreateData[];
        update?: ProductUpdateData[];
        delete?: number[];
    }): Promise<{
        data: any;
        headers: any;
    }>;
    updateProductStock(id: number, stockData: {
        stock_quantity?: number;
        stock_status?: 'instock' | 'outofstock' | 'onbackorder';
        manage_stock?: boolean;
    }): Promise<{
        data: Product;
        headers: any;
    }>;
    createOrder(orderData: OrderCreateData): Promise<{
        data: Order;
        headers: any;
    }>;
    updateOrder(id: number, orderData: OrderUpdateData): Promise<{
        data: Order;
        headers: any;
    }>;
    deleteOrder(id: number, force?: boolean): Promise<{
        data: Order;
        headers: any;
    }>;
    addOrderNote(orderId: number, noteData: {
        note: string;
        customer_note?: boolean;
        added_by_user?: boolean;
    }): Promise<{
        data: any;
        headers: any;
    }>;
    createCustomer(customerData: any): Promise<{
        data: any;
        headers: any;
    }>;
    updateCustomer(id: number, customerData: any): Promise<{
        data: any;
        headers: any;
    }>;
    deleteCustomer(id: number, force?: boolean): Promise<{
        data: any;
        headers: any;
    }>;
    getWebhooks(params?: any): Promise<{
        data: any[];
        headers: any;
    }>;
    createWebhook(webhookData: {
        name: string;
        topic: string;
        delivery_url: string;
        secret?: string;
        status?: 'active' | 'paused' | 'disabled';
    }): Promise<{
        data: any;
        headers: any;
    }>;
    updateWebhook(id: number, webhookData: any): Promise<{
        data: any;
        headers: any;
    }>;
    deleteWebhook(id: number, force?: boolean): Promise<{
        data: any;
        headers: any;
    }>;
    getSystemStatus(): Promise<{
        data: any;
        headers: any;
    }>;
    getStoreInfo(): Promise<{
        data: any;
        headers: any;
    }>;
    healthCheck(): Promise<{
        status: string;
        latency: number;
        error?: string;
    }>;
    rotateKeys(newKeys: {
        readKey: string;
        readSecret: string;
        writeKey: string;
        writeSecret: string;
    }): Promise<void>;
    getLastKeyRotation(): Date;
    bulkOperation(endpoint: string, data: any): Promise<{
        data: any;
        headers: any;
    }>;
    searchProducts(query: string, params?: any): Promise<{
        data: Product[];
        headers: any;
    }>;
    getSalesReport(params?: any): Promise<{
        data: any;
        headers: any;
    }>;
    getTopSellersReport(params?: any): Promise<{
        data: any;
        headers: any;
    }>;
    getCoupons(params?: any): Promise<{
        data: any[];
        headers: any;
    }>;
    getCoupon(id: number): Promise<{
        data: any;
        headers: any;
    }>;
    createCoupon(couponData: any): Promise<{
        data: any;
        headers: any;
    }>;
    getShippingZones(): Promise<{
        data: any[];
        headers: any;
    }>;
    getShippingMethods(zoneId: number): Promise<{
        data: any[];
        headers: any;
    }>;
    getTaxRates(params?: any): Promise<{
        data: any[];
        headers: any;
    }>;
    getTaxClasses(): Promise<{
        data: any[];
        headers: any;
    }>;
}
export declare const wcClient: WooCommerceService;
export { WooCommerceService };
//# sourceMappingURL=woocommerce.d.ts.map