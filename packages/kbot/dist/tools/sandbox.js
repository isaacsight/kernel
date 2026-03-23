// kbot Sandbox Execution — Run untrusted code in isolated Docker containers
//
// Supports multiple languages. Auto-creates and cleans up containers.
// Falls back to local execution with warnings if Docker isn't available.
//
// Flow:
//   sandbox_run — execute code in a fresh container
//   sandbox_exec — execute a command in a running sandbox
//   sandbox_stop — stop and remove a sandbox
import { execSync, spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { registerTool } from './index.js';
const sandboxes = new Map();
let nextSandboxId = 1;
/** Language → Docker image + run command */
const LANGUAGE_CONFIGS = {
    python: {
        image: 'python:3.12-slim',
        ext: '.py',
        runCmd: (f) => `python ${f}`,
    },
    javascript: {
        image: 'node:22-slim',
        ext: '.js',
        runCmd: (f) => `node ${f}`,
    },
    typescript: {
        image: 'node:22-slim',
        ext: '.ts',
        runCmd: (f) => `npx -y tsx ${f}`,
    },
    ruby: {
        image: 'ruby:3.3-slim',
        ext: '.rb',
        runCmd: (f) => `ruby ${f}`,
    },
    go: {
        image: 'golang:1.22-alpine',
        ext: '.go',
        runCmd: (f) => `go run ${f}`,
    },
    rust: {
        image: 'rust:1.77-slim',
        ext: '.rs',
        runCmd: (f) => `rustc ${f} -o /tmp/out && /tmp/out`,
    },
    bash: {
        image: 'alpine:3.19',
        ext: '.sh',
        runCmd: (f) => `sh ${f}`,
    },
    c: {
        image: 'gcc:14',
        ext: '.c',
        runCmd: (f) => `gcc ${f} -o /tmp/out && /tmp/out`,
    },
    cpp: {
        image: 'gcc:14',
        ext: '.cpp',
        runCmd: (f) => `g++ ${f} -o /tmp/out && /tmp/out`,
    },
};
/** Check if Docker is available */
function isDockerAvailable() {
    try {
        execSync('docker info', { stdio: 'ignore', timeout: 5000 });
        return true;
    }
    catch {
        return false;
    }
}
export function registerSandboxTools() {
    registerTool({
        name: 'sandbox_run',
        description: 'Execute code in an isolated Docker container. Supports: python, javascript, typescript, ruby, go, rust, bash, c, cpp. Auto-cleans up after execution. Safe for untrusted code.',
        parameters: {
            code: { type: 'string', description: 'Source code to execute', required: true },
            language: { type: 'string', description: 'Programming language (python, javascript, typescript, ruby, go, rust, bash, c, cpp)', required: true },
            timeout: { type: 'number', description: 'Timeout in seconds (default: 30, max: 300)' },
            packages: { type: 'string', description: 'Space-separated packages to install before running (e.g., "numpy pandas" for Python)' },
            stdin: { type: 'string', description: 'Input to pipe to stdin' },
        },
        tier: 'free',
        async execute(args) {
            const code = String(args.code);
            const language = String(args.language).toLowerCase();
            const timeout = Math.min(typeof args.timeout === 'number' ? args.timeout : 30, 300);
            const packages = args.packages ? String(args.packages) : '';
            const stdinInput = args.stdin ? String(args.stdin) : '';
            const config = LANGUAGE_CONFIGS[language];
            if (!config) {
                return `Error: Unsupported language "${language}". Supported: ${Object.keys(LANGUAGE_CONFIGS).join(', ')}`;
            }
            if (!isDockerAvailable()) {
                return 'Error: Docker is not available. Install Docker Desktop to use sandboxed execution.\n\nAlternative: use the `bash` tool for local execution (not sandboxed).';
            }
            // Write code to temp file
            const tmpDir = join(tmpdir(), `kbot-sandbox-${Date.now()}`);
            mkdirSync(tmpDir, { recursive: true });
            const codeFile = join(tmpDir, `main${config.ext}`);
            writeFileSync(codeFile, code);
            // Build Docker command
            const containerName = `kbot-sandbox-${Date.now()}`;
            const dockerArgs = [
                'run',
                '--rm',
                '--name', containerName,
                '--network', 'none', // No network access
                '--memory', '512m', // Memory limit
                '--cpus', '1', // CPU limit
                '--pids-limit', '100', // Process limit
                '--read-only', // Read-only filesystem
                '--tmpfs', '/tmp:rw,size=100m', // Writable /tmp
                '-v', `${tmpDir}:/workspace:ro`, // Mount code read-only
                '-w', '/workspace',
            ];
            // Install packages if specified
            let installCmd = '';
            if (packages) {
                switch (language) {
                    case 'python':
                        installCmd = `pip install --quiet ${packages} && `;
                        // Need writable for pip
                        dockerArgs.splice(dockerArgs.indexOf('--read-only'), 1);
                        break;
                    case 'javascript':
                    case 'typescript':
                        installCmd = `npm install --no-save ${packages} 2>/dev/null && `;
                        dockerArgs.splice(dockerArgs.indexOf('--read-only'), 1);
                        break;
                    case 'ruby':
                        installCmd = `gem install ${packages} --no-document && `;
                        dockerArgs.splice(dockerArgs.indexOf('--read-only'), 1);
                        break;
                }
            }
            const runCmd = `${installCmd}${config.runCmd('/workspace/main' + config.ext)}`;
            dockerArgs.push(config.image, 'sh', '-c', runCmd);
            try {
                const startTime = Date.now();
                let result;
                if (stdinInput) {
                    // Use spawn for stdin piping
                    result = await new Promise((resolve, reject) => {
                        const proc = spawn('docker', dockerArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
                        let stdout = '';
                        let stderr = '';
                        proc.stdout.on('data', (d) => { stdout += d.toString(); });
                        proc.stderr.on('data', (d) => { stderr += d.toString(); });
                        proc.stdin.write(stdinInput);
                        proc.stdin.end();
                        const timer = setTimeout(() => {
                            proc.kill();
                            try {
                                execSync(`docker kill ${containerName}`, { stdio: 'ignore' });
                            }
                            catch { }
                            reject(new Error(`Timeout: execution exceeded ${timeout}s`));
                        }, timeout * 1000);
                        proc.on('close', (code) => {
                            clearTimeout(timer);
                            const output = [stdout, stderr].filter(Boolean).join('\n');
                            if (code !== 0) {
                                resolve(`Exit code ${code}\n${output}`);
                            }
                            else {
                                resolve(output || '(no output)');
                            }
                        });
                        proc.on('error', (err) => {
                            clearTimeout(timer);
                            reject(err);
                        });
                    });
                }
                else {
                    result = execSync(['docker', ...dockerArgs].map(a => a.includes(' ') ? `"${a}"` : a).join(' '), {
                        encoding: 'utf-8',
                        timeout: timeout * 1000,
                        maxBuffer: 5 * 1024 * 1024,
                    }).trim() || '(no output)';
                }
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                // Clean up temp dir
                try {
                    execSync(`rm -rf "${tmpDir}"`, { stdio: 'ignore' });
                }
                catch { }
                return `${result}\n\n⏱ ${elapsed}s (sandboxed, ${language})`;
            }
            catch (err) {
                // Clean up
                try {
                    execSync(`docker kill ${containerName}`, { stdio: 'ignore' });
                }
                catch { }
                try {
                    execSync(`rm -rf "${tmpDir}"`, { stdio: 'ignore' });
                }
                catch { }
                const e = err;
                const output = [e.stdout, e.stderr].filter(Boolean).join('\n').trim();
                return `Sandbox error:\n${output || e.message || 'Unknown error'}`;
            }
        },
    });
    registerTool({
        name: 'sandbox_start',
        description: 'Start a persistent sandbox container that stays running. Useful for multi-step execution.',
        parameters: {
            language: { type: 'string', description: 'Language/runtime for the sandbox', required: true },
            packages: { type: 'string', description: 'Packages to pre-install' },
        },
        tier: 'free',
        async execute(args) {
            const language = String(args.language).toLowerCase();
            const packages = args.packages ? String(args.packages) : '';
            const config = LANGUAGE_CONFIGS[language];
            if (!config) {
                return `Error: Unsupported language "${language}". Supported: ${Object.keys(LANGUAGE_CONFIGS).join(', ')}`;
            }
            if (!isDockerAvailable()) {
                return 'Error: Docker is not available.';
            }
            const id = String(nextSandboxId++);
            const containerName = `kbot-sandbox-persistent-${id}`;
            // Start detached container
            const dockerArgs = [
                'run', '-d',
                '--name', containerName,
                '--network', 'none',
                '--memory', '512m',
                '--cpus', '1',
                '--pids-limit', '100',
                config.image,
                'sleep', '3600', // Keep alive for 1 hour
            ];
            try {
                const containerId = execSync(`docker ${dockerArgs.join(' ')}`, {
                    encoding: 'utf-8',
                    timeout: 60000,
                }).trim();
                // Install packages if specified
                if (packages) {
                    let installCmd = '';
                    switch (language) {
                        case 'python':
                            installCmd = `pip install --quiet ${packages}`;
                            break;
                        case 'javascript':
                        case 'typescript':
                            installCmd = `npm install -g ${packages} 2>/dev/null`;
                            break;
                        case 'ruby':
                            installCmd = `gem install ${packages} --no-document`;
                            break;
                    }
                    if (installCmd) {
                        try {
                            execSync(`docker exec ${containerName} sh -c "${installCmd}"`, {
                                stdio: 'ignore', timeout: 120000,
                            });
                        }
                        catch { /* non-fatal */ }
                    }
                }
                sandboxes.set(id, {
                    id,
                    containerId: containerId.slice(0, 12),
                    language,
                    createdAt: new Date().toISOString(),
                });
                return `Sandbox #${id} started (${language}, container ${containerId.slice(0, 12)})`;
            }
            catch (err) {
                return `Error starting sandbox: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    registerTool({
        name: 'sandbox_exec',
        description: 'Execute a command in a running persistent sandbox.',
        parameters: {
            id: { type: 'string', description: 'Sandbox ID', required: true },
            command: { type: 'string', description: 'Command to execute', required: true },
            timeout: { type: 'number', description: 'Timeout in seconds (default: 30)' },
        },
        tier: 'free',
        async execute(args) {
            const id = String(args.id);
            const command = String(args.command);
            const timeout = Math.min(typeof args.timeout === 'number' ? args.timeout : 30, 300);
            const sandbox = sandboxes.get(id);
            if (!sandbox)
                return `Error: Sandbox #${id} not found`;
            const containerName = `kbot-sandbox-persistent-${id}`;
            try {
                const result = execSync(`docker exec ${containerName} sh -c ${JSON.stringify(command)}`, {
                    encoding: 'utf-8',
                    timeout: timeout * 1000,
                    maxBuffer: 5 * 1024 * 1024,
                });
                return result.trim() || '(no output)';
            }
            catch (err) {
                const e = err;
                const output = [e.stdout, e.stderr].filter(Boolean).join('\n').trim();
                return `Exit code ${e.status || 1}\n${output || e.message || 'Command failed'}`;
            }
        },
    });
    registerTool({
        name: 'sandbox_stop',
        description: 'Stop and remove a persistent sandbox container.',
        parameters: {
            id: { type: 'string', description: 'Sandbox ID', required: true },
        },
        tier: 'free',
        async execute(args) {
            const id = String(args.id);
            const sandbox = sandboxes.get(id);
            if (!sandbox)
                return `Error: Sandbox #${id} not found`;
            const containerName = `kbot-sandbox-persistent-${id}`;
            try {
                execSync(`docker rm -f ${containerName}`, { stdio: 'ignore', timeout: 10000 });
            }
            catch { /* already gone */ }
            sandboxes.delete(id);
            return `Sandbox #${id} stopped and removed`;
        },
    });
    registerTool({
        name: 'sandbox_list',
        description: 'List all active sandboxes.',
        parameters: {},
        tier: 'free',
        async execute() {
            if (sandboxes.size === 0)
                return 'No active sandboxes.';
            const lines = [];
            for (const [id, sb] of sandboxes) {
                lines.push(`#${id}: ${sb.language} (container ${sb.containerId}, started ${sb.createdAt})`);
            }
            return lines.join('\n');
        },
    });
}
//# sourceMappingURL=sandbox.js.map