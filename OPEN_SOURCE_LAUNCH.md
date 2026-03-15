# Open Source Launch Plan

Comprehensive list of registries, directories, platforms, and communities to maximize K:BOT's visibility as an open-source academic and research tool.

---

## 1. Package Registries (Already Published)

- [x] **npm** — [@kernel.chat/kbot](https://www.npmjs.com/package/@kernel.chat/kbot)
- [x] **Docker Hub** — [isaacsight/kbot](https://hub.docker.com/r/isaacsight/kbot)
- [x] **GitHub** — [isaacsight/kernel](https://github.com/isaacsight/kernel)

## 2. AI & MCP Registries

- [ ] **MCP Registry (Official)** — [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/)
  - Submit kbot's MCP server to the official Model Context Protocol registry
  - Follows the MCP registry spec, community-owned
  - GitHub: [modelcontextprotocol/registry](https://github.com/modelcontextprotocol/registry)

- [ ] **MCP Reference Servers** — [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)
  - Request listing in the community servers section

- [ ] **Smithery.ai** — [smithery.ai](https://smithery.ai/)
  - MCP server marketplace and discovery platform

- [ ] **Glama.ai MCP Directory** — [glama.ai/mcp](https://glama.ai/mcp)
  - MCP server discovery directory

- [ ] **PulseMCP** — [pulsemcp.com](https://pulsemcp.com/)
  - MCP ecosystem directory and analytics

## 3. AI Agent Directories

- [ ] **Toolify.ai** — [toolify.ai](https://www.toolify.ai/)
  - AI tools directory, high traffic
  - Submit: toolify.ai/submit

- [ ] **Futurepedia** — [futurepedia.io](https://www.futurepedia.io/)
  - AI tool directory with 5000+ tools listed

- [ ] **There's An AI For That** — [theresanaiforthat.com](https://theresanaiforthat.com/)
  - Popular AI tool discovery platform

- [ ] **AI Tool Directory** — [aitoolsdirectory.com](https://aitoolsdirectory.com/)
  - Curated AI tool listings

- [ ] **SaaS Hub** — [saashub.com](https://www.saashub.com/)
  - Software alternatives directory

## 4. Awesome Lists (GitHub)

Submit K:BOT to these curated lists via PR:

- [ ] **[awesome-cli-coding-agents](https://github.com/bradAGI/awesome-cli-coding-agents)** — Terminal-native AI coding agents (perfect fit)
- [ ] **[awesome-ai-agents](https://github.com/e2b-dev/awesome-ai-agents)** — AI autonomous agents
- [ ] **[awesome-ai-agents (slavakurilyak)](https://github.com/slavakurilyak/awesome-ai-agents)** — 300+ agentic AI resources
- [ ] **[awesome-agents](https://github.com/kyrolabs/awesome-agents)** — AI Agents curated list
- [ ] **[awesome-ai-cli](https://github.com/MustCodeAl/awesome-ai-cli)** — AI-powered CLI tools
- [ ] **[awesome-llm-apps](https://github.com/Shubhamsaboo/awesome-llm-apps)** — LLM apps with RAG, agents, MCP
- [ ] **[awesome-cli-apps-in-a-csv](https://github.com/toolleeo/awesome-cli-apps-in-a-csv)** — Largest CLI app list
- [ ] **[awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)** — MCP server directory
- [ ] **[awesome-open-source](https://github.com/corneliusweiss/awesome-open-source)** — Open source projects
- [ ] **[awesome-research-software](https://github.com/thecodedog/awesome-research-software)** — Research software
- [ ] **[awesome-scientific-computing](https://github.com/nschloe/awesome-scientific-computing)** — Scientific computing tools

## 5. Academic & Research Software Registries

- [ ] **JOSS (Journal of Open Source Software)** — [joss.theoj.org](https://joss.theoj.org)
  - Peer-reviewed journal for research software
  - Requires: 6+ months public dev history, clear research application, JOSS paper
  - Submit via: [joss.readthedocs.io/en/latest/submitting.html](https://joss.readthedocs.io/en/latest/submitting.html)
  - Review criteria: [joss.readthedocs.io/en/latest/review_criteria.html](https://joss.readthedocs.io/en/latest/review_criteria.html)

- [ ] **Zenodo** — [zenodo.org](https://zenodo.org)
  - DOI minting for software releases
  - GitHub integration: enable repo at [zenodo.org/account/settings/github](https://zenodo.org/account/settings/github/)
  - `.zenodo.json` already in repo for metadata
  - Sandbox for testing: [sandbox.zenodo.org](https://sandbox.zenodo.org)

- [ ] **Software Heritage** — [softwareheritage.org](https://www.softwareheritage.org/)
  - Universal software archive (400M+ projects)
  - Auto-crawls GitHub, but can trigger with "Save Code Now"
  - Provides SWHID (ISO standard 18670) permanent identifiers
  - Archive URL: [archive.softwareheritage.org](https://archive.softwareheritage.org/)

- [ ] **Research Software Directory** — [research-software-directory.org](https://research-software-directory.org/)
  - Netherlands eScience Center's registry for research software

- [ ] **SciCodes Consortium** — [scicodes.net](https://scicodes.net/)
  - Consortium of scientific software registries

- [ ] **swMath** — [swmath.org](https://www.swmath.org/)
  - Mathematical software registry (for our math/scientific tools)

- [ ] **Astrophysics Source Code Library (ASCL)** — [ascl.net](https://ascl.net/)
  - If we add astronomy-specific tools

## 6. Metadata Standards (Implemented)

- [x] **CITATION.cff** — Standard for software citation
  - K:BOT can generate these for other projects via `kbot oss cite`

- [x] **CodeMeta (codemeta.json)** — [codemeta.github.io](https://codemeta.github.io/)
  - Machine-readable metadata for research software
  - `codemeta.json` already in repo root
  - Enables auto-ingestion by Zenodo, Software Heritage, InvenioRDM

- [x] **Zenodo metadata (.zenodo.json)** — Enriches DOI metadata
  - `.zenodo.json` already in repo root

- [ ] **.well-known/mcp.json** — MCP server discovery (2026 roadmap)
  - Planned for MCP spec evolution

## 7. Open Source Platforms & Communities

### Launch Announcements

- [ ] **Hacker News** — [news.ycombinator.com](https://news.ycombinator.com/) — "Show HN: K:BOT — Open-source terminal AI agent for researchers"
- [ ] **Reddit**
  - r/opensource
  - r/commandline
  - r/MachineLearning
  - r/LocalLLaMA
  - r/scientificcomputing
  - r/bioinformatics
  - r/Python (for research tool discovery)
  - r/datascience
- [ ] **Dev.to** — [dev.to](https://dev.to/) — Publish launch article
- [ ] **Hashnode** — [hashnode.dev](https://hashnode.dev/) — Cross-post article
- [ ] **Medium** — Cross-post to Towards Data Science, Better Programming

### Community Engagement

- [ ] **Research Software Engineering (RSE)** — [society-rse.org](https://society-rse.org/)
  - UK RSE, US-RSE, DE-RSE communities
  - Mailing lists and Slack channels

- [ ] **NumFOCUS** — [numfocus.org](https://numfocus.org/)
  - Umbrella org for open-source scientific computing (NumPy, Pandas, Jupyter)
  - Apply as affiliated project

- [ ] **Software Sustainability Institute (SSI)** — [software.ac.uk](https://www.software.ac.uk/)
  - UK-based institute for research software

- [ ] **FORCE11** — [force11.org](https://force11.org/)
  - Future of Research Communications and e-Scholarship
  - Created the Software Citation Principles

- [ ] **Open Source Initiative (OSI)** — [opensource.org](https://opensource.org/)
  - MIT license already OSI-approved

- [ ] **Linux Foundation** — [linuxfoundation.org](https://www.linuxfoundation.org/)
  - For long-term governance options

## 8. GitHub Optimization

### Topics (add to repo settings)

```
ai-agent terminal cli open-source academic research scientific-computing
arxiv citation reproducibility data-science machine-learning local-first
llm mcp multi-model code-assistant research-software bioinformatics
open-science developer-tools typescript ollama claude openai
computational-science
```

### Repository Settings

- [ ] Add social preview image (1280x640)
- [ ] Enable Discussions (for RFC process)
- [ ] Enable GitHub Sponsors (FUNDING.yml done)
- [ ] Set "About" description with keywords
- [ ] Pin key issues (good first issue, help wanted)
- [ ] Create release with changelog (triggers Zenodo DOI)

### Badges to Add to README

```markdown
[![npm](https://img.shields.io/npm/v/@kernel.chat/kbot)](https://www.npmjs.com/package/@kernel.chat/kbot)
[![npm downloads](https://img.shields.io/npm/dw/@kernel.chat/kbot)](https://www.npmjs.com/package/@kernel.chat/kbot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/isaacsight/kernel)](https://github.com/isaacsight/kernel)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.XXXXXXX.svg)](https://doi.org/10.5281/zenodo.XXXXXXX)
[![FAIR](https://img.shields.io/badge/FAIR-software-blue)](https://fair-software.eu/)
[![OpenSSF Best Practices](https://bestpractices.coreinfrastructure.org/projects/XXXX/badge)](https://bestpractices.coreinfrastructure.org/projects/XXXX)
[![MCP](https://img.shields.io/badge/MCP-server-purple)](https://registry.modelcontextprotocol.io/)
[![CodeMeta](https://img.shields.io/badge/CodeMeta-2.0-green)](https://codemeta.github.io/)
[![Docker](https://img.shields.io/badge/docker-kbot-blue)](https://hub.docker.com/r/isaacsight/kbot)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
```

## 9. FAIR Software Principles

The FAIR principles (Findable, Accessible, Interoperable, Reusable) for research software:

- [x] **Findable** — npm, Docker Hub, GitHub, codemeta.json, .zenodo.json
- [x] **Accessible** — MIT license, free tier, local-only mode
- [x] **Interoperable** — MCP server, HTTP API, 20 providers, plugin system
- [x] **Reusable** — MIT license, CITATION.cff, CONTRIBUTING.md, comprehensive docs

### FAIR Assessment Tools

- [ ] **fair-software.eu** — [fair-software.eu](https://fair-software.eu/)
  - 5-recommendation checklist for research software
  - Run the FAIR software badge assessment

- [ ] **OpenSSF Best Practices** — [bestpractices.coreinfrastructure.org](https://bestpractices.coreinfrastructure.org/)
  - Core Infrastructure Initiative badge (passing, silver, gold)
  - Demonstrates security and quality practices

- [ ] **howfairis** — [github.com/fair-software/howfairis](https://github.com/fair-software/howfairis)
  - Automated FAIR compliance checker for GitHub repos

## 10. Priority Execution Order

### Week 1 — Immediate (no approval needed)
1. Enable Zenodo-GitHub integration (get DOI on next release)
2. Archive on Software Heritage (Save Code Now)
3. Submit to awesome-cli-coding-agents, awesome-ai-agents
4. Add GitHub topics
5. Create social preview image
6. Enable GitHub Discussions

### Week 2 — Announcements
7. Hacker News "Show HN" post
8. Reddit posts (r/opensource, r/commandline, r/LocalLLaMA)
9. Dev.to launch article
10. Submit to MCP Registry

### Week 3 — Registries
11. Submit to Toolify.ai, Futurepedia, TAAFT
12. Submit to OpenSSF Best Practices
13. Submit to FAIR software assessment
14. Submit to Research Software Directory

### Month 2 — Academic
15. Prepare JOSS paper draft
16. Engage RSE community (US-RSE, UK RSE)
17. Submit to SciCodes consortium
18. Apply for NumFOCUS affiliated status

### Ongoing
19. Monitor and respond to awesome list PRs
20. Engage in MCP community
21. Submit to new registries as they emerge
22. Track citations and DOI usage
