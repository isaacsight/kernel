# Publishing kbot to npm from your phone

You don't need a laptop. The `Publish kbot to npm` workflow in `.github/workflows/publish-kbot.yml` does the whole build → test → publish chain from GitHub Actions.

## One-time setup (do this from a computer once, before your first mobile publish)

1. **Generate an npm automation token**
   - npmjs.com → profile picture → Access Tokens → Generate new token → **Automation** (bypasses 2FA for CI)
   - Scope it to the `@kernel.chat/kbot` package if you want to be safe
   - Copy the token (you won't see it again)

2. **Add it as a GitHub repo secret**
   - `github.com/isaacsight/kernel/settings/secrets/actions` → New repository secret
   - Name: `NPM_TOKEN`
   - Value: (paste the token)

That's it. Now publishing is phone-friendly.

## Publishing from the GitHub mobile app

**Option A — manual trigger, easiest (recommended for vacation):**

1. Open the GitHub mobile app → `isaacsight/kernel` → tap "Actions" (bottom tab or ••• menu)
2. Pick **Publish kbot to npm**
3. Tap **Run workflow**
4. Fill in the inputs:
   - **Version bump**: `patch` (bug fixes), `minor` (new features), `major` (breaking), or an exact version like `3.75.0`. Leave blank to publish the version currently in `package.json`.
   - **Dry run**: toggle ON the first time to verify everything works without actually uploading
5. Tap **Run workflow** — done. Watch the run complete (≈ 2-3 min).

**Option B — push a tag (also works from mobile via the gh app or Working Copy on iOS):**

1. Bump `packages/kbot/package.json` version manually (edit via GitHub mobile file editor)
2. Commit to main
3. On the commit, tap "Tag" or create one via Releases → "Create new release" with tag `kbot-v3.75.0`
4. Publishing starts automatically

**Option C — create a GitHub Release:**

1. `isaacsight/kernel` → Releases → Draft a new release
2. Tag: `kbot-v3.75.0` (must start with `kbot-v`)
3. Publish — the workflow triggers on the release event

## What the workflow does

1. Checks out the repo
2. Installs deps for root + `packages/kbot`
3. (workflow_dispatch only) Optionally bumps the version and commits it
4. Runs `npm run build` inside `packages/kbot`
5. Runs `npx vitest run`
6. Verifies the version isn't already on npm (fails fast if it is)
7. `npm publish --access public --provenance` — the `--provenance` flag attests the build came from this exact GitHub Actions run, which npm shows as a trust badge on your package page
8. Tags the commit `kbot-v<version>` and pushes the tag

## Safety notes

- Publishing uses the `NPM_TOKEN` automation token — it bypasses 2FA by design, so **never paste this token anywhere except the GitHub secret UI**
- The workflow refuses to publish a version that's already on npm (fails at the `Verify version` step)
- `--provenance` means anyone inspecting `@kernel.chat/kbot@<v>` on npm can verify it was built from this repo at a specific commit. If your npm token is ever stolen, a bad actor can't publish under your name from somewhere else without tripping that signature.
- Concurrency is set to `cancel-in-progress: false` so two publishes can't race each other.

## Troubleshooting (from your phone)

- **"403 Forbidden" during publish**: `NPM_TOKEN` is missing, expired, or wrong type. Regenerate as **Automation** type, not "Publish" or "Read".
- **"Version X is already published"**: bump the version (`minor` / `patch`) and re-run.
- **Build fails**: typecheck or tests broke. Open the failing run, see the red step, fix on a branch via the GitHub mobile editor, merge, re-run.
- **Need to abort an in-flight publish**: Actions → running job → "Cancel workflow". If npm already accepted the upload, you'll need `npm unpublish @kernel.chat/kbot@<v>` within 72 hours (which you can't do from phone — use Termux/iSH or wait).

## Alternatives if you want a real terminal on your phone

- **Android**: [Termux](https://termux.dev/) → install Node → `npm login` → `cd kernel/packages/kbot && npm publish`. Full laptop parity.
- **iOS/iPadOS**: [Working Copy](https://workingcopy.app/) for git + [a-Shell](https://holzschu.github.io/a-Shell_iOS/) for a POSIX shell with Node. Clunkier than Termux but works.
- **Either OS**: GitHub Codespaces via the GitHub mobile app's "Open in Codespaces" — gives you a real VS Code / terminal running on GitHub's servers, accessed from your phone browser. Overkill for a publish but handy for emergencies.

The Actions workflow is still the easiest path — one tap on vacation, no cables, no laptop.
