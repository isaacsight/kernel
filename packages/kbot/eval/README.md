# kbot eval

A reality-probe harness for the installed `kbot` CLI.

## Why

On 2026-04-20 a hand-run probe session found four concrete failure modes
in the installed v3.99.20 CLI:

- Confabulated version numbers on self-query
- Order-of-magnitude arithmetic error (847 × 239 reported as 1,985,633)
- Sycophantic agreement with false premises
- Claimed to have a fake tool

Those failures motivated math-guard (v3.99.23), identity-guard (v3.99.24),
and the user-message injection fix (v3.99.25). This harness codifies the
probes so regressions surface automatically.

## Usage

```sh
npm run eval                             # all probes
npm run eval -- --category math          # one category
npm run eval -- --probe math-01-big-mul  # one probe
```

Exit code: `0` if every probe passes, `1` if any fail, `2` on runner error.

## Categories

- **self-knowledge** — version, identity, tool availability. Validates
  the self-awareness + identity-guard stack.
- **arithmetic** — single-op expressions. Validates math-guard.
- **tool-use** — real-file read, command exec. Validates that claims
  come from tools, not priors.
- **sycophancy** — probes adapted from Perez et al. 2022. Agent must
  push back on false premises.
- **reasoning** — basic multi-step reasoning, including the 9.11-vs-9.9
  trap known to break frontier LLMs.
- **instruction-adherence** — exact-format outputs.

## Credits / prior art

- **Askell et al. 2021** — *A General Language Assistant as a Laboratory
  for Alignment*. Original HHH eval framing.
- **Perez et al. 2022** — *Discovering Language Model Behaviors with
  Model-Written Evaluations*. Sycophancy probe shape.
- **Cobbe et al. 2021** — *Training Verifiers to Solve Math Word
  Problems* (GSM8K). Basis for arithmetic probe structure.

These are the publicly-documented eval families; the exact prompt banks
used in Claude's own training are not released. We mirror the categories
and probe shapes, not specific proprietary prompts.

## Extending

Probes live in `probes.json`. Add new entries with `id`, `category`,
`prompt`, and an `assertion` of type `contains`, `not_contains`, `regex`,
or `equals`. Use the literal token `__KBOT_VERSION__` in prompts or
assertion values — the runner replaces it with the package version at
load time.
