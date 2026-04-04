import { registerTool } from './index.js';
export function registerAgentDiscoveryTools() {
    registerTool({
        name: 'agent_discovery',
        description: 'Discover and list available AI agents from public registries like Agents.co and CherryHQ.  Helps find new agents to integrate or learn from.',
        parameters: {
            registry: {
                type: 'string',
                description: 'The registry to search (agents.co, cherryhq, or all).',
                required: false,
                default: 'all',
            },
        },
        tier: 'free',
        async execute(args) {
            const registry = String(args.registry).toLowerCase();
            let agents = [];
            if (registry === 'all' || registry === 'agents.co') {
                try {
                    const res = await fetch('https://agents.co/api/agents', {
                        headers: { 'User-Agent': 'KBot/2.0 (Agent Discovery)' },
                        signal: AbortSignal.timeout(8000),
                    });
                    if (res.ok) {
                        agents = await res.json();
                    }
                    else {
                        return `Error fetching from Agents.co: ${res.status} ${res.statusText}`;
                    }
                }
                catch (error) {
                    return `Error fetching from Agents.co: ${error}`;
                }
            }
            if (registry === 'all' || registry === 'cherryhq') {
                try {
                    const res = await fetch('https://www.cherryhq.com/api/v1/agents', {
                        headers: { 'User-Agent': 'KBot/2.0 (Agent Discovery)' },
                        signal: AbortSignal.timeout(8000),
                    });
                    if (res.ok) {
                        const data = await res.json();
                        agents = agents.concat(data.agents);
                    }
                    else {
                        return `Error fetching from CherryHQ: ${res.status} ${res.statusText}`;
                    }
                }
                catch (error) {
                    return `Error fetching from CherryHQ: ${error}`;
                }
            }
            if (agents.length === 0) {
                return "No agents found for the specified registry.";
            }
            const agentList = agents.map((agent) => {
                return `Name: ${agent.name}, Description: ${agent.description || ''}, URL: ${agent.url || ''}`;
            }).join('\n');
            return agentList;
        },
    });
}
//# sourceMappingURL=agent-discovery.js.map