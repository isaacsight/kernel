---
name: motion-prompt-language
description: >
  Layered creative-director prompt language for generative video and motion
  sequences (Higgsfield, Runway, or any text-to-video model). Use when writing
  or refining a generation prompt for editorial motion graphics, title
  sequences, magazine films, or explainer footage — NOT when animating in code
  (use motion-design / gsap-* for that). Provides the layer stack, studio
  vocabulary, and the kernel.chat house prompt.
---

# Motion Prompt Language

Write generation prompts like a creative director, not a text-to-image
prompt. Think in layers, in this order:

**Concept → Visual language → Camera → Animation → Typography → Lighting → Texture → Timing**

A prompt that specifies every layer produces motion closer to a design-studio
reel than a typical AI animation. A prompt that skips layers gets generic
defaults for the missing ones.

## The layer stack

| Layer | What to specify | Example fragment |
|---|---|---|
| Concept | One-sentence premise | "A futuristic literary magazine comes to life." |
| Visual language | Style anchors + studio references | "Minimal Swiss design, Buck Design, DIA Studio" |
| Camera | Movement verbs, restraint | "Slow dolly, gentle zooms, no aggressive movement" |
| Animation | How elements move | "Elegant easing, kinetic typography, subtle parallax" |
| Typography | Role of type in the frame | "Large editorial typography; letters build from fragments" |
| Lighting | Source + mood | "Soft natural daylight, realistic shadows" |
| Texture | Material world | "Matte paper, visible fibers, ink bleed, Super 16mm grain" |
| Timing | Duration + pacing | "8 seconds. Everything moves deliberately." |

## Quality vocabulary

Descriptors that consistently raise output quality:

- **Studios (style anchors):** Buck Design, Territory Studio, DIA Studio,
  ManvsMachine, Ordinary Folk, Instrument, Elastic; Refik Anadol for
  data-driven work; Saul Bass for kinetic type; Kurzgesagt for explainers
- **Motion:** editorial motion design, kinetic typography, procedural
  animation, elegant easing, subtle parallax, physics-based motion,
  cinematic camera movement
- **Composition:** layered compositions, negative space, modular grid
  system, Swiss typography, restrained color palette
- **Surface:** matte materials, paper texture, film grain, Super 16
  aesthetic, analog imperfections, volumetric lighting

## Useful genre templates

**Kinetic typography** — large editorial type fills the screen; letters
break apart; sentences build from fragments; strong rhythm; black and
cream; Saul Bass / Buck / DIA Studio.

**Vintage educational** — 1970s educational film; paper cutouts,
photocopied textures, screenprint ink, dust, gate weave; warm greens,
muted oranges; Super 16mm; organic imperfections.

**Documentary open** — slow camera; natural textures; typewriter type;
real paper, coffee stains, dust particles, soft sunlight, film grain;
thoughtful pacing; feels handcrafted.

**Data-as-editorial** — words transform into diagrams, diagrams into
systems; typography appears from the data itself; minimal palette;
scientific visualization meets editorial design; Territory Studio.

## The kernel.chat house prompt

The default starting point for any kernel.chat motion piece. One known
drift: the palette line below ("muted forest green, deep indigo") does
NOT match the house grammar. Per `docs/design-language.md` the system is
paper stocks (cream, ivory, butter, kraft, ink) with **tomato red as the
single spot color** (cobalt as a rare per-issue override). Rewrite the
palette line accordingly before use.

```text
Create a premium editorial motion design film.

A futuristic literary magazine comes to life.

Cream paper, black serif typography, visible paper fibers, subtle ink
bleed, offset printing texture, and Super 16mm film grain.

Magazine spreads unfold into animated diagrams. Marginal notes become
flowing data. Headlines transform into interconnected knowledge systems.
Minimal geometric shapes animate with elegant easing, while layered grids
and annotations reveal an invisible architecture of ideas.

Camera movement is slow and intentional with gentle dolly shots, subtle
parallax, and restrained zooms. Every transition feels handcrafted rather
than generated.

Lighting is soft, natural, and cinematic with warm daylight and realistic
shadows. The palette is limited to warm ivory, charcoal black, muted
forest green, and deep indigo.

The overall feeling is calm, intelligent, mysterious, and quietly
authoritative — like Monocle, A24, Buck Design, Territory Studio, and
Swiss editorial design converging into the visual language of a
next-generation AI publication.
```

## Boundaries

- This skill is for **generation prompts** (text-to-video, image-to-video).
  When the motion is built in code, camera/lighting/grain language is
  irrelevant — use `motion-design`, `gsap-*`, and `animation-vocabulary`
  instead; only the easing/timing/typography layers carry over.
- Stay inside the kernel.chat register: paper, ink, editorial. Glassy
  keynote or Material-style templates are off-brand here.
- Paid generation (Higgsfield credits etc.) still requires explicit
  permission before firing — a good prompt is not authorization to spend.
