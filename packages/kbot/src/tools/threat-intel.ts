// kbot Threat Intelligence Tools — Cyber threat intelligence for defenders
// Inspired by Iran cyber operations (coordinated DDoS, defacement, hack-and-leak)
// and Zen-AI-Pentest AI-guided tool orchestration.
//
// Tools:
//   1. threat_feed     — Aggregate CVEs, exploits, and threat news from free sources
//   2. ioc_check       — Check IPs, domains, hashes, URLs against threat intel databases
//   3. attack_surface_scan — Passive reconnaissance via DNS, headers, SSL
//   4. incident_response   — AI-guided incident response playbook generation (Ollama)
//   5. threat_model        — STRIDE threat modeling with AI analysis (Ollama)
//
// All tools use free/public APIs only. No paid keys required.
// Uses Node.js built-in modules + global fetch. No external deps.

import { registerTool } from './index.js'
import { Resolver } from 'node:dns/promises'
import { connect as tlsConnect } from 'node:tls'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const OLLAMA_URL = 'http://localhost:11434'
const OLLAMA_TIMEOUT = 90_000
const OLLAMA_MODEL = 'kernel-coder:latest'
const FETCH_TIMEOUT = 15_000

// Severity weights for scoring
const SEVERITY_WEIGHT: Record<string, number> = {
  CRITICAL: 10, HIGH: 7, MEDIUM: 4, LOW: 1, NONE: 0,
}

// Security header expectations
const EXPECTED_HEADERS: Record<string, { required: boolean; description: string }> = {
  'strict-transport-security': { required: true, description: 'Enforces HTTPS connections (HSTS)' },
  'content-security-policy': { required: true, description: 'Prevents XSS and injection attacks' },
  'x-frame-options': { required: true, description: 'Prevents clickjacking attacks' },
  'x-content-type-options': { required: true, description: 'Prevents MIME-type sniffing' },
  'referrer-policy': { required: true, description: 'Controls referrer information leakage' },
  'permissions-policy': { required: false, description: 'Controls browser feature access' },
  'x-xss-protection': { required: false, description: 'Legacy XSS filter (deprecated but still checked)' },
  'cross-origin-opener-policy': { required: false, description: 'Isolates browsing context' },
  'cross-origin-embedder-policy': { required: false, description: 'Controls cross-origin embedding' },
  'cross-origin-resource-policy': { required: false, description: 'Controls cross-origin resource loading' },
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** Safe HTTP fetch with timeout */
async function safeFetch(url: string, options?: RequestInit & { timeout?: number }): Promise<Response | null> {
  try {
    const timeout = options?.timeout ?? FETCH_TIMEOUT
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch {
    return null
  }
}

/** Safe JSON fetch */
async function fetchJson<T = unknown>(url: string, options?: RequestInit & { timeout?: number }): Promise<T | null> {
  const res = await safeFetch(url, options)
  if (!res?.ok) return null
  try {
    return await res.json() as T
  } catch {
    return null
  }
}

/** Safe text fetch */
async function fetchText(url: string, options?: RequestInit & { timeout?: number }): Promise<string | null> {
  const res = await safeFetch(url, options)
  if (!res?.ok) return null
  try {
    return await res.text()
  } catch {
    return null
  }
}

/** Ask Ollama for AI analysis — returns null if unavailable */
async function ollamaGenerate(prompt: string, model = OLLAMA_MODEL): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT)
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 2048 },
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = await res.json() as { response?: string }
    return data.response?.trim() || null
  } catch {
    return null
  }
}

/** Check if Ollama is running */
async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

/** Get dream journal insights for tech stack matching */
function getDreamInsights(): string[] {
  try {
    const dreamPath = join(homedir(), '.kbot', 'dreams', 'journal.json')
    if (!existsSync(dreamPath)) return []
    const data = JSON.parse(readFileSync(dreamPath, 'utf-8'))
    if (Array.isArray(data.insights)) {
      return data.insights
        .filter((i: { type?: string }) => i.type === 'tech_stack' || i.type === 'dependency')
        .map((i: { content?: string }) => String(i.content || '').toLowerCase())
    }
    return []
  } catch {
    return []
  }
}

/** Parse CVSS score to severity */
function cvssToSeverity(score: number): string {
  if (score >= 9.0) return 'CRITICAL'
  if (score >= 7.0) return 'HIGH'
  if (score >= 4.0) return 'MEDIUM'
  if (score > 0.0) return 'LOW'
  return 'NONE'
}

/** Format date as ISO date string */
function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

/** DNS resolve with timeout wrapper */
async function dnsResolve(resolver: Resolver, hostname: string, type: string): Promise<string[]> {
  try {
    const result = await Promise.race([
      resolver.resolve(hostname, type as 'A'),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS timeout')), 8000)),
    ])
    if (Array.isArray(result)) {
      return result.map(r => typeof r === 'string' ? r : JSON.stringify(r))
    }
    return []
  } catch {
    return []
  }
}

/** Get TLS certificate info for a hostname */
function getTlsCertInfo(hostname: string, port = 443): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 10_000)
    try {
      const socket = tlsConnect({ host: hostname, port, servername: hostname, rejectUnauthorized: false }, () => {
        clearTimeout(timer)
        const cert = socket.getPeerCertificate()
        socket.destroy()
        if (!cert || !cert.subject) {
          resolve(null)
          return
        }
        resolve({
          subject: cert.subject,
          issuer: cert.issuer,
          valid_from: cert.valid_from,
          valid_to: cert.valid_to,
          serial: cert.serialNumber,
          fingerprint: cert.fingerprint256 || cert.fingerprint,
          bits: cert.bits,
          subjectaltname: cert.subjectaltname,
        })
      })
      socket.on('error', () => { clearTimeout(timer); resolve(null) })
    } catch {
      clearTimeout(timer)
      resolve(null)
    }
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool 1: threat_feed — Aggregate Threat Intelligence
// ═══════════════════════════════════════════════════════════════════════════════

interface NvdCve {
  id: string
  sourceIdentifier?: string
  published: string
  lastModified: string
  descriptions: Array<{ lang: string; value: string }>
  metrics?: {
    cvssMetricV31?: Array<{
      cvssData: { baseScore: number; baseSeverity: string; vectorString: string }
    }>
    cvssMetricV2?: Array<{
      cvssData: { baseScore: number }
    }>
  }
  configurations?: Array<{
    nodes: Array<{
      cpeMatch: Array<{
        criteria: string
        vulnerable: boolean
        versionEndIncluding?: string
        versionStartIncluding?: string
      }>
    }>
  }>
}

interface NvdResponse {
  totalResults: number
  vulnerabilities: Array<{ cve: NvdCve }>
}

