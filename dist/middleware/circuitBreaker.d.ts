/**
 * Circuit Breaker Pattern for Edge Runtime
 * Prevents cascade failures from external services
 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
interface CircuitBreakerConfig {
    failureThreshold: number;
    recoveryTimeout: number;
    monitoringPeriod: number;
}
export declare class CircuitBreaker {
    private name;
    private config;
    private state;
    private failures;
    private lastFailureTime;
    private lastSuccessTime;
    constructor(name: string, config?: CircuitBreakerConfig);
    execute<T>(operation: () => Promise<T>): Promise<T>;
    private onSuccess;
    private onFailure;
    getState(): CircuitState;
    getMetrics(): {
        state: CircuitState;
        failures: number;
        lastFailureTime: number;
        lastSuccessTime: number;
    };
}
export declare const circuitBreakers: {
    woocommerce: CircuitBreaker;
    supabase: CircuitBreaker;
};
export {};
//# sourceMappingURL=circuitBreaker.d.ts.map