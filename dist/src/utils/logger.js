/**
 * Production-ready logger utility with structured logging
 */
class Logger {
    isDevelopment = process.env.NODE_ENV === 'development';
    isProduction = process.env.NODE_ENV === 'production';
    formatMessage(level, message, context) {
        const timestamp = new Date().toISOString();
        if (this.isProduction) {
            // Structured JSON logging for production
            return JSON.stringify({
                timestamp,
                level,
                message,
                ...context,
                service: 'optica-bff'
            });
        }
        else {
            // Human-readable format for development
            const contextStr = context ? ` ${JSON.stringify(context)}` : '';
            return `[${level}] ${timestamp} - ${message}${contextStr}`;
        }
    }
    info(message, context) {
        console.log(this.formatMessage('INFO', message, context));
    }
    warn(message, context) {
        console.warn(this.formatMessage('WARN', message, context));
    }
    error(message, error, context) {
        let errorContext = {};
        if (error instanceof Error) {
            errorContext = {
                error: error.message,
                stack: error.stack,
                ...context
            };
        }
        else if (error) {
            errorContext = { ...error, ...context };
        }
        console.error(this.formatMessage('ERROR', message, errorContext));
    }
    debug(message, context) {
        if (this.isDevelopment) {
            console.debug(this.formatMessage('DEBUG', message, context));
        }
    }
    // Performance logging
    performance(operation, duration, context) {
        this.info(`Performance: ${operation}`, {
            duration_ms: duration,
            ...context
        });
    }
}
export const logger = new Logger();
