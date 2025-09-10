/**
 * Observability and Tracing Service - Edge Runtime Compatible
 *
 * Features:
 * - Request tracing
 * - Performance monitoring
 * - Error tracking
 * - Metrics collection
 * - Sentry integration
 */
export interface TraceContext {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    operation: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    tags: Record<string, string | number | boolean>;
    logs: Array<{
        timestamp: number;
        level: 'debug' | 'info' | 'warn' | 'error';
        message: string;
        data?: any;
    }>;
    error?: {
        message: string;
        stack?: string;
        code?: string;
    };
}
export interface Metric {
    name: string;
    value: number;
    unit: string;
    tags: Record<string, string>;
    timestamp: number;
}
export interface PerformanceMetrics {
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
}
declare class ObservabilityService {
    private traces;
    private metrics;
    private performanceData;
    /**
     * Generate a unique trace ID
     */
    private generateTraceId;
    /**
     * Generate a unique span ID
     */
    private generateSpanId;
    /**
     * Start a new trace
     */
    startTrace(operation: string, parentSpanId?: string, tags?: Record<string, string | number | boolean>): TraceContext;
    /**
     * Finish a trace
     */
    finishTrace(traceId: string, error?: Error): void;
    /**
     * Add a log entry to a trace
     */
    addLog(traceId: string, level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void;
    /**
     * Add tags to a trace
     */
    addTags(traceId: string, tags: Record<string, string | number | boolean>): void;
    /**
     * Record a metric
     */
    recordMetric(name: string, value: number, unit?: string, tags?: Record<string, string>): void;
    /**
     * Increment a counter metric
     */
    incrementCounter(name: string, tags?: Record<string, string>): void;
    /**
     * Record a timing metric
     */
    recordTiming(name: string, duration: number, tags?: Record<string, string>): void;
    /**
     * Record a gauge metric
     */
    recordGauge(name: string, value: number, tags?: Record<string, string>): void;
    /**
     * Get performance metrics
     */
    getPerformanceMetrics(): PerformanceMetrics;
    /**
     * Get recent metrics
     */
    getRecentMetrics(limit?: number): Metric[];
    /**
     * Get active traces
     */
    getActiveTraces(): TraceContext[];
    /**
     * Send trace to external monitoring
     */
    private sendTraceToMonitoring;
    /**
     * Send trace to Sentry
     */
    private sendToSentry;
    /**
     * Create a child span
     */
    createChildSpan(parentTraceId: string, operation: string, tags?: Record<string, string | number | boolean>): TraceContext | null;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        healthy: boolean;
        latency: number;
        error?: string;
    }>;
}
export declare const observabilityService: ObservabilityService;
export { ObservabilityService };
export type { TraceContext, Metric, PerformanceMetrics };
export declare function startTrace(operation: string, parentSpanId?: string, tags?: Record<string, string | number | boolean>): TraceContext;
export declare function finishTrace(traceId: string, error?: Error): void;
export declare function addLog(traceId: string, level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void;
export declare function addTags(traceId: string, tags: Record<string, string | number | boolean>): void;
export declare function recordMetric(name: string, value: number, unit?: string, tags?: Record<string, string>): void;
export declare function incrementCounter(name: string, tags?: Record<string, string>): void;
export declare function recordTiming(name: string, duration: number, tags?: Record<string, string>): void;
export declare function recordGauge(name: string, value: number, tags?: Record<string, string>): void;
//# sourceMappingURL=tracing.d.ts.map