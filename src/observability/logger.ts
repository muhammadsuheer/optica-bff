/**
 * Production-Ready Logger for Edge Runtime
 * 
 * Structured logging with correlation IDs, performance metrics,
 * and proper log levels for production monitoring.
 */

import { env } from '../config/env'

// =======================
// Log Levels
// =======================

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// =======================
// Log Entry Interface
// =======================

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  traceId?: string
  userId?: string
  service: string
  version: string
  environment: string
  data?: Record<string, any>
  error?: {
    name: string
    message: string
    stack?: string
  }
  performance?: {
    duration: number
    memory?: number
  }
}

// =======================
// Logger Configuration
// =======================

const LOG_LEVELS: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR
}

const currentLogLevel = LOG_LEVELS[env.LOG_LEVEL] || LogLevel.INFO

// =======================
// Logger Class
// =======================

class Logger {
  private service: string
  private version: string
  private environment: string

  constructor() {
    this.service = 'optia-bff'
    this.version = '1.0.0'
    this.environment = env.NODE_ENV
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= currentLogLevel
  }

  private formatLog(entry: LogEntry): string {
    if (env.NODE_ENV === 'development') {
      // Pretty print for development
      const levelName = LogLevel[entry.level]
      const timestamp = entry.timestamp
      const message = entry.message
      const data = entry.data ? `\n${JSON.stringify(entry.data, null, 2)}` : ''
      const error = entry.error ? `\nError: ${entry.error.name}: ${entry.error.message}` : ''
      
      return `[${timestamp}] ${levelName}: ${message}${data}${error}`
    } else {
      // JSON format for production
      return JSON.stringify(entry)
    }
  }

  private log(level: LogLevel, message: string, data?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.service,
      version: this.version,
      environment: this.environment,
      data,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    }

    const formattedLog = this.formatLog(entry)
    
    // Output to console (in production, this would go to a log service)
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedLog)
        break
      case LogLevel.INFO:
        console.info(formattedLog)
        break
      case LogLevel.WARN:
        console.warn(formattedLog)
        break
      case LogLevel.ERROR:
        console.error(formattedLog)
        break
    }
  }

  debug(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, data)
  }

  info(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, data)
  }

  warn(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, data)
  }

  error(message: string, error?: Error, data?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, data, error)
  }

  // Performance logging
  time(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.time(label)
    }
  }

  timeEnd(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.timeEnd(label)
    }
  }

  // Structured logging with context
  withContext(context: Record<string, any>) {
    return {
      debug: (message: string, data?: Record<string, any>) => 
        this.debug(message, { ...context, ...data }),
      info: (message: string, data?: Record<string, any>) => 
        this.info(message, { ...context, ...data }),
      warn: (message: string, data?: Record<string, any>) => 
        this.warn(message, { ...context, ...data }),
      error: (message: string, error?: Error, data?: Record<string, any>) => 
        this.error(message, error, { ...context, ...data })
    }
  }
}

// =======================
// Export Logger Instance
// =======================

export const logger = new Logger()

// =======================
// Utility Functions
// =======================

/**
 * Create a logger with trace context
 */
export function createTraceLogger(traceId: string, userId?: string) {
  return logger.withContext({ traceId, userId })
}

/**
 * Log performance metrics
 */
export function logPerformance(
  operation: string,
  duration: number,
  context?: Record<string, any>
): void {
  logger.debug('Performance metric', {
    operation,
    duration,
    ...context
  })
}

/**
 * Log API request
 */
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  traceId?: string
): void {
  logger.info('API request', {
    method,
    path,
    statusCode,
    duration,
    traceId
  })
}

/**
 * Log API error
 */
export function logError(
  error: Error,
  context?: Record<string, any>
): void {
  logger.error('API error', error, context)
}
