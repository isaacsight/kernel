// kbot Content Engine Tools — Create, publish, and schedule content across platforms.
// Generates platform-appropriate content with character limits and logs activity.
import { registerTool } from './index.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
const CONTENT_LOG_PATH = join(homedir(), '.kbot', 'content-log.json');
/** Platform character limits */
const PLATFORM_LIMITS = {
    twitter: 280,
    tiktok: 300,
    discord: 2000,
    youtube: 5000,
    email: 0, // unlimited
};
/** Supported platforms */
const SUPPORTED_PLATFORMS = ['twitter', 'tiktok', 'discord', 'youtube', 'email'];
async function readContentLog() {
    try {
        const raw = await readFile(CONTENT_LOG_PATH, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return [];
    }
}
async function writeContentLog(entries) {
    await mkdir(join(homedir(), '.kbot'), { recursive: true });
    await writeFile(CONTENT_LOG_PATH, JSON.stringify(entries, null, 2), 'utf-8');
}
function generateId() {
    return `cnt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function truncateToLimit(text, limit) {
    if (limit === 0 || text.length <= limit)
        return text;
    // Truncate at word boundary if possible
    const truncated = text.slice(0, limit - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > limit * 0.7) {
        return truncated.slice(0, lastSpace) + '...';
    }
    return truncated + '...';
}
function generatePlatformContent(topic, platform, tone) {
    const limit = PLATFORM_LIMITS[platform] ?? 2000;
    switch (platform) {
        case 'twitter': {
            const base = tone === 'professional'
                ? `${topic} — key insights and takeaways for professionals in the space.`
                : tone === 'casual'
                    ? `been thinking about ${topic} and honestly? here are my thoughts:`
                    : tone === 'technical'
                        ? `Deep dive: ${topic}. Thread on architecture, trade-offs, and implementation details.`
                        : `${topic} — here's what you need to know.`;
            return truncateToLimit(base, limit);
        }
        case 'tiktok': {
            const base = tone === 'professional'
                ? `[Hook] Did you know about ${topic}? [Body] Here are the 3 things every professional should understand. [CTA] Follow for more insights.`
                : tone === 'casual'
                    ? `[Hook] POV: You just learned about ${topic} [Body] Let me break this down in 30 seconds [CTA] Like & follow for more`
                    : tone === 'technical'
                        ? `[Hook] ${topic} explained in under a minute [Body] Step 1: Understand the core concept. Step 2: See the implementation. Step 3: Try it yourself. [CTA] Save this for later.`
                        : `[Hook] Everything about ${topic} [Body] Quick breakdown of what matters most [CTA] Follow for more content`;
            return truncateToLimit(base, limit);
        }
        case 'discord': {
            const base = tone === 'professional'
                ? `**${topic}**\n\nHey everyone — wanted to share some structured thoughts on this topic.\n\n**Key Points:**\n- Core concept and why it matters\n- Practical applications and use cases\n- Resources for deeper learning\n\nWould love to hear your perspectives. What's your experience with this?`
                : tone === 'casual'
                    ? `yo, let's talk about **${topic}** for a sec\n\nbeen diving into this lately and there's some really cool stuff going on:\n\n- first off, the basics are actually pretty straightforward\n- but the deeper you go, the more interesting it gets\n- there are some wild applications people are building\n\nwhat do y'all think? anyone else been looking into this?`
                    : tone === 'technical'
                        ? `**${topic}** — Technical Discussion\n\n\`\`\`\nOverview: ${topic}\nComplexity: Intermediate\nRelevance: High\n\`\`\`\n\n**Architecture:**\nThe core design involves several interconnected systems that work together.\n\n**Trade-offs:**\n- Performance vs. simplicity\n- Flexibility vs. maintainability\n\n**Open questions:**\nWhat approaches have worked best in production environments?`
                        : `**${topic}**\n\nSharing some thoughts on this topic:\n\n- Why it matters right now\n- Key things to understand\n- Where it's heading\n\nDiscussion welcome — drop your thoughts below.`;
            return truncateToLimit(base, limit);
        }
        case 'youtube': {
            return tone === 'professional'
                ? `Title: ${topic} — A Professional Guide\n\nDescription:\nIn this video, we break down ${topic} with a focus on practical, professional applications. Whether you're just getting started or looking to deepen your expertise, this guide covers the essential concepts and actionable strategies.\n\nTimestamps:\n0:00 Introduction\n1:00 Core concepts\n3:00 Practical applications\n5:00 Advanced strategies\n7:00 Summary & next steps\n\nTags: ${topic.toLowerCase().replace(/\s+/g, ', ')}, professional guide, tutorial`
                : tone === 'casual'
                    ? `Title: Let's Talk About ${topic}\n\nDescription:\nHey! In today's video, I'm sharing everything I've learned about ${topic}. It's been a journey and I think you'll find some useful nuggets in here.\n\nTimestamps:\n0:00 What's up\n0:30 The story\n2:00 What I learned\n4:00 My take\n5:00 Your turn\n\nTags: ${topic.toLowerCase().replace(/\s+/g, ', ')}, discussion, vlog`
                    : tone === 'technical'
                        ? `Title: ${topic} — Deep Technical Dive\n\nDescription:\nA comprehensive technical exploration of ${topic}. We cover architecture, implementation patterns, performance considerations, and real-world trade-offs.\n\nTimestamps:\n0:00 Overview\n1:00 Architecture\n3:00 Implementation\n6:00 Performance analysis\n8:00 Trade-offs & conclusions\n\nTags: ${topic.toLowerCase().replace(/\s+/g, ', ')}, technical, deep dive, engineering`
                        : `Title: ${topic} Explained\n\nDescription:\nEverything you need to know about ${topic}, explained clearly and concisely.\n\nTimestamps:\n0:00 Intro\n1:00 Key concepts\n3:00 Examples\n5:00 Wrap-up\n\nTags: ${topic.toLowerCase().replace(/\s+/g, ', ')}, explainer`;
        }
        case 'email': {
            return tone === 'professional'
                ? `Subject: ${topic} — Key Insights\n\nHello,\n\nI wanted to share some important developments regarding ${topic}.\n\n**What's Happening:**\nRecent shifts in the landscape have made this topic particularly relevant. Understanding the core dynamics is essential for anyone in the space.\n\n**Key Takeaways:**\n1. The fundamental concepts remain critical\n2. New applications are emerging rapidly\n3. Early adoption creates significant advantages\n\n**Next Steps:**\nI'd recommend exploring the resources linked below and considering how these developments apply to your context.\n\nBest regards`
                : tone === 'casual'
                    ? `Subject: Thoughts on ${topic}\n\nHey!\n\nBeen meaning to share this — I've been exploring ${topic} lately and some really interesting things have come up.\n\nThe short version: there's a lot more to this than meets the eye. I've found some great resources and wanted to pass them along.\n\nMain highlights:\n- It's more accessible than you'd think\n- The community around it is growing fast\n- There are some practical applications you can start using today\n\nLet me know what you think!\n\nCheers`
                    : tone === 'technical'
                        ? `Subject: Technical Analysis — ${topic}\n\nSummary:\nThis email provides a technical analysis of ${topic}, covering architecture, implementation approaches, and performance characteristics.\n\n## Architecture Overview\nThe system is built around several core components that interact through well-defined interfaces.\n\n## Implementation Notes\n- Primary language considerations and trade-offs\n- Dependency management approach\n- Testing strategy\n\n## Performance Characteristics\n- Latency: depends on workload profile\n- Throughput: scales with proper configuration\n- Resource usage: moderate, with optimization opportunities\n\n## Recommendations\n1. Start with the reference implementation\n2. Benchmark against your specific workload\n3. Iterate based on profiling data\n\nReferences available upon request.`
                        : `Subject: ${topic}\n\nHi there,\n\nQuick note about ${topic}.\n\nHere's what I think is important:\n- The core idea and why it matters\n- Practical ways to apply it\n- Where to learn more\n\nHappy to discuss further.\n\nBest`;
        }
        default:
            return `Content for ${platform} about ${topic} (tone: ${tone})`;
    }
}
export function registerContentEngineTools() {
    registerTool({
        name: 'content_create',
        description: 'Generate platform-appropriate content for multiple platforms at once. ' +
            'Respects character limits (Twitter 280, TikTok 300, Discord 2000). ' +
            'Returns formatted content for each platform ready to publish.',
        parameters: {
            topic: {
                type: 'string',
                description: 'The topic or subject to create content about',
                required: true,
            },
            platforms: {
                type: 'string',
                description: 'Comma-separated platforms: youtube, tiktok, discord, email, twitter',
                required: true,
            },
            tone: {
                type: 'string',
                description: 'Content tone: "professional", "casual", "technical", or "neutral" (default)',
            },
        },
        tier: 'free',
        async execute(args) {
            const topic = String(args.topic);
            const platformsRaw = String(args.platforms);
            const tone = String(args.tone || 'neutral');
            const platforms = platformsRaw
                .split(',')
                .map((p) => p.trim().toLowerCase())
                .filter((p) => SUPPORTED_PLATFORMS.includes(p));
            if (platforms.length === 0) {
                return `No valid platforms specified. Supported: ${SUPPORTED_PLATFORMS.join(', ')}`;
            }
            const content = {};
            const parts = [
                `# Content: ${topic}`,
                `**Tone:** ${tone}`,
                `**Platforms:** ${platforms.join(', ')}`,
                '',
            ];
            for (const platform of platforms) {
                const generated = generatePlatformContent(topic, platform, tone);
                content[platform] = generated;
                const limit = PLATFORM_LIMITS[platform] ?? 0;
                const charInfo = limit > 0 ? ` (${generated.length}/${limit} chars)` : '';
                parts.push(`---`);
                parts.push(`## ${platform.toUpperCase()}${charInfo}`);
                parts.push('');
                parts.push(generated);
                parts.push('');
            }
            // Auto-save as draft
            const entry = {
                id: generateId(),
                topic,
                platforms,
                tone,
                content,
                status: 'draft',
                createdAt: new Date().toISOString(),
            };
            try {
                const log = await readContentLog();
                log.push(entry);
                await writeContentLog(log);
                parts.push(`---`);
                parts.push(`Saved as draft: **${entry.id}**`);
                parts.push(`View with \`content_calendar\` tool.`);
            }
            catch (err) {
                parts.push(`(Could not save to log: ${err instanceof Error ? err.message : String(err)})`);
            }
            return parts.join('\n');
        },
    });
    registerTool({
        name: 'content_publish',
        description: 'Publish or schedule content to platforms. Currently returns posting instructions ' +
            'for each platform (future: direct API posting). Logs publication to ~/.kbot/content-log.json.',
        parameters: {
            content: {
                type: 'string',
                description: 'The content to publish (or a content_create draft ID to use)',
                required: true,
            },
            platforms: {
                type: 'string',
                description: 'Comma-separated platforms to publish to: youtube, tiktok, discord, email, twitter',
                required: true,
            },
            schedule: {
                type: 'string',
                description: 'Optional ISO date/time to schedule publication (e.g. "2026-04-01T09:00:00Z"). Omit to publish now.',
            },
        },
        tier: 'free',
        async execute(args) {
            const contentArg = String(args.content);
            const platformsRaw = String(args.platforms);
            const schedule = args.schedule ? String(args.schedule) : undefined;
            const platforms = platformsRaw
                .split(',')
                .map((p) => p.trim().toLowerCase())
                .filter((p) => SUPPORTED_PLATFORMS.includes(p));
            if (platforms.length === 0) {
                return `No valid platforms specified. Supported: ${SUPPORTED_PLATFORMS.join(', ')}`;
            }
            // Check if contentArg is a draft ID
            let resolvedContent = {};
            let topic = 'Custom content';
            const log = await readContentLog();
            const existingEntry = log.find((e) => e.id === contentArg);
            if (existingEntry) {
                resolvedContent = existingEntry.content;
                topic = existingEntry.topic;
                // Update the existing entry status
                existingEntry.status = schedule ? 'scheduled' : 'published';
                if (schedule)
                    existingEntry.schedule = schedule;
                if (!schedule)
                    existingEntry.publishedAt = new Date().toISOString();
            }
            else {
                // Raw content — use it for all platforms
                for (const p of platforms) {
                    const limit = PLATFORM_LIMITS[p] ?? 0;
                    resolvedContent[p] = limit > 0 ? truncateToLimit(contentArg, limit) : contentArg;
                }
            }
            const parts = [];
            if (schedule) {
                parts.push(`# Scheduled Publication`);
                parts.push(`**Schedule:** ${schedule}`);
            }
            else {
                parts.push(`# Publishing Content`);
            }
            parts.push(`**Topic:** ${topic}`);
            parts.push('');
            const publishInstructions = {
                twitter: '1. Go to twitter.com/compose/tweet (or use Twitter API)\n' +
                    '2. Paste the content below\n' +
                    '3. Add any media attachments\n' +
                    '4. Click "Post"',
                tiktok: '1. Open TikTok app or studio.tiktok.com\n' +
                    '2. Create a new video with the script below\n' +
                    '3. Use the caption text provided\n' +
                    '4. Add relevant hashtags and post',
                discord: '1. Open the target Discord channel\n' +
                    '2. Paste the formatted message below\n' +
                    '3. Preview markdown rendering\n' +
                    '4. Send',
                youtube: '1. Go to studio.youtube.com\n' +
                    '2. Upload your video\n' +
                    '3. Use the title, description, and tags below\n' +
                    '4. Set visibility and publish',
                email: '1. Open your email client or API dashboard\n' +
                    '2. Compose a new email with the subject and body below\n' +
                    '3. Set the recipient list\n' +
                    '4. Send or schedule',
            };
            for (const platform of platforms) {
                const content = resolvedContent[platform] || resolvedContent[platforms[0]] || contentArg;
                parts.push(`---`);
                parts.push(`## ${platform.toUpperCase()}`);
                parts.push('');
                parts.push(`**How to post:**`);
                parts.push(publishInstructions[platform] || `Post the content to ${platform}.`);
                parts.push('');
                parts.push(`**Content:**`);
                parts.push(content);
                parts.push('');
            }
            // Log the publication
            if (!existingEntry) {
                const entry = {
                    id: generateId(),
                    topic,
                    platforms,
                    tone: 'custom',
                    content: resolvedContent,
                    status: schedule ? 'scheduled' : 'published',
                    schedule,
                    createdAt: new Date().toISOString(),
                    publishedAt: schedule ? undefined : new Date().toISOString(),
                };
                log.push(entry);
            }
            try {
                await writeContentLog(log);
                parts.push(`---`);
                parts.push(`Logged to ~/.kbot/content-log.json`);
            }
            catch (err) {
                parts.push(`(Could not write log: ${err instanceof Error ? err.message : String(err)})`);
            }
            return parts.join('\n');
        },
    });
    registerTool({
        name: 'content_calendar',
        description: 'List all scheduled, draft, and published content from ~/.kbot/content-log.json. ' +
            'Shows a calendar view of content activity.',
        parameters: {
            status: {
                type: 'string',
                description: 'Filter by status: "draft", "scheduled", "published", or "all" (default)',
            },
        },
        tier: 'free',
        async execute(args) {
            const statusFilter = String(args.status || 'all');
            let log;
            try {
                log = await readContentLog();
            }
            catch {
                return 'No content log found. Use `content_create` to generate your first content.';
            }
            if (log.length === 0) {
                return 'Content calendar is empty. Use `content_create` to get started.';
            }
            const filtered = statusFilter === 'all' ? log : log.filter((e) => e.status === statusFilter);
            if (filtered.length === 0) {
                return `No content with status "${statusFilter}". Try status "all" to see everything.`;
            }
            // Sort: scheduled first (by schedule date), then drafts, then published (newest first)
            const sorted = [...filtered].sort((a, b) => {
                const statusOrder = { scheduled: 0, draft: 1, published: 2 };
                const orderA = statusOrder[a.status] ?? 3;
                const orderB = statusOrder[b.status] ?? 3;
                if (orderA !== orderB)
                    return orderA - orderB;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
            const statusIcon = {
                draft: '[DRAFT]',
                scheduled: '[SCHEDULED]',
                published: '[PUBLISHED]',
            };
            const parts = [
                `# Content Calendar`,
                `**Total entries:** ${log.length} | **Showing:** ${filtered.length} (${statusFilter})`,
                '',
            ];
            for (const entry of sorted) {
                const icon = statusIcon[entry.status] || `[${entry.status.toUpperCase()}]`;
                const date = entry.schedule
                    ? `Scheduled: ${entry.schedule}`
                    : entry.publishedAt
                        ? `Published: ${entry.publishedAt.split('T')[0]}`
                        : `Created: ${entry.createdAt.split('T')[0]}`;
                parts.push(`---`);
                parts.push(`**${icon}** ${entry.topic}`);
                parts.push(`ID: \`${entry.id}\` | Platforms: ${entry.platforms.join(', ')} | Tone: ${entry.tone}`);
                parts.push(`${date}`);
            }
            return parts.join('\n');
        },
    });
}
//# sourceMappingURL=content-engine.js.map