// kbot Life Sciences Tools — Bioinformatics, genomics, proteomics, clinical research
// Real API integrations with NCBI, UniProt, PDB, ChEMBL, Reactome, GBIF, Open Targets, ClinicalTrials.gov
// No external dependencies — all built on native fetch + regex XML parsing.

import { registerTool } from './index.js'

const UA = 'KBot/3.0 (Lab Tools)'

// ── NCBI rate limiter (max 3 requests/sec without API key) ──────────────
let lastNCBICall = 0

async function ncbiThrottle(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastNCBICall
  if (elapsed < 334) {
    await new Promise(resolve => setTimeout(resolve, 334 - elapsed))
  }
  lastNCBICall = Date.now()
}

// ── XML helpers (regex-based, no external parser) ───────────────────────

function xmlTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const m = xml.match(re)
  return m ? m[1].trim() : ''
}

function xmlTagAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi')
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim())
  }
  return results
}

// ── Standard genetic code codon table ───────────────────────────────────

const CODON_TABLE: Record<string, string> = {
  TTT: 'F', TTC: 'F', TTA: 'L', TTG: 'L',
  CTT: 'L', CTC: 'L', CTA: 'L', CTG: 'L',
  ATT: 'I', ATC: 'I', ATA: 'I', ATG: 'M',
  GTT: 'V', GTC: 'V', GTA: 'V', GTG: 'V',
  TCT: 'S', TCC: 'S', TCA: 'S', TCG: 'S',
  CCT: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
  ACT: 'T', ACC: 'T', ACA: 'T', ACG: 'T',
  GCT: 'A', GCC: 'A', GCA: 'A', GCG: 'A',
  TAT: 'Y', TAC: 'Y', TAA: '*', TAG: '*',
  CAT: 'H', CAC: 'H', CAA: 'Q', CAG: 'Q',
  AAT: 'N', AAC: 'N', AAA: 'K', AAG: 'K',
  GAT: 'D', GAC: 'D', GAA: 'E', GAG: 'E',
  TGT: 'C', TGC: 'C', TGA: '*', TGG: 'W',
  CGT: 'R', CGC: 'R', CGA: 'R', CGG: 'R',
  AGT: 'S', AGC: 'S', AGA: 'R', AGG: 'R',
  GGT: 'G', GGC: 'G', GGA: 'G', GGG: 'G',
}

const AA_WEIGHTS: Record<string, number> = {
  A: 89.09, R: 174.20, N: 132.12, D: 133.10, C: 121.16,
  E: 147.13, Q: 146.15, G: 75.03, H: 155.16, I: 131.17,
  L: 131.17, K: 146.19, M: 149.21, F: 165.19, P: 115.13,
  S: 105.09, T: 119.12, W: 204.23, Y: 181.19, V: 117.15,
}

const DNA_WEIGHTS: Record<string, number> = {
  A: 331.2, T: 322.2, G: 347.2, C: 307.2,
}

// ── Registration ────────────────────────────────────────────────────────

