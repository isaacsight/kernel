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
export declare function generateBuddyCard(): string;
/**
 * Generate a compact ASCII version of the trading card for terminal display.
 * Fits within ~40 chars wide.
 */
export declare function generateBuddyCardAscii(): string;
//# sourceMappingURL=buddy-card.d.ts.map