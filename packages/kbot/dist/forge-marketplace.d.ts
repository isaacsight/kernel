export interface MarketplaceTool {
    /** Tool name (snake_case) */
    name: string;
    /** Human-readable description */
    description: string;
    /** Author username or anonymous */
    author: string;
    /** Total download/install count */
    downloads: number;
    /** Average rating (1-5), 0 if unrated */
    rating: number;
    /** Categorization tags */
    tags: string[];
}
interface LocalRating {
    name: string;
    rating: number;
    ratedAt: string;
}
/** Fetch tools from the marketplace, sorted by downloads.
 *  Falls back to empty array if the marketplace is unreachable. */
export declare function listMarketplaceTools(): Promise<MarketplaceTool[]>;
/** Rate a forged tool (1-5 stars).
 *  Stores locally at ~/.kbot/forge/forge-ratings.json and syncs to marketplace.
 *  Returns true if the rating was accepted by the server (or stored locally on network failure). */
export declare function rateForgedTool(name: string, rating: number): Promise<boolean>;
/** Get the top 10 trending forged tools this week.
 *  Falls back to empty array if marketplace is unreachable. */
export declare function trendingTools(): Promise<MarketplaceTool[]>;
/** Recommend forged tools based on detected project type.
 *  Returns tools that other users of similar projects found useful. */
export declare function recommendTools(projectType: string): Promise<MarketplaceTool[]>;
/** Format a marketplace tool list for terminal display */
export declare function formatToolList(tools: MarketplaceTool[], title: string): string;
/** Get local ratings for display */
export declare function getLocalRatings(): LocalRating[];
/** Get supported project types for recommendation */
export declare function getSupportedProjectTypes(): string[];
export {};
//# sourceMappingURL=forge-marketplace.d.ts.map