# Anticipated Questions (Beyond Stack)

Companion to [`STACK_QA.md`](./STACK_QA.md) (which covers stack
choices specifically). This one covers the broader interview
questions: product judgment, systems thinking, behavioral, and the
company-specific stuff.

45-second answers unless otherwise noted.

---

## Section A — Product judgment

### Q1. "Walk me through a product decision you disagreed with but went along with."

**A.** "At [role] we shipped a feature behind a marketing
launch that I thought needed another two weeks of polish — the
empty state was half-done, the mobile layout had known bugs. I
raised it, lost the call because the launch window mattered, and
owned the PR to ship what we had. Afterwards the two-week 'polish'
list became tickets, and they shipped across the next sprint. I
learned that the right move wasn't to re-argue the decision — it
was to make the follow-through cheap enough that the decision was
recoverable."

*Adapt the story to your real history.*

### Q2. "What's a product you admire and why?"

**A.** "Linear. Not for the features, for the *pacing*. Every
interaction is designed to be instant-feeling, which means the
entire architecture — local-first data, optimistic mutations,
command-palette-first UX — is subordinate to that felt experience.
The tradeoffs they made (CRDT complexity, a heavier initial bundle)
are *in service of* the product feel, not against it. That's the
bar I aim for."

### Q3. "When would you *not* build a feature users are asking for?"

**A.** "When it conflicts with the product thesis. A social feed in
Setlist would look like addressing user feedback, but it redefines
what the product is. I'd instead ask what the user is *really*
wanting — often it's 'I want my friend to hear this,' which a share
link solves without a feed. If after that reframing the request
still stands, it's a signal to revisit the thesis, not just add the
feature."

### Q4. "How do you prioritize a backlog?"

**A.** "Three dimensions per item: user pull — would this make
someone not cancel? Craft signal — does building it well demonstrate
capability? Scope confidence — are we sure about the shape? Multiply
them, normalize, take the top N. For tiebreakers, pick the one that
unblocks more future work. I'm skeptical of 'high-value quick wins'
as a category — usually the 'quick' estimate is wrong."

### Q5. "How do you handle a feature that's technically built but doesn't feel right?"

**A.** "Halt. Don't ship. 'Technically complete' means the code
compiles and tests pass, but if the feel is off, the users will
know within 15 seconds. I'd loop in the design engineer — often
it's motion, or microcopy, or a missing empty state. Sometimes it's
an architectural miss (wrong abstraction layer) that no amount of
polish fixes. Call that out honestly — a feature that ships and
immediately looks wrong damages the product more than a one-week
delay."

---

## Section B — Systems thinking

### Q6. "What's a system design you've seen that you think is elegant?"

**A.** "Postgres. The small number of primitives — rows, columns,
indexes, transactions, WAL — compose into the full relational,
durable, auditable system we expect. It's the opposite of the
microservices fallacy, where you proliferate small simple parts
until the *composition* becomes the complexity. Postgres keeps the
primitives few and the compositional power huge."

### Q7. "How do you think about eventual consistency?"

**A.** "Eventually consistent systems are right for things where
the 'eventually' doesn't matter to the user's mental model — mostly
reads. Writes where users expect their action to be visible *now*
need stronger guarantees. In Setlist, generation state is eventually
consistent across replicas, but the *user's own operations* are
strongly consistent (their write, their read). The question is:
'when the user refreshes, will they be confused?' If yes, that's
too weak."

### Q8. "What's a scalability bottleneck you've seen or anticipate?"

**A.** "For Setlist specifically, the first will be Suno API quota —
not our code. We'll hit vendor limits before our edge or DB. So
scalability isn't just 'handle more users,' it's 'handle more users
without triggering upstream limits' — which means queue + fair-share
+ transparent user-facing status. The second bottleneck will be
Postgres NOTIFY fanout at ~1000 concurrent listeners. Migration
path is Redis Streams behind the same interface."

### Q9. "How would you debug a slow API endpoint?"

