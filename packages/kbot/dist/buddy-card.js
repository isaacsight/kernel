// kbot Buddy Trading Card — SVG Generator
//
// Generates a shareable trading card (400x560 SVG) for the user's buddy.
// Renders the ASCII sprite as monospace <text>, overlays name/title/level/stats,
// and lists achievement icons at the bottom.
//
// No external dependencies. Pure SVG. Valid in all modern browsers.
import { getBuddy, getBuddySprite, getBuddyLevel, getAchievements, } from './buddy.js';
import { getExtendedStats } from './learning.js';
import { getDreamStatus } from './dream.js';
const SPECIES_COLORS = {
    fox: { primary: '#FF6B35', secondary: '#FFD700', dark: '#1A0D00' },
    owl: { primary: '#6B5B95', secondary: '#9B8EC4', dark: '#110E1A' },
    cat: { primary: '#4A4A4A', secondary: '#8E8E8E', dark: '#111111' },
    robot: { primary: '#00BCD4', secondary: '#4DD0E1', dark: '#001519' },
    ghost: { primary: '#E0E0E0', secondary: '#B0BEC5', dark: '#161819' },
    mushroom: { primary: '#4CAF50', secondary: '#81C784', dark: '#0A1A0B' },
    octopus: { primary: '#1565C0', secondary: '#42A5F5', dark: '#060F1A' },
    dragon: { primary: '#D32F2F', secondary: '#FF5252', dark: '#1A0808' },
};
// ── SVG escaping ──
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
// ── Card generator ──
/**
 * Generate a trading card SVG string for the current buddy.
 *
 * Card layout (400x560):
 *   0-140:   Species gradient header with name + title
 *   140-310: Dark field with ASCII sprite rendered as monospace text
 *   310-360: Level bar with XP progress
 *   360-480: Stats grid (sessions, messages, patterns, dreams, achievements)
 *   480-530: Achievement icon row
 *   530-560: Watermark footer
 */
