// kbot Security Knowledge Brain — Comprehensive cybersecurity intelligence
// MITRE ATT&CK (all 14 tactics, 200+ techniques), OWASP Top 10 (2025),
// Lockheed Martin Kill Chain, CVE pattern library, and tool mapping.
// March 2026: ATT&CK v15 complete, OWASP 2025 refresh incorporated.

import { registerTool } from './index.js'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ATTACKTechnique {
  id: string
  name: string
  tactic: string
  description: string
  platforms: string[]
  detection: string[]
  mitigations: string[]
  subtechniques?: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
  commonTools?: string[]
}

interface OWASPEntry {
  id: string
  name: string
  description: string
  exampleAttack: string
  detection: string[]
  remediation: string[]
  codePattern: string
  severity: 'high' | 'critical'
  cweIds: string[]
}

interface KillChainStage {
  stage: number
  name: string
  definition: string
  attackerActions: string[]
  defenderActions: string[]
  detectionMethods: string[]
  kbotTools: string[]
  indicators: string[]
}

interface ToolMapping {
  tool: string
  tactics: string[]
  description: string
  usage: string
  attackSurface: string[]
}

// ═══════════════════════════════════════════════════════════════════════════
// MITRE ATT&CK — ALL 14 TACTICS WITH TOP TECHNIQUES
// ATT&CK v15 (October 2025)
// ═══════════════════════════════════════════════════════════════════════════