**A.** "Start with the trace. If the trace doesn't exist, add OTel
first — don't debug without data. Look at the span tree: is time in
DB, in upstream, in serialization? For DB slowness: `EXPLAIN ANALYZE`
the query, check index usage, look at lock waits. For upstream: is
it consistent or bursty? Consistent = infra problem; bursty = our
client is fighting concurrency. For serialization: usually
response size bloat or JSON-encoding a large blob. 80% of slow
endpoints I've seen are one of these three."

### Q10. "How do you think about backward compatibility in a schema change?"

**A.** "Three-phase expand/contract. Phase 1: add the new column,
nullable or defaulted. Phase 2: backfill and deploy code that
reads/writes both old and new. Phase 3 (release later): drop the
old. Never collapse these. The temptation is to do it in one
migration for speed — that's where downtime and bugs live. A good
schema change is boring; a clever one is a rollback."

---

## Section C — Behavioral / collaboration

### Q11. "Tell me about a time you had a conflict with a coworker."

**A.** "[Real story, adapt.] The pattern I use: I assume I'm
missing context first, not that they're wrong. So I'll write up my
reasoning in shared doc — not as a case, but as 'here's how I'm
thinking about it, what am I missing?' — and invite them to do the
same. 9 times out of 10, the disagreement dissolves because we were
solving different problems or had different constraints in mind.
For the 1 time it doesn't: we escalate to a decider, accept the
decision, and move on. Holding a grudge is unprofessional even when
you're right."

### Q12. "How do you handle feedback on your work?"

**A.** "Ask for it early. The longer a piece of work exists before
review, the more invested I am in defending it. So I share draft
code, draft docs, draft designs at 30% done — 'what am I missing?'
— not at 100% — 'please approve.' On receiving feedback, I separate
'taste' from 'correctness.' Correctness feedback I act on
immediately. Taste feedback I weigh — whose taste, how confident
are they, does it serve the user. I don't argue taste; I either
absorb it or, if I disagree, I name the tradeoff and let the
decider call it."

### Q13. "Describe a project that failed."

**A.** "[Real story.] The thing I learned: scope creep kills
projects, but *unclear* scope kills them faster. A project with a
3-month timeline and a vague goal will miss the timeline; a project
with a 3-month timeline and a sharp goal will hit the timeline or
surface the need to re-scope within 3 weeks. Now I refuse to start
without a written scope that names what's *not* in v1. Even rough
is better than absent."

### Q14. "How do you mentor junior engineers?"

**A.** "Unblock, don't solve. When someone's stuck, I ask what they've
tried, what they think the problem is, and what they'd try next —
rather than jumping to the answer. If they're genuinely stuck, I
give them the smallest possible next step, not the whole solution.
Pairing for 30 minutes to get through a wall is high-value. Pairing
for 3 hours is a signal I've taken over the work. I read their code
reviews carefully — a thoughtful review with specific asks is
mentorship; a rubber-stamp is not."

### Q15. "How do you stay current with tech?"

**A.** "Two channels. First: I build things outside of work — small
weekend projects with unfamiliar tools. Nothing teaches you
Cloudflare Workers like deploying one; nothing teaches you the
limits of React RSC like hitting them. Second: I follow a
deliberately narrow set of sources — five or six high-signal
newsletters / engineers / blogs — and skim the rest. Depth over
breadth. Being current doesn't mean knowing every framework; it
means knowing the few trends that matter enough to shape your
next architectural decision."

---

## Section D — Company-specific probe questions

### If it's Suno

**"Why Suno?"**

**A.** "Because you're the company making the thing I'd want to
use when I hear a song in my head but can't play an instrument.
That's a specific emotional job — not 'AI music,' but 'unlock
the song that's stuck in me.' The engineering problems are
downstream of that emotional goal: streaming generation matters
because waiting 30 seconds kills the flow; regeneration matters
because iteration is how the song arrives; file format matters
because people should own what they make. I want to work on the
layer between the model and the user where an engineering
decision becomes a felt experience."

**"Where do you think Suno should go next?"**