async function fetchRecentCves(days = 7): Promise<Array<{
  id: string
  description: string
  score: number
  severity: string
  published: string
  affected: string[]
}>> {
  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)

  const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?` +
    `pubStartDate=${start.toISOString()}&pubEndDate=${end.toISOString()}` +
    `&cvssV3Severity=HIGH&resultsPerPage=20`

  const data = await fetchJson<NvdResponse>(url, { timeout: 20_000 })
  if (!data?.vulnerabilities) return []

  return data.vulnerabilities.map(v => {
    const cve = v.cve
    const desc = cve.descriptions.find(d => d.lang === 'en')?.value || 'No description'
    const cvss31 = cve.metrics?.cvssMetricV31?.[0]?.cvssData
    const cvss2 = cve.metrics?.cvssMetricV2?.[0]?.cvssData
    const score = cvss31?.baseScore ?? cvss2?.baseScore ?? 0
    const severity = cvss31?.baseSeverity ?? cvssToSeverity(score)

    // Extract affected software from CPE matches
    const affected: string[] = []
    for (const config of cve.configurations || []) {
      for (const node of config.nodes) {
        for (const match of node.cpeMatch) {
          if (match.vulnerable) {
            // CPE format: cpe:2.3:a:vendor:product:version:...
            const parts = match.criteria.split(':')
            if (parts.length >= 5) {
              affected.push(`${parts[3]}/${parts[4]}`)
            }
          }
        }
      }
    }

    return {
      id: cve.id,
      description: desc.length > 200 ? desc.slice(0, 200) + '...' : desc,
      score,
      severity: severity.toUpperCase(),
      published: cve.published.split('T')[0],
      affected: Array.from(new Set(affected)).slice(0, 5),
    }
  }).sort((a, b) => b.score - a.score)
}

async function fetchExploitDbRecent(): Promise<Array<{
  title: string
  date: string
  type: string
  platform: string
}>> {
  // Exploit-DB RSS via their Atom/RSS feed or GitLab mirror
  const url = 'https://gitlab.com/exploit-database/exploitdb/-/raw/main/files_exploits.csv'
  const text = await fetchText(url, { timeout: 20_000 })
  if (!text) return []

  // Parse CSV — last N entries (most recent at bottom)
  const lines = text.trim().split('\n')
  const recent: Array<{ title: string; date: string; type: string; platform: string }> = []
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // Process last 200 lines for recency
  for (const line of lines.slice(-200)) {
    const cols = line.split(',')
    if (cols.length < 5) continue
    const dateStr = cols[3]?.replace(/"/g, '').trim()
    const date = new Date(dateStr)
    if (isNaN(date.getTime()) || date < cutoff) continue

    recent.push({
      title: cols[2]?.replace(/"/g, '').trim() || 'Unknown',
      date: isoDate(date),
      type: cols[5]?.replace(/"/g, '').trim() || 'Unknown',
      platform: cols[6]?.replace(/"/g, '').trim() || 'Unknown',
    })
  }

  return recent.slice(-10).reverse()
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool 2: ioc_check — Indicator of Compromise Checking
// ═══════════════════════════════════════════════════════════════════════════════

interface AbuseIpdbResponse {
  data?: {
    ipAddress: string
    isPublic: boolean
    abuseConfidenceScore: number
    countryCode: string
    isp: string
    totalReports: number
    lastReportedAt: string
    usageType: string
  }
}

interface UrlhausResponse {
  query_status: string
  urlhaus_reference?: string
  threat?: string
  url_status?: string
  host?: string
  tags?: string[]
  blacklists?: Record<string, string>
}

interface UrlhausHostResponse {
  query_status: string
  urlhaus_reference?: string
  host?: string
  url_count?: number
  urls_online?: number
  blacklists?: Record<string, string>
  urls?: Array<{
    url: string
    url_status: string
    threat: string
    tags: string[]
    date_added: string
    filename?: string
  }>
}

interface UrlhausPayloadResponse {
  query_status: string
  md5_hash?: string
  sha256_hash?: string
  file_type?: string
  file_size?: number
  signature?: string
  firstseen?: string
  lastseen?: string
  url_count?: number
  urls?: Array<{
    url: string
    url_status: string
    filename: string
  }>
}

/** Classify IOC type */
function classifyIoc(value: string): 'ip' | 'domain' | 'hash_md5' | 'hash_sha256' | 'hash_sha1' | 'url' | 'unknown' {
  // URL
  if (/^https?:\/\//.test(value)) return 'url'
  // IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) return 'ip'
  // IPv6
  if (/^[0-9a-fA-F:]+$/.test(value) && value.includes(':') && value.length > 7) return 'ip'
  // SHA-256
  if (/^[0-9a-fA-F]{64}$/.test(value)) return 'hash_sha256'
  // SHA-1
  if (/^[0-9a-fA-F]{40}$/.test(value)) return 'hash_sha1'
  // MD5
  if (/^[0-9a-fA-F]{32}$/.test(value)) return 'hash_md5'
  // Domain
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(value)) return 'domain'
  return 'unknown'
}

/** Check IP against AbuseIPDB (free API — rate limited, no key version) */
async function checkAbuseIpdb(ip: string): Promise<{ source: string; data: Record<string, unknown> } | null> {
  // AbuseIPDB requires an API key, but we can use their public check page
  // For truly free checking, we use URLhaus + VirusTotal public
  // We'll attempt AbuseIPDB if the user has configured a key
  const configPath = join(homedir(), '.kbot', 'config.json')
  let apiKey: string | undefined
  try {
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      apiKey = config.abuseipdb_key || config.ABUSEIPDB_KEY
    }
  } catch { /* no config */ }

  if (apiKey) {
    const data = await fetchJson<AbuseIpdbResponse>(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`,
      { headers: { Key: apiKey, Accept: 'application/json' }, timeout: 10_000 },
    )
    if (data?.data) {
      return {
        source: 'AbuseIPDB',
        data: {
          ip: data.data.ipAddress,
          abuse_score: data.data.abuseConfidenceScore,
          country: data.data.countryCode,
          isp: data.data.isp,
          reports: data.data.totalReports,
          last_reported: data.data.lastReportedAt,
          usage: data.data.usageType,
        },
      }
    }
  }
  return null
}

/** Check domain/IP against URLhaus (free, no API key) */
async function checkUrlhaus(value: string, type: 'ip' | 'domain' | 'url' | 'hash_md5' | 'hash_sha256' | 'hash_sha1'): Promise<{ source: string; data: Record<string, unknown> } | null> {
  let endpoint: string
  let body: string

  if (type === 'url') {
    endpoint = 'https://urlhaus-api.abuse.ch/v1/url/'
    body = `url=${encodeURIComponent(value)}`
  } else if (type === 'ip' || type === 'domain') {
    endpoint = 'https://urlhaus-api.abuse.ch/v1/host/'
    body = `host=${encodeURIComponent(value)}`
  } else {
    // Hash lookup
    endpoint = 'https://urlhaus-api.abuse.ch/v1/payload/'
    const hashType = type === 'hash_md5' ? 'md5_hash' : 'sha256_hash'
    body = `${hashType}=${encodeURIComponent(value)}`
  }

  const res = await safeFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    timeout: 10_000,
  })
  if (!res?.ok) return null

  try {
    const data = await res.json() as UrlhausResponse & UrlhausHostResponse & UrlhausPayloadResponse
    if (data.query_status === 'no_results') return null

    const result: Record<string, unknown> = { status: data.query_status }

    if (type === 'url') {
      result.threat = data.threat || 'unknown'
      result.url_status = data.url_status
      result.tags = data.tags || []
      result.blacklists = data.blacklists
      result.reference = data.urlhaus_reference
    } else if (type === 'ip' || type === 'domain') {
      result.url_count = data.url_count
      result.urls_online = data.urls_online
      result.blacklists = data.blacklists
      result.reference = data.urlhaus_reference
      if (data.urls && data.urls.length > 0) {
        result.recent_threats = data.urls.slice(0, 5).map(u => ({
          url: u.url,
          threat: u.threat,
          status: u.url_status,
          tags: u.tags,
          date: u.date_added,
        }))
      }
    } else {
      // Payload/hash
      result.file_type = data.file_type
      result.file_size = data.file_size
      result.signature = data.signature
      result.first_seen = data.firstseen
      result.last_seen = data.lastseen
      result.url_count = data.url_count
      if (data.urls && data.urls.length > 0) {
        result.distribution_urls = data.urls.slice(0, 5).map(u => ({
          url: u.url,
          status: u.url_status,
          filename: u.filename,
        }))
      }
    }

    return { source: 'URLhaus (abuse.ch)', data: result }
  } catch {
    return null
  }
}

/** Check hash against VirusTotal (free public API — requires key, optional) */
async function checkVirusTotal(value: string, type: 'hash_md5' | 'hash_sha256' | 'hash_sha1' | 'domain' | 'ip' | 'url'): Promise<{ source: string; data: Record<string, unknown> } | null> {
  const configPath = join(homedir(), '.kbot', 'config.json')
  let apiKey: string | undefined
  try {
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      apiKey = config.virustotal_key || config.VIRUSTOTAL_KEY || config.vt_key || config.VT_KEY
    }
  } catch { /* no config */ }

  if (!apiKey) return null

  let endpoint: string
  if (type.startsWith('hash_')) {
    endpoint = `https://www.virustotal.com/api/v3/files/${value}`
  } else if (type === 'domain') {
    endpoint = `https://www.virustotal.com/api/v3/domains/${value}`
  } else if (type === 'ip') {
    endpoint = `https://www.virustotal.com/api/v3/ip_addresses/${value}`
  } else {
    // URL — needs base64 encoding
    const urlId = Buffer.from(value).toString('base64url')
    endpoint = `https://www.virustotal.com/api/v3/urls/${urlId}`
  }

  const data = await fetchJson<{ data?: { attributes?: Record<string, unknown> } }>(endpoint, {
    headers: { 'x-apikey': apiKey },
    timeout: 10_000,
  })

  if (!data?.data?.attributes) return null

  const attrs = data.data.attributes
  const result: Record<string, unknown> = {}

  if (type.startsWith('hash_')) {
    const stats = attrs.last_analysis_stats as Record<string, number> | undefined
    result.detections = stats?.malicious ?? 0
    result.total_engines = Object.values(stats || {}).reduce((a: number, b: number) => a + b, 0)
    result.detection_rate = stats ? `${stats.malicious || 0}/${result.total_engines}` : 'unknown'
    result.file_type = attrs.type_description
    result.file_size = attrs.size
    result.names = (attrs.names as string[] | undefined)?.slice(0, 5)
    result.reputation = attrs.reputation
    result.tags = (attrs.tags as string[] | undefined)?.slice(0, 10)
  } else if (type === 'domain' || type === 'ip') {
    const stats = attrs.last_analysis_stats as Record<string, number> | undefined
    result.malicious = stats?.malicious ?? 0
    result.suspicious = stats?.suspicious ?? 0
    result.harmless = stats?.harmless ?? 0
    result.reputation = attrs.reputation
    result.as_owner = attrs.as_owner
    result.country = attrs.country
    result.tags = (attrs.tags as string[] | undefined)?.slice(0, 10)
  } else {
    const stats = attrs.last_analysis_stats as Record<string, number> | undefined
    result.malicious = stats?.malicious ?? 0
    result.total_engines = Object.values(stats || {}).reduce((a: number, b: number) => a + b, 0)
    result.threat_names = (attrs.threat_names as string[] | undefined)?.slice(0, 5)
    result.tags = (attrs.tags as string[] | undefined)?.slice(0, 10)
  }

  return { source: 'VirusTotal', data: result }
}

