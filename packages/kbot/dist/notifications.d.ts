export type NotificationChannel = 'system' | 'terminal' | 'discord' | 'log';
export interface NotificationOptions {
    title: string;
    body: string;
    channel?: NotificationChannel;
    urgency?: 'low' | 'normal' | 'critical';
    sound?: boolean;
}
/** Send a notification through the specified channel */
export declare function notify(opts: NotificationOptions): Promise<boolean>;
/** Send notification on all available channels */
export declare function notifyAll(opts: NotificationOptions): Promise<void>;
//# sourceMappingURL=notifications.d.ts.map