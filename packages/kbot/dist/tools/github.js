// kbot GitHub Tools — Access all public GitHub knowledge
// Search repos, read code, browse issues, pull documentation.
// No auth required for public repos.
import { registerTool } from './index.js';
const GITHUB_API = 'https://api.github.com';
const HEADERS = {
    'User-Agent': 'KBot/1.3 (GitHub Tools)',
    'Accept': 'application/vnd.github.v3+json',
};
export function registerGitHubTools() {
    registerTool({
        name: 'github_search',
        description: 'Search GitHub for repositories, code, or issues. Use to find libraries, examples, solutions, and documentation from millions of open-source projects.',
        parameters: {
            query: { type: 'string', description: 'Search query (e.g., "react auth library", "python pdf generator")', required: true },
            type: { type: 'string', description: 'Search type: "repos" (default), "code", "issues"' },
            language: { type: 'string', description: 'Filter by language (e.g., "typescript", "python", "rust")' },
            sort: { type: 'string', description: 'Sort by: "stars", "updated", "forks", "best-match" (default)' },
        },
        tier: 'free',
        async execute(args) {
            const query = String(args.query);
            const type = String(args.type || 'repos');
            const language = args.language ? String(args.language) : '';
            const sort = args.sort ? String(args.sort) : 'best-match';
            const searchType = type === 'code' ? 'code' : type === 'issues' ? 'issues' : 'repositories';
            const langFilter = language ? `+language:${language}` : '';
            const encoded = encodeURIComponent(query + langFilter);
            const sortParam = sort !== 'best-match' ? `&sort=${sort}` : '';
            try {
                const res = await fetch(`${GITHUB_API}/search/${searchType}?q=${encoded}${sortParam}&per_page=10`, { headers: HEADERS });
                if (!res.ok) {
                    if (res.status === 403)
                        return 'GitHub API rate limit reached. Try again in a minute or use web_search as fallback.';
                    return `GitHub API error: ${res.status}`;
                }
                const data = await res.json();
                const items = data.items || [];
                if (items.length === 0)
                    return `No results found for "${query}" on GitHub.`;
                if (searchType === 'repositories') {
                    return items.map((r) => `**${r.full_name}** ★${r.stargazers_count} | ${r.language || 'multi'}\n` +
                        `  ${r.description || '(no description)'}\n` +
                        `  ${r.html_url}`).join('\n\n');
                }
                if (searchType === 'code') {
                    return items.map((c) => `**${c.repository.full_name}** → \`${c.path}\`\n` +
                        `  ${c.html_url}`).join('\n\n');
                }
                // Issues
                return items.map((i) => `**${i.repository_url.split('/').slice(-2).join('/')}** #${i.number} [${i.state}]\n` +
                    `  ${i.title}\n` +
                    `  ${i.html_url}`).join('\n\n');
            }
            catch (err) {
                return `GitHub search error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    registerTool({
        name: 'github_read_file',
        description: 'Read a file from any public GitHub repository. Use to read source code, documentation, configs, README files, etc.',
        parameters: {
            repo: { type: 'string', description: 'Repository in "owner/repo" format (e.g., "facebook/react")', required: true },
            path: { type: 'string', description: 'File path in the repo (e.g., "README.md", "src/index.ts", "package.json")', required: true },
            branch: { type: 'string', description: 'Branch name (default: "main")' },
        },
        tier: 'free',
        async execute(args) {
            const repo = String(args.repo);
            const path = String(args.path);
            const branch = String(args.branch || 'main');
            // Try raw content first (no rate limit)
            const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
            try {
                const res = await fetch(rawUrl, { headers: { 'User-Agent': 'KBot/1.3' } });
                if (res.ok) {
                    const text = await res.text();
                    if (text.length > 30000) {
                        return text.slice(0, 30000) + `\n\n... (truncated, ${text.length} total chars)`;
                    }
                    return text;
                }
                // Try 'master' branch as fallback
                if (branch === 'main') {
                    const res2 = await fetch(`https://raw.githubusercontent.com/${repo}/master/${path}`, { headers: { 'User-Agent': 'KBot/1.3' } });
                    if (res2.ok) {
                        const text = await res2.text();
                        if (text.length > 30000) {
                            return text.slice(0, 30000) + `\n\n... (truncated, ${text.length} total chars)`;
                        }
                        return text;
                    }
                }
                return `File not found: ${repo}/${path} (branch: ${branch}). Check the repo name and path.`;
            }
            catch (err) {
                return `Error reading file: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    registerTool({
        name: 'github_repo_info',
        description: 'Get detailed information about a GitHub repository including README, structure, and metadata. Use to understand any open-source project quickly.',
        parameters: {
            repo: { type: 'string', description: 'Repository in "owner/repo" format (e.g., "vercel/next.js")', required: true },
        },
        tier: 'free',
        async execute(args) {
            const repo = String(args.repo);
            const parts = [];
            // Repo metadata
            try {
                const res = await fetch(`${GITHUB_API}/repos/${repo}`, { headers: HEADERS });
                if (!res.ok)
                    return `Repository not found: ${repo}`;
                const data = await res.json();
                parts.push(`# ${data.full_name}`, `**${data.description || 'No description'}**`, '', `Stars: ${data.stargazers_count} | Forks: ${data.forks_count} | Issues: ${data.open_issues_count}`, `Language: ${data.language || 'Unknown'} | License: ${data.license?.spdx_id || 'None'}`, `Created: ${data.created_at?.split('T')[0]} | Updated: ${data.updated_at?.split('T')[0]}`, `URL: ${data.html_url}`, `Topics: ${(data.topics || []).join(', ') || 'none'}`);
            }
            catch {
                parts.push(`Could not fetch repo metadata for ${repo}`);
            }
            // README
            try {
                const res = await fetch(`${GITHUB_API}/repos/${repo}/readme`, { headers: HEADERS });
                if (res.ok) {
                    const data = await res.json();
                    const content = Buffer.from(data.content, 'base64').toString('utf-8');
                    const truncated = content.length > 5000 ? content.slice(0, 5000) + '\n\n... (README truncated)' : content;
                    parts.push('', '---', '## README', '', truncated);
                }
            }
            catch { /* no readme */ }
            // Top-level directory listing
            try {
                const res = await fetch(`${GITHUB_API}/repos/${repo}/contents/`, { headers: HEADERS });
                if (res.ok) {
                    const items = await res.json();
                    if (Array.isArray(items)) {
                        const listing = items.map((i) => `${i.type === 'dir' ? '📁' : '📄'} ${i.name}${i.size ? ` (${(i.size / 1024).toFixed(1)}KB)` : ''}`).join('\n');
                        parts.push('', '---', '## Files', '', listing);
                    }
                }
            }
            catch { /* no listing */ }
            return parts.join('\n');
        },
    });
    registerTool({
        name: 'github_issues',
        description: 'List recent issues or pull requests from a GitHub repository. Use to find bugs, discussions, and solutions.',
        parameters: {
            repo: { type: 'string', description: 'Repository in "owner/repo" format', required: true },
            type: { type: 'string', description: '"issues" (default) or "pulls"' },
            state: { type: 'string', description: '"open" (default), "closed", or "all"' },
            query: { type: 'string', description: 'Search within issues (optional)' },
        },
        tier: 'free',
        async execute(args) {
            const repo = String(args.repo);
            const type = String(args.type || 'issues');
            const state = String(args.state || 'open');
            if (args.query) {
                // Search issues in specific repo
                const q = encodeURIComponent(`${args.query} repo:${repo} is:${type === 'pulls' ? 'pr' : 'issue'} is:${state}`);
                try {
                    const res = await fetch(`${GITHUB_API}/search/issues?q=${q}&per_page=10`, { headers: HEADERS });
                    if (!res.ok)
                        return `GitHub API error: ${res.status}`;
                    const data = await res.json();
                    if (!data.items?.length)
                        return `No matching ${type} found.`;
                    return data.items.map((i) => `#${i.number} [${i.state}] ${i.title}\n  ${i.html_url}\n  ${i.body?.slice(0, 200) || '(no body)'}...`).join('\n\n');
                }
                catch (err) {
                    return `Search error: ${err instanceof Error ? err.message : String(err)}`;
                }
            }
            // List recent issues/PRs
            const endpoint = type === 'pulls' ? 'pulls' : 'issues';
            try {
                const res = await fetch(`${GITHUB_API}/repos/${repo}/${endpoint}?state=${state}&per_page=15&sort=updated`, { headers: HEADERS });
                if (!res.ok)
                    return `GitHub API error: ${res.status}`;
                const items = await res.json();
                if (!Array.isArray(items) || items.length === 0)
                    return `No ${state} ${type} found.`;
                return items.map((i) => `#${i.number} [${i.state}] ${i.title}\n  by ${i.user?.login} · ${i.comments} comments · ${i.updated_at?.split('T')[0]}\n  ${i.html_url}`).join('\n\n');
            }
            catch (err) {
                return `Error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
}
//# sourceMappingURL=github.js.map