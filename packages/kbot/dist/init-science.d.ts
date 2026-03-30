export interface ScienceTemplate {
    /** Unique identifier */
    id: string;
    /** Human-readable name */
    name: string;
    /** Short description of the domain */
    description: string;
    /** File patterns that indicate this template (globs) */
    detectors: string[];
    /** Python/R packages that indicate this template */
    packages: string[];
    /** kbot tools to pre-configure */
    tools: string[];
    /** Recommended specialist agent */
    agent: string;
    /** Auto-configure notebook integration */
    notebookSetup?: boolean;
    /** Common data formats to handle */
    dataFormats?: string[];
}
export declare const SCIENCE_TEMPLATES: ScienceTemplate[];
/**
 * Detect if the project is a scientific project and return the best-matching template.
 *
 * Returns `null` if no science template scores above the threshold.
 * Requires at least 2 package matches OR 1 file pattern match to activate.
 */
export declare function detectScienceProject(projectDir: string): ScienceTemplate | null;
/**
 * Apply a science template to a project directory.
 *
 * Creates a `.kbot/science.json` config with the template settings,
 * pre-configures notebook integration if needed, and writes a
 * `.kbot/tools.json` with the recommended tool list.
 */
export declare function applyScienceTemplate(template: ScienceTemplate, projectDir: string): void;
/** List all available science templates */
export declare function listScienceTemplates(): ScienceTemplate[];
/**
 * Format a science template detection result for the init report.
 */
export declare function formatScienceReport(template: ScienceTemplate): string;
//# sourceMappingURL=init-science.d.ts.map