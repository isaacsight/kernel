import { getEngine } from '../AIEngine'
import { registerTool } from './registry'

export function registerMemoryTools(): void {
    registerTool({
        name: 'search_memory',
        description: 'Searches the user\\'s lasting memory and world model for past context, preferences, or established beliefs.Use this to remember things the user told you before.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The topic to search for in memory (e.g. "favorite color", "past projects")'
            }
        },
        required: ['query']
    },
        agents: ['kernel', 'curator'],
        execute: async (args: Record<string, unknown>) => {
            const query = String(args.query).toLowerCase()
            const state = getEngine().getState()

            const results: string[] = []

            // Search beliefs
            for (const belief of state.worldModel.beliefs) {
                if (belief.content.toLowerCase().includes(query)) {
                    results.push(`Belief (Confidence \${(belief.confidence * 100).toFixed(0)}%): \${belief.content}`)
                }
            }

            // Search pattern notes
            for (const note of state.lasting.patternNotes) {
                if (note.toLowerCase().includes(query)) {
                    results.push(`Note: \${note}`)
                }
            }

            if (results.length === 0) {
                return { success: true, data: 'No relevant memories found for this query.' }
            }

            return {
                success: true,
                data: results.join('\\n')
            }
        }
  })
}
