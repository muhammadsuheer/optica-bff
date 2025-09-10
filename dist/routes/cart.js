/**
 * Cart Routes for Edge Runtime
 * Handles shopping cart operations with session-based or user-based cart management
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import databaseService from '../services/databaseService';
import { logger } from '../utils/logger';
import { validateRequest, getValidated, cartItemSchema } from '../middleware/validateRequest';
import { apiKey, hasPermission } from '../middleware/apiKey';
import { optionalAuth, getCurrentUser } from '../middleware/auth';
import { userRateLimit } from '../middleware/rateLimiter';
const cart = new Hono();
// Request schemas
const addToCartSchema = cartItemSchema;
const updateCartItemSchema = z.object({
    quantity: z.number().int().min(0).max(999), // 0 quantity = remove item
    variation_id: z.number().positive().optional(),
    variation: z.record(z.string(), z.string()).optional()
});
const cartSessionSchema = z.object({
    session_id: z.string().min(1).max(100)
});
// Apply middleware
cart.use('*', apiKey({ allowedKeyTypes: ['frontend', 'mobile', 'admin'] }));
cart.use('*', optionalAuth()); // Cart can work with or without authentication
cart.use('*', userRateLimit({ requests: 100, window: 300 })); // 100 requests per 5 minutes
/**
 * Get cart identifier (user ID or session ID)
 */
function getCartIdentifier(c) {
    const user = getCurrentUser(c);
    if (user) {
        return { type: 'user', id: user.id };
    }
    // Get session ID from header or generate one
    const sessionId = c.req.header('x-session-id') || c.req.header('x-cart-session');
    if (!sessionId) {
        throw new HTTPException(400, {
            message: 'Session ID required for guest cart. Provide x-session-id header.'
        });
    }
    return { type: 'session', id: sessionId };
}
/**
 * GET /cart - Get cart contents
 */
