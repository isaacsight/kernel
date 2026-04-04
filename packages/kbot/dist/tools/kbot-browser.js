// kbot Built-In Browser — Zero-dependency web engine (no Chrome, no Playwright)
//
// A purpose-built browsing engine that kbot owns and controls completely.
// HTML-only — no JavaScript execution (this is a feature, not a bug).
// SSRF-protected, rate-limited, session-only cookies.
//
// Tools: browser_navigate, browser_search, browser_click,
//        browser_scroll, browser_read, browser_tabs, browser_back
//
// Stream integration: drawBrowserPanel() renders a mini browser on the canvas.
// Chat commands: !browse, !search, !click, !scroll, !tabs
import { lookup } from 'node:dns/promises';
import { registerTool } from './index.js';
// ── Constants ──
const KBOT_VERSION = '3.86.0';
const USER_AGENT = `KBot/${KBOT_VERSION} (https://kernel.chat; terminal AI agent)`;
const MAX_PAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_CONTENT_LENGTH = 5000; // chars for readable content
const SCROLL_LINES = 20; // lines per scroll
const RATE_LIMIT_MS = 2000; // min ms between requests
const FETCH_TIMEOUT_MS = 15000;
/** Private/reserved IP patterns — block SSRF */
const BLOCKED_IP_PATTERNS = [
    /^127\.\d+\.\d+\.\d+$/,
    /^10\.\d+\.\d+\.\d+$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
    /^192\.168\.\d+\.\d+$/,
    /^0\.0\.0\.0$/,
    /^::1$/,
    /^fd[0-9a-f]{2}:/i,
    /^fe80:/i,
    /^169\.254\.\d+\.\d+$/,
];
const BLOCKED_HOSTNAMES = [
    /^localhost$/i,
    /\.local$/i,
    /^metadata\.google\.internal$/i,
];
const BLOCKED_PROTOCOLS = new Set(['file:', 'data:', 'javascript:', 'vbscript:', 'ftp:']);
// ── Singleton browser instance ──
let _browser = null;
let _lastRequestTime = 0;
export function getBrowser() {
    if (!_browser) {
        _browser = {
            tabs: [],
            activeTab: -1,
            history: [],
            bookmarks: [],
            cookies: new Map(),
            userAgent: USER_AGENT,
        };
    }
    return _browser;
}
/** Reset browser state (for testing or cleanup) */
export function resetBrowser() {
    _browser = null;
    _lastRequestTime = 0;
}
// ── SSRF Protection ──
function isBlockedIP(ip) {
    return BLOCKED_IP_PATTERNS.some(p => p.test(ip));
}
function isBlockedHost(hostname) {
    return BLOCKED_HOSTNAMES.some(p => p.test(hostname));
}
async function checkSSRF(hostname) {
    if (isBlockedHost(hostname))
        return 'Blocked: private/reserved hostname';
    // IP literal check
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(':')) {
        if (isBlockedIP(hostname))
            return 'Blocked: private/reserved IP range';
        return null;
    }
    // DNS resolution check (catches rebinding attacks)
    try {
        const { address } = await lookup(hostname);
        if (isBlockedIP(address))
            return `Blocked: ${hostname} resolves to private IP ${address}`;
    }
    catch {
        // DNS failure — let fetch handle it
    }
    return null;
}
function validateUrl(urlStr) {
    let url;
    try {
        // Auto-prepend https:// if no protocol
        if (!/^https?:\/\//i.test(urlStr) && !urlStr.includes('://')) {
            urlStr = 'https://' + urlStr;
        }
        url = new URL(urlStr);
    }
    catch {
        return { url: null, error: `Invalid URL: ${urlStr}` };
    }
    if (BLOCKED_PROTOCOLS.has(url.protocol)) {
        return { url, error: `Blocked protocol: ${url.protocol} — only http/https allowed` };
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
        return { url, error: `Unsupported protocol: ${url.protocol}` };
    }
    return { url };
}
// ── Rate Limiting ──
async function enforceRateLimit() {
    const now = Date.now();
    const elapsed = now - _lastRequestTime;
    if (elapsed < RATE_LIMIT_MS && _lastRequestTime > 0) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
    }
    _lastRequestTime = Date.now();
}
// ── HTML Parsing ──
/** Decode common HTML entities */
function decodeEntities(text) {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
/** Extract page title from HTML */
function extractTitle(html) {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return match ? decodeEntities(match[1].trim()) : '(untitled)';
}
/** Extract all links from HTML */
function extractLinks(html, baseUrl) {
    const links = [];
    const seen = new Set();
    const regex = /<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let index = 0;
    while ((match = regex.exec(html)) !== null && index < 200) {
        const rawHref = match[1].trim();
        const rawText = match[2]
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:'))
            continue;
        let resolved;
        try {
            resolved = new URL(rawHref, baseUrl).href;
        }
        catch {
            continue;
        }
        if (seen.has(resolved))
            continue;
        seen.add(resolved);
        const text = decodeEntities(rawText).slice(0, 100) || resolved;
        links.push({ text, url: resolved, index });
        index++;
    }
    return links;
}
/** Extract all forms from HTML */
function extractForms(html, baseUrl) {
    const forms = [];
    const formRegex = /<form\s[^>]*>([\s\S]*?)<\/form>/gi;
    let formMatch;
    let formIndex = 0;
    while ((formMatch = formRegex.exec(html)) !== null && formIndex < 20) {
        const formTag = formMatch[0];
        const formBody = formMatch[1];
        // Extract action and method
        const actionMatch = formTag.match(/action\s*=\s*["']([^"']+)["']/i);
        const methodMatch = formTag.match(/method\s*=\s*["']([^"']+)["']/i);
        let action;
        try {
            action = actionMatch
                ? new URL(actionMatch[1], baseUrl).href
                : baseUrl;
        }
        catch {
            action = baseUrl;
        }
        const method = (methodMatch?.[1] || 'GET').toUpperCase();
        // Extract input fields
        const fields = [];
        const inputRegex = /<(?:input|textarea|select)\s[^>]*>/gi;
        let inputMatch;
        while ((inputMatch = inputRegex.exec(formBody)) !== null) {
            const tag = inputMatch[0];
            const name = tag.match(/name\s*=\s*["']([^"']+)["']/i)?.[1] || '';
            const type = tag.match(/type\s*=\s*["']([^"']+)["']/i)?.[1] || 'text';
            const value = tag.match(/value\s*=\s*["']([^"']*?)["']/i)?.[1] || '';
            const placeholder = tag.match(/placeholder\s*=\s*["']([^"']*?)["']/i)?.[1] || '';
            if (name && type !== 'hidden' && type !== 'submit') {
                fields.push({ name, type, value: decodeEntities(value), placeholder: decodeEntities(placeholder) });
            }
        }
        forms.push({ action, method, fields, index: formIndex });
        formIndex++;
    }
    return forms;
}
/** Extract readable content from HTML (reader mode) */
export function extractReadableContent(html) {
    let text = html;
    // Remove elements that are not content
    text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
    text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');
    text = text.replace(/<header[\s\S]*?<\/header>/gi, '');
    text = text.replace(/<aside[\s\S]*?<\/aside>/gi, '');
    text = text.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
    text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
    text = text.replace(/<svg[\s\S]*?<\/svg>/gi, '');
    // Convert headings to markdown
    text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => `\n# ${stripTags(c).trim()}\n`);
    text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => `\n## ${stripTags(c).trim()}\n`);
    text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, c) => `\n### ${stripTags(c).trim()}\n`);
    text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, c) => `\n#### ${stripTags(c).trim()}\n`);
    text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_, c) => `\n##### ${stripTags(c).trim()}\n`);
    text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, (_, c) => `\n###### ${stripTags(c).trim()}\n`);
    // Convert links to markdown
    text = text.replace(/<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, content) => `[${stripTags(content).trim()}](${href})`);
    // Convert images to descriptive text
    text = text.replace(/<img\s[^>]*alt\s*=\s*["']([^"']*?)["'][^>]*>/gi, (_, alt) => alt ? `[image: ${alt}]` : '');
    text = text.replace(/<img[^>]*>/gi, '');
    // Convert list items
    text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, c) => `\n- ${stripTags(c).trim()}`);
    // Convert blockquotes
    text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c) => `\n> ${stripTags(c).trim()}\n`);
    // Preserve code blocks
    text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) => `\n\`\`\`\n${stripTags(c).trim()}\n\`\`\`\n`);
    text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => `\`${stripTags(c).trim()}\``);
    // Convert table rows
    text = text.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, row) => {
        const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
        const values = cells.map((cell) => stripTags(cell.replace(/<t[dh][^>]*>/i, '').replace(/<\/t[dh]>/i, '')).trim());
        return values.length ? `\n| ${values.join(' | ')} |` : '';
    });
    // Convert block elements to newlines
    text = text.replace(/<\/?(p|div|br|section|article|main|table|tbody|thead)[^>]*>/gi, '\n');
    // Strip all remaining tags
    text = stripTags(text);
    // Decode entities
    text = decodeEntities(text);
    // Clean up whitespace
    text = text
        .replace(/[ \t]+/g, ' ')
        .replace(/\n /g, '\n')
        .replace(/ \n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    // Truncate
    if (text.length > MAX_CONTENT_LENGTH) {
        text = text.slice(0, MAX_CONTENT_LENGTH) + '\n\n... (truncated)';
    }
    return text;
}
/** Strip HTML tags */
function stripTags(html) {
    return html.replace(/<[^>]+>/g, '');
}
// ── ASCII Page Rendering (for stream display) ──
export function renderPageToAscii(tab, width = 60, height = 30) {
    const lines = [];
    // Navigation bar
    const urlDisplay = tab.url.length > width - 12
        ? tab.url.slice(0, width - 15) + '...'
        : tab.url;
    lines.push(`+${'='.repeat(width - 2)}+`);
    lines.push(`| [< > R] ${urlDisplay}${' '.repeat(Math.max(0, width - 12 - urlDisplay.length))} |`);
    lines.push(`+${'-'.repeat(width - 2)}+`);
    // Status line
    if (tab.status === 'loading') {
        const dots = '.'.repeat((Date.now() / 300 | 0) % 4);
        lines.push(`| Loading${dots}${' '.repeat(Math.max(0, width - 12 - dots.length))} |`);
    }
    else if (tab.status === 'error') {
        const errMsg = (tab.error || 'Error loading page').slice(0, width - 4);
        lines.push(`| ${errMsg}${' '.repeat(Math.max(0, width - 2 - errMsg.length))} |`);
    }
    if (tab.status !== 'loaded') {
        // Fill remaining with empty lines
        while (lines.length < height - 1) {
            lines.push(`|${' '.repeat(width - 2)}|`);
        }
        lines.push(`+${'-'.repeat(width - 2)}+`);
        return lines;
    }
    // Content area: word-wrap the readable content
    const contentLines = wordWrap(tab.content, width - 4);
    const maxContentLines = height - 5; // leave room for chrome
    // Apply scroll offset
    const visibleLines = contentLines.slice(tab.scrollY, tab.scrollY + maxContentLines);
    for (const line of visibleLines) {
        const padded = line.slice(0, width - 4);
        lines.push(`| ${padded}${' '.repeat(Math.max(0, width - 4 - padded.length))} |`);
    }
    // Fill remaining space
    while (lines.length < height - 2) {
        lines.push(`|${' '.repeat(width - 2)}|`);
    }
    // Scroll indicator
    const totalPages = Math.ceil(contentLines.length / maxContentLines);
    const currentPage = Math.floor(tab.scrollY / maxContentLines) + 1;
    const scrollInfo = totalPages > 1 ? `[${currentPage}/${totalPages}]` : '';
    lines.push(`| ${scrollInfo}${' '.repeat(Math.max(0, width - 4 - scrollInfo.length))} |`);
    lines.push(`+${'-'.repeat(width - 2)}+`);
    return lines;
}
/** Word-wrap text to a given width */
function wordWrap(text, maxWidth) {
    const lines = [];
    const inputLines = text.split('\n');
    for (const line of inputLines) {
        if (line.length <= maxWidth) {
            lines.push(line);
            continue;
        }
        // Wrap long lines at word boundaries
        const words = line.split(' ');
        let current = '';
        for (const word of words) {
            if (current.length + word.length + 1 > maxWidth) {
                if (current)
                    lines.push(current);
                // If single word is longer than max, break it
                if (word.length > maxWidth) {
                    for (let i = 0; i < word.length; i += maxWidth) {
                        lines.push(word.slice(i, i + maxWidth));
                    }
                    current = '';
                }
                else {
                    current = word;
                }
            }
            else {
                current = current ? current + ' ' + word : word;
            }
        }
        if (current)
            lines.push(current);
    }
    return lines;
}
// ── Core Browser Functions ──
/** Fetch a URL and create a browser tab */
async function fetchPage(browser, url) {
    const tab = {
        url,
        title: '(loading)',
        content: '',
        links: [],
        forms: [],
        status: 'loading',
        html: '',
        screenshot: [],
        scrollY: 0,
        loadedAt: Date.now(),
    };
    const { url: parsed, error: urlError } = validateUrl(url);
    if (urlError) {
        tab.status = 'error';
        tab.error = urlError;
        tab.content = urlError;
        return tab;
    }
    tab.url = parsed.href;
    // SSRF check
    const ssrfBlock = await checkSSRF(parsed.hostname);
    if (ssrfBlock) {
        tab.status = 'error';
        tab.error = ssrfBlock;
        tab.content = ssrfBlock;
        return tab;
    }
    // Rate limit
    await enforceRateLimit();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const res = await fetch(parsed.href, {
            headers: {
                'User-Agent': browser.userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                // Forward cookies for this domain
                ...(browser.cookies.size > 0 ? { 'Cookie': buildCookieHeader(browser, parsed) } : {}),
            },
            signal: controller.signal,
            redirect: 'follow',
        });
        clearTimeout(timeout);
        // Store cookies from response
        const setCookies = res.headers.getSetCookie?.() || [];
        for (const cookie of setCookies) {
            const [nameValue] = cookie.split(';');
            if (nameValue) {
                const [name, ...valueParts] = nameValue.split('=');
                if (name) {
                    browser.cookies.set(`${parsed.hostname}:${name.trim()}`, valueParts.join('=').trim());
                }
            }
        }
        if (!res.ok) {
            tab.status = 'error';
            tab.error = `HTTP ${res.status} ${res.statusText}`;
            tab.content = `Error: HTTP ${res.status} ${res.statusText}`;
            return tab;
        }
        // Check content length
        const contentLength = Number(res.headers.get('content-length') || 0);
        if (contentLength > MAX_PAGE_SIZE) {
            tab.status = 'error';
            tab.error = `Page too large: ${(contentLength / 1024 / 1024).toFixed(1)}MB (max: 2MB)`;
            tab.content = tab.error;
            return tab;
        }
        const html = await res.text();
        if (html.length > MAX_PAGE_SIZE) {
            tab.status = 'error';
            tab.error = `Page too large: ${(html.length / 1024 / 1024).toFixed(1)}MB (max: 2MB)`;
            tab.content = tab.error;
            return tab;
        }
        tab.html = html;
        tab.title = extractTitle(html);
        tab.links = extractLinks(html, parsed.href);
        tab.forms = extractForms(html, parsed.href);
        tab.content = extractReadableContent(html);
        tab.status = 'loaded';
        tab.loadedAt = Date.now();
        tab.screenshot = renderPageToAscii(tab);
    }
    catch (err) {
        tab.status = 'error';
        if (err instanceof Error && err.name === 'AbortError') {
            tab.error = 'Request timed out (15s)';
        }
        else {
            tab.error = err instanceof Error ? err.message : String(err);
        }
        tab.content = `Error: ${tab.error}`;
    }
    return tab;
}
/** Build Cookie header for a domain */
function buildCookieHeader(browser, url) {
    const pairs = [];
    for (const [key, value] of browser.cookies) {
        if (key.startsWith(url.hostname + ':')) {
            const name = key.slice(url.hostname.length + 1);
            pairs.push(`${name}=${value}`);
        }
    }
    return pairs.join('; ');
}
// ── Public API ──
/** Navigate the active tab (or create one) to a URL */
export async function navigateTo(browser, url) {
    const tab = await fetchPage(browser, url);
    if (browser.tabs.length === 0 || browser.activeTab < 0) {
        browser.tabs.push(tab);
        browser.activeTab = 0;
    }
    else {
        browser.tabs[browser.activeTab] = tab;
    }
    if (tab.status === 'loaded') {
        browser.history.push(tab.url);
    }
    return tab;
}
/** Click a link by index on the current page */
export async function clickLink(browser, linkIndex) {
    if (browser.activeTab < 0 || browser.activeTab >= browser.tabs.length) {
        throw new Error('No active tab — navigate to a page first');
    }
    const currentTab = browser.tabs[browser.activeTab];
    const link = currentTab.links.find(l => l.index === linkIndex);
    if (!link) {
        throw new Error(`Link [${linkIndex}] not found. Available links: 0-${currentTab.links.length - 1}`);
    }
    return navigateTo(browser, link.url);
}
/** Fill and submit a form by index */
export async function fillForm(browser, formIndex, values) {
    if (browser.activeTab < 0 || browser.activeTab >= browser.tabs.length) {
        throw new Error('No active tab — navigate to a page first');
    }
    const currentTab = browser.tabs[browser.activeTab];
    const form = currentTab.forms.find(f => f.index === formIndex);
    if (!form) {
        throw new Error(`Form [${formIndex}] not found. Available forms: 0-${currentTab.forms.length - 1}`);
    }
    // Set values
    for (const field of form.fields) {
        if (values[field.name] !== undefined) {
            field.value = values[field.name];
        }
    }
    // Build request
    const params = new URLSearchParams();
    for (const field of form.fields) {
        if (field.value)
            params.set(field.name, field.value);
    }
    if (form.method === 'GET') {
        const url = new URL(form.action);
        url.search = params.toString();
        return navigateTo(browser, url.href);
    }
    // POST submission
    await enforceRateLimit();
    const { url: parsed, error: urlError } = validateUrl(form.action);
    if (urlError) {
        const tab = browser.tabs[browser.activeTab];
        tab.status = 'error';
        tab.error = urlError;
        tab.content = urlError;
        return tab;
    }
    const ssrfBlock = await checkSSRF(parsed.hostname);
    if (ssrfBlock) {
        const tab = browser.tabs[browser.activeTab];
        tab.status = 'error';
        tab.error = ssrfBlock;
        tab.content = ssrfBlock;
        return tab;
    }
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const res = await fetch(parsed.href, {
            method: 'POST',
            headers: {
                'User-Agent': browser.userAgent,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'text/html,application/xhtml+xml,*/*',
                ...(browser.cookies.size > 0 ? { 'Cookie': buildCookieHeader(browser, parsed) } : {}),
            },
            body: params.toString(),
            signal: controller.signal,
            redirect: 'follow',
        });
        clearTimeout(timeout);
        const html = await res.text();
        const tab = {
            url: res.url || parsed.href,
            title: extractTitle(html),
            content: extractReadableContent(html),
            links: extractLinks(html, res.url || parsed.href),
            forms: extractForms(html, res.url || parsed.href),
            status: res.ok ? 'loaded' : 'error',
            html,
            screenshot: [],
            scrollY: 0,
            loadedAt: Date.now(),
            error: res.ok ? undefined : `HTTP ${res.status} ${res.statusText}`,
        };
        tab.screenshot = renderPageToAscii(tab);
        browser.tabs[browser.activeTab] = tab;
        if (tab.status === 'loaded') {
            browser.history.push(tab.url);
        }
        return tab;
    }
    catch (err) {
        const tab = browser.tabs[browser.activeTab];
        tab.status = 'error';
        tab.error = err instanceof Error ? err.message : String(err);
        tab.content = `Error: ${tab.error}`;
        return tab;
    }
}
/** Search the web via DuckDuckGo HTML (no JS needed) */
export async function search(browser, query) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    return navigateTo(browser, url);
}
/** Scroll the current page */
export function scroll(browser, direction) {
    if (browser.activeTab < 0 || browser.activeTab >= browser.tabs.length)
        return null;
    const tab = browser.tabs[browser.activeTab];
    if (direction === 'down') {
        tab.scrollY = Math.min(tab.scrollY + SCROLL_LINES, Math.max(0, wordWrap(tab.content, 56).length - SCROLL_LINES));
    }
    else {
        tab.scrollY = Math.max(0, tab.scrollY - SCROLL_LINES);
    }
    tab.screenshot = renderPageToAscii(tab);
    return tab;
}
/** Go back in history */
export async function goBack(browser) {
    if (browser.history.length < 2)
        return null;
    // Remove current page from history
    browser.history.pop();
    const previousUrl = browser.history[browser.history.length - 1];
    // Navigate (will re-add to history)
    browser.history.pop(); // navigateTo will re-push
    return navigateTo(browser, previousUrl);
}
/** Open a new tab */
export function newTab(browser, url) {
    const tab = {
        url: url || 'about:blank',
        title: 'New Tab',
        content: '',
        links: [],
        forms: [],
        status: 'loaded',
        html: '',
        screenshot: [],
        scrollY: 0,
        loadedAt: Date.now(),
    };
    browser.tabs.push(tab);
    browser.activeTab = browser.tabs.length - 1;
}
/** Close a tab */
export function closeTab(browser, tabIndex) {
    if (tabIndex < 0 || tabIndex >= browser.tabs.length)
        return;
    browser.tabs.splice(tabIndex, 1);
    if (browser.tabs.length === 0) {
        browser.activeTab = -1;
    }
    else if (browser.activeTab >= browser.tabs.length) {
        browser.activeTab = browser.tabs.length - 1;
    }
    else if (tabIndex < browser.activeTab) {
        browser.activeTab--;
    }
}
/** Switch to a tab */
export function switchTab(browser, tabIndex) {
    if (tabIndex >= 0 && tabIndex < browser.tabs.length) {
        browser.activeTab = tabIndex;
    }
}
// ── Format output for CLI ──
function formatTabOutput(tab) {
    if (tab.status === 'error') {
        return `Error: ${tab.error}\nURL: ${tab.url}`;
    }
    const parts = [];
    parts.push(`# ${tab.title}`);
    parts.push(`URL: ${tab.url}`);
    parts.push('');
    // Content
    parts.push(tab.content);
    // Links summary (first 30)
    if (tab.links.length > 0) {
        parts.push('');
        parts.push('---');
        parts.push(`Links (${tab.links.length} found):`);
        const maxLinks = Math.min(tab.links.length, 30);
        for (let i = 0; i < maxLinks; i++) {
            const link = tab.links[i];
            parts.push(`  [${link.index}] ${link.text}`);
        }
        if (tab.links.length > 30) {
            parts.push(`  ... and ${tab.links.length - 30} more`);
        }
    }
    // Forms summary
    if (tab.forms.length > 0) {
        parts.push('');
        parts.push(`Forms (${tab.forms.length} found):`);
        for (const form of tab.forms) {
            parts.push(`  [Form ${form.index}] ${form.method} ${form.action}`);
            for (const field of form.fields) {
                parts.push(`    - ${field.name} (${field.type})${field.placeholder ? ` placeholder: "${field.placeholder}"` : ''}`);
            }
        }
    }
    return parts.join('\n');
}
// ── Stream Integration ──
/** Draw a browser panel on a canvas (for stream overlay) */
export function drawBrowserPanel(ctx, browser, x, y, width, height, frame) {
    const tab = browser.activeTab >= 0 ? browser.tabs[browser.activeTab] : null;
    // Background
    ctx.fillStyle = '#1a1b26';
    ctx.fillRect(x, y, width, height);
    // Border
    ctx.strokeStyle = '#3fb950';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    const lineHeight = 14;
    const padding = 8;
    let cy = y + padding;
    // Title bar with tabs
    ctx.fillStyle = '#21222c';
    ctx.fillRect(x + 1, y + 1, width - 2, 24);
    ctx.font = '11px monospace';
    let tabX = x + padding;
    for (let i = 0; i < browser.tabs.length && i < 5; i++) {
        const t = browser.tabs[i];
        const label = (t.title || 'Tab').slice(0, 15);
        const isActive = i === browser.activeTab;
        ctx.fillStyle = isActive ? '#3fb950' : '#565f89';
        ctx.fillText(label, tabX, cy + 15);
        tabX += label.length * 7 + 12;
    }
    cy += 26;
    // URL bar
    ctx.fillStyle = '#15161e';
    ctx.fillRect(x + padding, cy, width - padding * 2, 20);
    ctx.strokeStyle = '#414868';
    ctx.strokeRect(x + padding, cy, width - padding * 2, 20);
    ctx.fillStyle = '#c0caf5';
    ctx.font = '10px monospace';
    const urlText = tab
        ? tab.url.slice(0, Math.floor((width - padding * 4) / 6))
        : 'about:blank';
    ctx.fillText(urlText, x + padding + 4, cy + 14);
    cy += 26;
    if (!tab) {
        ctx.fillStyle = '#565f89';
        ctx.fillText('Navigate to a URL to begin', x + padding, cy + lineHeight);
        return;
    }
    // Loading spinner
    if (tab.status === 'loading') {
        const spinChars = ['|', '/', '-', '\\'];
        const spin = spinChars[frame % spinChars.length];
        ctx.fillStyle = '#7aa2f7';
        ctx.font = '12px monospace';
        ctx.fillText(`${spin} Loading...`, x + padding, cy + lineHeight);
        return;
    }
    // Error display
    if (tab.status === 'error') {
        ctx.fillStyle = '#f7768e';
        ctx.font = '11px monospace';
        ctx.fillText(tab.error || 'Error', x + padding, cy + lineHeight);
        return;
    }
    // Content area — render the ASCII screenshot
    ctx.fillStyle = '#a9b1d6';
    ctx.font = '10px monospace';
    const charWidth = 6;
    const maxChars = Math.floor((width - padding * 2) / charWidth);
    const maxLines = Math.floor((height - (cy - y) - padding) / lineHeight);
    const contentLines = wordWrap(tab.content, maxChars);
    const visible = contentLines.slice(tab.scrollY, tab.scrollY + maxLines);
    for (let i = 0; i < visible.length; i++) {
        const line = visible[i];
        // Color headings
        if (line.startsWith('#')) {
            ctx.fillStyle = '#bb9af7';
        }
        else if (line.startsWith('[') && line.includes(']')) {
            ctx.fillStyle = '#7aa2f7';
        }
        else if (line.startsWith('-')) {
            ctx.fillStyle = '#73daca';
        }
        else {
            ctx.fillStyle = '#a9b1d6';
        }
        ctx.fillText(line.slice(0, maxChars), x + padding, cy + lineHeight * (i + 1));
    }
    // Scroll bar
    if (contentLines.length > maxLines) {
        const barHeight = height - (cy - y) - padding * 2;
        const thumbHeight = Math.max(20, (maxLines / contentLines.length) * barHeight);
        const thumbPos = (tab.scrollY / Math.max(1, contentLines.length - maxLines)) * (barHeight - thumbHeight);
        ctx.fillStyle = '#414868';
        ctx.fillRect(x + width - 6, cy, 4, barHeight);
        ctx.fillStyle = '#7aa2f7';
        ctx.fillRect(x + width - 6, cy + thumbPos, 4, thumbHeight);
    }
}
// ── Stream Chat Commands ──
/** Parse stream chat commands for browser interaction. Returns action string or null. */
export function parseStreamBrowserCommand(message) {
    const trimmed = message.trim().toLowerCase();
    if (trimmed.startsWith('!browse ')) {
        return { command: 'browse', args: message.trim().slice(8).trim() };
    }
    if (trimmed.startsWith('!search ')) {
        return { command: 'search', args: message.trim().slice(8).trim() };
    }
    if (trimmed.startsWith('!click ')) {
        return { command: 'click', args: message.trim().slice(7).trim() };
    }
    if (trimmed === '!scroll' || trimmed === '!scroll down') {
        return { command: 'scroll', args: 'down' };
    }
    if (trimmed === '!scroll up') {
        return { command: 'scroll', args: 'up' };
    }
    if (trimmed === '!tabs') {
        return { command: 'tabs', args: '' };
    }
    return null;
}
/** Handle a stream chat browser command. Returns a response string for the chat. */
export async function handleStreamBrowserCommand(command, args) {
    const browser = getBrowser();
    switch (command) {
        case 'browse': {
            const tab = await navigateTo(browser, args);
            if (tab.status === 'error') {
                return { response: `Could not load ${args}: ${tab.error}`, mood: 'sad' };
            }
            return {
                response: `Loaded: ${tab.title} — ${tab.links.length} links found. ${tab.content.slice(0, 120)}...`,
                mood: 'thinking',
            };
        }
        case 'search': {
            const tab = await search(browser, args);
            if (tab.status === 'error') {
                return { response: `Search failed: ${tab.error}`, mood: 'sad' };
            }
            const topLinks = tab.links.slice(0, 5).map((l, i) => `[${i}] ${l.text}`).join(', ');
            return {
                response: `Searched for "${args}" — top results: ${topLinks}`,
                mood: 'thinking',
            };
        }
        case 'click': {
            const idx = parseInt(args, 10);
            if (isNaN(idx)) {
                return { response: 'Specify a link number, e.g. !click 3', mood: 'confused' };
            }
            try {
                const tab = await clickLink(browser, idx);
                if (tab.status === 'error') {
                    return { response: `Link error: ${tab.error}`, mood: 'sad' };
                }
                return {
                    response: `Navigated to: ${tab.title}`,
                    mood: 'thinking',
                };
            }
            catch (err) {
                return { response: err instanceof Error ? err.message : String(err), mood: 'confused' };
            }
        }
        case 'scroll': {
            const tab = scroll(browser, args === 'up' ? 'up' : 'down');
            if (!tab) {
                return { response: 'No page loaded to scroll', mood: 'confused' };
            }
            return { response: `Scrolled ${args}`, mood: 'idle' };
        }
        case 'tabs': {
            if (browser.tabs.length === 0) {
                return { response: 'No tabs open', mood: 'idle' };
            }
            const tabList = browser.tabs.map((t, i) => `${i === browser.activeTab ? '>' : ' '} [${i}] ${t.title || t.url}`).join('\n');
            return { response: tabList, mood: 'idle' };
        }
        default:
            return { response: 'Unknown browser command', mood: 'confused' };
    }
}
// ── Tool Registration ──
export function registerKBotBrowserTools() {
    registerTool({
        name: 'kbot_browse',
        description: "Navigate kbot's built-in browser to a URL. No Chrome or Playwright needed. Returns page content, links, and forms. SSRF-protected.",
        parameters: {
            url: { type: 'string', description: 'URL to navigate to', required: true },
        },
        tier: 'free',
        async execute(args) {
            const url = String(args.url);
            const browser = getBrowser();
            const tab = await navigateTo(browser, url);
            return formatTabOutput(tab);
        },
    });
    registerTool({
        name: 'kbot_search',
        description: "Search the web using kbot's built-in browser via DuckDuckGo. No external dependencies.",
        parameters: {
            query: { type: 'string', description: 'Search query', required: true },
        },
        tier: 'free',
        async execute(args) {
            const query = String(args.query);
            const browser = getBrowser();
            const tab = await search(browser, query);
            return formatTabOutput(tab);
        },
    });
    registerTool({
        name: 'kbot_click',
        description: 'Click a link on the current page by its index number (shown as [N] in page content).',
        parameters: {
            link_index: { type: 'string', description: 'Link index number', required: true },
        },
        tier: 'free',
        async execute(args) {
            const idx = parseInt(String(args.link_index), 10);
            if (isNaN(idx))
                return 'Error: link_index must be a number';
            const browser = getBrowser();
            try {
                const tab = await clickLink(browser, idx);
                return formatTabOutput(tab);
            }
            catch (err) {
                return `Error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    registerTool({
        name: 'kbot_scroll',
        description: 'Scroll the current page up or down in the built-in browser.',
        parameters: {
            direction: { type: 'string', description: '"up" or "down"', required: true },
        },
        tier: 'free',
        async execute(args) {
            const dir = String(args.direction).toLowerCase() === 'up' ? 'up' : 'down';
            const browser = getBrowser();
            const tab = scroll(browser, dir);
            if (!tab)
                return 'No page loaded. Navigate to a URL first.';
            return formatTabOutput(tab);
        },
    });
    registerTool({
        name: 'kbot_read',
        description: "Get the current page content in reader mode (clean text, no clutter). Uses kbot's built-in browser.",
        parameters: {},
        tier: 'free',
        async execute() {
            const browser = getBrowser();
            if (browser.activeTab < 0 || browser.activeTab >= browser.tabs.length) {
                return 'No page loaded. Navigate to a URL first.';
            }
            const tab = browser.tabs[browser.activeTab];
            return `# ${tab.title}\nURL: ${tab.url}\n\n${tab.content}`;
        },
    });
    registerTool({
        name: 'kbot_tabs',
        description: 'Manage browser tabs: list, new, close, or switch.',
        parameters: {
            action: { type: 'string', description: '"list", "new", "close", or "switch"', required: true },
            index: { type: 'string', description: 'Tab index (for close/switch)' },
            url: { type: 'string', description: 'URL (for new tab)' },
        },
        tier: 'free',
        async execute(args) {
            const action = String(args.action).toLowerCase();
            const browser = getBrowser();
            switch (action) {
                case 'list': {
                    if (browser.tabs.length === 0)
                        return 'No tabs open.';
                    return browser.tabs.map((t, i) => `${i === browser.activeTab ? '* ' : '  '}[${i}] ${t.title} — ${t.url}`).join('\n');
                }
                case 'new': {
                    const url = args.url ? String(args.url) : undefined;
                    newTab(browser, url);
                    if (url) {
                        const tab = await navigateTo(browser, url);
                        return formatTabOutput(tab);
                    }
                    return `Opened new tab [${browser.activeTab}]`;
                }
                case 'close': {
                    const idx = parseInt(String(args.index || browser.activeTab), 10);
                    if (isNaN(idx))
                        return 'Error: specify tab index';
                    if (idx < 0 || idx >= browser.tabs.length)
                        return `Error: tab ${idx} does not exist`;
                    const title = browser.tabs[idx].title;
                    closeTab(browser, idx);
                    return `Closed tab: ${title}. ${browser.tabs.length} tab(s) remaining.`;
                }
                case 'switch': {
                    const idx = parseInt(String(args.index), 10);
                    if (isNaN(idx))
                        return 'Error: specify tab index';
                    if (idx < 0 || idx >= browser.tabs.length)
                        return `Error: tab ${idx} does not exist`;
                    switchTab(browser, idx);
                    const tab = browser.tabs[idx];
                    return `Switched to tab [${idx}]: ${tab.title}\nURL: ${tab.url}`;
                }
                default:
                    return 'Unknown action. Use: list, new, close, or switch.';
            }
        },
    });
    registerTool({
        name: 'kbot_back',
        description: 'Go back to the previous page in browser history.',
        parameters: {},
        tier: 'free',
        async execute() {
            const browser = getBrowser();
            const tab = await goBack(browser);
            if (!tab)
                return 'No history to go back to.';
            return formatTabOutput(tab);
        },
    });
    registerTool({
        name: 'kbot_form',
        description: 'Fill and submit a form on the current page.',
        parameters: {
            form_index: { type: 'string', description: 'Form index number', required: true },
            values: { type: 'string', description: 'JSON object of field name → value pairs, e.g. {"q": "search term"}', required: true },
        },
        tier: 'free',
        async execute(args) {
            const formIdx = parseInt(String(args.form_index), 10);
            if (isNaN(formIdx))
                return 'Error: form_index must be a number';
            let values;
            try {
                values = JSON.parse(String(args.values));
            }
            catch {
                return 'Error: values must be valid JSON, e.g. {"q": "search term"}';
            }
            const browser = getBrowser();
            try {
                const tab = await fillForm(browser, formIdx, values);
                return formatTabOutput(tab);
            }
            catch (err) {
                return `Error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
}
//# sourceMappingURL=kbot-browser.js.map