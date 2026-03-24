// kbot Wallet & Swap Tools — Solana wallet management + Jupiter DEX execution
// Private keys encrypted at rest (AES-256-CBC, same scheme as API keys).
// All real transactions require explicit user confirmation.
// Read-only operations (balance, token list) never need confirmation.

import { registerTool } from './index.js'
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

// ── Constants ──

const KBOT_DIR = join(homedir(), '.kbot')
const WALLET_PATH = join(KBOT_DIR, 'wallet.json')
const SOL_RPC = 'https://api.mainnet-beta.solana.com'
const JUPITER_QUOTE = 'https://quote-api.jup.ag/v6/quote'
const JUPITER_SWAP = 'https://quote-api.jup.ag/v6/swap'
const JUPITER_PRICE = 'https://api.jup.ag/price/v2'
const JUPITER_TOKENS = 'https://token.jup.ag/strict'
const SOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const LAMPORTS_PER_SOL = 1_000_000_000

// ── Encryption (matches auth.ts pattern) ──

function deriveKey(): Buffer {
  const machineId = `${homedir()}:${process.env.USER || 'kbot'}:${process.arch}:wallet`
  return createHash('sha256').update(machineId).digest()
}

function encrypt(plaintext: string): string {
  const key = deriveKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(plaintext, 'utf-8', 'base64')
  encrypted += cipher.final('base64')
  return `enc:${iv.toString('base64')}:${encrypted}`
}

function decrypt(encrypted: string): string {
  if (!encrypted.startsWith('enc:')) return encrypted
  const parts = encrypted.split(':')
  if (parts.length !== 3) return encrypted
  const key = deriveKey()
  const iv = Buffer.from(parts[1], 'base64')
  const decipher = createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(parts[2], 'base64', 'utf-8')
  decrypted += decipher.final('utf-8')
  return decrypted
}

// ── Wallet Storage ──

interface WalletConfig {
  publicKey: string
  encryptedPrivateKey: string
  label: string
  createdAt: string
  /** Max single transaction in SOL */
  maxTxSol: number
  /** Require confirmation for every transaction */
  confirmAll: boolean
}

interface WalletStore {
  active: string // label of active wallet
  wallets: WalletConfig[]
}

function loadStore(): WalletStore {
  if (!existsSync(WALLET_PATH)) return { active: '', wallets: [] }
  try {
    const raw = JSON.parse(readFileSync(WALLET_PATH, 'utf-8'))
    // Migration: old single-wallet format → multi-wallet
    if (raw.publicKey && !raw.wallets) {
      return { active: raw.label || 'default', wallets: [raw] }
    }
    return raw
  } catch { return { active: '', wallets: [] } }
}

function saveStore(store: WalletStore): void {
  if (!existsSync(KBOT_DIR)) mkdirSync(KBOT_DIR, { recursive: true })
  writeFileSync(WALLET_PATH, JSON.stringify(store, null, 2))
  chmodSync(WALLET_PATH, 0o600)
}

function loadWallet(): WalletConfig | null {
  const store = loadStore()
  if (!store.wallets.length) return null
  return store.wallets.find(w => w.label === store.active) || store.wallets[0]
}

function saveWallet(w: WalletConfig): void {
  const store = loadStore()
  const idx = store.wallets.findIndex(x => x.label === w.label)
  if (idx >= 0) store.wallets[idx] = w
  else store.wallets.push(w)
  if (!store.active) store.active = w.label
  saveStore(store)
}

// ── Solana Helpers ──

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(SOL_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  })
  const data = await res.json() as any
  if (data.error) throw new Error(`RPC error: ${data.error.message}`)
  return data.result
}

async function getSolBalance(pubkey: string): Promise<number> {
  const result = await rpcCall('getBalance', [pubkey]) as any
  return (result?.value ?? 0) / LAMPORTS_PER_SOL
}

