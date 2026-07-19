# Kernel.chat Web Review Rubric

Use this before visual approval or publication. A failure in any hard gate blocks shipping.

## Hard gates

### Editorial truth

- The issue has one legible claim or contradiction.
- Every number is sourced, measured, or labelled representative on the surface.
- Simulations, generated assets, and production roles are disclosed accurately.
- User-visible copy uses magazine vocabulary and does not name the house inspiration.

### System integrity

- The issue uses the next free number and is registered exactly once.
- The identity differs materially from recent issues.
- One accent governs the issue.
- New shared machinery has at least two real instances.
- Prior issues render unchanged unless the change is intentionally systemic.

### Interaction

- Removing the control would remove a specific truth, not merely delight.
- The control follows a named ARIA pattern and standard keyboard behavior.
- Every meaningful state stays in the DOM.
- Print renders states in an archival form.
- Focus is visible; touch targets are at least 44px.
- Disabled controls do not animate.

### Motion

- Every move is classified as operational, choreographed, or weather.
- Site motion is CSS-only outside an explicitly registered apparatus.
- Motion is interruptible where it changes state.
- No content depends on animation completion.
- Reduced motion produces the same information and operation with zero decorative animation.
- Continuous animation stops when invisible or is cheap enough to prove harmless.

### Artifact

- `<meta charset="utf-8">` is first.
- One committed HTML file contains the complete artifact; no external font, script, image, or fetch dependency.
- Strict CSP succeeds.
- Light/dark and reduced-motion states are intentional.
- Keyboard reaches every pointer action.
- The colophon shows sources, simulation/measurement status, and session-storage truth.
- The artifact is present in the production deployment payload.

### Mobile

- Test at 390px and 393px, not only a device preset.
- `body.scrollWidth === document.documentElement.clientWidth`.
- No clipped bilingual labels, controls, or monuments.
- Text remains readable at 200% zoom.
- Wide material scrolls inside its own frame.

### Production

- Typecheck, build, tests, adherence, and `git diff --check` pass.
- No secrets or local tokens enter client output.
- Deployment workflow completes successfully.
- Landing identifies the new latest issue.
- Direct issue route, assets, and artifact return the intended content.
- Browser console and page-error collections are empty on production.

## Craft score

Score each dimension 0–3. Require at least 24/30 and no zero.

| Dimension | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Editorial idea | absent | generic | clear | irreducible and memorable |
| Cover | template accident | serviceable | distinct | recognizable at a glance |
| Typography | app-like | inconsistent | disciplined | expressive and controlled |
| Material/color | arbitrary | decorative | coherent | inseparable from subject |
| Composition | stacked blocks | competent | rhythmic | authored across viewport sizes |
| Interaction | garnish | weakly related | truthful | becomes the argument |
| Motion | distracting | generic | purposeful | materially expressive |
| Mobile | broken | reduced | complete | feels designed first |
| Accessibility | blocked | patched | conforming | strengthens the design |
| Finish | obvious seams | mostly clean | production-ready | archive-grade |

## Evidence commands

Adapt paths and selectors to the issue.

```bash
npx tsc --noEmit
npm run build
npm test -- --run
npm run lint:adherence
git diff --check
git status --short
```

Playwright evidence should capture:

- desktop and 390px screenshots;
- title and latest-issue identity;
- every control state and focus destination;
- all referenced images with `naturalWidth > 0` after activation;
- reduced-motion animation count;
- body scroll width versus viewport;
- console errors and uncaught page errors;
- artifact response and internal resource resolution.

For a new production path, verify twice:

1. clean build output contains the file;
2. live URL returns the actual file, not a fallback shell or cached 404.

## Review questions

Ask these after the page works:

1. What should be cut?
2. What looks inherited without being earned?
3. Where did the system flatten the issue's texture?
4. Does the mobile cover still carry the same idea?
5. Does the interaction reveal truth or only state?
6. Is the motion describing material, sequence, or mechanism?
7. Is there one frame a reader will remember tomorrow?
