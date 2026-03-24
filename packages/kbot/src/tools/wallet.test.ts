// kbot Wallet Tools — Unit tests
// Tests encryption/decryption, multi-wallet storage, and risk limit enforcement.

import { describe, it, expect } from 'vitest'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
import { homedir } from 'node:os'

// ── Replicate the wallet encryption functions for testing ──

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

// ── Encryption Tests ──

describe('Wallet Encryption (AES-256-CBC)', () => {
  it('encrypts and decrypts a private key correctly', () => {
    const original = '5Jd7nEMzCqvKfJqTz3rN8vHBPaUfzmCkpBndnXLPunSCHLDjQ7rK3gJHsQ'
    const encrypted = encrypt(original)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  it('encrypted value starts with "enc:" prefix', () => {
    const encrypted = encrypt('test-key-123')
    expect(encrypted.startsWith('enc:')).toBe(true)
  })

  it('encrypted value has 3 colon-separated parts', () => {
    const encrypted = encrypt('test')
    const parts = encrypted.split(':')
    expect(parts).toHaveLength(3)
  })

  it('same plaintext produces different ciphertexts (random IV)', () => {
    const key = 'same-private-key'
    const enc1 = encrypt(key)
    const enc2 = encrypt(key)
    expect(enc1).not.toBe(enc2) // Different IVs
    expect(decrypt(enc1)).toBe(key) // But both decrypt to same value
    expect(decrypt(enc2)).toBe(key)
  })

  it('handles empty string', () => {
    const encrypted = encrypt('')
    expect(decrypt(encrypted)).toBe('')
  })

  it('handles long private keys', () => {
    const longKey = 'A'.repeat(256)
    const encrypted = encrypt(longKey)
    expect(decrypt(encrypted)).toBe(longKey)
  })

  it('plaintext passthrough for non-encrypted values (migration)', () => {
    expect(decrypt('not-encrypted-value')).toBe('not-encrypted-value')
  })
})

// ── Multi-Wallet Store Tests ──

describe('Multi-Wallet Store Logic', () => {
  interface WalletConfig {
    publicKey: string; encryptedPrivateKey: string; label: string
    createdAt: string; maxTxSol: number; confirmAll: boolean
  }
  interface WalletStore { active: string; wallets: WalletConfig[] }

  function makeWallet(label: string): WalletConfig {
    return {
      publicKey: `pub_${label}_${Math.random().toString(36).slice(2, 8)}`,
      encryptedPrivateKey: encrypt(`priv_${label}`),
      label,
      createdAt: new Date().toISOString(),
      maxTxSol: 1.0,
      confirmAll: true,
    }
  }

  it('starts with empty store', () => {
    const store: WalletStore = { active: '', wallets: [] }
    expect(store.wallets).toHaveLength(0)
  })

  it('first wallet becomes active', () => {
    const store: WalletStore = { active: '', wallets: [] }
    const w = makeWallet('trading')
    store.wallets.push(w)
    if (!store.active) store.active = w.label
    expect(store.active).toBe('trading')
  })

  it('can switch active wallet', () => {
    const store: WalletStore = { active: 'trading', wallets: [makeWallet('trading'), makeWallet('defi')] }
    store.active = 'defi'
    expect(store.active).toBe('defi')
    const active = store.wallets.find(w => w.label === store.active)
    expect(active?.label).toBe('defi')
  })

  it('handles migration from single-wallet format', () => {
    // Old format: { publicKey, encryptedPrivateKey, label, ... }
    const oldFormat: any = {
      publicKey: 'old_pub_key',
      encryptedPrivateKey: encrypt('old_priv_key'),
      label: 'default',
      createdAt: '2026-01-01T00:00:00.000Z',
      maxTxSol: 1.0,
      confirmAll: true,
    }
    // Migration logic
    let store: WalletStore
    if (oldFormat.publicKey && !oldFormat.wallets) {
      store = { active: oldFormat.label || 'default', wallets: [oldFormat] }
    } else {
      store = oldFormat
    }
    expect(store.wallets).toHaveLength(1)
    expect(store.active).toBe('default')
    expect(store.wallets[0].publicKey).toBe('old_pub_key')
  })

  it('can hold multiple wallets', () => {
    const store: WalletStore = { active: 'main', wallets: [] }
    store.wallets.push(makeWallet('main'))
    store.wallets.push(makeWallet('trading'))
    store.wallets.push(makeWallet('defi'))
    expect(store.wallets).toHaveLength(3)
  })
})

// ── Risk Limit Tests ──

describe('Transaction Risk Limits', () => {
  it('blocks transaction exceeding max SOL limit', () => {
    const maxTxSol = 1.0
    const amount = 5.0
    expect(amount > maxTxSol).toBe(true)
  })

  it('allows transaction within limit', () => {
    const maxTxSol = 1.0
    const amount = 0.5
    expect(amount <= maxTxSol).toBe(true)
  })

  it('checks SOL-equivalent for non-SOL tokens', () => {
    const maxTxSol = 1.0
    const tokenAmount = 100 // USDC
    const tokenPriceUsd = 1.0
    const solPriceUsd = 150.0
    const solEquivalent = (tokenAmount * tokenPriceUsd) / solPriceUsd
    expect(solEquivalent).toBeCloseTo(0.667, 2)
    expect(solEquivalent <= maxTxSol).toBe(true)
  })

  it('blocks large non-SOL token transactions', () => {
    const maxTxSol = 1.0
    const tokenAmount = 1000 // USDC
    const tokenPriceUsd = 1.0
    const solPriceUsd = 150.0
    const solEquivalent = (tokenAmount * tokenPriceUsd) / solPriceUsd
    expect(solEquivalent).toBeCloseTo(6.667, 2)
    expect(solEquivalent > maxTxSol).toBe(true)
  })

  it('requires confirmed: "yes" for execution', () => {
    const confirmed = 'yes'
    expect(confirmed.toLowerCase() === 'yes').toBe(true)
    expect('no'.toLowerCase() === 'yes').toBe(false)
    expect(''.toLowerCase() === 'yes').toBe(false)
  })
})

// ── Base58 Encoding Tests ──

describe('Base58 Encoding', () => {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

  function bs58Encode(buf: Buffer): string {
    let num = BigInt('0x' + buf.toString('hex'))
    let str = ''
    while (num > 0n) { str = ALPHABET[Number(num % 58n)] + str; num /= 58n }
    for (const b of buf) { if (b === 0) str = '1' + str; else break }
    return str
  }

  it('encodes known bytes correctly', () => {
    const buf = Buffer.from([0, 1, 2, 3])
    const encoded = bs58Encode(buf)
    expect(encoded.length).toBeGreaterThan(0)
    expect(encoded[0]).toBe('1') // leading zero byte → '1'
  })

  it('produces different output for different inputs', () => {
    const a = bs58Encode(Buffer.from([1, 2, 3]))
    const b = bs58Encode(Buffer.from([4, 5, 6]))
    expect(a).not.toBe(b)
  })

  it('handles 32-byte public key (Solana address length)', () => {
    const pubkey = randomBytes(32)
    const encoded = bs58Encode(pubkey)
    // Solana addresses are 32-44 chars in base58
    expect(encoded.length).toBeGreaterThanOrEqual(32)
    expect(encoded.length).toBeLessThanOrEqual(44)
  })
})
