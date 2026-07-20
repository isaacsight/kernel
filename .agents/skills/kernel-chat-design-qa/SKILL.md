---
name: kernel-chat-design-qa
description: Audits kernel.chat pages for responsive visual craft, accessibility, motion safety, interaction truth, runtime health, and production rendering. Use when reviewing an issue or artifact, checking whether a design is finished, comparing desktop and mobile, validating reduced motion or print, finding overflow and broken media, or proving that a published route matches the build.
---

# Kernel.chat Design QA

## Purpose

Prove the page works as a designed publication, not merely as compiling code. Inspect rendered output, exercise interactions, and separate hard failures from craft improvements.

Use this skill after `$kernel-chat-web-design`. If the problem is conceptual rather than implementation-level, return to `$kernel-chat-art-direction`. When the user asks for review only, report findings without editing files.

## Establish the Review Target

Record:

- Route or file under review
- Local development, production build, or live deployment
- Intended issue identity and core interaction
- Required desktop and mobile widths
- Whether print and standalone artifact filing apply

Do not treat a passing local development route as proof of a production deployment.

## Run the Automated Baseline

From the repository root:

```bash
node .agents/skills/kernel-chat-design-qa/scripts/audit-page.mjs <url> <output-directory>
```

The script records desktop and mobile screenshots, document structure, overflow, broken images, undersized controls, runtime errors, reduced-motion activity, and a print proof. It writes `audit.json` beside the screenshots and exits nonzero on hard runtime failures.

Automated output is evidence, not a design verdict. Open the screenshots and inspect them visually.

## Inspect in This Order

1. **Identity:** confirm the page has one legible editorial argument and a recognizable issue silhouette.
2. **Hierarchy:** read the page at thumbnail size, normal size, and 200% zoom. Confirm the eye encounters title, claim, evidence, and navigation in the intended order.
3. **Responsive composition:** compare desktop and mobile as distinct compositions. Check every major section, long heading, bilingual lockup, caption, table, and control.
4. **Interaction:** use keyboard, pointer, and touch-sized viewport. Confirm focus is visible, states are named, controls tell the truth, and content remains understandable without interaction.
5. **Motion:** observe initial load, repeated navigation, fast scrolling, and reduced motion. Confirm the resting page is complete and no essential state depends on animation.
6. **Media:** verify crops, resolution, loading behavior, alt text, poster states, aspect ratios, and that every asset belongs to the same visual grammar.
7. **Reading quality:** check line length, widows, awkward wraps, contrast, caption proximity, density, and the rhythm between compression and release.
8. **Print and artifact filing:** confirm all states remain available in print and standalone artifacts are self-contained when required.
9. **Production truth:** verify the built file exists, the deployed URL resolves, assets load from production paths, and no console or page errors appear live.

## Classify Findings

Use these priorities:

- **P0 — blocks publication:** broken route, unreadable content, lost interaction state, severe accessibility failure, or missing production artifact.
- **P1 — materially harms the issue:** overflow, broken media, misleading control, inaccessible keyboard path, motion violation, or collapsed visual hierarchy.
- **P2 — visible craft defect:** weak crop, awkward type wrap, inconsistent spacing, generic section rhythm, or unclear affordance.
- **P3 — refinement:** subtle timing, optical alignment, texture, or copy polish that does not impair understanding.

Report findings first, ordered by priority, with route, viewport, reproduction, and evidence. Then summarize what passed and identify remaining uncertainty.

## Publication Gate

Do not call the issue finished until:

- No P0 or P1 findings remain.
- Desktop and mobile screenshots have been visually inspected.
- Keyboard and reduced-motion behavior have been exercised.
- Runtime console and page errors are clear.
- Production build contains every routed artifact and asset.
- The live route is checked after deployment when publication is in scope.
