// kbot Interactive Response Buttons
//
// When kbot sends emails or Discord messages, include action buttons.
// Buttons link to response endpoints that trigger follow-up actions.
//
// Supports: Discord (webhook), Email (Resend), Slack (Block Kit, future)
//
// Pending actions stored at: ~/.kbot/pending-actions/
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, } from 'node:fs';
import { randomUUID } from 'node:crypto';
const PENDING_DIR = join(homedir(), '.kbot', 'pending-actions');
const ACTION_EXPIRY_MS = 72 * 60 * 60 * 1000; // 72 hours
const ACTION_BASE_URL = 'https://kernel.chat/api/action';
function ensureDir() {
    if (!existsSync(PENDING_DIR))
        mkdirSync(PENDING_DIR, { recursive: true });
}
function actionPath(token) {
    return join(PENDING_DIR, `${token}.json`);
}
/** Map ButtonStyle to Discord button style number */
function discordStyleNumber(style) {
    const map = {
        primary: 1,
        secondary: 2,
        success: 3,
        danger: 4,
        link: 5,
    };
    return map[style] || 2;
}
/** Map ButtonStyle to email button color */
function emailButtonColor(style) {
    const map = {
        primary: '#6B5B95',
        secondary: '#6c757d',
        success: '#28a745',
        danger: '#dc3545',
        link: '#007bff',
    };
    return map[style] || '#6B5B95';
}
/**
 * Create a formatted button set for different platforms.
 * Registers each action and generates platform-specific markup.
 */
export function createButtonSet(actions) {
    // Register actions and get tokens
    const registeredActions = actions.map(a => ({
        ...a,
        token: registerAction(a.action, `Button: ${a.label}`),
    }));
    // Discord: action row with buttons
    const discordButtons = registeredActions.map(a => ({
        type: 2,
        style: discordStyleNumber(a.style || 'primary'),
        label: a.label,
        // For link style, use URL; otherwise use custom_id
        ...(a.style === 'link'
            ? { url: `${ACTION_BASE_URL}?token=${a.token}&action=${encodeURIComponent(a.action)}` }
            : { custom_id: `kbot_action_${a.token}` }),
    }));
    const discord = {
        type: 1,
        components: discordButtons,
    };
    // Email: HTML buttons
    const emailButtons = registeredActions.map(a => {
        const color = emailButtonColor(a.style || 'primary');
        const url = `${ACTION_BASE_URL}?token=${a.token}&action=${encodeURIComponent(a.action)}`;
        return `<a href="${url}" style="display:inline-block;padding:10px 24px;margin:4px 8px 4px 0;background-color:${color};color:#ffffff;text-decoration:none;border-radius:6px;font-family:'Courier Prime',monospace;font-size:14px;font-weight:bold;">${escapeHtml(a.label)}</a>`;
    });
    const email_html = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5;">${emailButtons.join('\n')}</div>`;
    // Slack: Block Kit buttons (future use)
    const slack_blocks = [
        {
            type: 'actions',
            elements: registeredActions.map(a => ({
                type: 'button',
                text: {
                    type: 'plain_text',
                    text: a.label,
                    emoji: true,
                },
                action_id: `kbot_${a.action}`,
                value: a.token,
                ...(a.style === 'danger' ? { style: 'danger' } : {}),
                ...(a.style === 'primary' ? { style: 'primary' } : {}),
            })),
        },
    ];
    return { discord, email_html, slack_blocks };
}
/**
 * Send an email via Resend with clickable action buttons at the bottom.
 * Requires RESEND_API_KEY in environment.
 */
export async function createEmailWithButtons(to, subject, body, buttons) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return { sent: false, message_id: null, error: 'RESEND_API_KEY not configured' };
    }
    const buttonSet = createButtonSet(buttons);
    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'EB Garamond','Georgia',serif;color:#1a1a1a;background-color:#FFFFF0;padding:32px;max-width:600px;margin:0 auto;">
  <div style="font-family:'Courier Prime',monospace;font-size:12px;color:#6B5B95;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;">kernel.chat</div>
  <h2 style="font-family:'EB Garamond','Georgia',serif;margin:0 0 16px 0;">${escapeHtml(subject)}</h2>
  <div style="line-height:1.6;">${body}</div>
  ${buttonSet.email_html}
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#999;">
    Sent by kbot &mdash; <a href="https://kernel.chat" style="color:#6B5B95;">kernel.chat</a>
  </div>