export function generateBuddyCard() {
    const buddy = getBuddy();
    const level = getBuddyLevel();
    const achievements = getAchievements();
    const stats = getExtendedStats();
    const dreamStatus = getDreamStatus();
    const sprite = getBuddySprite('idle');
    const colors = SPECIES_COLORS[buddy.species];
    const unlockedCount = achievements.filter(a => a.unlockedAt !== null).length;
    const W = 400;
    const H = 560;
    // ── Build SVG ──
    const parts = [];
    // Open SVG
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`);
    // Defs: gradient, fonts, clip paths
    parts.push('<defs>');
    parts.push(`<linearGradient id="headerGrad" x1="0" y1="0" x2="1" y2="1">`, `  <stop offset="0%" stop-color="${colors.primary}"/>`, `  <stop offset="100%" stop-color="${colors.secondary}"/>`, `</linearGradient>`);
    parts.push(`<linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">`, `  <stop offset="0%" stop-color="${colors.primary}"/>`, `  <stop offset="100%" stop-color="${colors.secondary}"/>`, `</linearGradient>`);
    // Rounded card clip
    parts.push(`<clipPath id="cardClip">`, `  <rect x="0" y="0" width="${W}" height="${H}" rx="16" ry="16"/>`, `</clipPath>`);
    parts.push('</defs>');
    // Card background + clip
    parts.push(`<g clip-path="url(#cardClip)">`);
    // -- Background fill --
    parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#0D0D0D"/>`);
    // -- Header gradient (0-140) --
    parts.push(`<rect x="0" y="0" width="${W}" height="140" fill="url(#headerGrad)" opacity="0.9"/>`);
    // Species label (small, top-left)
    parts.push(`<text x="20" y="30" fill="rgba(255,255,255,0.7)" font-family="'Courier New',Courier,monospace" font-size="11" font-weight="bold" letter-spacing="2">`, `  ${escapeXml(buddy.species.toUpperCase())}`, `</text>`);
    // Level badge (top-right)
    parts.push(`<text x="${W - 20}" y="30" fill="rgba(255,255,255,0.7)" font-family="'Courier New',Courier,monospace" font-size="11" text-anchor="end" font-weight="bold">`, `  LV.${level.level}`, `</text>`);
    // Name (large, centered)
    parts.push(`<text x="${W / 2}" y="75" fill="#FFFFFF" font-family="Georgia,'Times New Roman',serif" font-size="32" font-weight="bold" text-anchor="middle">`, `  ${escapeXml(buddy.name)}`, `</text>`);
    // Title / evolution name (centered, under name)
    const dashSep = '\u2014'; // em dash
    parts.push(`<text x="${W / 2}" y="105" fill="rgba(255,255,255,0.85)" font-family="'Courier New',Courier,monospace" font-size="14" text-anchor="middle">`, `  ${escapeXml(dashSep)} ${escapeXml(level.title)} ${escapeXml(dashSep)}`, `</text>`);
    // Evolution stars row
    const starFilled = '\u2605'; // ★
    const starEmpty = '\u2606'; // ☆
    const stars = Array.from({ length: 4 }, (_, i) => i < level.level + 1 ? starFilled : starEmpty).join(' ');
    parts.push(`<text x="${W / 2}" y="128" fill="rgba(255,255,255,0.6)" font-family="'Courier New',Courier,monospace" font-size="14" text-anchor="middle">`, `  ${escapeXml(stars)}`, `</text>`);
    // -- Sprite area (140-310) --
    parts.push(`<rect x="0" y="140" width="${W}" height="170" fill="${colors.dark}"/>`);
    // Subtle gradient overlay on sprite area
    parts.push(`<rect x="0" y="140" width="${W}" height="170" fill="url(#headerGrad)" opacity="0.06"/>`);
    // Render ASCII sprite as <text> lines (monospace, centered)
    const spriteStartY = 175;
    const spriteLineHeight = 22;
    const spriteFontSize = 18;
    for (let i = 0; i < sprite.length; i++) {
        const line = sprite[i];
        parts.push(`<text x="${W / 2}" y="${spriteStartY + i * spriteLineHeight}" ` +
            `fill="#FFFFFF" font-family="'Courier New',Courier,monospace" ` +
            `font-size="${spriteFontSize}" text-anchor="middle" xml:space="preserve">${escapeXml(line)}</text>`);
    }
    // Sprite glow effect — subtle border line
    parts.push(`<line x1="30" y1="308" x2="${W - 30}" y2="308" stroke="${colors.primary}" stroke-width="1" opacity="0.3"/>`);
    // -- Level bar (310-360) --
    const barY = 320;
    const barX = 30;
    const barW = W - 60;
    const barH = 12;
    const xpProgress = level.xpToNext !== null
        ? level.xp / (level.xp + level.xpToNext)
        : 1.0;
    const filledW = Math.round(barW * xpProgress);
    // Label
    parts.push(`<text x="${barX}" y="${barY - 6}" fill="rgba(255,255,255,0.5)" font-family="'Courier New',Courier,monospace" font-size="10">`, `  XP`, `</text>`);
    const xpLabel = level.xpToNext !== null
        ? `${level.xp} / ${level.xp + level.xpToNext}`
        : `${level.xp} (MAX)`;
    parts.push(`<text x="${barX + barW}" y="${barY - 6}" fill="rgba(255,255,255,0.5)" font-family="'Courier New',Courier,monospace" font-size="10" text-anchor="end">`, `  ${escapeXml(xpLabel)}`, `</text>`);
    // Bar background
    parts.push(`<rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="6" ry="6" fill="rgba(255,255,255,0.1)"/>`);
    // Bar fill
    if (filledW > 0) {
        parts.push(`<rect x="${barX}" y="${barY}" width="${filledW}" height="${barH}" rx="6" ry="6" fill="url(#barGrad)"/>`);
    }
    // -- Stats section (355-480) --
    const statsY = 358;
    const statsGap = 38;
    const statItems = [
        { label: 'Sessions', value: String(stats.sessions) },
        { label: 'Messages', value: String(stats.totalMessages) },
        { label: 'Patterns', value: String(stats.patternsCount) },
        { label: 'Dreams', value: String(dreamStatus.state.cycles) },
        { label: 'Achievements', value: `${unlockedCount}/${achievements.length}` },
    ];
    // 2-column grid layout
    const colX = [barX + 10, W / 2 + 20];
    for (let i = 0; i < statItems.length; i++) {
        const row = Math.floor(i / 2);
        const col = i % 2;
        const x = colX[col];
        const y = statsY + row * statsGap;
        // Value (large)
        parts.push(`<text x="${x}" y="${y}" fill="#FFFFFF" font-family="'Courier New',Courier,monospace" font-size="18" font-weight="bold">`, `  ${escapeXml(statItems[i].value)}`, `</text>`);
        // Label (small, below value)
        parts.push(`<text x="${x}" y="${y + 14}" fill="rgba(255,255,255,0.45)" font-family="'Courier New',Courier,monospace" font-size="10">`, `  ${escapeXml(statItems[i].label)}`, `</text>`);
    }
    // Divider line before achievements
    parts.push(`<line x1="30" y1="478" x2="${W - 30}" y2="478" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`);
    // -- Achievement icons row (480-530) --
    const achY = 502;
    const iconSize = 16;
    // Show up to 18 achievement icons in a row
    const totalIcons = achievements.length;
    const iconSpacing = Math.min(20, (barW - 10) / totalIcons);
    const iconsStartX = W / 2 - (totalIcons * iconSpacing) / 2;
    for (let i = 0; i < achievements.length; i++) {
        const ach = achievements[i];
        const x = iconsStartX + i * iconSpacing + iconSpacing / 2;
        const isUnlocked = ach.unlockedAt !== null;
        const fillColor = isUnlocked ? colors.primary : 'rgba(255,255,255,0.15)';
        // Circle background
        parts.push(`<circle cx="${x}" cy="${achY}" r="${iconSize / 2 + 1}" fill="${isUnlocked ? 'rgba(255,255,255,0.1)' : 'none'}" ` +
            `stroke="${fillColor}" stroke-width="1.5"/>`);
        // Icon char
        parts.push(`<text x="${x}" y="${achY + 4}" fill="${fillColor}" font-family="'Courier New',Courier,monospace" ` +
            `font-size="10" text-anchor="middle" font-weight="bold">${escapeXml(ach.icon)}</text>`);
    }
    // Achievement label
    parts.push(`<text x="${W / 2}" y="${achY + 22}" fill="rgba(255,255,255,0.3)" font-family="'Courier New',Courier,monospace" font-size="9" text-anchor="middle">`, `  ${unlockedCount} of ${achievements.length} unlocked`, `</text>`);
    // -- Watermark footer (530-560) --
    parts.push(`<text x="${W / 2}" y="${H - 10}" fill="rgba(255,255,255,0.2)" font-family="'Courier New',Courier,monospace" font-size="10" text-anchor="middle">`, `  kernel.chat/kbot`, `</text>`);
    // Card border (subtle glow)
    parts.push(`<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="16" ry="16" fill="none" stroke="${colors.primary}" stroke-width="1" opacity="0.3"/>`);
    // Close card group + SVG
    parts.push('</g>');
    parts.push('</svg>');
    return parts.join('\n');
}
/**
 * Generate a compact ASCII version of the trading card for terminal display.
 * Fits within ~40 chars wide.
 */
