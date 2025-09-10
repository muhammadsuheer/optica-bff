/**
 * Orders Routes for Edge Runtime
 * Handles order creation, management, and tracking
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import databaseService from '../services/databaseService';
import { logger } from '../utils/logger';
import { validateRequest, getValidated, orderSchema, commonSchemas } from '../middleware/validateRequest';
import { apiKey, hasPermission } from '../middleware/apiKey';
import { requireAuth, getCurrentUser, requireRole } from '../middleware/auth';
import { userRateLimit } from '../middleware/rateLimiter';
const orders = new Hono();
// Request schemas
const updateOrderStatusSchema = z.object({
    status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
    notes: z.string().optional(),
    tracking_number: z.string().optional()
});
const orderQuerySchema = z.object({
    ...commonSchemas.pagination.shape,
    status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).optional(),
    customer_id: z.string().transform(Number).pipe(z.number().positive()).optional(),
    date_from: z.string().datetime().optional(),
    date_to: z.string().datetime().optional()
});
// Apply middleware
orders.use('*', apiKey({ allowedKeyTypes: ['frontend', 'mobile', 'admin'] }));
orders.use('*', userRateLimit({ requests: 50, window: 300 })); // 50 requests per 5 minutes
/**
 * GET /orders - List orders (admin/customer specific)
 */
