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
import { config } from '../config/env';
import { logger } from '../utils/logger';
class WpGraphqlClient {
    endpoint;
    authToken;
    timeout;
    maxRetries;
    constructor() {
        this.endpoint = config.wordpress.graphqlUrl || `${config.woocommerce.apiUrl.replace('/wp-json/wc/v3', '')}/graphql`;
        this.timeout = 30000; // 30 seconds
        this.maxRetries = 3;
    }
    /**
     * Set authentication token
     */
    setAuthToken(token) {
        this.authToken = token;
    }
    /**
     * Make GraphQL request
     */
    async request(request, options = {}) {
        const { headers = {}, timeout = this.timeout, retries = this.maxRetries } = options;
        const requestBody = {
            query: request.query,
            variables: request.variables || {},
            operationName: request.operationName
        };
        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Optia-BFF/1.0.0',
                ...headers
            },
            body: JSON.stringify(requestBody)
        };
        // Add authentication if available
        if (this.authToken) {
            requestOptions.headers = {
                ...requestOptions.headers,
                'Authorization': `Bearer ${this.authToken}`
            };
        }
        let lastError = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const startTime = Date.now();
                // Create abort controller for timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                requestOptions.signal = controller.signal;
                const response = await fetch(this.endpoint, requestOptions);
                clearTimeout(timeoutId);
                const responseTime = Date.now() - startTime;
                let result;
                const contentType = response.headers.get('content-type');
                if (contentType?.includes('application/json')) {
                    result = await response.json();
                }
                else {
                    const text = await response.text();
                    throw new Error(`Invalid response format: ${text}`);
                }
                // Log request
                logger.debug('GraphQL request completed', {
                    operationName: request.operationName,
                    status: response.status,
                    responseTime,
                    attempt: attempt + 1,
                    hasErrors: !!result.errors
                });
                if (result.errors && result.errors.length > 0) {
                    logger.warn('GraphQL request had errors', {
                        operationName: request.operationName,
                        errors: result.errors.map(e => e.message)
                    });
                }
                return result;
            }
            catch (error) {
                lastError = error;
                // Log failed request
                logger.warn('GraphQL request failed', {
                    operationName: request.operationName,
                    attempt: attempt + 1,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    willRetry: attempt < retries
                });
                // Don't retry on certain errors
                if (error instanceof Error) {
                    if (error.name === 'AbortError') {
                        // Timeout - don't retry
                        break;
                    }
                    if (error.message.includes('400') || error.message.includes('401') || error.message.includes('403')) {
                        // Client errors - don't retry
                        break;
                    }
                }
                // Wait before retry (exponential backoff)
                if (attempt < retries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        // All retries failed
        logger.error('GraphQL request failed after all retries', {
            operationName: request.operationName,
            error: lastError?.message || 'Request failed after all retries'
        });
        return {
            errors: [{
                    message: lastError?.message || 'Request failed after all retries'
                }]
        };
    }
    /**
     * Query posts
     */
    async getPosts(params = {}) {
        const { first = 10, after, search, category, tag, status = 'PUBLISH', orderBy = 'DATE', order = 'DESC' } = params;
        const query = `
      query GetPosts($first: Int, $after: String, $search: String, $category: String, $tag: String, $status: PostStatusEnum, $orderBy: PostObjectsConnectionOrderbyEnum, $order: OrderEnum) {
        posts(
          first: $first
          after: $after
          where: {
            search: $search
            categoryName: $category
            tagSlugIn: $tag
            status: $status
            orderby: { field: $orderBy, order: $order }
          }
        ) {
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          edges {
            node {
              id
              title
              slug
              excerpt
              content
              date
              modified
              status
              featuredImage {
                node {
                  id
                  sourceUrl
                  altText
                }
              }
              categories {
                nodes {
                  id
                  name
                  slug
                }
              }
              tags {
                nodes {
                  id
                  name
                  slug
                }
              }
              author {
                node {
                  id
                  name
                  slug
                }
              }
            }
          }
        }
      }
    `;
        return this.request({
            query,
            variables: {
                first,
                after,
                search,
                category,
                tag,
                status,
                orderBy,
                order
            },
            operationName: 'GetPosts'
        });
    }
    /**
     * Get a single post
     */
    async getPost(id, idType = 'ID') {
        const query = `
      query GetPost($id: ID!, $idType: PostIdType) {
        post(id: $id, idType: $idType) {
          id
          title
          slug
          excerpt
          content
          date
          modified
          status
          featuredImage {
            node {
              id
              sourceUrl
              altText
            }
          }
          categories {
            nodes {
              id
              name
              slug
            }
          }
          tags {
            nodes {
              id
              name
              slug
            }
          }
          author {
            node {
              id
              name
              slug
            }
          }
        }
      }
    `;
        return this.request({
            query,
            variables: { id: id.toString(), idType },
            operationName: 'GetPost'
        });
    }
    /**
     * Get pages
     */
    async getPages(params = {}) {
        const { first = 10, after, search, parent, status = 'PUBLISH', orderBy = 'DATE', order = 'DESC' } = params;
        const query = `
      query GetPages($first: Int, $after: String, $search: String, $parent: ID, $status: PostStatusEnum, $orderBy: PostObjectsConnectionOrderbyEnum, $order: OrderEnum) {
        pages(
          first: $first
          after: $after
          where: {
            search: $search
            parent: $parent
            status: $status
            orderby: { field: $orderBy, order: $order }
          }
        ) {
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          edges {
            node {
              id
              title
              slug
              excerpt
              content
              date
              modified
              status
              featuredImage {
                node {
                  id
                  sourceUrl
                  altText
                }
              }
              parent {
                node {
                  id
                  title
                  slug
                }
              }
            }
          }
        }
      }
    `;
        return this.request({
            query,
            variables: {
                first,
                after,
                search,
                parent,
                status,
                orderBy,
                order
            },
            operationName: 'GetPages'
        });
    }
    /**
     * Get categories
     */
    async getCategories(params = {}) {
        const { first = 50, after, search, hideEmpty = true, orderBy = 'NAME', order = 'ASC' } = params;
        const query = `
      query GetCategories($first: Int, $after: String, $search: String, $hideEmpty: Boolean, $orderBy: TermObjectsConnectionOrderbyEnum, $order: OrderEnum) {
        categories(
          first: $first
          after: $after
          where: {
            search: $search
            hideEmpty: $hideEmpty
            orderby: { field: $orderBy, order: $order }
          }
        ) {
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          edges {
            node {
              id
              name
              slug
              description
              count
              parent {
                node {
                  id
                  name
                  slug
                }
              }
            }
          }
        }
      }
    `;
        return this.request({
            query,
            variables: {
                first,
                after,
                search,
                hideEmpty,
                orderBy,
                order
            },
            operationName: 'GetCategories'
        });
    }
    /**
     * Get media items
     */
    async getMedia(params = {}) {
        const { first = 20, after, search, mimeType, orderBy = 'DATE', order = 'DESC' } = params;
        const query = `
      query GetMedia($first: Int, $after: String, $search: String, $mimeType: MimeTypeEnum, $orderBy: PostObjectsConnectionOrderbyEnum, $order: OrderEnum) {
        mediaItems(
          first: $first
          after: $after
          where: {
            search: $search
            mimeType: $mimeType
            orderby: { field: $orderBy, order: $order }
          }
        ) {
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          edges {
            node {
              id
              title
              altText
              caption
              description
              sourceUrl
              mimeType
              mediaType
              fileSize
              width
              height
              date
              modified
            }
          }
        }
      }
    `;
        return this.request({
            query,
            variables: {
                first,
                after,
                search,
                mimeType,
                orderBy,
                order
            },
            operationName: 'GetMedia'
        });
    }
    /**
     * Health check
     */
    async healthCheck() {
        const startTime = Date.now();
        try {
            const query = `
        query HealthCheck {
          generalSettings {
            title
            description
          }
        }
      `;
            const response = await this.request({
                query,
                operationName: 'HealthCheck'
            });
            const latency = Date.now() - startTime;
            return {
                healthy: !response.errors || response.errors.length === 0,
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
export const wpGraphqlClient = new WpGraphqlClient();
// Export class for testing
export { WpGraphqlClient };
//# sourceMappingURL=wpGraphqlClient.js.map