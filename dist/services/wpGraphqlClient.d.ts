/**
 * WordPress GraphQL Client - Edge Runtime Compatible
 *
 * Features:
 * - GraphQL queries and mutations
 * - Authentication handling
 * - Request/response logging
 * - Error handling and retries
 * - Query optimization
 */
export interface GraphQLRequest {
    query: string;
    variables?: Record<string, any>;
    operationName?: string;
}
export interface GraphQLResponse<T = any> {
    data?: T;
    errors?: Array<{
        message: string;
        locations?: Array<{
            line: number;
            column: number;
        }>;
        path?: string[];
        extensions?: Record<string, any>;
    }>;
    extensions?: Record<string, any>;
}
export interface GraphQLRequestOptions {
    headers?: Record<string, string>;
    timeout?: number;
    retries?: number;
}
declare class WpGraphqlClient {
    private endpoint;
    private authToken?;
    private timeout;
    private maxRetries;
    constructor();
    /**
     * Set authentication token
     */
    setAuthToken(token: string): void;
    /**
     * Make GraphQL request
     */
    request<T = any>(request: GraphQLRequest, options?: GraphQLRequestOptions): Promise<GraphQLResponse<T>>;
    /**
     * Query posts
     */
    getPosts(params?: {
        first?: number;
        after?: string;
        search?: string;
        category?: string;
        tag?: string;
        status?: string;
        orderBy?: string;
        order?: 'ASC' | 'DESC';
    }): Promise<GraphQLResponse<any>>;
    /**
     * Get a single post
     */
    getPost(id: string | number, idType?: 'ID' | 'SLUG'): Promise<GraphQLResponse<any>>;
    /**
     * Get pages
     */
    getPages(params?: {
        first?: number;
        after?: string;
        search?: string;
        parent?: string;
        status?: string;
        orderBy?: string;
        order?: 'ASC' | 'DESC';
    }): Promise<GraphQLResponse<any>>;
    /**
     * Get categories
     */
    getCategories(params?: {
        first?: number;
        after?: string;
        search?: string;
        hideEmpty?: boolean;
        orderBy?: string;
        order?: 'ASC' | 'DESC';
    }): Promise<GraphQLResponse<any>>;
    /**
     * Get media items
     */
    getMedia(params?: {
        first?: number;
        after?: string;
        search?: string;
        mimeType?: string;
        orderBy?: string;
        order?: 'ASC' | 'DESC';
    }): Promise<GraphQLResponse<any>>;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        healthy: boolean;
        latency: number;
        error?: string;
    }>;
}
export declare const wpGraphqlClient: WpGraphqlClient;
export { WpGraphqlClient };
export type { GraphQLRequest, GraphQLResponse, GraphQLRequestOptions };
//# sourceMappingURL=wpGraphqlClient.d.ts.map