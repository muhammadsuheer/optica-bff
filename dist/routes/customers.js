/**
 * Customers Routes for Edge Runtime
 * Handles customer management and profiles
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import databaseService from '../services/databaseService';
import { logger } from '../utils/logger';
import { validateRequest, getValidated, commonSchemas } from '../middleware/validateRequest';
import { apiKey, hasPermission } from '../middleware/apiKey';
import { requireAuth, getCurrentUser, requireRole } from '../middleware/auth';
import { userRateLimit } from '../middleware/rateLimiter';
const customers = new Hono();
// Request schemas
const customerSchema = z.object({
    email: z.string().email(),
    first_name: z.string().min(1).max(50),
    last_name: z.string().min(1).max(50),
    phone: z.string().optional(),
    billing: z.object({
        first_name: z.string().min(1),
        last_name: z.string().min(1),
        company: z.string().optional(),
        address_1: z.string().min(1),
        address_2: z.string().optional(),
        city: z.string().min(1),
        state: z.string().min(1),
        postcode: z.string().min(1),
        country: z.string().length(2),
        email: z.string().email().optional(),
        phone: z.string().optional()
    }),
    shipping: z.object({
        first_name: z.string().min(1),
        last_name: z.string().min(1),
        company: z.string().optional(),
        address_1: z.string().min(1),
        address_2: z.string().optional(),
        city: z.string().min(1),
        state: z.string().min(1),
        postcode: z.string().min(1),
        country: z.string().length(2)
    }).optional()
});
const updateCustomerSchema = customerSchema.partial();
const customerQuerySchema = z.object({
    ...commonSchemas.pagination.shape,
    search: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional()
});
// Apply middleware
customers.use('*', apiKey({ allowedKeyTypes: ['frontend', 'mobile', 'admin'] }));
customers.use('*', userRateLimit({ requests: 100, window: 300 })); // 100 requests per 5 minutes
/**
 * GET /customers - List customers (admin only)
 */
