import { Persona } from './types.js';
/**
 * Researcher: read-only research tools. Cannot mutate filesystem, repo, or
 * external state. Web fetches and grep are fine; writes are not.
 */
export declare const RESEARCHER: Persona;
/**
 * Coder: read-write inside the workspace. Bash allowed but the most common
 * destructive forms are denied via deny-pattern argRules. No force pushes.
 * Rate limit on bash so a runaway loop can't burn 10k commands.
 */
export declare const CODER: Persona;
/**
 * Computer-use: explicit destructive opt-in. GUI tools that drive the user's
 * physical desktop. Rate-limited so a hung loop can't spam clicks.
 */
export declare const COMPUTER_USE: Persona;
/**
 * Default registry. Add to this when wiring more personas.
 */
export declare const PERSONA_REGISTRY: Record<string, Persona>;
//# sourceMappingURL=registry.d.ts.map