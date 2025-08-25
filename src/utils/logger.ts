/**
 * Production-ready logger utility with structured logging
 */

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isProduction = process.env.NODE_ENV === 'production';

  private formatMessage(level: string, message: string, context?: LogContext): string {
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
    } else {
      // Human-readable format for development
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';
      return `[${level}] ${timestamp} - ${message}${contextStr}`;
    }
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('INFO', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('WARN', message, context));
  }

  error(message: string, error?: Error | LogContext, context?: LogContext): void {
    let errorContext: LogContext = {};
    
    if (error instanceof Error) {
      errorContext = {
        error: error.message,
        stack: error.stack,
        ...context
      };
    } else if (error) {
      errorContext = { ...error, ...context };
    }

    console.error(this.formatMessage('ERROR', message, errorContext));
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('DEBUG', message, context));
    }
  }

  // Performance logging
  performance(operation: string, duration: number, context?: LogContext): void {
    this.info(`Performance: ${operation}`, {
      duration_ms: duration,
      ...context
    });
  }
}

export const logger = new Logger();
