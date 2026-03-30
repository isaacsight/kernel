interface MigrationResult {
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
    details: string[];
}
export declare function detectInstalledAgents(): Array<{
    id: string;
    name: string;
}>;
export declare function migrate(sourceId: string): MigrationResult;
export declare function migrateAll(): MigrationResult;
export declare function formatMigrationResult(result: MigrationResult): string;
export declare function formatDetectedAgents(): string;
export {};
//# sourceMappingURL=migrate.d.ts.map