</body>
</html>`;
    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                from: 'kbot <noreply@kernel.chat>',
                to: [to],
                subject,
                html: htmlBody,
            }),
            signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
            const errText = await res.text();
            return { sent: false, message_id: null, error: `Resend API error: ${res.status} ${errText}` };
        }
        const result = await res.json();
        return { sent: true, message_id: result.id || null, error: null };
    }
    catch (err) {
        return { sent: false, message_id: null, error: err.message };
    }
}
/**
 * Send a Discord message with interactive button components.
 */
export async function createDiscordWithButtons(webhookUrl, embed, buttons) {
    const buttonSet = createButtonSet(buttons);
    // For webhook-based messages, buttons must use link style (URL buttons)
    // since webhooks can't receive interaction callbacks
    const linkButtons = buttons.map(b => {
        const token = registerAction(b.action, `Discord button: ${b.label}`);
        return {
            type: 2,
            style: 5, // Link style for webhook messages
            label: b.label,
            url: `${ACTION_BASE_URL}?token=${token}&action=${encodeURIComponent(b.action)}`,
        };
    });
    const actionRow = {
        type: 1,
        components: linkButtons,
    };
    const payload = {
        embeds: [embed],
        components: [actionRow],
    };
    // Use buttonSet to suppress unused variable — Slack blocks stored for future
    void buttonSet.slack_blocks;
    try {
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
            const errText = await res.text();
            return { sent: false, error: `Discord webhook error: ${res.status} ${errText}` };
        }
        return { sent: true, error: null };
    }
    catch (err) {
        return { sent: false, error: err.message };
    }
}
/**
 * Process a button click action.
 * Reads the action from pending-actions, marks it as executed.
 */
export function handleButtonAction(token, action) {
    ensureDir();
    const path = actionPath(token);
    if (!existsSync(path)) {
        return { handled: false, action, callback_description: '', error: 'Action token not found' };
    }
    let pending;
    try {
        pending = JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch {
        return { handled: false, action, callback_description: '', error: 'Failed to read action' };
    }
    // Check if expired
    if (new Date(pending.expires_at).getTime() < Date.now()) {
        rmSync(path);
        return { handled: false, action, callback_description: pending.callback_description, error: 'Action expired' };
    }
    // Check if already executed
    if (pending.executed) {
        return { handled: false, action, callback_description: pending.callback_description, error: 'Action already executed' };
    }
    // Verify action matches
    if (pending.action !== action) {
        return { handled: false, action, callback_description: pending.callback_description, error: 'Action mismatch' };
    }
    // Mark as executed
    pending.executed = true;
    pending.executed_at = new Date().toISOString();
    writeFileSync(path, JSON.stringify(pending, null, 2));
    return {
        handled: true,
        action: pending.action,
        callback_description: pending.callback_description,
        error: null,
    };
}
/**
 * Register an action with a unique token.
 * Saves to ~/.kbot/pending-actions/. Expires after 72 hours.
 */
export function registerAction(action, callback_description) {
    ensureDir();
    const token = randomUUID();
    const now = new Date();
    const expires = new Date(now.getTime() + ACTION_EXPIRY_MS);
    const pending = {
        token,
        action,
        callback_description,
        created_at: now.toISOString(),
        expires_at: expires.toISOString(),
        executed: false,
        executed_at: null,
    };
    writeFileSync(actionPath(token), JSON.stringify(pending, null, 2));
    // Prune expired actions in the background
    pruneExpiredActions();
    return token;
}
/** Remove expired pending actions */
function pruneExpiredActions() {
    ensureDir();
    try {
        const files = readdirSync(PENDING_DIR).filter(f => f.endsWith('.json'));
        const now = Date.now();
        for (const file of files) {
            const path = join(PENDING_DIR, file);
            try {
                const pending = JSON.parse(readFileSync(path, 'utf-8'));
                if (new Date(pending.expires_at).getTime() < now) {
                    rmSync(path);
                }
            }
            catch {
                // Corrupt file — remove it
                rmSync(path, { force: true });
            }
        }
    }
    catch {
        // Non-critical — pruning can fail silently
    }
}
/** Escape HTML special characters */
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
//# sourceMappingURL=interactive-buttons.js.map