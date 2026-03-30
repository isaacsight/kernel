// kbot init — Science project templates
//
// When `kbot init` detects a scientific project (Python with numpy/scipy,
// R, Jupyter notebooks, etc.), this module selects and applies the right
// template: pre-configured tools, recommended specialist agent, notebook
// integration, and data format handling.
//
// Usage: called automatically from initProject() when science signals are found.
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
// ── Templates ──
export const SCIENCE_TEMPLATES = [
    {
        id: 'data-science',
        name: 'Data Science',
        description: 'Data analysis, machine learning, and visualization with Python',
        detectors: ['*.csv', '*.parquet', '*.feather', 'notebooks/*.ipynb', 'data/**'],
        packages: [
            'pandas', 'scikit-learn', 'sklearn', 'matplotlib', 'seaborn',
            'plotly', 'bokeh', 'altair', 'polars', 'dask', 'xgboost',
            'lightgbm', 'catboost', 'tensorflow', 'torch', 'keras',
        ],
        tools: [
            'csv_read', 'csv_write', 'csv_query', 'data_transform', 'data_query',
            'render_chart', 'viz_codegen', 'statistical_analysis', 'regression_analysis',
            'dimensionality_reduce', 'notebook_create', 'notebook_edit',
        ],
        agent: 'quant',
        notebookSetup: true,
        dataFormats: ['csv', 'parquet', 'feather', 'json', 'xlsx', 'hdf5'],
    },
    {
        id: 'bioinformatics',
        name: 'Bioinformatics',
        description: 'Genomics, proteomics, and computational biology',
        detectors: ['*.fasta', '*.fastq', '*.bam', '*.vcf', '*.gff', '*.pdb', '*.sam'],
        packages: [
            'biopython', 'Bio', 'pysam', 'pyvcf', 'scanpy', 'anndata',
            'bioconductor', 'deseq2', 'edger', 'seurat', 'cellranger',
            'samtools', 'bcftools', 'blast', 'hmmer',
        ],
        tools: [
            'blast_search', 'gene_lookup', 'protein_search', 'protein_structure',
            'genomic_analysis', 'sequence_tools', 'pathway_search', 'taxonomy_lookup',
            'pubmed_search', 'notebook_create', 'notebook_edit',
        ],
        agent: 'quant',
        notebookSetup: true,
        dataFormats: ['fasta', 'fastq', 'bam', 'vcf', 'gff3', 'pdb', 'bed'],
    },
    {
        id: 'physics-engineering',
        name: 'Physics / Engineering',
        description: 'Numerical simulation, signal processing, and engineering analysis',
        detectors: ['*.mat', '*.hdf5', '*.h5', '*.npy', '*.npz'],
        packages: [
            'scipy', 'sympy', 'numpy', 'numba', 'fenics', 'fipy', 'pint',
            'astropy', 'lmfit', 'emcee', 'pymc', 'openmdao', 'cantera',
            'pyvista', 'vtk', 'gmsh',
        ],
        tools: [
            'formula_solve', 'symbolic_compute', 'differential_eq', 'fourier_analysis',
            'signal_process', 'optimization_solve', 'matrix_operations', 'unit_convert',
            'physical_constants', 'beam_analysis', 'circuit_analyze', 'electromagnetic_calc',
            'fluid_dynamics', 'thermodynamics_data', 'notebook_create', 'notebook_edit',
        ],
        agent: 'quant',
        notebookSetup: true,
        dataFormats: ['hdf5', 'mat', 'npy', 'npz', 'csv', 'fits'],
    },
    {
        id: 'chemistry',
        name: 'Chemistry',
        description: 'Computational chemistry, cheminformatics, and molecular modeling',
        detectors: ['*.mol', '*.mol2', '*.sdf', '*.xyz', '*.cif', '*.pdb'],
        packages: [
            'rdkit', 'openbabel', 'pymatgen', 'ase', 'cclib', 'psi4',
            'mdanalysis', 'nglview', 'py3Dmol', 'chempy', 'mendeleev',
        ],
        tools: [
            'compound_search', 'compound_properties', 'reaction_lookup', 'element_info',
            'stoichiometry_calc', 'crystal_structure', 'material_properties',
            'spectroscopy_lookup', 'chemical_safety', 'notebook_create', 'notebook_edit',
        ],
        agent: 'quant',
        notebookSetup: true,
        dataFormats: ['mol', 'mol2', 'sdf', 'xyz', 'cif', 'pdb', 'cube'],
    },
    {
        id: 'neuroscience',
        name: 'Neuroscience',
        description: 'Brain imaging, EEG/MEG analysis, and computational neuroscience',
        detectors: ['*.edf', '*.bdf', '*.set', '*.fif', '*.nii', '*.nii.gz'],
        packages: [
            'mne', 'nilearn', 'nibabel', 'brian2', 'neo', 'elephant',
            'neuron', 'nest', 'pynwb', 'allensdk', 'dipy', 'nipype',
            'psychopy', 'expyriment',
        ],
        tools: [
            'eeg_analyze', 'brain_atlas', 'brain_predict', 'neuroimaging_coords',
            'connectome_query', 'neurotransmitter_lookup', 'neural_network_bio',
            'cognitive_model', 'cognitive_task_design', 'psychophysics_calc',
            'notebook_create', 'notebook_edit',
        ],
        agent: 'quant',
        notebookSetup: true,
        dataFormats: ['edf', 'bdf', 'fif', 'nii', 'nii.gz', 'nwb', 'set'],
    },
    {
        id: 'climate-earth',
        name: 'Climate / Earth Science',
        description: 'Climate modeling, geospatial analysis, and environmental data',
        detectors: ['*.nc', '*.nc4', '*.grib', '*.grib2', '*.tif', '*.geotiff', '*.shp'],
        packages: [
            'xarray', 'netCDF4', 'cartopy', 'rasterio', 'geopandas', 'shapely',
            'fiona', 'pyproj', 'iris', 'cfgrib', 'metpy', 'wrf-python',
            'salem', 'regionmask', 'verde',
        ],
        tools: [
            'climate_data', 'ocean_data', 'earthquake_query', 'geological_query',
            'satellite_imagery', 'soil_data', 'water_resources', 'volcano_monitor',
            'environmental_assessment', 'biodiversity_index', 'ecology_data',
            'notebook_create', 'notebook_edit',
        ],
        agent: 'quant',
        notebookSetup: true,
        dataFormats: ['nc', 'nc4', 'grib', 'geotiff', 'shp', 'geojson', 'zarr'],
    },
    {
        id: 'social-science',
        name: 'Social Science',
        description: 'Statistical modeling, network analysis, and survey research',
        detectors: ['*.sav', '*.dta', '*.sas7bdat', '*.por'],
        packages: [
            'statsmodels', 'networkx', 'igraph', 'pymc', 'arviz', 'lifelines',
            'linearmodels', 'pingouin', 'factor_analyzer', 'semopy',
            'textblob', 'nltk', 'spacy', 'gensim',
        ],
        tools: [
            'statistical_analysis', 'regression_analysis', 'hypothesis_test',
            'bayesian_inference', 'causal_inference', 'survival_analysis',
            'social_network_analyze', 'sentiment_analyze', 'discourse_analyze',
            'survey_design', 'demographic_model', 'inequality_metrics',
            'effect_size_calc', 'power_analysis', 'notebook_create', 'notebook_edit',
        ],
        agent: 'quant',
        notebookSetup: true,
        dataFormats: ['csv', 'sav', 'dta', 'xlsx', 'json', 'sas7bdat'],
    },
    {
        id: 'r-statistical',
        name: 'R Statistical',
        description: 'Statistical computing and graphics with R',
        detectors: ['*.R', '*.r', '*.Rmd', '*.rmd', '*.Rproj', 'DESCRIPTION', 'NAMESPACE'],
        packages: [
            'tidyverse', 'ggplot2', 'dplyr', 'tidyr', 'readr', 'purrr',
            'shiny', 'rmarkdown', 'knitr', 'lme4', 'brms', 'stan',
            'caret', 'mlr3', 'survival', 'lavaan',
        ],
        tools: [
            'statistical_analysis', 'regression_analysis', 'hypothesis_test',
            'anova_test', 'bayesian_inference', 'distribution_fit', 'correlation_matrix',
            'time_series_analyze', 'render_chart', 'cran_search',
            'notebook_create', 'notebook_edit',
        ],
        agent: 'quant',
        notebookSetup: true,
        dataFormats: ['csv', 'rds', 'rda', 'xlsx', 'sav', 'dta', 'feather'],
    },
    {
        id: 'jupyter-notebook',
        name: 'Jupyter Notebook',
        description: 'General Jupyter notebook project with interactive computing',
        detectors: ['*.ipynb', 'jupyter_notebook_config.py', '.jupyter/**'],
        packages: [
            'jupyter', 'jupyterlab', 'notebook', 'ipykernel', 'ipywidgets',
            'nbformat', 'nbconvert', 'papermill', 'voila',
        ],
        tools: [
            'notebook_create', 'notebook_edit', 'notebook_read', 'notebook_view',
            'notebook_export', 'notebook_insert', 'notebook_search',
            'notebook_cite', 'notebook_provenance', 'render_chart',
            'pip_run', 'csv_read',
        ],
        agent: 'kernel',
        notebookSetup: true,
        dataFormats: ['ipynb', 'csv', 'json', 'xlsx'],
    },
];
// ── Detection ──
/** Read requirements.txt, setup.py, pyproject.toml, or environment.yml for package names */
function readPythonPackages(projectDir) {
    const packages = [];
    // requirements.txt (and variants)
    const reqFiles = ['requirements.txt', 'requirements-dev.txt', 'requirements_dev.txt'];
    for (const reqFile of reqFiles) {
        const reqPath = join(projectDir, reqFile);
        if (existsSync(reqPath)) {
            try {
                const content = readFileSync(reqPath, 'utf8');
                for (const line of content.split('\n')) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
                        // Extract package name (before ==, >=, <=, ~=, !=, [)
                        const match = trimmed.match(/^([a-zA-Z0-9_-]+)/);
                        if (match)
                            packages.push(match[1].toLowerCase());
                    }
                }
            }
            catch { /* ignore unreadable files */ }
        }
    }
    // pyproject.toml dependencies
    const pyprojectPath = join(projectDir, 'pyproject.toml');
    if (existsSync(pyprojectPath)) {
        try {
            const content = readFileSync(pyprojectPath, 'utf8');
            // Match dependencies = ["package1", "package2>=1.0"]
            const depBlock = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/m);
            if (depBlock) {
                const deps = depBlock[1].matchAll(/"([a-zA-Z0-9_-]+)/g);
                for (const dep of deps) {
                    packages.push(dep[1].toLowerCase());
                }
            }
        }
        catch { /* ignore */ }
    }
    // setup.py install_requires
    const setupPath = join(projectDir, 'setup.py');
    if (existsSync(setupPath)) {
        try {
            const content = readFileSync(setupPath, 'utf8');
            const deps = content.matchAll(/['"]([a-zA-Z0-9_-]+)/g);
            for (const dep of deps) {
                packages.push(dep[1].toLowerCase());
            }
        }
        catch { /* ignore */ }
    }
    // environment.yml (conda)
    const condaPath = join(projectDir, 'environment.yml');
    if (existsSync(condaPath)) {
        try {
            const content = readFileSync(condaPath, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
                const match = line.match(/^\s*-\s*([a-zA-Z0-9_-]+)/);
                if (match)
                    packages.push(match[1].toLowerCase());
            }
        }
        catch { /* ignore */ }
    }
    return [...new Set(packages)];
}
/** Read R package dependencies from DESCRIPTION file or scripts */
function readRPackages(projectDir) {
    const packages = [];
    // DESCRIPTION file (R package)
    const descPath = join(projectDir, 'DESCRIPTION');
    if (existsSync(descPath)) {
        try {
            const content = readFileSync(descPath, 'utf8');
            const depSection = content.match(/(?:Imports|Depends|Suggests):\s*([\s\S]*?)(?:\n\S|$)/g);
            if (depSection) {
                for (const section of depSection) {
                    const pkgs = section.matchAll(/([a-zA-Z][a-zA-Z0-9.]+)/g);
                    for (const pkg of pkgs) {
                        if (!['Imports', 'Depends', 'Suggests'].includes(pkg[1])) {
                            packages.push(pkg[1].toLowerCase());
                        }
                    }
                }
            }
        }
        catch { /* ignore */ }
    }
    // Scan .R files for library() calls (top-level only, limit to 10 files)
    try {
        const entries = readdirSync(projectDir);
        let scanned = 0;
        for (const entry of entries) {
            if (scanned >= 10)
                break;
            if (entry.endsWith('.R') || entry.endsWith('.r') || entry.endsWith('.Rmd') || entry.endsWith('.rmd')) {
                scanned++;
                try {
                    const content = readFileSync(join(projectDir, entry), 'utf8');
                    const libs = content.matchAll(/(?:library|require)\s*\(\s*["']?([a-zA-Z][a-zA-Z0-9.]+)["']?\s*\)/g);
                    for (const lib of libs) {
                        packages.push(lib[1].toLowerCase());
                    }
                }
                catch { /* ignore */ }
            }
        }
    }
    catch { /* ignore */ }
    return [...new Set(packages)];
}
/** Check if specific file patterns exist in the project */
function hasFilePatterns(projectDir, patterns) {
    try {
        const entries = readdirSync(projectDir);
        for (const pattern of patterns) {
            // Simple extension matching (not full glob)
            if (pattern.startsWith('*.')) {
                const ext = pattern.slice(1); // e.g., ".ipynb"
                if (entries.some(e => e.endsWith(ext)))
                    return true;
            }
            // Direct file match
            if (entries.includes(pattern))
                return true;
        }
    }
    catch { /* ignore */ }
    // Also check common subdirectories
    const subDirs = ['notebooks', 'data', 'src', 'scripts', 'analysis'];
    for (const sub of subDirs) {
        const subPath = join(projectDir, sub);
        try {
            const entries = readdirSync(subPath);
            for (const pattern of patterns) {
                if (pattern.startsWith('*.')) {
                    const ext = pattern.slice(1);
                    if (entries.some(e => e.endsWith(ext)))
                        return true;
                }
            }
        }
        catch { /* directory doesn't exist */ }
    }
    return false;
}
/** Score a template against detected packages and files */
function scoreTemplate(template, packages, projectDir) {
    let score = 0;
    // Package matches (each match = 2 points)
    for (const pkg of template.packages) {
        if (packages.includes(pkg.toLowerCase())) {
            score += 2;
        }
    }
    // File pattern matches (each match = 3 points — strong signal)
    if (hasFilePatterns(projectDir, template.detectors)) {
        score += 3;
    }
    return score;
}
/**
 * Detect if the project is a scientific project and return the best-matching template.
 *
 * Returns `null` if no science template scores above the threshold.
 * Requires at least 2 package matches OR 1 file pattern match to activate.
 */
export function detectScienceProject(projectDir) {
    const pythonPkgs = readPythonPackages(projectDir);
    const rPkgs = readRPackages(projectDir);
    const allPkgs = [...pythonPkgs, ...rPkgs];
    let bestTemplate = null;
    let bestScore = 0;
    for (const template of SCIENCE_TEMPLATES) {
        const score = scoreTemplate(template, allPkgs, projectDir);
        if (score > bestScore) {
            bestScore = score;
            bestTemplate = template;
        }
    }
    // Minimum threshold: at least 3 points (1 file pattern match or 2 package matches)
    if (bestScore < 3)
        return null;
    return bestTemplate;
}
/**
 * Apply a science template to a project directory.
 *
 * Creates a `.kbot/science.json` config with the template settings,
 * pre-configures notebook integration if needed, and writes a
 * `.kbot/tools.json` with the recommended tool list.
 */
export function applyScienceTemplate(template, projectDir) {
    const kbotDir = join(projectDir, '.kbot');
    if (!existsSync(kbotDir))
        mkdirSync(kbotDir, { recursive: true });
    // Write science template config
    const scienceConfig = {
        template: template.id,
        name: template.name,
        description: template.description,
        agent: template.agent,
        tools: template.tools,
        dataFormats: template.dataFormats || [],
        notebookSetup: template.notebookSetup || false,
        appliedAt: new Date().toISOString(),
    };
    writeFileSync(join(kbotDir, 'science.json'), JSON.stringify(scienceConfig, null, 2));
    // Write recommended tools list
    const toolsConfig = {
        enabled: template.tools,
        source: `science-template:${template.id}`,
    };
    const toolsPath = join(kbotDir, 'tools.json');
    if (existsSync(toolsPath)) {
        // Merge with existing tools config
        try {
            const existing = JSON.parse(readFileSync(toolsPath, 'utf8'));
            const merged = [...new Set([...(existing.enabled || []), ...template.tools])];
            writeFileSync(toolsPath, JSON.stringify({ ...existing, enabled: merged }, null, 2));
        }
        catch {
            writeFileSync(toolsPath, JSON.stringify(toolsConfig, null, 2));
        }
    }
    else {
        writeFileSync(toolsPath, JSON.stringify(toolsConfig, null, 2));
    }
    // Configure notebook integration
    if (template.notebookSetup) {
        const notebookConfig = {
            enabled: true,
            autoDetect: true,
            kernelHint: template.id === 'r-statistical' ? 'ir' : 'python3',
            dataFormats: template.dataFormats || [],
        };
        writeFileSync(join(kbotDir, 'notebook.json'), JSON.stringify(notebookConfig, null, 2));
    }
    // Write a .kbot.md with science-specific guidance
    const kbotMdPath = join(projectDir, '.kbot.md');
    if (!existsSync(kbotMdPath)) {
        const guidance = [
            `# ${template.name} Project`,
            '',
            `This project has been configured with the **${template.name}** science template.`,
            '',
            `## Recommended Agent`,
            `Use the \`${template.agent}\` specialist for best results.`,
            '',
            `## Pre-configured Tools`,
            ...template.tools.map(t => `- \`${t}\``),
            '',
            `## Data Formats`,
            ...(template.dataFormats || []).map(f => `- \`.${f}\``),
            '',
            `## Tips`,
            `- Use \`kbot "analyze this dataset"\` to get started with data analysis`,
            `- Use \`kbot notebook create\` to scaffold a new notebook`,
            `- kbot will auto-detect data files and suggest appropriate tools`,
            '',
        ];
        writeFileSync(kbotMdPath, guidance.join('\n'));
    }
}
/** List all available science templates */
export function listScienceTemplates() {
    return [...SCIENCE_TEMPLATES];
}
/**
 * Format a science template detection result for the init report.
 */
export function formatScienceReport(template) {
    const lines = [];
    lines.push(`  Science:    ${template.name}`);
    lines.push(`  Domain:     ${template.description}`);
    lines.push(`  Agent:      ${template.agent}`);
    lines.push(`  Tools:      ${template.tools.length} pre-configured`);
    if (template.dataFormats && template.dataFormats.length > 0) {
        lines.push(`  Data:       ${template.dataFormats.join(', ')}`);
    }
    if (template.notebookSetup) {
        lines.push(`  Notebooks:  auto-configured`);
    }
    return lines.join('\n');
}
//# sourceMappingURL=init-science.js.map