
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from 'fs';
import path from 'path';
import fm from 'front-matter';
import { fileURLToPath } from 'url';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// admin/api -> admin -> skills
const SKILLS_DIR = path.resolve(__dirname, '../skills');

// Initialize MCP Server
const server = new McpServer({
    name: "Antigravity Brain",
    version: "1.0.0"
});

/**
 * Loads skills from the filesystem and registers them as tools.
 */
function loadSkills() {
    if (!fs.existsSync(SKILLS_DIR)) {
        console.error(`Skills directory not found at ${SKILLS_DIR}`);
        return;
    }

    const items = fs.readdirSync(SKILLS_DIR);

    for (const item of items) {
        const skillPath = path.join(SKILLS_DIR, item);
        const skillFile = path.join(skillPath, 'SKILL.md');

        if (fs.existsSync(skillFile)) {
            try {
                const content = fs.readFileSync(skillFile, 'utf8');
                const parsed = fm(content);
                const metadata = parsed.attributes;
                const instructions = parsed.body;

                const toolName = metadata.name;
                const toolDesc = metadata.description;

                if (!toolName || !toolDesc) {
                    console.warn(`Skipping skill at ${skillPath}: Missing name or description`);
                    continue;
                }

                console.error(`[MCP] Registering tool: ${toolName}`);

                // Register the tool with a generic schema
                // The instructions in SKILL.md tell the LLM how to format the 'action' and 'params'
                server.tool(
                    toolName,
                    toolDesc,
                    {
                        action: z.string().describe("The specific action to perform (e.g., 'search', 'read')"),
                        params: z.any().describe("Parameters for the action")
                    },
                    async ({ action, params }) => {
                        // In a full implementation, this would call the actual Python code or an internal API.
                        // For now, since we are decoupling, we will return a simulation message or 
                        // execute simple logic if possible (like filesystem).

                        // For the 'filesystem' skill, we can actually implement it here in Node for the client!
                        if (toolName === 'filesystem') {
                            return await handleFilesystem(action, params);
                        }

                        // For 'web-scout', we can mimic the Python behavior or shell out to it.
                        // Simpler for this MVP: Return a placeholder that would be hooked up to the Python agent later.
                        return {
                            content: [{
                                type: "text",
                                text: `Executed ${toolName}/${action}\nValid params received: ${JSON.stringify(params)}\n\n(Note: This is a bridge. Full Python execution would happen here.)`
                            }]
                        };
                    }
                );

            } catch (err) {
                console.error(`Error loading skill ${item}:`, err);
            }
        }
    }
}

async function handleFilesystem(action, params) {
    try {
        if (action === 'read') {
            const filePath = params.path;
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                return { content: [{ type: "text", text: content }] };
            } else {
                return { content: [{ type: "text", text: `File not found: ${filePath}`, isError: true }] };
            }
        } else if (action === 'list') {
            const dirPath = params.path;
            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath).join('\n');
                return { content: [{ type: "text", text: files }] };
            } else {
                return { content: [{ type: "text", text: `Directory not found: ${dirPath}`, isError: true }] };
            }
        }
        return { content: [{ type: "text", text: `Unknown filesystem action: ${action}`, isError: true }] };
    } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}`, isError: true }] };
    }
}


// Start Server
loadSkills();

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Antigravity MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
