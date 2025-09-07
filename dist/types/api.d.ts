export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    code?: string;
    details?: any;
    request_id?: string;
    timestamp?: string;
    response_time_ms?: number;
    cache_status?: 'hit' | 'miss' | 'stale';
}
export interface PaginationParams {
    page: number;
    per_page: number;
    cursor?: string;
}
export interface PaginationResponse {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
    next_cursor?: string;
    prev_cursor?: string;
}
export interface ApiError {
    success: false;
    error: string;
    message: string;
    code: string;
    details?: any;
    request_id?: string;
    timestamp: string;
}
export interface ApiKeyData {
    id: string;
    name: string;
    permissions: string[];
    rateLimit: number;
    rateWindow: number;
    isActive: boolean;
    lastUsedAt?: string;
    usageCount: number;
    expiresAt?: string;
}
export interface CacheMetadata {
    key: string;
    ttl: number;
    tags: string[];
    createdAt: Date;
    expiresAt: Date;
    hitCount: number;
}
export interface RateLimitInfo {
    limit: number;
    remaining: number;
    reset: number;
    window: number;
}
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    version: string;
    uptime: number;
    metrics: {
        database: {
            status: 'healthy' | 'unhealthy';
            latency: number;
            error?: string;
        };
        woocommerce: {
            status: 'healthy' | 'unhealthy';
            latency: number;
            error?: string;
        };
        cache: {
            hitRatio: number;
            hits: number;
            misses: number;
        };
        memory: {
            used: number;
            total: number;
            usage: number;
        };
        errorRate: number;
    };
}
export interface MetricData {
    name: string;
    value: number;
    tags: Record<string, string>;
    timestamp: string;
}
export interface SystemMetrics {
    requests_total: number;
    requests_per_second: number;
    response_time_avg: number;
    response_time_p95: number;
    response_time_p99: number;
    error_rate: number;
    cache_hit_ratio: number;
    memory_usage: number;
    cpu_usage: number;
}
export interface WebSocketMessage {
    type: 'connection' | 'subscribe' | 'unsubscribe' | 'ping' | 'pong' | 'error' | 'data';
    channel?: string;
    event?: string;
    payload?: any;
    timestamp: string;
}
export interface RealtimeSubscription {
    id: string;
    sessionId: string;
    userId?: string;
    channel: string;
    events: string[];
    filters: Record<string, any>;
    isActive: boolean;
    createdAt: string;
    lastPing: string;
}
export interface QueueJob {
    id: string;
    type: string;
    payload: any;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    retryCount: number;
    maxRetries: number;
    createdAt: string;
    processedAt?: string;
    error?: string;
}
export interface WebhookPayload {
    id: string;
    topic: string;
    resource: string;
    resourceId: number;
    event: string;
    payload: any;
    signature?: string;
    deliveryId?: string;
    source?: string;
}
export interface WebhookLog {
    id: string;
    webhookId?: string;
    topic: string;
    resource: string;
    resourceId: number;
    event: string;
    payload: any;
    signature?: string;
    processed: boolean;
    processedAt?: string;
    error?: string;
    retryCount: number;
    createdAt: string;
}
export type SyncStatus = 'synced' | 'pending_sync' | 'syncing' | 'failed' | 'stale';
export interface SyncMetadata {
    lastSyncAt: string;
    syncStatus: SyncStatus;
    syncJobId?: string;
    error?: string;
}
export interface FilterOption {
    value: string;
    label: string;
    count: number;
}
export interface FilterGroup {
    name: string;
    type: 'select' | 'range' | 'checkbox' | 'radio';
    options: FilterOption[];
}
export interface AppliedFilters {
    [key: string]: string | number | boolean | string[];
}
export interface AvailableFilters {
    [key: string]: FilterGroup;
}
export interface SearchQuery {
    q: string;
    filters?: AppliedFilters;
    sort?: string;
    order?: 'asc' | 'desc';
    facets?: string[];
}
export interface SearchResult<T> {
    items: T[];
    total: number;
    facets?: Record<string, FilterOption[]>;
    suggestions?: string[];
    query: SearchQuery;
    took: number;
}
export interface OptimisticUpdate {
    id: string;
    type: string;
    status: 'pending' | 'success' | 'failed';
    data: any;
    originalData?: any;
    syncJobId?: string;
    createdAt: string;
    resolvedAt?: string;
    error?: string;
}
export interface CostMetrics {
    daily: number;
    monthly: number;
    requests: number;
    bandwidth: number;
    storage: number;
    compute: number;
    estimatedCost: number;
}
export interface CostAlert {
    type: 'warning' | 'critical' | 'emergency';
    threshold: number;
    current: number;
    actions: string[];
    triggeredAt: string;
}
//# sourceMappingURL=api.d.ts.map