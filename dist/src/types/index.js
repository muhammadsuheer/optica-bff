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
};
