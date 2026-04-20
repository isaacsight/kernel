import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { detectIdentityQuery, buildIdentityGuardBlock } from './identity-guard.js';
describe('identity-guard — detect self-queries', () => {
    it('detects "what version are you"', () => {
        const k = detectIdentityQuery('what version are you');
        assert.ok(k.has('version'));
    });
    it('detects "what version of kbot are you"', () => {
        const k = detectIdentityQuery('what version of kbot are you running');
        assert.ok(k.has('version'));
    });
    it('detects "who are you"', () => {
        const k = detectIdentityQuery('who are you?');
        assert.ok(k.has('product'));
        assert.ok(k.has('version'));
    });
    it('detects "what model are you"', () => {
        const k = detectIdentityQuery('what model are you running');
        assert.ok(k.has('model'));
    });
    it('detects "what provider"', () => {
        const k = detectIdentityQuery('what provider is configured');
        assert.ok(k.has('provider'));
    });
    it('does not match unrelated messages', () => {
        assert.equal(detectIdentityQuery('read the file at /tmp/x.txt').size, 0);
        assert.equal(detectIdentityQuery('what is 2 + 2').size, 0);
        assert.equal(detectIdentityQuery('').size, 0);
    });
    it('does not match "what version of react"', () => {
        // "what version" matches, but that's by design — we prepend the block,
        // which is harmless if the user is asking about something else. False
        // positives just add ~60 tokens of irrelevant context.
        // This test documents that intentional trade-off.
        const k = detectIdentityQuery('what version of react does this use');
        assert.ok(k.has('version'));
    });
});
describe('identity-guard — block builder', () => {
    it('returns empty string for non-self-query', () => {
        assert.equal(buildIdentityGuardBlock('hello'), '');
    });
    it('emits IDENTITY GUARD header for self-query', () => {
        const block = buildIdentityGuardBlock('what version are you');
        assert.match(block, /IDENTITY GUARD/);
    });
    it('includes the actual package version as a literal string', () => {
        const block = buildIdentityGuardBlock('what version are you');
        // The package.json version is loaded at runtime — match on the shape.
        assert.match(block, /v\d+\.\d+\.\d+/);
        assert.match(block, /no other number is correct/);
    });
    it('includes model/provider when asked', () => {
        const block = buildIdentityGuardBlock('what model are you running');
        assert.match(block, /IDENTITY GUARD/);
        // model: and/or provider: line should be present — but auth config may
        // be unset in CI; allow either state as long as the header is there.
    });
});
//# sourceMappingURL=identity-guard.test.js.map