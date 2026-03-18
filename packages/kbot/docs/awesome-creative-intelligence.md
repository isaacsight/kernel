# Awesome Creative Intelligence

[![Awesome](https://awesome.re/badge.svg)](https://awesome.re)
[![License: CC0-1.0](https://img.shields.io/badge/License-CC0_1.0-lightgrey.svg)](https://creativecommons.org/publicdomain/zero/1.0/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/isaacsight/kernel/pulls)

> A curated list of tools, frameworks, and codebases for creative intelligence in code.

Creative intelligence sits at the intersection of computation, art, and artificial intelligence. This list catalogs the open-source projects, platforms, and research codebases that enable machines and humans to create together -- spanning visual art, music, writing, architecture, science, and beyond.

---

## Contents

- [Creative Coding Frameworks](#creative-coding-frameworks)
- [AI Image Generation](#ai-image-generation)
- [AI Video Generation](#ai-video-generation)
- [AI Music and Audio](#ai-music-and-audio)
- [Live Coding](#live-coding)
- [3D Generation](#3d-generation)
- [Evolutionary and Genetic Art](#evolutionary-and-genetic-art)
- [Procedural Generation](#procedural-generation)
- [Creative Writing AI](#creative-writing-ai)
- [Neural Style Transfer](#neural-style-transfer)
- [Creative Agent Systems](#creative-agent-systems)
- [Scientific Creative AI](#scientific-creative-ai)
- [Design and Architecture](#design-and-architecture)
- [Generative Art Platforms](#generative-art-platforms)
- [Curated Lists](#curated-lists)
- [Contributing](#contributing)

---

## Creative Coding Frameworks

*Libraries and environments for writing code that produces visual, sonic, or interactive art.*

- **[p5.js](https://github.com/processing/p5.js)** — A JavaScript library for creative coding, making coding accessible for artists, designers, educators, and beginners. The spiritual successor to Processing for the web. `JavaScript` `~22k stars`

- **[Processing](https://processing.org)** — The original creative coding environment that launched a movement. A flexible software sketchbook and language for learning how to code within the context of the visual arts. `Java`

- **[openFrameworks](https://openframeworks.cc)** — An open-source C++ toolkit designed for creative coding. Wraps together several commonly used libraries for graphics, audio, video, and interaction into a consistent, cross-platform interface. `C++` `~10k stars`

- **[TouchDesigner](https://derivative.ca)** — A node-based visual programming environment for real-time interactive multimedia content. Used extensively in live performances, installations, and projection mapping. `Visual/Python`

- **[Nannou](https://github.com/nannou-org/nannou)** — A creative coding framework for Rust, offering an expressive API for generative art, audio visualization, and interactive installations with the safety and performance of Rust. `Rust` `~4k stars`

- **[three.js](https://threejs.org)** — The dominant JavaScript 3D library. Powers countless creative web experiences, from data visualizations to immersive art pieces running in the browser with WebGL and WebGPU. `JavaScript` `~103k stars`

- **[canvas-sketch](https://github.com/mattdesl/canvas-sketch)** — A loose collection of tools, modules, and resources for creating generative art in JavaScript and the browser. Includes utilities for exporting high-resolution prints. `JavaScript` `~5k stars`

- **[Hydra](https://github.com/hydra-synth/hydra)** — A platform for live coding networked visuals inspired by analog video synthesizers. Runs in the browser with a minimal, composable syntax for real-time visual performance. `JavaScript` `~2k stars`

- **[Shadertoy](https://shadertoy.com)** — A community and platform for creating and sharing fragment shaders. Home to some of the most impressive real-time rendering experiments on the web. `GLSL`

- **[Context Free Art](https://contextfreeart.org)** — A program that generates images from written instructions called grammars. Context Free uses a variation of context-free grammars to produce stochastic, recursive visual art. `C++`

- **[ml5.js](https://ml5js.org)** — Friendly machine learning for the web, built on top of TensorFlow.js. Provides immediate access to pre-trained models for image classification, pose detection, sound recognition, and generative text within creative coding projects. `JavaScript` `~6k stars`

- **[Pts.js](https://ptsjs.org)** — A library for visualization and creative coding. Pts enables you to compose and express what you see in code, bridging the gap between algorithmic thinking and visual expression. `TypeScript`

## AI Image Generation

*Models and tools for generating, editing, and composing images with AI.*

- **[FLUX.1/FLUX.2](https://blackforestlabs.ai)** — State-of-the-art open-weight text-to-image models from Black Forest Labs (the team behind Stable Diffusion). FLUX.1 comes in schnell (fast), dev, and pro variants; FLUX.2 pushes fidelity and controllability further. `Python`

- **[Stable Diffusion XL](https://stability.ai)** — The influential open-weight image generation model from Stability AI. SDXL introduced a base + refiner architecture and 1024x1024 default resolution, becoming the foundation for an enormous ecosystem of fine-tunes and tools. `Python`

- **[ComfyUI](https://github.com/comfyanonymous/ComfyUI)** — The most powerful and modular node-based GUI and backend for diffusion models. Supports Stable Diffusion, FLUX, video models, and virtually any diffusion pipeline through a visual graph interface. `Python` `~60k stars`

- **[Fooocus](https://github.com/lllyasviel/Fooocus)** — An image generating software inspired by the simplicity of Midjourney. Rethinks Stable Diffusion and FLUX workflows by automating complex prompt engineering and pipeline tuning behind a minimal interface. `Python` `~42k stars`

- **[HuggingFace Diffusers](https://github.com/huggingface/diffusers)** — The go-to library for state-of-the-art pretrained diffusion models. Provides a unified API for image, audio, and 3D generation with schedulers, pipelines, and a massive model hub. `Python` `~26k stars`

- **[CLIP / OpenCLIP](https://github.com/mlfoundations/open_clip)** — Open-source implementation of OpenAI's Contrastive Language-Image Pre-training. The backbone of text-guided image generation, enabling models to understand the relationship between text descriptions and visual content. `Python`

- **[DALL-E 2 PyTorch](https://github.com/lucidrains/DALL-E2-pytorch)** — An independent PyTorch implementation of DALL-E 2 (unCLIP), OpenAI's text-to-image system using CLIP latents, a prior network, and a diffusion decoder. A key reference implementation for the research community. `Python` `~11k stars`

## AI Video Generation

*Models and pipelines for generating video from text, images, or other video.*

- **[Open-Sora](https://github.com/hpcaitech/Open-Sora)** — An open-source initiative to efficiently reproduce OpenAI's Sora video generation model. Implements a diffusion transformer architecture for high-quality text-to-video and image-to-video generation. `Python` `~23k stars`

- **[CogVideoX](https://github.com/THUDM/CogVideo)** — A large-scale text-to-video generation model from Tsinghua University's Knowledge Engineering Group. Leverages a 3D variational autoencoder and expert transformer blocks for coherent, temporally consistent video. `Python` `~10k stars`

- **[HunyuanVideo](https://github.com/Tencent/HunyuanVideo)** — Tencent's 13-billion-parameter open video generation model. One of the largest open-source video generation models, capable of producing high-resolution, temporally coherent video from text descriptions. `Python` `13B params`

- **[Wan 2.1/2.2](https://github.com/Wan-Video/Wan2.1)** — Alibaba's suite of open video generation models supporting text-to-video, image-to-video, and video editing. Wan 2.2 adds improved motion quality and longer generation capabilities. `Python`

- **[Mochi 1](https://github.com/genmoai/mochi)** — A high-quality open-source video generation model from Genmo. Focuses on motion quality and temporal coherence, producing smooth, natural-looking video from text prompts. `Python`

- **[AnimateDiff](https://github.com/guoyww/AnimateDiff)** — A practical framework for animating personalized text-to-image diffusion models without requiring model-specific tuning. Inserts a motion module into frozen text-to-image models to produce animated outputs. `Python`

## AI Music and Audio

*Models and tools for generating music, speech, sound effects, and audio with AI.*

- **[Bark](https://github.com/suno-ai/bark)** — A transformer-based text-to-audio model from Suno that can generate realistic multilingual speech, music, sound effects, and nonverbal cues like laughter and sighing from text prompts. `Python` `~39k stars`

- **[AudioCraft / MusicGen](https://github.com/facebookresearch/audiocraft)** — Meta's library for audio generation research, containing MusicGen (text/melody-to-music), AudioGen (text-to-sound), and EnCodec (neural audio codec). A unified codebase for state-of-the-art audio AI. `Python` `~21k stars`

- **[Magenta](https://github.com/magenta/magenta)** — Google's research project exploring the role of machine learning in creative processes. Includes models for melody generation, music transcription, artistic image stylization, and more. `Python/JavaScript` `~19k stars`

- **[Jukebox](https://github.com/openai/jukebox)** — OpenAI's generative model for music, producing raw audio in a variety of genres and artist styles. Generates minute-plus samples with singing, using a multi-scale VQ-VAE approach. `Python` `~8k stars`

- **[YuE](https://github.com/multimodal-art-projection/YuE)** — A music generation model capable of producing full songs with vocals, lyrics, and instrumental accompaniment. Pushes toward end-to-end song creation from text descriptions. `Python`

- **[ACE-Step](https://github.com/ace-step/ACE-Step)** — A step-distilled music generation model enabling fast, high-quality music creation. Reduces inference time dramatically while maintaining the quality of full diffusion sampling. `Python`

- **[DiffRhythm](https://github.com/ASLP-lab/DiffRhythm)** — A diffusion-based model for generating rhythmic music. Focuses on producing music with strong rhythmic structure and temporal coherence using diffusion processes. `Python`

- **[Riffusion](https://github.com/riffusion/riffusion)** — A creative approach to music generation that produces music by generating spectrogram images with Stable Diffusion and converting them back to audio. An elegant demonstration of cross-modal generation. `Python`

## Live Coding

*Environments for writing code that generates music or visuals in real time, often in performance settings.*

- **[Sonic Pi](https://github.com/sonic-pi-net/sonic-pi)** — A code-based music creation and performance tool. Designed for education and live performance, it turns coding into a musical instrument with an emphasis on accessibility and expressiveness. `Ruby/C++` `~11k stars`

- **[SuperCollider](https://github.com/supercollider/supercollider)** — A platform for audio synthesis and algorithmic composition, used by musicians, artists, and researchers. Provides a powerful interpreted language (sclang) and real-time audio server (scsynth). `C++` `~5k stars`

- **[TidalCycles](https://github.com/tidalcycles/Tidal)** — A language for live coding musical patterns. Tidal uses a Haskell-based pattern language to describe flexible, polyphonic, polyrhythmic sequences that can be transformed in real time. `Haskell` `~2k stars`

- **[Strudel](https://github.com/tidalcycles/strudel)** — A JavaScript port and reimagining of TidalCycles that runs entirely in the browser. Makes algorithmic music accessible without any installation, with a live coding editor and instant audio feedback. `JavaScript` `~2k stars`

## 3D Generation

*Models and tools for generating 3D objects, scenes, and representations from text or images.*

- **[3D Gaussian Splatting](https://github.com/graphdeco-inria/gaussian-splatting)** — The original implementation of 3D Gaussian Splatting for real-time radiance field rendering. Represents scenes as collections of 3D Gaussians for fast, high-quality novel view synthesis. `Python/CUDA` `~15k stars`

- **[Shap-E](https://github.com/openai/shap-e)** — OpenAI's model for generating 3D objects conditioned on text or images. Produces implicit 3D representations that can be rendered as both textured meshes and neural radiance fields. `Python` `~11k stars`

- **[Nerfstudio](https://github.com/nerfstudio-project/nerfstudio)** — A modular framework for neural radiance field development. Provides a unified pipeline for training, visualizing, and exporting NeRFs with a plug-and-play architecture for different NeRF methods. `Python` `~10k stars`

- **[Point-E](https://github.com/openai/point-e)** — OpenAI's system for generating 3D point clouds from text prompts. Uses a text-to-image diffusion model followed by an image-to-3D model, trading some quality for dramatically faster generation speed. `Python` `~6k stars`

## Evolutionary and Genetic Art

*Algorithms that evolve visual art, designs, and solutions using principles from biological evolution.*

- **[DEAP](https://github.com/DEAP/deap)** — Distributed Evolutionary Algorithms in Python. A comprehensive evolutionary computation framework supporting genetic algorithms, genetic programming, evolution strategies, and multi-objective optimization. `Python` `~5.7k stars`

- **[neat-python](https://github.com/CodeReclworte/neat-python)** — A Python implementation of the NEAT (NeuroEvolution of Augmenting Topologies) algorithm. Evolves neural network topology and weights simultaneously, used in creative applications from game AI to generative art. `Python` `~1.5k stars`

- **[EvoJAX](https://github.com/google/evojax)** — A hardware-accelerated neuroevolution toolkit from Google built on JAX. Enables massively parallel evolutionary strategies on GPUs/TPUs for evolving neural network controllers, policies, and creative agents. `Python` `~800 stars`

- **[pyribs](https://github.com/icaros-usc/pyribs)** — A bare-bones Python library for quality-diversity optimization. Implements MAP-Elites and related algorithms that produce diverse, high-performing solutions -- ideal for generating varied creative outputs. `Python` `~400 stars`

- **[QDax](https://github.com/adaptive-intelligent-robotics/QDax)** — A JAX-based library for quality-diversity algorithms and neuroevolution. Provides hardware-accelerated implementations of MAP-Elites variants for exploring diverse solution spaces at scale. `Python`

- **[GeneticPainter](https://github.com/anopara/genetic-drawing)** — An evolutionary algorithm that approximates images using primitives like polygons, circles, and brush strokes. Evolves populations of candidate paintings through selection and mutation toward a target image. `Python`

- **[CGP-Evolutionary-Art](https://github.com/DragonSenses/CGP-Evolutionary-Art)** — Cartesian Genetic Programming applied to evolutionary art. Evolves mathematical expressions that map pixel coordinates to colors, producing abstract and organic visual patterns. `Python`

## Procedural Generation

*Algorithms and systems for creating content through rules, constraints, and stochastic processes.*

- **[WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse)** — A constraint-solving algorithm inspired by quantum mechanics that generates tile maps and textures from small example images. Produces locally similar but globally novel outputs through iterative constraint propagation. `C#` `~23k stars`

- **[Material Maker](https://github.com/RodZill4/material-maker)** — A procedural materials authoring tool built with Godot. Provides a node-based interface for creating PBR materials, textures, and patterns using mathematical functions and noise generators. `GDScript`

- **[OpenAI Procgen](https://github.com/openai/procgen)** — A suite of 16 procedurally generated game environments designed for reinforcement learning research. Each environment produces an infinite variety of levels, testing generalization in visually rich settings. `C++/Python`

## Creative Writing AI

*Tools for collaborative fiction, interactive narratives, and AI-assisted creative writing.*

- **[KoboldAI](https://github.com/KoboldAI/KoboldAI-Client)** — A browser-based front-end for AI-assisted writing with local and remote language models. Supports story mode, adventure mode, and chat mode with extensive model support and memory management. `Python`

- **[SillyTavern](https://github.com/SillyTavern/SillyTavern)** — A user interface for interacting with language models for creative writing and roleplay. Provides character management, world-building tools, and extensive customization for narrative AI experiences. `JavaScript`

- **[StoryCraftr](https://github.com/storycraftr/storycraftr)** — An AI-powered toolkit for writing books, screenplays, and long-form narratives. Provides structure-aware generation that respects plot arcs, character consistency, and narrative conventions. `Python`

## Neural Style Transfer

*Techniques for transferring artistic styles between images and generating art through neural network optimization.*

- **[DeepDream](https://github.com/google/deepdream)** — Google's original neural network visualization technique that became an art movement. Amplifies patterns detected by a neural network through gradient ascent, producing psychedelic, fractal-like imagery. `Python` `~13k stars`

- **[VQGAN+CLIP](https://github.com/nerdyrodent/VQGAN-CLIP)** — The combination that launched the text-to-image art revolution before diffusion models. Optimizes a VQGAN image generator using CLIP's text-image understanding, producing surreal, dreamlike art from text prompts. `Python`

- **[CAN / AICAN](https://github.com/mlberkeley/Creative-Adversarial-Networks)** — Creative Adversarial Networks that generate art by maximizing deviation from established styles while remaining within the distribution of art. Trained to produce novel aesthetics rather than imitate existing ones. `Python`

## Creative Agent Systems

*Autonomous and semi-autonomous AI systems that can plan, execute, and iterate on creative tasks.*

- **[AutoGPT](https://github.com/Significant-Gravitas/AutoGPT)** — A pioneering autonomous AI agent that chains LLM calls with tool use to accomplish complex tasks. Demonstrated the potential of self-directed AI systems for creative and technical workflows. `Python` `~173k stars`

- **[LangChain](https://github.com/langchain-ai/langchain)** — A framework for developing applications powered by language models. Provides composable chains, agents, memory, and tool integrations that enable complex creative AI workflows and multi-step reasoning. `Python` `~100k stars`

- **[CrewAI](https://github.com/crewAIInc/crewAI)** — A framework for orchestrating role-playing, autonomous AI agents. Agents collaborate with defined roles, goals, and backstories to tackle complex creative and analytical tasks as a team. `Python` `~26k stars`

- **[AIDM](https://github.com/JoshBone/AIDM)** — AI Dungeon Master, a system for running tabletop roleplaying games with AI-driven narrative generation. Manages world state, NPC behavior, and narrative coherence for interactive storytelling. `Python`

- **[GameMasterAI](https://github.com/rogerchang1108/GameMasterAI)** — An AI-powered game master that generates dynamic narratives, encounters, and world events for tabletop and digital RPGs using language model reasoning. `Python`

- **[kbot](https://kernel.chat)** — An open-source terminal AI agent with 37 specialist agents including creative, writing, design, and analysis capabilities. Features autonomous planning, learning from interactions, and multi-provider AI support. `TypeScript` [GitHub](https://github.com/isaacsight/kernel)

## Scientific Creative AI

*AI systems that exhibit creative intelligence in scientific discovery, protein design, and mathematical reasoning.*

- **[AlphaFold](https://github.com/google-deepmind/alphafold)** — DeepMind's protein structure prediction system that solved a 50-year grand challenge in biology. Predicts 3D protein structures from amino acid sequences with atomic accuracy, enabling creative protein engineering. `Python` `~13k stars`

- **[AlphaEvolve](https://deepmind.google/discover/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/)** — DeepMind's Gemini-powered coding agent that designs novel algorithms through evolutionary search. Discovered new mathematical constructs and optimized real-world systems by creatively exploring solution spaces. `Python`

- **[AI Co-Scientist](https://research.google/blog/accelerating-scientific-breakthroughs-with-an-ai-co-scientist/)** — Google's multi-agent AI system designed to function as a virtual scientific collaborator. Generates novel hypotheses, designs experiments, and synthesizes research across disciplines through creative scientific reasoning. `Python`

## Design and Architecture

*Tools for computational design, parametric architecture, color theory, and AI-assisted design workflows.*

- **[Grasshopper 3D](https://www.grasshopper3d.com)** — A visual programming language and environment for computational design within Rhino 3D. The standard tool for parametric architecture, enabling designers to create complex forms through algorithmic rules. `C#`

- **[Figma Make](https://www.figma.com)** — Figma's AI-powered design generation feature that creates UI designs and components from natural language descriptions. Integrates AI directly into the professional design workflow. `Web`

- **[Colormind](http://colormind.io)** — A color scheme generator powered by deep learning. Trained on photographs, movies, and popular art, it generates aesthetically coherent color palettes that capture the mood and style of its training data. `Web`

- **[Khroma](https://www.khroma.co)** — An AI color tool that learns your color preferences and generates personalized palettes. Uses machine learning to understand individual aesthetic taste and suggest harmonious combinations. `Web`

## Generative Art Platforms

*Platforms and marketplaces for creating, collecting, and experiencing generative art.*

- **[fxhash](https://www.fxhash.xyz)** — An open platform for generative art on the Tezos blockchain. Artists deploy generative algorithms, and each mint produces a unique output from the code, embracing controlled randomness as artistic medium. `Web`

- **[Art Blocks](https://www.artblocks.io)** — A curated platform for on-chain generative art on Ethereum. Artists store their generative algorithms on the blockchain, where each token generates a unique artwork at the moment of minting. `Web`

- **[Artbreeder](https://www.artbreeder.com)** — A collaborative art tool that uses generative adversarial networks (GANs) to blend and evolve images. Users can combine multiple images, adjust attributes, and explore latent space to discover new visual forms. `Web`

## Curated Lists

*Meta-lists and collections that catalog creative intelligence resources.*

- **[awesome-creative-coding](https://github.com/terkelg/awesome-creative-coding)** — A comprehensive curated list of creative coding resources including books, courses, tools, frameworks, and communities. The definitive starting point for the creative coding ecosystem. `~13k stars`

- **[awesome-generative-ai](https://github.com/steven2358/awesome-generative-ai)** — A curated list of modern generative AI projects and services covering image, video, audio, text, and code generation. Maintained with regular updates as the field evolves. `~6k stars`

- **[the-gan-zoo](https://github.com/hindupuravinash/the-gan-zoo)** — A comprehensive catalog of every named GAN (Generative Adversarial Network) variant published in research. An essential taxonomy of the GAN family tree, from the original 2014 paper through hundreds of variants. `~15k stars`

---

## Contributing

Contributions are welcome. This list is maintained by the [kernel.chat group](https://kernel.chat) community.

To add a project:

1. Fork the repository
2. Add your entry to the appropriate category following the format: `**[Name](url)** -- Description. \`Language\` \`~Nk stars\``
3. Keep entries sorted by star count (descending) within each category
4. Submit a pull request

### Guidelines

- Projects should be actively maintained or historically significant
- Include open-source projects, notable closed-source tools, and research codebases
- Descriptions should be concise (1-2 sentences) and focus on what makes the project notable
- Star counts are approximate and should be updated periodically

---

## License

[![CC0](https://licensebuttons.net/p/zero/1.0/88x31.png)](https://creativecommons.org/publicdomain/zero/1.0/)

To the extent possible under law, the contributors have waived all copyright and related or neighboring rights to this work.
