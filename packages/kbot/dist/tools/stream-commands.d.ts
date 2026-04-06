export type ViewerLevel = 'viewer' | 'regular' | 'vip' | 'moderator';
export interface CommandDef {
    name: string;
    description: string;
    cooldown: number;
    handler: (ctx: CommandContext) => string;
    minLevel: ViewerLevel;
}
export interface CommandContext {
    username: string;
    args: string[];
    platform: string;
    isMod: boolean;
    level: ViewerLevel;
}
export interface CommandResult {
    command: string;
    response: string;
    username: string;
    xpAwarded: number;
}
export interface CommandInfo {
    name: string;
    description: string;
    cooldown: number;
    minLevel: ViewerLevel;
}
export interface InventoryItem {
    id: string;
    name: string;
    type: 'hat' | 'badge' | 'tool' | 'pet';
    description: string;
}
export interface LeaderboardEntry {
    username: string;
    xp: number;
    rank: number;
    messageCount: number;
}
export interface ViewerStats {
    username: string;
    xp: number;
    messageCount: number;
    rank: number;
    level: ViewerLevel;
    inventory: InventoryItem[];
    equipped: {
        hat?: string;
        pet?: string;
    };
    joinedAt: string;
}
export declare class StreamCommands {
    private commands;
    private viewers;
    private globalCooldowns;
    private userCooldowns;
    private currentPoll;
    private currentGiveaway;
    private currentBoss;
    private currentChallenge;
    private worldVotes;
    private currentFrame;
    private pendingDuels;
    private pendingTrades;
    private raidActive;
    private raidTarget;
    private raidParticipants;
    constructor();
    registerCommand(cmd: CommandDef): void;
    handleMessage(username: string, message: string, platform: string, isMod?: boolean): CommandResult | null;
    getCommands(): CommandInfo[];
    getInventory(username: string): InventoryItem[];
    getLeaderboard(limit?: number): LeaderboardEntry[];
    getViewerStats(username: string): ViewerStats;
    tick(frame: number): void;
    render(ctx: CanvasRenderingContext2D, width: number, height: number): void;
    saveState(): void;
    loadState(): void;
    private ensureViewer;
    private getLevel;
    private grantItem;
    private tallyVotes;
    private pick;
    private tallyWorldVote;
    private castWorldVote;
    private registerBuiltinCommands;
}
export declare function getStreamCommands(): StreamCommands;
export declare function registerStreamCommandsTools(): void;
//# sourceMappingURL=stream-commands.d.ts.map