/** Check hash/domain against ThreatFox (free, no key) */
async function checkThreatFox(value: string, type: string): Promise<{ source: string; data: Record<string, unknown> } | null> {
  let searchType: string
  if (type === 'hash_md5') searchType = 'hash'
  else if (type === 'hash_sha256') searchType = 'hash'
  else if (type === 'domain') searchType = 'domain'
  else if (type === 'ip') searchType = 'ip:port'
  else return null

  const body = JSON.stringify({
    query: 'search_ioc',
    search_term: type === 'ip' ? `${value}:` : value,
  })

  const res = await safeFetch('https://threatfox-api.abuse.ch/api/v1/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    timeout: 10_000,
  })
  if (!res?.ok) return null

  try {
    const data = await res.json() as {
      query_status: string
      data?: Array<{
        ioc: string
        threat_type: string
        malware: string
        confidence_level: number
        first_seen: string
        last_seen: string
        tags: string[]
        reference: string
      }>
    }
    if (data.query_status !== 'ok' || !data.data?.length) return null

    return {
      source: 'ThreatFox (abuse.ch)',
      data: {
        matches: data.data.slice(0, 5).map(entry => ({
          ioc: entry.ioc,
          threat_type: entry.threat_type,
          malware: entry.malware,
          confidence: entry.confidence_level,
          first_seen: entry.first_seen,
          last_seen: entry.last_seen,
          tags: entry.tags,
        })),
      },
    }
  } catch {
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool 3: attack_surface_scan helpers
// ═══════════════════════════════════════════════════════════════════════════════

interface DnsResults {
  A: string[]
  AAAA: string[]
  MX: string[]
  NS: string[]
  TXT: string[]
  CNAME: string[]
  SOA: string[]
}

async function enumerateDns(hostname: string): Promise<DnsResults> {
  const resolver = new Resolver()
  resolver.setServers(['1.1.1.1', '8.8.8.8'])

  const [A, AAAA, MX, NS, TXT, CNAME, SOA] = await Promise.all([
    dnsResolve(resolver, hostname, 'A'),
    dnsResolve(resolver, hostname, 'AAAA'),
    dnsResolve(resolver, hostname, 'MX'),
    dnsResolve(resolver, hostname, 'NS'),
    dnsResolve(resolver, hostname, 'TXT'),
    dnsResolve(resolver, hostname, 'CNAME'),
    dnsResolve(resolver, hostname, 'SOA'),
  ])

  return { A, AAAA, MX, NS, TXT, CNAME, SOA }
}

async function checkHttpHeaders(url: string): Promise<{
  headers: Record<string, string>
  missing: string[]
  present: string[]
  score: number
  server: string | null
  poweredBy: string | null
}> {
  const res = await safeFetch(url, {
    method: 'HEAD',
    timeout: 10_000,
    redirect: 'follow',
  })

  if (!res) return { headers: {}, missing: [], present: [], score: 0, server: null, poweredBy: null }

  const headers: Record<string, string> = {}
  res.headers.forEach((value, key) => { headers[key.toLowerCase()] = value })

  const missing: string[] = []
  const present: string[] = []

  for (const [header, config] of Object.entries(EXPECTED_HEADERS)) {
    if (headers[header]) {
      present.push(header)
    } else if (config.required) {
      missing.push(header)
    }
  }

  // Score: each required header present = 20 points (5 required = 100 max)
  const requiredCount = Object.entries(EXPECTED_HEADERS).filter(([, c]) => c.required).length
  const presentRequired = present.filter(h => EXPECTED_HEADERS[h]?.required).length
  const score = Math.round((presentRequired / requiredCount) * 100)

  return {
    headers,
    missing,
    present,
    score,
    server: headers['server'] || null,
    poweredBy: headers['x-powered-by'] || null,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool 4 & 5: Incident Response & Threat Model templates
// ═══════════════════════════════════════════════════════════════════════════════

const INCIDENT_TYPES: Record<string, {
  containment: string[]
  eradication: string[]
  recovery: string[]
  indicators: string[]
}> = {
  ransomware: {
    containment: [
      'Isolate infected systems from the network immediately',
      'Disable affected user accounts',
      'Block C2 domains and IPs at firewall/proxy',
      'Preserve forensic evidence before cleanup (memory dumps, disk images)',
      'Identify the ransomware variant (check ID Ransomware, No More Ransom)',
      'Notify legal, executive leadership, and insurance carrier',
    ],
    eradication: [
      'Identify initial infection vector (phishing email, RDP, vulnerability)',
      'Remove ransomware binaries and persistence mechanisms',
      'Patch the vulnerability or close the access path that was exploited',
      'Scan all endpoints with updated AV/EDR signatures',
      'Check for lateral movement — scan for other compromised systems',
      'Reset all credentials that may have been exposed',
    ],
    recovery: [
      'Restore from clean, verified backups (test backup integrity first)',
      'Rebuild systems from known-good images if backups are suspect',
      'Gradually reconnect systems to network with monitoring',
      'Verify data integrity post-restoration',
      'Monitor for re-infection for 72+ hours',
      'Update firewall rules and endpoint protections',
    ],
    indicators: [
      'File encryption with unusual extensions',
      'Ransom notes on desktop or in directories',
      'Mass file modification timestamps',
      'Unusual process execution (PowerShell, wmic, certutil)',
      'Network connections to Tor or known C2 infrastructure',
    ],
  },
  data_breach: {
    containment: [
      'Identify scope: what data was accessed, how much, whose data',
      'Revoke compromised credentials and API keys immediately',
      'Block attacker IP addresses and suspicious sessions',
      'Enable enhanced logging on all affected systems',
      'Preserve logs and evidence (do not rotate or delete)',
      'Engage legal counsel — assess notification requirements (GDPR 72h, CCPA, HIPAA)',
    ],
    eradication: [
      'Close the access path (patch vulnerability, fix misconfiguration)',
      'Remove any backdoors or persistent access mechanisms',
      'Rotate all secrets, tokens, and certificates on affected systems',
      'Audit access control lists and permissions',
      'Review and harden authentication mechanisms',
      'Scan for exfiltration tools or staged data',
    ],
    recovery: [
      'Implement additional monitoring on affected data stores',
      'Notify affected individuals per legal requirements',
      'Offer credit monitoring if PII was exposed',
      'File regulatory notifications within required timeframes',
      'Conduct thorough access review across all systems',
      'Implement data loss prevention (DLP) controls',
    ],
    indicators: [
      'Unusual database queries or large data exports',
      'Unauthorized access to sensitive file shares',
      'Anomalous outbound data transfers',
      'Login attempts from unusual locations or times',
      'New user accounts or privilege escalation events',
    ],
  },
  ddos: {
    containment: [
      'Enable DDoS mitigation (Cloudflare, AWS Shield, Akamai)',
      'Rate limit at load balancer and application level',
      'Implement geographic blocking if attack is from specific regions',
      'Scale infrastructure horizontally if cloud-based',
      'Enable syn cookies and connection limiting',
      'Communicate with ISP/hosting provider for upstream filtering',
    ],
    eradication: [
      'Identify attack vectors (volumetric, protocol, application layer)',
      'Block attack source IPs/ranges at network edge',
      'Implement CAPTCHA or proof-of-work for application-layer attacks',
      'Deploy web application firewall (WAF) rules for HTTP floods',
      'Analyze traffic patterns to create targeted filters',
      'Check for amplification/reflection sources',
    ],
    recovery: [
      'Gradually remove emergency blocking rules (avoid over-blocking)',
      'Monitor for renewed attacks for 48+ hours',
      'Document attack timeline, vectors, and mitigation effectiveness',
      'Implement permanent anti-DDoS architecture improvements',
      'Set up automated alerting for similar traffic patterns',
      'Conduct capacity planning based on attack volume',
    ],
    indicators: [
      'Massive spike in inbound traffic volume',
      'Server resource exhaustion (CPU, memory, connections)',
      'Unusual source IP distribution',
      'High volume of malformed packets',
      'Application timeout errors spike',
    ],
  },
  insider_threat: {
    containment: [
      'Disable suspected insider access WITHOUT alerting them (coordinate with HR/Legal)',
      'Preserve all access logs and audit trails',
      'Monitor (do not block) communications if legally permitted',
      'Secure any physical access they have to infrastructure',
      'Inventory what data and systems they have accessed',
      'Enable enhanced monitoring on their usual access patterns',
    ],
    eradication: [
      'Revoke all credentials, tokens, VPN access, and SSH keys',
      'Remove from all groups, distribution lists, and shared drives',
      'Change shared secrets or keys they had access to',
      'Review their code commits and infrastructure changes',
      'Check for time-bombs, backdoors, or logic bombs in code',
      'Audit any third-party accounts or services they configured',
    ],
    recovery: [
      'Implement least-privilege access review for all similar roles',
      'Enable user behavior analytics (UBA/UEBA)',
      'Implement data classification and access controls',
      'Review and improve separation of duties',
      'Update off-boarding procedures and access revocation checklists',
      'Conduct organization-wide access audit',
    ],
    indicators: [
      'Access to data outside normal job function',
      'Large file downloads or emails to personal accounts',
      'Access at unusual hours',
      'Attempts to access terminated or restricted accounts',
      'Circumvention of security controls',
    ],
  },
  supply_chain: {
    containment: [
      'Identify the compromised component (dependency, update, vendor)',
      'Pin/lock the dependency to last known-good version',
      'Block update servers or package registries temporarily',
      'Scan all deployed instances for the malicious component',
      'Isolate systems running the compromised version',
      'Notify vendor/maintainer of the compromise',
    ],
    eradication: [
      'Remove or downgrade the compromised dependency',
      'Audit all changes from the compromised version',
      'Scan for persistence mechanisms installed by the supply chain attack',
      'Review build pipeline integrity (CI/CD, signing, checksums)',
      'Check if attack included credential harvesting — rotate if so',
      'Verify integrity of all artifacts built during compromised period',
    ],
    recovery: [
      'Rebuild and redeploy from clean, audited sources',
      'Implement dependency pinning and lock files',
      'Set up automated dependency scanning (Dependabot, Snyk)',
      'Implement SLSA or SBOM for build provenance',
      'Establish vendor security review process',
      'Monitor for downstream effects on users/customers',
    ],
    indicators: [
      'Unexpected dependency version changes',
      'New network connections from updated components',
      'Build hash mismatches',
      'Unusual post-install scripts in packages',
      'Typosquatted package names',
    ],
  },
}

const STRIDE_CATEGORIES: Array<{
  id: string
  name: string
  question: string
  examples: string[]
  mitigations: string[]
}> = [
  {
    id: 'S',
    name: 'Spoofing',
    question: 'Can an attacker pretend to be someone or something else?',
    examples: [
      'Authentication bypass or weak authentication',
      'Session hijacking or token theft',
      'IP/DNS spoofing',
      'Phishing attacks using similar domains',
      'API key theft or replay attacks',
    ],
    mitigations: [
      'Strong authentication (MFA, OAuth 2.0, WebAuthn)',
      'Certificate pinning for critical connections',
      'Session management with secure, rotating tokens',
      'DMARC/DKIM/SPF for email',
      'API key rotation and IP allowlisting',
    ],
  },
  {
    id: 'T',
    name: 'Tampering',
    question: 'Can an attacker modify data in transit or at rest?',
    examples: [
      'Man-in-the-middle attacks on unencrypted connections',
      'SQL injection modifying database records',
      'File upload vulnerabilities allowing code injection',
      'Parameter tampering in forms/APIs',
      'Log tampering to hide attacker activity',
    ],
    mitigations: [
      'TLS for all data in transit',
      'Input validation and parameterized queries',
      'Digital signatures for critical data',
      'File integrity monitoring (FIM)',
      'Append-only/immutable logging',
    ],
  },
  {
    id: 'R',
    name: 'Repudiation',
    question: 'Can a user deny performing an action?',
    examples: [
      'Missing or insufficient audit logs',
      'Shared accounts making attribution impossible',
      'No timestamp verification on actions',
      'Deletable or modifiable log files',
      'Unsigned transactions',
    ],
    mitigations: [
      'Comprehensive audit logging with tamper protection',
      'Individual user accounts with MFA',
      'Digital signatures for critical actions',
      'Centralized, append-only log aggregation (SIEM)',
      'Non-repudiation protocols for financial transactions',
    ],
  },
  {
    id: 'I',
    name: 'Information Disclosure',
    question: 'Can an attacker access data they should not see?',
    examples: [
      'Sensitive data in error messages or stack traces',
      'Directory traversal exposing system files',
      'IDOR (Insecure Direct Object Reference)',
      'API responses including excess data',
      'Backup files accessible via web',
    ],
    mitigations: [
      'Encrypt sensitive data at rest and in transit',
      'Implement proper access controls and authorization',
      'Minimize data in API responses (field-level security)',
      'Custom error pages (no stack traces in production)',
      'Data classification and handling policies',
    ],
  },
  {
    id: 'D',
    name: 'Denial of Service',
    question: 'Can an attacker make the system unavailable?',
    examples: [
      'Volumetric DDoS attacks',
      'Application-layer attacks (slowloris, hash DoS)',
      'Resource exhaustion (CPU, memory, disk, connections)',
      'Algorithmic complexity attacks (ReDoS, billion laughs)',
      'Dependency on single points of failure',
    ],
    mitigations: [
      'Rate limiting and throttling',
      'CDN and DDoS protection services',
      'Input size limits and timeout enforcement',
      'Horizontal scaling and load balancing',
      'Circuit breakers and graceful degradation',
    ],
  },
  {
    id: 'E',
    name: 'Elevation of Privilege',
    question: 'Can an attacker gain higher privileges than intended?',
    examples: [
      'Privilege escalation via misconfigured RBAC',
      'JWT manipulation to change roles',
      'Insecure deserialization leading to RCE',
      'Container escape or VM breakout',
      'Default credentials on admin interfaces',
    ],
    mitigations: [
      'Principle of least privilege everywhere',
      'Server-side role validation (never trust client)',
      'Secure defaults (deny by default)',
      'Regular privilege audits',
      'Sandboxing and isolation (containers, VMs)',
    ],
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

export function registerThreatIntelTools(): void {

  // ─── 1. threat_feed ─────────────────────────────────────────────────────────

  registerTool({
    name: 'threat_feed',
    description: 'Aggregate cyber threat intelligence from free public sources. Fetches recent high/critical CVEs from NIST NVD, recent exploits from Exploit-DB, and optionally matches against your tech stack (from dream journal insights). Returns top threats with severity, affected software, and stack relevance.',
    parameters: {
      days: { type: 'number', description: 'Look-back period in days (default: 7, max: 30)' },
      tech_stack: { type: 'string', description: 'Comma-separated tech stack to match against (e.g. "node,react,postgres"). Auto-detected from dream journal if not provided.' },
      include_exploits: { type: 'boolean', description: 'Include recent Exploit-DB entries (default: true)' },
    },
    tier: 'free',
    timeout: 60_000,
    maxResultSize: 50_000,
    async execute(args) {
      const days = Math.min(Math.max(Number(args.days) || 7, 1), 30)
      const includeExploits = args.include_exploits !== false
      const lines: string[] = ['## Threat Intelligence Feed', '']

      // Parse tech stack
      let stackTerms: string[] = []
      if (args.tech_stack) {
        stackTerms = String(args.tech_stack).toLowerCase().split(',').map(s => s.trim()).filter(Boolean)
      } else {
        // Auto-detect from dream journal
        const insights = getDreamInsights()
        if (insights.length > 0) {
          stackTerms = insights.slice(0, 20)
          lines.push(`*Tech stack auto-detected from dream journal: ${stackTerms.slice(0, 10).join(', ')}*`, '')
        }
      }

      // Fetch CVEs
      lines.push(`### Recent CVEs (last ${days} days, HIGH/CRITICAL)`, '')
      const cves = await fetchRecentCves(days)

      if (cves.length === 0) {
        lines.push('*No high/critical CVEs found in the specified period, or NVD API is rate-limited. Try again in a few minutes.*', '')
      } else {
        lines.push('| CVE | Score | Severity | Affected | Published |', '|-----|-------|----------|----------|-----------|')
        let stackMatches = 0
        for (const cve of cves.slice(0, 10)) {
          const affectedStr = cve.affected.length > 0 ? cve.affected.join(', ') : 'See NVD'
          const isStackMatch = stackTerms.length > 0 && (
            stackTerms.some(term =>
              cve.affected.some(a => a.toLowerCase().includes(term)) ||
              cve.description.toLowerCase().includes(term)
            )
          )
          const marker = isStackMatch ? ' **[STACK MATCH]**' : ''
          if (isStackMatch) stackMatches++
          lines.push(`| ${cve.id} | ${cve.score} | ${cve.severity} | ${affectedStr} | ${cve.published} |${marker}`)
        }
        lines.push('')

        if (stackMatches > 0) {
          lines.push(`> **${stackMatches} CVE(s) match your tech stack.** Review these immediately.`, '')
        }

        // Details for top 3
        lines.push('### Top CVE Details', '')
        for (const cve of cves.slice(0, 3)) {
          lines.push(`#### ${cve.id} (${cve.severity}, CVSS ${cve.score})`)
          lines.push(cve.description, '')
        }
      }

      // Fetch exploits
      if (includeExploits) {
        lines.push('### Recent Exploits (Exploit-DB, last 30 days)', '')
        const exploits = await fetchExploitDbRecent()

        if (exploits.length === 0) {
          lines.push('*Could not fetch Exploit-DB data. The GitLab mirror may be unavailable.*', '')
        } else {
          lines.push('| Title | Date | Type | Platform |', '|-------|------|------|----------|')
          for (const ex of exploits.slice(0, 10)) {
            lines.push(`| ${ex.title.slice(0, 60)} | ${ex.date} | ${ex.type} | ${ex.platform} |`)
          }
          lines.push('')
        }
      }

      // Summary
      lines.push('### Intelligence Summary', '')
      lines.push(`- **CVEs found**: ${cves.length} (showing top 10)`)
      lines.push(`- **Period**: last ${days} days`)
      lines.push(`- **Sources**: NIST NVD${includeExploits ? ', Exploit-DB' : ''}`)
      if (stackTerms.length > 0) {
        lines.push(`- **Stack monitoring**: ${stackTerms.slice(0, 10).join(', ')}`)
      }
      lines.push('')
      lines.push('*Tip: Run `ioc_check` to verify specific indicators. Run `attack_surface_scan` to assess your own exposure.*')

      return lines.join('\n')
    },
  })

  // ─── 2. ioc_check ──────────────────────────────────────────────────────────

  registerTool({
    name: 'ioc_check',
    description: 'Check an Indicator of Compromise (IOC) against free threat intelligence databases. Accepts IP addresses, domains, file hashes (MD5/SHA1/SHA256), or URLs. Checks URLhaus (abuse.ch), ThreatFox, and optionally VirusTotal and AbuseIPDB (if API keys are configured in ~/.kbot/config.json). Returns reputation score, reports, and associated malware families.',
    parameters: {
      indicator: { type: 'string', description: 'The IOC to check: IP address, domain, file hash (MD5/SHA1/SHA256), or URL', required: true },
    },
    tier: 'free',
    timeout: 45_000,
    async execute(args) {
      const indicator = String(args.indicator || '').trim()
      if (!indicator) return 'Error: No indicator provided. Provide an IP, domain, hash, or URL.'

      const iocType = classifyIoc(indicator)
      if (iocType === 'unknown') {
        return `Error: Could not classify indicator "${indicator}". Provide a valid IP, domain, file hash (MD5/SHA1/SHA256), or URL.`
      }

      const lines: string[] = [
        '## IOC Check Report',
        '',
        `| Field | Value |`,
        `|-------|-------|`,
        `| Indicator | \`${indicator}\` |`,
        `| Type | ${iocType.replace('_', ' ').toUpperCase()} |`,
        `| Checked | ${new Date().toISOString()} |`,
        '',
      ]

      const results: Array<{ source: string; data: Record<string, unknown> }> = []
      const checks: Array<Promise<{ source: string; data: Record<string, unknown> } | null>> = []

      // URLhaus — free, no key needed
      checks.push(checkUrlhaus(indicator, iocType))

      // ThreatFox — free, no key needed
      if (['hash_md5', 'hash_sha256', 'domain', 'ip'].includes(iocType)) {
        checks.push(checkThreatFox(indicator, iocType))
      }

      // AbuseIPDB — needs key
      if (iocType === 'ip') {
        checks.push(checkAbuseIpdb(indicator))
      }

      // VirusTotal — needs key
      checks.push(checkVirusTotal(indicator, iocType))

      const checkResults = await Promise.all(checks)
      for (const r of checkResults) {
        if (r) results.push(r)
      }

      if (results.length === 0) {
        lines.push('### Results', '')
        lines.push('**No threat intelligence found** for this indicator across all checked sources.', '')
        lines.push('This means either:', '')
        lines.push('- The indicator is clean/benign', '')
        lines.push('- It has not been reported to these databases yet', '')
        lines.push('- The free APIs were rate-limited', '')
        lines.push('')
        lines.push('*Configure VirusTotal or AbuseIPDB API keys in `~/.kbot/config.json` for broader coverage.*')
      } else {
        // Compute reputation score
        let threatScore = 0
        let maxScore = 0
        const malwareFamilies = new Set<string>()

        for (const r of results) {
          if (r.source === 'AbuseIPDB') {
            const abuseScore = Number(r.data.abuse_score || 0)
            threatScore += abuseScore
            maxScore += 100
          }
          if (r.source === 'VirusTotal') {
            const malicious = Number(r.data.malicious ?? r.data.detections ?? 0)
            const total = Number(r.data.total_engines ?? 80)
            threatScore += Math.round((malicious / Math.max(total, 1)) * 100)
            maxScore += 100
          }
          if (r.source.includes('URLhaus')) {
            const urlCount = Number(r.data.url_count || r.data.urls_online || 0)
            if (urlCount > 0) { threatScore += 80; maxScore += 100 }
            else { maxScore += 100 }
          }
          if (r.source.includes('ThreatFox')) {
            const matches = r.data.matches as Array<{ malware?: string }> | undefined
            if (matches?.length) {
              threatScore += 90
              maxScore += 100
              for (const m of matches) {
                if (m.malware) malwareFamilies.add(m.malware)
              }
            } else {
              maxScore += 100
            }
          }
        }

        const reputationScore = maxScore > 0 ? Math.round((threatScore / maxScore) * 100) : 0
        const verdict = reputationScore >= 70 ? 'MALICIOUS' :
          reputationScore >= 40 ? 'SUSPICIOUS' :
          reputationScore >= 10 ? 'LOW RISK' : 'CLEAN'

        lines.push(`### Reputation: **${verdict}** (score: ${reputationScore}/100)`, '')

        if (malwareFamilies.size > 0) {
          lines.push(`### Associated Malware Families`, '')
          for (const family of Array.from(malwareFamilies)) {
            lines.push(`- ${family}`)
          }
          lines.push('')
        }

        lines.push('### Source Reports', '')
        for (const r of results) {
          lines.push(`#### ${r.source}`, '')
          for (const [key, value] of Object.entries(r.data)) {
            if (value === null || value === undefined) continue
            if (Array.isArray(value)) {
              if (value.length === 0) continue
              if (typeof value[0] === 'object') {
                lines.push(`**${key}**:`)
                for (const item of value) {
                  lines.push(`- ${JSON.stringify(item)}`)
                }
              } else {
                lines.push(`**${key}**: ${value.join(', ')}`)
              }
            } else if (typeof value === 'object') {
              lines.push(`**${key}**: ${JSON.stringify(value)}`)
            } else {
              lines.push(`**${key}**: ${value}`)
            }
          }
          lines.push('')
        }
      }

      lines.push('---', '')
      lines.push(`*Sources checked: ${results.length > 0 ? results.map(r => r.source).join(', ') : 'URLhaus, ThreatFox'}*`)

      return lines.join('\n')
    },
  })

  // ─── 3. attack_surface_scan ─────────────────────────────────────────────────

  registerTool({
    name: 'attack_surface_scan',
    description: 'Passive reconnaissance of a domain\'s attack surface. Enumerates DNS records (A, AAAA, MX, NS, TXT, CNAME, SOA), checks HTTP security headers, inspects SSL/TLS certificate, and identifies exposed services. No active scanning — purely passive, legal information gathering from public sources.',
    parameters: {
      domain: { type: 'string', description: 'Target domain name (e.g., "example.com")', required: true },
      check_subdomains: { type: 'boolean', description: 'Check common subdomains (www, api, mail, etc.) via DNS. Default: false.' },
    },
    tier: 'free',
    timeout: 90_000,
    maxResultSize: 50_000,
    async execute(args) {
      const domain = String(args.domain || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
      if (!domain || !domain.includes('.')) {
        return 'Error: Provide a valid domain name (e.g., "example.com").'
      }

      const checkSubs = args.check_subdomains === true
      const lines: string[] = [
        '## Attack Surface Report',
        '',
        `| Field | Value |`,
        `|-------|-------|`,
        `| Target | ${domain} |`,
        `| Scan type | Passive reconnaissance |`,
        `| Date | ${new Date().toISOString()} |`,
        '',
      ]

      let overallScore = 0
      let maxScore = 0

      // ── DNS Records ──
      lines.push('### DNS Records', '')
      const dns = await enumerateDns(domain)

      const dnsEntries: Array<[string, string[]]> = [
        ['A (IPv4)', dns.A],
        ['AAAA (IPv6)', dns.AAAA],
        ['MX (Mail)', dns.MX],
        ['NS (Nameservers)', dns.NS],
        ['TXT', dns.TXT],
        ['CNAME', dns.CNAME],
        ['SOA', dns.SOA],
      ]

      for (const [label, records] of dnsEntries) {
        if (records.length > 0) {
          lines.push(`**${label}**:`)
          for (const r of records) lines.push(`- \`${r}\``)
          lines.push('')
        }
      }

      // Check for SPF, DKIM, DMARC in TXT records
      const txtJoined = dns.TXT.join(' ').toLowerCase()
      const hasSPF = txtJoined.includes('v=spf1')
      const hasDMARC = dns.TXT.some(t => t.toLowerCase().includes('v=dmarc'))

      lines.push('**Email Security**:')
      lines.push(`- SPF: ${hasSPF ? 'Present' : 'MISSING'}`)
      lines.push(`- DMARC: ${hasDMARC ? 'Present' : 'MISSING'}`)
      if (hasSPF) { overallScore += 10; maxScore += 10 } else { maxScore += 10 }
      if (hasDMARC) { overallScore += 10; maxScore += 10 } else { maxScore += 10 }

      // Check for DMARC via _dmarc subdomain
      if (!hasDMARC) {
        const resolver = new Resolver()
        resolver.setServers(['1.1.1.1'])
        const dmarcRecords = await dnsResolve(resolver, `_dmarc.${domain}`, 'TXT')
        if (dmarcRecords.some(r => r.toLowerCase().includes('v=dmarc'))) {
          lines.push(`- DMARC (via _dmarc.${domain}): Present`)
          overallScore += 10  // Adjust score since we found it
        }
      }
      lines.push('')

      // ── HTTP Security Headers ──
      lines.push('### HTTP Security Headers', '')
      const httpsUrl = `https://${domain}`
      const headerCheck = await checkHttpHeaders(httpsUrl)

      if (headerCheck.present.length === 0 && headerCheck.missing.length === 0) {
        lines.push('*Could not connect to the target over HTTPS.*', '')

        // Try HTTP
        const httpCheck = await checkHttpHeaders(`http://${domain}`)
        if (httpCheck.present.length > 0 || httpCheck.missing.length > 0) {
          lines.push('> **WARNING**: Site only accessible over HTTP (no HTTPS). This is a critical security issue.', '')
          overallScore -= 20
        }
      } else {
        overallScore += headerCheck.score * 0.4  // Headers worth 40% of score
        maxScore += 40

        if (headerCheck.server) {
          lines.push(`> **Server header exposed**: \`${headerCheck.server}\` — consider removing to reduce information leakage.`, '')
        }
        if (headerCheck.poweredBy) {
          lines.push(`> **X-Powered-By exposed**: \`${headerCheck.poweredBy}\` — remove this header.`, '')
        }

        lines.push('| Header | Status | Purpose |', '|--------|--------|---------|')
        for (const h of headerCheck.present) {
          const desc = EXPECTED_HEADERS[h]?.description || ''
          lines.push(`| ${h} | Present | ${desc} |`)
        }
        for (const h of headerCheck.missing) {
          const desc = EXPECTED_HEADERS[h]?.description || ''
          lines.push(`| ${h} | **MISSING** | ${desc} |`)
        }
        lines.push('')
        lines.push(`**Header Score**: ${headerCheck.score}/100`, '')
      }

      // ── SSL/TLS Certificate ──
      lines.push('### SSL/TLS Certificate', '')
      const certInfo = await getTlsCertInfo(domain)

      if (!certInfo) {
        lines.push('*Could not retrieve SSL/TLS certificate.*', '')
        maxScore += 20
      } else {
        overallScore += 20
        maxScore += 20

        const validTo = new Date(String(certInfo.valid_to))
        const daysLeft = Math.ceil((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        const subject = certInfo.subject as Record<string, string>
        const issuer = certInfo.issuer as Record<string, string>

        lines.push(`| Property | Value |`, `|----------|-------|`)
        lines.push(`| Subject | ${subject?.CN || subject?.O || 'Unknown'} |`)
        lines.push(`| Issuer | ${issuer?.O || issuer?.CN || 'Unknown'} |`)
        lines.push(`| Valid From | ${certInfo.valid_from} |`)
        lines.push(`| Valid To | ${certInfo.valid_to} |`)
        lines.push(`| Days Remaining | ${daysLeft} |`)
        lines.push(`| Key Size | ${certInfo.bits || 'Unknown'} bits |`)
        if (certInfo.subjectaltname) {
          const sans = String(certInfo.subjectaltname).split(',').map(s => s.trim()).slice(0, 10)
          lines.push(`| SANs | ${sans.join(', ')} |`)
        }
        lines.push('')

        if (daysLeft < 0) {
          lines.push('> **CRITICAL**: Certificate has EXPIRED!', '')
          overallScore -= 20
        } else if (daysLeft < 30) {
          lines.push(`> **WARNING**: Certificate expires in ${daysLeft} days. Renew soon.`, '')
        }
      }

      // ── Subdomain Check ──
      if (checkSubs) {
        lines.push('### Subdomain Enumeration (DNS brute-force)', '')
        const resolver = new Resolver()
        resolver.setServers(['1.1.1.1', '8.8.8.8'])
        const commonSubs = [
          'www', 'mail', 'ftp', 'api', 'dev', 'staging', 'test', 'admin',
          'blog', 'shop', 'portal', 'app', 'cdn', 'static', 'docs',
          'vpn', 'remote', 'intranet', 'git', 'ci', 'monitor', 'status',
        ]

        const found: Array<{ subdomain: string; ip: string }> = []
        const subChecks = commonSubs.map(async (sub) => {
          const fqdn = `${sub}.${domain}`
          const ips = await dnsResolve(resolver, fqdn, 'A')
          if (ips.length > 0) {
            found.push({ subdomain: fqdn, ip: ips[0] })
          }
        })
        await Promise.all(subChecks)

        if (found.length > 0) {
          lines.push('| Subdomain | IP |', '|-----------|-----|')
          for (const f of found.sort((a, b) => a.subdomain.localeCompare(b.subdomain))) {
            lines.push(`| ${f.subdomain} | ${f.ip} |`)
          }
          lines.push('')
          lines.push(`Found **${found.length}** subdomains out of ${commonSubs.length} checked.`, '')
        } else {
          lines.push('*No common subdomains found via DNS.*', '')
        }
      }

      // ── Overall Score ──
      const finalScore = maxScore > 0 ? Math.max(0, Math.min(100, Math.round((overallScore / maxScore) * 100))) : 0
      const grade = finalScore >= 90 ? 'A' :
        finalScore >= 80 ? 'B' :
        finalScore >= 70 ? 'C' :
        finalScore >= 50 ? 'D' : 'F'

      lines.push('### Overall Security Posture', '')
      lines.push(`| Metric | Value |`, `|--------|-------|`)
      lines.push(`| Score | ${finalScore}/100 |`)
      lines.push(`| Grade | **${grade}** |`)
      lines.push('')

      if (grade === 'D' || grade === 'F') {
        lines.push('> **Action required**: This domain has significant security gaps. Address missing headers and certificate issues immediately.', '')
      }

      lines.push('---', '')
      lines.push('*This is a passive scan only. No active probing or exploitation was performed. For deeper assessment, use `pentest_start` or `security_hunt`.*')

      return lines.join('\n')
    },
  })

  // ─── 4. incident_response ───────────────────────────────────────────────────

  registerTool({
    name: 'incident_response',
    description: 'Generate an incident response playbook for a security incident. Given an incident type and description, produces a structured playbook with containment steps, eradication plan, recovery checklist, lessons learned template, and IOC indicators. Uses local Ollama for contextual AI analysis when available. Incident types: ransomware, data_breach, ddos, insider_threat, supply_chain.',
    parameters: {
      incident_type: { type: 'string', description: 'Type of incident: ransomware, data_breach, ddos, insider_threat, supply_chain', required: true },
      description: { type: 'string', description: 'Description of the incident — what happened, when, what systems are affected', required: true },
      severity: { type: 'string', description: 'Incident severity: critical, high, medium, low (default: high)' },
      affected_systems: { type: 'string', description: 'Comma-separated list of affected systems or services' },
    },
    tier: 'free',
    timeout: 120_000,
    maxResultSize: 50_000,
    async execute(args) {
      const incidentType = String(args.incident_type || '').toLowerCase().replace(/\s+/g, '_')
      const description = String(args.description || '')
      const severity = String(args.severity || 'high').toUpperCase()
      const affectedSystems = args.affected_systems
        ? String(args.affected_systems).split(',').map(s => s.trim()).filter(Boolean)
        : []

      if (!description) {
        return 'Error: Provide an incident description (what happened, when, what is affected).'
      }

      const template = INCIDENT_TYPES[incidentType]
      if (!template) {
        const validTypes = Object.keys(INCIDENT_TYPES).join(', ')
        return `Error: Unknown incident type "${incidentType}". Valid types: ${validTypes}`
      }

      const lines: string[] = [
        '# Incident Response Playbook',
        '',
        `| Field | Value |`,
        `|-------|-------|`,
        `| Incident Type | ${incidentType.replace(/_/g, ' ').toUpperCase()} |`,
        `| Severity | **${severity}** |`,
        `| Generated | ${new Date().toISOString()} |`,
        `| Incident ID | IR-${Date.now().toString(36).toUpperCase()} |`,
        '',
      ]

      if (affectedSystems.length > 0) {
        lines.push(`**Affected Systems**: ${affectedSystems.join(', ')}`, '')
      }

      lines.push(`**Incident Description**: ${description}`, '')

      // ── Phase 1: Detection & Analysis ──
      lines.push('## Phase 1: Detection & Analysis', '')
      lines.push('### Known Indicators for this Incident Type', '')
      for (const indicator of template.indicators) {
        lines.push(`- [ ] ${indicator}`)
      }
      lines.push('')

      // ── Phase 2: Containment ──
      lines.push('## Phase 2: Containment', '')
      lines.push('*Execute immediately to limit damage. Track time spent on each step.*', '')
      for (let i = 0; i < template.containment.length; i++) {
        lines.push(`${i + 1}. [ ] ${template.containment[i]}`)
      }
      lines.push('')

      // ── Phase 3: Eradication ──
      lines.push('## Phase 3: Eradication', '')
      lines.push('*Remove the threat completely. Do not rush — incomplete eradication leads to reinfection.*', '')
      for (let i = 0; i < template.eradication.length; i++) {
        lines.push(`${i + 1}. [ ] ${template.eradication[i]}`)
      }
      lines.push('')

      // ── Phase 4: Recovery ──
      lines.push('## Phase 4: Recovery', '')
      lines.push('*Restore normal operations. Monitor closely for signs of recurrence.*', '')
      for (let i = 0; i < template.recovery.length; i++) {
        lines.push(`${i + 1}. [ ] ${template.recovery[i]}`)
      }
      lines.push('')

      // ── AI Analysis (Ollama) ──
      const ollamaAvailable = await isOllamaAvailable()
      if (ollamaAvailable) {
        lines.push('## AI-Guided Contextual Analysis', '')

        const prompt = [
          `You are a senior incident response analyst. Analyze this security incident and provide specific, actionable guidance.`,
          ``,
          `Incident Type: ${incidentType.replace(/_/g, ' ')}`,
          `Severity: ${severity}`,
          `Description: ${description}`,
          affectedSystems.length > 0 ? `Affected Systems: ${affectedSystems.join(', ')}` : '',
          ``,
          `Provide:`,
          `1. IMMEDIATE ACTIONS — the 3 most critical things to do right now`,
          `2. THREAT ANALYSIS — likely attack vector and adversary profile based on the description`,
          `3. EVIDENCE COLLECTION — what forensic evidence to preserve and how`,
          `4. COMMUNICATION PLAN — who to notify and when (legal, executives, customers, regulators)`,
          `5. TIMELINE ESTIMATION — how long each phase should take`,
          ``,
          `Be specific to this incident. No generic advice.`,
        ].filter(Boolean).join('\n')

        const analysis = await ollamaGenerate(prompt)
        if (analysis) {
          lines.push(analysis, '')
        } else {
          lines.push('*Ollama analysis unavailable — model may not be loaded. Run `ollama pull kernel-coder:latest`.*', '')
        }
      } else {
        lines.push('> *Ollama not running. Start Ollama for AI-guided contextual analysis specific to your incident.*', '')
      }

      // ── Phase 5: Lessons Learned ──
      lines.push('## Phase 5: Post-Incident Review (Lessons Learned)', '')
      lines.push('*Conduct within 72 hours of incident closure. All responders should attend.*', '')
      lines.push('')
      lines.push('### Review Template', '')
      lines.push('| Question | Answer |', '|----------|--------|')
      lines.push('| What happened? | |')
      lines.push('| When was it detected? | |')
      lines.push('| How was it detected? | |')
      lines.push('| What was the root cause? | |')
      lines.push('| What went well in the response? | |')
      lines.push('| What could be improved? | |')
      lines.push('| What process changes are needed? | |')
      lines.push('| What tools/capabilities were missing? | |')
      lines.push('| Total time to detect (TTD)? | |')
      lines.push('| Total time to contain (TTC)? | |')
      lines.push('| Total time to recover (TTR)? | |')
      lines.push('| Business impact estimate? | |')
      lines.push('')

      // ── Communication Templates ──
      lines.push('## Communication Templates', '')
      lines.push('### Internal Notification (Executive)', '')
      lines.push('```')
      lines.push(`Subject: Security Incident - ${incidentType.replace(/_/g, ' ').toUpperCase()} - Severity: ${severity}`)
      lines.push('')
      lines.push(`At [TIME], our security team detected a ${incidentType.replace(/_/g, ' ')} incident`)
      lines.push(`affecting [SYSTEMS]. We have activated our incident response plan and`)
      lines.push(`containment measures are in progress. Current status: [CONTAINING/ERADICATING/RECOVERING].`)
      lines.push('')
      lines.push(`Next update: [TIME]`)
      lines.push('```')
      lines.push('')

      lines.push('---', '')
      lines.push('*Generated by kbot threat-intel. This is a starting framework — adapt to your organization\'s IR procedures.*')

      return lines.join('\n')
    },
  })

  // ─── 5. threat_model ────────────────────────────────────────────────────────

  registerTool({
    name: 'threat_model',
    description: 'Generate a STRIDE threat model for a system. Given a system description (tech stack, architecture, data flows), analyze Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege threats. Prioritizes by likelihood and impact. Uses local Ollama for contextual AI analysis when available.',
    parameters: {
      system: { type: 'string', description: 'System description: tech stack, architecture overview, key components', required: true },
      data_flows: { type: 'string', description: 'Key data flows (e.g., "user -> API -> database, API -> payment gateway")' },
      trust_boundaries: { type: 'string', description: 'Trust boundaries (e.g., "internet/DMZ, DMZ/internal, app/database")' },
      assets: { type: 'string', description: 'High-value assets to protect (e.g., "user PII, payment data, API keys")' },
    },
    tier: 'free',
    timeout: 120_000,
    maxResultSize: 50_000,
    async execute(args) {
      const system = String(args.system || '')
      if (!system) {
        return 'Error: Provide a system description (tech stack, architecture, key components).'
      }

      const dataFlows = args.data_flows ? String(args.data_flows).split(',').map(s => s.trim()) : []
      const trustBoundaries = args.trust_boundaries ? String(args.trust_boundaries).split(',').map(s => s.trim()) : []
      const assets = args.assets ? String(args.assets).split(',').map(s => s.trim()) : []

      const lines: string[] = [
        '# STRIDE Threat Model',
        '',
        `| Field | Value |`,
        `|-------|-------|`,
        `| Generated | ${new Date().toISOString()} |`,
        `| Model ID | TM-${Date.now().toString(36).toUpperCase()} |`,
        '',
        '## System Description',
        '',
        system,
        '',
      ]

      if (dataFlows.length > 0) {
        lines.push('### Data Flows', '')
        for (const flow of dataFlows) lines.push(`- ${flow}`)
        lines.push('')
      }

      if (trustBoundaries.length > 0) {
        lines.push('### Trust Boundaries', '')
        for (const boundary of trustBoundaries) lines.push(`- ${boundary}`)
        lines.push('')
      }

      if (assets.length > 0) {
        lines.push('### High-Value Assets', '')
        for (const asset of assets) lines.push(`- ${asset}`)
        lines.push('')
      }

      // ── STRIDE Analysis ──
      lines.push('## STRIDE Analysis', '')

      // Detect common tech from system description for relevance scoring
      const sysLower = system.toLowerCase()
      const hasWeb = /\b(web|http|api|rest|graphql|html|browser|spa|react|angular|vue)\b/.test(sysLower)
      const hasDb = /\b(database|db|sql|postgres|mysql|mongo|redis|dynamo|supabase)\b/.test(sysLower)
      const hasAuth = /\b(auth|login|jwt|oauth|session|token|password|credential)\b/.test(sysLower)
      const hasCloud = /\b(aws|gcp|azure|cloud|s3|lambda|kubernetes|docker|container)\b/.test(sysLower)
      const hasPayment = /\b(payment|stripe|paypal|credit card|billing|financial)\b/.test(sysLower)
      const hasApi = /\b(api|endpoint|microservice|grpc|webhook)\b/.test(sysLower)

      const threats: Array<{
        category: string
        threat: string
        likelihood: 'High' | 'Medium' | 'Low'
        impact: 'High' | 'Medium' | 'Low'
        priority: number
        mitigation: string
      }> = []

      for (const stride of STRIDE_CATEGORIES) {
        lines.push(`### ${stride.id} - ${stride.name}`, '')
        lines.push(`> *${stride.question}*`, '')

        // Select relevant threats based on system characteristics
        const relevantExamples: string[] = []
        const relevantMitigations: string[] = []

        for (const ex of stride.examples) {
          const exLower = ex.toLowerCase()
          let relevant = true
          // Filter by relevance
          if (exLower.includes('sql injection') && !hasDb) relevant = false
          if (exLower.includes('jwt') && !hasAuth) relevant = false
          if (exLower.includes('container') && !hasCloud) relevant = false
          if (relevant) relevantExamples.push(ex)
        }

        // Always include at least 3 examples
        const examples = relevantExamples.length >= 3
          ? relevantExamples
          : stride.examples.slice(0, Math.max(3, relevantExamples.length))

        lines.push('**Potential Threats**:', '')
        for (const ex of examples) {
          // Score likelihood based on system characteristics
          let likelihood: 'High' | 'Medium' | 'Low' = 'Medium'
          let impact: 'High' | 'Medium' | 'Low' = 'Medium'
          const exLower = ex.toLowerCase()

          if (exLower.includes('authentication') && hasAuth) { likelihood = 'High'; impact = 'High' }
          if (exLower.includes('injection') && hasDb) { likelihood = 'High'; impact = 'High' }
          if (exLower.includes('xss') && hasWeb) { likelihood = 'High'; impact = 'Medium' }
          if (exLower.includes('ddos')) { likelihood = hasApi ? 'High' : 'Medium'; impact = 'High' }
          if (exLower.includes('privilege') && hasAuth) { likelihood = 'Medium'; impact = 'High' }
          if (exLower.includes('credential') && hasAuth) { likelihood = 'High'; impact = 'High' }
          if (exLower.includes('payment') || exLower.includes('financial')) { impact = hasPayment ? 'High' : 'Low' }

          const priority = (likelihood === 'High' ? 3 : likelihood === 'Medium' ? 2 : 1) *
            (impact === 'High' ? 3 : impact === 'Medium' ? 2 : 1)

          lines.push(`- **${ex}** — Likelihood: ${likelihood}, Impact: ${impact}`)

          threats.push({
            category: stride.name,
            threat: ex,
            likelihood,
            impact,
            priority,
            mitigation: stride.mitigations[examples.indexOf(ex)] || stride.mitigations[0],
          })
        }
        lines.push('')

        lines.push('**Recommended Mitigations**:', '')
        for (const mit of stride.mitigations) {
          lines.push(`- ${mit}`)
        }
        lines.push('')
      }

      // ── Priority Matrix ──
      lines.push('## Priority Matrix', '')
      const sorted = threats.sort((a, b) => b.priority - a.priority)
      lines.push('| Priority | Category | Threat | Likelihood | Impact |', '|----------|----------|--------|------------|--------|')
      for (const t of sorted.slice(0, 15)) {
        const pLabel = t.priority >= 9 ? 'CRITICAL' : t.priority >= 6 ? 'HIGH' : t.priority >= 4 ? 'MEDIUM' : 'LOW'
        lines.push(`| ${pLabel} | ${t.category} | ${t.threat.slice(0, 50)} | ${t.likelihood} | ${t.impact} |`)
      }
      lines.push('')

      // ── AI Analysis ──
      const ollamaAvailable = await isOllamaAvailable()
      if (ollamaAvailable) {
        lines.push('## AI Threat Analysis', '')

        const prompt = [
          `You are a senior security architect performing a STRIDE threat model review.`,
          ``,
          `System: ${system}`,
          dataFlows.length > 0 ? `Data Flows: ${dataFlows.join('; ')}` : '',
          trustBoundaries.length > 0 ? `Trust Boundaries: ${trustBoundaries.join('; ')}` : '',
          assets.length > 0 ? `Critical Assets: ${assets.join('; ')}` : '',
          ``,
          `Based on this system, provide:`,
          `1. TOP 3 ATTACK SCENARIOS — realistic multi-step attack chains an adversary would use`,
          `2. BLIND SPOTS — threats that a standard STRIDE analysis might miss for this specific system`,
          `3. QUICK WINS — the 5 highest-impact mitigations that can be implemented this week`,
          `4. ARCHITECTURE RECOMMENDATIONS — structural changes to improve security posture`,
          ``,
          `Be specific to this system. Reference actual technologies mentioned.`,
        ].filter(Boolean).join('\n')

        const analysis = await ollamaGenerate(prompt)
        if (analysis) {
          lines.push(analysis, '')
        } else {
          lines.push('*Ollama analysis unavailable — model may not be loaded.*', '')
        }
      } else {
        lines.push('> *Start Ollama for AI-enhanced threat analysis specific to your system architecture.*', '')
      }

      // ── Summary ──
      const criticalCount = sorted.filter(t => t.priority >= 9).length
      const highCount = sorted.filter(t => t.priority >= 6 && t.priority < 9).length

      lines.push('## Summary', '')
      lines.push(`| Metric | Value |`, `|--------|-------|`)
      lines.push(`| Total threats identified | ${threats.length} |`)
      lines.push(`| Critical priority | ${criticalCount} |`)
      lines.push(`| High priority | ${highCount} |`)
      lines.push(`| STRIDE categories covered | ${STRIDE_CATEGORIES.length}/6 |`)
      lines.push('')
      lines.push('---', '')
      lines.push('*Generated by kbot threat-intel. Review with your security team and update as the system evolves.*')

      return lines.join('\n')
    },
  })
}
