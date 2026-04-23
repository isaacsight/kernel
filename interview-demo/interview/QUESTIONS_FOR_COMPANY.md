# Questions for Them — The Reverse Interview

The reverse interview is where the signal goes both ways. Questions
that:
1. Show you've thought about their product and domain.
2. Help you decide if this job is right.
3. Reveal what *working there* is actually like.

Come with a lot more than you'll use. Pick based on the room.

---

## Universal (ask any tech interviewer)

### On the team

1. "Who would I be working with day-to-day? What's the team shape?"
2. "What does a typical week look like for someone in this role —
   how much is coding, design, review, planning?"
3. "What's the code review culture like? How do you handle disagreement
   on approach?"
4. "How do decisions get made — top-down, consensus, RFC, something
   else?"
5. "How does the team stay on top of a shipping cadence — any
   ceremonies, or is it async?"
6. "What's the on-call rotation like? How do you learn from incidents?"
7. "What would make someone successful in this role in the first 90
   days? First year?"

### On the work

8. "What's the most interesting problem the team is working on right
   now? The most boring one that nobody wants to own?"
9. "What's a decision the team reversed in the last year? What
   happened?"
10. "Where does the team feel stretched thin? What would they hire
    for next if budget appeared?"
11. "How do new ideas become projects? Is there an RFC process,
    skunkworks culture, something else?"
12. "What's something about the codebase that surprised you when you
    joined?"

### On culture + growth

13. "How does feedback flow — both peer and upward? What's the last
    piece of feedback you gave your manager?"
14. "What's the remote/hybrid/in-office shape, and how does that
    actually play out for collaboration?"
15. "How does the company handle disagreement about strategy or
    priorities?"
16. "When someone leaves, what's the usual reason?"
17. "What do you love about working here? What would you change?"

---

## Specific to Suno (AI music)

### On the product

18. "How do you think about the boundary between generative model
    capability and product surface? Does the UX push the model, or
    does the model push the UX?"
19. "What's the ratio of engineering effort on the model pipeline vs.
    the product vs. the infra? Is that the right shape?"
20. "Streaming generation is a signature UX. Was that model-driven or
    product-driven? How did the team converge on it?"
21. "What's the hardest product decision in the last quarter?"
22. "How do you think about content moderation without breaking
    creative freedom?"

### On the technical depth

23. "At what point in the stack do you stop treating audio as a
    black box and start treating it as structured data — tokens,
    segments, embeddings?"
24. "Streaming token generation: how do you handle the backpressure
    between the model and the decode pipeline? Is it adaptive?"
25. "What's your approach to model versioning? Does a `.setlist` file
    carry the model version or just the output?"
26. "Where are you in the BYO-codec story — EnCodec, DAC, something
    custom? Does that choice show up in the product surface?"
27. "How do you measure generation quality at scale — is it
    human-rated, proxy-metric-driven, both?"
28. "What's the failure mode that keeps you up at night — model
    degradation, infra, abuse, something else?"

### On the research side

29. "How much research happens in this org? How is it connected to
    the product?"
30. "Are there frontiers you're watching that you haven't committed
    to yet — spatial audio, instrument controls, MIDI output, real-
    time performance?"
31. "How do you think about the long-form music problem — extending
    beyond a model's natural context?"
32. "What's a paper from the last 12 months that changed how the
    team thinks?"

### On the commercial shape

33. "How do you think about the creator relationship — are users
    authors, collaborators, subjects?"
34. "What does pricing look like at the capacity tier — is the
    bottleneck model cost, or infrastructure?"
35. "How do you handle the copyright question in a way that scales
    beyond a country-by-country response?"

---

## Specific to Procreate (illustration)

### On engineering craft

36. "Procreate's reputation is for engineering depth — custom engine,
    TBDR-aware rendering, painstaking input latency tuning. How does
    that culture get passed to new engineers? Is there a
    'Procreate way' of doing things?"
37. "The engine's gone through big evolutions — Silica M, Valkyrie.
    What drove those — new hardware, new features, technical debt,
    something else?"
