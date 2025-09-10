/**
 * Authentication Routes for Edge Runtime
 * Handles user registration, login, logout, and profile management
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { supabase } from '../services/supabase';
import { logger } from '../utils/logger';
import { validateRequest, getValidated } from '../middleware/validateRequest';
import { apiKey } from '../middleware/apiKey';
import { requireAuth, optionalAuth, getCurrentUser } from '../middleware/auth';
import { userRateLimit } from '../middleware/rateLimiter';
const auth = new Hono();
// Request schemas
const signUpSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    metadata: z.record(z.string(), z.any()).optional()
});
const signInSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
});
const resetPasswordSchema = z.object({
    email: z.string().email(),
    redirectTo: z.string().url().optional()
});
const updatePasswordSchema = z.object({
    password: z.string().min(8).max(128),
    newPassword: z.string().min(8).max(128)
});
const updateProfileSchema = z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    phone: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional()
});
// Apply middleware
auth.use('*', apiKey({ allowedKeyTypes: ['frontend', 'mobile', 'admin'] }));
auth.use('*', userRateLimit({ requests: 30, window: 900 })); // 30 requests per 15 minutes
/**
 * POST /auth/signup - User registration
 */
auth.post('/signup', validateRequest({ body: signUpSchema }), async (c) => {
    const { email, password, firstName, lastName, metadata } = getValidated(c, 'body');
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    ...metadata
                }
            }
        });
        if (error) {
            logger.warn('Signup failed', { error: error.message, email });
            throw new HTTPException(400, { message: error.message });
        }
        logger.info('User signed up', {
            userId: data.user?.id,
            email: data.user?.email
        });
        return c.json({
            user: data.user,
            session: data.session,
            message: data.user?.email_confirmed_at
                ? 'Account created successfully'
                : 'Please check your email to confirm your account'
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Signup error', { error, email });
        throw new HTTPException(500, { message: 'Internal server error' });
    }
});
/**
 * POST /auth/signin - User login
 */
auth.post('/signin', validateRequest({ body: signInSchema }), async (c) => {
    const { email, password } = getValidated(c, 'body');
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) {
            logger.warn('Signin failed', { error: error.message, email });
            throw new HTTPException(401, { message: error.message });
        }
        logger.info('User signed in', {
            userId: data.user?.id,
            email: data.user?.email
        });
        return c.json({
            user: data.user,
            session: data.session
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Signin error', { error, email });
        throw new HTTPException(500, { message: 'Internal server error' });
    }
});
/**
 * POST /auth/signout - User logout
 */
auth.post('/signout', optionalAuth(), async (c) => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            logger.warn('Signout failed', { error: error.message });
            throw new HTTPException(400, { message: error.message });
        }
        const user = getCurrentUser(c);
        if (user) {
            logger.info('User signed out', { userId: user.id });
        }
        return c.json({ message: 'Signed out successfully' });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Signout error', { error });
        throw new HTTPException(500, { message: 'Internal server error' });
    }
});
/**
 * POST /auth/reset-password - Password reset request
 */
auth.post('/reset-password', validateRequest({ body: resetPasswordSchema }), async (c) => {
    const { email, redirectTo } = getValidated(c, 'body');
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: redirectTo || undefined
        });
        if (error) {
            logger.warn('Password reset failed', { error: error.message, email });
            throw new HTTPException(400, { message: error.message });
        }
        logger.info('Password reset requested', { email });
        return c.json({
            message: 'Password reset instructions sent to your email'
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Password reset error', { error, email });
        throw new HTTPException(500, { message: 'Internal server error' });
    }
});
/**
 * GET /auth/user - Get current user
 */
auth.get('/user', requireAuth(), async (c) => {
    try {
        const authHeader = c.req.header('authorization');
        if (!authHeader) {
            throw new HTTPException(401, { message: 'Authorization header required' });
        }
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            logger.warn('Get user failed', { error: error?.message });
            throw new HTTPException(401, { message: 'Invalid token' });
        }
        return c.json({ user });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Get user error', { error });
        throw new HTTPException(500, { message: 'Internal server error' });
    }
});
/**
 * PUT /auth/user - Update user profile
 */
auth.put('/user', requireAuth(), validateRequest({ body: updateProfileSchema }), async (c) => {
    const updates = getValidated(c, 'body');
    try {
        const { data, error } = await supabase.auth.updateUser({
            data: updates
        });
        if (error) {
            logger.warn('Update user failed', { error: error.message });
            throw new HTTPException(400, { message: error.message });
        }
        const user = getCurrentUser(c);
        logger.info('User profile updated', { userId: user?.id });
        return c.json({
            user: data.user,
            message: 'Profile updated successfully'
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Update user error', { error });
        throw new HTTPException(500, { message: 'Internal server error' });
    }
});
/**
 * PUT /auth/password - Change password
 */
auth.put('/password', requireAuth(), validateRequest({ body: updatePasswordSchema }), async (c) => {
    const { newPassword } = getValidated(c, 'body');
    try {
        const { data, error } = await supabase.auth.updateUser({
            password: newPassword
        });
        if (error) {
            logger.warn('Password change failed', { error: error.message });
            throw new HTTPException(400, { message: error.message });
        }
        const user = getCurrentUser(c);
        logger.info('Password changed', { userId: user?.id });
        return c.json({
            message: 'Password updated successfully'
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Password change error', { error });
        throw new HTTPException(500, { message: 'Internal server error' });
    }
});
/**
 * POST /auth/refresh - Refresh access token
 */
auth.post('/refresh', async (c) => {
    try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) {
            logger.warn('Token refresh failed', { error: error.message });
            throw new HTTPException(401, { message: error.message });
        }
        return c.json({
            session: data.session,
            user: data.user
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Token refresh error', { error });
        throw new HTTPException(500, { message: 'Internal server error' });
    }
});
export default auth;
//# sourceMappingURL=auth.js.map