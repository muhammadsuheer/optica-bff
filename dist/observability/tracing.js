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
import { config } from '../config/env';
import { logger } from '../utils/logger';
class ObservabilityService {
    traces = new Map();
    metrics = [];
    performanceData = [];
    /**
     * Generate a unique trace ID
     */
    generateTraceId() {
        return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Generate a unique span ID
     */
    generateSpanId() {
        return `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Start a new trace
     */
    startTrace(operation, parentSpanId, tags = {}) {
        const traceId = this.generateTraceId();
        const spanId = this.generateSpanId();
        const trace = {
            traceId,
            spanId,
            parentSpanId,
            operation,
            startTime: Date.now(),
            tags: {
                ...tags,
                'service.name': 'optia-bff',
                'service.version': '1.0.0',
                'service.environment': config.nodeEnv
            },
            logs: []
        };
        this.traces.set(traceId, trace);
        logger.debug('Trace started', {
            traceId,
            spanId,
            operation,
            parentSpanId
        });
        return trace;
    }
    /**
     * Finish a trace
     */
    finishTrace(traceId, error) {
        const trace = this.traces.get(traceId);
        if (!trace) {
            logger.warn('Trace not found', { traceId });
            return;
        }
        trace.endTime = Date.now();
        trace.duration = trace.endTime - trace.startTime;
        if (error) {
            trace.error = {
                message: error.message,
                stack: error.stack,
                code: error.code
            };
            trace.tags['error'] = true;
            trace.tags['error.message'] = error.message;
        }
        // Record performance data
        this.performanceData.push({
            timestamp: trace.startTime,
            duration: trace.duration,
            success: !error,
            operation: trace.operation
        });
        // Keep only last 1000 performance records
        if (this.performanceData.length > 1000) {
            this.performanceData = this.performanceData.slice(-1000);
        }
        logger.debug('Trace finished', {
            traceId,
            duration: trace.duration,
            success: !error
        });
        // Send to external monitoring if configured
        this.sendTraceToMonitoring(trace);
        // Remove from memory
        this.traces.delete(traceId);
    }
    /**
     * Add a log entry to a trace
     */
    addLog(traceId, level, message, data) {
        const trace = this.traces.get(traceId);
        if (!trace) {
            logger.warn('Trace not found for log', { traceId });
            return;
        }
        trace.logs.push({
            timestamp: Date.now(),
            level,
            message,
            data
        });
        logger.debug('Log added to trace', { traceId, level, message });
    }
    /**
     * Add tags to a trace
     */
    addTags(traceId, tags) {
        const trace = this.traces.get(traceId);
        if (!trace) {
            logger.warn('Trace not found for tags', { traceId });
            return;
        }
        Object.assign(trace.tags, tags);
        logger.debug('Tags added to trace', { traceId, tags });
    }
    /**
     * Record a metric
     */
    recordMetric(name, value, unit = 'count', tags = {}) {
        const metric = {
            name,
            value,
            unit,
            tags: {
                ...tags,
                'service.name': 'optia-bff',
                'service.version': '1.0.0',
                'service.environment': config.nodeEnv
            },
            timestamp: Date.now()
        };
        this.metrics.push(metric);
        // Keep only last 1000 metrics
        if (this.metrics.length > 1000) {
            this.metrics = this.metrics.slice(-1000);
        }
        logger.debug('Metric recorded', { name, value, unit, tags });
    }
    /**
     * Increment a counter metric
     */
    incrementCounter(name, tags = {}) {
        this.recordMetric(name, 1, 'count', tags);
    }
    /**
     * Record a timing metric
     */
    recordTiming(name, duration, tags = {}) {
        this.recordMetric(name, duration, 'ms', tags);
    }
    /**
     * Record a gauge metric
     */
    recordGauge(name, value, tags = {}) {
        this.recordMetric(name, value, 'gauge', tags);
    }
    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        // Filter data from last hour
        const recentData = this.performanceData.filter(d => d.timestamp > oneHourAgo);
        if (recentData.length === 0) {
            return {
                requestCount: 0,
                averageResponseTime: 0,
                errorRate: 0,
                throughput: 0,
                p95ResponseTime: 0,
                p99ResponseTime: 0
            };
        }
        const durations = recentData.map(d => d.duration).sort((a, b) => a - b);
        const errors = recentData.filter(d => !d.success).length;
        const totalRequests = recentData.length;
        const averageResponseTime = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        const errorRate = (errors / totalRequests) * 100;
        const throughput = totalRequests / 3600; // requests per second over the hour
        const p95Index = Math.floor(durations.length * 0.95);
        const p99Index = Math.floor(durations.length * 0.99);
        return {
            requestCount: totalRequests,
            averageResponseTime: Math.round(averageResponseTime * 100) / 100,
            errorRate: Math.round(errorRate * 100) / 100,
            throughput: Math.round(throughput * 100) / 100,
            p95ResponseTime: durations[p95Index] || 0,
            p99ResponseTime: durations[p99Index] || 0
        };
    }
    /**
     * Get recent metrics
     */
    getRecentMetrics(limit = 100) {
        return this.metrics.slice(-limit);
    }
    /**
     * Get active traces
     */
    getActiveTraces() {
        return Array.from(this.traces.values());
    }
    /**
     * Send trace to external monitoring
     */
    async sendTraceToMonitoring(trace) {
        try {
            // Send to Sentry if configured
            if (config.monitoring.sentryDsn) {
                await this.sendToSentry(trace);
            }
            // Could add other monitoring services here (DataDog, New Relic, etc.)
        }
        catch (error) {
            logger.error('Failed to send trace to monitoring', {
                traceId: trace.traceId,
                error
            });
        }
    }
    /**
     * Send trace to Sentry
     */
    async sendToSentry(trace) {
        try {
            // This would integrate with Sentry SDK
            // For now, just log the trace data
            logger.info('Sentry trace', {
                traceId: trace.traceId,
                spanId: trace.spanId,
                operation: trace.operation,
                duration: trace.duration,
                tags: trace.tags,
                error: trace.error,
                logCount: trace.logs.length
            });
        }
        catch (error) {
            logger.error('Failed to send trace to Sentry', { error });
        }
    }
    /**
     * Create a child span
     */
    createChildSpan(parentTraceId, operation, tags = {}) {
        const parentTrace = this.traces.get(parentTraceId);
        if (!parentTrace) {
            logger.warn('Parent trace not found', { parentTraceId });
            return null;
        }
        return this.startTrace(operation, parentTrace.spanId, tags);
    }
    /**
     * Health check
     */
    async healthCheck() {
        const startTime = Date.now();
        try {
            // Test basic functionality
            const testTrace = this.startTrace('health_check');
            this.addLog(testTrace.traceId, 'info', 'Health check started');
            this.finishTrace(testTrace.traceId);
            const latency = Date.now() - startTime;
            return {
                healthy: true,
                latency
            };
        }
        catch (error) {
            return {
                healthy: false,
                latency: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
// Export singleton instance
export const observabilityService = new ObservabilityService();
// Export class for testing
export { ObservabilityService };
// Utility functions for easy use
export function startTrace(operation, parentSpanId, tags) {
    return observabilityService.startTrace(operation, parentSpanId, tags);
}
export function finishTrace(traceId, error) {
    observabilityService.finishTrace(traceId, error);
}
export function addLog(traceId, level, message, data) {
    observabilityService.addLog(traceId, level, message, data);
}
export function addTags(traceId, tags) {
    observabilityService.addTags(traceId, tags);
}
export function recordMetric(name, value, unit, tags) {
    observabilityService.recordMetric(name, value, unit, tags);
}
export function incrementCounter(name, tags) {
    observabilityService.incrementCounter(name, tags);
}
export function recordTiming(name, duration, tags) {
    observabilityService.recordTiming(name, duration, tags);
}
export function recordGauge(name, value, tags) {
    observabilityService.recordGauge(name, value, tags);
}
//# sourceMappingURL=tracing.js.map