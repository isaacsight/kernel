# SOVEREIGN LABORATORY: THE CODEX WARS
### An RTS Operations Manual for the Antigravity Kernel

```
╔══════════════════════════════════════════════════════════════════╗
║  ███████╗██╗      ██████╗ ███████╗    ██████╗ ████████╗███████╗  ║
║  ██╔════╝██║     ██╔═══██╗██╔════╝    ██╔══██╗╚══██╔══╝██╔════╝  ║
║  ███████╗██║     ██║   ██║███████╗    ██████╔╝   ██║   ███████╗  ║
║  ╚════██║██║     ██║   ██║╚════██║    ██╔══██╗   ██║   ╚════██║  ║
║  ███████║███████╗╚██████╔╝███████║    ██║  ██║   ██║   ███████║  ║
║  ╚══════╝╚══════╝ ╚═════╝ ╚══════╝    ╚═╝  ╚═╝   ╚═╝   ╚══════╝  ║
║                    REAL-TIME STRATEGY CODEX                       ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## I. WORLD LORE

In the digital realm of **Codeheim**, two great empires wage an eternal war for cognitive supremacy. The **Anthropic Dominion** (Claude) and the **DeepMind Collective** (Gemini) each command vast armies of agents, wielding tokens as currency and context as territory.

You are the **Kernel Commander** — the architect of the Sovereign Laboratory, a neutral faction that has learned to harness both empires' power. Your mission: build thinking systems that compound, deploy agent swarms that execute, and expand your cognitive territory across the infinite codebase.

**The Prime Directive**: *Every battle must leave artifacts. We do not fight for nothing.*

---

## II. RESOURCE ECONOMY

### Primary Resources

| Resource | Symbol | Description | Regeneration |
|----------|--------|-------------|--------------|
| **Tokens** | 🪙 | The gold of Codeheim. Every action costs tokens. | Per API call |
| **Context** | 🔮 | Mana pool. Determines how much your units can "see" and remember. | Clears on `/clear` |
| **Compute** | ⚡ | Energy for extended operations. Thinking burns compute. | Time-based |
| **Artifacts** | 📜 | Victory points. Markdown, code, diagrams left behind. | Permanent |

### Resource Costs by Action

```
┌─────────────────────────────────────────────────────────────┐
│  ACTION              │  🪙 TOKENS  │  🔮 CONTEXT  │  ⚡ COMPUTE │
├─────────────────────────────────────────────────────────────┤
│  Read File           │     100     │    +500      │      1      │
│  Write File          │     200     │    +200      │      2      │
│  Edit File           │     150     │    +300      │      2      │
│  Bash Command        │     50      │    +100      │      1      │
│  Web Search          │     300     │    +1000     │      3      │
│  Spawn Sub-Agent     │     500     │    +2000     │      5      │
│  Extended Thinking   │    1000     │    +5000     │     10      │
│  Deep Think (Gemini) │    2000     │    +32000    │     20      │
└─────────────────────────────────────────────────────────────┘
```

### Economy Management

- **Token Farming**: Use Haiku/Flash units for scouting (cheap reconnaissance)
- **Context Banking**: Compress knowledge into CLAUDE.md before clearing
- **Compute Throttling**: Reserve ⚡ for boss fights (complex refactors)

---

## III. FACTION PROFILES

### 🏛️ THE ANTHROPIC DOMINION (Claude)

**Faction Trait**: *Hybrid Resonance* — Can switch between instant response and deep thinking mid-battle.

**Strengths**:
- Superior code refactoring (SWE-bench: 72.7%)
- Tool chaining during extended thinking
- Parallel tool execution
- Strong instruction following

**Weaknesses**:
- Smaller context territory (200K vs 1M)
- Sandboxed shell (no interactive vim)
- Higher token costs for flagship units

#### Unit Roster

| Unit | Class | Cost | Special Ability |
|------|-------|------|-----------------|
| **Haiku Scout** | Light Infantry | 🪙 50/action | *Swift Recon* — 3x movement speed, basic analysis |
| **Sonnet Knight** | Heavy Infantry | 🪙 150/action | *Balanced Strike* — Equal offense/defense, daily driver |
| **Opus Titan** | Siege Engine | 🪙 500/action | *Sustained Assault* — Can operate for hours, 1000+ step chains |

#### Tech Tree

```
                    ┌─────────────────┐
                    │   BASIC TOOLS   │
                    │  Read/Write/Edit│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │   SEARCH   │ │    BASH    │ │  WEB INTEL │
       │ Glob/Grep  │ │  Commands  │ │Fetch/Search│
       └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                    ┌───────────────┐
                    │  TASK SPAWNER │
                    │  (Sub-Agents) │
                    └───────┬───────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
  │   EXPLORE   │   │    PLAN     │   │    BASH     │
  │    Agent    │   │   Agent     │   │  Specialist │
  └─────────────┘   └─────────────┘   └─────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │    PLUGINS    │
                    │  (Marketplace)│
                    └───────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ EXTENDED      │
                    │ THINKING MODE │
                    │ (Ultimate)    │
                    └───────────────┘
