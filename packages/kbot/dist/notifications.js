// kbot Notification System — Proactive alerts from the daemon
//
// Channels:
//   - system: macOS Notification Center (osascript) / Linux (notify-send)
//   - terminal: bell character to active terminal
//   - discord: webhook to configured channel
//   - log: always writes to daemon log
//
// The daemon triggers notifications when:
//   - Price alerts fire
//   - Security incidents detected (memory tampering, injection attempts)
//   - Provider outages
//   - Dependency vulnerabilities discovered
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';
/** Send a notification through the specified channel */
export async function notify(opts) {
    const channel = opts.channel || 'system';
    try {
        switch (channel) {
            case 'system':
                return sendSystemNotification(opts);
            case 'terminal':
                // Bell character — works in any terminal
                process.stdout.write('\x07');
                return true;
            case 'discord':
                return await sendDiscordNotification(opts);
            case 'log':
                // Log-only — handled by caller
                return true;
            default:
                return false;
        }
    }
    catch {
        return false;
    }
}
/** macOS Notification Center or Linux notify-send */
function sendSystemNotification(opts) {
    const os = platform();
    if (os === 'darwin') {
        // macOS — use osascript for Notification Center
        const title = opts.title.replace(/"/g, '\\"');
        const body = opts.body.replace(/"/g, '\\"');
        const sound = opts.urgency === 'critical' ? ' sound name "Funk"' : opts.sound ? ' sound name "default"' : '';
        try {
            execSync(`osascript -e 'display notification "${body}" with title "${title}"${sound}'`, { timeout: 5000 });
            return true;
        }
        catch {
            return false;
        }
    }
    if (os === 'linux') {
        // Linux — use notify-send
        const urgency = opts.urgency || 'normal';
        try {
            execSync(`notify-send -u ${urgency} "${opts.title}" "${opts.body}"`, { timeout: 5000 });
            return true;
        }
        catch {
            return false;
        }
    }
    // Windows — use PowerShell toast
    if (os === 'win32') {
        try {
            const ps = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $textNodes = $template.GetElementsByTagName('text')
        $textNodes.Item(0).AppendChild($template.CreateTextNode('${opts.title}')) | Out-Null
        $textNodes.Item(1).AppendChild($template.CreateTextNode('${opts.body}')) | Out-Null
        $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('kbot').Show($toast)
      `;
            execSync(`powershell -command "${ps.replace(/\n/g, ';')}"`, { timeout: 5000 });
            return true;
        }
        catch {
            return false;
        }
    }
    return false;
}
/** Send notification to Discord webhook */
async function sendDiscordNotification(opts) {
    // Check for configured webhook
    const configPath = join(homedir(), '.kbot', 'config.json');
    let webhookUrl = process.env.DISCORD_WEBHOOK_URL || '';
    if (!webhookUrl && existsSync(configPath)) {
        try {
            const config = JSON.parse(readFileSync(configPath, 'utf-8'));
            webhookUrl = config.discord_webhook || '';
        }
        catch { /* no config */ }
    }
    if (!webhookUrl)
        return false;
    const color = opts.urgency === 'critical' ? 0xFF0000 : opts.urgency === 'low' ? 0x888888 : 0x6B5B95;
    try {
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                        title: opts.title,
                        description: opts.body,
                        color,
                        timestamp: new Date().toISOString(),
                        footer: { text: 'kbot daemon' },
                    }],
            }),
            signal: AbortSignal.timeout(5000),
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
/** Send notification on all available channels */
export async function notifyAll(opts) {
    await Promise.allSettled([
        notify({ ...opts, channel: 'system' }),
        notify({ ...opts, channel: 'discord' }),
    ]);
}
//# sourceMappingURL=notifications.js.map