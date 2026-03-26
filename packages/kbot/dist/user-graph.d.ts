export interface UserProfile {
    id: string;
    interests: string[];
    goals: string[];
    projectTypes: string[];
    tools_used: string[];
    agents_used: string[];
}
export interface SimilarUser {
    userId: string;
    similarityScore: number;
    sharedInterests: string[];
    sharedGoals: string[];
    sharedProjectTypes: string[];
}
export interface CollaborationSuggestion {
    matchUserId: string;
    similarityScore: number;
    sharedInterests: string[];
    sharedProjectTypes: string[];
    suggestion: string;
    optedIn: boolean;
}
export interface NetworkInsights {
    mostCommonProjectTypes: Array<{
        type: string;
        count: number;
    }>;
    mostPopularTools: Array<{
        tool: string;
        count: number;
    }>;
    trendingInterests: Array<{
        interest: string;
        count: number;
    }>;
    totalUsers: number;
}
export interface MatchNotification {
    id: string;
    matchUserId: string;
    similarityScore: number;
    sharedInterests: string[];
    sharedProjectTypes: string[];
    suggestion: string;
    created: string;
    read: boolean;
}
export interface GraphStats {
    total_users: number;
    total_connections: number;
    top_interests: string[];
    top_project_types: string[];
    most_collaborative_tools: string[];
}
export declare class UserGraph {
    private nodes;
    private connections;
    private notifications;
    constructor();
    private load;
    private saveNodes;
    private saveConnections;
    private saveNotifications;
    /**
     * Add or update a user in the graph.
     * All data is anonymized — no emails, names, or PII.
     * Just what they work on.
     */
    addUser(profile: UserProfile): void;
    /**
     * Find users with overlapping interests/goals/project types.
     * Returns top 5 matches with similarity score (Jaccard index on interest sets).
     * Does NOT return identifiable info — just the match score and shared interests.
     */
    findSimilarUsers(userId: string): SimilarUser[];
    /**
     * Based on findSimilarUsers, generates a collaboration suggestion.
     * Human-readable description of the match without exposing identity.
     */
    suggestCollaboration(userId: string): CollaborationSuggestion | null;
    /**
     * Returns aggregate stats across the user graph.
     * No individual data exposed — only counts and rankings.
     */
    getNetworkInsights(): NetworkInsights;
    /**
     * User explicitly opts in to be contactable.
     * Contact method is encrypted at rest (AES-256-CBC).
     * Only revealed to matches who also opted in.
     */
    optInToConnect(userId: string, contactMethod: string): void;
    /**
     * Returns pending match notifications for a user who opted in.
     * Only includes matches where BOTH users have opted in.
     */
    getMatchNotifications(userId: string): MatchNotification[];
    /**
     * Returns aggregate graph statistics.
     */
    getGraphStats(): GraphStats;
    /**
     * Remove a user from the graph entirely.
     * Deletes their node, connection (contact info), and any notifications.
     */
    removeUser(userId: string): void;
    /**
     * Mark a notification as read.
     */
    markNotificationRead(notificationId: string): void;
    /**
     * Get the decrypted contact method for a mutual match.
     * Only works when BOTH users have opted in.
     * Returns null if either user hasn't opted in.
     */
    getContactForMutualMatch(requestingUserId: string, matchUserId: string): string | null;
    /**
     * Generate match notifications for opted-in users who are similar to the given user.
     * Only creates notifications when BOTH users have opted in.
     */
    private generateMatchNotifications;
}
//# sourceMappingURL=user-graph.d.ts.map