**A.** "Two honest hunches — feel free to push back. First,
*legible tokens*. Users understand prompts intuitively; they don't
understand the generation as a thing that's *happening*. A view
that shows the generation thinking, even abstractly, would build
trust. Second, a portable file format. Suno today is a service; a
`.suno` file would turn the output into an artifact that survives
account deletion, model deprecation, and third-party tools. That's
a sticky moat as much as a user-trust move."

### If it's Procreate

**"Why Procreate?"**

**A.** "Because you're the company that proved an iPad can be a
professional creative tool, in an era when everyone else was
building cross-platform approximations. The engineering ethos —
deep Metal work, tile-based canvas, sub-frame input latency,
legible file format — is the kind of craft I want to work near.
You're also bootstrapped from Tasmania, which means the company's
success is the *engineering's* success, not an investor's
patience. That economic shape causes the engineering culture, and
the culture is what I want to be in."

**"Where do you think creative tools go in the next 5 years?"**

**A.** "Three directions. First, on-device ML reshapes brushes — a
brush that reads the canvas context and responds is a magnitude
shift; not replacing the artist, but amplifying. Second, the web
narrows the gap with native for 2D — WebGPU + Pointer Events with
pressure + wasm — which affects Procreate's competitive
environment more than its iPad product. Third, visionOS and
spatial creative tools are a frontier where nobody's a clear
leader yet; Procreate's engineering strengths translate directly.
Those are three hunches. The one I'd actually make a product bet
on — ML-assisted brushes — is the one that deepens the core craft
rather than chasing a new platform."

---

## Section E — The meta-questions

### Q16. "What questions do you have for us?"

See [`QUESTIONS_FOR_COMPANY.md`](./QUESTIONS_FOR_COMPANY.md). Have
3-5 ready.

### Q17. "Where do you see yourself in 5 years?"

**A.** "Honest answer: I don't know, which is a deliberate choice.
Five-year plans have a way of foreclosing on good opportunities
that don't fit the plan. What I do know: I want to be deeper in
the craft — 5 years of compound learning on systems that people
actually use. I want the scope of what I own to grow — more of the
stack, more of the decisions, more of the mentorship. And I want
to be at a place where the engineering quality is still
*aspirational*, not 'adequate' — where the bar moves up every year.
If [company] fits that, I'd love to be here."

### Q18. "What's your biggest weakness?"

**A.** "I'm bad at asking for help when I'm stuck. My instinct is
to figure it out, which is sometimes the right move and often a
time-waster. The correction I've learned: give yourself a fixed
budget — 45 minutes, 2 hours, half a day — and if you're not out
of the weeds at that point, ask. The budget makes it structural,
not emotional."

### Q19. "Why are you leaving [current role]?"

**A.** "Depending on context — I'd be honest. The real reasons
usually are: the product's trajectory diverged from mine; the
technical ceiling was lower than I expected; the scope I'm ready
for isn't available; or I want to work on a harder problem. I
don't bad-mouth the current company — they're paying me, and
there's real learning — but I'm honest that the fit isn't
growing."

### Q20. "Anything else you want to say before we wrap?"

**A.** "Two things. One: thanks for the time — this has been a
substantive conversation, which is signal in itself. Two: if my
candidacy doesn't move forward, I'd genuinely appreciate any
specific feedback — it's rare and valuable. And if it does move
forward, I'm ready to go deeper on any part of what I showed
you today."

---

## The discipline

Read this before every interview round. Don't memorize — know the
*shape* so you can improvise the words. An over-rehearsed answer
sounds worse than an honest, slightly unpolished one.

If a question doesn't appear here, the shape to follow:

1. Take a beat (2-3 seconds of silence is *fine*).
2. Name the question's real core (often it's asking about
   *judgment*, not the surface topic).
3. Share your position with a tradeoff.
4. If you have a story, use it — stories land deeper than
   abstractions.
5. Invite them to probe.

Bluffing beats honest-ignorance in zero interviews. Honest: "I
haven't done exactly that; here's the shape I'd approach it with"
is always a better answer.