orders.get('/', requireAuth(), validateRequest({ query: orderQuerySchema }), async (c) => {
    try {
        if (!hasPermission(c, 'read:orders')) {
            throw new HTTPException(403, { message: 'Insufficient permissions' });
        }
        const user = getCurrentUser(c);
        const query = getValidated(c, 'query');
        // Non-admin users can only see their own orders
        const isAdmin = hasPermission(c, 'read:*');
        if (!isAdmin) {
            query.customer_id = parseInt(user.id);
        }
        const result = await databaseService.getOrders({
            page: query.page,
            limit: query.limit,
            status: query.status,
            customerId: query.customer_id,
            dateFrom: query.date_from,
            dateTo: query.date_to
        });
        return c.json({
            orders: result?.data || [],
            pagination: {
                page: query.page,
                limit: query.limit,
                total: result?.total || 0,
                totalPages: Math.ceil((result?.total || 0) / query.limit)
            }
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Get orders error', { error });
        throw new HTTPException(500, { message: 'Failed to retrieve orders' });
    }
});
/**
 * GET /orders/:id - Get specific order details
 */
orders.get('/:id', requireAuth(), validateRequest({ params: commonSchemas.idParam }), async (c) => {
    try {
        if (!hasPermission(c, 'read:orders')) {
            throw new HTTPException(403, { message: 'Insufficient permissions' });
        }
        const user = getCurrentUser(c);
        const { id } = getValidated(c, 'params');
        const order = await databaseService.getOrder(id);
        if (!order) {
            throw new HTTPException(404, { message: 'Order not found' });
        }
        // Non-admin users can only see their own orders
        const isAdmin = hasPermission(c, 'read:*');
        if (!isAdmin && order.customer_id !== parseInt(user.id)) {
            throw new HTTPException(403, { message: 'Access denied - not your order' });
        }
        return c.json({ order });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Get order error', { error });
        throw new HTTPException(500, { message: 'Failed to retrieve order' });
    }
});
/**
 * POST /orders - Create new order
 */
orders.post('/', requireAuth(), validateRequest({ body: orderSchema }), async (c) => {
    try {
        if (!hasPermission(c, 'write:orders')) {
            throw new HTTPException(403, { message: 'Insufficient permissions' });
        }
        const user = getCurrentUser(c);
        const orderData = getValidated(c, 'body');
        // Set customer ID to current user if not admin
        if (!hasPermission(c, 'write:*')) {
            orderData.customer_id = parseInt(user.id);
        }
        // Validate cart items and calculate totals
        const orderTotals = await databaseService.calculateOrderTotals(orderData.line_items);
        // Reserve inventory before creating order
        try {
            await databaseService.reserveInventory(orderData.line_items);
        }
        catch (inventoryError) {
            logger.warn('Inventory reservation failed', { error: inventoryError, lineItems: orderData.line_items });
            throw new HTTPException(400, {
                message: inventoryError instanceof Error ? inventoryError.message : 'Insufficient inventory'
            });
        }
        const newOrder = await databaseService.createOrder({
            ...orderData,
            customer_id: orderData.customer_id || parseInt(user.id),
            totals: orderTotals
        });
        logger.info('Order created', {
            orderId: newOrder?.id,
            customerId: newOrder?.customer_id,
            total: orderTotals.total
        });
        return c.json({
            message: 'Order created successfully',
            order: newOrder
        }, 201);
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Create order error', { error });
        throw new HTTPException(500, { message: 'Failed to create order' });
    }
});
/**
 * PUT /orders/:id/status - Update order status (admin only)
 */
orders.put('/:id/status', requireRole(['admin', 'service_role']), validateRequest({
    params: commonSchemas.idParam,
    body: updateOrderStatusSchema
}), async (c) => {
    try {
        const { id } = getValidated(c, 'params');
        const updateData = getValidated(c, 'body');
        const updatedOrder = await databaseService.updateOrderStatus(id, updateData);
        if (!updatedOrder) {
            throw new HTTPException(404, { message: 'Order not found' });
        }
        logger.info('Order status updated', {
            orderId: id,
            newStatus: updateData.status,
            adminId: getCurrentUser(c)?.id
        });
        return c.json({
            message: 'Order status updated successfully',
            order: updatedOrder
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Update order status error', { error });
        throw new HTTPException(500, { message: 'Failed to update order status' });
    }
});
/**
 * POST /orders/:id/cancel - Cancel order
 */
orders.post('/:id/cancel', requireAuth(), validateRequest({ params: commonSchemas.idParam }), async (c) => {
    try {
        const user = getCurrentUser(c);
        const { id } = getValidated(c, 'params');
        const order = await databaseService.getOrder(id);
        if (!order) {
            throw new HTTPException(404, { message: 'Order not found' });
        }
        // Check ownership for non-admin users
        const isAdmin = hasPermission(c, 'write:*');
        if (!isAdmin && order.customer_id !== parseInt(user.id)) {
            throw new HTTPException(403, { message: 'Access denied - not your order' });
        }
        // Check if order can be cancelled
        if (!['pending', 'processing'].includes(order.status)) {
            throw new HTTPException(400, {
                message: `Order cannot be cancelled - current status: ${order.status}`
            });
        }
        // Release inventory before cancelling
        try {
            await databaseService.releaseInventory(order.line_items);
            logger.info('Inventory released for cancelled order', { orderId: id });
        }
        catch (inventoryError) {
            logger.error('Failed to release inventory for cancelled order', {
                error: inventoryError,
                orderId: id
            });
            // Continue with cancellation even if inventory release fails
        }
        const cancelledOrder = await databaseService.updateOrderStatusWithHistory(id, 'cancelled', `Order cancelled by ${isAdmin ? 'admin' : 'customer'}`, user.id);
        logger.info('Order cancelled', {
            orderId: id,
            customerId: order.customer_id,
            cancelledBy: user.id
        });
        return c.json({
            message: 'Order cancelled successfully',
            order: cancelledOrder
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Cancel order error', { error });
        throw new HTTPException(500, { message: 'Failed to cancel order' });
    }
});
/**
 * GET /orders/:id/tracking - Get order tracking information
 */
orders.get('/:id/tracking', requireAuth(), validateRequest({ params: commonSchemas.idParam }), async (c) => {
    try {
        const user = getCurrentUser(c);
        const { id } = getValidated(c, 'params');
        const order = await databaseService.getOrder(id);
        if (!order) {
            throw new HTTPException(404, { message: 'Order not found' });
        }
        // Check ownership for non-admin users
        const isAdmin = hasPermission(c, 'read:*');
        if (!isAdmin && order.customer_id !== parseInt(user.id)) {
            throw new HTTPException(403, { message: 'Access denied - not your order' });
        }
        const trackingInfo = await databaseService.getOrderTracking(id);
        return c.json({
            order_id: id,
            status: order.status,
            tracking: trackingInfo
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Get order tracking error', { error });
        throw new HTTPException(500, { message: 'Failed to retrieve tracking information' });
    }
});
export default orders;
//# sourceMappingURL=orders.js.map