---
title: The Way of Code
date: 2026-01-15
tags: design, philosophy, craft
summary: On treating software as craft — the design philosophy behind building systems that feel right.
---

Every project carries an implicit question: *does this feel right?*

Not "does it work" — that's table stakes. Not "is it fast" — that's engineering. The question is about something harder to measure: does interacting with this system feel like the experience it should be?

## Craft Over Product

The dominant frame for software is product. Ship features, measure engagement, optimize funnels. This frame produces useful software that nobody loves.

The alternative is craft. A craftsperson asks different questions: What does this material want to become? Where is the grain? What would make this *satisfying* to use?

When I build interfaces, I think about typography first. EB Garamond has a particular quality — it feels like reading a book, not a screen. Courier Prime for metadata and labels creates a quiet separation between content and chrome. These choices cascade through every component.

## The Rubin Palette

The color system started with a single constraint: warm ivory (#FAF9F6) as the canvas. Everything follows from that choice.

Dark charcoal (#1F1E1D) for text — not pure black, which is harsh against warm backgrounds. A medium ivory (#F0EEE6) for secondary surfaces. The accent (#8B7355) is warm brown, like aged leather or old wood. Nothing screams. Everything breathes.

These aren't arbitrary preferences. They're the result of asking: what color relationships create the feeling of *contemplative attention*?

## Whitespace as Architecture

The standard padding in this system is 100px on desktop. That's enormous by modern standards. Most applications use 16-24px and fill every pixel with content.

But whitespace isn't empty space — it's structural. It tells the eye where to rest. It creates rhythm between elements. It's the silence between notes that makes music possible.

When I reduced the padding to 32px in an early iteration, the interface felt anxious. Everything crowded forward, demanding attention. Restoring the generous spacing restored the feeling: *take your time. This will wait for you.*

## Building for Feeling

The animation system uses `cubic-bezier(0.16, 1, 0.3, 1)` — an ease-out curve that starts fast and decelerates gracefully. Elements don't snap into place; they arrive. The duration is 250ms for most transitions, long enough to perceive but not long enough to impede.

These details compound. Typography, color, spacing, motion — each one is a small decision. Together, they create a coherent feeling that users sense without analyzing.

This is the way of code: building systems where every technical decision serves an experiential intention. The code is the craft. The experience is the art.
