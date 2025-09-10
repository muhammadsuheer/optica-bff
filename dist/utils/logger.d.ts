/**
 * Edge-Compatible Logger for Vercel Edge Runtime
 * Uses console methods only (no Node.js dependencies)
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
declare class EdgeLogger {
    private logLevel;
    private context;
    constructor(level?: LogLevel);
    setLevel(level: LogLevel): void;
    setContext(context: Record<string, any>): void;
    private shouldLog;
    private formatLog;
    debug(message: string, data?: any): void;
    info(message: string, data?: any): void;
    warn(message: string, data?: any): void;
    error(message: string, error?: Error | any): void;
    child(context: Record<string, any>): EdgeLogger;
}
export declare const logger: EdgeLogger;
export { EdgeLogger };
//# sourceMappingURL=logger.d.ts.map