customers.get('/', requireRole(['admin', 'service_role']), validateRequest({ query: customerQuerySchema }), async (c) => {
    try {
        const query = getValidated(c, 'query');
        const result = await databaseService.getCustomers({
            page: query.page,
            limit: query.limit,
            search: query.search,
            status: query.status
        });
        return c.json({
            customers: result?.data || [],
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
        logger.error('Get customers error', { error });
        throw new HTTPException(500, { message: 'Failed to retrieve customers' });
    }
});
/**
 * GET /customers/:id - Get specific customer details
 */
customers.get('/:id', requireAuth(), validateRequest({ params: commonSchemas.idParam }), async (c) => {
    try {
        const user = getCurrentUser(c);
        const { id } = getValidated(c, 'params');
        // Check permissions - users can only access their own data
        const isAdmin = hasPermission(c, 'read:*');
        if (!isAdmin && parseInt(user.id) !== id) {
            throw new HTTPException(403, { message: 'Access denied - not your profile' });
        }
        const customer = await databaseService.getCustomer(id);
        if (!customer) {
            throw new HTTPException(404, { message: 'Customer not found' });
        }
        return c.json({ customer });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Get customer error', { error });
        throw new HTTPException(500, { message: 'Failed to retrieve customer' });
    }
});
/**
 * POST /customers - Create new customer (admin only)
 */
customers.post('/', requireRole(['admin', 'service_role']), validateRequest({ body: customerSchema }), async (c) => {
    try {
        const customerData = getValidated(c, 'body');
        const newCustomer = await databaseService.createCustomer(customerData);
        logger.info('Customer created', {
            customerId: newCustomer.id,
            email: newCustomer.email,
            adminId: getCurrentUser(c)?.id
        });
        return c.json({
            message: 'Customer created successfully',
            customer: newCustomer
        }, 201);
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Create customer error', { error });
        throw new HTTPException(500, { message: 'Failed to create customer' });
    }
});
/**
 * PUT /customers/:id - Update customer profile
 */
customers.put('/:id', requireAuth(), validateRequest({
    params: commonSchemas.idParam,
    body: updateCustomerSchema
}), async (c) => {
    try {
        const user = getCurrentUser(c);
        const { id } = getValidated(c, 'params');
        const updateData = getValidated(c, 'body');
        // Check permissions - users can only update their own data
        const isAdmin = hasPermission(c, 'write:*');
        if (!isAdmin && parseInt(user.id) !== id) {
            throw new HTTPException(403, { message: 'Access denied - not your profile' });
        }
        const updatedCustomer = await databaseService.updateCustomer(id, updateData);
        if (!updatedCustomer) {
            throw new HTTPException(404, { message: 'Customer not found' });
        }
        logger.info('Customer updated', {
            customerId: id,
            updatedBy: user.id
        });
        return c.json({
            message: 'Customer profile updated successfully',
            customer: updatedCustomer
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Update customer error', { error });
        throw new HTTPException(500, { message: 'Failed to update customer' });
    }
});
/**
 * DELETE /customers/:id - Delete customer (admin only)
 */
customers.delete('/:id', requireRole(['admin', 'service_role']), validateRequest({ params: commonSchemas.idParam }), async (c) => {
    try {
        const { id } = getValidated(c, 'params');
        const deleted = await databaseService.deleteCustomer(id);
        if (!deleted) {
            throw new HTTPException(404, { message: 'Customer not found' });
        }
        logger.info('Customer deleted', {
            customerId: id,
            deletedBy: getCurrentUser(c)?.id
        });
        return c.json({
            message: 'Customer deleted successfully'
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Delete customer error', { error });
        throw new HTTPException(500, { message: 'Failed to delete customer' });
    }
});
/**
 * GET /customers/:id/orders - Get customer's orders
 */
customers.get('/:id/orders', requireAuth(), validateRequest({
    params: commonSchemas.idParam,
    query: commonSchemas.pagination
}), async (c) => {
    try {
        const user = getCurrentUser(c);
        const { id } = getValidated(c, 'params');
        const query = getValidated(c, 'query');
        // Check permissions - users can only access their own orders
        const isAdmin = hasPermission(c, 'read:*');
        if (!isAdmin && parseInt(user.id) !== id) {
            throw new HTTPException(403, { message: 'Access denied - not your orders' });
        }
        const result = await databaseService.getOrders({
            page: query.page,
            limit: query.limit,
            customerId: id
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
        logger.error('Get customer orders error', { error });
        throw new HTTPException(500, { message: 'Failed to retrieve customer orders' });
    }
});
/**
 * GET /customers/me - Get current customer profile
 */
customers.get('/me', requireAuth(), async (c) => {
    try {
        const user = getCurrentUser(c);
        const customer = await databaseService.getCustomer(parseInt(user.id));
        if (!customer) {
            throw new HTTPException(404, { message: 'Customer profile not found' });
        }
        return c.json({ customer });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Get current customer error', { error });
        throw new HTTPException(500, { message: 'Failed to retrieve profile' });
    }
});
/**
 * PUT /customers/me - Update current customer profile
 */
customers.put('/me', requireAuth(), validateRequest({ body: updateCustomerSchema }), async (c) => {
    try {
        const user = getCurrentUser(c);
        const updateData = getValidated(c, 'body');
        const updatedCustomer = await databaseService.updateCustomer(parseInt(user.id), updateData);
        if (!updatedCustomer) {
            throw new HTTPException(404, { message: 'Customer profile not found' });
        }
        logger.info('Customer profile updated', {
            customerId: user.id
        });
        return c.json({
            message: 'Profile updated successfully',
            customer: updatedCustomer
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Update current customer error', { error });
        throw new HTTPException(500, { message: 'Failed to update profile' });
    }
});
export default customers;
//# sourceMappingURL=customers.js.map