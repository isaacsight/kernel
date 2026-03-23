// kbot Build Matrix — Cross-platform build system
//
// Detects targets, configures toolchains, builds for any hardware.
// Works with Docker for sandboxed cross-compilation or local tools.
//
// Tools:
//   build_detect   — detect what the current project can build for
//   build_targets  — list all supported build targets
//   build_check    — check if tools are ready for a target
//   build_init     — initialize a project for a target platform
//   build_run      — build the project for a target
//   build_test     — run/test on target (simulator, emulator, device)
//   build_package  — package for distribution (App Store, Play Store, npm, etc.)
//   build_matrix   — build for multiple targets simultaneously
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { registerTool } from './index.js';
import { BUILD_TARGETS, detectProjectTargets, getMissingTools, isToolAvailable, formatTargetInfo, formatTargetList, getTargetsByCategory, } from '../build-targets.js';
/** Resolve $VARIABLE placeholders in commands */
function resolveVars(cmd, vars) {
    let result = cmd;
    for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\$${key}`, 'g'), value);
    }
    return result;
}
/** Get project name from package.json, Cargo.toml, or directory name */
function getProjectName(cwd) {
    // package.json
    const pkgPath = join(cwd, 'package.json');
    if (existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
            if (pkg.name)
                return pkg.name.replace(/^@[\w-]+\//, '');
        }
        catch { /* fall through */ }
    }
    // Cargo.toml
    const cargoPath = join(cwd, 'Cargo.toml');
    if (existsSync(cargoPath)) {
        try {
            const cargo = readFileSync(cargoPath, 'utf-8');
            const nameMatch = cargo.match(/name\s*=\s*"([^"]+)"/);
            if (nameMatch)
                return nameMatch[1];
        }
        catch { /* fall through */ }
    }
    // pubspec.yaml
    const pubspecPath = join(cwd, 'pubspec.yaml');
    if (existsSync(pubspecPath)) {
        try {
            const pubspec = readFileSync(pubspecPath, 'utf-8');
            const nameMatch = pubspec.match(/name:\s*(\S+)/);
            if (nameMatch)
                return nameMatch[1];
        }
        catch { /* fall through */ }
    }
    return basename(cwd);
}
export function registerBuildMatrixTools() {
    registerTool({
        name: 'build_detect',
        description: 'Detect which build targets the current project supports based on config files, package managers, and project structure.',
        parameters: {
            path: { type: 'string', description: 'Project directory (defaults to cwd)' },
        },
        tier: 'free',
        async execute(args) {
            const cwd = args.path ? String(args.path) : process.cwd();
            const detected = detectProjectTargets(cwd);
            if (detected.length === 0) {
                return 'No build targets detected. Use `build_targets` to see all available targets, or `build_init` to set up a new project.';
            }
            const lines = ['Detected build targets:', ''];
            for (const t of detected) {
                const missing = getMissingTools(t);
                const status = missing.length === 0 ? '✓ ready' : `○ needs: ${missing.join(', ')}`;
                lines.push(`  ${status}  ${t.id.padEnd(16)} ${t.name}`);
            }
            lines.push('');
            lines.push(`${detected.length} target(s) detected. Use \`build_check <target>\` for details.`);
            return lines.join('\n');
        },
    });
    registerTool({
        name: 'build_targets',
        description: 'List all supported build targets organized by category (mobile, desktop, embedded, web, server, wasm).',
        parameters: {
            category: { type: 'string', description: 'Filter by category: mobile, desktop, embedded, web, server, wasm' },
        },
        tier: 'free',
        async execute(args) {
            if (args.category) {
                const cat = String(args.category);
                const targets = getTargetsByCategory(cat);
                if (targets.length === 0)
                    return `No targets in category "${cat}". Available: mobile, desktop, embedded, web, server, wasm`;
                return `${cat.toUpperCase()} targets:\n\n${formatTargetList(targets)}`;
            }
            return `kbot Build Matrix — All Targets\n\n${formatTargetList(Object.values(BUILD_TARGETS))}\n${Object.keys(BUILD_TARGETS).length} targets across ${new Set(Object.values(BUILD_TARGETS).map(t => t.category)).size} categories`;
        },
    });
    registerTool({
        name: 'build_check',
        description: 'Check if all required tools are available for a specific build target. Shows what is installed and what is missing.',
        parameters: {
            target: { type: 'string', description: 'Target ID (e.g., ios, android, raspberry-pi, wasm)', required: true },
        },
        tier: 'free',
        async execute(args) {
            const targetId = String(args.target);
            const target = BUILD_TARGETS[targetId];
            if (!target) {
                return `Unknown target "${targetId}". Available: ${Object.keys(BUILD_TARGETS).join(', ')}`;
            }
            const lines = [formatTargetInfo(target), ''];
            // Check each required tool
            if (target.requiredTools.length > 0) {
                lines.push('  Required tools:');
                for (const tool of target.requiredTools) {
                    const available = isToolAvailable(tool);
                    const icon = available ? '✓' : '✗';
                    let version = '';
                    if (available) {
                        try {
                            version = execSync(`${tool} --version 2>/dev/null | head -1`, {
                                encoding: 'utf-8', timeout: 5000,
                            }).trim().slice(0, 60);
                        }
                        catch { /* no version info */ }
                    }
                    lines.push(`    ${icon} ${tool}${version ? ` (${version})` : ''}`);
                }
            }
            // Check Docker availability for sandbox builds
            if (target.dockerImage) {
                const dockerAvail = isToolAvailable('docker');
                lines.push('');
                lines.push(`  Docker (sandbox builds): ${dockerAvail ? '✓ available' : '✗ not installed'}`);
                if (dockerAvail) {
                    lines.push(`  Image: ${target.dockerImage}`);
                }
            }
            return lines.join('\n');
        },
    });
    registerTool({
        name: 'build_init',
        description: 'Initialize a new project for a specific build target. Creates config files, directory structure, and installs dependencies.',
        parameters: {
            target: { type: 'string', description: 'Target ID (e.g., ios, android, pwa, tauri, flutter)', required: true },
            name: { type: 'string', description: 'Project name (defaults to current directory name)' },
            path: { type: 'string', description: 'Directory to initialize (defaults to cwd)' },
        },
        tier: 'free',
        async execute(args) {
            const targetId = String(args.target);
            const target = BUILD_TARGETS[targetId];
            if (!target) {
                return `Unknown target "${targetId}". Use \`build_targets\` to see all options.`;
            }
            const cwd = args.path ? String(args.path) : process.cwd();
            const projectName = args.name ? String(args.name) : getProjectName(cwd);
            const vars = {
                PROJECT_NAME: projectName,
                ORG: 'app',
            };
            const results = [`Initializing ${target.name} project: ${projectName}`, ''];
            for (const cmd of target.initCommands) {
                const resolved = resolveVars(cmd, vars);
                results.push(`  $ ${resolved}`);
                try {
                    const output = execSync(resolved, {
                        encoding: 'utf-8',
                        cwd,
                        timeout: 120000,
                        maxBuffer: 5 * 1024 * 1024,
                    }).trim();
                    if (output)
                        results.push(`    ${output.split('\n').slice(0, 5).join('\n    ')}`);
                    results.push('    ✓ done');
                }
                catch (err) {
                    const e = err;
                    results.push(`    ✗ failed: ${e.stderr?.trim() || e.message || 'Unknown error'}`);
                }
            }
            results.push('');
            results.push(`Project initialized for ${target.name}. Next: \`build_run --target ${targetId}\``);
            return results.join('\n');
        },
    });
    registerTool({
        name: 'build_run',
        description: 'Build the project for a specific target. Auto-detects build tool and configuration.',
        parameters: {
            target: { type: 'string', description: 'Target ID (e.g., ios, android, pwa, docker)', required: true },
            config: { type: 'string', description: 'Build configuration: debug or release (default: release)' },
            arch: { type: 'string', description: 'Target architecture override (e.g., arm64, x86_64)' },
            sandbox: { type: 'boolean', description: 'Force sandboxed Docker build (default: auto)' },
            path: { type: 'string', description: 'Project directory (defaults to cwd)' },
        },
        tier: 'free',
        async execute(args) {
            const targetId = String(args.target);
            const target = BUILD_TARGETS[targetId];
            if (!target) {
                return `Unknown target "${targetId}". Use \`build_targets\` to see all options.`;
            }
            const cwd = args.path ? String(args.path) : process.cwd();
            const config = String(args.config || 'release');
            const useSandbox = args.sandbox === true || (target.dockerImage && getMissingTools(target).length > 0);
            const projectName = getProjectName(cwd);
            const vars = {
                PROJECT_NAME: projectName,
                SCHEME: projectName,
                CONFIG: config === 'debug' ? 'Debug' : 'Release',
                IMAGE_NAME: `${projectName}:latest`,
            };
            const results = [
                `Building ${projectName} for ${target.name}`,
                `  Config: ${config} | Sandbox: ${useSandbox ? 'yes' : 'no'}`,
                '',
            ];
            // If sandbox build and Docker is available
            if (useSandbox && target.dockerImage) {
                if (!isToolAvailable('docker')) {
                    return `Error: Docker required for sandboxed ${target.name} builds. Install Docker Desktop.`;
                }
                const dockerCmd = `docker run --rm -v "${cwd}:/app" -w /app ${target.dockerImage} sh -c "${target.buildCommands[0] ? resolveVars(target.buildCommands[0], vars) : 'echo No build command'}"`;
                results.push(`  $ ${dockerCmd}`);
                try {
                    const output = execSync(dockerCmd, {
                        encoding: 'utf-8',
                        timeout: 600000, // 10 min for builds
                        maxBuffer: 10 * 1024 * 1024,
                    }).trim();
                    const lines = output.split('\n');
                    const preview = lines.slice(-10).join('\n');
                    results.push(preview);
                    results.push('');
                    results.push(`✓ Build complete (sandboxed, ${target.name})`);
                }
                catch (err) {
                    const e = err;
                    results.push(`✗ Build failed:`);
                    results.push(e.stderr?.trim() || e.stdout?.trim() || e.message || 'Unknown error');
                }
            }
            else {
                // Local build
                const missing = getMissingTools(target);
                if (missing.length > 0) {
                    return `Missing tools for ${target.name}: ${missing.join(', ')}\n\nInstall them or use \`sandbox: true\` for Docker-based builds.`;
                }
                // Pick the right build command based on config
                const buildCmd = resolveVars(config === 'debug' && target.buildCommands.length > 1
                    ? target.buildCommands[1]
                    : target.buildCommands[0] || 'echo "No build command defined"', vars);
                results.push(`  $ ${buildCmd}`);
                try {
                    const startTime = Date.now();
                    const output = execSync(buildCmd, {
                        encoding: 'utf-8',
                        cwd,
                        timeout: 600000,
                        maxBuffer: 10 * 1024 * 1024,
                    }).trim();
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    const lines = output.split('\n');
                    results.push(lines.slice(-10).join('\n'));
                    results.push('');
                    results.push(`✓ Build complete in ${elapsed}s (${target.name}, ${config})`);
                }
                catch (err) {
                    const e = err;
                    results.push(`✗ Build failed:`);
                    results.push(e.stderr?.trim() || e.stdout?.trim() || e.message || 'Unknown error');
                }
            }
            return results.join('\n');
        },
    });
    registerTool({
        name: 'build_test',
        description: 'Run or test the built app on target hardware (simulator, emulator, connected device, or local).',
        parameters: {
            target: { type: 'string', description: 'Target ID', required: true },
            device: { type: 'string', description: 'Device identifier (e.g., simulator name, IP address, serial number)' },
            path: { type: 'string', description: 'Project directory' },
        },
        tier: 'free',
        async execute(args) {
            const targetId = String(args.target);
            const target = BUILD_TARGETS[targetId];
            if (!target)
                return `Unknown target "${targetId}".`;
            const cwd = args.path ? String(args.path) : process.cwd();
            const projectName = getProjectName(cwd);
            const device = args.device ? String(args.device) : '';
            const vars = {
                PROJECT_NAME: projectName,
                BUNDLE_ID: `com.app.${projectName}`,
                PACKAGE: `com.app.${projectName}`,
                ACTIVITY: '.MainActivity',
                APP_PATH: `build/Build/Products/Release-iphonesimulator/${projectName}.app`,
                RPI_HOST: device || 'raspberrypi.local',
                PORT: device || '/dev/ttyUSB0',
                BOARD_FQBN: 'arduino:avr:uno',
                IMAGE_NAME: `${projectName}:latest`,
                SERVICE: projectName,
                DEPLOYMENT: projectName,
            };
            if (target.runCommands.length === 0) {
                return `No run commands defined for ${target.name}.`;
            }
            const cmd = resolveVars(target.runCommands[0], vars);
            const results = [`Running ${projectName} on ${target.name}${device ? ` (${device})` : ''}`, '', `  $ ${cmd}`];
            try {
                const output = execSync(cmd, {
                    encoding: 'utf-8',
                    cwd,
                    timeout: 60000,
                    maxBuffer: 5 * 1024 * 1024,
                }).trim();
                results.push(output || '(no output)');
                results.push('');
                results.push(`✓ Running on ${target.name}`);
            }
            catch (err) {
                const e = err;
                results.push(`✗ Run failed: ${e.stderr?.trim() || e.message || 'Unknown error'}`);
            }
            return results.join('\n');
        },
    });
    registerTool({
        name: 'build_package',
        description: 'Package the built app for distribution (App Store, Play Store, npm, Docker registry, etc.).',
        parameters: {
            target: { type: 'string', description: 'Target ID', required: true },
            path: { type: 'string', description: 'Project directory' },
        },
        tier: 'free',
        async execute(args) {
            const targetId = String(args.target);
            const target = BUILD_TARGETS[targetId];
            if (!target)
                return `Unknown target "${targetId}".`;
            if (target.packageCommands.length === 0) {
                return `No packaging commands defined for ${target.name}.`;
            }
            const cwd = args.path ? String(args.path) : process.cwd();
            const projectName = getProjectName(cwd);
            const vars = {
                PROJECT_NAME: projectName,
                IMAGE_NAME: `${projectName}:latest`,
                REGISTRY: 'ghcr.io',
                RELEASE_NAME: projectName,
                ARCHIVE: `build/${projectName}.xcarchive`,
                EXPORT: `build/export`,
                KEYSTORE: 'release.keystore',
                KEY_ALIAS: 'release',
                APP: `build/${projectName}.app`,
                DEB_DIR: `build/${projectName}-deb`,
                SPEC_FILE: `build/${projectName}.spec`,
            };
            const results = [`Packaging ${projectName} for ${target.name}`, ''];
            const cmd = resolveVars(target.packageCommands[0], vars);
            results.push(`  $ ${cmd}`);
            try {
                const output = execSync(cmd, {
                    encoding: 'utf-8',
                    cwd,
                    timeout: 300000,
                    maxBuffer: 10 * 1024 * 1024,
                }).trim();
                results.push(output.split('\n').slice(-5).join('\n'));
                results.push('');
                results.push(`✓ Packaged for ${target.name} distribution`);
            }
            catch (err) {
                const e = err;
                results.push(`✗ Packaging failed: ${e.stderr?.trim() || e.message || 'Unknown error'}`);
            }
            return results.join('\n');
        },
    });
    registerTool({
        name: 'build_matrix',
        description: 'Build for multiple targets simultaneously. Runs builds in parallel using Docker containers where possible.',
        parameters: {
            targets: { type: 'array', description: 'Array of target IDs to build (e.g., ["ios", "android", "pwa"])', required: true, items: { type: 'string' } },
            config: { type: 'string', description: 'Build config: debug or release (default: release)' },
            path: { type: 'string', description: 'Project directory' },
        },
        tier: 'free',
        async execute(args) {
            const targetIds = args.targets || [];
            if (targetIds.length === 0)
                return 'Error: specify at least one target ID';
            const config = String(args.config || 'release');
            const cwd = args.path ? String(args.path) : process.cwd();
            const projectName = getProjectName(cwd);
            // Validate all targets
            const invalidTargets = targetIds.filter(id => !BUILD_TARGETS[id]);
            if (invalidTargets.length > 0) {
                return `Unknown target(s): ${invalidTargets.join(', ')}. Use \`build_targets\` to see all options.`;
            }
            const results = [
                `Build Matrix: ${projectName}`,
                `Targets: ${targetIds.join(', ')} | Config: ${config}`,
                '',
            ];
            const startTime = Date.now();
            // Run all builds in parallel
            const buildPromises = targetIds.map(async (targetId) => {
                const target = BUILD_TARGETS[targetId];
                const vars = {
                    PROJECT_NAME: projectName,
                    SCHEME: projectName,
                    CONFIG: config === 'debug' ? 'Debug' : 'Release',
                    IMAGE_NAME: `${projectName}:latest`,
                };
                const useSandbox = target.dockerImage && getMissingTools(target).length > 0;
                const buildCmd = useSandbox && target.dockerImage
                    ? `docker run --rm -v "${cwd}:/app" -w /app ${target.dockerImage} sh -c "${resolveVars(target.buildCommands[0] || 'echo done', vars)}"`
                    : resolveVars(target.buildCommands[0] || 'echo done', vars);
                try {
                    const output = execSync(buildCmd, {
                        encoding: 'utf-8',
                        cwd: useSandbox ? undefined : cwd,
                        timeout: 600000,
                        maxBuffer: 10 * 1024 * 1024,
                    }).trim();
                    return { target: targetId, success: true, output };
                }
                catch (err) {
                    const e = err;
                    return { target: targetId, success: false, output: e.stderr?.trim() || e.message || 'Failed' };
                }
            });
            const buildResults = await Promise.all(buildPromises);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            for (const r of buildResults) {
                const icon = r.success ? '✓' : '✗';
                results.push(`  ${icon} ${r.target.padEnd(16)} ${r.success ? 'success' : 'FAILED'}`);
                if (!r.success) {
                    results.push(`    ${r.output.split('\n')[0]}`);
                }
            }
            const passed = buildResults.filter(r => r.success).length;
            results.push('');
            results.push(`${passed}/${buildResults.length} targets built in ${elapsed}s`);
            return results.join('\n');
        },
    });
}
//# sourceMappingURL=build-matrix.js.map