// Tests for kbot init — project onboarding
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initProject, formatInitReport } from './init.js';
const TEST_DIR = join(tmpdir(), '.kbot-init-test-' + Date.now());
beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
});
afterAll(() => {
    try {
        rmSync(TEST_DIR, { recursive: true, force: true });
    }
    catch { /* ignore */ }
});
describe('initProject', () => {
    it('detects a TypeScript/React project', async () => {
        const projDir = join(TEST_DIR, 'react-app');
        mkdirSync(projDir, { recursive: true });
        writeFileSync(join(projDir, 'package.json'), JSON.stringify({
            name: 'my-react-app',
            scripts: { dev: 'vite', build: 'vite build', test: 'vitest run', lint: 'eslint .' },
            dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
            devDependencies: { typescript: '^5.0.0', vite: '^5.0.0' },
        }));
        writeFileSync(join(projDir, 'tsconfig.json'), '{}');
        writeFileSync(join(projDir, 'package-lock.json'), '{}');
        const config = await initProject(projDir);
        expect(config.name).toBe('my-react-app');
        expect(config.language).toBe('TypeScript');
        expect(config.framework).toBe('React');
        expect(config.packageManager).toBe('npm');
        expect(config.commands.dev).toBeTruthy();
        expect(config.commands.test).toBeTruthy();
        expect(config.commands.build).toBeTruthy();
        expect(config.forgedTools.length).toBeGreaterThan(0);
        expect(existsSync(join(projDir, '.kbot.json'))).toBe(true);
    });
    it('detects a Python project', async () => {
        const projDir = join(TEST_DIR, 'flask-api');
        mkdirSync(projDir, { recursive: true });
        writeFileSync(join(projDir, 'pyproject.toml'), `[project]\nname = "flask-api"\n`);
        writeFileSync(join(projDir, 'requirements.txt'), 'flask\ngunicorn\n');
        const config = await initProject(projDir);
        expect(config.name).toBe('flask-api');
        expect(config.language).toBe('Python');
        expect(config.framework).toBe('Flask');
    });
    it('detects a Rust project', async () => {
        const projDir = join(TEST_DIR, 'rust-cli');
        mkdirSync(projDir, { recursive: true });
        writeFileSync(join(projDir, 'Cargo.toml'), `[package]\nname = "rust-cli"\nversion = "0.1.0"\n`);
        writeFileSync(join(projDir, 'Cargo.lock'), '');
        const config = await initProject(projDir);
        expect(config.name).toBe('rust-cli');
        expect(config.language).toBe('Rust');
        expect(config.packageManager).toBe('cargo');
        expect(config.commands.build).toBe('cargo build');
        expect(config.commands.test).toBe('cargo test');
    });
    it('handles empty directory gracefully', async () => {
        const projDir = join(TEST_DIR, 'empty');
        mkdirSync(projDir, { recursive: true });
        const config = await initProject(projDir);
        expect(config.name).toBe('empty');
        expect(config.keyFiles.length).toBe(0);
    });
});
describe('formatInitReport', () => {
    it('formats a config into readable output', () => {
        const report = formatInitReport({
            name: 'test-project',
            language: 'TypeScript',
            framework: 'React',
            packageManager: 'npm',
            defaultAgent: 'coder',
            keyFiles: ['package.json', 'tsconfig.json'],
            commands: { dev: 'npm run dev', test: 'npm test' },
            forgedTools: ['run_tests', 'build_project'],
            fileCounts: { '.ts': 10, '.tsx': 5, '.css': 3 },
            totalFiles: 18,
            createdAt: new Date().toISOString(),
        });
        expect(report).toContain('test-project');
        expect(report).toContain('TypeScript');
        expect(report).toContain('React');
        expect(report).toContain('run_tests');
    });
});
//# sourceMappingURL=init.test.js.map