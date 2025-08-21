// Precompiled regex patterns for performance
const SCRIPT_TAG_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const EVENT_ATTR_REGEX = /\s*on\w+\s*=\s*["'][^"']*["']/gi;
const JAVASCRIPT_URL_REGEX = /href\s*=\s*["']javascript:[^"']*["']/gi;
const STYLE_ATTR_REGEX = /\s*style\s*=\s*["'][^"']*["']/gi;
const DATA_URI_REGEX = /src\s*=\s*["']data:[^"']*["']/gi;
const WHITESPACE_REGEX = /\s+/g;
const HTML_TAG_REGEX = /<[^>]*>/g;
// HTML entity map for decoding
const HTML_ENTITIES = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
};
const ENTITY_REGEX = /&[a-zA-Z0-9#]+;/g;
/**
 * Creates a precompiled sanitizer with specific configuration
 */
export function createSanitizer(config = {}) {
    const finalConfig = {
        removeScripts: true,
        removeEventHandlers: true,
        removeJavaScriptUrls: true,
        removeStyles: true,
        removeDataUris: true,
        normalizeWhitespace: true,
        ...config,
    };
    return function sanitize(html) {
        if (!html || typeof html !== 'string') {
            return '';
        }
        let result = html;
        if (finalConfig.removeScripts) {
            result = result.replace(SCRIPT_TAG_REGEX, '');
        }
        if (finalConfig.removeEventHandlers) {
            result = result.replace(EVENT_ATTR_REGEX, '');
        }
        if (finalConfig.removeJavaScriptUrls) {
            result = result.replace(JAVASCRIPT_URL_REGEX, '');
        }
        if (finalConfig.removeStyles) {
            result = result.replace(STYLE_ATTR_REGEX, '');
        }
        if (finalConfig.removeDataUris) {
            result = result.replace(DATA_URI_REGEX, '');
        }
        if (finalConfig.normalizeWhitespace) {
            result = result.replace(WHITESPACE_REGEX, ' ').trim();
        }
        return result;
    };
}
/**
 * Default sanitizer instance for backward compatibility
 */
const defaultSanitizer = createSanitizer();
/**
 * Sanitizes HTML content from WordPress to prevent XSS
 */
export function sanitizeHtml(html) {
    return defaultSanitizer(html);
}
/**
 * Strips all HTML tags and returns plain text
 */
export function stripHtml(html) {
    if (!html || typeof html !== 'string') {
        return '';
    }
    return html
        .replace(HTML_TAG_REGEX, '')
        .replace(ENTITY_REGEX, (entity) => HTML_ENTITIES[entity] || entity)
        .replace(WHITESPACE_REGEX, ' ')
        .trim();
}
/**
 * Truncates text to specified length with ellipsis
 */
export function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) {
        return text;
    }
    return text.slice(0, maxLength - 3) + '...';
}
/**
 * Cleans and validates URLs from WordPress
 */
export function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') {
        return '';
    }
    try {
        const parsed = new URL(url);
        // Only allow http and https protocols
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return '';
        }
        return parsed.toString();
    }
    catch {
        return '';
    }
}
