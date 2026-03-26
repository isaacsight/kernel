/** Button style options */
export type ButtonStyle = 'primary' | 'secondary' | 'success' | 'danger' | 'link';
/** A single button action definition */
export interface ButtonAction {
    label: string;
    action: string;
    style?: ButtonStyle;
}
/** A registered pending action */
export interface PendingAction {
    token: string;
    action: string;
    callback_description: string;
    created_at: string;
    expires_at: string;
    executed: boolean;
    executed_at: string | null;
}
/** Discord button component (webhook format) */
interface DiscordButton {
    type: 2;
    style: number;
    label: string;
    custom_id?: string;
    url?: string;
}
/** Discord action row */
interface DiscordActionRow {
    type: 1;
    components: DiscordButton[];
}
/** Discord embed */
export interface DiscordEmbed {
    title?: string;
    description?: string;
    color?: number;
    fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
    }>;
    footer?: {
        text: string;
    };
    timestamp?: string;
}
/** Button set result for different platforms */
export interface ButtonSet {
    discord: DiscordActionRow;
    email_html: string;
    slack_blocks: unknown[];
}
/**
 * Create a formatted button set for different platforms.
 * Registers each action and generates platform-specific markup.
 */
export declare function createButtonSet(actions: ButtonAction[]): ButtonSet;
/**
 * Send an email via Resend with clickable action buttons at the bottom.
 * Requires RESEND_API_KEY in environment.
 */
export declare function createEmailWithButtons(to: string, subject: string, body: string, buttons: ButtonAction[]): Promise<{
    sent: boolean;
    message_id: string | null;
    error: string | null;
}>;
/**
 * Send a Discord message with interactive button components.
 */
export declare function createDiscordWithButtons(webhookUrl: string, embed: DiscordEmbed, buttons: ButtonAction[]): Promise<{
    sent: boolean;
    error: string | null;
}>;
/**
 * Process a button click action.
 * Reads the action from pending-actions, marks it as executed.
 */
export declare function handleButtonAction(token: string, action: string): {
    handled: boolean;
    action: string;
    callback_description: string;
    error: string | null;
};
/**
 * Register an action with a unique token.
 * Saves to ~/.kbot/pending-actions/. Expires after 72 hours.
 */
export declare function registerAction(action: string, callback_description: string): string;
export {};
//# sourceMappingURL=interactive-buttons.d.ts.map