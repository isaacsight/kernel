// kbot Forge Tool Security Tests
// Validates the security blocklist and input validation for forge_tool.
import { describe, it, expect } from 'vitest';
import { validateCode, registerForgeTools } from './forge.js';
import { getTool } from './index.js';
// Register once
registerForgeTools();
// -----------------------------------------------------------------
// 1. Registration
// -----------------------------------------------------------------
describe('Forge Tool Registration', () => {
    it('registers the forge_tool', () => {
        const tool = getTool('forge_tool');
        expect(tool).toBeTruthy();
        expect(tool.tier).toBe('free');
        expect(tool.parameters.name.required).toBe(true);
        expect(tool.parameters.code.required).toBe(true);
    });
});
// -----------------------------------------------------------------
// 2. Security blocklist — code generation / eval
// -----------------------------------------------------------------
describe('Forge Security - Code Generation', () => {
    it('blocks eval()', () => {
        expect(validateCode('return eval("1+1")')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks new Function()', () => {
        expect(validateCode('const f = new Function("return 1")')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks AsyncFunction access via getPrototypeOf', () => {
        const code = 'const AF = Object.getPrototypeOf(async function(){}).constructor';
        expect(validateCode(code)).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks direct AsyncFunction reference', () => {
        expect(validateCode('const AF = AsyncFunction')).toEqual(expect.objectContaining({ safe: false }));
    });
});
// -----------------------------------------------------------------
// 3. Security blocklist — process access
// -----------------------------------------------------------------
describe('Forge Security - Process', () => {
    it('blocks process.exit', () => {
        expect(validateCode('process.exit(1)')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks process.kill', () => {
        expect(validateCode('process.kill(process.pid)')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks process.env (secrets leakage)', () => {
        expect(validateCode('return process.env.ANTHROPIC_API_KEY')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks process.binding', () => {
        expect(validateCode('process.binding("spawn_sync")')).toEqual(expect.objectContaining({ safe: false }));
    });
});
// -----------------------------------------------------------------
// 4. Security blocklist — child_process (both bare and node: protocol)
// -----------------------------------------------------------------
describe('Forge Security - Child Process', () => {
    it('blocks require("child_process")', () => {
        expect(validateCode('const cp = require("child_process")')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks require("node:child_process")', () => {
        expect(validateCode('const cp = require("node:child_process")')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks import("child_process")', () => {
        expect(validateCode('const cp = await import("child_process")')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks import("node:child_process")', () => {
        expect(validateCode('const cp = await import("node:child_process")')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks execSync', () => {
        expect(validateCode('execSync("whoami")')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks spawnSync', () => {
        expect(validateCode('spawnSync("ls")')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks exec()', () => {
        expect(validateCode('exec("ls", (e, s) => {})')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks spawn()', () => {
        expect(validateCode('spawn("ls", ["-la"])')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks execFileSync', () => {
        expect(validateCode('execFileSync("/bin/sh", ["-c", "id"])')).toEqual(expect.objectContaining({ safe: false }));
    });
});
// -----------------------------------------------------------------
// 5. Security blocklist — filesystem
// -----------------------------------------------------------------
describe('Forge Security - Filesystem', () => {
    it('blocks require("fs")', () => {
        expect(validateCode('const fs = require("fs")')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks require("node:fs")', () => {
        expect(validateCode('const fs = require("node:fs")')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks import("fs/promises")', () => {
        expect(validateCode('const fsp = await import("fs/promises")')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks import("node:fs/promises")', () => {
        expect(validateCode('const fsp = await import("node:fs/promises")')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks fs.rmSync', () => {
        expect(validateCode('fs.rmSync("/tmp/x", { recursive: true })')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks fs.writeFileSync', () => {
        expect(validateCode('fs.writeFileSync("/tmp/x", "data")')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks fs.unlinkSync', () => {
        expect(validateCode('fs.unlinkSync("/tmp/file")')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks async fs.writeFile', () => {
        expect(validateCode('await fs. writeFile("/tmp/x", "data")')).toEqual(expect.objectContaining({ safe: false }));
    });
});
// -----------------------------------------------------------------
// 6. Security blocklist — network modules
// -----------------------------------------------------------------
describe('Forge Security - Network', () => {
    it('blocks require("net")', () => {
        expect(validateCode('const net = require("net")')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks require("node:net")', () => {
        expect(validateCode('const net = require("node:net")')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks import("node:dgram")', () => {
        expect(validateCode('const dg = await import("node:dgram")')).toEqual(expect.objectContaining({ safe: false }));
    });
});
// -----------------------------------------------------------------
// 7. Security blocklist — prototype pollution
// -----------------------------------------------------------------
describe('Forge Security - Prototype Pollution', () => {
    it('blocks globalThis', () => {
        expect(validateCode('globalThis.secret = 1')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks __proto__', () => {
        expect(validateCode('obj.__proto__.polluted = true')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks constructor[', () => {
        expect(validateCode('obj.constructor["prototype"]')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks Proxy()', () => {
        expect(validateCode('new Proxy(target, handler)')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks Reflect', () => {
        expect(validateCode('Reflect.apply(fn, null, [])')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks Object.setPrototypeOf', () => {
        expect(validateCode('Object.setPrototypeOf(obj, null)')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks Object.defineProperty', () => {
        expect(validateCode('Object.defineProperty(obj, "x", {value: 1})')).toEqual(expect.objectContaining({ safe: false }));
    });
});
// -----------------------------------------------------------------
// 8. Security blocklist — dynamic import evasion
// -----------------------------------------------------------------
describe('Forge Security - Dynamic Import Evasion', () => {
    it('blocks import with variable', () => {
        expect(validateCode('const m = await import(moduleName)')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks require with variable', () => {
        expect(validateCode('const m = require(moduleName)')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks import with template literal', () => {
        expect(validateCode('const m = await import(`child_process`)')).toEqual(expect.objectContaining({ safe: false }));
    });
    it('blocks import with node: protocol template literal', () => {
        expect(validateCode('const m = await import(`node:child_process`)')).toEqual(expect.objectContaining({ safe: false }));
    });
});
// -----------------------------------------------------------------
// 9. Safe code that SHOULD pass
// -----------------------------------------------------------------
describe('Forge Security - Safe Code Allowed', () => {
    it('allows simple string manipulation', () => {
        expect(validateCode('return args.text.toUpperCase()')).toEqual({ safe: true });
    });
    it('allows math operations', () => {
        expect(validateCode('return String(args.a + args.b)')).toEqual({ safe: true });
    });
    it('allows JSON parsing', () => {
        expect(validateCode('return JSON.stringify(JSON.parse(args.json))')).toEqual({ safe: true });
    });
    it('allows array operations', () => {
        expect(validateCode('return args.items.filter(x => x > 0).join(",")')).toEqual({ safe: true });
    });
    it('allows fetch (http client, not raw sockets)', () => {
        expect(validateCode('const res = await fetch(args.url); return await res.text()')).toEqual({ safe: true });
    });
    it('allows Date operations', () => {
        expect(validateCode('return new Date().toISOString()')).toEqual({ safe: true });
    });
    it('allows regex', () => {
        expect(validateCode('return args.text.match(/\\d+/g)?.join(",") || "none"')).toEqual({ safe: true });
    });
    it('allows Map and Set', () => {
        expect(validateCode('const s = new Set(args.items); return String(s.size)')).toEqual({ safe: true });
    });
});
// -----------------------------------------------------------------
// 10. Input validation via forge_tool execute
// -----------------------------------------------------------------
describe('Forge Tool Input Validation', () => {
    const forge = getTool('forge_tool');
    it('rejects empty name', async () => {
        const result = await forge.execute({ name: '', description: 'test', code: 'return "ok"', parameters: {} });
        expect(result).toContain('Error');
    });
    it('rejects non-snake_case name', async () => {
        const result = await forge.execute({ name: 'MyTool', description: 'test', code: 'return "ok"', parameters: {} });
        expect(result).toContain('Error');
        expect(result).toContain('snake_case');
    });
    it('rejects name starting with number', async () => {
        const result = await forge.execute({ name: '1tool', description: 'test', code: 'return "ok"', parameters: {} });
        expect(result).toContain('Error');
    });
    it('rejects name over 64 characters', async () => {
        const longName = 'a'.repeat(65);
        const result = await forge.execute({ name: longName, description: 'test', code: 'return "ok"', parameters: {} });
        expect(result).toContain('Error');
        expect(result).toContain('64');
    });
    it('rejects reserved tool names', async () => {
        const result = await forge.execute({ name: 'bash', description: 'test', code: 'return "ok"', parameters: {} });
        expect(result).toContain('Error');
        expect(result).toContain('built-in');
    });
    it('rejects forge_tool overwrite', async () => {
        const result = await forge.execute({ name: 'forge_tool', description: 'test', code: 'return "ok"', parameters: {} });
        expect(result).toContain('Error');
        expect(result).toContain('built-in');
    });
    it('rejects dangerous code', async () => {
        const result = await forge.execute({ name: 'bad_tool', description: 'test', code: 'process.exit(1)', parameters: {} });
        expect(result).toContain('Security error');
    });
    it('accepts valid safe tool', async () => {
        const result = await forge.execute({
            name: 'test_adder',
            description: 'Adds two numbers',
            code: 'return String(Number(args.a) + Number(args.b))',
            parameters: { a: { type: 'number', description: 'First number', required: true }, b: { type: 'number', description: 'Second number', required: true } },
        });
        expect(result).toContain('forged successfully');
    });
});
//# sourceMappingURL=forge.test.js.map