cart.get('/', async (c) => {
    try {
        if (!hasPermission(c, 'read:cart')) {
            throw new HTTPException(403, { message: 'Insufficient permissions' });
        }
        const cartId = getCartIdentifier(c);
        const cartContents = await databaseService.getCart(cartId.id, cartId.type);
        if (!cartContents) {
            return c.json({
                cart: {
                    items: [],
                    totals: { subtotal: 0, tax: 0, total: 0, items_count: 0 }
                },
                session: cartId.type === 'session' ? cartId.id : undefined
            });
        }
        return c.json({
            cart: cartContents,
            session: cartId.type === 'session' ? cartId.id : undefined
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Get cart error', { error });
        throw new HTTPException(500, { message: 'Failed to retrieve cart' });
    }
});
/**
 * POST /cart/items - Add item to cart
 */
cart.post('/items', validateRequest({ body: addToCartSchema }), async (c) => {
    try {
        if (!hasPermission(c, 'write:cart')) {
            throw new HTTPException(403, { message: 'Insufficient permissions' });
        }
        const cartId = getCartIdentifier(c);
        const itemData = getValidated(c, 'body');
        // Validate product exists and is available
        const product = await databaseService.getProduct(itemData.product_id);
        if (!product) {
            throw new HTTPException(404, { message: 'Product not found' });
        }
        if (product.status !== 'publish') {
            throw new HTTPException(400, { message: 'Product is not available' });
        }
        // Check stock availability
        if (product.stock_quantity !== null && product.stock_quantity < itemData.quantity) {
            throw new HTTPException(400, {
                message: `Insufficient stock. Available: ${product.stock_quantity}`
            });
        }
        const cartItem = await databaseService.addToCart({
            cartId: cartId.id,
            cartType: cartId.type,
            productId: itemData.product_id,
            quantity: itemData.quantity,
            variationId: itemData.variation_id,
            variation: itemData.variation
        });
        logger.info('Item added to cart', {
            cartId: cartId.id,
            cartType: cartId.type,
            productId: itemData.product_id,
            quantity: itemData.quantity
        });
        // Get updated cart
        const updatedCart = await databaseService.getCart(cartId.id, cartId.type);
        return c.json({
            message: 'Item added to cart',
            item: cartItem,
            cart: updatedCart
        }, 201);
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Add to cart error', { error });
        throw new HTTPException(500, { message: 'Failed to add item to cart' });
    }
});
/**
 * PUT /cart/items/:itemId - Update cart item
 */
cart.put('/items/:itemId', validateRequest({ body: updateCartItemSchema }), async (c) => {
    try {
        if (!hasPermission(c, 'write:cart')) {
            throw new HTTPException(403, { message: 'Insufficient permissions' });
        }
        const itemId = parseInt(c.req.param('itemId'));
        if (isNaN(itemId)) {
            throw new HTTPException(400, { message: 'Invalid item ID' });
        }
        const cartId = getCartIdentifier(c);
        const updateData = getValidated(c, 'body');
        // If quantity is 0, remove the item
        if (updateData.quantity === 0) {
            await databaseService.removeFromCart(cartId.id, cartId.type, itemId);
            logger.info('Item removed from cart', {
                cartId: cartId.id,
                cartType: cartId.type,
                itemId
            });
            const updatedCart = await databaseService.getCart(cartId.id, cartId.type);
            return c.json({
                message: 'Item removed from cart',
                cart: updatedCart
            });
        }
        // Update the item
        const updatedItem = await databaseService.updateCartItem({
            cartId: cartId.id,
            cartType: cartId.type,
            itemId,
            quantity: updateData.quantity,
            variationId: updateData.variation_id,
            variation: updateData.variation
        });
        if (!updatedItem) {
            throw new HTTPException(404, { message: 'Cart item not found' });
        }
        logger.info('Cart item updated', {
            cartId: cartId.id,
            cartType: cartId.type,
            itemId,
            quantity: updateData.quantity
        });
        const updatedCart = await databaseService.getCart(cartId.id, cartId.type);
        return c.json({
            message: 'Cart item updated',
            item: updatedItem,
            cart: updatedCart
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Update cart item error', { error });
        throw new HTTPException(500, { message: 'Failed to update cart item' });
    }
});
/**
 * DELETE /cart/items/:itemId - Remove item from cart
 */
cart.delete('/items/:itemId', async (c) => {
    try {
        if (!hasPermission(c, 'write:cart')) {
            throw new HTTPException(403, { message: 'Insufficient permissions' });
        }
        const itemId = parseInt(c.req.param('itemId'));
        if (isNaN(itemId)) {
            throw new HTTPException(400, { message: 'Invalid item ID' });
        }
        const cartId = getCartIdentifier(c);
        await databaseService.removeFromCart(cartId.id, cartId.type, itemId);
        logger.info('Item removed from cart', {
            cartId: cartId.id,
            cartType: cartId.type,
            itemId
        });
        const updatedCart = await databaseService.getCart(cartId.id, cartId.type);
        return c.json({
            message: 'Item removed from cart',
            cart: updatedCart
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Remove cart item error', { error });
        throw new HTTPException(500, { message: 'Failed to remove item from cart' });
    }
});
/**
 * DELETE /cart - Clear entire cart
 */
cart.delete('/', async (c) => {
    try {
        if (!hasPermission(c, 'write:cart')) {
            throw new HTTPException(403, { message: 'Insufficient permissions' });
        }
        const cartId = getCartIdentifier(c);
        await databaseService.clearCart(cartId.id, cartId.type);
        logger.info('Cart cleared', {
            cartId: cartId.id,
            cartType: cartId.type
        });
        return c.json({
            message: 'Cart cleared successfully'
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Clear cart error', { error });
        throw new HTTPException(500, { message: 'Failed to clear cart' });
    }
});
/**
 * GET /cart/totals - Get cart totals and pricing
 */
cart.get('/totals', async (c) => {
    try {
        if (!hasPermission(c, 'read:cart')) {
            throw new HTTPException(403, { message: 'Insufficient permissions' });
        }
        const cartId = getCartIdentifier(c);
        const cartTotals = await databaseService.getCartTotals(cartId.id, cartId.type);
        return c.json(cartTotals);
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Get cart totals error', { error });
        throw new HTTPException(500, { message: 'Failed to calculate cart totals' });
    }
});
/**
 * POST /cart/merge - Merge guest cart with user cart (after login)
 */
cart.post('/merge', validateRequest({ body: cartSessionSchema }), async (c) => {
    try {
        if (!hasPermission(c, 'write:cart')) {
            throw new HTTPException(403, { message: 'Insufficient permissions' });
        }
        const user = getCurrentUser(c);
        if (!user) {
            throw new HTTPException(401, { message: 'Authentication required for cart merge' });
        }
        const { session_id } = getValidated(c, 'body');
        const mergedCart = await databaseService.mergeCart(session_id, user.id);
        logger.info('Cart merged', {
            sessionId: session_id,
            userId: user.id
        });
        return c.json({
            message: 'Cart merged successfully',
            cart: mergedCart
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Cart merge error', { error });
        throw new HTTPException(500, { message: 'Failed to merge cart' });
    }
});
export default cart;
//# sourceMappingURL=cart.js.map