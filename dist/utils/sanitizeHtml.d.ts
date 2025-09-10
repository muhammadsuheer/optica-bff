/**
 * Edge-Compatible HTML Sanitizer
 * Uses DOMParser API available in Edge runtime
 */
/**
 * Sanitize HTML content to prevent XSS attacks
 * Uses DOMParser which is available in Edge runtime
 */
export declare function sanitizeHtml(html: string): string;
/**
 * Strip all HTML tags and return plain text
 */
export declare function stripHtml(html: string): string;
/**
 * Truncate HTML content to a specified length while preserving tags
 */
export declare function truncateHtml(html: string, maxLength: number): string;
//# sourceMappingURL=sanitizeHtml.d.ts.map