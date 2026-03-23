import * as net from 'node:net';
export type TeamMessage = {
    type: 'join';
    role: string;
    instanceId: string;
} | {
    type: 'leave';
    instanceId: string;
} | {
    type: 'context';
    key: string;
    value: string;
    from: string;
} | {
    type: 'task';
    task: string;
    assignTo: string;
    from: string;
    taskId: string;
} | {
    type: 'result';
    taskId: string;
    result: string;
    from: string;
} | {
    type: 'broadcast';
    message: string;
    from: string;
} | {
    type: 'status';
    instances: Array<{
        id: string;
        role: string;
        status: string;
    }>;
};
export interface TeamServerOptions {
    port?: number;
}
export interface TeamJoinOptions {
    port?: number;
    role: string;
    instanceId?: string;
}
type TaskHandler = (task: string, taskId: string, from: string) => void;
type ContextHandler = (key: string, value: string, from: string) => void;
type BroadcastHandler = (message: string, from: string) => void;
type StatusHandler = (instances: Array<{
    id: string;
    role: string;
    status: string;
}>) => void;
/**
 * Start the team coordination server.
 * Maintains connected instances, shared context, and task routing.
 */
export declare function startTeamServer(options?: TeamServerOptions): Promise<net.Server>;
/** Stop the team server and disconnect all clients */
export declare function stopTeamServer(): Promise<void>;
/**
 * Join an existing team as a specific role.
 * Returns methods to interact with the team.
 */
export declare function joinTeam(options: TeamJoinOptions): Promise<TeamClient>;
export declare class TeamClient {
    private socket;
    readonly instanceId: string;
    readonly role: string;
    private port;
    constructor(socket: net.Socket, instanceId: string, role: string, port: number);
    /** Share a context value with the entire team */
    shareContext(key: string, value: string): void;
    /** Request a task be assigned to a specific role */
    requestTask(role: string, task: string): string;
    /** Submit a result for a completed task */
    submitResult(taskId: string, result: string): void;
    /** Broadcast a message to all team members */
    broadcastMessage(message: string): void;
    /** Get locally cached shared context */
    getContext(key: string): string | undefined;
    /** Get all shared context entries */
    getAllContext(): Map<string, string>;
    /** Register handler for incoming tasks */
    onTask(handler: TaskHandler): void;
    /** Register handler for incoming context updates */
    onContext(handler: ContextHandler): void;
    /** Register handler for broadcast messages */
    onBroadcast(handler: BroadcastHandler): void;
    /** Register handler for status updates */
    onStatus(handler: StatusHandler): void;
    /** Leave the team gracefully */
    leave(): void;
    /** Check if connected */
    get connected(): boolean;
    private send;
}
export declare function getActiveClient(): TeamClient | null;
export declare function setActiveClient(client: TeamClient | null): void;
export declare function registerTeamTools(): void;
/**
 * Register the `kbot team` subcommand with a Commander program.
 * Called from cli.ts.
 */
export declare function registerTeamCommand(program: import('commander').Command): void;
export {};
//# sourceMappingURL=team.d.ts.map