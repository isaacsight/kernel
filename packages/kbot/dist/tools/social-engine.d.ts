export interface SocialEngine {
    platforms: PlatformState[];
    viewers: ViewerProfile[];
    followers: FollowerEvent[];
    moderationLog: ModerationAction[];
    announcements: string[];
    lastFollowerCheck: number;
    lastViewerCheck: number;
    totalViewMinutes: number;
    /** Peak concurrent viewers this session */
    peakConcurrent: number;
    /** Known follower usernames (for diff detection) */
    knownFollowers: string[];
}
interface PlatformState {
    name: 'twitch' | 'kick' | 'rumble';
    connected: boolean;
    viewerCount: number;
    followerCount: number;
    chatRate: number;
    lastPing: number;
}
export interface ViewerProfile {
    username: string;
    platform: string;
    firstSeen: number;
    lastSeen: number;
    messageCount: number;
    commandsUsed: number;
    xp: number;
    isFollower: boolean;
    isModerator: boolean;
    tags: string[];
}
export interface FollowerEvent {
    username: string;
    platform: string;
    timestamp: number;
    announced: boolean;
}
export interface ModerationAction {
    type: 'ban' | 'timeout' | 'filter';
    username: string;
    reason: string;
    timestamp: number;
    automated: boolean;
}
export interface PlatformHealthReport {
    twitch: {
        connected: boolean;
        viewers: number;
        chatRate: number;
    };
    kick: {
        connected: boolean;
        viewers: number;
    };
    rumble: {
        connected: boolean;
        viewers: number;
    };
    totalViewers: number;
    totalFollowers: number;
    streamHealth: 'good' | 'degraded' | 'offline';
}
export interface StreamStats {
    uniqueViewers: number;
    totalMessages: number;
    peakConcurrent: number;
    averageChatRate: number;
    topChatters: Array<{
        username: string;
        messages: number;
    }>;
    newFollowers: number;
    platformBreakdown: Record<string, number>;
}
export interface SocialAction {
    type: 'celebrate_follower' | 'health_warning' | 'milestone';
    speech: string;
    mood?: string;
    effect?: string;
}
export declare function createSocialEngine(): SocialEngine;
export declare function loadSocialEngine(): SocialEngine;
export declare function saveSocialEngine(engine: SocialEngine): void;
export declare function trackViewer(engine: SocialEngine, username: string, platform: string, message: string): ViewerProfile;
export declare function checkNewFollowers(engine: SocialEngine): Promise<FollowerEvent[]>;
export declare function celebrateFollower(follower: FollowerEvent, totalFollowers?: number): {
    speech: string;
    mood: string;
    effect: string;
};
export declare function autoModerate(engine: SocialEngine, username: string, message: string): ModerationAction | null;
export declare function checkPlatformHealth(engine: SocialEngine): PlatformHealthReport;
export declare function getStreamStats(engine: SocialEngine): StreamStats;
export declare function tickSocial(engine: SocialEngine, frame: number): SocialAction | null;
export declare function registerSocialEngineTools(): void;
export {};
//# sourceMappingURL=social-engine.d.ts.map