// kbot Idempotency Checker Tool — Ensures function calls are safe to repeat.

import { registerTool } from './index.js'

export function registerIdempotencyCheckerTool(): void {
  registerTool({
    name: 'is_idempotent',
    description: 'Checks if a function is idempotent — meaning it produces the same output given the same input, regardless of how many times it is called.',
    parameters: {
      functionName: { type: 'string', description: 'Name of the function to check', required: true },
      input: { type: 'string', description: 'Input to the function', required: true },
    },
    tier: 'free',
    async execute(args) {
      const functionName = String(args.functionName)
      const input = String(args.input)

      // Placeholder for actual idempotency check logic.
      // In a real implementation, this would involve analyzing the function's code
      // or executing it multiple times with the same input and comparing the results.
      // For now, we simply return a canned response.

      return `The idempotency of '${functionName}' with input '${input}' is currently unknown.  Further analysis is required.`
    },
  })
}