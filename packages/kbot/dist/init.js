// kbot init — 60-second project onboarding
//
// Scans a repo, detects stack, generates .kbot.json config,
// creates project-specific forged tools, and prints a ready message.
//
// Usage: kbot init
//
// This is the first thing a new user runs. It must be fast,
// useful, and make kbot feel like it belongs in the project.
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
// ── Detection ──
function quickExec(cmd, timeoutMs = 2000) {
    try {
        return execSync(cmd, { encoding: 'utf-8', timeout: timeoutMs, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    }
    catch {
        return '';
    }
}
function detectProjectName(root) {
    // Try package.json first
    const pkgPath = join(root, 'package.json');
    if (existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
            if (pkg.name)
                return pkg.name;
        }
        catch { /* ignore */ }
    }
    // Try Cargo.toml
    const cargoPath = join(root, 'Cargo.toml');
    if (existsSync(cargoPath)) {
        const match = readFileSync(cargoPath, 'utf8').match(/name\s*=\s*"([^"]+)"/);
        if (match)
            return match[1];
    }
    // Try pyproject.toml
    const pyPath = join(root, 'pyproject.toml');
    if (existsSync(pyPath)) {
        const match = readFileSync(pyPath, 'utf8').match(/name\s*=\s*"([^"]+)"/);
        if (match)
            return match[1];
    }
    // Fall back to directory name
    return basename(root);
}
function detectLanguage(root) {
    if (existsSync(join(root, 'tsconfig.json')))
        return 'TypeScript';
    if (existsSync(join(root, 'package.json')))
        return 'JavaScript';
    if (existsSync(join(root, 'Cargo.toml')))
        return 'Rust';
    if (existsSync(join(root, 'go.mod')))
        return 'Go';
    if (existsSync(join(root, 'pyproject.toml')) || existsSync(join(root, 'setup.py')))
        return 'Python';
    if (existsSync(join(root, 'build.gradle')) || existsSync(join(root, 'pom.xml')))
        return 'Java';
    if (existsSync(join(root, 'Package.swift')))
        return 'Swift';
    if (existsSync(join(root, 'mix.exs')))
        return 'Elixir';
    // Count file extensions in top-level src/ or root
    const exts = {};
    const scanDirs = [join(root, 'src'), root];
    for (const dir of scanDirs) {
        try {
            const entries = readdirSync(dir);
            for (const name of entries) {
                const ext = name.split('.').pop() || '';
                if (ext !== name)
                    exts[ext] = (exts[ext] || 0) + 1;
            }
        }
        catch { /* dir doesn't exist */ }
    }
    const langMap = {
        ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
        py: 'Python', rs: 'Rust', go: 'Go', java: 'Java', rb: 'Ruby',
        swift: 'Swift', kt: 'Kotlin', cs: 'C#', cpp: 'C++', c: 'C',
    };
    const sorted = Object.entries(exts)
        .filter(([ext]) => langMap[ext])
        .sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? langMap[sorted[0][0]] : 'Unknown';
}
function detectFramework(root) {
    // Check Node.js frameworks via package.json
    const pkgPath = join(root, 'package.json');
    if (existsSync(pkgPath))
        try {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            if (deps.next)
                return 'Next.js';
            if (deps.nuxt)
                return 'Nuxt';
            if (deps['react-dom'])
                return 'React';
            if (deps.vue)
                return 'Vue';
            if (deps.svelte || deps['@sveltejs/kit'])
                return 'Svelte';
            if (deps.express)
                return 'Express';
            if (deps.fastify)
                return 'Fastify';
            if (deps.hono)
                return 'Hono';
            if (deps.remix || deps['@remix-run/react'])
                return 'Remix';
            if (deps.astro)
                return 'Astro';
            if (deps.nest || deps['@nestjs/core'])
                return 'NestJS';
            if (deps.angular || deps['@angular/core'])
                return 'Angular';
            if (deps.gatsby)
                return 'Gatsby';
            if (deps.electron)
                return 'Electron';
            if (deps.expo)
                return 'Expo (React Native)';
            if (deps['react-native'])
                return 'React Native';
            if (deps.vite)
                return 'Vite';
        }
        catch { /* ignore */ }
    // Python frameworks
    if (existsSync(join(root, 'manage.py')))
        return 'Django';
    const reqPath = join(root, 'requirements.txt');
    if (existsSync(reqPath)) {
        const reqs = readFileSync(reqPath, 'utf8');
        if (/flask/i.test(reqs))
            return 'Flask';
        if (/fastapi/i.test(reqs))
            return 'FastAPI';
        if (/django/i.test(reqs))
            return 'Django';
    }
    // Rust frameworks
    if (existsSync(join(root, 'Cargo.toml'))) {
        const cargo = readFileSync(join(root, 'Cargo.toml'), 'utf8');
        if (/actix/i.test(cargo))
            return 'Actix';
        if (/axum/i.test(cargo))
            return 'Axum';
        if (/rocket/i.test(cargo))
            return 'Rocket';
    }
    return undefined;
}
function detectPackageManager(root) {
    if (existsSync(join(root, 'bun.lockb')))
        return 'bun';
    if (existsSync(join(root, 'pnpm-lock.yaml')))
        return 'pnpm';
    if (existsSync(join(root, 'yarn.lock')))
        return 'yarn';
    if (existsSync(join(root, 'package-lock.json')))
        return 'npm';
    if (existsSync(join(root, 'Cargo.lock')))
        return 'cargo';
    if (existsSync(join(root, 'poetry.lock')))
        return 'poetry';
    if (existsSync(join(root, 'go.sum')))
        return 'go';
    if (existsSync(join(root, 'Pipfile.lock')))
        return 'pipenv';
    return undefined;
}
function detectKeyFiles(root) {
    const candidates = [
        'package.json', 'tsconfig.json', 'Cargo.toml', 'go.mod', 'pyproject.toml',
        'Dockerfile', 'docker-compose.yml', 'Makefile',
        '.env.example', '.github/workflows/ci.yml',
        'src/index.ts', 'src/main.ts', 'src/app.ts', 'src/index.js', 'src/main.js',
        'src/App.tsx', 'src/App.vue', 'src/App.svelte',
        'main.go', 'src/main.rs', 'src/lib.rs',
        'app.py', 'main.py', 'manage.py',
        'README.md', 'CLAUDE.md', '.kbot.md',
    ];
    return candidates.filter(f => existsSync(join(root, f)));
}
function detectCommands(root) {
    const commands = {};
    // From package.json scripts
    const pkgPath = join(root, 'package.json');
    if (existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
            const scripts = pkg.scripts || {};
            const useful = ['dev', 'start', 'build', 'test', 'lint', 'typecheck', 'deploy', 'format', 'check'];
            for (const s of useful) {
                if (scripts[s]) {
                    const pm = detectPackageManager(root) || 'npm';
                    commands[s] = `${pm} run ${s}`;
                }
            }
        }
        catch { /* ignore */ }
    }
    // From Makefile
    if (existsSync(join(root, 'Makefile'))) {
        try {
            const makefile = readFileSync(join(root, 'Makefile'), 'utf8');
            const targets = makefile.match(/^([a-zA-Z_-]+):/gm);
            if (targets) {
                for (const t of targets.slice(0, 8)) {
                    const name = t.replace(':', '');
                    if (!['all', 'clean', '.PHONY', 'default'].includes(name)) {
                        commands[name] = `make ${name}`;
                    }
                }
            }
        }
        catch { /* ignore */ }
    }
    // Cargo commands
    if (existsSync(join(root, 'Cargo.toml'))) {
        commands.build = commands.build || 'cargo build';
        commands.test = commands.test || 'cargo test';
        commands.run = commands.run || 'cargo run';
    }
    // Go commands
    if (existsSync(join(root, 'go.mod'))) {
        commands.build = commands.build || 'go build ./...';
        commands.test = commands.test || 'go test ./...';
    }
    return commands;
}
function suggestAgent(language, framework) {
    if (framework) {
        const webFrameworks = ['React', 'Vue', 'Svelte', 'Next.js', 'Nuxt', 'Angular', 'Remix', 'Astro', 'Gatsby'];
        if (webFrameworks.includes(framework))
            return 'coder';
        if (['Express', 'Fastify', 'Hono', 'NestJS'].includes(framework))
            return 'coder';
        if (['Django', 'Flask', 'FastAPI'].includes(framework))
            return 'coder';
    }
    return 'kernel';
}
function generateProjectTools(config) {
    const tools = [];
    // Test runner
    if (config.commands.test) {
        tools.push({
            name: 'run_tests',
            description: `Run ${config.name} test suite`,
            code: `const { execSync } = require('child_process'); try { return execSync('${config.commands.test}', { encoding: 'utf8', timeout: 120000, cwd: process.cwd() }).slice(-2000); } catch(e) { return 'Tests failed:\\n' + (e.stderr || e.stdout || e.message).slice(-2000); }`,
        });
    }
    // Type checker / linter
    if (config.commands.typecheck || config.commands.lint) {
        const cmd = config.commands.typecheck || config.commands.lint;
        tools.push({
            name: 'check_code',
            description: `Run type-check/lint for ${config.name}`,
            code: `const { execSync } = require('child_process'); try { return execSync('${cmd}', { encoding: 'utf8', timeout: 60000, cwd: process.cwd() }).slice(-2000) || 'All checks passed.'; } catch(e) { return 'Check failed:\\n' + (e.stderr || e.stdout || e.message).slice(-2000); }`,
        });
    }
    // Build
    if (config.commands.build) {
        tools.push({
            name: 'build_project',
            description: `Build ${config.name}`,
            code: `const { execSync } = require('child_process'); try { return execSync('${config.commands.build}', { encoding: 'utf8', timeout: 120000, cwd: process.cwd() }).slice(-2000) || 'Build succeeded.'; } catch(e) { return 'Build failed:\\n' + (e.stderr || e.stdout || e.message).slice(-2000); }`,
        });
    }
    // Dev server
    if (config.commands.dev || config.commands.start) {
        const cmd = config.commands.dev || config.commands.start;
        tools.push({
            name: 'start_dev',
            description: `Start ${config.name} dev server`,
            code: `const { spawn } = require('child_process'); const [bin, ...args] = '${cmd}'.split(' '); const p = spawn(bin, args, { cwd: process.cwd(), stdio: 'pipe' }); let out = ''; p.stdout?.on('data', d => out += d); p.stderr?.on('data', d => out += d); return new Promise(r => setTimeout(() => { p.kill(); r('Dev server started. Output:\\n' + out.slice(-1000)); }, 3000));`,
        });
    }
    return tools;
}
// ── Main Init ──
export async function initProject(root) {
    const name = detectProjectName(root);
    const language = detectLanguage(root);
    const framework = detectFramework(root);
    const packageManager = detectPackageManager(root);
    const keyFiles = detectKeyFiles(root);
    const commands = detectCommands(root);
    const defaultAgent = suggestAgent(language, framework);
    const config = {
        name,
        language,
        framework,
        packageManager,
        defaultAgent,
        keyFiles,
        commands,
        forgedTools: [],
        createdAt: new Date().toISOString(),
    };
    // Generate and save forged tools
    const tools = generateProjectTools(config);
    const forgeDir = join(homedir(), '.kbot', 'plugins', 'forged');
    if (!existsSync(forgeDir))
        mkdirSync(forgeDir, { recursive: true });
    for (const tool of tools) {
        const toolPath = join(forgeDir, `${tool.name}.js`);
        const wrapper = `// Auto-generated by kbot init for ${name}
// ${tool.description}
module.exports = async function(args) {
  ${tool.code}
};
module.exports.description = ${JSON.stringify(tool.description)};
`;
        writeFileSync(toolPath, wrapper);
        config.forgedTools.push(tool.name);
    }
    // Write .kbot.json
    const configPath = join(root, '.kbot.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    // Add to .gitignore if not already there
    const gitignorePath = join(root, '.gitignore');
    if (existsSync(gitignorePath)) {
        const gitignore = readFileSync(gitignorePath, 'utf8');
        if (!gitignore.includes('.kbot.json')) {
            writeFileSync(gitignorePath, gitignore.trimEnd() + '\n.kbot.json\n');
        }
    }
    return config;
}
export function formatInitReport(config) {
    const lines = [];
    lines.push(`  Project:    ${config.name}`);
    lines.push(`  Language:   ${config.language}${config.framework ? ` (${config.framework})` : ''}`);
    if (config.packageManager)
        lines.push(`  Package Mgr: ${config.packageManager}`);
    lines.push(`  Agent:      ${config.defaultAgent}`);
    lines.push(`  Key files:  ${config.keyFiles.length} detected`);
    if (Object.keys(config.commands).length > 0) {
        lines.push(`  Commands:   ${Object.keys(config.commands).join(', ')}`);
    }
    if (config.forgedTools.length > 0) {
        lines.push(`  Tools:      ${config.forgedTools.join(', ')} (auto-forged)`);
    }
    return lines.join('\n');
}
//# sourceMappingURL=init.js.map