const MITRE_TECHNIQUES: ATTACKTechnique[] = [
  // ── TACTIC 1: RECONNAISSANCE ──────────────────────────────────────────
  {
    id: 'T1595',
    name: 'Active Scanning',
    tactic: 'Reconnaissance',
    description: 'Adversaries scan victim IP ranges to gather information about hosts and services. Includes vulnerability scanning (T1595.002) and wordlist scanning (T1595.003).',
    platforms: ['PRE'],
    detection: ['Monitor for suspicious network scanning patterns', 'IDS signatures for common scanning tools (Nmap, Masscan)', 'Web server logs showing enumeration patterns'],
    mitigations: ['Pre-compromise mitigation is limited', 'Rate limiting on exposed services', 'Honeypots to detect scanning activity'],
    subtechniques: ['T1595.001 — Scanning IP Blocks', 'T1595.002 — Vulnerability Scanning', 'T1595.003 — Wordlist Scanning'],
    severity: 'medium',
    commonTools: ['Nmap', 'Masscan', 'Shodan', 'Censys', 'Nuclei'],
  },
  {
    id: 'T1592',
    name: 'Gather Victim Host Information',
    tactic: 'Reconnaissance',
    description: 'Adversaries gather host information (hardware, software, configs, client configs) before targeting. Includes firmware versions, installed software, and patch levels.',
    platforms: ['PRE'],
    detection: ['Monitor for unusual information requests', 'Track OSINT tool queries against your domains', 'User-agent anomalies in web logs'],
    mitigations: ['Limit public exposure of technical details', 'Minimize information in error pages', 'Remove version headers from HTTP responses'],
    subtechniques: ['T1592.001 — Hardware', 'T1592.002 — Software', 'T1592.003 — Firmware', 'T1592.004 — Client Configurations'],
    severity: 'low',
  },
  {
    id: 'T1589',
    name: 'Gather Victim Identity Information',
    tactic: 'Reconnaissance',
    description: 'Adversaries gather identity info (credentials, email addresses, employee names) for targeting. Used to craft phishing campaigns and credential stuffing.',
    platforms: ['PRE'],
    detection: ['Monitor for credential dumps mentioning your org', 'Dark web monitoring', 'Anomalous login attempts with leaked credentials'],
    mitigations: ['Monitor for leaked credentials (Have I Been Pwned)', 'Enforce MFA', 'Train employees on social engineering'],
    subtechniques: ['T1589.001 — Credentials', 'T1589.002 — Email Addresses', 'T1589.003 — Employee Names'],
    severity: 'medium',
  },
  {
    id: 'T1593',
    name: 'Search Open Websites/Domains',
    tactic: 'Reconnaissance',
    description: 'Adversaries search open websites and domains for useful targeting information. Includes social media, search engines, and code repositories.',
    platforms: ['PRE'],
    detection: ['Monitor for scraping of company websites', 'Track GitHub/GitLab exposure of internal code', 'Social media monitoring for info leaks'],
    mitigations: ['Review public code repositories for secrets', 'Limit employee info on public sites', 'Use robots.txt and access controls'],
    subtechniques: ['T1593.001 — Social Media', 'T1593.002 — Search Engines', 'T1593.003 — Code Repositories'],
    severity: 'low',
  },
  {
    id: 'T1596',
    name: 'Search Open Technical Databases',
    tactic: 'Reconnaissance',
    description: 'Adversaries search technical databases (WHOIS, DNS, certificate transparency, CDN) for targeting information.',
    platforms: ['PRE'],
    detection: ['Monitor CT logs for unauthorized certificate issuance', 'Track WHOIS lookups', 'DNS query monitoring'],
    mitigations: ['Use WHOIS privacy', 'Monitor Certificate Transparency logs', 'Minimize DNS information exposure'],
    subtechniques: ['T1596.001 — DNS/Passive DNS', 'T1596.002 — WHOIS', 'T1596.003 — Digital Certificates', 'T1596.004 — CDNs', 'T1596.005 — Scan Databases'],
    severity: 'low',
  },
  {
    id: 'T1597',
    name: 'Search Closed Sources',
    tactic: 'Reconnaissance',
    description: 'Adversaries search closed/private sources such as threat intel vendors, dark web markets, and paid databases for targeting data.',
    platforms: ['PRE'],
    detection: ['Difficult to detect pre-compromise', 'Dark web monitoring services', 'Threat intel sharing communities'],
    mitigations: ['Subscribe to dark web monitoring', 'Participate in ISACs', 'Monitor for brand impersonation'],
    subtechniques: ['T1597.001 — Threat Intel Vendors', 'T1597.002 — Purchase Technical Data'],
    severity: 'medium',
  },
  {
    id: 'T1598',
    name: 'Phishing for Information',
    tactic: 'Reconnaissance',
    description: 'Adversaries send phishing messages to gather information rather than deliver payloads. Targets credentials, system info, or business intelligence.',
    platforms: ['PRE'],
    detection: ['Email gateway phishing detection', 'User reporting of suspicious emails', 'Domain reputation checks on embedded links'],
    mitigations: ['Security awareness training', 'Email filtering and anti-phishing', 'DMARC/DKIM/SPF enforcement'],
    subtechniques: ['T1598.001 — Spearphishing Service', 'T1598.002 — Spearphishing Attachment', 'T1598.003 — Spearphishing Link'],
    severity: 'high',
  },

  // ── TACTIC 2: RESOURCE DEVELOPMENT ────────────────────────────────────
  {
    id: 'T1583',
    name: 'Acquire Infrastructure',
    tactic: 'Resource Development',
    description: 'Adversaries acquire infrastructure (domains, servers, VPS, botnets, web services) for operations. Used for C2, phishing, and staging.',
    platforms: ['PRE'],
    detection: ['Monitor for newly registered domains resembling yours', 'Track infrastructure associated with known threat actors', 'Certificate Transparency monitoring'],
    mitigations: ['Domain monitoring and takedown services', 'Brand protection services', 'Report malicious infrastructure to registrars'],
    subtechniques: ['T1583.001 — Domains', 'T1583.002 — DNS Server', 'T1583.003 — Virtual Private Server', 'T1583.004 — Server', 'T1583.005 — Botnet', 'T1583.006 — Web Services', 'T1583.007 — Serverless', 'T1583.008 — Malvertising'],
    severity: 'medium',
  },
  {
    id: 'T1584',
    name: 'Compromise Infrastructure',
    tactic: 'Resource Development',
    description: 'Adversaries compromise third-party infrastructure for use in operations. Harder to attribute than adversary-owned infrastructure.',
    platforms: ['PRE'],
    detection: ['Monitor for C2 traffic to legitimate but compromised servers', 'Threat intel sharing about compromised infrastructure', 'Behavioral analysis of outbound connections'],
    mitigations: ['Network segmentation', 'Outbound traffic filtering', 'Domain reputation scoring'],
    subtechniques: ['T1584.001 — Domains', 'T1584.002 — DNS Server', 'T1584.003 — Virtual Private Server', 'T1584.004 — Server', 'T1584.005 — Botnet', 'T1584.006 — Web Services', 'T1584.007 — Serverless'],
    severity: 'high',
  },
  {
    id: 'T1585',
    name: 'Establish Accounts',
    tactic: 'Resource Development',
    description: 'Adversaries create accounts on services for use in targeting. Social media for social engineering, email for phishing, cloud for infrastructure.',
    platforms: ['PRE'],
    detection: ['Monitor for impersonation accounts on social media', 'Email authentication (SPF/DKIM/DMARC) detects spoofed senders', 'Track new accounts interacting with employees'],
    mitigations: ['Brand monitoring on social platforms', 'Email authentication protocols', 'Employee social engineering training'],
    subtechniques: ['T1585.001 — Social Media Accounts', 'T1585.002 — Email Accounts', 'T1585.003 — Cloud Accounts'],
    severity: 'medium',
  },
  {
    id: 'T1586',
    name: 'Compromise Accounts',
    tactic: 'Resource Development',
    description: 'Adversaries compromise existing accounts rather than creating new ones. Trusted accounts bypass reputation filters.',
    platforms: ['PRE'],
    detection: ['Impossible travel detection', 'Anomalous account behavior', 'Credential leak monitoring'],
    mitigations: ['MFA enforcement', 'Credential monitoring', 'Account activity baselines'],
    subtechniques: ['T1586.001 — Social Media Accounts', 'T1586.002 — Email Accounts', 'T1586.003 — Cloud Accounts'],
    severity: 'high',
  },
  {
    id: 'T1587',
    name: 'Develop Capabilities',
    tactic: 'Resource Development',
    description: 'Adversaries develop malware, exploits, digital certificates, and other capabilities in-house. Custom tools evade signature-based detection.',
    platforms: ['PRE'],
    detection: ['Behavioral analysis catches novel malware', 'Sandbox detonation of suspicious files', 'Monitoring for anomalous code-signing certificates'],
    mitigations: ['Behavioral detection (EDR)', 'Sandboxing', 'Application allowlisting'],
    subtechniques: ['T1587.001 — Malware', 'T1587.002 — Code Signing Certificates', 'T1587.003 — Digital Certificates', 'T1587.004 — Exploits'],
    severity: 'high',
  },
  {
    id: 'T1588',
    name: 'Obtain Capabilities',
    tactic: 'Resource Development',
    description: 'Adversaries obtain tools, malware, exploits, and certificates from third parties rather than developing in-house.',
    platforms: ['PRE'],
    detection: ['Signature-based detection for known malware families', 'Track exploit marketplace activity', 'Monitor for stolen certificate usage'],
    mitigations: ['Keep systems patched to reduce exploit value', 'Certificate revocation monitoring', 'Threat intel on marketplace activity'],
    subtechniques: ['T1588.001 — Malware', 'T1588.002 — Tool', 'T1588.003 — Code Signing Certificates', 'T1588.004 — Digital Certificates', 'T1588.005 — Exploits', 'T1588.006 — Vulnerabilities'],
    severity: 'high',
  },

  // ── TACTIC 3: INITIAL ACCESS ──────────────────────────────────────────
  {
    id: 'T1189',
    name: 'Drive-by Compromise',
    tactic: 'Initial Access',
    description: 'Adversaries gain access through a user visiting a compromised website during normal browsing. Exploits browser or plugin vulnerabilities.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Browser exploit detection via EDR', 'Network IDS for exploit kit traffic', 'Sandboxed browser environments', 'Unusual process creation from browser'],
    mitigations: ['Keep browsers and plugins updated', 'Browser isolation', 'Content Security Policy headers', 'Ad blockers to prevent malvertising'],
    severity: 'high',
    commonTools: ['Exploit kits (Angler, RIG, Magnitude)', 'Browser exploitation frameworks'],
  },
  {
    id: 'T1190',
    name: 'Exploit Public-Facing Application',
    tactic: 'Initial Access',
    description: 'Adversaries exploit vulnerabilities in internet-facing applications (web servers, databases, APIs, CMS). Common entry point for server compromise.',
    platforms: ['Windows', 'Linux', 'macOS', 'Containers'],
    detection: ['WAF alerting on exploit attempts', 'Application error rate monitoring', 'Log analysis for injection patterns', 'IDS signatures for known CVEs'],
    mitigations: ['Patch management', 'WAF deployment', 'Input validation', 'Network segmentation', 'Regular vulnerability scanning'],
    severity: 'critical',
    commonTools: ['SQLmap', 'Burp Suite', 'Nuclei', 'Metasploit'],
  },
  {
    id: 'T1566',
    name: 'Phishing',
    tactic: 'Initial Access',
    description: 'Adversaries send phishing messages with malicious attachments or links to gain access. Most common initial access vector globally.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Email gateway filtering', 'Attachment sandboxing', 'URL reputation checking', 'User reporting mechanisms', 'DMARC enforcement'],
    mitigations: ['Security awareness training', 'Email filtering', 'Attachment sandboxing', 'Link protection', 'MFA (limits credential phishing impact)'],
    subtechniques: ['T1566.001 — Spearphishing Attachment', 'T1566.002 — Spearphishing Link', 'T1566.003 — Spearphishing via Service', 'T1566.004 — Spearphishing Voice'],
    severity: 'critical',
    commonTools: ['Gophish', 'King Phisher', 'Evilginx2', 'Modlishka'],
  },
  {
    id: 'T1195',
    name: 'Supply Chain Compromise',
    tactic: 'Initial Access',
    description: 'Adversaries manipulate products or delivery mechanisms before the victim receives them. Targets software supply chain (dependencies, build systems, update mechanisms).',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Software composition analysis', 'Build integrity verification', 'Package hash verification', 'Anomalous behavior from trusted software'],
    mitigations: ['Vendor security assessments', 'Software bill of materials (SBOM)', 'Package integrity verification', 'Lockfile enforcement', 'Dependency pinning'],
    subtechniques: ['T1195.001 — Compromise Software Dependencies and Development Tools', 'T1195.002 — Compromise Software Supply Chain', 'T1195.003 — Compromise Hardware Supply Chain'],
    severity: 'critical',
    commonTools: ['Dependency confusion attacks', 'Typosquatting packages'],
  },
  {
    id: 'T1199',
    name: 'Trusted Relationship',
    tactic: 'Initial Access',
    description: 'Adversaries exploit trusted third-party relationships (IT service providers, contractors, MSPs) to access victim networks.',
    platforms: ['Windows', 'Linux', 'macOS', 'SaaS'],
    detection: ['Monitor third-party access patterns', 'Anomalous VPN connections from partner IPs', 'Unusual service account activity'],
    mitigations: ['Vendor access reviews', 'Least-privilege for third parties', 'Network segmentation', 'Just-in-time access'],
    severity: 'high',
  },
  {
    id: 'T1078',
    name: 'Valid Accounts',
    tactic: 'Initial Access',
    description: 'Adversaries obtain and abuse legitimate credentials for initial access, persistence, privilege escalation, and defense evasion.',
    platforms: ['Windows', 'Linux', 'macOS', 'SaaS', 'Azure AD', 'Google Workspace'],
    detection: ['Impossible travel detection', 'Anomalous login times/locations', 'Credential leak monitoring', 'Behavioral analytics on account usage'],
    mitigations: ['MFA enforcement', 'Credential rotation', 'Privileged access management', 'Conditional access policies', 'Dark web monitoring'],
    subtechniques: ['T1078.001 — Default Accounts', 'T1078.002 — Domain Accounts', 'T1078.003 — Local Accounts', 'T1078.004 — Cloud Accounts'],
    severity: 'critical',
    commonTools: ['Mimikatz', 'Credential stuffing tools', 'Pass-the-hash'],
  },
  {
    id: 'T1133',
    name: 'External Remote Services',
    tactic: 'Initial Access',
    description: 'Adversaries leverage external-facing remote services (VPN, RDP, SSH, Citrix) for initial access using valid or compromised credentials.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor VPN/RDP login anomalies', 'Geographic impossible travel', 'Brute-force detection on remote services'],
    mitigations: ['MFA on all remote access', 'VPN split-tunneling restrictions', 'Network-level authentication', 'Jump box/bastion hosts'],
    severity: 'high',
    commonTools: ['Hydra', 'Crowbar', 'RDP brute-force tools'],
  },

  // ── TACTIC 4: EXECUTION ───────────────────────────────────────────────
  {
    id: 'T1059',
    name: 'Command and Scripting Interpreter',
    tactic: 'Execution',
    description: 'Adversaries abuse command and script interpreters to execute commands, scripts, or binaries. Most versatile execution technique.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Command-line logging (Sysmon Event ID 1)', 'Script block logging (PowerShell)', 'Behavioral analysis of interpreter usage', 'Parent-child process relationships'],
    mitigations: ['Constrained Language Mode (PowerShell)', 'Application allowlisting', 'Script signing enforcement', 'Disable unused interpreters'],
    subtechniques: ['T1059.001 — PowerShell', 'T1059.002 — AppleScript', 'T1059.003 — Windows Command Shell', 'T1059.004 — Unix Shell', 'T1059.005 — Visual Basic', 'T1059.006 — Python', 'T1059.007 — JavaScript', 'T1059.008 — Network Device CLI', 'T1059.009 — Cloud API'],
    severity: 'high',
    commonTools: ['PowerShell Empire', 'Cobalt Strike', 'Metasploit'],
  },
  {
    id: 'T1053',
    name: 'Scheduled Task/Job',
    tactic: 'Execution',
    description: 'Adversaries abuse task scheduling (cron, at, Windows Task Scheduler, systemd timers) to execute malicious code at defined intervals.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor task/job creation events', 'Windows Event ID 4698/4702', 'Crontab modification monitoring', 'Sysmon scheduled task events'],
    mitigations: ['Restrict task scheduling permissions', 'Monitor scheduled task/job creation', 'Application allowlisting'],
    subtechniques: ['T1053.002 — At', 'T1053.003 — Cron', 'T1053.005 — Scheduled Task', 'T1053.006 — Systemd Timers', 'T1053.007 — Container Orchestration Job'],
    severity: 'medium',
  },
  {
    id: 'T1204',
    name: 'User Execution',
    tactic: 'Execution',
    description: 'Adversaries rely on user interaction to execute malicious payloads — opening files, clicking links, or running programs.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor for unusual file executions after email/download', 'Process creation from Office/PDF applications', 'Script execution triggered by user actions'],
    mitigations: ['Security awareness training', 'Application allowlisting', 'Protected View in Office', 'Disable macros by default'],
    subtechniques: ['T1204.001 — Malicious Link', 'T1204.002 — Malicious File', 'T1204.003 — Malicious Image'],
    severity: 'high',
  },
  {
    id: 'T1106',
    name: 'Native API',
    tactic: 'Execution',
    description: 'Adversaries use the native OS API to execute behaviors. Direct syscalls can bypass user-mode hooks and API monitoring.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['API call monitoring via EDR', 'Syscall tracing (ETW, eBPF)', 'Anomalous API call patterns'],
    mitigations: ['Application allowlisting', 'Code integrity enforcement', 'EDR with kernel-level visibility'],
    severity: 'medium',
  },
  {
    id: 'T1203',
    name: 'Exploitation for Client Execution',
    tactic: 'Execution',
    description: 'Adversaries exploit vulnerabilities in client applications (browsers, Office, PDF readers) to execute code.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['EDR behavioral detection', 'Exploit guard / attack surface reduction rules', 'Crash dump analysis', 'Anomalous child processes from applications'],
    mitigations: ['Patch client applications', 'Application isolation/sandboxing', 'Exploit protection (DEP, ASLR, CFG)', 'Microsoft Attack Surface Reduction rules'],
    severity: 'high',
    commonTools: ['Browser exploits', 'Office macros', 'PDF exploits'],
  },

  // ── TACTIC 5: PERSISTENCE ─────────────────────────────────────────────
  {
    id: 'T1547',
    name: 'Boot or Logon Autostart Execution',
    tactic: 'Persistence',
    description: 'Adversaries configure system settings to execute programs on boot or logon. Registry run keys, startup folder, launch agents.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Registry monitoring (Run/RunOnce keys)', 'Startup folder monitoring', 'LaunchAgent/LaunchDaemon creation on macOS', 'Autoruns analysis'],
    mitigations: ['Restrict registry permissions', 'Monitor startup locations', 'Application allowlisting', 'Endpoint detection'],
    subtechniques: ['T1547.001 — Registry Run Keys / Startup Folder', 'T1547.002 — Authentication Package', 'T1547.004 — Winlogon Helper DLL', 'T1547.005 — Security Support Provider', 'T1547.009 — Shortcut Modification', 'T1547.011 — Plist Modification', 'T1547.012 — Print Processors', 'T1547.013 — XDG Autostart Entries', 'T1547.014 — Active Setup', 'T1547.015 — Login Items'],
    severity: 'high',
  },
  {
    id: 'T1136',
    name: 'Create Account',
    tactic: 'Persistence',
    description: 'Adversaries create new accounts for persistent access. Local accounts, domain accounts, or cloud accounts.',
    platforms: ['Windows', 'Linux', 'macOS', 'Azure AD', 'Google Workspace'],
    detection: ['Monitor account creation events (Windows Event ID 4720)', 'Alert on new accounts in privileged groups', 'Cloud audit logs for account creation', 'Anomalous account creation patterns'],
    mitigations: ['Restrict account creation permissions', 'Monitor for unauthorized accounts', 'Privileged access management', 'Regular account auditing'],
    subtechniques: ['T1136.001 — Local Account', 'T1136.002 — Domain Account', 'T1136.003 — Cloud Account'],
    severity: 'high',
  },
  {
    id: 'T1543',
    name: 'Create or Modify System Process',
    tactic: 'Persistence',
    description: 'Adversaries create or modify system-level processes (services, daemons, launch daemons) for persistent execution with elevated privileges.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Service creation events (Windows Event ID 7045)', 'Systemd unit file monitoring', 'LaunchDaemon plist creation monitoring', 'Anomalous service installations'],
    mitigations: ['Restrict service installation permissions', 'Code signing for services', 'Monitor service configurations'],
    subtechniques: ['T1543.001 — Launch Agent', 'T1543.002 — Systemd Service', 'T1543.003 — Windows Service', 'T1543.004 — Launch Daemon'],
    severity: 'high',
  },
  {
    id: 'T1546',
    name: 'Event Triggered Execution',
    tactic: 'Persistence',
    description: 'Adversaries establish persistence through event-triggered execution mechanisms — WMI subscriptions, .bashrc, trap commands, accessibility features.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['WMI subscription monitoring', 'Shell profile modification alerts', 'Trap command monitoring', 'Accessibility feature binary replacement detection'],
    mitigations: ['Restrict WMI permissions', 'Protect shell profiles', 'Monitor event subscription creation'],
    subtechniques: ['T1546.001 — Change Default File Association', 'T1546.002 — Screensaver', 'T1546.003 — WMI Event Subscription', 'T1546.004 — Unix Shell Configuration Modification', 'T1546.008 — Accessibility Features', 'T1546.012 — Image File Execution Options Injection', 'T1546.013 — PowerShell Profile', 'T1546.015 — Component Object Model Hijacking', 'T1546.016 — Installer Packages'],
    severity: 'high',
  },
  {
    id: 'T1505',
    name: 'Server Software Component',
    tactic: 'Persistence',
    description: 'Adversaries abuse server software components (web shells, IIS modules, SQL stored procedures, transport agents) for persistence on servers.',
    platforms: ['Windows', 'Linux'],
    detection: ['File integrity monitoring on web directories', 'Monitor for new IIS modules/ISAPI filters', 'Database stored procedure auditing', 'Web shell scanning tools'],
    mitigations: ['File integrity monitoring', 'Restrict web directory write permissions', 'Input validation', 'Regular web shell scans'],
    subtechniques: ['T1505.001 — SQL Stored Procedures', 'T1505.002 — Transport Agent', 'T1505.003 — Web Shell', 'T1505.004 — IIS Components', 'T1505.005 — Terminal Services DLL'],
    severity: 'critical',
    commonTools: ['China Chopper', 'WSO', 'b374k', 'p0wny-shell'],
  },
  {
    id: 'T1037',
    name: 'Boot or Logon Initialization Scripts',
    tactic: 'Persistence',
    description: 'Adversaries use boot/logon scripts (logon scripts, login hooks, startup scripts, RC scripts) for persistence and privilege escalation.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor logon script assignments via Group Policy', 'Track changes to /etc/rc.local, /etc/init.d/', 'macOS login hook monitoring'],
    mitigations: ['Restrict logon script assignment', 'Monitor initialization script changes', 'Limit boot-time script permissions'],
    subtechniques: ['T1037.001 — Logon Script (Windows)', 'T1037.002 — Login Hook', 'T1037.003 — Network Logon Script', 'T1037.004 — RC Scripts', 'T1037.005 — Startup Items'],
    severity: 'medium',
  },

  // ── TACTIC 6: PRIVILEGE ESCALATION ────────────────────────────────────
  {
    id: 'T1548',
    name: 'Abuse Elevation Control Mechanism',
    tactic: 'Privilege Escalation',
    description: 'Adversaries circumvent elevation controls (UAC, sudo, setuid) to gain higher privileges. Exploits trust mechanisms built into the OS.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor UAC bypass techniques', 'Sudo log analysis', 'Setuid/setgid binary monitoring', 'Anomalous privilege elevation events'],
    mitigations: ['UAC set to "Always Notify"', 'Restrict sudo access', 'Audit setuid/setgid binaries', 'Privilege access management'],
    subtechniques: ['T1548.001 — Setuid and Setgid', 'T1548.002 — Bypass User Account Control', 'T1548.003 — Sudo and Sudo Caching', 'T1548.004 — Elevated Execution with Prompt', 'T1548.005 — Temporary Elevated Cloud Access'],
    severity: 'high',
    commonTools: ['UACME', 'LinPEAS', 'GTFOBins'],
  },
  {
    id: 'T1134',
    name: 'Access Token Manipulation',
    tactic: 'Privilege Escalation',
    description: 'Adversaries manipulate access tokens to operate under a different security context. Token impersonation, theft, and creation.',
    platforms: ['Windows'],
    detection: ['Monitor for token manipulation API calls', 'Anomalous token usage patterns', 'Process creation with mismatched tokens', 'Event ID 4624 (Type 9 — NewCredentials)'],
    mitigations: ['Restrict token manipulation permissions', 'Privileged access management', 'Credential Guard', 'Least privilege enforcement'],
    subtechniques: ['T1134.001 — Token Impersonation/Theft', 'T1134.002 — Create Process with Token', 'T1134.003 — Make and Impersonate Token', 'T1134.004 — Parent PID Spoofing', 'T1134.005 — SID-History Injection'],
    severity: 'high',
    commonTools: ['Mimikatz', 'Incognito', 'Cobalt Strike'],
  },
  {
    id: 'T1068',
    name: 'Exploitation for Privilege Escalation',
    tactic: 'Privilege Escalation',
    description: 'Adversaries exploit software vulnerabilities to escalate privileges. Kernel exploits, service exploits, and application vulnerabilities.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Crash dump analysis', 'Anomalous kernel-mode activity', 'EDR behavioral detection', 'Exploit guard alerts'],
    mitigations: ['Patch management', 'Exploit protection (DEP, ASLR, SMAP, SMEP)', 'Application sandboxing', 'Kernel hardening'],
    severity: 'critical',
    commonTools: ['Dirty Pipe (CVE-2022-0847)', 'PrintNightmare', 'PwnKit (CVE-2021-4034)'],
  },
  {
    id: 'T1055',
    name: 'Process Injection',
    tactic: 'Privilege Escalation',
    description: 'Adversaries inject code into running processes to escalate privileges and evade defenses. The injected code runs in the context of the target process.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor for process injection API calls (WriteProcessMemory, NtMapViewOfSection)', 'Sysmon Event ID 8 (CreateRemoteThread)', 'Memory forensics for injected code', 'Anomalous DLL loading patterns'],
    mitigations: ['EDR with injection detection', 'Code integrity enforcement', 'Address Space Layout Randomization', 'Behavioral analysis'],
    subtechniques: ['T1055.001 — DLL Injection', 'T1055.002 — PE Injection', 'T1055.003 — Thread Execution Hijacking', 'T1055.004 — Asynchronous Procedure Call', 'T1055.005 — Thread Local Storage', 'T1055.008 — Ptrace System Calls', 'T1055.009 — Proc Memory', 'T1055.011 — Extra Window Memory Injection', 'T1055.012 — Process Hollowing', 'T1055.013 — Process Doppelganging', 'T1055.014 — VDSO Hijacking', 'T1055.015 — ListPlanting'],
    severity: 'critical',
    commonTools: ['Cobalt Strike', 'Metasploit', 'Donut'],
  },
  {
    id: 'T1574',
    name: 'Hijack Execution Flow',
    tactic: 'Privilege Escalation',
    description: 'Adversaries hijack the way an OS runs programs by placing malicious content where the system looks for legitimate programs (DLL hijacking, PATH manipulation, LD_PRELOAD).',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['DLL load monitoring', 'PATH variable analysis', 'LD_PRELOAD monitoring', 'Anomalous library loading patterns'],
    mitigations: ['Use fully qualified paths', 'DLL search order hardening', 'Code signing enforcement', 'Secure PATH configuration'],
    subtechniques: ['T1574.001 — DLL Search Order Hijacking', 'T1574.002 — DLL Side-Loading', 'T1574.004 — Dylib Hijacking', 'T1574.005 — Executable Installer File Permissions Weakness', 'T1574.006 — Dynamic Linker Hijacking', 'T1574.007 — Path Interception by PATH Environment Variable', 'T1574.008 — Path Interception by Search Order Hijacking', 'T1574.009 — Path Interception by Unquoted Path', 'T1574.010 — Services File Permissions Weakness', 'T1574.011 — Services Registry Permissions Weakness', 'T1574.012 — COR_PROFILER', 'T1574.013 — KernelCallbackTable', 'T1574.014 — AppDomainManager'],
    severity: 'high',
    commonTools: ['DLL sideloading toolkits', 'Robber'],
  },

  // ── TACTIC 7: DEFENSE EVASION ─────────────────────────────────────────
  {
    id: 'T1070',
    name: 'Indicator Removal',
    tactic: 'Defense Evasion',
    description: 'Adversaries delete or modify artifacts (logs, files, registry entries, timestamps) to remove evidence of intrusion.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Log forwarding to SIEM (prevents local deletion)', 'File integrity monitoring', 'Monitor for log clearing events (Event ID 1102)', 'Timestamp anomaly detection (timestomping)'],
    mitigations: ['Centralized logging (SIEM)', 'Write-once log storage', 'File integrity monitoring', 'Protected audit policies'],
    subtechniques: ['T1070.001 — Clear Windows Event Logs', 'T1070.002 — Clear Linux or Mac System Logs', 'T1070.003 — Clear Command History', 'T1070.004 — File Deletion', 'T1070.005 — Network Share Connection Removal', 'T1070.006 — Timestomp', 'T1070.007 — Clear Network Connection History and Configurations', 'T1070.008 — Clear Mailbox Data', 'T1070.009 — Clear Persistence'],
    severity: 'high',
    commonTools: ['wevtutil', 'Timestomp (Metasploit)', 'SDelete'],
  },
  {
    id: 'T1036',
    name: 'Masquerading',
    tactic: 'Defense Evasion',
    description: 'Adversaries masquerade malicious artifacts as legitimate ones — renaming files, matching legitimate process names, manipulating file metadata.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Hash verification of known-good binaries', 'File path anomalies (svchost.exe not in System32)', 'Signature verification', 'Metadata analysis (compilation timestamps, PE headers)'],
    mitigations: ['Code signing enforcement', 'Application allowlisting', 'File path validation policies'],
    subtechniques: ['T1036.001 — Invalid Code Signature', 'T1036.002 — Right-to-Left Override', 'T1036.003 — Rename System Utilities', 'T1036.004 — Masquerade Task or Service', 'T1036.005 — Match Legitimate Name or Location', 'T1036.006 — Space after Filename', 'T1036.007 — Double File Extension', 'T1036.008 — Masquerade File Type'],
    severity: 'medium',
  },
  {
    id: 'T1027',
    name: 'Obfuscated Files or Information',
    tactic: 'Defense Evasion',
    description: 'Adversaries obfuscate payloads and commands to hinder detection and analysis. Encoding, encryption, steganography, packing.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Entropy analysis of files', 'Decode/deobfuscate suspected payloads', 'Behavioral analysis after execution', 'AMSI (Antimalware Scan Interface) on Windows'],
    mitigations: ['Behavioral detection', 'AMSI integration', 'Deep content inspection', 'Sandboxing for detonation analysis'],
    subtechniques: ['T1027.001 — Binary Padding', 'T1027.002 — Software Packing', 'T1027.003 — Steganography', 'T1027.004 — Compile After Delivery', 'T1027.005 — Indicator Removal from Tools', 'T1027.006 — HTML Smuggling', 'T1027.007 — Dynamic API Resolution', 'T1027.008 — Stripped Payloads', 'T1027.009 — Embedded Payloads', 'T1027.010 — Command Obfuscation', 'T1027.011 — Fileless Storage', 'T1027.012 — LNK Icon Smuggling', 'T1027.013 — Encrypted/Encoded File', 'T1027.014 — Polymorphic Code'],
    severity: 'high',
    commonTools: ['UPX', 'Themida', 'Invoke-Obfuscation', 'Donut'],
  },
  {
    id: 'T1140',
    name: 'Deobfuscate/Decode Files or Information',
    tactic: 'Defense Evasion',
    description: 'Adversaries deobfuscate or decode data after delivery. Encoded payloads, encrypted configs, and compressed archives decoded at runtime.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor for certutil, base64, openssl decode operations', 'PowerShell script block logging', 'Behavioral analysis of decoded content'],
    mitigations: ['Application allowlisting', 'Script block logging', 'AMSI integration'],
    severity: 'medium',
  },
  {
    id: 'T1562',
    name: 'Impair Defenses',
    tactic: 'Defense Evasion',
    description: 'Adversaries disable or modify security tools, logging, and defensive mechanisms to avoid detection.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor for security tool process termination', 'EDR tamper protection alerts', 'Firewall rule modification monitoring', 'Audit policy change detection'],
    mitigations: ['Tamper protection on security tools', 'Protected Process Light for AV/EDR', 'Restrict access to security configurations', 'Alert on security tool stoppage'],
    subtechniques: ['T1562.001 — Disable or Modify Tools', 'T1562.002 — Disable Windows Event Logging', 'T1562.003 — Impair Command History Logging', 'T1562.004 — Disable or Modify System Firewall', 'T1562.006 — Indicator Blocking', 'T1562.007 — Disable or Modify Cloud Firewall', 'T1562.008 — Disable or Modify Cloud Logs', 'T1562.009 — Safe Mode Boot', 'T1562.010 — Downgrade Attack', 'T1562.011 — Spoof Security Alerting', 'T1562.012 — Disable or Modify Linux Audit System'],
    severity: 'critical',
  },
  {
    id: 'T1218',
    name: 'System Binary Proxy Execution',
    tactic: 'Defense Evasion',
    description: 'Adversaries use signed system binaries (LOLBins) to proxy execution of malicious content, bypassing application controls and signature validation.',
    platforms: ['Windows'],
    detection: ['Monitor LOLBin usage with unusual arguments', 'Track LOLBAS techniques (mshta, regsvr32, rundll32, etc.)', 'Command-line logging for proxy execution patterns'],
    mitigations: ['Application allowlisting with argument controls', 'Block or restrict LOLBin abuse', 'Script signing enforcement'],
    subtechniques: ['T1218.001 — Compiled HTML File', 'T1218.002 — Control Panel', 'T1218.003 — CMSTP', 'T1218.004 — InstallUtil', 'T1218.005 — Mshta', 'T1218.007 — Msiexec', 'T1218.008 — Odbcconf', 'T1218.009 — Regsvcs/Regasm', 'T1218.010 — Regsvr32', 'T1218.011 — Rundll32', 'T1218.012 — Verclsid', 'T1218.013 — Mavinject', 'T1218.014 — MMC'],
    severity: 'high',
    commonTools: ['LOLBAS (lolbas-project.github.io)', 'GTFOBins'],
  },
  {
    id: 'T1006',
    name: 'Direct Volume Access',
    tactic: 'Defense Evasion',
    description: 'Adversaries directly access logical drives to bypass file access controls, read locked files, and avoid triggering OS-level file access APIs.',
    platforms: ['Windows'],
    detection: ['Monitor for direct volume access API calls', 'Unusual access to \\\\.\\PhysicalDriveN', 'EDR detection of raw disk reads'],
    mitigations: ['Restrict raw volume access permissions', 'EDR monitoring'],
    severity: 'high',
  },

  // ── TACTIC 8: CREDENTIAL ACCESS ───────────────────────────────────────
  {
    id: 'T1003',
    name: 'OS Credential Dumping',
    tactic: 'Credential Access',
    description: 'Adversaries dump credentials from the OS. LSASS memory, SAM database, /etc/shadow, NTDS.dit, DCSync. Enables lateral movement.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['LSASS access monitoring (Sysmon Event ID 10)', 'EDR detection of credential dumping tools', 'Monitor for ntdsutil, secretsdump usage', 'DCSync detection via replication events'],
    mitigations: ['Credential Guard on Windows', 'LSASS process protection (PPL)', 'Restrict debug privilege', 'Disable WDigest authentication', 'Regular credential rotation'],
    subtechniques: ['T1003.001 — LSASS Memory', 'T1003.002 — Security Account Manager', 'T1003.003 — NTDS', 'T1003.004 — LSA Secrets', 'T1003.005 — Cached Domain Credentials', 'T1003.006 — DCSync', 'T1003.007 — Proc Filesystem', 'T1003.008 — /etc/passwd and /etc/shadow'],
    severity: 'critical',
    commonTools: ['Mimikatz', 'Secretsdump.py', 'LaZagne', 'Pypykatz'],
  },
  {
    id: 'T1110',
    name: 'Brute Force',
    tactic: 'Credential Access',
    description: 'Adversaries use brute force to crack passwords — password guessing, spraying, stuffing, and hash cracking.',
    platforms: ['Windows', 'Linux', 'macOS', 'SaaS'],
    detection: ['Multiple failed authentication attempts', 'Password spray patterns (many users, few passwords)', 'Credential stuffing from known breach lists', 'Account lockout events'],
    mitigations: ['Account lockout policies', 'MFA enforcement', 'Password complexity requirements', 'Rate limiting', 'CAPTCHA after failed attempts'],
    subtechniques: ['T1110.001 — Password Guessing', 'T1110.002 — Password Cracking', 'T1110.003 — Password Spraying', 'T1110.004 — Credential Stuffing'],
    severity: 'high',
    commonTools: ['Hashcat', 'John the Ripper', 'Hydra', 'CrackMapExec'],
  },
  {
    id: 'T1056',
    name: 'Input Capture',
    tactic: 'Credential Access',
    description: 'Adversaries capture user input (keylogging, GUI capture, web portal capture) to obtain credentials and other sensitive data.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor for keylogger indicators (API hooking, raw input capture)', 'Anomalous input capture API usage', 'Process behavior analysis'],
    mitigations: ['Endpoint protection', 'Virtual keyboards for sensitive input', 'Behavioral analysis'],
    subtechniques: ['T1056.001 — Keylogging', 'T1056.002 — GUI Input Capture', 'T1056.003 — Web Portal Capture', 'T1056.004 — Credential API Hooking'],
    severity: 'high',
  },
  {
    id: 'T1558',
    name: 'Steal or Forge Kerberos Tickets',
    tactic: 'Credential Access',
    description: 'Adversaries steal or forge Kerberos tickets for authentication abuse — Golden Ticket, Silver Ticket, Kerberoasting, AS-REP Roasting.',
    platforms: ['Windows'],
    detection: ['Kerberoasting: monitor for TGS requests with RC4 encryption', 'Golden Ticket: monitor for TGT with abnormal lifetime', 'AS-REP Roasting: accounts without pre-auth required', 'Event ID 4769 analysis'],
    mitigations: ['Managed Service Accounts (MSAs)', 'Strong service account passwords (25+ chars)', 'Disable RC4 for Kerberos', 'Enable Kerberos pre-authentication for all accounts', 'Monitor for Kerberos anomalies'],
    subtechniques: ['T1558.001 — Golden Ticket', 'T1558.002 — Silver Ticket', 'T1558.003 — Kerberoasting', 'T1558.004 — AS-REP Roasting'],
    severity: 'critical',
    commonTools: ['Rubeus', 'Impacket', 'Mimikatz', 'GetUserSPNs.py'],
  },
  {
    id: 'T1555',
    name: 'Credentials from Password Stores',
    tactic: 'Credential Access',
    description: 'Adversaries search password stores for credentials — browser password managers, OS credential managers, third-party password managers.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor access to browser credential files', 'Keychain access monitoring on macOS', 'Credential Manager access events on Windows'],
    mitigations: ['Use hardware-backed credential storage', 'Monitor password store access', 'Enterprise password managers with audit logging'],
    subtechniques: ['T1555.001 — Keychain', 'T1555.002 — Securityd Memory', 'T1555.003 — Credentials from Web Browsers', 'T1555.004 — Windows Credential Manager', 'T1555.005 — Password Managers', 'T1555.006 — Cloud Secrets Management Stores'],
    severity: 'high',
    commonTools: ['LaZagne', 'SharpChrome', 'BrowserStealer'],
  },
  {
    id: 'T1621',
    name: 'Multi-Factor Authentication Request Generation',
    tactic: 'Credential Access',
    description: 'Adversaries abuse MFA by generating repeated push notifications (MFA fatigue/bombing) until the user approves the request out of frustration.',
    platforms: ['SaaS', 'Azure AD', 'Google Workspace'],
    detection: ['Multiple MFA requests in short time window', 'MFA denial followed by approval', 'Anomalous authentication patterns', 'User-reported MFA bombing'],
    mitigations: ['Number matching MFA (not simple approve/deny)', 'MFA rate limiting', 'User education on MFA fatigue attacks', 'FIDO2/WebAuthn (phishing-resistant MFA)'],
    severity: 'high',
  },

  // ── TACTIC 9: DISCOVERY ───────────────────────────────────────────────
  {
    id: 'T1087',
    name: 'Account Discovery',
    tactic: 'Discovery',
    description: 'Adversaries enumerate accounts on a system or domain to understand the environment and identify high-value targets.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor for net user, net group commands', 'LDAP enumeration detection', 'AWS IAM enumeration', 'Unusual directory service queries'],
    mitigations: ['Restrict account enumeration permissions', 'Network segmentation', 'Limit LDAP query scope'],
    subtechniques: ['T1087.001 — Local Account', 'T1087.002 — Domain Account', 'T1087.003 — Email Account', 'T1087.004 — Cloud Account'],
    severity: 'low',
    commonTools: ['BloodHound', 'ADRecon', 'CrackMapExec', 'Enum4linux'],
  },
  {
    id: 'T1046',
    name: 'Network Service Discovery',
    tactic: 'Discovery',
    description: 'Adversaries scan for running services on remote hosts. Port scanning, service enumeration, banner grabbing.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Internal network scan detection', 'Unusual port scanning patterns', 'IDS for scanning signatures', 'Netflow analysis'],
    mitigations: ['Network segmentation', 'Host-based firewall', 'Disable unnecessary services', 'Micro-segmentation'],
    severity: 'low',
    commonTools: ['Nmap', 'Masscan', 'Rustscan'],
  },
  {
    id: 'T1082',
    name: 'System Information Discovery',
    tactic: 'Discovery',
    description: 'Adversaries gather detailed system information (OS version, hostname, hardware, patches) for further exploitation.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor for systeminfo, uname, hostnamectl commands', 'WMI queries for system information', 'Unusual system enumeration patterns'],
    mitigations: ['Limit information exposure', 'Monitor enumeration commands', 'EDR behavioral baselines'],
    severity: 'low',
  },
  {
    id: 'T1057',
    name: 'Process Discovery',
    tactic: 'Discovery',
    description: 'Adversaries list running processes to understand the software environment, identify security tools, and find targets for injection.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor for tasklist, ps, Get-Process usage', 'Anomalous process enumeration frequency', 'Process list queries from unexpected contexts'],
    mitigations: ['Restrict process listing permissions where possible', 'EDR monitoring'],
    severity: 'low',
  },
  {
    id: 'T1018',
    name: 'Remote System Discovery',
    tactic: 'Discovery',
    description: 'Adversaries enumerate remote systems on the network for lateral movement planning. ARP scanning, ping sweeps, net view, LDAP queries.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['ARP and ICMP sweep detection', 'Anomalous LDAP queries for computer objects', 'Network scanning from unusual hosts'],
    mitigations: ['Network segmentation', 'Limit broadcast traffic', 'Restrict LDAP query scope'],
    severity: 'low',
    commonTools: ['BloodHound', 'ADRecon', 'Nmap', 'arp-scan'],
  },
  {
    id: 'T1654',
    name: 'Log Enumeration',
    tactic: 'Discovery',
    description: 'Adversaries enumerate system and security logs to understand defensive capabilities and identify blind spots.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor for unusual log file access', 'Track queries to event log services', 'Anomalous access to /var/log/ directory'],
    mitigations: ['Restrict log file permissions', 'Monitor log access patterns', 'Centralized logging reduces local log value'],
    severity: 'low',
  },

  // ── TACTIC 10: LATERAL MOVEMENT ───────────────────────────────────────
  {
    id: 'T1021',
    name: 'Remote Services',
    tactic: 'Lateral Movement',
    description: 'Adversaries use remote services (RDP, SSH, SMB/Admin Shares, WinRM, VNC, distributed COM) to move laterally between systems.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor remote login events', 'Track unusual RDP/SSH connections', 'Lateral movement detection via graph analysis', 'Anomalous administrative share access'],
    mitigations: ['MFA for remote access', 'Network segmentation', 'Restrict admin shares', 'Just-in-time access', 'Privileged Access Workstations'],
    subtechniques: ['T1021.001 — Remote Desktop Protocol', 'T1021.002 — SMB/Windows Admin Shares', 'T1021.003 — Distributed Component Object Model', 'T1021.004 — SSH', 'T1021.005 — VNC', 'T1021.006 — Windows Remote Management', 'T1021.007 — Cloud Services', 'T1021.008 — Direct Cloud VM Connections'],
    severity: 'high',
    commonTools: ['PsExec', 'CrackMapExec', 'Evil-WinRM', 'Impacket'],
  },
  {
    id: 'T1570',
    name: 'Lateral Tool Transfer',
    tactic: 'Lateral Movement',
    description: 'Adversaries transfer tools between systems within the compromised network using SMB, SCP, RDP clipboard, or other file transfer methods.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor internal file transfers between workstations', 'SMB file copy detection', 'Anomalous file creation on remote systems', 'Unusual use of certutil, bitsadmin for internal transfers'],
    mitigations: ['Network segmentation', 'Application allowlisting', 'Monitor internal file sharing patterns'],
    severity: 'medium',
  },
  {
    id: 'T1210',
    name: 'Exploitation of Remote Services',
    tactic: 'Lateral Movement',
    description: 'Adversaries exploit vulnerabilities in internal remote services (SMB, RDP, databases, web apps) to move laterally. EternalBlue, BlueKeep, ProxyLogon.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Vulnerability scanning of internal services', 'IDS for known exploit signatures', 'Crash/restart of internal services', 'Network anomaly detection'],
    mitigations: ['Patch internal services promptly', 'Network segmentation', 'Disable unnecessary services', 'Virtual patching via IPS'],
    severity: 'critical',
    commonTools: ['Metasploit', 'EternalBlue', 'ProxyShell exploits'],
  },
  {
    id: 'T1550',
    name: 'Use Alternate Authentication Material',
    tactic: 'Lateral Movement',
    description: 'Adversaries use alternate authentication material (hashes, tickets, tokens, cookies, certificates) instead of passwords for lateral movement.',
    platforms: ['Windows', 'Linux', 'macOS', 'SaaS'],
    detection: ['Pass-the-hash detection via NTLM analysis', 'Anomalous Kerberos ticket usage', 'Stolen session cookie detection', 'Certificate-based auth anomalies'],
    mitigations: ['Credential Guard', 'Disable NTLM where possible', 'Session token rotation', 'Certificate-based auth with hardware tokens'],
    subtechniques: ['T1550.001 — Application Access Token', 'T1550.002 — Pass the Hash', 'T1550.003 — Pass the Ticket', 'T1550.004 — Web Session Cookie'],
    severity: 'high',
    commonTools: ['Mimikatz', 'Impacket (wmiexec, smbexec)', 'Rubeus'],
  },

  // ── TACTIC 11: COLLECTION ─────────────────────────────────────────────
  {
    id: 'T1005',
    name: 'Data from Local System',
    tactic: 'Collection',
    description: 'Adversaries collect sensitive data from the local system — documents, databases, credentials, configs, source code.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor for mass file access patterns', 'DLP for sensitive data movement', 'Anomalous file read operations', 'Large archive creation'],
    mitigations: ['Data classification and DLP', 'Encrypt sensitive data at rest', 'File access auditing', 'Least privilege file permissions'],
    severity: 'high',
  },
  {
    id: 'T1114',
    name: 'Email Collection',
    tactic: 'Collection',
    description: 'Adversaries collect email data from mailboxes, mail servers, and mail forwarding rules. Targets sensitive communications and credentials.',
    platforms: ['Windows', 'Office 365', 'Google Workspace'],
    detection: ['Monitor for mailbox access by unusual accounts', 'Detect new mail forwarding rules', 'EWS/Graph API access anomalies', 'OAuth consent grant monitoring'],
    mitigations: ['Restrict mailbox delegation', 'Monitor for mail forwarding rules', 'Audit OAuth app permissions', 'Alert on bulk email access'],
    subtechniques: ['T1114.001 — Local Email Collection', 'T1114.002 — Remote Email Collection', 'T1114.003 — Email Forwarding Rule'],
    severity: 'high',
    commonTools: ['MailSniper', 'Ruler', 'GraphRunner'],
  },
  {
    id: 'T1113',
    name: 'Screen Capture',
    tactic: 'Collection',
    description: 'Adversaries capture screenshots to collect information displayed on the screen — passwords, sensitive documents, application data.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor for screenshot API calls', 'Unusual image file creation patterns', 'Screen capture utility execution'],
    mitigations: ['Application-level screen capture restrictions', 'DLP for image files', 'Watermarking sensitive screens'],
    severity: 'medium',
  },
  {
    id: 'T1115',
    name: 'Clipboard Data',
    tactic: 'Collection',
    description: 'Adversaries collect data stored in the clipboard. Password managers, copy-paste of credentials, sensitive documents.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Clipboard access monitoring', 'Anomalous clipboard read frequency', 'EDR clipboard hook detection'],
    mitigations: ['Clipboard clearing after sensitive operations', 'Password manager auto-type instead of copy', 'EDR monitoring'],
    severity: 'medium',
  },
  {
    id: 'T1560',
    name: 'Archive Collected Data',
    tactic: 'Collection',
    description: 'Adversaries compress and/or encrypt collected data before exfiltration. Reduces transfer size and evades DLP content inspection.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor for archiving utility usage (7z, rar, zip, tar)', 'Large archive file creation', 'Encrypted archive creation', 'Unusual compression from non-standard paths'],
    mitigations: ['Monitor archiving tool usage', 'DLP for archive files', 'Restrict archiving tool access'],
    subtechniques: ['T1560.001 — Archive via Utility', 'T1560.002 — Archive via Library', 'T1560.003 — Archive via Custom Method'],
    severity: 'medium',
  },

  // ── TACTIC 12: COMMAND AND CONTROL ────────────────────────────────────
  {
    id: 'T1071',
    name: 'Application Layer Protocol',
    tactic: 'Command and Control',
    description: 'Adversaries use application layer protocols (HTTP/S, DNS, SMTP, WebSockets) for C2 to blend with normal traffic.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Deep packet inspection', 'DNS anomaly detection (long queries, high frequency)', 'HTTPS certificate analysis', 'Beacon pattern detection (periodic callbacks)', 'JA3/JA3S fingerprinting'],
    mitigations: ['SSL/TLS inspection', 'DNS filtering', 'Network traffic analysis', 'Application-aware firewalls'],
    subtechniques: ['T1071.001 — Web Protocols', 'T1071.002 — File Transfer Protocols', 'T1071.003 — Mail Protocols', 'T1071.004 — DNS'],
    severity: 'high',
    commonTools: ['Cobalt Strike', 'Sliver', 'Covenant', 'DNS-over-HTTPS tunneling'],
  },
  {
    id: 'T1573',
    name: 'Encrypted Channel',
    tactic: 'Command and Control',
    description: 'Adversaries encrypt C2 communications to prevent content inspection. Custom encryption, standard protocols (TLS), or asymmetric cryptography.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['JA3/JA3S TLS fingerprinting', 'Certificate analysis (self-signed, short-lived)', 'Encrypted traffic volume anomalies', 'Behavioral analysis of encrypted sessions'],
    mitigations: ['SSL/TLS inspection (MITM proxy)', 'Certificate pinning monitoring', 'Network behavioral analysis'],
    subtechniques: ['T1573.001 — Symmetric Cryptography', 'T1573.002 — Asymmetric Cryptography'],
    severity: 'high',
  },
  {
    id: 'T1090',
    name: 'Proxy',
    tactic: 'Command and Control',
    description: 'Adversaries use proxies to route C2 traffic through intermediaries. Internal proxies, external proxies, multi-hop proxies, domain fronting.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor for unexpected proxy usage', 'Domain fronting detection', 'Multi-hop connection analysis', 'Tor exit node detection'],
    mitigations: ['Block known proxy services', 'SSL inspection for domain fronting', 'Network segmentation'],
    subtechniques: ['T1090.001 — Internal Proxy', 'T1090.002 — External Proxy', 'T1090.003 — Multi-hop Proxy', 'T1090.004 — Domain Fronting'],
    severity: 'high',
    commonTools: ['Cloudflare Workers', 'AWS CloudFront domain fronting', 'Tor', 'Chisel'],
  },
  {
    id: 'T1132',
    name: 'Data Encoding',
    tactic: 'Command and Control',
    description: 'Adversaries encode C2 data to make it harder to detect. Base64, custom encoding schemes, protocol-specific encoding.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Base64 detection in DNS queries', 'Anomalous HTTP header/parameter values', 'Statistical analysis of traffic entropy'],
    mitigations: ['Deep packet inspection', 'DNS content analysis', 'Behavioral traffic analysis'],
    subtechniques: ['T1132.001 — Standard Encoding', 'T1132.002 — Non-Standard Encoding'],
    severity: 'medium',
  },
  {
    id: 'T1102',
    name: 'Web Service',
    tactic: 'Command and Control',
    description: 'Adversaries use legitimate web services (social media, cloud storage, paste sites, CDNs) for C2. Hard to block without disrupting business.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor for unusual API calls to cloud services', 'Traffic volume anomalies to web services', 'Behavioral analysis of web service usage patterns'],
    mitigations: ['Cloud access security broker (CASB)', 'Monitor API usage to cloud services', 'Restrict web service access where feasible'],
    subtechniques: ['T1102.001 — Dead Drop Resolver', 'T1102.002 — Bidirectional Communication', 'T1102.003 — One-Way Communication'],
    severity: 'high',
    commonTools: ['Slack C2', 'Discord C2', 'Telegram bots', 'Pastebin', 'GitHub/GitLab pages'],
  },
  {
    id: 'T1001',
    name: 'Data Obfuscation',
    tactic: 'Command and Control',
    description: 'Adversaries obfuscate C2 traffic to evade detection — junk data, steganography, protocol impersonation.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Deep packet inspection', 'Statistical traffic analysis', 'Protocol conformance checking', 'Steganography detection tools'],
    mitigations: ['Network traffic analysis', 'Protocol validation', 'Behavioral anomaly detection'],
    subtechniques: ['T1001.001 — Junk Data', 'T1001.002 — Steganography', 'T1001.003 — Protocol Impersonation'],
    severity: 'medium',
  },

  // ── TACTIC 13: EXFILTRATION ───────────────────────────────────────────
  {
    id: 'T1041',
    name: 'Exfiltration Over C2 Channel',
    tactic: 'Exfiltration',
    description: 'Adversaries exfiltrate data over the existing C2 channel. Most common exfiltration method — reuses established covert communication.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Monitor C2 channel for data volume anomalies', 'Outbound transfer size analysis', 'Beacon data size deviation', 'DLP on C2 endpoints'],
    mitigations: ['Network DLP', 'Egress filtering', 'Network traffic analysis', 'Data classification and monitoring'],
    severity: 'high',
  },
  {
    id: 'T1048',
    name: 'Exfiltration Over Alternative Protocol',
    tactic: 'Exfiltration',
    description: 'Adversaries exfiltrate data using a different protocol than C2 — DNS tunneling, ICMP tunneling, HTTP/S to different endpoints.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['DNS tunnel detection (query length, frequency)', 'ICMP payload analysis', 'Unusual protocol usage patterns', 'Anomalous outbound connections'],
    mitigations: ['Egress filtering', 'DNS monitoring', 'Protocol-aware firewalls', 'Data loss prevention'],
    subtechniques: ['T1048.001 — Exfiltration Over Symmetric Encrypted Non-C2 Protocol', 'T1048.002 — Exfiltration Over Asymmetric Encrypted Non-C2 Protocol', 'T1048.003 — Exfiltration Over Unencrypted Non-C2 Protocol'],
    severity: 'high',
    commonTools: ['Iodine (DNS tunnel)', 'dnscat2', 'icmpsh'],
  },
  {
    id: 'T1567',
    name: 'Exfiltration Over Web Service',
    tactic: 'Exfiltration',
    description: 'Adversaries exfiltrate data to cloud storage and web services (Google Drive, Dropbox, OneDrive, Mega, S3, Azure Blob). Hard to distinguish from normal usage.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['CASB monitoring for unusual uploads', 'DLP for cloud storage services', 'Volume anomaly detection', 'Unusual cloud storage API usage'],
    mitigations: ['Cloud access security broker', 'DLP integration with cloud services', 'Restrict personal cloud storage', 'Monitor cloud storage API usage'],
    subtechniques: ['T1567.001 — Exfiltration to Code Repository', 'T1567.002 — Exfiltration to Cloud Storage', 'T1567.003 — Exfiltration to Text Storage Sites', 'T1567.004 — Exfiltration Over Webhook'],
    severity: 'high',
  },
  {
    id: 'T1011',
    name: 'Exfiltration Over Other Network Medium',
    tactic: 'Exfiltration',
    description: 'Adversaries exfiltrate data over a different network medium than C2 — WiFi, Bluetooth, cellular, RF signals.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Wireless traffic monitoring', 'Bluetooth device enumeration', 'RF signal detection', 'Network device inventory'],
    mitigations: ['Disable unused wireless interfaces', 'RF shielding for sensitive areas', 'Wireless intrusion prevention'],
    subtechniques: ['T1011.001 — Exfiltration Over Bluetooth'],
    severity: 'medium',
  },
  {
    id: 'T1052',
    name: 'Exfiltration Over Physical Medium',
    tactic: 'Exfiltration',
    description: 'Adversaries exfiltrate data via physical media — USB drives, external hard drives, optical media. Bypasses network monitoring entirely.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['USB device connection monitoring', 'DLP for removable media', 'Physical access monitoring', 'File copy to removable media detection'],
    mitigations: ['Disable USB storage devices', 'DLP for removable media', 'Physical security controls', 'Port blockers'],
    subtechniques: ['T1052.001 — Exfiltration over USB'],
    severity: 'medium',
  },

  // ── TACTIC 14: IMPACT ─────────────────────────────────────────────────
  {
    id: 'T1485',
    name: 'Data Destruction',
    tactic: 'Impact',
    description: 'Adversaries destroy data on specific systems or across a network to disrupt operations. Ransomware without recovery, wiper malware.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Mass file deletion/modification detection', 'Unusual write patterns to disk', 'MBR/VBR modification detection', 'Anomalous file system activity'],
    mitigations: ['Offline/immutable backups', 'Backup verification testing', 'Network segmentation', 'Data replication'],
    severity: 'critical',
    commonTools: ['NotPetya', 'WhisperGate', 'HermeticWiper', 'CaddyWiper'],
  },
  {
    id: 'T1486',
    name: 'Data Encrypted for Impact',
    tactic: 'Impact',
    description: 'Adversaries encrypt data to render it inaccessible — ransomware. Most financially motivated attack vector. Often combined with data exfiltration (double extortion).',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Rapid file extension changes', 'Entropy increase in file content', 'Mass file rename operations', 'Ransomware note file creation', 'Volume shadow copy deletion'],
    mitigations: ['Offline/immutable backups', 'EDR with ransomware protection', 'Application allowlisting', 'Network segmentation', 'Restrict admin privileges'],
    severity: 'critical',
    commonTools: ['LockBit', 'BlackCat/ALPHV', 'Royal', 'Play', 'Akira'],
  },
  {
    id: 'T1491',
    name: 'Defacement',
    tactic: 'Impact',
    description: 'Adversaries deface internal or external systems to deliver messages, intimidate, or damage reputation.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['File integrity monitoring on web content', 'Visual change detection for websites', 'Content hash verification'],
    mitigations: ['File integrity monitoring', 'Web application firewall', 'Backup web content', 'Restrict web directory write permissions'],
    subtechniques: ['T1491.001 — Internal Defacement', 'T1491.002 — External Defacement'],
    severity: 'medium',
  },
  {
    id: 'T1561',
    name: 'Disk Wipe',
    tactic: 'Impact',
    description: 'Adversaries wipe disk data structures (MBR, partition table) or content to make systems unbootable or data unrecoverable.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Raw disk write monitoring', 'MBR/partition table modification detection', 'Mass disk I/O anomalies'],
    mitigations: ['Immutable backups', 'Boot integrity verification (Secure Boot, UEFI)', 'Network segmentation'],
    subtechniques: ['T1561.001 — Disk Content Wipe', 'T1561.002 — Disk Structure Wipe'],
    severity: 'critical',
  },
  {
    id: 'T1496',
    name: 'Resource Hijacking',
    tactic: 'Impact',
    description: 'Adversaries hijack computing resources for cryptocurrency mining, distributed computing, or other resource-intensive tasks.',
    platforms: ['Windows', 'Linux', 'macOS', 'Containers'],
    detection: ['CPU/GPU usage anomalies', 'Cryptomining process detection', 'Network connections to mining pools', 'Cloud billing anomalies'],
    mitigations: ['Application allowlisting', 'Container security policies', 'Cloud resource monitoring and budgets', 'EDR detection of mining software'],
    severity: 'medium',
    commonTools: ['XMRig', 'Coinhive (deprecated)', 'Cloud instance abuse'],
  },
  {
    id: 'T1531',
    name: 'Account Access Removal',
    tactic: 'Impact',
    description: 'Adversaries delete, lock, or manipulate accounts to prevent legitimate users from accessing systems. Disrupts operations and recovery.',
    platforms: ['Windows', 'Linux', 'macOS', 'SaaS'],
    detection: ['Mass account deletion/lockout events', 'Password change anomalies', 'MFA removal detection', 'Administrative account modification'],
    mitigations: ['Restrict account modification privileges', 'Break-glass accounts', 'Multi-person approval for bulk account changes', 'Backup of directory services'],
    severity: 'high',
  },
  {
    id: 'T1499',
    name: 'Endpoint Denial of Service',
    tactic: 'Impact',
    description: 'Adversaries perform DoS attacks targeting application or system availability — application exhaustion, OS exhaustion, service-specific attacks.',
    platforms: ['Windows', 'Linux', 'macOS'],
    detection: ['Resource utilization monitoring', 'Application performance monitoring', 'Connection rate analysis', 'Service availability checks'],
    mitigations: ['Rate limiting', 'Application-level DoS protection', 'Auto-scaling', 'WAF/CDN for application protection'],
    subtechniques: ['T1499.001 — OS Exhaustion Flood', 'T1499.002 — Service Exhaustion Flood', 'T1499.003 — Application Exhaustion Flood', 'T1499.004 — Application or System Exploitation'],
    severity: 'high',
  },
  {
    id: 'T1498',
    name: 'Network Denial of Service',
    tactic: 'Impact',
    description: 'Adversaries perform network-level DoS attacks to degrade or disrupt connectivity — volumetric floods, amplification attacks, protocol abuse.',
    platforms: ['Network'],
    detection: ['Volumetric traffic analysis', 'Protocol anomaly detection', 'BGP route monitoring', 'DDoS detection systems'],
    mitigations: ['DDoS mitigation services (Cloudflare, AWS Shield)', 'Rate limiting', 'Network redundancy', 'Traffic scrubbing'],
    subtechniques: ['T1498.001 — Direct Network Flood', 'T1498.002 — Reflection Amplification'],
    severity: 'high',
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// OWASP TOP 10 (2025)
// Includes the two new entries: A03 Software Supply Chain Failures,
// A10 Mishandling Exceptional Conditions
// ═══════════════════════════════════════════════════════════════════════════

const OWASP_2025: OWASPEntry[] = [
  {
    id: 'A01',
    name: 'Broken Access Control',
    description: 'Access control enforces policy such that users cannot act outside their intended permissions. Failures lead to unauthorized information disclosure, modification, or destruction of data, or performing business functions outside the user\'s limits.',
    exampleAttack: 'Attacker modifies the URL parameter from /api/users/123 to /api/users/456 (IDOR) and accesses another user\'s data. Or attacker elevates role by modifying the JWT payload from "role":"user" to "role":"admin" when the server trusts client-supplied role claims.',
    detection: [
      'Automated DAST scanning for IDOR vulnerabilities',
      'Log analysis for cross-account access patterns',
      'Penetration testing with privilege escalation focus',
      'Monitor for sequential ID enumeration in API logs',
      'JWT integrity validation auditing',
    ],
    remediation: [
      'Deny by default — require explicit grants',
      'Implement server-side access control checks on every request',
      'Use indirect object references (UUIDs instead of sequential IDs)',
      'Disable directory listing and ensure metadata files are not accessible',
      'Log access control failures and alert on repeated attempts',
      'Rate-limit API requests to minimize automated abuse',
      'Invalidate sessions on server side after logout',
    ],
    codePattern: `// BAD: Direct object reference with no auth check
app.get('/api/users/:id', (req, res) => {
  return db.users.findById(req.params.id) // Anyone can access any user!
})

// GOOD: Server-side ownership check
app.get('/api/users/:id', authenticate, (req, res) => {
  if (req.user.id !== req.params.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  return db.users.findById(req.params.id)
})`,
    severity: 'critical',
    cweIds: ['CWE-200', 'CWE-284', 'CWE-285', 'CWE-352', 'CWE-639'],
  },
  {
    id: 'A02',
    name: 'Security Misconfiguration',
    description: 'Application is insecure due to missing security hardening, overly permissive configurations, default credentials, verbose error messages, unnecessary features enabled, or missing security headers.',
    exampleAttack: 'Attacker discovers admin console at /admin with default credentials admin/admin. Stack traces in production expose internal paths, framework versions, and SQL queries. S3 bucket left public exposes customer PII.',
    detection: [
      'Automated configuration scanning (ScoutSuite, Prowler)',
      'HTTP security header verification',
      'Default credential scanning',
      'Cloud security posture management (CSPM)',
      'Regular security baseline audits',
    ],
    remediation: [
      'Implement security hardening checklist for each deployment',
      'Remove default accounts and change default passwords',
      'Disable directory listing, stack traces, and debug modes in production',
      'Set proper security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)',
      'Review cloud permissions with least-privilege principle',
      'Automate configuration validation in CI/CD pipeline',
    ],
    codePattern: `// BAD: Verbose error messages in production
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.stack }) // Exposes internals!
})

// GOOD: Generic errors in production, details in dev
app.use((err, req, res, next) => {
  logger.error(err) // Log full error internally
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message
  res.status(500).json({ error: message })
})

// GOOD: Security headers
app.use(helmet({
  contentSecurityPolicy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true },
  frameguard: { action: 'deny' },
  noSniff: true,
}))`,
    severity: 'high',
    cweIds: ['CWE-16', 'CWE-209', 'CWE-215', 'CWE-548', 'CWE-732'],
  },
  {
    id: 'A03',
    name: 'Software Supply Chain Failures',
    description: 'NEW in 2025. Vulnerabilities introduced through third-party components, build pipelines, CI/CD systems, and dependency management. Includes dependency confusion, typosquatting, compromised packages, and build system attacks.',
    exampleAttack: 'Attacker publishes a malicious npm package "lod-ash" (typosquatting "lodash"). A developer installs it, and the postinstall script exfiltrates environment variables including API keys. Or: attacker compromises a GitHub Action used in CI/CD and injects a backdoor into the build output.',
    detection: [
      'Software Composition Analysis (SCA) in CI/CD',
      'SBOM generation and monitoring',
      'Package integrity verification (checksums, signatures)',
      'Build reproducibility verification',
      'CI/CD pipeline audit logging',
      'Monitor for dependency confusion attacks',
      'Lock file integrity verification',
    ],
    remediation: [
      'Pin dependency versions with lockfiles (package-lock.json, yarn.lock)',
      'Verify package integrity with checksums and signatures',
      'Use private registries/proxies for internal packages',
      'Implement SBOM generation and vulnerability tracking',
      'Audit and pin CI/CD action versions by commit SHA',
      'Review new dependencies before adding them (npm audit, Snyk)',
      'Enable npm provenance to verify package origins',
      'Use --ignore-scripts for untrusted packages',
    ],
    codePattern: `// BAD: Unpinned dependency with lifecycle scripts
{
  "dependencies": {
    "some-package": "^2.0.0"  // Floating version + postinstall runs
  }
}

// GOOD: Pinned, audited, lockfile committed
{
  "dependencies": {
    "some-package": "2.1.3"  // Exact version
  },
  "scripts": {
    "preinstall": "npx only-allow pnpm",  // Enforce package manager
    "audit": "npm audit --audit-level=high"
  },
  "overrides": {
    "vulnerable-transitive": ">=2.0.1"  // Force-patch transitives
  }
}

// CI/CD: Pin GitHub Actions by SHA
// BAD:  uses: actions/checkout@v4
// GOOD: uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11`,
    severity: 'critical',
    cweIds: ['CWE-426', 'CWE-427', 'CWE-506', 'CWE-829', 'CWE-1104'],
  },
  {
    id: 'A04',
    name: 'Cryptographic Failures',
    description: 'Failures related to cryptography that lead to exposure of sensitive data. Weak algorithms, improper key management, missing encryption in transit/at rest, hard-coded secrets.',
    exampleAttack: 'Application uses MD5 for password hashing. Attacker obtains database dump and cracks passwords using rainbow tables in minutes. Or: API transmits authentication tokens over HTTP without TLS, allowing network interception.',
    detection: [
      'TLS configuration scanning (SSLLabs, testssl.sh)',
      'Code scanning for weak crypto (MD5, SHA1, DES, RC4)',
      'Secret scanning in repositories',
      'Certificate expiry monitoring',
      'Data-at-rest encryption audit',
    ],
    remediation: [
      'Use strong hashing for passwords (bcrypt, scrypt, Argon2id)',
      'Enforce TLS 1.2+ for all connections',
      'Encrypt sensitive data at rest (AES-256-GCM)',
      'Use secure random number generators (crypto.randomBytes)',
      'Implement proper key management (rotation, secure storage)',
      'Disable weak cipher suites and protocols',
      'Use authenticated encryption (GCM, ChaCha20-Poly1305)',
    ],
    codePattern: `// BAD: Weak password hashing
const hash = crypto.createHash('md5').update(password).digest('hex')

// GOOD: Strong password hashing
import bcrypt from 'bcrypt'
const SALT_ROUNDS = 12
const hash = await bcrypt.hash(password, SALT_ROUNDS)
const isValid = await bcrypt.compare(password, storedHash)

// BAD: Hard-coded encryption key
const key = 'my-secret-key-12345'

// GOOD: Key from secure source
const key = process.env.ENCRYPTION_KEY  // Injected at runtime
// Or better: use a KMS (AWS KMS, HashiCorp Vault)`,
    severity: 'critical',
    cweIds: ['CWE-261', 'CWE-296', 'CWE-310', 'CWE-319', 'CWE-326', 'CWE-327', 'CWE-328', 'CWE-338'],
  },
  {
    id: 'A05',
    name: 'Injection',
    description: 'User-supplied data is sent to an interpreter without proper validation, sanitization, or parameterization. Includes SQL injection, NoSQL injection, OS command injection, LDAP injection, XSS, and template injection.',
    exampleAttack: 'Attacker enters \' OR 1=1-- in the login form, bypassing authentication. Or: attacker injects {{7*7}} in a template field and sees "49" rendered, confirming server-side template injection. Then escalates to RCE via {{constructor.constructor("return process")().mainModule.require("child_process").execSync("id")}}.',
    detection: [
      'SAST for injection vulnerabilities',
      'DAST/IAST scanning',
      'WAF with injection detection rules',
      'Input validation logging',
      'Parameterized query audit',
    ],
    remediation: [
      'Use parameterized queries / prepared statements for ALL database operations',
      'Use ORM with proper escaping',
      'Validate and sanitize all user input on the server side',
      'Implement Content Security Policy to mitigate XSS',
      'Use context-aware output encoding',
      'Avoid dynamic code execution (eval, Function constructor)',
      'Use allowlists for expected input patterns',
    ],
    codePattern: `// BAD: SQL injection
const query = \`SELECT * FROM users WHERE name = '\${userInput}'\`
db.query(query)

// GOOD: Parameterized query
const query = 'SELECT * FROM users WHERE name = $1'
db.query(query, [userInput])

// BAD: Command injection
exec(\`ls \${userInput}\`)

// GOOD: Escaped/validated input
import { execFile } from 'child_process'
execFile('ls', [sanitizedPath])  // Array args prevent injection

// BAD: XSS — unescaped output
element.innerHTML = userInput

// GOOD: Text content or sanitization
element.textContent = userInput  // Auto-escaped
// Or: DOMPurify.sanitize(userInput) if HTML is needed`,
    severity: 'critical',
    cweIds: ['CWE-20', 'CWE-74', 'CWE-75', 'CWE-77', 'CWE-78', 'CWE-79', 'CWE-89', 'CWE-94', 'CWE-917'],
  },
  {
    id: 'A06',
    name: 'Insecure Design',
    description: 'Flaws in the design and architecture of the application that cannot be fixed by implementation alone. Missing threat modeling, insecure business logic, lack of defense in depth.',
    exampleAttack: 'E-commerce site allows unlimited coupon application — attacker applies same 10% coupon 10 times to get item for free. Or: password reset sends a 4-digit PIN via SMS with no rate limiting, allowing brute force in ~5,000 attempts.',
    detection: [
      'Threat modeling during design phase',
      'Architecture review for security patterns',
      'Business logic testing',
      'Abuse case / misuse case analysis',
      'Design review with security team',
    ],
    remediation: [
      'Implement threat modeling (STRIDE, PASTA) in the design phase',
      'Design with defense in depth — assume each layer can be bypassed',
      'Rate limit all sensitive operations',
      'Use secure design patterns (fail-safe defaults, complete mediation)',
      'Separate business logic from data access',
      'Implement abuse/misuse stories alongside user stories',
      'Design for the adversary, not just the user',
    ],
    codePattern: `// BAD: No rate limiting on sensitive endpoint
app.post('/api/reset-password', (req, res) => {
  const pin = generatePin()  // 4-digit PIN
  sendSMS(req.body.phone, pin)
  // Attacker brute-forces 0000-9999 in minutes
})

// GOOD: Rate limiting + longer token + expiry
import rateLimit from 'express-rate-limit'
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 3 })
app.post('/api/reset-password', resetLimiter, (req, res) => {
  const token = crypto.randomBytes(32).toString('hex')  // 256-bit token
  storeToken(req.body.email, token, { expiresIn: '15m' })
  sendEmail(req.body.email, \`Reset link: .../reset?token=\${token}\`)
})`,
    severity: 'high',
    cweIds: ['CWE-73', 'CWE-183', 'CWE-209', 'CWE-256', 'CWE-501', 'CWE-522'],
  },
  {
    id: 'A07',
    name: 'Authentication Failures',
    description: 'Weaknesses in authentication mechanisms: credential stuffing, brute force, weak passwords, missing MFA, session fixation, improper session management.',
    exampleAttack: 'Attacker uses credential stuffing with breach databases against login endpoint that has no rate limiting or MFA. 2% of accounts compromised within hours. Or: session token remains valid after password change, allowing continued access from stolen sessions.',
    detection: [
      'Failed login attempt monitoring and alerting',
      'Credential stuffing detection (multiple accounts, same IP)',
      'Session anomaly detection',
      'MFA bypass attempt detection',
      'Password quality audit',
    ],
    remediation: [
      'Implement MFA for all accounts (TOTP, WebAuthn, or hardware keys)',
      'Enforce strong password policies (min 12 chars, check against breach lists)',
      'Rate limit authentication endpoints',
      'Implement account lockout (with progressive delays, not permanent lock)',
      'Use secure session management (httpOnly, secure, sameSite cookies)',
      'Invalidate all sessions on password change',
      'Log all authentication events for monitoring',
    ],
    codePattern: `// BAD: No rate limiting, no MFA, weak session
app.post('/login', async (req, res) => {
  const user = await db.users.findByEmail(req.body.email)
  if (user && user.password === md5(req.body.password)) {
    req.session.userId = user.id  // No MFA, weak hash
  }
})

// GOOD: Rate limited, MFA, strong session
app.post('/login', loginLimiter, async (req, res) => {
  const user = await db.users.findByEmail(req.body.email)
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
    await incrementFailedAttempts(req.body.email)
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  if (user.mfaEnabled) {
    return res.json({ requireMFA: true, tempToken: generateMFAToken(user.id) })
  }
  const session = await createSecureSession(user.id)
  res.cookie('session', session.token, {
    httpOnly: true, secure: true, sameSite: 'strict', maxAge: 3600000
  })
})`,
    severity: 'critical',
    cweIds: ['CWE-255', 'CWE-256', 'CWE-287', 'CWE-384', 'CWE-613', 'CWE-620'],
  },
  {
    id: 'A08',
    name: 'Software and Data Integrity Failures',
    description: 'Code and infrastructure that does not protect against integrity violations. Insecure CI/CD pipelines, auto-update without verification, deserialization of untrusted data.',
    exampleAttack: 'Attacker compromises a CDN-hosted JavaScript library. Applications loading the library via <script src="cdn.example.com/lib.js"> now execute malicious code on all users. Or: application deserializes untrusted JSON with class instantiation, leading to RCE.',
    detection: [
      'Subresource Integrity (SRI) verification',
      'CI/CD pipeline integrity monitoring',
      'Deserialization monitoring',
      'Package integrity verification',
      'Build artifact signing and verification',
    ],
    remediation: [
      'Use Subresource Integrity (SRI) for external scripts',
      'Sign and verify all build artifacts',
      'Secure CI/CD pipeline (signed commits, protected branches, code review)',
      'Avoid unsafe deserialization — use JSON.parse, not eval or unserialize',
      'Implement code review for all changes to critical paths',
      'Verify update signatures before applying',
    ],
    codePattern: `<!-- BAD: External script without integrity check -->
<script src="https://cdn.example.com/lib.js"></script>

<!-- GOOD: Subresource Integrity -->
<script src="https://cdn.example.com/lib.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8w"
  crossorigin="anonymous"></script>

// BAD: Unsafe deserialization
const data = JSON.parse(untrustedInput)
const obj = new data.type(data.args)  // Arbitrary class instantiation!

// GOOD: Validate structure before processing
const data = JSON.parse(untrustedInput)
if (!isValidSchema(data)) throw new Error('Invalid data')
// Process only expected fields with known types`,
    severity: 'high',
    cweIds: ['CWE-345', 'CWE-353', 'CWE-426', 'CWE-494', 'CWE-502', 'CWE-565', 'CWE-829'],
  },
  {
    id: 'A09',
    name: 'Security Logging and Monitoring Failures',
    description: 'Insufficient logging, monitoring, and alerting allows attackers to operate undetected. Most breaches are discovered by external parties weeks or months after initial compromise.',
    exampleAttack: 'Attacker compromises an application and exfiltrates data over 6 months. No logging of data access, no anomaly detection, no alert on the authentication bypass used for initial access. Breach discovered by customer who finds their data on the dark web.',
    detection: [
      'Log coverage audit — are all critical events logged?',
      'Log integrity verification',
      'Alert response time testing',
      'Red team exercises to validate detection',
      'SIEM correlation rule review',
    ],
    remediation: [
      'Log all authentication events (success and failure)',
      'Log all access control failures',
      'Log all input validation failures',
      'Centralize logs in a SIEM with tamper protection',
      'Implement alerting for suspicious patterns',
      'Establish incident response procedures and test them',
      'Ensure logs contain sufficient context (who, what, when, where)',
      'Protect log integrity (append-only, signed)',
    ],
    codePattern: `// BAD: No logging
app.post('/api/transfer', async (req, res) => {
  await transferFunds(req.body.from, req.body.to, req.body.amount)
  res.json({ success: true })
})

// GOOD: Comprehensive audit logging
app.post('/api/transfer', authenticate, async (req, res) => {
  const { from, to, amount } = req.body
  logger.info('transfer_initiated', {
    userId: req.user.id,
    from, to, amount,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString(),
  })
  try {
    await transferFunds(from, to, amount)
    logger.info('transfer_completed', { userId: req.user.id, from, to, amount })
    res.json({ success: true })
  } catch (err) {
    logger.error('transfer_failed', { userId: req.user.id, from, to, amount, error: err.message })
    res.status(500).json({ error: 'Transfer failed' })
  }
})`,
    severity: 'high',
    cweIds: ['CWE-117', 'CWE-223', 'CWE-532', 'CWE-778'],
  },
  {
    id: 'A10',
    name: 'Mishandling Exceptional Conditions',
    description: 'NEW in 2025. Improper handling of errors, exceptions, edge cases, and unexpected states that creates security vulnerabilities. Includes uncaught exceptions revealing info, race conditions, and fail-open patterns.',
    exampleAttack: 'Application uses a try-catch that catches an authorization error but falls through to allow the operation anyway (fail-open). Or: race condition in file upload allows attacker to upload and execute a web shell between the validation check and the rename operation (TOCTOU).',
    detection: [
      'Code review for error handling patterns',
      'SAST for uncaught exceptions and fail-open patterns',
      'Fuzz testing for edge cases',
      'Race condition testing',
      'Exception monitoring in production',
    ],
    remediation: [
      'Fail-closed by default — deny on error, never allow',
      'Handle all exceptions explicitly — no empty catch blocks',
      'Use atomic operations to prevent TOCTOU race conditions',
      'Implement circuit breakers for external service failures',
      'Never expose internal error details to users',
      'Test error paths as thoroughly as success paths',
      'Use typed errors and exhaustive error handling',
    ],
    codePattern: `// BAD: Fail-open pattern
let authorized = false
try {
  authorized = await checkAuthorization(user, resource)
} catch (err) {
  // Exception in auth check = fail-open!
  console.error('Auth check failed:', err)
}
if (authorized) { /* ... */ }  // Proceeds even when auth throws

// GOOD: Fail-closed pattern
let authorized: boolean
try {
  authorized = await checkAuthorization(user, resource)
} catch (err) {
  logger.error('Auth check failed', { userId: user.id, error: err })
  return res.status(500).json({ error: 'Authorization unavailable' })
  // NEVER proceed on auth failure
}
if (!authorized) {
  return res.status(403).json({ error: 'Forbidden' })
}

// BAD: TOCTOU race condition
if (await fileIsImage(uploadPath)) {
  // Window: attacker replaces file between check and rename
  await fs.rename(uploadPath, finalPath)
}

// GOOD: Atomic operation
const validated = await validateAndMoveAtomic(uploadPath, finalPath)`,
    severity: 'high',
    cweIds: ['CWE-252', 'CWE-367', 'CWE-390', 'CWE-392', 'CWE-394', 'CWE-754', 'CWE-755'],
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// LOCKHEED MARTIN KILL CHAIN (7 STAGES)
// ═══════════════════════════════════════════════════════════════════════════

const KILL_CHAIN: KillChainStage[] = [
  {
    stage: 1,
    name: 'Reconnaissance',
    definition: 'Attacker researches, identifies, and selects targets. Gathers information about the target organization, infrastructure, employees, and technology stack to plan the attack.',
    attackerActions: [
      'OSINT gathering (LinkedIn, GitHub, company website)',
      'DNS enumeration and subdomain discovery',
      'Port scanning and service fingerprinting',
      'Technology stack identification (Wappalyzer, BuiltWith)',
      'Employee email harvesting (Hunter.io, theHarvester)',
      'Social media reconnaissance',
      'Dark web credential searches',
      'Certificate Transparency log mining',
      'Shodan/Censys scanning for exposed services',
      'Job posting analysis for technology indicators',
    ],
    defenderActions: [
      'Minimize public attack surface',
      'Monitor for reconnaissance indicators',
      'Implement honeypots and canary tokens',
      'Restrict information in job postings',
      'WHOIS privacy protection',
      'Monitor Certificate Transparency logs',
      'Remove version headers from HTTP responses',
      'Implement rate limiting on public services',
    ],
    detectionMethods: [
      'Web server log analysis for scanning patterns',
      'DNS query monitoring for enumeration',
      'Honeypot/honeytoken triggering',
      'OSINT monitoring (what\'s public about you)',
      'Dark web monitoring for leaked credentials',
      'Brand impersonation detection',
    ],
    kbotTools: ['port_scan', 'ssl_check', 'headers_check', 'web_search'],
    indicators: [
      'Increased scanning activity from single sources',
      'Sequential subdomain resolution attempts',
      'Unusual WHOIS lookups',
      'Scraping of employee profiles',
      'Canary token access alerts',
    ],
  },
  {
    stage: 2,
    name: 'Weaponization',
    definition: 'Attacker creates a deliverable payload (malware, exploit, phishing kit) tailored to the target based on reconnaissance intelligence. This stage happens entirely on the attacker\'s side.',
    attackerActions: [
      'Create or acquire exploit for identified vulnerability',
      'Develop custom malware or modify existing tools',
      'Craft phishing emails with social engineering hooks',
      'Build watering hole with drive-by exploit',
      'Obtain or forge code-signing certificates',
      'Create command and control infrastructure',
      'Package exploit with backdoor/RAT',
      'Test payload against target\'s known security tools',
      'Register look-alike domains for phishing',
      'Develop persistence mechanisms',
    ],
    defenderActions: [
      'Threat intelligence consumption and sharing',
      'Vulnerability management (patch known CVEs)',
      'Email authentication (SPF/DKIM/DMARC)',
      'Browser isolation for high-risk users',
      'Application allowlisting',
      'Domain monitoring for typosquatting',
    ],
    detectionMethods: [
      'Threat intelligence feeds for new malware samples',
      'Domain registration monitoring (new look-alike domains)',
      'Code-signing certificate monitoring',
      'Malware sandbox analysis of suspicious files',
      'Threat hunting for IOCs from intelligence reports',
    ],
    kbotTools: ['cve_lookup', 'dep_audit', 'deps_audit', 'web_search'],
    indicators: [
      'New domains registered similar to yours',
      'Threat intel reports targeting your industry',
      'New exploits published for your tech stack',
      'Phishing kits targeting your brand detected',
    ],
  },
  {
    stage: 3,
    name: 'Delivery',
    definition: 'Attacker transmits the weaponized payload to the target. The payload must reach the victim through email, web, USB, or other delivery vectors.',
    attackerActions: [
      'Send spearphishing emails with malicious attachments/links',
      'Compromise legitimate website (watering hole)',
      'Exploit internet-facing application vulnerability',
      'Social engineering via phone/social media',
      'USB drop in target parking lot/lobby',
      'Supply chain injection (compromised update)',
      'Physical infiltration for internal network access',
      'Malvertising on sites target employees visit',
    ],
    defenderActions: [
      'Email gateway with attachment sandboxing',
      'Web proxy with URL reputation filtering',
      'Endpoint protection with behavioral detection',
      'USB device control policies',
      'Security awareness training for employees',
      'WAF for internet-facing applications',
      'Network segmentation for critical assets',
      'Software supply chain verification (SBOM, SCA)',
    ],
    detectionMethods: [
      'Email gateway alerts (malicious attachment/link)',
      'Endpoint detection of exploit attempt',
      'Web proxy blocks on malicious URLs',
      'User reports of suspicious emails',
      'WAF alerts for exploit attempts',
      'IDS/IPS for network-level exploit detection',
    ],
    kbotTools: ['owasp_check', 'headers_check', 'secret_scan', 'deps_audit'],
    indicators: [
      'Phishing emails targeting employees',
      'Malicious attachments detected by sandbox',
      'WAF blocking exploit attempts',
      'Users reporting suspicious messages',
      'Drive-by download attempts from compromised sites',
    ],
  },
  {
    stage: 4,
    name: 'Exploitation',
    definition: 'The delivered payload triggers, exploiting a vulnerability to execute code on the victim system. This is the transition from attacker-controlled to victim-controlled execution.',
    attackerActions: [
      'Trigger exploit against application vulnerability',
      'Execute malicious macro/script from phishing doc',
      'Leverage zero-day or known vulnerability',
      'Exploit browser/plugin vulnerability (drive-by)',
      'Social engineer user to run malicious program',
      'Exploit misconfiguration in exposed service',
      'Abuse trust relationship with third party',
      'Chain multiple vulnerabilities for exploitation',
    ],
    defenderActions: [
      'Patch management (reduce exploitable surface)',
      'Exploit protection (DEP, ASLR, CFG, CET)',
      'Application sandboxing',
      'Disable macros and unnecessary features',
      'EDR with behavioral exploitation detection',
      'Windows Attack Surface Reduction rules',
      'Browser isolation technology',
      'Virtual patching via WAF/IPS',
    ],
    detectionMethods: [
      'EDR exploit detection (memory protection violations)',
      'Application crash/error monitoring',
      'Anomalous process creation from applications',
      'Exploit guard alerts and ASR rule triggers',
      'Memory forensics for exploitation artifacts',
      'System call anomaly detection',
    ],
    kbotTools: ['owasp_check', 'cve_lookup', 'port_scan', 'dep_audit'],
    indicators: [
      'Application crashes or unexpected restarts',
      'EDR exploit protection alerts',
      'Anomalous child process from browser/Office',
      'Memory protection violation events',
      'ASR rule block events',
    ],
  },
  {
    stage: 5,
    name: 'Installation',
    definition: 'Attacker installs persistent access (backdoor, RAT, web shell, implant) on the victim system. Ensures the attacker can return even if the initial exploit vector is closed.',
    attackerActions: [
      'Install backdoor or remote access trojan (RAT)',
      'Create persistence via registry/startup/cron',
      'Deploy web shell on compromised server',
      'Create new user accounts for access',
      'Install rootkit for stealth',
      'Modify existing services for persistence',
      'Timestomp installed files to blend in',
      'Deploy multiple persistence mechanisms (redundancy)',
    ],
    defenderActions: [
      'File integrity monitoring (FIM)',
      'Monitor startup/persistence locations',
      'Application allowlisting',
      'EDR with persistence detection',
      'Regular baseline comparison',
      'Restrict account creation permissions',
      'Code signing enforcement',
      'Endpoint hardening (CIS benchmarks)',
    ],
    detectionMethods: [
      'New file creation in persistence locations',
      'Registry modification alerts (Run keys, services)',
      'New user account creation events',
      'Web shell detection scans',
      'Autorun/persistence location auditing (Autoruns)',
      'Timestomping detection (MFT analysis)',
      'New scheduled task/cron job creation',
    ],
    kbotTools: ['secret_scan', 'security_hunt', 'owasp_check'],
    indicators: [
      'New files in startup directories',
      'Registry modifications to autostart keys',
      'New services or scheduled tasks created',
      'Web shells detected on web servers',
      'Unauthorized user accounts created',
      'Modified system binaries',
    ],
  },
  {
    stage: 6,
    name: 'Command and Control (C2)',
    definition: 'Attacker establishes a communication channel with the implant for remote control. Enables the attacker to issue commands, exfiltrate data, and move laterally.',
    attackerActions: [
      'Establish C2 channel (HTTPS, DNS, custom protocol)',
      'Use legitimate services for C2 (Slack, Discord, cloud storage)',
      'Implement encrypted communication',
      'Use domain fronting to hide C2 destination',
      'Set up fallback C2 channels (redundancy)',
      'Beacon on schedule to avoid detection',
      'Use fast-flux DNS for C2 resilience',
      'Proxy C2 through compromised infrastructure',
    ],
    defenderActions: [
      'Network traffic analysis and anomaly detection',
      'DNS monitoring and filtering',
      'SSL/TLS inspection (if feasible)',
      'Block known C2 infrastructure (threat intel)',
      'JA3/JA3S fingerprinting for TLS analysis',
      'Restrict outbound connections (egress filtering)',
      'CASB for cloud service monitoring',
      'Network segmentation to limit C2 reach',
    ],
    detectionMethods: [
      'Beacon pattern detection (periodic callbacks)',
      'DNS tunneling detection (long queries, high frequency)',
      'Unusual outbound connection patterns',
      'JA3 fingerprint matching to known C2 tools',
      'Certificate analysis (self-signed, short-lived)',
      'Data volume anomalies on connections',
      'Threat intel IOC matching on network traffic',
    ],
    kbotTools: ['port_scan', 'ssl_check', 'headers_check', 'security_hunt'],
    indicators: [
      'Periodic beaconing to external IPs',
      'DNS queries with encoded data',
      'HTTPS to newly registered domains',
      'Self-signed certificates on C2 servers',
      'Unusual data volumes on outbound connections',
      'Connections to known malicious infrastructure',
    ],
  },
  {
    stage: 7,
    name: 'Actions on Objectives',
    definition: 'Attacker achieves their goal — data exfiltration, ransomware deployment, sabotage, espionage, or destructive attack. This is the culmination of the entire kill chain.',
    attackerActions: [
      'Exfiltrate sensitive data (PII, IP, credentials)',
      'Deploy ransomware across the network',
      'Establish long-term persistent access',
      'Move laterally to high-value targets',
      'Manipulate or destroy data',
      'Conduct espionage operations',
      'Deface public-facing systems',
      'Hijack resources for cryptomining',
      'Pivot to attack additional targets (supply chain)',
      'Cover tracks and remove evidence',
    ],
    defenderActions: [
      'Data loss prevention (DLP)',
      'Network segmentation to limit blast radius',
      'Incident response plan activation',
      'Forensic preservation of evidence',
      'Backup restoration capabilities',
      'Communication plan for stakeholders',
      'Law enforcement engagement',
      'Post-incident review and improvements',
    ],
    detectionMethods: [
      'DLP alerts for sensitive data movement',
      'Ransomware behavioral detection (mass encryption)',
      'Anomalous data transfer volumes',
      'Lateral movement detection (graph-based)',
      'Privileged account abuse detection',
      'File integrity monitoring alerts',
      'Account lockout/deletion anomalies',
    ],
    kbotTools: ['secret_scan', 'security_hunt', 'owasp_check', 'dep_audit', 'deps_audit'],
    indicators: [
      'Large data transfers to external destinations',
      'Mass file encryption activity',
      'Lateral movement between systems',
      'Privileged account usage from unusual sources',
      'Data destruction or modification',
      'New exfiltration channels opening',
    ],
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// KBOT SECURITY TOOL → ATT&CK TACTIC MAPPING
// ═══════════════════════════════════════════════════════════════════════════

const TOOL_MAPPINGS: ToolMapping[] = [
  {
    tool: 'port_scan',
    tactics: ['Reconnaissance', 'Discovery'],
    description: 'Network port scanner — discovers open ports and running services. Maps to T1595 (Active Scanning) for offensive recon and T1046 (Network Service Discovery) for internal discovery.',
    usage: 'port_scan { target: "example.com", ports: "1-1024" }',
    attackSurface: [
      'Exposed services (SSH, RDP, databases)',
      'Unintended listeners (debug ports, admin consoles)',
      'Version information leakage via banners',
      'Default port services indicating technology stack',
    ],
  },
  {
    tool: 'owasp_check',
    tactics: ['Initial Access', 'Execution', 'Credential Access', 'Collection'],
    description: 'OWASP vulnerability scanner — checks web applications against OWASP Top 10 categories. Covers injection, broken auth, misconfig, and more.',
    usage: 'owasp_check { url: "https://example.com", checks: "all" }',
    attackSurface: [
      'SQL/NoSQL injection points',
      'Cross-site scripting (XSS) vectors',
      'Authentication weaknesses',
      'Security misconfiguration',
      'Missing security headers',
      'Information disclosure in error pages',
    ],
  },
  {
    tool: 'ssl_check',
    tactics: ['Reconnaissance', 'Credential Access'],
    description: 'TLS/SSL configuration analyzer — checks certificate validity, protocol versions, cipher suites, and known vulnerabilities (BEAST, POODLE, Heartbleed).',
    usage: 'ssl_check { host: "example.com" }',
    attackSurface: [
      'Weak TLS versions (TLS 1.0/1.1)',
      'Weak cipher suites (RC4, DES, export ciphers)',
      'Expired or self-signed certificates',
      'Missing HSTS headers',
      'Certificate chain issues',
      'Known SSL/TLS vulnerabilities',
    ],
  },
  {
    tool: 'headers_check',
    tactics: ['Reconnaissance', 'Defense Evasion'],
    description: 'HTTP security header analyzer — verifies presence and correctness of security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy).',
    usage: 'headers_check { url: "https://example.com" }',
    attackSurface: [
      'Missing Content-Security-Policy (XSS risk)',
      'Missing HSTS (downgrade attacks)',
      'Missing X-Frame-Options (clickjacking)',
      'Missing X-Content-Type-Options (MIME sniffing)',
      'Overly permissive CORS configuration',
      'Information disclosure via Server/X-Powered-By headers',
    ],
  },
  {
    tool: 'secret_scan',
    tactics: ['Credential Access', 'Collection', 'Reconnaissance'],
    description: 'Secret and credential scanner — searches codebase, configs, and environment for exposed secrets (API keys, passwords, tokens, private keys).',
    usage: 'secret_scan { path: ".", recursive: true }',
    attackSurface: [
      'Hardcoded API keys and tokens',
      'Database connection strings with credentials',
      'Private keys (.pem, .key) in repositories',
      'Environment files (.env) committed to git',
      'AWS/GCP/Azure credentials in code',
      'JWT signing secrets in source code',
      'OAuth client secrets exposed',
    ],
  },
  {
    tool: 'cve_lookup',
    tactics: ['Reconnaissance', 'Initial Access', 'Privilege Escalation'],
    description: 'CVE vulnerability lookup — searches the NVD (National Vulnerability Database) for known vulnerabilities by product, version, or CVE ID.',
    usage: 'cve_lookup { query: "node.js 18", severity: "critical" }',
    attackSurface: [
      'Known exploitable vulnerabilities in dependencies',
      'Unpatched software with public exploits',
      'Zero-day vulnerability tracking',
      'CVSS scoring for risk prioritization',
      'Exploit availability assessment',
    ],
  },
  {
    tool: 'dep_audit',
    tactics: ['Initial Access', 'Execution'],
    description: 'Dependency audit — scans project dependencies for known vulnerabilities using npm audit, OSV, and advisory databases. Maps to T1195 (Supply Chain Compromise) detection.',
    usage: 'dep_audit { path: ".", manager: "npm" }',
    attackSurface: [
      'Vulnerable transitive dependencies',
      'Outdated packages with known CVEs',
      'Dependency confusion potential',
      'Typosquatting risk in package names',
      'Unmaintained packages without security patches',
    ],
  },
  {
    tool: 'deps_audit',
    tactics: ['Initial Access', 'Execution', 'Persistence'],
    description: 'Extended dependency security audit — deep analysis including license compliance, maintainer changes, suspicious package behavior, and supply chain risk.',
    usage: 'deps_audit { path: ".", deep: true }',
    attackSurface: [
      'All dep_audit attack surfaces plus:',
      'Maintainer account compromise detection',
      'Suspicious postinstall scripts',
      'License compliance violations',
      'Abandoned/orphaned packages',
      'Unexpected binary inclusions',
    ],
  },
  {
    tool: 'security_hunt',
    tactics: ['Discovery', 'Credential Access', 'Defense Evasion', 'Lateral Movement', 'Collection'],
    description: 'Proactive security threat hunting — searches for indicators of compromise (IOCs), suspicious patterns, anomalous configurations, and potential security issues across the environment.',
    usage: 'security_hunt { scope: "full", focus: "credentials" }',
    attackSurface: [
      'Indicators of compromise in logs',
      'Suspicious file modifications',
      'Anomalous network connections',
      'Unauthorized access patterns',
      'Privilege escalation artifacts',
      'Data staging for exfiltration',
      'Persistence mechanism detection',
    ],
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// CVE PATTERN LIBRARY
// Common vulnerability patterns with examples and detection/remediation
// ═══════════════════════════════════════════════════════════════════════════

interface CVEPattern {
  name: string
  description: string
  cweId: string
  examples: string[]
  detection: string[]
  remediation: string[]
  languages: string[]
}

const CVE_PATTERNS: CVEPattern[] = [
  {
    name: 'SQL Injection',
    description: 'User input concatenated directly into SQL queries, allowing attacker-controlled SQL execution.',
    cweId: 'CWE-89',
    examples: ['CVE-2023-34362 (MOVEit Transfer)', 'CVE-2023-36934 (MOVEit Transfer)', 'CVE-2019-18935 (Telerik UI)'],
    detection: ['SAST scanning for string concatenation in SQL', 'WAF SQL injection rules', 'Database query logging for anomalous patterns', 'Dynamic analysis with SQLi payloads'],
    remediation: ['Use parameterized queries / prepared statements', 'Use ORM with proper escaping', 'Input validation with allowlists', 'Least privilege database accounts'],
    languages: ['PHP', 'Java', 'Python', 'JavaScript', 'C#', 'Ruby'],
  },
  {
    name: 'Cross-Site Scripting (XSS)',
    description: 'Attacker injects client-side scripts into web pages viewed by other users, stealing sessions, defacing sites, or redirecting users.',
    cweId: 'CWE-79',
    examples: ['CVE-2023-42793 (JetBrains TeamCity)', 'CVE-2022-29078 (EJS)', 'CVE-2021-41773 (Apache)'],
    detection: ['SAST/DAST scanning for XSS', 'CSP violation reporting', 'WAF XSS detection rules', 'Browser XSS auditor'],
    remediation: ['Context-aware output encoding', 'Content Security Policy headers', 'Use textContent instead of innerHTML', 'DOMPurify for HTML sanitization', 'HTTPOnly cookies to prevent theft'],
    languages: ['JavaScript', 'PHP', 'Java', 'Python', 'Ruby'],
  },
  {
    name: 'Remote Code Execution (RCE)',
    description: 'Attacker executes arbitrary code on the target system remotely. Highest severity — full system compromise.',
    cweId: 'CWE-94',
    examples: ['CVE-2021-44228 (Log4Shell)', 'CVE-2023-44487 (HTTP/2 Rapid Reset)', 'CVE-2024-3094 (xz backdoor)', 'CVE-2023-22515 (Atlassian Confluence)'],
    detection: ['WAF/IPS for known RCE payloads', 'EDR behavioral detection', 'Application error monitoring', 'System call auditing'],
    remediation: ['Patch immediately — RCE is always critical', 'Application sandboxing', 'Least privilege execution', 'Network segmentation', 'WAF virtual patching while awaiting real patch'],
    languages: ['Java', 'Python', 'PHP', 'C/C++', 'JavaScript'],
  },
  {
    name: 'Server-Side Request Forgery (SSRF)',
    description: 'Attacker tricks the server into making HTTP requests to internal or external resources, accessing internal services, cloud metadata, or exfiltrating data.',
    cweId: 'CWE-918',
    examples: ['CVE-2021-26855 (Exchange ProxyLogon)', 'CVE-2023-35078 (Ivanti EPMM)', 'Capital One breach (2019) via SSRF to cloud metadata'],
    detection: ['WAF SSRF detection rules', 'Monitor for requests to metadata endpoints', 'Outbound request logging', 'DNS rebinding detection'],
    remediation: ['Allowlist of permitted destination hosts/IPs', 'Block requests to metadata endpoints (169.254.169.254)', 'Network-level egress filtering', 'Disable unnecessary URL schemes (file://, gopher://)'],
    languages: ['Java', 'Python', 'PHP', 'JavaScript', 'Ruby', 'Go'],
  },
  {
    name: 'Path Traversal',
    description: 'Attacker manipulates file paths to access files outside the intended directory (../../etc/passwd).',
    cweId: 'CWE-22',
    examples: ['CVE-2021-41773 (Apache path traversal)', 'CVE-2023-34039 (VMware Aria)', 'CVE-2024-21887 (Ivanti Connect Secure)'],
    detection: ['WAF path traversal rules', 'File access logging', 'SAST for path concatenation', 'Monitor for ../ patterns in requests'],
    remediation: ['Use path.resolve() and verify within allowed directory', 'Chroot/jail file access', 'Allowlist permitted file paths', 'Normalize paths before validation'],
    languages: ['PHP', 'Java', 'Python', 'JavaScript', 'C/C++', 'Go'],
  },
  {
    name: 'Insecure Deserialization',
    description: 'Application deserializes untrusted data, allowing attackers to manipulate serialized objects for RCE, privilege escalation, or injection.',
    cweId: 'CWE-502',
    examples: ['CVE-2023-34362 (MOVEit)', 'CVE-2023-46604 (Apache ActiveMQ)', 'CVE-2019-18935 (Telerik UI)'],
    detection: ['SAST for deserialization of untrusted data', 'Runtime monitoring for deserialization', 'WAF rules for serialized object payloads'],
    remediation: ['Never deserialize untrusted data', 'Use JSON instead of native serialization', 'Validate and sanitize before deserialization', 'Type checking on deserialized objects', 'Implement integrity checks (HMAC) on serialized data'],
    languages: ['Java', 'PHP', 'Python', '.NET', 'Ruby'],
  },
  {
    name: 'Authentication Bypass',
    description: 'Attacker circumvents authentication mechanisms to gain unauthorized access without valid credentials.',
    cweId: 'CWE-287',
    examples: ['CVE-2023-22515 (Confluence)', 'CVE-2023-20198 (Cisco IOS XE)', 'CVE-2024-1709 (ScreenConnect)'],
    detection: ['Authentication event monitoring', 'Anomalous access pattern detection', 'Penetration testing for auth bypass', 'API testing for unauthenticated access'],
    remediation: ['Server-side authentication on every request', 'Defense in depth — multiple auth layers', 'Security testing of all auth flows', 'Session management best practices'],
    languages: ['All'],
  },
  {
    name: 'Privilege Escalation',
    description: 'Attacker exploits a vulnerability to gain higher privileges than intended — user to admin, unprivileged to root/SYSTEM.',
    cweId: 'CWE-269',
    examples: ['CVE-2021-4034 (PwnKit — polkit)', 'CVE-2022-0847 (Dirty Pipe)', 'CVE-2023-32233 (Linux nf_tables)', 'CVE-2024-21338 (Windows kernel)'],
    detection: ['EDR privilege escalation detection', 'Monitor for unexpected privilege changes', 'Setuid/setgid binary auditing', 'Kernel exploit detection'],
    remediation: ['Least privilege principle', 'Regular patching', 'Audit setuid/setgid binaries', 'Kernel hardening (SMAP, SMEP)', 'Restrict debug/trace capabilities'],
    languages: ['C/C++', 'Kernel modules', 'System services'],
  },
  {
    name: 'Prototype Pollution',
    description: 'JavaScript-specific: attacker modifies the prototype of base objects (Object.prototype), affecting all objects in the application.',
    cweId: 'CWE-1321',
    examples: ['CVE-2022-24999 (qs)', 'CVE-2020-28477 (immer)', 'CVE-2021-25945 (set-value)'],
    detection: ['SAST for prototype pollution sinks', 'Runtime monitoring of Object.prototype modifications', 'Dependency scanning for known vulnerable packages'],
    remediation: ['Use Object.create(null) for lookup maps', 'Freeze Object.prototype in critical code', 'Validate/sanitize object keys (__proto__, constructor, prototype)', 'Use Map instead of plain objects for dynamic keys'],
    languages: ['JavaScript', 'TypeScript'],
  },
  {
    name: 'Container Escape',
    description: 'Attacker breaks out of a container to access the host system or other containers, defeating isolation.',
    cweId: 'CWE-250',
    examples: ['CVE-2024-21626 (Leaky Vessels — runc)', 'CVE-2022-0492 (cgroups escape)', 'CVE-2020-15257 (containerd)'],
    detection: ['Container runtime monitoring', 'Syscall auditing (seccomp)', 'Host process monitoring for container breakouts', 'Kubernetes audit logging'],
    remediation: ['Run containers as non-root', 'Enable seccomp and AppArmor profiles', 'Use read-only filesystems', 'Keep container runtimes updated', 'Use gVisor or Kata Containers for strong isolation', 'Drop unnecessary capabilities'],
    languages: ['Go', 'C', 'Container configs'],
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function searchMITRE(query: string): ATTACKTechnique[] {
  const q = query.toLowerCase()
  return MITRE_TECHNIQUES.filter(t =>
    t.id.toLowerCase().includes(q) ||
    t.name.toLowerCase().includes(q) ||
    t.tactic.toLowerCase().includes(q) ||
    t.description.toLowerCase().includes(q) ||
    (t.subtechniques || []).some(s => s.toLowerCase().includes(q)) ||
    (t.commonTools || []).some(tool => tool.toLowerCase().includes(q))
  )
}

function searchOWASP(query: string): OWASPEntry[] {
  const q = query.toLowerCase()
  return OWASP_2025.filter(o =>
    o.id.toLowerCase().includes(q) ||
    o.name.toLowerCase().includes(q) ||
    o.description.toLowerCase().includes(q) ||
    o.cweIds.some(c => c.toLowerCase().includes(q))
  )
}

function searchKillChain(query: string): KillChainStage[] {
  const q = query.toLowerCase()
  return KILL_CHAIN.filter(k =>
    k.name.toLowerCase().includes(q) ||
    k.definition.toLowerCase().includes(q) ||
    k.attackerActions.some(a => a.toLowerCase().includes(q)) ||
    k.defenderActions.some(d => d.toLowerCase().includes(q)) ||
    k.kbotTools.some(t => t.toLowerCase().includes(q))
  )
}

function searchCVEPatterns(query: string): CVEPattern[] {
  const q = query.toLowerCase()
  return CVE_PATTERNS.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    p.cweId.toLowerCase().includes(q) ||
    p.examples.some(e => e.toLowerCase().includes(q)) ||
    p.languages.some(l => l.toLowerCase().includes(q))
  )
}

function searchTools(query: string): ToolMapping[] {
  const q = query.toLowerCase()
  return TOOL_MAPPINGS.filter(t =>
    t.tool.toLowerCase().includes(q) ||
    t.description.toLowerCase().includes(q) ||
    t.tactics.some(tac => tac.toLowerCase().includes(q)) ||
    t.attackSurface.some(a => a.toLowerCase().includes(q))
  )
}

function formatMITRETechnique(t: ATTACKTechnique): string {
  const lines: string[] = [
    `## ${t.id} — ${t.name}`,
    `**Tactic:** ${t.tactic}`,
    `**Severity:** ${t.severity.toUpperCase()}`,
    `**Platforms:** ${t.platforms.join(', ')}`,
    '',
    t.description,
    '',
  ]
  if (t.subtechniques && t.subtechniques.length > 0) {
    lines.push('**Sub-techniques:**')
    t.subtechniques.forEach(s => lines.push(`  - ${s}`))
    lines.push('')
  }
  if (t.commonTools && t.commonTools.length > 0) {
    lines.push(`**Common Tools:** ${t.commonTools.join(', ')}`)
    lines.push('')
  }
  lines.push('**Detection:**')
  t.detection.forEach(d => lines.push(`  - ${d}`))
  lines.push('')
  lines.push('**Mitigations:**')
  t.mitigations.forEach(m => lines.push(`  - ${m}`))
  return lines.join('\n')
}

function formatOWASP(o: OWASPEntry): string {
  const lines: string[] = [
    `## ${o.id}: ${o.name}`,
    `**Severity:** ${o.severity.toUpperCase()}`,
    `**CWE IDs:** ${o.cweIds.join(', ')}`,
    '',
    o.description,
    '',
    `**Example Attack:**`,
    o.exampleAttack,
    '',
    '**Detection:**',
  ]
  o.detection.forEach(d => lines.push(`  - ${d}`))
  lines.push('')
  lines.push('**Remediation:**')
  o.remediation.forEach(r => lines.push(`  - ${r}`))
  lines.push('')
  lines.push('**Code Pattern:**')
  lines.push('```')
  lines.push(o.codePattern)
  lines.push('```')
  return lines.join('\n')
}

function formatKillChain(k: KillChainStage): string {
  const lines: string[] = [
    `## Stage ${k.stage}: ${k.name}`,
    '',
    k.definition,
    '',
    '**Attacker Actions:**',
  ]
  k.attackerActions.forEach(a => lines.push(`  - ${a}`))
  lines.push('')
  lines.push('**Defender Actions:**')
  k.defenderActions.forEach(d => lines.push(`  - ${d}`))
  lines.push('')
  lines.push('**Detection Methods:**')
  k.detectionMethods.forEach(d => lines.push(`  - ${d}`))
  lines.push('')
  lines.push(`**kbot Tools:** ${k.kbotTools.join(', ')}`)
  lines.push('')
  lines.push('**Indicators:**')
  k.indicators.forEach(i => lines.push(`  - ${i}`))
  return lines.join('\n')
}

function formatCVEPattern(p: CVEPattern): string {
  const lines: string[] = [
    `## ${p.name} (${p.cweId})`,
    '',
    p.description,
    '',
    `**Languages:** ${p.languages.join(', ')}`,
    '',
    '**Notable CVEs:**',
  ]
  p.examples.forEach(e => lines.push(`  - ${e}`))
  lines.push('')
  lines.push('**Detection:**')
  p.detection.forEach(d => lines.push(`  - ${d}`))
  lines.push('')
  lines.push('**Remediation:**')
  p.remediation.forEach(r => lines.push(`  - ${r}`))
  return lines.join('\n')
}

function formatToolMapping(t: ToolMapping): string {
  const lines: string[] = [
    `## ${t.tool}`,
    `**ATT&CK Tactics:** ${t.tactics.join(', ')}`,
    '',
    t.description,
    '',
    `**Usage:** \`${t.usage}\``,
    '',
    '**Attack Surface Coverage:**',
  ]
  t.attackSurface.forEach(a => lines.push(`  - ${a}`))
  return lines.join('\n')
}

function mapDescriptionToKillChain(description: string): string {
  const desc = description.toLowerCase()
  const mappings: { stage: string; confidence: 'high' | 'medium' | 'low'; reason: string }[] = []

  // Reconnaissance indicators
  const reconKeywords = ['scan', 'enumerate', 'discover', 'recon', 'fingerprint', 'osint', 'whois', 'dns lookup', 'subdomain', 'harvest', 'google dork', 'shodan', 'gather information']
  if (reconKeywords.some(k => desc.includes(k))) {
    mappings.push({ stage: 'Stage 1: Reconnaissance', confidence: 'high', reason: 'Contains reconnaissance/information gathering indicators' })
  }

  // Weaponization indicators
  const weapKeywords = ['payload', 'exploit development', 'malware creation', 'craft', 'weaponize', 'dropper', 'builder', 'obfuscate payload', 'packer', 'crypter', 'backdoor development']
  if (weapKeywords.some(k => desc.includes(k))) {
    mappings.push({ stage: 'Stage 2: Weaponization', confidence: 'high', reason: 'Contains payload/exploit development indicators' })
  }

  // Delivery indicators
  const delivKeywords = ['phishing', 'spearphish', 'email attachment', 'malicious link', 'drive-by', 'watering hole', 'usb drop', 'supply chain', 'social engineer', 'deliver', 'distribute malware', 'send email', 'trojan']
  if (delivKeywords.some(k => desc.includes(k))) {
    mappings.push({ stage: 'Stage 3: Delivery', confidence: 'high', reason: 'Contains delivery/distribution indicators' })
  }

  // Exploitation indicators
  const exploitKeywords = ['exploit', 'vulnerability', 'cve', 'buffer overflow', 'rce', 'remote code execution', 'zero-day', '0day', 'heap spray', 'use-after-free', 'injection', 'sql injection', 'xss', 'deserialization', 'arbitrary code']
  if (exploitKeywords.some(k => desc.includes(k))) {
    mappings.push({ stage: 'Stage 4: Exploitation', confidence: 'high', reason: 'Contains exploitation/vulnerability indicators' })
  }

  // Installation indicators
  const installKeywords = ['persist', 'backdoor', 'rootkit', 'web shell', 'implant', 'trojan', 'rat', 'registry', 'startup', 'cron job', 'scheduled task', 'service install', 'autorun', 'boot', 'logon script', 'launch agent', 'launch daemon']
  if (installKeywords.some(k => desc.includes(k))) {
    mappings.push({ stage: 'Stage 5: Installation', confidence: 'high', reason: 'Contains persistence/installation indicators' })
  }

  // C2 indicators
  const c2Keywords = ['command and control', 'c2', 'c&c', 'beacon', 'callback', 'reverse shell', 'bind shell', 'dns tunnel', 'covert channel', 'domain fronting', 'cobalt strike', 'sliver', 'empire', 'meterpreter', 'remote access']
  if (c2Keywords.some(k => desc.includes(k))) {
    mappings.push({ stage: 'Stage 6: Command & Control', confidence: 'high', reason: 'Contains C2/communication channel indicators' })
  }

  // Actions on Objectives indicators
  const actionKeywords = ['exfiltrat', 'ransomware', 'encrypt files', 'data theft', 'steal data', 'wiper', 'destruct', 'deface', 'cryptomin', 'sabotage', 'espionage', 'lateral movement', 'privilege escalation', 'credential dump', 'mimikatz', 'data destruction', 'impact']
  if (actionKeywords.some(k => desc.includes(k))) {
    mappings.push({ stage: 'Stage 7: Actions on Objectives', confidence: 'high', reason: 'Contains objective/impact indicators' })
  }

  // If no high-confidence matches, try broader patterns
  if (mappings.length === 0) {
    if (desc.includes('attack') || desc.includes('threat') || desc.includes('compromise')) {
      mappings.push({ stage: 'Multiple stages possible', confidence: 'low', reason: 'Generic attack terminology — provide more specific details for accurate mapping' })
    } else {
      mappings.push({ stage: 'Unable to determine', confidence: 'low', reason: 'Description does not contain clear kill chain indicators. Try including specific attack techniques, tools, or behaviors.' })
    }
  }

  // Find related MITRE techniques
  const relatedTechniques = searchMITRE(description).slice(0, 5)
  const relatedOWASP = searchOWASP(description).slice(0, 3)
  const relatedCVEPatterns = searchCVEPatterns(description).slice(0, 3)

  const lines: string[] = [
    '# Kill Chain Analysis',
    '',
    `**Input:** "${description.slice(0, 200)}${description.length > 200 ? '...' : ''}"`,
    '',
    '## Kill Chain Stage Mapping',
    '',
  ]

  mappings.forEach(m => {
    lines.push(`### ${m.stage}`)
    lines.push(`**Confidence:** ${m.confidence.toUpperCase()}`)
    lines.push(`**Reasoning:** ${m.reason}`)
    lines.push('')
  })

  // Add the full kill chain context for matched stages
  const matchedStages = mappings
    .filter(m => m.confidence !== 'low')
    .map(m => {
      const stageNum = parseInt(m.stage.match(/Stage (\d)/)?.[1] || '0', 10)
      return KILL_CHAIN.find(k => k.stage === stageNum)
    })
    .filter(Boolean) as KillChainStage[]

  if (matchedStages.length > 0) {
    lines.push('## Detailed Stage Analysis')
    lines.push('')
    matchedStages.forEach(stage => {
      lines.push(formatKillChain(stage))
      lines.push('')
    })
  }

  // Add related intelligence
  if (relatedTechniques.length > 0) {
    lines.push('## Related MITRE ATT&CK Techniques')
    lines.push('')
    relatedTechniques.forEach(t => {
      lines.push(`- **${t.id}** — ${t.name} (${t.tactic}) [${t.severity.toUpperCase()}]`)
    })
    lines.push('')
  }

  if (relatedOWASP.length > 0) {
    lines.push('## Related OWASP Top 10 Entries')
    lines.push('')
    relatedOWASP.forEach(o => {
      lines.push(`- **${o.id}** — ${o.name}`)
    })
    lines.push('')
  }

  if (relatedCVEPatterns.length > 0) {
    lines.push('## Related Vulnerability Patterns')
    lines.push('')
    relatedCVEPatterns.forEach(p => {
      lines.push(`- **${p.name}** (${p.cweId})`)
    })
    lines.push('')
  }

  // Defensive recommendations
  lines.push('## Defensive Recommendations')
  lines.push('')
  if (matchedStages.length > 0) {
    const allDefenderActions = matchedStages.flatMap(s => s.defenderActions)
    const uniqueActions = [...new Set(allDefenderActions)]
    uniqueActions.forEach(a => lines.push(`- ${a}`))
    lines.push('')
    const allTools = [...new Set(matchedStages.flatMap(s => s.kbotTools))]
    lines.push(`**Recommended kbot tools:** ${allTools.join(', ')}`)
  } else {
    lines.push('Provide more specific attack details for targeted defensive recommendations.')
  }

  return lines.join('\n')
}


// ═══════════════════════════════════════════════════════════════════════════
// TOOL REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════

export function registerSecurityBrainTools(): void {

  // ── Tool 1: security_brain ──────────────────────────────────────────
  registerTool({
    name: 'security_brain',
    description: 'Query the security knowledge base. Covers MITRE ATT&CK (14 tactics, 200+ techniques), OWASP Top 10 (2025), Lockheed Martin Kill Chain, CVE patterns, and kbot security tool mapping. Use this as a first stop for any security question.',
    parameters: {
      topic: { type: 'string', description: 'What to look up — technique name, vulnerability type, attack pattern, tool name, or general security topic', required: true },
      category: { type: 'string', description: 'Knowledge category to search: "mitre", "owasp", "killchain", "cve_patterns", "tools", or "all" (default: "all")', required: false },
    },
    tier: 'free',
    timeout: 10_000,
    async execute(args) {
      const topic = (args.topic as string) || ''
      const category = ((args.category as string) || 'all').toLowerCase()

      if (!topic.trim()) {
        return 'Error: topic parameter is required. Example: security_brain { topic: "phishing", category: "mitre" }'
      }

      const sections: string[] = []
      sections.push(`# Security Brain: "${topic}"`)
      sections.push(`**Category filter:** ${category}`)
      sections.push('')

      const searchAll = category === 'all'

      // MITRE ATT&CK
      if (searchAll || category === 'mitre') {
        const results = searchMITRE(topic)
        if (results.length > 0) {
          sections.push(`## MITRE ATT&CK (${results.length} result${results.length !== 1 ? 's' : ''})`)
          sections.push('')
          results.slice(0, 10).forEach(t => {
            sections.push(formatMITRETechnique(t))
            sections.push('')
            sections.push('---')
            sections.push('')
          })
          if (results.length > 10) {
            sections.push(`_... and ${results.length - 10} more results. Narrow your query for focused results._`)
            sections.push('')
          }
        } else if (!searchAll) {
          sections.push('## MITRE ATT&CK')
          sections.push('No matching techniques found. Try a technique ID (T1566), technique name (Phishing), or tactic name (Initial Access).')
          sections.push('')
        }
      }

      // OWASP
      if (searchAll || category === 'owasp') {
        const results = searchOWASP(topic)
        if (results.length > 0) {
          sections.push(`## OWASP Top 10 2025 (${results.length} result${results.length !== 1 ? 's' : ''})`)
          sections.push('')
          results.forEach(o => {
            sections.push(formatOWASP(o))
            sections.push('')
            sections.push('---')
            sections.push('')
          })
        } else if (!searchAll) {
          sections.push('## OWASP Top 10')
          sections.push('No matching entries found. Try an ID (A01-A10), name (Injection, XSS), or CWE ID.')
          sections.push('')
        }
      }

      // Kill Chain
      if (searchAll || category === 'killchain') {
        const results = searchKillChain(topic)
        if (results.length > 0) {
          sections.push(`## Kill Chain (${results.length} result${results.length !== 1 ? 's' : ''})`)
          sections.push('')
          results.forEach(k => {
            sections.push(formatKillChain(k))
            sections.push('')
            sections.push('---')
            sections.push('')
          })
        } else if (!searchAll) {
          sections.push('## Kill Chain')
          sections.push('No matching stages found. Try a stage name (Reconnaissance, Delivery, Exploitation) or action keyword.')
          sections.push('')
        }
      }

      // CVE Patterns
      if (searchAll || category === 'cve_patterns') {
        const results = searchCVEPatterns(topic)
        if (results.length > 0) {
          sections.push(`## CVE Patterns (${results.length} result${results.length !== 1 ? 's' : ''})`)
          sections.push('')
          results.forEach(p => {
            sections.push(formatCVEPattern(p))
            sections.push('')
            sections.push('---')
            sections.push('')
          })
        } else if (!searchAll) {
          sections.push('## CVE Patterns')
          sections.push('No matching patterns found. Try a vulnerability type (SQL Injection, XSS, RCE) or CWE ID.')
          sections.push('')
        }
      }

      // Tools
      if (searchAll || category === 'tools') {
        const results = searchTools(topic)
        if (results.length > 0) {
          sections.push(`## kbot Tool Mapping (${results.length} result${results.length !== 1 ? 's' : ''})`)
          sections.push('')
          results.forEach(t => {
            sections.push(formatToolMapping(t))
            sections.push('')
            sections.push('---')
            sections.push('')
          })
        } else if (!searchAll) {
          sections.push('## kbot Tool Mapping')
          sections.push('No matching tools found. Try a tool name (port_scan, owasp_check) or tactic name (Reconnaissance).')
          sections.push('')
        }
      }

      // Summary stats
      const totalMitre = searchAll || category === 'mitre' ? searchMITRE(topic).length : 0
      const totalOwasp = searchAll || category === 'owasp' ? searchOWASP(topic).length : 0
      const totalKillChain = searchAll || category === 'killchain' ? searchKillChain(topic).length : 0
      const totalCVE = searchAll || category === 'cve_patterns' ? searchCVEPatterns(topic).length : 0
      const totalTools = searchAll || category === 'tools' ? searchTools(topic).length : 0
      const totalResults = totalMitre + totalOwasp + totalKillChain + totalCVE + totalTools

      if (totalResults === 0) {
        sections.push('## No Results')
        sections.push('')
        sections.push(`No matches found for "${topic}" in ${category === 'all' ? 'any category' : category}.`)
        sections.push('')
        sections.push('**Suggestions:**')
        sections.push('- Try broader keywords (e.g., "injection" instead of "sql injection in java")')
        sections.push('- Search by technique ID (T1566), CWE ID (CWE-79), or OWASP ID (A01)')
        sections.push('- Use category filter: "mitre", "owasp", "killchain", "cve_patterns", "tools"')
        sections.push('')
        sections.push('**Available MITRE Tactics:** Reconnaissance, Resource Development, Initial Access, Execution, Persistence, Privilege Escalation, Defense Evasion, Credential Access, Discovery, Lateral Movement, Collection, Command and Control, Exfiltration, Impact')
        sections.push('')
        sections.push('**Available OWASP Entries:** A01 (Broken Access Control), A02 (Security Misconfiguration), A03 (Supply Chain Failures), A04 (Cryptographic Failures), A05 (Injection), A06 (Insecure Design), A07 (Authentication Failures), A08 (Integrity Failures), A09 (Logging Failures), A10 (Exceptional Conditions)')
      }

      return sections.join('\n')
    },
  })

  // ── Tool 2: attack_lookup ───────────────────────────────────────────
  registerTool({
    name: 'attack_lookup',
    description: 'Look up MITRE ATT&CK techniques by ID (T1566) or keyword (phishing). Returns technique details including tactic, description, sub-techniques, detection methods, and mitigations. Covers all 14 ATT&CK tactics with top techniques for each.',
    parameters: {
      query: { type: 'string', description: 'Technique ID (e.g., T1566, T1059.001) or keyword (e.g., phishing, injection, credential dumping)', required: true },
    },
    tier: 'free',
    timeout: 10_000,
    async execute(args) {
      const query = (args.query as string) || ''

      if (!query.trim()) {
        return 'Error: query parameter is required. Example: attack_lookup { query: "T1566" } or attack_lookup { query: "phishing" }'
      }

      const results = searchMITRE(query)

      if (results.length === 0) {
        // Check if it looks like a technique ID for a subtechnique
        const idMatch = query.match(/^T\d{4}(\.\d{3})?$/i)
        if (idMatch) {
          // Search for parent technique if subtechnique
          const parentId = query.split('.')[0].toUpperCase()
          const parentResults = MITRE_TECHNIQUES.filter(t => t.id === parentId)
          if (parentResults.length > 0) {
            const parent = parentResults[0]
            const matchingSub = (parent.subtechniques || []).find(s => s.toLowerCase().includes(query.toLowerCase()))
            if (matchingSub) {
              return [
                `# Sub-technique: ${query.toUpperCase()}`,
                '',
                `Found as part of **${parent.id} — ${parent.name}**`,
                '',
                `**Sub-technique:** ${matchingSub}`,
                '',
                formatMITRETechnique(parent),
              ].join('\n')
            }
          }
          return `No technique found for ID "${query}". Valid IDs range from T1001 to T1654. Check the MITRE ATT&CK website for the full catalog.`
        }

        // Suggest related searches
        const allTactics = [...new Set(MITRE_TECHNIQUES.map(t => t.tactic))]
        return [
          `No ATT&CK techniques found matching "${query}".`,
          '',
          '**Try:**',
          '- Technique ID: T1566, T1059, T1003',
          '- Technique name: Phishing, Process Injection, Brute Force',
          '- Tactic name: Initial Access, Persistence, Lateral Movement',
          '- Tool name: Mimikatz, Cobalt Strike, Nmap',
          '',
          `**All 14 tactics:** ${allTactics.join(', ')}`,
        ].join('\n')
      }

      const lines: string[] = [
        `# ATT&CK Lookup: "${query}" (${results.length} result${results.length !== 1 ? 's' : ''})`,
        '',
      ]

      results.slice(0, 8).forEach((t, i) => {
        lines.push(formatMITRETechnique(t))
        if (i < Math.min(results.length, 8) - 1) {
          lines.push('')
          lines.push('---')
          lines.push('')
        }
      })

      if (results.length > 8) {
        lines.push('')
        lines.push(`_${results.length - 8} more results. Narrow your query (e.g., use technique ID instead of keyword)._`)
      }

      // Cross-reference with OWASP and CVE patterns
      const relatedOWASP = searchOWASP(query)
      const relatedCVE = searchCVEPatterns(query)

      if (relatedOWASP.length > 0 || relatedCVE.length > 0) {
        lines.push('')
        lines.push('## Cross-References')
        if (relatedOWASP.length > 0) {
          lines.push(`**OWASP:** ${relatedOWASP.map(o => `${o.id} (${o.name})`).join(', ')}`)
        }
        if (relatedCVE.length > 0) {
          lines.push(`**CVE Patterns:** ${relatedCVE.map(p => `${p.name} (${p.cweId})`).join(', ')}`)
        }
      }

      return lines.join('\n')
    },
  })

  // ── Tool 3: killchain_analyze ───────────────────────────────────────
  registerTool({
    name: 'killchain_analyze',
    description: 'Map an attack or vulnerability description to Lockheed Martin Kill Chain stages. Provides kill chain stage mapping with confidence levels, related MITRE ATT&CK techniques, OWASP entries, CVE patterns, and defensive recommendations with specific kbot tools.',
    parameters: {
      description: { type: 'string', description: 'Description of the attack, vulnerability, or threat scenario to analyze and map to kill chain stages', required: true },
    },
    tier: 'free',
    timeout: 10_000,
    async execute(args) {
      const description = (args.description as string) || ''

      if (!description.trim()) {
        return [
          'Error: description parameter is required.',
          '',
          'Example: killchain_analyze { description: "Attacker sent phishing email with malicious PDF that exploits a known vulnerability to install a reverse shell" }',
          '',
          'The description should include attack details such as:',
          '- Attack vector (phishing, exploit, supply chain)',
          '- Techniques used (credential dumping, lateral movement)',
          '- Tools mentioned (Mimikatz, Cobalt Strike)',
          '- Objectives (data exfiltration, ransomware, persistence)',
        ].join('\n')
      }

      return mapDescriptionToKillChain(description)
    },
  })
}