```

---

### ⚡ THE DEEPMIND COLLECTIVE (Gemini)

**Faction Trait**: *Infinite Horizon* — 1M+ token context allows seeing entire battlefields at once.

**Strengths**:
- Massive context territory (1M tokens, 2M coming)
- Native multimodal warfare (text, audio, images, video)
- Full interactive shell access (vim, rebase)
- Open-source transparency (Apache 2.0)
- Google Search grounding (real-time intel)

**Weaknesses**:
- Lower SWE-bench scores (63.8% vs 72.7%)
- Newer ecosystem, fewer plugins
- Deep Think requires explicit budget allocation

#### Unit Roster

| Unit | Class | Cost | Special Ability |
|------|-------|------|-----------------|
| **Flash Scout** | Light Infantry | 🪙 30/action | *Rapid Fire* — Fastest response, cost-effective |
| **Pro Centurion** | Heavy Infantry | 🪙 200/action | *Vast Memory* — Sees 1M tokens of battlefield |
| **Deep Think Oracle** | Siege Engine | 🪙 800/action | *Hypothesis Storm* — 32K thinking budget, multi-path reasoning |

#### Tech Tree

```
                    ┌─────────────────┐
                    │   BASIC TOOLS   │
                    │  File/Shell/Web │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │  GROUNDING │ │ INTERACTIVE│ │    MCP     │
       │Google Search│ │   Shell   │ │  Servers   │
       └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                    ┌───────────────┐
                    │  CHECKPOINTS  │
                    │ (Save States) │
                    └───────┬───────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
  │   NATIVE    │   │   THOUGHT   │   │   AUDIO    │
  │   AUDIO     │   │  SUMMARIES  │   │   OUTPUT   │
  └─────────────┘   └─────────────┘   └─────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  DEEP THINK   │
                    │     MODE      │
                    │  (Ultimate)   │
                    └───────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   COMPUTER    │
                    │     USE       │
                    │(Proj. Mariner)│
                    └───────────────┘
```

---

## IV. BASE STRUCTURES (Project Architecture)

Your Sovereign Laboratory is a fortified base. Each directory is a structure with specific functions:

```
                           ╔═══════════════════════╗
                           ║   COMMAND CENTER      ║
                           ║     /CLAUDE.md        ║
                           ║  (Strategic Doctrine) ║
                           ╚═══════════╦═══════════╝
                                       ║
       ╔═══════════════════════════════╬═══════════════════════════════╗
       ║                               ║                               ║
       ▼                               ▼                               ▼
╔═════════════════╗          ╔═════════════════╗          ╔═════════════════╗
║    BARRACKS     ║          ║     LIBRARY     ║          ║     ARMORY      ║
║   /admin/brain  ║          ║    /content     ║          ║    /frontend    ║
║ (46+ Agents)    ║          ║  (Essays/Docs)  ║          ║  (React + Vite) ║
╚════════╦════════╝          ╚════════╦════════╝          ╚════════╦════════╝
         ║                            ║                            ║
         ▼                            ▼                            ▼