export function generateBuddyCardAscii() {
    const buddy = getBuddy();
    const level = getBuddyLevel();
    const achievements = getAchievements();
    const stats = getExtendedStats();
    const dreamStatus = getDreamStatus();
    const sprite = getBuddySprite('idle');
    const unlockedCount = achievements.filter(a => a.unlockedAt !== null).length;
    const W = 38;
    const border = '+' + '-'.repeat(W) + '+';
    const pad = (s) => {
        const trimmed = s.slice(0, W);
        return '| ' + trimmed + ' '.repeat(W - trimmed.length - 1) + '|';
    };
    const center = (s) => {
        const trimmed = s.slice(0, W - 2);
        const leftPad = Math.floor((W - 2 - trimmed.length) / 2);
        const rightPad = W - 2 - trimmed.length - leftPad;
        return '| ' + ' '.repeat(leftPad) + trimmed + ' '.repeat(rightPad) + ' |';
    };
    const empty = '|' + ' '.repeat(W) + '|';
    const lines = [];
    lines.push(border);
    lines.push(center(`${buddy.name} -- ${level.title}`));
    lines.push(center(`[${buddy.species}] LV.${level.level}`));
    lines.push(pad('-'.repeat(W - 2)));
    // Sprite
    for (const spriteLine of sprite) {
        lines.push(center(spriteLine));
    }
    lines.push(pad('-'.repeat(W - 2)));
    // XP bar
    const barW = W - 12;
    const xpRatio = level.xpToNext !== null ? level.xp / (level.xp + level.xpToNext) : 1.0;
    const filled = Math.round(barW * xpRatio);
    const bar = '[' + '#'.repeat(filled) + '.'.repeat(barW - filled) + ']';
    const xpText = level.xpToNext !== null ? `${level.xp}/${level.xp + level.xpToNext}` : `${level.xp} MAX`;
    lines.push(pad(`XP ${bar} ${xpText}`));
    lines.push(empty);
    // Stats
    lines.push(pad(`Sessions:     ${stats.sessions}`));
    lines.push(pad(`Messages:     ${stats.totalMessages}`));
    lines.push(pad(`Patterns:     ${stats.patternsCount}`));
    lines.push(pad(`Dreams:       ${dreamStatus.state.cycles}`));
    lines.push(pad(`Achievements: ${unlockedCount}/${achievements.length}`));
    lines.push(pad('-'.repeat(W - 2)));
    // Achievement icons
    const icons = achievements.map(a => a.unlockedAt ? a.icon : '.').join(' ');
    lines.push(center(icons));
    lines.push(empty);
    lines.push(center('kernel.chat/kbot'));
    lines.push(border);
    return lines.join('\n');
}
//# sourceMappingURL=buddy-card.js.map