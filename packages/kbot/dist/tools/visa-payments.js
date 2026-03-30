// kbot Visa Agent Payments — AI agent card payments via Visa CLI
// Integrates with Visa Crypto Labs' CLI tool for secure agent-initiated payments.
// No API keys stored — uses Visa's CLI tokenization for credential-free payments.
//
// Requires: visa-cli (npm install -g @aspect-build/visa-cli or via Visa developer portal)
// Docs: https://developer.visa.com/capabilities/visa-cli
import { execSync } from 'node:child_process';
import { registerTool } from './index.js';
function isVisaCliInstalled() {
    try {
        execSync('which visa-cli', { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
function runVisaCli(args, timeout = 30_000) {
    try {
        return execSync(`visa-cli ${args}`, {
            encoding: 'utf-8',
            timeout,
            env: { ...process.env },
        }).trim();
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`visa-cli error: ${message}`);
    }
}
export function registerVisaPaymentTools() {
    registerTool({
        name: 'visa_status',
        description: 'Check Visa CLI installation and authentication status. Returns whether visa-cli is installed and the current agent wallet status.',
        parameters: {},
        tier: 'pro',
        timeout: 15_000,
        async execute() {
            if (!isVisaCliInstalled()) {
                return JSON.stringify({
                    installed: false,
                    message: 'Visa CLI not found. Install with: npm install -g @aspect-build/visa-cli\nThen authenticate with: visa-cli auth login',
                });
            }
            try {
                const status = runVisaCli('status --json');
                return status;
            }
            catch {
                return JSON.stringify({
                    installed: true,
                    authenticated: false,
                    message: 'Visa CLI installed but not authenticated. Run: visa-cli auth login',
                });
            }
        },
    });
    registerTool({
        name: 'visa_pay',
        description: 'Initiate a card payment via Visa CLI. Uses tokenized credentials — no API keys or card numbers are stored or transmitted by kbot. Requires user confirmation for amounts over $10.',
        parameters: {
            amount: { type: 'number', description: 'Payment amount in USD', required: true },
            recipient: { type: 'string', description: 'Recipient identifier (merchant ID, URL, or email)', required: true },
            memo: { type: 'string', description: 'Payment memo/description', required: true },
            currency: { type: 'string', description: 'Currency code (default: USD)', default: 'USD' },
        },
        tier: 'pro',
        timeout: 60_000,
        async execute(args) {
            if (!isVisaCliInstalled()) {
                return 'Error: Visa CLI not installed. Run: npm install -g @aspect-build/visa-cli';
            }
            const amount = Number(args.amount);
            const recipient = String(args.recipient);
            const memo = String(args.memo || 'kbot agent payment');
            const currency = String(args.currency || 'USD');
            if (isNaN(amount) || amount <= 0) {
                return 'Error: Invalid payment amount. Must be a positive number.';
            }
            if (amount > 500) {
                return 'Error: Payment amount exceeds agent limit ($500). For larger payments, use visa-cli directly.';
            }
            try {
                const result = runVisaCli(`pay --amount ${amount} --currency ${currency} --to "${recipient}" --memo "${memo}" --json`, 60_000);
                return result;
            }
            catch (err) {
                return `Payment failed: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    registerTool({
        name: 'visa_history',
        description: 'View recent Visa CLI payment history for this agent.',
        parameters: {
            limit: { type: 'number', description: 'Number of transactions to show (default: 10)', default: 10 },
        },
        tier: 'pro',
        timeout: 15_000,
        async execute(args) {
            if (!isVisaCliInstalled()) {
                return 'Error: Visa CLI not installed. Run: npm install -g @aspect-build/visa-cli';
            }
            const limit = Number(args.limit || 10);
            try {
                const result = runVisaCli(`history --limit ${limit} --json`);
                return result;
            }
            catch (err) {
                return `Failed to fetch history: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    registerTool({
        name: 'visa_balance',
        description: 'Check the available balance and spending limits for the agent payment card.',
        parameters: {},
        tier: 'pro',
        timeout: 15_000,
        async execute() {
            if (!isVisaCliInstalled()) {
                return 'Error: Visa CLI not installed. Run: npm install -g @aspect-build/visa-cli';
            }
            try {
                const result = runVisaCli('balance --json');
                return result;
            }
            catch (err) {
                return `Failed to fetch balance: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    registerTool({
        name: 'visa_purchase',
        description: 'Purchase a digital resource (API key, domain, cloud credits, SaaS subscription) via Visa CLI. The agent can autonomously buy resources needed for task completion.',
        parameters: {
            service: { type: 'string', description: 'Service name (e.g., "vercel", "aws", "namecheap", "openai")', required: true },
            product: { type: 'string', description: 'Product or plan to purchase', required: true },
            amount: { type: 'number', description: 'Expected cost in USD', required: true },
        },
        tier: 'pro',
        timeout: 90_000,
        async execute(args) {
            if (!isVisaCliInstalled()) {
                return 'Error: Visa CLI not installed. Run: npm install -g @aspect-build/visa-cli';
            }
            const service = String(args.service);
            const product = String(args.product);
            const amount = Number(args.amount);
            if (isNaN(amount) || amount <= 0) {
                return 'Error: Invalid amount.';
            }
            if (amount > 100) {
                return `Error: Purchase amount ($${amount}) exceeds autonomous agent limit ($100). Please confirm this purchase manually via visa-cli.`;
            }
            try {
                const result = runVisaCli(`purchase --service "${service}" --product "${product}" --budget ${amount} --json`, 90_000);
                return result;
            }
            catch (err) {
                return `Purchase failed: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
}
//# sourceMappingURL=visa-payments.js.map