export function registerLabBioTools(): void {

  // ════════════════════════════════════════════════════════════════════════
  // 1. PubMed Search
  // ════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'pubmed_search',
    description: 'Search PubMed for biomedical literature via NCBI E-utilities. Returns titles, authors, journal, year, abstract, DOI, and PMID. Use MeSH terms for precise filtering.',
    parameters: {
      query: { type: 'string', description: 'Search query (e.g., "CRISPR cancer therapy")', required: true },
      mesh_terms: { type: 'string', description: 'Optional MeSH terms to AND with query (e.g., "Neoplasms[MeSH]")' },
      limit: { type: 'number', description: 'Max results (default 10, max 50)' },
      sort: { type: 'string', description: 'Sort order: "relevance" (default) or "date"' },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query)
      const meshTerms = args.mesh_terms ? String(args.mesh_terms) : ''
      const limit = Math.min(typeof args.limit === 'number' ? args.limit : 10, 50)
      const sort = String(args.sort || 'relevance')

      let fullQuery = query
      if (meshTerms) fullQuery += ` AND ${meshTerms}`
      const sortParam = sort === 'date' ? '&sort=pub_date' : '&sort=relevance'

      try {
        // Step 1: esearch to get PMIDs
        await ncbiThrottle()
        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=${limit}${sortParam}&term=${encodeURIComponent(fullQuery)}`
        const searchRes = await fetch(searchUrl, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(10000),
        })
        if (!searchRes.ok) return `PubMed search error: HTTP ${searchRes.status}`
        const searchData = await searchRes.json()
        const idList: string[] = searchData?.esearchresult?.idlist || []
        const totalCount = searchData?.esearchresult?.count || '0'

        if (idList.length === 0) return `No PubMed results for "${query}". Try broader terms or check MeSH vocabulary.`

        // Step 2: efetch to get article details
        await ncbiThrottle()
        const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=${idList.join(',')}`
        const fetchRes = await fetch(fetchUrl, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(10000),
        })
        if (!fetchRes.ok) return `PubMed fetch error: HTTP ${fetchRes.status}`
        const xml = await fetchRes.text()

        // Parse articles from XML
        const articles = xmlTagAll(xml, 'PubmedArticle')
        const results: string[] = [`## PubMed Results (${totalCount} total, showing ${articles.length})\n`]

        for (const article of articles) {
          const pmid = xmlTag(article, 'PMID')
          const title = xmlTag(article, 'ArticleTitle').replace(/<[^>]+>/g, '')
          const abstractText = xmlTag(article, 'AbstractText').replace(/<[^>]+>/g, '')
          const journal = xmlTag(article, 'Title')
          const year = xmlTag(article, 'Year')

          // Authors
          const authorNodes = xmlTagAll(article, 'Author')
          const authors = authorNodes.slice(0, 5).map(a => {
            const last = xmlTag(a, 'LastName')
            const initials = xmlTag(a, 'Initials')
            return last ? `${last} ${initials}` : xmlTag(a, 'CollectiveName')
          }).filter(Boolean)
          const authorStr = authors.join(', ') + (authorNodes.length > 5 ? ' et al.' : '')

          // DOI
          const articleIdList = xmlTagAll(article, 'ArticleId')
          let doi = ''
          for (const idBlock of articleIdList) {
            if (idBlock.includes('doi')) {
              // The DOI is the text content, but we need to check the IdType attribute
              const doiMatch = article.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/i)
              if (doiMatch) doi = doiMatch[1]
              break
            }
          }

          let entry = `### ${title}\n`
          entry += `**Authors:** ${authorStr || 'N/A'}\n`
          entry += `**Journal:** ${journal || 'N/A'} (${year || 'N/A'})\n`
          entry += `**PMID:** [${pmid}](https://pubmed.ncbi.nlm.nih.gov/${pmid}/)`
          if (doi) entry += ` | **DOI:** [${doi}](https://doi.org/${doi})`
          entry += '\n'
          if (abstractText) {
            const truncated = abstractText.length > 500 ? abstractText.slice(0, 500) + '...' : abstractText
            entry += `\n> ${truncated}\n`
          }
          results.push(entry)
        }

        return results.join('\n---\n')
      } catch (e: any) {
        return `PubMed search failed: ${e?.message || e}`
      }
    },
  })

  // ════════════════════════════════════════════════════════════════════════
  // 2. Gene Lookup
  // ════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'gene_lookup',
    description: 'Look up gene information by symbol or name using MyGene.info. Returns function, chromosome location, aliases, and associated diseases.',
    parameters: {
      gene: { type: 'string', description: 'Gene symbol or name (e.g., "TP53", "BRCA1", "tumor protein p53")', required: true },
      organism: { type: 'string', description: 'Organism (default: "human"). Also: "mouse", "rat", "zebrafish", etc.' },
    },
    tier: 'free',
    async execute(args) {
      const gene = String(args.gene)
      const organism = String(args.organism || 'human')

      try {
        const fields = 'symbol,name,summary,genomic_pos,alias,type_of_gene,entrezgene,ensembl.gene,taxid,generif,pathway.kegg'
        const url = `https://mygene.info/v3/query?q=${encodeURIComponent(gene)}&species=${encodeURIComponent(organism)}&fields=${fields}&size=5`
        const res = await fetch(url, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return `MyGene.info error: HTTP ${res.status}`
        const data = await res.json()
        const hits = data.hits || []

        if (hits.length === 0) return `No gene found for "${gene}" in ${organism}. Try the official HGNC symbol.`

        const results: string[] = [`## Gene Lookup: "${gene}" (${organism})\n`]

        for (const hit of hits.slice(0, 3)) {
          let entry = `### ${hit.symbol || gene} — ${hit.name || 'Unknown'}\n`
          entry += `**Type:** ${hit.type_of_gene || 'N/A'}\n`

          if (hit.entrezgene) entry += `**Entrez ID:** [${hit.entrezgene}](https://www.ncbi.nlm.nih.gov/gene/${hit.entrezgene})\n`
          if (hit.ensembl?.gene) entry += `**Ensembl:** ${hit.ensembl.gene}\n`

          // Genomic position
          if (hit.genomic_pos) {
            const pos = Array.isArray(hit.genomic_pos) ? hit.genomic_pos[0] : hit.genomic_pos
            if (pos) entry += `**Location:** Chr${pos.chr}:${pos.start?.toLocaleString()}-${pos.end?.toLocaleString()} (${pos.strand > 0 ? '+' : '-'} strand)\n`
          }

          // Aliases
          if (hit.alias) {
            const aliases = Array.isArray(hit.alias) ? hit.alias : [hit.alias]
            entry += `**Aliases:** ${aliases.slice(0, 10).join(', ')}\n`
          }

          // Summary
          if (hit.summary) {
            const truncated = hit.summary.length > 600 ? hit.summary.slice(0, 600) + '...' : hit.summary
            entry += `\n**Summary:** ${truncated}\n`
          }

          // Pathways
          if (hit.pathway?.kegg) {
            const pathways = Array.isArray(hit.pathway.kegg) ? hit.pathway.kegg : [hit.pathway.kegg]
            entry += `\n**KEGG Pathways:**\n`
            for (const p of pathways.slice(0, 5)) {
              entry += `- ${p.name || p.id}\n`
            }
          }

          results.push(entry)
        }

        return results.join('\n---\n')
      } catch (e: any) {
        return `Gene lookup failed: ${e?.message || e}`
      }
    },
  })

  // ════════════════════════════════════════════════════════════════════════
  // 3. Protein Search
  // ════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'protein_search',
    description: 'Search UniProt for protein information. Returns sequence length, function, subcellular location, and GO terms.',
    parameters: {
      query: { type: 'string', description: 'Protein name, gene symbol, or keyword (e.g., "insulin", "P53_HUMAN")', required: true },
      organism: { type: 'string', description: 'Organism filter (e.g., "Homo sapiens", "Mus musculus")' },
      reviewed: { type: 'boolean', description: 'Only reviewed (Swiss-Prot) entries (default: true)' },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query)
      const organism = args.organism ? String(args.organism) : ''
      const reviewed = args.reviewed !== false

      try {
        let fullQuery = query
        if (organism) fullQuery += ` AND organism_name:"${organism}"`
        if (reviewed) fullQuery += ' AND reviewed:true'

        const url = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(fullQuery)}&format=json&size=5`
        const res = await fetch(url, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return `UniProt error: HTTP ${res.status}`
        const data = await res.json()
        const results_arr = data.results || []

        if (results_arr.length === 0) return `No UniProt results for "${query}". Try a broader query or set reviewed=false.`

        const output: string[] = [`## UniProt Search: "${query}"\n`]

        for (const entry of results_arr) {
          const accession = entry.primaryAccession || 'N/A'
          const entryName = entry.uniProtkbId || ''
          const proteinName = entry.proteinDescription?.recommendedName?.fullName?.value
            || entry.proteinDescription?.submittedName?.[0]?.fullName?.value
            || 'Unknown'
          const organism_name = entry.organism?.scientificName || ''
          const seqLen = entry.sequence?.length || 0
          const seqMW = entry.sequence?.molWeight || 0

          let block = `### ${proteinName}\n`
          block += `**Accession:** [${accession}](https://www.uniprot.org/uniprot/${accession}) (${entryName})\n`
          block += `**Organism:** ${organism_name}\n`
          block += `**Sequence:** ${seqLen} aa | ${(seqMW / 1000).toFixed(1)} kDa\n`

          // Function
          const funcComments = (entry.comments || []).filter((c: any) => c.commentType === 'FUNCTION')
          if (funcComments.length > 0) {
            const funcText = funcComments[0].texts?.[0]?.value || ''
            if (funcText) {
              const truncated = funcText.length > 400 ? funcText.slice(0, 400) + '...' : funcText
              block += `\n**Function:** ${truncated}\n`
            }
          }

          // Subcellular location
          const locComments = (entry.comments || []).filter((c: any) => c.commentType === 'SUBCELLULAR LOCATION')
          if (locComments.length > 0) {
            const locations = locComments[0].subcellularLocations?.map((sl: any) =>
              sl.location?.value
            ).filter(Boolean) || []
            if (locations.length > 0) block += `**Subcellular Location:** ${locations.join(', ')}\n`
          }

          // GO terms
          const goTerms = (entry.uniProtKBCrossReferences || []).filter((x: any) => x.database === 'GO')
          if (goTerms.length > 0) {
            const goGroups: Record<string, string[]> = { F: [], P: [], C: [] }
            for (const go of goTerms.slice(0, 20)) {
              const name = go.properties?.find((p: any) => p.key === 'GoTerm')?.value || go.id
              if (name.startsWith('F:')) goGroups.F.push(name.slice(2))
              else if (name.startsWith('P:')) goGroups.P.push(name.slice(2))
              else if (name.startsWith('C:')) goGroups.C.push(name.slice(2))
            }
            if (goGroups.F.length > 0) block += `**Molecular Function:** ${goGroups.F.slice(0, 5).join('; ')}\n`
            if (goGroups.P.length > 0) block += `**Biological Process:** ${goGroups.P.slice(0, 5).join('; ')}\n`
            if (goGroups.C.length > 0) block += `**Cellular Component:** ${goGroups.C.slice(0, 5).join('; ')}\n`
          }

          output.push(block)
        }

        return output.join('\n---\n')
      } catch (e: any) {
        return `Protein search failed: ${e?.message || e}`
      }
    },
  })

  // ════════════════════════════════════════════════════════════════════════
  // 4. Protein Structure (PDB)
  // ════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'protein_structure',
    description: 'Fetch protein 3D structure info from RCSB PDB. Get resolution, experimental method, ligands, and chain details by PDB ID or text search.',
    parameters: {
      pdb_id: { type: 'string', description: 'PDB ID (e.g., "1TUP", "6LU7"). If provided, fetches directly.' },
      query: { type: 'string', description: 'Text search query (e.g., "p53 DNA binding domain"). Used if pdb_id not given.' },
    },
    tier: 'free',
    async execute(args) {
      const pdbId = args.pdb_id ? String(args.pdb_id).toUpperCase() : ''
      const query = args.query ? String(args.query) : ''

      if (!pdbId && !query) return 'Provide either pdb_id or query to search PDB structures.'

      try {
        let ids: string[] = []

        if (pdbId) {
          ids = [pdbId]
        } else {
          // Text search via RCSB search API
          const searchBody = JSON.stringify({
            query: {
              type: 'terminal',
              service: 'full_text',
              parameters: { value: query },
            },
            return_type: 'entry',
            request_options: { paginate: { start: 0, rows: 5 } },
          })
          const searchRes = await fetch('https://search.rcsb.org/rcsbsearch/v2/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
            body: searchBody,
            signal: AbortSignal.timeout(10000),
          })
          if (!searchRes.ok) return `PDB search error: HTTP ${searchRes.status}`
          const searchData = await searchRes.json()
          ids = (searchData.result_set || []).map((r: any) => r.identifier).slice(0, 5)
          if (ids.length === 0) return `No PDB structures found for "${query}".`
        }

        const output: string[] = [`## PDB Structure${ids.length > 1 ? 's' : ''}\n`]

        for (const id of ids) {
          const res = await fetch(`https://data.rcsb.org/rest/v1/core/entry/${id}`, {
            headers: { 'User-Agent': UA },
            signal: AbortSignal.timeout(10000),
          })
          if (!res.ok) {
            output.push(`**${id}**: Not found (HTTP ${res.status})`)
            continue
          }
          const data = await res.json()

          const title = data.struct?.title || 'No title'
          const method = data.exptl?.[0]?.method || 'N/A'
          const resolution = data.rcsb_entry_info?.resolution_combined?.[0]
          const deposited = data.rcsb_accession_info?.deposit_date || ''
          const polymerCount = data.rcsb_entry_info?.polymer_entity_count || 0
          const nonPolymerCount = data.rcsb_entry_info?.nonpolymer_entity_count || 0
          const citation = data.rcsb_primary_citation

          let block = `### [${id}](https://www.rcsb.org/structure/${id}) — ${title}\n`
          block += `**Method:** ${method}`
          if (resolution) block += ` | **Resolution:** ${resolution} A`
          block += '\n'
          block += `**Deposited:** ${deposited}\n`
          block += `**Entities:** ${polymerCount} polymer, ${nonPolymerCount} non-polymer (ligands/ions)\n`

          // Polymer entities (chains)
          if (data.rcsb_entry_info?.polymer_entity_count_protein) {
            block += `**Protein chains:** ${data.rcsb_entry_info.polymer_entity_count_protein}\n`
          }
          if (data.rcsb_entry_info?.polymer_entity_count_nucleic_acid) {
            block += `**Nucleic acid chains:** ${data.rcsb_entry_info.polymer_entity_count_nucleic_acid}\n`
          }

          // Primary citation
          if (citation) {
            block += `\n**Citation:** ${citation.title || ''}\n`
            const authors = citation.rcsb_authors?.slice(0, 3).join(', ') || ''
            if (authors) block += `*${authors}${citation.rcsb_authors?.length > 3 ? ' et al.' : ''}* `
            if (citation.pdbx_database_id_journal) block += `${citation.pdbx_database_id_journal} `
            if (citation.year) block += `(${citation.year})`
            if (citation.pdbx_database_id_DOI) block += ` DOI: ${citation.pdbx_database_id_DOI}`
            block += '\n'
          }

          output.push(block)
        }

        return output.join('\n---\n')
      } catch (e: any) {
        return `PDB lookup failed: ${e?.message || e}`
      }
    },
  })

  // ════════════════════════════════════════════════════════════════════════
  // 5. BLAST Search
  // ════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'blast_search',
    description: 'Submit a sequence for NCBI BLAST homology search. Supports blastn (nucleotide), blastp (protein), blastx (translated). Async — submits job, polls for results.',
    parameters: {
      sequence: { type: 'string', description: 'Nucleotide or protein sequence (FASTA or raw)', required: true },
      program: { type: 'string', description: 'BLAST program: "blastn", "blastp", or "blastx"', required: true },
      database: { type: 'string', description: 'Database: "nr" (non-redundant protein), "nt" (nucleotide), "swissprot"', required: true },
    },
    tier: 'free',
    timeout: 180_000,
    async execute(args) {
      const sequence = String(args.sequence).trim()
      const program = String(args.program || 'blastn')
      const database = String(args.database || 'nr')

      if (sequence.length < 10) return 'Sequence too short for BLAST. Provide at least 10 residues/bases.'

      // Clean sequence: remove FASTA header if present
      const cleanSeq = sequence.split('\n').filter(line => !line.startsWith('>')).join('')

      try {
        // Step 1: Submit BLAST job
        await ncbiThrottle()
        const submitParams = new URLSearchParams({
          CMD: 'Put',
          PROGRAM: program,
          DATABASE: database,
          QUERY: cleanSeq,
          FORMAT_TYPE: 'XML',
          HITLIST_SIZE: '10',
        })

        const submitRes = await fetch('https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi', {
          method: 'POST',
          headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: submitParams.toString(),
          signal: AbortSignal.timeout(30000),
        })
        if (!submitRes.ok) return `BLAST submission failed: HTTP ${submitRes.status}`

        const submitText = await submitRes.text()

        // Extract RID from response
        const ridMatch = submitText.match(/RID\s*=\s*(\S+)/)
        if (!ridMatch) return `BLAST submission failed: could not get Request ID.\n\nResponse excerpt:\n${submitText.slice(0, 500)}`
        const rid = ridMatch[1]

        // Extract estimated wait time
        const rtoeMatch = submitText.match(/RTOE\s*=\s*(\d+)/)
        const rtoe = rtoeMatch ? parseInt(rtoeMatch[1], 10) : 15

        // Step 2: Poll for results
        const startTime = Date.now()
        const maxWait = 120_000 // 2 minutes max polling
        let waitTime = Math.min(rtoe * 1000, 15000) // Start with estimated wait, cap at 15s

        // Initial wait before first poll
        await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 10000)))

        let resultXml = ''

        while (Date.now() - startTime < maxWait) {
          await ncbiThrottle()
          const pollUrl = `https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi?CMD=Get&FORMAT_TYPE=XML&RID=${rid}`
          const pollRes = await fetch(pollUrl, {
            headers: { 'User-Agent': UA },
            signal: AbortSignal.timeout(120_000),
          })

          if (!pollRes.ok) {
            await new Promise(resolve => setTimeout(resolve, 5000))
            continue
          }

          const pollText = await pollRes.text()

          // Check status
          if (pollText.includes('Status=WAITING')) {
            await new Promise(resolve => setTimeout(resolve, 5000))
            continue
          }
          if (pollText.includes('Status=FAILED')) return `BLAST job failed (RID: ${rid}). The sequence may be invalid for ${program}.`
          if (pollText.includes('Status=UNKNOWN')) return `BLAST job expired or unknown (RID: ${rid}).`

          // If we have actual results (XML with hits)
          if (pollText.includes('<BlastOutput>') || pollText.includes('<Hit>')) {
            resultXml = pollText
            break
          }

          // Still processing
          await new Promise(resolve => setTimeout(resolve, 5000))
        }

        if (!resultXml) return `BLAST search timed out after ${Math.round(maxWait / 1000)}s. RID: ${rid} — check manually at https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi?CMD=Get&RID=${rid}`

        // Step 3: Parse results
        const hits = xmlTagAll(resultXml, 'Hit')

        if (hits.length === 0) return `BLAST completed but found no significant hits for your ${program} search against ${database}.`

        const output: string[] = [`## BLAST Results (${program} vs ${database})\n**RID:** ${rid} | **Hits:** ${hits.length}\n`]

        for (const hit of hits.slice(0, 10)) {
          const hitNum = xmlTag(hit, 'Hit_num')
          const hitDef = xmlTag(hit, 'Hit_def').slice(0, 120)
          const hitAccession = xmlTag(hit, 'Hit_accession')
          const hitLen = xmlTag(hit, 'Hit_len')

          // Best HSP
          const hsps = xmlTagAll(hit, 'Hsp')
          const hsp = hsps[0] || ''
          const evalue = xmlTag(hsp, 'Hsp_evalue')
          const bitScore = xmlTag(hsp, 'Hsp_bit-score')
          const identity = xmlTag(hsp, 'Hsp_identity')
          const alignLen = xmlTag(hsp, 'Hsp_align-len')
          const identPct = alignLen ? ((parseInt(identity, 10) / parseInt(alignLen, 10)) * 100).toFixed(1) : 'N/A'

          let block = `**${hitNum}. ${hitDef}**\n`
          block += `Accession: ${hitAccession} | Length: ${hitLen}\n`
          block += `E-value: ${evalue} | Bit score: ${bitScore} | Identity: ${identPct}% (${identity}/${alignLen})\n`

          output.push(block)
        }

        return output.join('\n---\n')
      } catch (e: any) {
        return `BLAST search failed: ${e?.message || e}`
      }
    },
  })

  // ════════════════════════════════════════════════════════════════════════
  // 6. Drug Lookup (ChEMBL)
  // ════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'drug_lookup',
    description: 'Search ChEMBL for drugs and compounds. Returns targets, mechanism of action, clinical phase, and molecular properties.',
    parameters: {
      query: { type: 'string', description: 'Drug name, target, or mechanism (e.g., "imatinib", "EGFR inhibitor")', required: true },
      search_type: { type: 'string', description: 'Search type: "name" (default), "target", or "mechanism"' },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query)
      const searchType = String(args.search_type || 'name')

      try {
        let url: string

        if (searchType === 'target') {
          url = `https://www.ebi.ac.uk/chembl/api/data/target/search?q=${encodeURIComponent(query)}&format=json&limit=10`
        } else if (searchType === 'mechanism') {
          url = `https://www.ebi.ac.uk/chembl/api/data/mechanism/search?q=${encodeURIComponent(query)}&format=json&limit=10`
        } else {
          url = `https://www.ebi.ac.uk/chembl/api/data/molecule/search?q=${encodeURIComponent(query)}&format=json&limit=10`
        }

        const res = await fetch(url, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return `ChEMBL error: HTTP ${res.status}`
        const data = await res.json()

        if (searchType === 'target') {
          const targets = data.targets || []
          if (targets.length === 0) return `No targets found for "${query}" in ChEMBL.`

          const output: string[] = [`## ChEMBL Targets for "${query}"\n`]
          for (const t of targets.slice(0, 5)) {
            let block = `### ${t.pref_name || 'Unknown'}\n`
            block += `**ChEMBL ID:** ${t.target_chembl_id || 'N/A'}\n`
            block += `**Type:** ${t.target_type || 'N/A'}\n`
            block += `**Organism:** ${t.organism || 'N/A'}\n`
            if (t.target_components?.[0]?.accession) {
              block += `**UniProt:** ${t.target_components[0].accession}\n`
            }
            output.push(block)
          }
          return output.join('\n---\n')
        }

        if (searchType === 'mechanism') {
          const mechanisms = data.mechanisms || []
          if (mechanisms.length === 0) return `No mechanisms found for "${query}" in ChEMBL.`

          const output: string[] = [`## ChEMBL Mechanisms: "${query}"\n`]
          for (const m of mechanisms.slice(0, 10)) {
            let block = `**${m.molecule_chembl_id}** → ${m.target_chembl_id || 'N/A'}\n`
            block += `Mechanism: ${m.mechanism_of_action || 'N/A'}\n`
            block += `Action type: ${m.action_type || 'N/A'}\n`
            if (m.max_phase !== undefined) block += `Max phase: ${m.max_phase}\n`
            output.push(block)
          }
          return output.join('\n---\n')
        }

        // Default: molecule search
        const molecules = data.molecules || []
        if (molecules.length === 0) return `No molecules found for "${query}" in ChEMBL.`

        const output: string[] = [`## ChEMBL Molecules: "${query}"\n`]

        for (const mol of molecules.slice(0, 5)) {
          const name = mol.pref_name || mol.molecule_chembl_id || 'Unknown'
          const chemblId = mol.molecule_chembl_id || 'N/A'
          const maxPhase = mol.max_phase !== undefined ? mol.max_phase : 'N/A'
          const type = mol.molecule_type || 'N/A'
          const props = mol.molecule_properties || {}

          let block = `### ${name}\n`
          block += `**ChEMBL ID:** [${chemblId}](https://www.ebi.ac.uk/chembl/compound_report_card/${chemblId}/)\n`
          block += `**Type:** ${type} | **Max Clinical Phase:** ${maxPhase}\n`
          if (mol.first_approval) block += `**First Approval:** ${mol.first_approval}\n`

          // Molecular properties
          if (props.full_mwt) block += `**MW:** ${props.full_mwt} Da`
          if (props.alogp) block += ` | **ALogP:** ${props.alogp}`
          if (props.hba) block += ` | **HBA:** ${props.hba}`
          if (props.hbd) block += ` | **HBD:** ${props.hbd}`
          if (props.psa) block += ` | **PSA:** ${props.psa}`
          if (props.full_mwt) block += '\n'

          if (props.ro5_violations !== undefined) block += `**Lipinski violations:** ${props.ro5_violations}\n`
          if (mol.molecule_structures?.canonical_smiles) {
            block += `**SMILES:** \`${mol.molecule_structures.canonical_smiles.slice(0, 100)}\`\n`
          }

          output.push(block)
        }

        return output.join('\n---\n')
      } catch (e: any) {
        return `Drug lookup failed: ${e?.message || e}`
      }
    },
  })

  // ════════════════════════════════════════════════════════════════════════
  // 7. Pathway Search (Reactome)
  // ════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'pathway_search',
    description: 'Search Reactome for biological pathways. Returns pathway names, species, summaries, and hierarchical relationships.',
    parameters: {
      query: { type: 'string', description: 'Pathway name or keyword (e.g., "apoptosis", "glycolysis", "MAPK signaling")', required: true },
      organism: { type: 'string', description: 'Species name (default: "Homo sapiens")' },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query)
      const organism = String(args.organism || 'Homo sapiens')

      try {
        const url = `https://reactome.org/ContentService/search/query?query=${encodeURIComponent(query)}&species=${encodeURIComponent(organism)}&types=Pathway&cluster=true`
        const res = await fetch(url, {
          headers: { 'User-Agent': UA, 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return `Reactome error: HTTP ${res.status}`
        const data = await res.json()

        const groups = data.results || []
        if (groups.length === 0) return `No pathways found for "${query}" in Reactome.`

        const output: string[] = [`## Reactome Pathways: "${query}"\n`]

        let count = 0
        for (const group of groups) {
          const entries = group.entries || []
          for (const entry of entries) {
            if (count >= 10) break

            let block = `### ${entry.name || 'Unknown'}\n`
            block += `**ID:** [${entry.stId}](https://reactome.org/content/detail/${entry.stId})\n`
            block += `**Species:** ${entry.species?.[0] || organism}\n`

            if (entry.summation) {
              const summary = entry.summation.replace(/<[^>]+>/g, '')
              const truncated = summary.length > 300 ? summary.slice(0, 300) + '...' : summary
              block += `\n${truncated}\n`
            }

            if (entry.compartmentNames?.length > 0) {
              block += `**Compartments:** ${entry.compartmentNames.join(', ')}\n`
            }

            output.push(block)
            count++
          }
          if (count >= 10) break
        }

        return output.join('\n---\n')
      } catch (e: any) {
        return `Pathway search failed: ${e?.message || e}`
      }
    },
  })

  // ════════════════════════════════════════════════════════════════════════
  // 8. Taxonomy Lookup (GBIF)
  // ════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'taxonomy_lookup',
    description: 'Look up taxonomic classification of any organism via GBIF. Returns full lineage from kingdom to species with taxonomic status.',
    parameters: {
      name: { type: 'string', description: 'Organism name (e.g., "Homo sapiens", "E. coli", "giant panda")', required: true },
      rank: { type: 'string', description: 'Expected rank filter: "species", "genus", "family", etc.' },
    },
    tier: 'free',
    async execute(args) {
      const name = String(args.name)
      const rank = args.rank ? String(args.rank).toUpperCase() : ''

      try {
        let url = `https://api.gbif.org/v1/species/search?q=${encodeURIComponent(name)}&limit=5`
        if (rank) url += `&rank=${rank}`

        const res = await fetch(url, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return `GBIF error: HTTP ${res.status}`
        const data = await res.json()
        const results_arr = data.results || []

        if (results_arr.length === 0) return `No taxonomic records for "${name}" in GBIF.`

        const output: string[] = [`## Taxonomy: "${name}"\n`]

        for (const sp of results_arr.slice(0, 3)) {
          let block = `### ${sp.canonicalName || sp.scientificName || name}\n`
          if (sp.authorship) block += `*${sp.authorship}*\n`
          block += `**Rank:** ${sp.rank || 'N/A'}\n`
          block += `**Status:** ${sp.taxonomicStatus || 'N/A'}\n`
          block += `**GBIF Key:** [${sp.key}](https://www.gbif.org/species/${sp.key})\n`

          // Full lineage
          const lineage: string[] = []
          if (sp.kingdom) lineage.push(`Kingdom: ${sp.kingdom}`)
          if (sp.phylum) lineage.push(`Phylum: ${sp.phylum}`)
          if (sp.class) lineage.push(`Class: ${sp.class}`)
          if (sp.order) lineage.push(`Order: ${sp.order}`)
          if (sp.family) lineage.push(`Family: ${sp.family}`)
          if (sp.genus) lineage.push(`Genus: *${sp.genus}*`)
          if (sp.species) lineage.push(`Species: *${sp.species}*`)

          if (lineage.length > 0) {
            block += `\n**Lineage:**\n${lineage.map(l => `- ${l}`).join('\n')}\n`
          }

          if (sp.vernacularNames?.length > 0) {
            const common = sp.vernacularNames.slice(0, 5).map((v: any) => v.vernacularName).filter(Boolean)
            if (common.length > 0) block += `\n**Common Names:** ${common.join(', ')}\n`
          }

          if (sp.descriptions?.length > 0) {
            const desc = sp.descriptions[0].description || ''
            if (desc) block += `\n${desc.slice(0, 300)}${desc.length > 300 ? '...' : ''}\n`
          }

          output.push(block)
        }

        return output.join('\n---\n')
      } catch (e: any) {
        return `Taxonomy lookup failed: ${e?.message || e}`
      }
    },
  })

  // ════════════════════════════════════════════════════════════════════════
  // 9. Clinical Trials
  // ════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'clinical_trials',
    description: 'Search ClinicalTrials.gov for clinical studies. Filter by condition, drug, status, and phase.',
    parameters: {
      query: { type: 'string', description: 'Search term (e.g., "pembrolizumab melanoma", "COVID-19 vaccine")', required: true },
      status: { type: 'string', description: 'Filter: "recruiting", "completed", "active" (active, not recruiting), "enrolling" (enrolling by invitation)' },
      phase: { type: 'string', description: 'Phase filter: "EARLY_PHASE1", "PHASE1", "PHASE2", "PHASE3", "PHASE4"' },
    },
    tier: 'free',
    async execute(args) {
      const query = String(args.query)
      const status = args.status ? String(args.status) : ''
      const phase = args.phase ? String(args.phase) : ''

      try {
        let url = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(query)}&pageSize=10`

        // Map user-friendly status to API values
        if (status) {
          const statusMap: Record<string, string> = {
            recruiting: 'RECRUITING',
            completed: 'COMPLETED',
            active: 'ACTIVE_NOT_RECRUITING',
            enrolling: 'ENROLLING_BY_INVITATION',
          }
          const mapped = statusMap[status.toLowerCase()] || status.toUpperCase()
          url += `&filter.overallStatus=${mapped}`
        }

        if (phase) {
          url += `&filter.phase=${phase.toUpperCase()}`
        }

        const res = await fetch(url, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return `ClinicalTrials.gov error: HTTP ${res.status}`
        const data = await res.json()
        const studies = data.studies || []

        if (studies.length === 0) return `No clinical trials found for "${query}".`

        const totalCount = data.totalCount || studies.length
        const output: string[] = [`## Clinical Trials: "${query}" (${totalCount} total)\n`]

        for (const study of studies) {
          const proto = study.protocolSection || {}
          const id_module = proto.identificationModule || {}
          const status_module = proto.statusModule || {}
          const design_module = proto.designModule || {}
          const desc_module = proto.descriptionModule || {}
          const conditions_module = proto.conditionsModule || {}
          const sponsor_module = proto.sponsorCollaboratorsModule || {}

          const nctId = id_module.nctId || 'N/A'
          const title = id_module.officialTitle || id_module.briefTitle || 'Untitled'
          const overallStatus = status_module.overallStatus || 'N/A'
          const phases = design_module.phases?.join(', ') || 'N/A'
          const startDate = status_module.startDateStruct?.date || ''
          const completionDate = status_module.completionDateStruct?.date || ''
          const briefSummary = desc_module.briefSummary || ''
          const conditions = conditions_module.conditions?.join(', ') || ''
          const sponsor = sponsor_module.leadSponsor?.name || ''

          let block = `### ${title.slice(0, 150)}\n`
          block += `**NCT ID:** [${nctId}](https://clinicaltrials.gov/study/${nctId})\n`
          block += `**Status:** ${overallStatus} | **Phase:** ${phases}\n`
          if (sponsor) block += `**Sponsor:** ${sponsor}\n`
          if (conditions) block += `**Conditions:** ${conditions}\n`
          if (startDate) block += `**Dates:** ${startDate}${completionDate ? ` → ${completionDate}` : ''}\n`

          if (briefSummary) {
            const truncated = briefSummary.length > 300 ? briefSummary.slice(0, 300) + '...' : briefSummary
            block += `\n> ${truncated}\n`
          }

          output.push(block)
        }

        return output.join('\n---\n')
      } catch (e: any) {
        return `Clinical trials search failed: ${e?.message || e}`
      }
    },
  })

  // ════════════════════════════════════════════════════════════════════════
  // 10. Disease Info (Open Targets)
  // ════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'disease_info',
    description: 'Look up disease information from Open Targets Platform. Returns associated genes, drugs, and therapeutic areas via GraphQL.',
    parameters: {
      disease: { type: 'string', description: 'Disease name (e.g., "lung cancer", "Alzheimer", "diabetes mellitus")', required: true },
    },
    tier: 'free',
    async execute(args) {
      const disease = String(args.disease)

      try {
        // Step 1: Search for disease ID
        const searchQuery = `
          query SearchDisease($q: String!) {
            search(queryString: $q, entityNames: ["disease"], page: { index: 0, size: 3 }) {
              hits {
                id
                entity
                name
                description
              }
              total
            }
          }
        `
        const searchRes = await fetch('https://api.platform.opentargets.org/api/v4/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
          body: JSON.stringify({ query: searchQuery, variables: { q: disease } }),
          signal: AbortSignal.timeout(10000),
        })
        if (!searchRes.ok) return `Open Targets error: HTTP ${searchRes.status}`
        const searchData = await searchRes.json()

        const hits = searchData.data?.search?.hits || []
        const diseaseHits = hits.filter((h: any) => h.entity === 'disease')
        if (diseaseHits.length === 0) return `No disease found for "${disease}" in Open Targets.`

        const output: string[] = [`## Disease Info: "${disease}"\n`]

        for (const hit of diseaseHits.slice(0, 2)) {
          const diseaseId = hit.id

          // Step 2: Get disease details with associations
          const detailQuery = `
            query DiseaseDetail($id: String!) {
              disease(efoId: $id) {
                id
                name
                description
                therapeuticAreas {
                  id
                  name
                }
                synonyms {
                  terms
                  relation
                }
                knownDrugs(size: 10) {
                  uniqueTargetCount
                  uniqueDrugCount
                  rows {
                    drug {
                      id
                      name
                      drugType
                      maximumClinicalTrialPhase
                    }
                    mechanismOfAction
                    approvedIndications
                  }
                }
                associatedTargets(page: { index: 0, size: 10 }) {
                  count
                  rows {
                    target {
                      id
                      approvedSymbol
                      approvedName
                    }
                    score
                    datatypeScores {
                      componentId: id
                      score
                    }
                  }
                }
              }
            }
          `

          const detailRes = await fetch('https://api.platform.opentargets.org/api/v4/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
            body: JSON.stringify({ query: detailQuery, variables: { id: diseaseId } }),
            signal: AbortSignal.timeout(10000),
          })
          if (!detailRes.ok) continue
          const detailData = await detailRes.json()
          const d = detailData.data?.disease
          if (!d) continue

          let block = `### ${d.name}\n`
          block += `**EFO ID:** [${d.id}](https://platform.opentargets.org/disease/${d.id})\n`

          if (d.description) {
            const truncated = d.description.length > 500 ? d.description.slice(0, 500) + '...' : d.description
            block += `\n${truncated}\n`
          }

          // Therapeutic areas
          if (d.therapeuticAreas?.length > 0) {
            block += `\n**Therapeutic Areas:** ${d.therapeuticAreas.map((t: any) => t.name).join(', ')}\n`
          }

          // Synonyms
          if (d.synonyms?.length > 0) {
            const exactSynonyms = d.synonyms
              .filter((s: any) => s.relation === 'HAS_EXACT_SYNONYM')
              .flatMap((s: any) => s.terms || [])
              .slice(0, 8)
            if (exactSynonyms.length > 0) {
              block += `**Synonyms:** ${exactSynonyms.join(', ')}\n`
            }
          }

          // Top associated genes
          const targets = d.associatedTargets
          if (targets?.rows?.length > 0) {
            block += `\n**Top Associated Genes** (${targets.count} total):\n`
            for (const row of targets.rows.slice(0, 8)) {
              const t = row.target
              block += `- **${t.approvedSymbol}** (${t.approvedName}) — score: ${row.score.toFixed(3)}\n`
            }
          }

          // Known drugs
          const drugs = d.knownDrugs
          if (drugs?.rows?.length > 0) {
            block += `\n**Known Drugs** (${drugs.uniqueDrugCount} drugs, ${drugs.uniqueTargetCount} targets):\n`
            const seen = new Set<string>()
            for (const row of drugs.rows) {
              const drugName = row.drug?.name || 'Unknown'
              if (seen.has(drugName)) continue
              seen.add(drugName)
              const phase = row.drug?.maximumClinicalTrialPhase ?? 'N/A'
              const moa = row.mechanismOfAction || ''
              block += `- **${drugName}** (phase ${phase}) — ${moa}\n`
            }
          }

          output.push(block)
        }

        return output.join('\n---\n')
      } catch (e: any) {
        return `Disease info lookup failed: ${e?.message || e}`
      }
    },
  })

  // ════════════════════════════════════════════════════════════════════════
  // 11. Sequence Tools (Local analysis)
  // ════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'sequence_tools',
    description: 'Local sequence analysis tools: GC content, reverse complement, translation (standard genetic code), ORF finding, motif search (regex), and molecular weight calculation. No API calls — runs instantly.',
    parameters: {
      sequence: { type: 'string', description: 'DNA/RNA/protein sequence (raw or FASTA format)', required: true },
      operation: { type: 'string', description: 'Operation: "gc_content", "reverse_complement", "translate", "find_orfs", "motif_search", "molecular_weight"', required: true },
      pattern: { type: 'string', description: 'Regex pattern for motif_search (e.g., "ATG[ATCG]{3,9}TAA")' },
    },
    tier: 'free',
    async execute(args) {
      const rawSeq = String(args.sequence).trim()
      const operation = String(args.operation)
      const pattern = args.pattern ? String(args.pattern) : ''

      // Clean sequence: remove FASTA header, whitespace, numbers
      const seq = rawSeq
        .split('\n')
        .filter(line => !line.startsWith('>'))
        .join('')
        .replace(/[\s\d]/g, '')
        .toUpperCase()

      if (seq.length === 0) return 'No valid sequence provided. Remove FASTA headers and whitespace.'

      const isDna = /^[ATCGN]+$/i.test(seq)
      const isRna = /^[AUCGN]+$/i.test(seq)
      const isProtein = /^[ACDEFGHIKLMNPQRSTVWY*]+$/i.test(seq) && !isDna

      switch (operation) {
        case 'gc_content': {
          if (!isDna && !isRna) return 'GC content requires a DNA or RNA sequence (A, T/U, G, C, N).'
          const gc = (seq.match(/[GC]/gi) || []).length
          const total = seq.replace(/N/gi, '').length
          const pct = total > 0 ? ((gc / total) * 100).toFixed(2) : '0'
          const at = total - gc

          let result = `## GC Content Analysis\n\n`
          result += `**Sequence length:** ${seq.length} bp\n`
          result += `**GC count:** ${gc} | **AT count:** ${at}\n`
          result += `**GC%:** ${pct}%\n`
          result += `**AT%:** ${(100 - parseFloat(pct)).toFixed(2)}%\n`

          // Base composition
          const counts: Record<string, number> = {}
          for (const base of seq) {
            counts[base] = (counts[base] || 0) + 1
          }
          result += `\n**Base composition:**\n`
          for (const [base, count] of Object.entries(counts).sort()) {
            result += `- ${base}: ${count} (${((count / seq.length) * 100).toFixed(1)}%)\n`
          }

          // Tm estimation (basic: 2*(A+T) + 4*(G+C) for short, or 64.9 + 41*(G+C-16.4)/N)
          if (seq.length <= 30) {
            const tm = 2 * at + 4 * gc
            result += `\n**Estimated Tm (basic):** ${tm} C (for primers < 30 bp)\n`
          } else {
            const tm = 64.9 + 41 * (gc - 16.4) / total
            result += `\n**Estimated Tm (salt-adjusted):** ${tm.toFixed(1)} C\n`
          }

          return result
        }

        case 'reverse_complement': {
          if (!isDna && !isRna) return 'Reverse complement requires a DNA or RNA sequence.'

          const complementMap: Record<string, string> = isDna
            ? { A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' }
            : { A: 'U', U: 'A', G: 'C', C: 'G', N: 'N' }

          const complement = seq.split('').map(b => complementMap[b] || 'N').join('')
          const revComp = complement.split('').reverse().join('')

          let result = `## Reverse Complement\n\n`
          result += `**Input (${isDna ? 'DNA' : 'RNA'}, ${seq.length} bp):**\n`
          result += `5'-\`${seq.length > 80 ? seq.slice(0, 40) + '...' + seq.slice(-40) : seq}\`-3'\n\n`
          result += `**Complement:**\n`
          result += `3'-\`${complement.length > 80 ? complement.slice(0, 40) + '...' + complement.slice(-40) : complement}\`-5'\n\n`
          result += `**Reverse complement:**\n`
          result += `5'-\`${revComp.length > 80 ? revComp.slice(0, 40) + '...' + revComp.slice(-40) : revComp}\`-3'\n`

          return result
        }

        case 'translate': {
          let dnaSeq = seq
          if (isRna) dnaSeq = seq.replace(/U/g, 'T')
          if (!(/^[ATCGN]+$/i.test(dnaSeq))) return 'Translation requires a DNA or RNA sequence.'

          // Translate all 3 reading frames
          const results: string[] = [`## Translation (Standard Genetic Code)\n`]
          results.push(`**Input:** ${dnaSeq.length} bp\n`)

          for (let frame = 0; frame < 3; frame++) {
            const protein: string[] = []
            for (let i = frame; i + 2 < dnaSeq.length; i += 3) {
              const codon = dnaSeq.slice(i, i + 3)
              if (codon.includes('N')) {
                protein.push('X')
              } else {
                protein.push(CODON_TABLE[codon] || 'X')
              }
            }
            const proteinStr = protein.join('')
            results.push(`**Frame +${frame + 1}:**`)
            results.push(`\`${proteinStr.length > 120 ? proteinStr.slice(0, 60) + '...' + proteinStr.slice(-60) : proteinStr}\``)
            results.push(`(${proteinStr.length} aa, ${(proteinStr.match(/\*/g) || []).length} stop codons)\n`)
          }

          // Highlight first ORF in frame +1
          const frame1 = []
          for (let i = 0; i + 2 < dnaSeq.length; i += 3) {
            const codon = dnaSeq.slice(i, i + 3)
            frame1.push(codon.includes('N') ? 'X' : (CODON_TABLE[codon] || 'X'))
          }
          const protStr = frame1.join('')
          const orfMatch = protStr.match(/M[^*]+/)
          if (orfMatch) {
            results.push(`**Longest ORF (frame +1):** ${orfMatch[0].length} aa starting at M`)
            results.push(`\`${orfMatch[0].slice(0, 80)}${orfMatch[0].length > 80 ? '...' : ''}\``)
          }

          return results.join('\n')
        }

        case 'find_orfs': {
          let dnaSeq = seq
          if (isRna) dnaSeq = seq.replace(/U/g, 'T')
          if (!(/^[ATCGN]+$/i.test(dnaSeq))) return 'ORF finding requires a DNA or RNA sequence.'

          const minOrfLength = 30 // minimum 30 aa = 90 bp

          const orfs: Array<{ frame: number; start: number; end: number; length: number; protein: string }> = []

          // Search all 3 forward frames
          for (let frame = 0; frame < 3; frame++) {
            const protein: string[] = []
            for (let i = frame; i + 2 < dnaSeq.length; i += 3) {
              const codon = dnaSeq.slice(i, i + 3)
              protein.push(codon.includes('N') ? 'X' : (CODON_TABLE[codon] || 'X'))
            }
            const protStr = protein.join('')

            // Find all M...* ORFs
            const orfRe = /M[^*]*/g
            let m: RegExpExecArray | null
            while ((m = orfRe.exec(protStr)) !== null) {
              if (m[0].length >= minOrfLength) {
                const aaStart = m.index
                orfs.push({
                  frame: frame + 1,
                  start: frame + aaStart * 3 + 1, // 1-based nucleotide position
                  end: frame + (aaStart + m[0].length) * 3,
                  length: m[0].length,
                  protein: m[0],
                })
              }
            }
          }

          // Also search reverse complement
          const compMap: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' }
          const rcSeq = dnaSeq.split('').map(b => compMap[b] || 'N').reverse().join('')

          for (let frame = 0; frame < 3; frame++) {
            const protein: string[] = []
            for (let i = frame; i + 2 < rcSeq.length; i += 3) {
              const codon = rcSeq.slice(i, i + 3)
              protein.push(codon.includes('N') ? 'X' : (CODON_TABLE[codon] || 'X'))
            }
            const protStr = protein.join('')

            const orfRe = /M[^*]*/g
            let m: RegExpExecArray | null
            while ((m = orfRe.exec(protStr)) !== null) {
              if (m[0].length >= minOrfLength) {
                const aaStart = m.index
                orfs.push({
                  frame: -(frame + 1),
                  start: dnaSeq.length - (frame + (aaStart + m[0].length) * 3) + 1,
                  end: dnaSeq.length - (frame + aaStart * 3),
                  length: m[0].length,
                  protein: m[0],
                })
              }
            }
          }

          // Sort by length descending
          orfs.sort((a, b) => b.length - a.length)

          let result = `## Open Reading Frames (min 30 aa)\n\n`
          result += `**Sequence length:** ${dnaSeq.length} bp\n`
          result += `**ORFs found:** ${orfs.length}\n\n`

          if (orfs.length === 0) {
            result += 'No ORFs >= 30 aa found. Try a longer sequence or lower threshold.\n'
          } else {
            for (const orf of orfs.slice(0, 15)) {
              result += `**Frame ${orf.frame > 0 ? '+' : ''}${orf.frame}** | nt ${orf.start}-${orf.end} | **${orf.length} aa** (${orf.length * 3} bp)\n`
              result += `\`${orf.protein.slice(0, 60)}${orf.protein.length > 60 ? '...' : ''}\`\n\n`
            }
          }

          return result
        }

        case 'motif_search': {
          if (!pattern) return 'Motif search requires a pattern parameter (regex). Example: "ATG[ATCG]{3,9}TAA"'

          let re: RegExp
          try {
            re = new RegExp(pattern, 'gi')
          } catch (err: any) {
            return `Invalid regex pattern: ${err?.message || err}`
          }

          const matches: Array<{ start: number; end: number; match: string }> = []
          let m: RegExpExecArray | null
          while ((m = re.exec(seq)) !== null) {
            matches.push({ start: m.index + 1, end: m.index + m[0].length, match: m[0] })
            // Prevent infinite loop on zero-length matches
            if (m[0].length === 0) re.lastIndex++
          }

          let result = `## Motif Search\n\n`
          result += `**Pattern:** \`${pattern}\`\n`
          result += `**Sequence length:** ${seq.length}\n`
          result += `**Matches found:** ${matches.length}\n\n`

          if (matches.length === 0) {
            result += 'No matches found.\n'
          } else {
            for (const match of matches.slice(0, 50)) {
              const display = match.match.length > 60 ? match.match.slice(0, 60) + '...' : match.match
              result += `- **Position ${match.start}-${match.end}:** \`${display}\`\n`
            }
            if (matches.length > 50) result += `\n... and ${matches.length - 50} more matches.\n`
          }

          return result
        }

        case 'molecular_weight': {
          let result = `## Molecular Weight\n\n`
          result += `**Sequence length:** ${seq.length}\n`

          if (isProtein) {
            // Protein MW: sum of AA weights - (n-1) * water (18.02)
            let mw = 0
            let unknowns = 0
            for (const aa of seq) {
              if (aa === '*') continue // stop codon
              if (AA_WEIGHTS[aa]) {
                mw += AA_WEIGHTS[aa]
              } else {
                unknowns++
                mw += 128.16 // average AA weight
              }
            }
            // Subtract water for peptide bonds
            const aas = seq.replace(/\*/g, '').length
            mw -= (aas - 1) * 18.02

            result += `**Type:** Protein (${aas} amino acids)\n`
            result += `**Molecular Weight:** ${mw.toFixed(2)} Da (${(mw / 1000).toFixed(2)} kDa)\n`
            if (unknowns > 0) result += `*Note: ${unknowns} unknown residues estimated at 128.16 Da (average)*\n`

            // Extinction coefficient estimate (Pace method)
            const nTrp = (seq.match(/W/g) || []).length
            const nTyr = (seq.match(/Y/g) || []).length
            const nCys = (seq.match(/C/g) || []).length
            const e280 = nTrp * 5500 + nTyr * 1490 + nCys * 125
            result += `\n**Extinction coefficient (280nm):** ${e280} M\u207B\u00B9cm\u207B\u00B9\n`
            result += `(${nTrp} Trp, ${nTyr} Tyr, ${nCys} Cys)\n`

            // Isoelectric point estimate (very rough)
            const nAsp = (seq.match(/D/g) || []).length
            const nGlu = (seq.match(/E/g) || []).length
            const nHis = (seq.match(/H/g) || []).length
            const nLys = (seq.match(/K/g) || []).length
            const nArg = (seq.match(/R/g) || []).length
            const negCharge = nAsp + nGlu
            const posCharge = nHis + nLys + nArg
            result += `\n**Charge residues:** ${posCharge} positive (K:${nLys} R:${nArg} H:${nHis}), ${negCharge} negative (D:${nAsp} E:${nGlu})\n`
          } else if (isDna || isRna) {
            // Nucleic acid MW
            const weights = isDna ? DNA_WEIGHTS : { A: 347.2, U: 324.2, G: 363.2, C: 323.2 }
            let mw = 0
            for (const base of seq) {
              mw += (weights as Record<string, number>)[base] || 330 // average for N
            }
            // Subtract water for phosphodiester bonds, add 5' phosphate
            mw -= (seq.length - 1) * 18.02

            result += `**Type:** ${isDna ? 'DNA' : 'RNA'} (${seq.length} ${isDna ? 'bp' : 'nt'})\n`
            result += `**Molecular Weight (ss):** ${mw.toFixed(2)} Da (${(mw / 1000).toFixed(2)} kDa)\n`
            if (isDna) {
              result += `**Molecular Weight (ds):** ~${(mw * 2).toFixed(0)} Da (${((mw * 2) / 1000).toFixed(2)} kDa)\n`
            }

            // Concentration conversion
            const ugPerOd = isDna ? (seq.length < 25 ? 33 : 50) : 40
            result += `\n**1 OD260 =** ~${ugPerOd} ug/mL\n`
          } else {
            result += 'Could not determine sequence type (DNA/RNA/protein). Check for invalid characters.\n'
          }

          return result
        }

        default:
          return `Unknown operation: "${operation}". Supported: gc_content, reverse_complement, translate, find_orfs, motif_search, molecular_weight`
      }
    },
  })

  // ════════════════════════════════════════════════════════════════════════
  // 12. Ecology Data (GBIF Occurrences)
  // ════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'ecology_data',
    description: 'Search GBIF for biodiversity occurrence records. Find species observations with location, date, and collection data.',
    parameters: {
      species: { type: 'string', description: 'Scientific name (e.g., "Panthera tigris", "Quercus robur")', required: true },
      country: { type: 'string', description: 'ISO 3166-1 alpha-2 country code (e.g., "US", "BR", "AU")' },
      limit: { type: 'number', description: 'Max records (default 20, max 100)' },
    },
    tier: 'free',
    async execute(args) {
      const species = String(args.species)
      const country = args.country ? String(args.country).toUpperCase() : ''
      const limit = Math.min(typeof args.limit === 'number' ? args.limit : 20, 100)

      try {
        let url = `https://api.gbif.org/v1/occurrence/search?scientificName=${encodeURIComponent(species)}&limit=${limit}&hasCoordinate=true`
        if (country) url += `&country=${country}`

        const res = await fetch(url, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return `GBIF error: HTTP ${res.status}`
        const data = await res.json()
        const results_arr = data.results || []
        const totalCount = data.count || 0

        if (results_arr.length === 0) return `No GBIF occurrence records for "${species}"${country ? ` in ${country}` : ''}. Try the full scientific name.`

        const output: string[] = [`## GBIF Occurrences: *${species}*\n`]
        output.push(`**Total records:** ${totalCount.toLocaleString()}${country ? ` (filtered: ${country})` : ''}\n`)

        // Summary stats
        const countries = new Map<string, number>()
        const years = new Map<number, number>()
        const basisOfRecord = new Map<string, number>()

        for (const rec of results_arr) {
          const c = rec.country || 'Unknown'
          countries.set(c, (countries.get(c) || 0) + 1)
          if (rec.year) years.set(rec.year, (years.get(rec.year) || 0) + 1)
          const basis = rec.basisOfRecord || 'Unknown'
          basisOfRecord.set(basis, (basisOfRecord.get(basis) || 0) + 1)
        }

        // Country distribution
        const sortedCountries = [...countries.entries()].sort((a, b) => b[1] - a[1])
        output.push(`**Countries in sample:** ${sortedCountries.map(([c, n]) => `${c} (${n})`).join(', ')}\n`)

        // Record types
        output.push(`**Record types:** ${[...basisOfRecord.entries()].map(([t, n]) => `${t.replace(/_/g, ' ')} (${n})`).join(', ')}\n`)

        // Year range
        const yearKeys = [...years.keys()].sort()
        if (yearKeys.length > 0) {
          output.push(`**Year range:** ${yearKeys[0]}–${yearKeys[yearKeys.length - 1]}\n`)
        }

        // Individual records
        output.push('\n### Records\n')

        for (const rec of results_arr.slice(0, 20)) {
          const name = rec.species || rec.scientificName || species
          const lat = rec.decimalLatitude?.toFixed(4) || '?'
          const lon = rec.decimalLongitude?.toFixed(4) || '?'
          const date = rec.eventDate || rec.year || 'N/A'
          const loc = rec.locality || rec.stateProvince || ''
          const countryName = rec.country || ''
          const institution = rec.institutionCode || ''
          const basis = rec.basisOfRecord?.replace(/_/g, ' ') || ''

          let line = `- **${name}** — ${lat}, ${lon}`
          if (countryName) line += ` (${countryName}${loc ? `, ${loc}` : ''})`
          if (date) line += ` | ${date}`
          if (basis) line += ` | ${basis}`
          if (institution) line += ` | ${institution}`
          if (rec.gbifID) line += ` | [GBIF:${rec.gbifID}](https://www.gbif.org/occurrence/${rec.gbifID})`

          output.push(line)
        }

        return output.join('\n')
      } catch (e: any) {
        return `Ecology data lookup failed: ${e?.message || e}`
      }
    },
  })
}