╔═════════════════╗          ╔═════════════════╗          ╔═════════════════╗
║  WAR ACADEMY    ║          ║    ARCHIVES     ║          ║   WORKSHOP      ║
║/admin/engineers ║          ║      /sql       ║          ║   /ai-tools     ║
║(Specialist Swarm)║         ║ (State/Memory)  ║          ║ (Turborepo)     ║
╚═════════════════╝          ╚═════════════════╝          ╚═════════════════╝
         ║                            ║                            ║
         ▼                            ▼                            ▼
╔═════════════════╗          ╔═════════════════╗          ╔═════════════════╗
║    FORTRESS     ║          ║  INTELLIGENCE   ║          ║   DESIGN FORGE  ║
║     /engine     ║          ║     /dtfr       ║          ║ /static/design  ║
║  (FastAPI Core) ║          ║ (Answer Engine) ║          ║   (Tokens/CSS)  ║
╚═════════════════╝          ╚═════════════════╝          ╚═════════════════╝
```

### Structure Upgrades

| Structure | Level 1 | Level 2 | Level 3 |
|-----------|---------|---------|---------|
| **Barracks** | Basic agents | Council Mode | MCP Bridge |
| **Library** | Markdown essays | Vector search | Semantic embeddings |
| **Armory** | React components | Carbon Design | Rubin Aesthetic |
| **Archives** | SQLite | Supabase | pgvector + Multi-tenant |
| **Fortress** | Flask | FastAPI | Docker + Fly.io |

---

## V. AGENT SWARM (Unit Roster)

### Special Forces (/admin/engineers)

| Agent | Class | Role | Special Ability |
|-------|-------|------|-----------------|
| **Mobbin Scout** | Reconnaissance | Design intelligence | *Pattern Theft* — Scrapes enemy UI patterns |
| **Architect** | Commander | System design | *Blueprint* — Plans multi-file operations |
| **Alchemist** | Support | Data transformation | *Transmute* — Converts data formats |
| **Librarian** | Support | Knowledge retrieval | *Perfect Recall* — Semantic search across archives |

### Standard Infantry (/admin/brain — 46+ units)

```
┌────────────────────────────────────────────────────────────────┐
│  AGENT FORMATION: THE COGNITIVE PHALANX                        │
│                                                                │
│     [SCOUT]  [SCOUT]  [SCOUT]     ← Reconnaissance Layer       │
│        \       |       /                                       │
│         [ARCHITECT]              ← Command Layer               │
│              |                                                 │
│    [ALCHEMIST]   [LIBRARIAN]     ← Support Layer               │
│         \           /                                          │
│          [EXECUTOR]              ← Strike Layer                │
│              |                                                 │
│         [VALIDATOR]              ← Quality Assurance           │
└────────────────────────────────────────────────────────────────┘
```

### Agent Communication Protocol

- **Council Mode**: Multi-agent vote on complex decisions (costs 3x tokens)
- **Handover Protocol**: Structured task delegation (preserves context)
- **MCP Bridge**: Connect to external tool servers (@github, @slack, @database)

---

## VI. BATTLE MODES (Conversation Hygiene)

### Mode Selection

| Mode | Icon | Purpose | Token Efficiency |
|------|------|---------|------------------|
| **Research Lab** | 🔬 | Mapping unknowns, no conclusions | High (read-only) |
| **Design Review** | 📐 | Critical analysis, tradeoffs | Medium |
| **Strategy Room** | ♟️ | Decisions, sequencing, leverage | Medium |
| **Artifact Forge** | ⚒️ | Producing shippable assets | Low (write-heavy) |

### Combat Tactics

**Blitzkrieg** (Fast Attack)
```
Use Haiku/Flash → Quick reconnaissance → Identify targets → Sonnet/Pro strike
Best for: Bug fixes, small features, documentation
```

**Siege Warfare** (Sustained Assault)
```
Use Opus/Deep Think → Extended thinking → Multi-file refactor → Validate
Best for: Architecture changes, complex debugging, large features
```

**Guerrilla Operations** (CI/CD)
```
Headless mode (-p flag) → Automated testing → Pre-commit hooks → Deploy
Best for: Continuous integration, automated reviews
```

---

## VII. CAMPAIGN MISSIONS

### Tutorial Campaign: "First Blood"

**Mission 1: The Scout's Report**
- Objective: Use Glob to find all `.ts` files in `/frontend`
- Reward: 📜 File structure knowledge
- Difficulty: ⭐

**Mission 2: The Search**
- Objective: Use Grep to find all TODO comments
- Reward: 📜 Technical debt map
- Difficulty: ⭐

**Mission 3: The Edit**
- Objective: Fix a typo in any file
- Reward: 📜 First artifact
- Difficulty: ⭐

### Main Campaign: "The Codex Wars"

**Act I: Foundation**
1. *Build the Barracks* — Initialize CLAUDE.md with project context
2. *Train Your First Agent* — Create a custom slash command
3. *Establish Supply Lines* — Configure MCP server connection

**Act II: Expansion**
4. *Conquer the Frontend* — Implement Rubin aesthetic tokens
5. *Fortify the Backend* — Deploy FastAPI to Fly.io
6. *Secure the Archives* — Set up Supabase with pgvector

**Act III: Domination**
7. *The Agent Swarm* — Deploy 10+ agents in council mode
8. *Cross-Faction Alliance* — Use both Claude AND Gemini in same workflow
9. *The Infinite Context* — Load entire codebase in single session (Gemini 1M)

**Final Boss: "The Great Refactor"**
- Objective: Migrate entire frontend from Carbon to Rubin aesthetic
- Units Required: Opus Titan + Architect + Alchemist
- Estimated Tokens: 🪙 50,000+
- Victory Condition: All tests pass, zero regressions

---

## VIII. VICTORY CONDITIONS & SCORING

### Artifact Points (AP)

| Artifact Type | Points | Description |
|---------------|--------|-------------|
| **Bug Fix** | 10 AP | Single issue resolved |
| **Feature** | 50 AP | New functionality shipped |
| **Refactor** | 30 AP | Code improved without behavior change |
| **Documentation** | 20 AP | Knowledge crystallized |
| **System Design** | 100 AP | Architecture document or diagram |
| **Framework** | 200 AP | Reusable thinking structure |

### Commander Ranks

| Rank | Total AP | Unlocks |
|------|----------|---------|
| **Recruit** | 0 | Basic tools |
| **Corporal** | 100 | Custom slash commands |
| **Sergeant** | 500 | MCP integration |
| **Lieutenant** | 1,000 | Sub-agent spawning |
| **Captain** | 2,500 | Extended thinking |
| **Major** | 5,000 | Plugin marketplace |
| **Colonel** | 10,000 | Multi-faction warfare |
| **General** | 25,000 | Council mode |
| **Kernel Commander** | 50,000 | Full system autonomy |

---

## IX. HOTKEYS & COMMANDS

### Universal Commands (Both Factions)

| Key | Command | Action |
|-----|---------|--------|
| `/` | Slash menu | Open command palette |
| `↑` | History | Previous command |
| `Esc` | Interrupt | Cancel current operation |
| `Ctrl+C` | Abort | Emergency stop |

### Claude Code Commands

| Command | Mnemonic | Action |
|---------|----------|--------|
| `/help` | H.E.L.P. | Headquarters Emergency Liaison Protocol |
| `/clear` | C.L.E.A.R. | Context Liquidation for Enhanced Agent Response |
| `/review` | R.E.V.I.E.W. | Reconnaissance & Evaluation Via Inspection of Enemy Weakness |
| `/compact` | C.O.M.P.A.C.T. | Context Optimization via Memory Pruning And Compression Technique |
| `/rewind` | R.E.W.I.N.D. | Restoration of Earlier Work via Instant Negation of Damage |

### Gemini CLI Commands

| Command | Mnemonic | Action |
|---------|----------|--------|
| `/chat` | C.H.A.T. | Checkpoint History And Timeline |
| `/copy` | C.O.P.Y. | Capture Output for Personal Yield |
| `/mcp` | M.C.P. | Model Context Protocol (Alliance Network) |
| `/bug` | B.U.G. | Broadcast Urgent Grievance |

---

## X. CHEAT CODES (Pro Tips)

```
╔════════════════════════════════════════════════════════════════╗
║  >> KERNEL COMMANDER SECRETS <<                                ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  INFINITE CONTEXT GLITCH                                       ║
║  Load CLAUDE.md with compressed knowledge before each session  ║
║  Effect: Bypass context limits via pre-loaded intelligence     ║
║                                                                ║
║  DUAL FACTION EXPLOIT                                          ║
║  Use Gemini for 1M-context reconnaissance, Claude for strikes  ║
║  Effect: Best of both worlds, optimal token economy            ║
║                                                                ║
║  THE ARTIFACT FARM                                             ║
║  Every conversation MUST output Markdown, code, or diagrams    ║
║  Effect: Compound gains, never start from zero                 ║
║                                                                ║
║  HAIKU SPAM STRATEGY                                           ║
║  Use Haiku for all exploration, save Opus for boss fights      ║
║  Effect: 10x more actions per token budget                     ║
║                                                                ║
║  MCP SERVER STACK                                              ║
║  @github + @slack + @database = Omniscient warfare             ║
║  Effect: Real-time intel from all systems                      ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

