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
    process.stdout.write(this.formatMessage('INFO', message, context) + '\n');
  }

  warn(message: string, context?: LogContext): void {
    process.stderr.write(this.formatMessage('WARN', message, context) + '\n');
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

    process.stderr.write(this.formatMessage('ERROR', message, errorContext) + '\n');
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      process.stdout.write(this.formatMessage('DEBUG', message, context) + '\n');
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