38. "How does the team think about latency budgets — is there a
    published contract, or is it tribal knowledge?"
39. "What's the split between engineers who specialize (graphics,
    input, file format) and engineers who span? How do you think
    about the T-shape vs. specialist split?"

### On product + design

40. "Procreate feels invisible when you're using it — the tool
    disappears. How does the team decide what UI to add vs. what to
    hide in a gesture or shortcut?"
41. "The brush engine is open-ended — users can author custom
    brushes. How do you decide what to expose as a parameter and
    what to keep internal?"
42. "What's the decision process for adding a feature vs. deepening
    an existing one?"

### On platform

43. "iPad-only is a bold positioning. How has that shaped the
    engineering ceiling — both the ceiling and the floor?"
44. "How do you feel about visionOS, or the next generation of
    creative devices? Is Procreate Dreams the template for
    platform expansion, or an exception?"
45. "Apple's APIs sometimes shift under your feet (LOM, PencilKit
    changes). How do you manage the upgrade treadmill while
    protecting the user?"
46. "Web — specifically WebGPU, WebAssembly, Pointer Events with
    pressure — is getting close to native for 2D tooling. Do you
    see that as a threat, an opportunity, or neither?"

### On the company

47. "Savage Interactive is bootstrapped, remote from the main tech
    centers, and has resisted typical 'growth at all costs' tech
    norms. How does that affect engineering priorities vs. a
    VC-funded peer?"
48. "What does career growth look like inside a deliberately-sized
    company?"
49. "How does the team make space for deep work vs. the cadence of
    a shipped product with millions of users?"

---

## Questions that reveal the answer by who asks them

Sometimes the question is the answer. These are high-yield:

50. "What's the last time you pushed back on a product or design
    decision — and what happened?"
51. "Can you describe a PR you were proud of that got rejected or
    heavily reshaped in review?"
52. "If I took this job and on day 180 I was miserable, what would
    be the most likely reason?"
53. "When was the last time the team was wrong about something
    important, and how did you find out?"

---

## If it's going well, ask these

54. "I've mentioned [specific technical opinion] — what's the
    steel-man argument against that?"
55. "What would a brilliant hire do in this role that a merely good
    one wouldn't?"
56. "What's a question I haven't asked that I should have?"

---

## Closing (near the end of the slot)

- "Is there anything about my background or this conversation that
  left you uncertain — something I can address before we wrap?"
- "What's the next step, and when should I expect to hear?"
- "Is there anyone else I should talk to who'd give me a different
  perspective on the team?"

These three are high-signal. They demonstrate directness, they pre-
empt concerns, and they project confidence.

---

## Prioritization

Don't ask all of these. Pick 3-5 real ones. Save 2 for the end.

**Priority 1 — always ask at least one**:
- One from "On the team" (8, 7)
- One from "On the work" (8, 9, 10)
- The closing round (bullet above)

**Priority 2 — ask if time**:
- Product-specific (Suno or Procreate depending)
- Culture (13, 15)

**Priority 3 — hold in reserve**:
- Technical depth (24-28, 37-39) — only if the conversation has
  already gone technical
- High-yield reveals (50-53) — use on a senior interviewer, not a
  recruiter

---

## Reading the room

- **Recruiter**: stick to team, culture, process. Don't go deep
  technical.
- **Hiring manager**: product, team, growth, decisions.
- **Peer engineer**: technical depth, real-world gotchas, what
  breaks.
- **Senior / principal**: vision, tradeoffs, reversed decisions,
  frontiers.
- **CTO / Founder**: strategy, where they're betting, the thing
  they think about in the shower.

Match the question to the person. Same question, wrong person, lands
flat.

---

## If they ask "do you have any questions?" and you're blank

Have this ready verbatim:

> "A few. First — what's the most exciting problem the team's
> working on that I haven't asked about yet? Second — if I took this
> job, what would make me successful in the first 90 days? And
> third — what's something about how the team works that surprises
> new hires?"

Three questions, all open-ended, all high-yield. Buys you 8 minutes
of their talk time while you catch your breath.
