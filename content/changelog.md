---
title: "Studio Changelog"
date: 2025-12-15
description: "A record of what the Studio OS has learned."
slug: changelog
type: log
---

# Studio Changelog: The Learning Loop

**Intelligence is the rate at which you learn from your environment.**
This log tracks the "Lessons Learned" that drive our evolution.
[View Decision Log →](decision-log.html)

<div class="decision-feed">

## Dec 2025: Logic Belongs in Code, Not No-Code
- **Lesson:** While n8n is excellent for moving data (Linear -> Postgres), it is terrible for encoding business logic (If X then Y).
- **Signal:** Debugging the "TikTok Poster" workflow took 3x longer in n8n UI than writing the equivalent Python classes.
- **Action:** Refactored all complex logic into `admin.engineers` (Python). N8n is now strictly a dumb pipe.

## Nov 2025: Alignment is Pre-Requisite to Speed
- **Lesson:** Building fast (Velocity) without clear principles (Alignment) just creates technical debt faster.
- **Signal:** We built 3 prototypes that "worked" but felt wrong and were abandoned.
- **Action:** Created the **Alignment Lens** pattern to pre-validate ideas before a single line of code is written.

## Oct 2025: The "Advisor" Model beats "Builder"
- **Lesson:** Building for others (Commission) traps you in their context. Advising others (Pattern Licensing) leverages your context.
- **Signal:** Commission project hours ballooned while internal asset development stalled.
- **Action:** Deprecated "Commission" offers. Launched "Advisory" tier.

</div>
