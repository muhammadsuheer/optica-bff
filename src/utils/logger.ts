/**
 * Edge-Compatible Logger for Vercel Edge Runtime
 * Uses console methods only (no Node.js dependencies)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: any
  requestId?: string
  userId?: string
}

class EdgeLogger {
  private logLevel: LogLevel = 'info'
  private context: Record<string, any> = {}

  constructor(level: LogLevel = 'info') {
    this.logLevel = level
  }

  setLevel(level: LogLevel): void {
    this.logLevel = level
  }

  setContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    }
    return levels[level] >= levels[this.logLevel]
  }

  private formatLog(level: LogLevel, message: string, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      ...this.context
    }
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      const logEntry = this.formatLog('debug', message, data)
      console.debug(JSON.stringify(logEntry))
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      const logEntry = this.formatLog('info', message, data)
      console.info(JSON.stringify(logEntry))
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      const logEntry = this.formatLog('warn', message, data)
      console.warn(JSON.stringify(logEntry))
    }
  }

  error(message: string, error?: Error | any): void {
    if (this.shouldLog('error')) {
      const errorData = error instanceof Error 
        ? { 
            name: error.name, 
            message: error.message, 
            stack: error.stack 
          }
        : error

      const logEntry = this.formatLog('error', message, errorData)
      console.error(JSON.stringify(logEntry))
    }
  }

  child(context: Record<string, any>): EdgeLogger {
    const childLogger = new EdgeLogger(this.logLevel)
    childLogger.setContext({ ...this.context, ...context })
    return childLogger
  }
}

// Create and export default logger instance
import { env } from '../config/env'

export const logger = new EdgeLogger(
  env.IS_DEVELOPMENT ? 'debug' : 'info'
)

// Export logger class for custom instances
export { EdgeLogger }
