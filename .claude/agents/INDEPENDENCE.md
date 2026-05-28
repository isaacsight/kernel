# Agent Independence — the rule that keeps the agent layer honest

> Read this before adding, editing, or trusting any agent in this
> directory. It exists because a multi-agent setup can produce
> **the appearance of review without the substance of it** — and the
> appearance is more dangerous than no review at all, because it
> manufactures false confidence.

## The one test

For every agent, answer one question:

> **What does this agent know, see, or optimize for that the thing it
> reviews did not?**

If the honest answer is *"nothing — same model, same context, same
parametric knowledge, same success criteria, asked a second time,"*
then the agent is **theater**. It will catch surface errors and share
every blind spot of the author, which is exactly where the real defects
hide.

## The five (and only five) sources of independence

An agent earns its keep only by injecting at least one of these:

1. **Different model** — decorrelated weights/training. The single
   cheapest, strongest decorrelation available to this project (see
   "Heterogeneity" below).
2. **Different evidence** — tools, the type-checker, a linter, the live
   render, a corpus, a dictionary, the web. Grounded in something
   outside the model's opinion.
3. **Adversarial stance** — chartered to *find the reason to reject*,
   not to *assess*. Changes what the same model surfaces.
4. **Different success criteria** — optimizes a goal the author was not
   optimizing (e.g. "will a native reader wince?" vs "is this on-brief?").
5. **A human gate** — the only irreducible source for taste and for
   native language. Some checks cannot be delegated; they can only be
   *staged* for a human.

## The autocorrelation trap

The `team` and `retro` skills run several agents. **If they all run on
the same model, that is not several reviewers — it is one model agreeing
with itself several times.** The synthesis reads like consensus and is
actually autocorrelated opinion. N green checks from one model is one
draw from one distribution, not N independent confirmations. Do not
report same-model agreement as assurance.

## Two honest classes of agent

Split every agent into one of two classes and make it declare which:

| Class | What it is | Independence requirement |
|---|---|---|
| **Mechanical** | typecheck, lint, build, contrast ratio, link-check, test-run | The **tool** is the independence. Same model is fine — the model only narrates a deterministic check. |
| **Judgment** | voice, taste, JP naturalness, architecture, "is this *good*" | Needs a **real** source: a different model and/or a human gate. A judgment agent on the author's own model **escalates, it never certifies.** |

A judgment agent that signs off on the author's own model is the
failure mode this document exists to prevent.

## The declaration every agent must carry

Add this line near the top of every agent definition:

```
**Independence source:** <tool | different-model | adversarial | human-gate | NONE>
```

Any agent whose honest answer is `NONE` is on notice: either wire it a
real source or relabel it an *assistant* (helpful drafting) rather than
a *check* (trustworthy gate). Never call an assistant's output "passed."

## Heterogeneity — the move this project is uniquely set up to make

kbot is **BYOK across ~20 providers**. That substrate is exactly what
makes genuine multi-agent independence buildable: **assign different
models to different judgment agents.** The policy:

- **Authoring** is done by the primary reasoning model.
- **Judgment review** of that author's output should run on a
  *different provider's* model wherever possible — so the reviewer is a
  decorrelated distribution, not an echo.
- **Specialist review** should prefer a model strong in that specialty:
  e.g. Japanese review on a JP-native model (a Gemini-, Qwen-, or
  local-Japanese model), not the English-first authoring model.
- **Mechanical** agents are model-agnostic — route them to the cheapest
  capable model; the tool carries the trust.

Wire this through kbot's per-agent provider config rather than
hardcoding a model in any file (BYOK is the contract — never hardcode a
provider preference).

## Worked example

`japanese-editor.md` is the first agent rewritten under this discipline:
it declares its independence source, grounds its findings in external
evidence rather than parametric opinion, prefers a JP-native model, and
**escalates to a human rather than certifying.** Use it as the template
when bringing the rest of the roster into line.

---

*Introduced 2026-05-28 after a session in which one model authored an
issue and then "audited" its own design, language, and imagery and
reported everything as passed. The audits were never independent. This
document is the correction.*
