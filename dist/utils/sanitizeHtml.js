/**
 * Edge-Compatible HTML Sanitizer
 * Uses DOMParser API available in Edge runtime
 */
// Maximum HTML content length to prevent DoS
const MAX_HTML_LENGTH = 50000; // 50KB
// Allowed domains for external links (security)
const ALLOWED_DOMAINS = [
    'example.com',
    'trusted-site.com'
    // Add your trusted domains here
];
// Allowed HTML tags for content sanitization
const ALLOWED_TAGS = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'img',
    'blockquote', 'code', 'pre'
];
// Allowed attributes for HTML tags
const ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target'],
    'img': ['src', 'alt', 'width', 'height', 'title'],
    'span': ['class'],
    'div': ['class'],
    'p': ['class'],
    'h1': ['class'],
    'h2': ['class'],
    'h3': ['class'],
    'h4': ['class'],
    'h5': ['class'],
    'h6': ['class']
};
/**
 * Sanitize HTML content to prevent XSS attacks
 * Uses DOMParser which is available in Edge runtime
 */
export function sanitizeHtml(html) {
    if (!html || typeof html !== 'string') {
        return '';
    }
    // Prevent DoS attacks with large HTML content
    if (html.length > MAX_HTML_LENGTH) {
        throw new Error(`HTML content too large. Maximum ${MAX_HTML_LENGTH} characters allowed.`);
    }
    try {
        // Parse HTML using DOMParser (available in Edge runtime)
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        // Function to clean a node
        const cleanNode = (node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node;
                // Check if tag is allowed
                if (!ALLOWED_TAGS.includes(element.tagName.toLowerCase())) {
                    // Replace with text content
                    const textNode = doc.createTextNode(element.textContent || '');
                    element.parentNode?.replaceChild(textNode, element);
                    return;
                }
                // Clean attributes
                const allowedAttrs = ALLOWED_ATTRIBUTES[element.tagName.toLowerCase()] || [];
                const attrs = Array.from(element.attributes);
                attrs.forEach(attr => {
                    if (!allowedAttrs.includes(attr.name)) {
                        element.removeAttribute(attr.name);
                    }
                    else {
                        // Sanitize attribute values
                        const cleanValue = sanitizeAttributeValue(attr.name, attr.value);
                        if (cleanValue !== attr.value) {
                            element.setAttribute(attr.name, cleanValue);
                        }
                    }
                });
            }
            // Recursively clean child nodes
            const children = Array.from(node.childNodes);
            children.forEach(child => cleanNode(child));
        };
        // Clean the document body
        if (doc.body) {
            cleanNode(doc.body);
            return doc.body.innerHTML;
        }
        return '';
    }
    catch (error) {
        // If parsing fails, return plain text
        return html.replace(/<[^>]*>/g, '');
    }
}
/**
 * Sanitize attribute values
 */
function sanitizeAttributeValue(attrName, value) {
    switch (attrName) {
        case 'href':
            // Allow mailto and relative URLs
            if (value.match(/^mailto:/i) || value.match(/^\/[^\/]/)) {
                return value;
            }
            // For external URLs, check domain whitelist
            if (value.match(/^https?:\/\//i)) {
                try {
                    const url = new URL(value);
                    const isAllowedDomain = ALLOWED_DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
                    return isAllowedDomain ? value : '';
                }
                catch {
                    return '';
                }
            }
            return '';
        case 'src':
            // Only allow https URLs for images (no http for security)
            if (value.match(/^https:\/\//i)) {
                try {
                    const url = new URL(value);
                    const isAllowedDomain = ALLOWED_DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
                    return isAllowedDomain ? value : '';
                }
                catch {
                    return '';
                }
            }
            return '';
        case 'target':
            // Only allow specific target values
            return ['_blank', '_self', '_parent', '_top'].includes(value) ? value : '_self';
        default:
            // Remove potentially dangerous characters
            return value.replace(/[<>"']/g, '');
    }
}
/**
 * Strip all HTML tags and return plain text
 */
export function stripHtml(html) {
    if (!html || typeof html !== 'string') {
        return '';
    }
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        return doc.body?.textContent || '';
    }
    catch {
        // Fallback: simple regex replacement
        return html.replace(/<[^>]*>/g, '');
    }
}
/**
 * Truncate HTML content to a specified length while preserving tags
 */
export function truncateHtml(html, maxLength) {
    const plainText = stripHtml(html);
    if (plainText.length <= maxLength) {
        return html;
    }
    // Find a good truncation point
    const truncated = plainText.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    const truncateAt = lastSpace > maxLength * 0.8 ? lastSpace : maxLength;
    const truncatedText = plainText.substring(0, truncateAt);
    // Try to preserve basic formatting
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const textContent = doc.body?.textContent || '';
        if (textContent.length <= maxLength) {
            return html;
        }
        // Simple truncation preserving some structure
        const ratio = truncateAt / textContent.length;
        const estimatedHtmlLength = Math.floor(html.length * ratio);
        return html.substring(0, estimatedHtmlLength) + '...';
    }
    catch {
        return truncatedText + '...';
    }
}
//# sourceMappingURL=sanitizeHtml.js.map