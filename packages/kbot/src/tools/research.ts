// kbot Research & Academic Tools — Scientific code directories
// Bridges kbot to PyPI, CRAN, Cargo, arXiv, Semantic Scholar,
// Papers With Code, HuggingFace, DOI, and dataset registries.

import { registerTool } from './index.js'
import { execFile } from 'child_process'

function run(cmd: string, args: string[], timeout = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = execFile(cmd, args, { timeout, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout)
    })
  })
}

export function registerResearchTools(): void {
  // ── PyPI ──────────────────────────────────────────────────────────
  registerTool({
    name: 'pypi_search',
    description: 'Search PyPI for Python packages. Returns name, version, summary, and download stats.',
    parameters: {
      query: { type: 'string', description: 'Package name or search term', required: true },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query)
      const limit = Number(args.limit) || 10
      try {
        // Try exact match first
        const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(query)}/json`, {
          signal: AbortSignal.timeout(8000),
        })
        if (res.ok) {
          const data = await res.json() as any
          const info = data.info
          return [
            `# ${info.name} v${info.version}`,
            `**Summary**: ${info.summary}`,
            `**Author**: ${info.author || info.author_email || 'unknown'}`,
            `**License**: ${info.license || 'unspecified'}`,
            `**Home**: ${info.home_page || info.project_url || 'n/a'}`,
            `**Requires Python**: ${info.requires_python || 'any'}`,
            info.requires_dist ? `**Dependencies**: ${info.requires_dist.slice(0, 15).join(', ')}` : '',
          ].filter(Boolean).join('\n')
        }
        // Fallback: search via simple API
        const searchRes = await fetch(`https://pypi.org/simple/`, {
          signal: AbortSignal.timeout(8000),
        })
        return `No exact match for "${query}". Try: pip search or browse https://pypi.org/search/?q=${encodeURIComponent(query)}`
      } catch (err) {
        return `PyPI search error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  registerTool({
    name: 'pypi_info',
    description: 'Get detailed info about a specific PyPI package including dependencies, versions, and metadata.',
    parameters: {
      package_name: { type: 'string', description: 'Exact package name on PyPI', required: true },
    },
    tier: 'free',
    async execute(args) {
      const pkg = String(args.package_name)
      const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`, {
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return `Package "${pkg}" not found on PyPI.`
      const data = await res.json() as any
      const info = data.info
      const versions = Object.keys(data.releases).slice(-10)
      return [
        `# ${info.name} v${info.version}`,
        `**Summary**: ${info.summary}`,
        `**Description**: ${(info.description || '').slice(0, 500)}`,
        `**Author**: ${info.author || 'unknown'}`,
        `**License**: ${info.license || 'unspecified'}`,
        `**Python**: ${info.requires_python || 'any'}`,
        `**Homepage**: ${info.home_page || 'n/a'}`,
        `**Project URLs**: ${info.project_urls ? Object.entries(info.project_urls).map(([k, v]) => `${k}: ${v}`).join(', ') : 'n/a'}`,
        `**Recent versions**: ${versions.join(', ')}`,
        info.requires_dist ? `**Dependencies (${info.requires_dist.length})**: ${info.requires_dist.slice(0, 20).join(', ')}` : '',
        `**Classifiers**: ${(info.classifiers || []).slice(0, 10).join(', ')}`,
      ].filter(Boolean).join('\n')
    },
  })

  registerTool({
    name: 'pip_run',
    description: 'Run a Python script or one-liner. Creates a temporary venv if needed.',
    parameters: {
      code: { type: 'string', description: 'Python code to execute (inline or file path)', required: true },
      packages: { type: 'string', description: 'Comma-separated pip packages to install first' },
    },
    tier: 'free',
    timeout: 120_000,
    async execute(args) {
      const code = String(args.code)
      const packages = args.packages ? String(args.packages).split(',').map(p => p.trim()) : []
      try {
        if (packages.length > 0) {
          await run('python3', ['-m', 'pip', 'install', '--quiet', ...packages], 60_000)
        }
        // Determine if code is a file path or inline
        if (code.endsWith('.py')) {
          return await run('python3', [code], 60_000)
        }
        return await run('python3', ['-c', code], 60_000)
      } catch (err) {
        return `Python execution error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── Cargo (Rust) ──────────────────────────────────────────────────
  registerTool({
    name: 'cargo_search',
    description: 'Search crates.io for Rust packages.',
    parameters: {
      query: { type: 'string', description: 'Crate name or search term', required: true },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query)
      const limit = Number(args.limit) || 10
      try {
        const res = await fetch(`https://crates.io/api/v1/crates?q=${encodeURIComponent(query)}&per_page=${limit}`, {
          headers: { 'User-Agent': 'KBot/2.14 (https://kernel.chat)' },
          signal: AbortSignal.timeout(8000),
        })
        const data = await res.json() as any
        if (!data.crates?.length) return `No Rust crates found for "${query}".`
        return data.crates.map((c: any) =>
          `**${c.name}** v${c.max_version} — ${c.description || 'no description'}\n  Downloads: ${c.downloads?.toLocaleString()} | Docs: https://docs.rs/${c.name}`
        ).join('\n\n')
      } catch (err) {
        return `Cargo search error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── CRAN (R) ──────────────────────────────────────────────────────
  registerTool({
    name: 'cran_search',
    description: 'Search CRAN for R packages used in statistical computing and data science.',
    parameters: {
      query: { type: 'string', description: 'Package name or search term', required: true },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query)
      try {
        const res = await fetch(`https://crandb.r-pkg.org/${encodeURIComponent(query)}`, {
          signal: AbortSignal.timeout(8000),
        })
        if (res.ok) {
          const data = await res.json() as any
          return [
            `# ${data.Package} v${data.Version}`,
            `**Title**: ${data.Title}`,
            `**Description**: ${(data.Description || '').slice(0, 500)}`,
            `**Author**: ${data.Author || 'unknown'}`,
            `**License**: ${data.License || 'unspecified'}`,
            `**Depends**: ${data.Depends ? Object.keys(data.Depends).join(', ') : 'none'}`,
            `**Imports**: ${data.Imports ? Object.keys(data.Imports).join(', ') : 'none'}`,
            `**URL**: https://cran.r-project.org/package=${data.Package}`,
          ].join('\n')
        }
        return `R package "${query}" not found on CRAN. Browse: https://cran.r-project.org/web/packages/available_packages_by_name.html`
      } catch (err) {
        return `CRAN search error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── arXiv ─────────────────────────────────────────────────────────
  registerTool({
    name: 'arxiv_search',
    description: 'Search arXiv for academic papers. Returns titles, abstracts, authors, and PDF links.',
    parameters: {
      query: { type: 'string', description: 'Search query (supports arXiv search syntax)', required: true },
      limit: { type: 'number', description: 'Max results (default 5)' },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query)
      const limit = Math.min(Number(args.limit) || 5, 20)
      try {
        const res = await fetch(
          `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}`,
          { signal: AbortSignal.timeout(10000) },
        )
        const xml = await res.text()
        // Parse Atom XML entries
        const entries = xml.split('<entry>').slice(1)
        if (entries.length === 0) return `No arXiv papers found for "${query}".`
        return entries.map(entry => {
          const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, ' ').trim() || 'Untitled'
          const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g, ' ').trim().slice(0, 300) || ''
          const id = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() || ''
          const published = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim().slice(0, 10) || ''
          const authors = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)].map(m => m[1].trim()).slice(0, 5)
          const pdfLink = entry.match(/href="([^"]*?)"[^>]*title="pdf"/)?.[1] || id.replace('abs', 'pdf')
          return `### ${title}\n**Authors**: ${authors.join(', ')}\n**Published**: ${published}\n**PDF**: ${pdfLink}\n**Abstract**: ${summary}...`
        }).join('\n\n---\n\n')
      } catch (err) {
        return `arXiv search error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── Semantic Scholar ──────────────────────────────────────────────
  registerTool({
    name: 'semantic_scholar',
    description: 'Search Semantic Scholar for papers with citation counts, influence scores, and related work.',
    parameters: {
      query: { type: 'string', description: 'Search query', required: true },
      limit: { type: 'number', description: 'Max results (default 5)' },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query)
      const limit = Math.min(Number(args.limit) || 5, 20)
      try {
        const res = await fetch(
          `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,abstract,citationCount,year,authors,url,influentialCitationCount`,
          { signal: AbortSignal.timeout(10000) },
        )
        const data = await res.json() as any
        if (!data.data?.length) return `No papers found for "${query}".`
        return data.data.map((p: any) =>
          [
            `### ${p.title}`,
            `**Year**: ${p.year || 'n/a'} | **Citations**: ${p.citationCount} | **Influential citations**: ${p.influentialCitationCount || 0}`,
            `**Authors**: ${(p.authors || []).map((a: any) => a.name).slice(0, 5).join(', ')}`,
            `**URL**: ${p.url}`,
            p.abstract ? `**Abstract**: ${p.abstract.slice(0, 300)}...` : '',
          ].filter(Boolean).join('\n')
        ).join('\n\n---\n\n')
      } catch (err) {
        return `Semantic Scholar error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── Papers With Code ──────────────────────────────────────────────
  registerTool({
    name: 'papers_search',
    description: 'Search Papers With Code for research papers with code implementations. Find the actual code behind any research paper.',
    parameters: {
      query: { type: 'string', description: 'Research topic or paper title', required: true },
      limit: { type: 'number', description: 'Max results (default 5)' },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query)
      const limit = Math.min(Number(args.limit) || 5, 20)
      try {
        const res = await fetch(
          `https://paperswithcode.com/api/v1/papers/?q=${encodeURIComponent(query)}&items_per_page=${limit}`,
          { signal: AbortSignal.timeout(10000) },
        )
        const data = await res.json() as any
        if (!data.results?.length) return `No papers found for "${query}".`
        return data.results.map((p: any) =>
          [
            `### ${p.title}`,
            `**Published**: ${p.published || 'n/a'}`,
            `**arXiv**: ${p.arxiv_id || 'n/a'}`,
            p.abstract ? `**Abstract**: ${p.abstract.slice(0, 300)}...` : '',
            `**URL**: ${p.url_abs || `https://paperswithcode.com${p.url}`}`,
          ].filter(Boolean).join('\n')
        ).join('\n\n---\n\n')
      } catch (err) {
        return `Papers With Code error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── HuggingFace Hub ───────────────────────────────────────────────
  registerTool({
    name: 'hf_search',
    description: 'Search HuggingFace Hub for ML models. Find pre-trained models for any task (text-generation, image-classification, etc.).',
    parameters: {
      query: { type: 'string', description: 'Model search query', required: true },
      task: { type: 'string', description: 'Filter by task (text-generation, image-classification, etc.)' },
      limit: { type: 'number', description: 'Max results (default 5)' },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query)
      const task = args.task ? `&pipeline_tag=${encodeURIComponent(String(args.task))}` : ''
      const limit = Math.min(Number(args.limit) || 5, 20)
      try {
        const res = await fetch(
          `https://huggingface.co/api/models?search=${encodeURIComponent(query)}${task}&sort=downloads&direction=-1&limit=${limit}`,
          { signal: AbortSignal.timeout(10000) },
        )
        const data = await res.json() as any
        if (!Array.isArray(data) || data.length === 0) return `No models found for "${query}".`
        return data.map((m: any) =>
          `**${m.modelId || m.id}** — ${m.pipeline_tag || 'general'}\n  Downloads: ${m.downloads?.toLocaleString() || 'n/a'} | Likes: ${m.likes || 0}\n  Tags: ${(m.tags || []).slice(0, 8).join(', ')}\n  URL: https://huggingface.co/${m.modelId || m.id}`
        ).join('\n\n')
      } catch (err) {
        return `HuggingFace search error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  registerTool({
    name: 'hf_datasets',
    description: 'Search HuggingFace for datasets. Find training data for ML models.',
    parameters: {
      query: { type: 'string', description: 'Dataset search query', required: true },
      limit: { type: 'number', description: 'Max results (default 5)' },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query)
      const limit = Math.min(Number(args.limit) || 5, 20)
      try {
        const res = await fetch(
          `https://huggingface.co/api/datasets?search=${encodeURIComponent(query)}&sort=downloads&direction=-1&limit=${limit}`,
          { signal: AbortSignal.timeout(10000) },
        )
        const data = await res.json() as any
        if (!Array.isArray(data) || data.length === 0) return `No datasets found for "${query}".`
        return data.map((d: any) =>
          `**${d.id}** — Downloads: ${d.downloads?.toLocaleString() || 'n/a'}\n  Tags: ${(d.tags || []).slice(0, 8).join(', ')}\n  URL: https://huggingface.co/datasets/${d.id}`
        ).join('\n\n')
      } catch (err) {
        return `HuggingFace datasets error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── DOI Resolver ──────────────────────────────────────────────────
  registerTool({
    name: 'doi_lookup',
    description: 'Resolve a DOI to full paper metadata (title, authors, journal, abstract, citations).',
    parameters: {
      doi: { type: 'string', description: 'DOI (e.g., 10.1038/s41586-023-06221-2)', required: true },
    },
    tier: 'free',
    async execute(args) {
      const doi = String(args.doi)
      try {
        const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
          headers: { 'User-Agent': 'KBot/2.14 (https://kernel.chat; mailto:hello@kernel.chat)' },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return `DOI "${doi}" not found.`
        const data = await res.json() as any
        const work = data.message
        return [
          `# ${(work.title || ['Untitled'])[0]}`,
          `**Authors**: ${(work.author || []).map((a: any) => `${a.given || ''} ${a.family || ''}`).join(', ')}`,
          `**Journal**: ${(work['container-title'] || ['n/a'])[0]}`,
          `**Published**: ${work.created?.['date-parts']?.[0]?.join('-') || 'n/a'}`,
          `**Type**: ${work.type || 'n/a'}`,
          `**Citations**: ${work['is-referenced-by-count'] || 0}`,
          `**URL**: ${work.URL || `https://doi.org/${doi}`}`,
          work.abstract ? `**Abstract**: ${work.abstract.replace(/<[^>]*>/g, '').slice(0, 500)}` : '',
        ].filter(Boolean).join('\n')
      } catch (err) {
        return `DOI lookup error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── GitHub Trending ───────────────────────────────────────────────
  registerTool({
    name: 'github_trending',
    description: 'Find trending GitHub repositories by language or topic. Discover what the community is building right now.',
    parameters: {
      language: { type: 'string', description: 'Programming language (e.g., python, rust, typescript)' },
      since: { type: 'string', description: 'Time range: daily, weekly, monthly (default: weekly)' },
    },
    tier: 'free',
    async execute(args) {
      const language = args.language ? String(args.language) : ''
      const since = String(args.since || 'weekly')
      // Use GitHub search API as trending proxy (stars created recently)
      const dateFilter = since === 'daily' ? '1' : since === 'monthly' ? '30' : '7'
      const now = new Date()
      const past = new Date(now.getTime() - parseInt(dateFilter) * 86400000)
      const dateStr = past.toISOString().slice(0, 10)
      const langFilter = language ? `+language:${encodeURIComponent(language)}` : ''
      try {
        const res = await fetch(
          `https://api.github.com/search/repositories?q=created:>${dateStr}${langFilter}&sort=stars&order=desc&per_page=10`,
          { signal: AbortSignal.timeout(10000) },
        )
        const data = await res.json() as any
        if (!data.items?.length) return `No trending repos found.`
        return data.items.map((r: any) =>
          `**${r.full_name}** ★${r.stargazers_count}\n  ${r.description || 'No description'}\n  Language: ${r.language || 'mixed'} | Forks: ${r.forks_count}\n  URL: ${r.html_url}`
        ).join('\n\n')
      } catch (err) {
        return `GitHub trending error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── NASA Open Data ────────────────────────────────────────────────
  registerTool({
    name: 'nasa_search',
    description: 'Search NASA open datasets and imagery. Access satellite data, Mars rover photos, astronomy images.',
    parameters: {
      query: { type: 'string', description: 'Search query', required: true },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query)
      try {
        const res = await fetch(
          `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=5`,
          { signal: AbortSignal.timeout(10000) },
        )
        const data = await res.json() as any
        const items = data.collection?.items || []
        if (items.length === 0) return `No NASA results for "${query}".`
        return items.map((item: any) => {
          const d = item.data?.[0] || {}
          return `**${d.title}** (${d.date_created?.slice(0, 10) || 'n/a'})\n  ${(d.description || '').slice(0, 200)}\n  Center: ${d.center || 'n/a'} | ID: ${d.nasa_id || 'n/a'}\n  Preview: ${item.links?.[0]?.href || 'n/a'}`
        }).join('\n\n')
      } catch (err) {
        return `NASA search error: ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })
}