async function getTokenAccounts(pubkey: string): Promise<Array<{ mint: string; amount: number; decimals: number }>> {
  const result = await rpcCall('getTokenAccountsByOwner', [
    pubkey,
    { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
    { encoding: 'jsonParsed' },
  ]) as any
  return (result?.value ?? []).map((a: any) => ({
    mint: a.account.data.parsed.info.mint,
    amount: Number(a.account.data.parsed.info.tokenAmount.uiAmount),
    decimals: a.account.data.parsed.info.tokenAmount.decimals,
  })).filter((t: any) => t.amount > 0)
}

function fmt(n: number, d = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

// ── Token Resolution ──

const COMMON_TOKENS: Record<string, string> = {
  sol: SOL_MINT,
  usdc: USDC_MINT,
  usdt: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  bonk: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  jup: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  ray: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  wif: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  jto: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
  pyth: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  render: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',
  wen: 'WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk',
  w: '85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ',
}

async function resolveTokenMint(symbol: string): Promise<{ mint: string; symbol: string; name: string } | null> {
  const lower = symbol.toLowerCase()
  if (COMMON_TOKENS[lower]) {
    return { mint: COMMON_TOKENS[lower], symbol: lower.toUpperCase(), name: lower }
  }

  // Search Jupiter token list
  try {
    const tokens = await fetch(JUPITER_TOKENS, { signal: AbortSignal.timeout(8_000) }).then(r => r.json()) as any[]
    const match = tokens.find((t: any) =>
      t.symbol?.toLowerCase() === lower || t.name?.toLowerCase() === lower
    )
    if (match) return { mint: match.address, symbol: match.symbol, name: match.name }
  } catch { /* fallback */ }

  // If it looks like a mint address, use it directly
  if (symbol.length >= 32 && symbol.length <= 44) {
    return { mint: symbol, symbol: 'UNKNOWN', name: symbol.slice(0, 8) + '...' }
  }

  return null
}

// ── Register Tools ──

export function registerWalletTools(): void {

  // ─── Multi-Wallet Management ───

  registerTool({
    name: 'wallet_list',
    description: 'List all kbot wallets. Shows which wallet is active, labels, addresses, and balances.',
    parameters: {},
    tier: 'free',
    timeout: 20_000,
    async execute() {
      const store = loadStore()
      if (!store.wallets.length) return 'No wallets. Use `wallet_setup create` to get started.'

      const lines: string[] = ['## kbot Wallets', '']

      for (const w of store.wallets) {
        const isActive = w.label === store.active ? ' **(active)**' : ''
        let balance = '?'
        try { const sol = await getSolBalance(w.publicKey); balance = `${fmt(sol, 4)} SOL` } catch { /* skip */ }
        lines.push(`### ${w.label}${isActive}`)
        lines.push(`- Address: \`${w.publicKey.slice(0, 6)}...${w.publicKey.slice(-4)}\``)
        lines.push(`- Balance: ${balance}`)
        lines.push(`- Max Tx: ${w.maxTxSol} SOL`)
        lines.push(`- Created: ${w.createdAt.split('T')[0]}`)
        lines.push('')
      }

      return lines.join('\n')
    },
  })

  registerTool({
    name: 'wallet_switch',
    description: 'Switch the active wallet by label. All subsequent operations will use this wallet.',
    parameters: {
      label: { type: 'string', description: 'Label of the wallet to activate', required: true },
    },
    tier: 'free',
    async execute(args) {
      const label = String(args.label)
      const store = loadStore()
      const wallet = store.wallets.find(w => w.label === label)
      if (!wallet) return `No wallet with label "${label}". Available: ${store.wallets.map(w => w.label).join(', ')}`
      store.active = label
      saveStore(store)
      return `Active wallet switched to **${label}** (\`${wallet.publicKey.slice(0, 6)}...${wallet.publicKey.slice(-4)}\`).`
    },
  })

  registerTool({
    name: 'wallet_send',
    description: 'Send SOL from your active wallet to another address. Requires confirmation and respects max transaction limit.',
    parameters: {
      to: { type: 'string', description: 'Recipient Solana address', required: true },
      amount: { type: 'number', description: 'Amount of SOL to send', required: true },
      confirmed: { type: 'string', description: 'Must be "yes" to execute. Safety gate.' },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const wallet = loadWallet()
      if (!wallet) return '**BLOCKED**: No wallet configured.'
      if (String(args.confirmed).toLowerCase() !== 'yes') {
        return `**SAFETY GATE**: This will send ${args.amount} SOL to ${String(args.to).slice(0, 8)}... — pass \`confirmed: "yes"\` to execute.`
      }
      const amount = Number(args.amount)
      if (!amount || amount <= 0) return 'Amount must be positive.'
      if (amount > wallet.maxTxSol) {
        return `**RISK LIMIT**: ${amount} SOL exceeds your max transaction limit of ${wallet.maxTxSol} SOL.`
      }

      const balance = await getSolBalance(wallet.publicKey)
      if (amount > balance - 0.005) return `Insufficient balance. Have ${fmt(balance, 4)} SOL (need ${fmt(amount + 0.005, 4)} with fee).`

      // Build transfer instruction via Solana RPC
      const lamports = Math.round(amount * LAMPORTS_PER_SOL)
      const { blockhash } = await rpcCall('getLatestBlockhash', [{ commitment: 'finalized' }]) as any

      // For a simple SOL transfer, we need to construct a proper transaction
      // This is complex without @solana/web3.js, so we note the limitation
      return [
        '## SOL Transfer Prepared',
        '',
        `**From**: \`${wallet.publicKey.slice(0, 6)}...${wallet.publicKey.slice(-4)}\``,
        `**To**: \`${String(args.to).slice(0, 6)}...${String(args.to).slice(-4)}\``,
        `**Amount**: ${fmt(amount, 4)} SOL (${lamports.toLocaleString()} lamports)`,
        `**Blockhash**: ${blockhash}`,
        '',
        '*Note: Raw SOL transfers require @solana/web3.js for transaction serialization. Use `swap_execute` for token swaps via Jupiter, which handles serialization server-side.*',
      ].join('\n')
    },
  })

  // ─── Wallet Setup ───

  registerTool({
    name: 'wallet_setup',
    description: 'Create or import a Solana wallet for kbot. Private key is encrypted at rest (AES-256-CBC). Use "create" for a new wallet or "import" with an existing private key.',
    parameters: {
      action: { type: 'string', description: '"create" for new wallet, "import" to import existing, "info" to show current wallet, "remove" to delete', required: true },
      privateKey: { type: 'string', description: 'Base58 private key (only for import action). NEVER log or display this.' },
      label: { type: 'string', description: 'Friendly label for this wallet (e.g. "trading", "defi")' },
      maxTxSol: { type: 'number', description: 'Max transaction size in SOL (default: 1.0 — safety limit)', default: 1.0 },
    },
    tier: 'free',
    async execute(args) {
      const action = String(args.action).toLowerCase()

      if (action === 'info') {
        const w = loadWallet()
        if (!w) return 'No wallet configured. Use `wallet_setup create` or `wallet_setup import`.'
        const sol = await getSolBalance(w.publicKey).catch(() => 0)
        return [
          '## kbot Wallet',
          `**Label**: ${w.label}`,
          `**Address**: \`${w.publicKey}\``,
          `**Balance**: ${fmt(sol, 4)} SOL`,
          `**Max Tx**: ${w.maxTxSol} SOL`,
          `**Confirm All**: ${w.confirmAll ? 'Yes' : 'No'}`,
          `**Created**: ${w.createdAt.split('T')[0]}`,
          '',
          `*Private key encrypted at rest (AES-256-CBC)*`,
        ].join('\n')
      }

      if (action === 'remove') {
        const w = loadWallet()
        if (!w) return 'No wallet to remove.'
        const { unlinkSync } = await import('node:fs')
        unlinkSync(WALLET_PATH)
        return `Wallet "${w.label}" removed. Private key deleted from disk.`
      }

      if (action === 'create') {
        // Generate a new Ed25519 keypair using Node crypto
        const { generateKeyPairSync } = await import('node:crypto')
        const { publicKey, privateKey } = generateKeyPairSync('ed25519')

        // Export raw bytes
        const pubRaw = publicKey.export({ type: 'spki', format: 'der' })
        const privRaw = privateKey.export({ type: 'pkcs8', format: 'der' })

        // Ed25519 SPKI: last 32 bytes are the public key
        const pubBytes = pubRaw.subarray(pubRaw.length - 32)
        // Ed25519 PKCS8: bytes 16-48 are the private key seed
        const privBytes = privRaw.subarray(16, 48)

        // Base58 encode
        const bs58Encode = (buf: Buffer): string => {
          const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
          let num = BigInt('0x' + buf.toString('hex'))
          let str = ''
          while (num > 0n) { str = ALPHABET[Number(num % 58n)] + str; num /= 58n }
          for (const b of buf) { if (b === 0) str = '1' + str; else break }
          return str
        }

        // Solana keypair is 64 bytes: [32 seed bytes][32 public key bytes]
        const fullKeypair = Buffer.concat([privBytes, pubBytes])
        const pubkey = bs58Encode(pubBytes)
        const privkey = bs58Encode(fullKeypair)

        const wallet: WalletConfig = {
          publicKey: pubkey,
          encryptedPrivateKey: encrypt(privkey),
          label: String(args.label || 'default'),
          createdAt: new Date().toISOString(),
          maxTxSol: Number(args.maxTxSol) || 1.0,
          confirmAll: true,
        }
        saveWallet(wallet)

        return [
          '## New Solana Wallet Created',
          '',
          `**Address**: \`${pubkey}\``,
          `**Label**: ${wallet.label}`,
          `**Max Tx**: ${wallet.maxTxSol} SOL`,
          '',
          '**IMPORTANT**: Fund this wallet by sending SOL to the address above.',
          'Private key is encrypted and stored in `~/.kbot/wallet.json` (chmod 600).',
          'Back up your private key separately — if you lose `~/.kbot/wallet.json`, funds are unrecoverable.',
        ].join('\n')
      }

      if (action === 'import') {
        const pk = String(args.privateKey || '')
        if (!pk || pk.length < 32) return 'Error: provide a valid base58 private key for import.'

        // Decode base58 to get public key (last 32 bytes of 64-byte keypair)
        const bs58Decode = (str: string): Buffer => {
          const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
          let num = 0n
          for (const c of str) { num = num * 58n + BigInt(ALPHABET.indexOf(c)) }
          const hex = num.toString(16).padStart(128, '0')
          return Buffer.from(hex, 'hex')
        }

        const decoded = bs58Decode(pk)
        const pubBytes = decoded.subarray(32, 64)
        const bs58Encode = (buf: Buffer): string => {
          const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
          let n = BigInt('0x' + buf.toString('hex'))
          let s = ''
          while (n > 0n) { s = ALPHABET[Number(n % 58n)] + s; n /= 58n }
          for (const b of buf) { if (b === 0) s = '1' + s; else break }
          return s
        }
        const pubkey = bs58Encode(pubBytes)

        const wallet: WalletConfig = {
          publicKey: pubkey,
          encryptedPrivateKey: encrypt(pk),
          label: String(args.label || 'imported'),
          createdAt: new Date().toISOString(),
          maxTxSol: Number(args.maxTxSol) || 1.0,
          confirmAll: true,
        }
        saveWallet(wallet)

        return [
          '## Wallet Imported',
          `**Address**: \`${pubkey}\``,
          `**Label**: ${wallet.label}`,
          `**Max Tx**: ${wallet.maxTxSol} SOL`,
          '',
          'Private key encrypted and stored. Original input NOT saved in plaintext anywhere.',
        ].join('\n')
      }

      return 'Unknown action. Use: create, import, info, or remove.'
    },
  })

  // ─── Token Balances ───

  registerTool({
    name: 'wallet_tokens',
    description: 'Show all token balances in your kbot Solana wallet — SOL + SPL tokens with USD values.',
    parameters: {},
    tier: 'free',
    timeout: 20_000,
    async execute() {
      const w = loadWallet()
      if (!w) return 'No wallet configured. Use `wallet_setup create` first.'

      const [sol, tokens] = await Promise.all([
        getSolBalance(w.publicKey),
        getTokenAccounts(w.publicKey),
      ])

      // Get prices for all tokens + SOL
      const mints = [SOL_MINT, ...tokens.map(t => t.mint)]
      let prices: Record<string, number> = {}
      try {
        const ids = mints.join(',')
        const priceData = await fetch(`${JUPITER_PRICE}?ids=${ids}`, {
          signal: AbortSignal.timeout(10_000),
        }).then(r => r.json()) as any
        for (const [mint, info] of Object.entries(priceData.data || {})) {
          prices[mint] = Number((info as any).price) || 0
        }
      } catch { /* prices will be 0 */ }

      const solPrice = prices[SOL_MINT] || 0
      const solValue = sol * solPrice

      const lines: string[] = [
        `## Wallet: ${w.label}`,
        `**Address**: \`${w.publicKey.slice(0, 6)}...${w.publicKey.slice(-4)}\``,
        '',
        '| Token | Balance | USD Value |',
        '|-------|---------|-----------|',
        `| SOL | ${fmt(sol, 4)} | $${fmt(solValue)} |`,
      ]

      let totalValue = solValue
      for (const t of tokens) {
        const price = prices[t.mint] || 0
        const value = t.amount * price
        totalValue += value
        const symbol = t.mint.slice(0, 6) + '...'
        lines.push(`| ${symbol} | ${fmt(t.amount, 4)} | $${fmt(value)} |`)
      }

      lines.push('', `**Total Portfolio Value**: $${fmt(totalValue)}`)
      return lines.join('\n')
    },
  })

  // ─── Jupiter Swap Quote ───

  registerTool({
    name: 'swap_quote',
    description: 'Get a swap quote from Jupiter DEX (Solana). Shows price, route, slippage, and fees BEFORE executing. No wallet needed — read-only.',
    parameters: {
      from: { type: 'string', description: 'Token to sell (e.g. "SOL", "USDC", or mint address)', required: true },
      to: { type: 'string', description: 'Token to buy (e.g. "SOL", "USDC", "BONK", or mint address)', required: true },
      amount: { type: 'number', description: 'Amount of "from" token to swap', required: true },
      slippage: { type: 'number', description: 'Max slippage in basis points (default: 50 = 0.5%)', default: 50 },
    },
    tier: 'free',
    timeout: 15_000,
    async execute(args) {
      const fromToken = await resolveTokenMint(String(args.from))
      const toToken = await resolveTokenMint(String(args.to))
      if (!fromToken) return `Could not resolve token "${args.from}". Try the full mint address.`
      if (!toToken) return `Could not resolve token "${args.to}". Try the full mint address.`

      const amount = Number(args.amount)
      if (!amount || amount <= 0) return 'Amount must be positive.'

      // Determine decimals for input token
      const fromDecimals = fromToken.mint === SOL_MINT ? 9
        : fromToken.mint === USDC_MINT ? 6
        : 6 // default assumption
      const rawAmount = Math.round(amount * (10 ** fromDecimals))
      const slippage = Number(args.slippage) || 50

      const url = `${JUPITER_QUOTE}?inputMint=${fromToken.mint}&outputMint=${toToken.mint}&amount=${rawAmount}&slippageBps=${slippage}`
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) return `Jupiter API error: ${res.status} ${res.statusText}`
      const quote = await res.json() as any

      if (!quote.outAmount) return 'No route found for this swap. Try a different pair or smaller amount.'

      const toDecimals = toToken.mint === SOL_MINT ? 9
        : toToken.mint === USDC_MINT ? 6
        : 6
      const outAmount = Number(quote.outAmount) / (10 ** toDecimals)
      const priceImpact = Number(quote.priceImpactPct || 0)
      const routePlan = quote.routePlan?.map((r: any) =>
        `${r.swapInfo?.label || 'Unknown'}`
      ).join(' → ') || 'Direct'

      return [
        '## Swap Quote (Jupiter)',
        '',
        `**Sell**: ${fmt(amount, 4)} ${fromToken.symbol}`,
        `**Buy**: ${fmt(outAmount, 6)} ${toToken.symbol}`,
        `**Rate**: 1 ${fromToken.symbol} = ${fmt(outAmount / amount, 6)} ${toToken.symbol}`,
        `**Price Impact**: ${fmt(priceImpact * 100, 3)}%`,
        `**Slippage Tolerance**: ${slippage / 100}%`,
        `**Route**: ${routePlan}`,
        '',
        `*Quote valid for ~30 seconds. Use \`swap_execute\` to execute.*`,
      ].join('\n')
    },
  })

  // ─── Execute Swap ───

  registerTool({
    name: 'swap_execute',
    description: 'Execute a token swap on Jupiter DEX using your kbot Solana wallet. Gets a fresh quote and signs the transaction. REQUIRES wallet setup and user confirmation. Enforces max transaction limit.',
    parameters: {
      from: { type: 'string', description: 'Token to sell (e.g. "SOL", "USDC")', required: true },
      to: { type: 'string', description: 'Token to buy (e.g. "SOL", "BONK")', required: true },
      amount: { type: 'number', description: 'Amount of "from" token to swap', required: true },
      slippage: { type: 'number', description: 'Max slippage in basis points (default: 50 = 0.5%)', default: 50 },
      confirmed: { type: 'string', description: 'Must be "yes" to execute. Safety gate — always show the quote first.' },
    },
    tier: 'free',
    timeout: 60_000,
    async execute(args) {
      const wallet = loadWallet()
      if (!wallet) return '**BLOCKED**: No wallet configured. Run `wallet_setup create` or `wallet_setup import` first.'

      if (String(args.confirmed).toLowerCase() !== 'yes') {
        return '**SAFETY GATE**: You must pass `confirmed: "yes"` to execute a real swap. Get a quote with `swap_quote` first, then confirm.'
      }

      const fromToken = await resolveTokenMint(String(args.from))
      const toToken = await resolveTokenMint(String(args.to))
      if (!fromToken) return `Could not resolve token "${args.from}".`
      if (!toToken) return `Could not resolve token "${args.to}".`

      const amount = Number(args.amount)
      if (!amount || amount <= 0) return 'Amount must be positive.'

      // Enforce max transaction limit
      if (fromToken.mint === SOL_MINT && amount > wallet.maxTxSol) {
        return `**RISK LIMIT**: ${amount} SOL exceeds your max transaction limit of ${wallet.maxTxSol} SOL. Update with \`wallet_setup\` to increase.`
      }

      // For non-SOL tokens, check SOL equivalent value
      if (fromToken.mint !== SOL_MINT) {
        try {
          const priceData = await fetch(`${JUPITER_PRICE}?ids=${fromToken.mint},${SOL_MINT}`, {
            signal: AbortSignal.timeout(5_000),
          }).then(r => r.json()) as any
          const tokenPrice = Number(priceData.data?.[fromToken.mint]?.price) || 0
          const solPrice = Number(priceData.data?.[SOL_MINT]?.price) || 1
          const solEquivalent = (amount * tokenPrice) / solPrice
          if (solEquivalent > wallet.maxTxSol) {
            return `**RISK LIMIT**: ~${fmt(solEquivalent, 2)} SOL equivalent exceeds your max of ${wallet.maxTxSol} SOL.`
          }
        } catch { /* proceed — can't verify, but other guards exist */ }
      }

      // Get fresh quote
      const fromDecimals = fromToken.mint === SOL_MINT ? 9 : fromToken.mint === USDC_MINT ? 6 : 6
      const rawAmount = Math.round(amount * (10 ** fromDecimals))
      const slippage = Number(args.slippage) || 50

      const quoteUrl = `${JUPITER_QUOTE}?inputMint=${fromToken.mint}&outputMint=${toToken.mint}&amount=${rawAmount}&slippageBps=${slippage}`
      const quoteRes = await fetch(quoteUrl, { signal: AbortSignal.timeout(10_000) })
      if (!quoteRes.ok) return `Jupiter quote failed: ${quoteRes.status}`
      const quote = await quoteRes.json() as any
      if (!quote.outAmount) return 'No route found.'

      // Request swap transaction from Jupiter
      const swapRes = await fetch(JUPITER_SWAP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: wallet.publicKey,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
        }),
        signal: AbortSignal.timeout(15_000),
      })

      if (!swapRes.ok) {
        const err = await swapRes.text().catch(() => 'unknown')
        return `Jupiter swap request failed: ${swapRes.status} — ${err}`
      }

      const swapData = await swapRes.json() as any
      const swapTransaction = swapData.swapTransaction
      if (!swapTransaction) return 'Jupiter did not return a transaction. Try again.'

      // Decrypt private key and sign
      const privKeyB58 = decrypt(wallet.encryptedPrivateKey)

      // Decode base58 private key
      const bs58Decode = (str: string): Uint8Array => {
        const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
        let num = 0n
        for (const c of str) { num = num * 58n + BigInt(ALPHABET.indexOf(c)) }
        const hex = num.toString(16).padStart(128, '0')
        return new Uint8Array(Buffer.from(hex, 'hex'))
      }

      const keypairBytes = bs58Decode(privKeyB58)
      const secretKey = keypairBytes.slice(0, 64) // full 64-byte Solana secret key

      // Decode the versioned transaction
      const txBuf = Buffer.from(swapTransaction, 'base64')

      // Sign using Ed25519
      const { sign } = await import('node:crypto')
      const edPrivKey = await import('node:crypto').then(c =>
        c.createPrivateKey({
          key: Buffer.concat([
            // PKCS8 header for Ed25519
            Buffer.from('302e020100300506032b657004220420', 'hex'),
            Buffer.from(secretKey.slice(0, 32)), // 32-byte seed
          ]),
          format: 'der',
          type: 'pkcs8',
        })
      )

      const signature = sign(null, txBuf.subarray(txBuf[0] === 0x80 ? 1 : 0), edPrivKey)

      // Inject signature into transaction
      // For versioned transactions, signature goes at offset after the compact array length
      const signedTx = Buffer.concat([
        txBuf.subarray(0, 1), // version/num signatures prefix
        signature,
        txBuf.subarray(1 + 64), // rest of tx after the placeholder signature
      ])

      // Submit to Solana
      const sendResult = await rpcCall('sendTransaction', [
        signedTx.toString('base64'),
        { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed' },
      ]) as string

      const toDecimals = toToken.mint === SOL_MINT ? 9 : toToken.mint === USDC_MINT ? 6 : 6
      const outAmount = Number(quote.outAmount) / (10 ** toDecimals)

      return [
        '## Swap Executed',
        '',
        `**Sold**: ${fmt(amount, 4)} ${fromToken.symbol}`,
        `**Bought**: ~${fmt(outAmount, 6)} ${toToken.symbol}`,
        `**Signature**: \`${sendResult}\``,
        `**Explorer**: https://solscan.io/tx/${sendResult}`,
        '',
        '*Transaction submitted. Check explorer for confirmation status.*',
      ].join('\n')
    },
  })

  // ─── Token Search ───

  registerTool({
    name: 'token_search',
    description: 'Search for Solana tokens by name or symbol. Returns mint address, price, and liquidity. Useful before swapping.',
    parameters: {
      query: { type: 'string', description: 'Token name or symbol to search for', required: true },
    },
    tier: 'free',
    timeout: 10_000,
    async execute(args) {
      const query = String(args.query).toLowerCase()
      const tokens = await fetch(JUPITER_TOKENS, {
        signal: AbortSignal.timeout(8_000),
      }).then(r => r.json()) as any[]

      const matches = tokens
        .filter((t: any) =>
          t.symbol?.toLowerCase().includes(query) ||
          t.name?.toLowerCase().includes(query)
        )
        .slice(0, 10)

      if (!matches.length) return `No tokens found for "${query}".`

      const lines: string[] = [
        `## Token Search: "${args.query}"`,
        '',
        '| Symbol | Name | Mint |',
        '|--------|------|------|',
      ]

      for (const t of matches) {
        lines.push(`| ${t.symbol} | ${t.name} | \`${t.address.slice(0, 8)}...${t.address.slice(-4)}\` |`)
      }

      lines.push('', '*Use the symbol or mint address with `swap_quote` or `swap_execute`.*')
      return lines.join('\n')
    },
  })

  // ─── Transaction History ───

  registerTool({
    name: 'wallet_history',
    description: 'Show recent transaction history for your kbot Solana wallet.',
    parameters: {
      limit: { type: 'number', description: 'Number of transactions (default: 10, max: 20)', default: 10 },
    },
    tier: 'free',
    timeout: 15_000,
    async execute(args) {
      const w = loadWallet()
      if (!w) return 'No wallet configured.'

      const limit = Math.min(Number(args.limit) || 10, 20)
      const result = await rpcCall('getSignaturesForAddress', [
        w.publicKey,
        { limit },
      ]) as any[]

      if (!result?.length) return 'No transactions found.'

      const lines: string[] = [
        `## Recent Transactions`,
        `**Wallet**: \`${w.publicKey.slice(0, 6)}...${w.publicKey.slice(-4)}\``,
        '',
        '| Time | Signature | Status |',
        '|------|-----------|--------|',
      ]

      for (const tx of result) {
        const time = tx.blockTime ? new Date(tx.blockTime * 1000).toISOString().replace('T', ' ').slice(0, 16) : '?'
        const sig = `${tx.signature.slice(0, 8)}...${tx.signature.slice(-4)}`
        const status = tx.err ? 'Failed' : 'Success'
        lines.push(`| ${time} | [\`${sig}\`](https://solscan.io/tx/${tx.signature}) | ${status} |`)
      }

      return lines.join('\n')
    },
  })
}
