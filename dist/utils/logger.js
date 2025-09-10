/**
 * Edge-Compatible Logger for Vercel Edge Runtime
 * Uses console methods only (no Node.js dependencies)
 */
class EdgeLogger {
    logLevel = 'info';
    context = {};
    constructor(level = 'info') {
        this.logLevel = level;
    }
    setLevel(level) {
        this.logLevel = level;
    }
    setContext(context) {
        this.context = { ...this.context, ...context };
    }
    shouldLog(level) {
        const levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };
        return levels[level] >= levels[this.logLevel];
    }
    formatLog(level, message, data) {
        return {
            timestamp: new Date().toISOString(),
            level,
            message,
            data,
            ...this.context
        };
    }
    debug(message, data) {
        if (this.shouldLog('debug')) {
            const logEntry = this.formatLog('debug', message, data);
            console.debug(JSON.stringify(logEntry));
        }
    }
    info(message, data) {
        if (this.shouldLog('info')) {
            const logEntry = this.formatLog('info', message, data);
            console.info(JSON.stringify(logEntry));
        }
    }
    warn(message, data) {
        if (this.shouldLog('warn')) {
            const logEntry = this.formatLog('warn', message, data);
            console.warn(JSON.stringify(logEntry));
        }
    }
    error(message, error) {
        if (this.shouldLog('error')) {
            const errorData = error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                }
                : error;
            const logEntry = this.formatLog('error', message, errorData);
            console.error(JSON.stringify(logEntry));
        }
    }
    child(context) {
        const childLogger = new EdgeLogger(this.logLevel);
        childLogger.setContext({ ...this.context, ...context });
        return childLogger;
    }
}
// Create and export default logger instance
import { config } from '../config/env';
export const logger = new EdgeLogger(config.isDevelopment ? 'debug' : 'info');
// Export logger class for custom instances
export { EdgeLogger };
//# sourceMappingURL=logger.js.map