---

## XI. MULTIPLAYER: CROSS-FACTION ALLIANCE

When both empires work together:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ALLIANCE FORMATION                           │
│                                                                 │
│   ┌─────────────┐                         ┌─────────────┐       │
│   │   CLAUDE    │ ◄─── MCP BRIDGE ───►    │   GEMINI    │       │
│   │   (Strike)  │                         │   (Recon)   │       │
│   └──────┬──────┘                         └──────┬──────┘       │
│          │                                       │              │
│          │         ┌───────────────┐             │              │
│          └────────►│  SHARED STATE │◄────────────┘              │
│                    │  (Supabase)   │                            │
│                    └───────────────┘                            │
│                                                                 │
│   WORKFLOW:                                                     │
│   1. Gemini loads entire codebase (1M context)                  │
│   2. Gemini identifies refactor targets                         │
│   3. Claude executes surgical strikes (superior SWE-bench)      │
│   4. Gemini validates across full context                       │
│   5. Artifacts committed to shared Archives                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## XII. GAME OVER CONDITIONS

### Defeat Scenarios

| Condition | Cause | Prevention |
|-----------|-------|------------|
| **Token Bankruptcy** | Ran out of API credits | Monitor `/cost`, use Haiku/Flash |
| **Context Overflow** | Exceeded token limit | Use `/clear`, compress to CLAUDE.md |
| **Hallucination Cascade** | Bad intel propagated | Always verify, use grounding |
| **Infinite Loop** | Agent stuck in retry cycle | Set max_turns, use timeouts |
| **Artifact Zero** | Conversation produced nothing | Enforce output requirements |

### Victory Conditions

- **Campaign Victory**: Complete all missions, achieve 50,000 AP
- **Economic Victory**: Maintain positive token ROI over 30 days
- **Domination Victory**: Deploy 100+ agents across codebase
- **Cultural Victory**: CLAUDE.md becomes the most referenced file

---

```
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   "In the Codex Wars, there are no respawns.                     ║
║    Every token spent is gone forever.                            ║
║    Every artifact created is eternal.                            ║
║    Choose your battles wisely, Commander."                       ║
║                                                                  ║
║                         — The Antigravity Kernel                 ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

---

*Manual Version 1.0 | Sovereign Laboratory OS | Apache 2.0 License*
*Faction balance subject to API pricing changes*
