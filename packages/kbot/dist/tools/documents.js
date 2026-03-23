// kbot Document Tools — CSV, JSON, YAML, Markdown, PDF processing
//
// Zero-dependency document tools for strategists, creators, and analysts.
// Parse, transform, query, and generate documents from the terminal.
import { registerTool } from './index.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
// ── CSV Parser (zero-dependency) ──
function parseCSV(text, delimiter = ',') {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length === 0)
        return { headers: [], rows: [] };
    const parseLine = (line) => {
        const cells = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                }
                else
                    inQuotes = !inQuotes;
            }
            else if (ch === delimiter && !inQuotes) {
                cells.push(current.trim());
                current = '';
            }
            else {
                current += ch;
            }
        }
        cells.push(current.trim());
        return cells;
    };
    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine);
    return { headers, rows };
}
function toCSV(headers, rows, delimiter = ',') {
    const escape = (cell) => {
        if (cell.includes(delimiter) || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
    };
    const lines = [headers.map(escape).join(delimiter)];
    for (const row of rows) {
        lines.push(row.map(escape).join(delimiter));
    }
    return lines.join('\n');
}
// ── Markdown Table Generator ──
function toMarkdownTable(headers, rows) {
    const widths = headers.map((h, i) => {
        const maxData = rows.reduce((max, r) => Math.max(max, (r[i] || '').length), 0);
        return Math.max(h.length, maxData, 3);
    });
    const pad = (s, w) => s.padEnd(w);
    const headerLine = '| ' + headers.map((h, i) => pad(h, widths[i])).join(' | ') + ' |';
    const sepLine = '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |';
    const dataLines = rows.map(r => '| ' + headers.map((_, i) => pad(r[i] || '', widths[i])).join(' | ') + ' |');
    return [headerLine, sepLine, ...dataLines].join('\n');
}
export function registerDocumentTools() {
    // ── CSV Read ──
    registerTool({
        name: 'csv_read',
        description: 'Read and parse a CSV file. Returns data as a formatted table with summary statistics. Supports custom delimiters (comma, tab, semicolon, pipe).',
        parameters: {
            path: { type: 'string', description: 'Path to CSV file', required: true },
            delimiter: { type: 'string', description: 'Delimiter character (default: ","). Use "\\t" for TSV.' },
            limit: { type: 'number', description: 'Max rows to display (default: 50)' },
        },
        tier: 'free',
        async execute(args) {
            const filePath = join(process.cwd(), String(args.path));
            if (!existsSync(filePath))
                return `File not found: ${args.path}`;
            const text = readFileSync(filePath, 'utf-8');
            const delim = String(args.delimiter || ',').replace('\\t', '\t');
            const { headers, rows } = parseCSV(text, delim);
            const limit = Number(args.limit) || 50;
            const display = rows.slice(0, limit);
            const table = toMarkdownTable(headers, display);
            const stats = [`**${args.path}** — ${rows.length} rows, ${headers.length} columns`];
            if (rows.length > limit)
                stats.push(`(showing first ${limit} rows)`);
            stats.push(`\nHeaders: ${headers.join(', ')}`);
            return stats.join('\n') + '\n\n' + table;
        },
    });
    // ── CSV Query ──
    registerTool({
        name: 'csv_query',
        description: 'Query a CSV file with simple filters. Filter rows by column values, select specific columns, sort, and compute basic stats (sum, avg, min, max, count).',
        parameters: {
            path: { type: 'string', description: 'Path to CSV file', required: true },
            filter: { type: 'string', description: 'Filter expression (e.g., "status=active", "age>30", "name~john")' },
            columns: { type: 'string', description: 'Comma-separated column names to select' },
            sort: { type: 'string', description: 'Column to sort by (prefix with - for descending)' },
            stats: { type: 'string', description: 'Compute stats: "sum:column", "avg:column", "min:column", "max:column", "count"' },
            limit: { type: 'number', description: 'Max rows to return (default: 100)' },
        },
        tier: 'free',
        async execute(args) {
            const filePath = join(process.cwd(), String(args.path));
            if (!existsSync(filePath))
                return `File not found: ${args.path}`;
            const text = readFileSync(filePath, 'utf-8');
            const { headers, rows } = parseCSV(text);
            let filtered = rows.map(r => r);
            // Filter
            if (args.filter) {
                const filterStr = String(args.filter);
                const match = filterStr.match(/^(\w+)(=|!=|>|<|>=|<=|~)(.+)$/);
                if (match) {
                    const [, col, op, val] = match;
                    const idx = headers.indexOf(col);
                    if (idx < 0)
                        return `Column not found: ${col}. Available: ${headers.join(', ')}`;
                    filtered = filtered.filter(row => {
                        const cell = row[idx] || '';
                        const numCell = parseFloat(cell);
                        const numVal = parseFloat(val);
                        switch (op) {
                            case '=': return cell === val;
                            case '!=': return cell !== val;
                            case '>': return numCell > numVal;
                            case '<': return numCell < numVal;
                            case '>=': return numCell >= numVal;
                            case '<=': return numCell <= numVal;
                            case '~': return cell.toLowerCase().includes(val.toLowerCase());
                            default: return true;
                        }
                    });
                }
            }
            // Sort
            if (args.sort) {
                const sortStr = String(args.sort);
                const desc = sortStr.startsWith('-');
                const sortCol = desc ? sortStr.slice(1) : sortStr;
                const idx = headers.indexOf(sortCol);
                if (idx >= 0) {
                    filtered.sort((a, b) => {
                        const va = parseFloat(a[idx]) || 0, vb = parseFloat(b[idx]) || 0;
                        if (!isNaN(va) && !isNaN(vb))
                            return desc ? vb - va : va - vb;
                        return desc ? (b[idx] || '').localeCompare(a[idx] || '') : (a[idx] || '').localeCompare(b[idx] || '');
                    });
                }
            }
            // Stats
            if (args.stats) {
                const statsStr = String(args.stats);
                if (statsStr === 'count')
                    return `Count: ${filtered.length}`;
                const [fn, col] = statsStr.split(':');
                const idx = headers.indexOf(col);
                if (idx < 0)
                    return `Column not found: ${col}`;
                const nums = filtered.map(r => parseFloat(r[idx])).filter(n => !isNaN(n));
                if (nums.length === 0)
                    return `No numeric values in column: ${col}`;
                switch (fn) {
                    case 'sum': return `Sum(${col}): ${nums.reduce((a, b) => a + b, 0)}`;
                    case 'avg': return `Avg(${col}): ${(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)}`;
                    case 'min': return `Min(${col}): ${Math.min(...nums)}`;
                    case 'max': return `Max(${col}): ${Math.max(...nums)}`;
                    default: return `Unknown stat: ${fn}. Use sum, avg, min, max, or count.`;
                }
            }
            // Select columns
            let displayHeaders = headers;
            let displayRows = filtered;
            if (args.columns) {
                const cols = String(args.columns).split(',').map(c => c.trim());
                const indices = cols.map(c => headers.indexOf(c)).filter(i => i >= 0);
                displayHeaders = indices.map(i => headers[i]);
                displayRows = filtered.map(r => indices.map(i => r[i] || ''));
            }
            const limit = Number(args.limit) || 100;
            const display = displayRows.slice(0, limit);
            const table = toMarkdownTable(displayHeaders, display);
            const info = `${filtered.length} rows matched${filtered.length > limit ? ` (showing ${limit})` : ''}`;
            return info + '\n\n' + table;
        },
    });
    // ── CSV Write / Transform ──
    registerTool({
        name: 'csv_write',
        description: 'Create or transform a CSV file. Write data from headers + rows, or transform an existing CSV by adding/removing columns, renaming headers, or converting delimiter.',
        parameters: {
            path: { type: 'string', description: 'Output file path', required: true },
            headers: { type: 'string', description: 'Comma-separated header names (for new file)' },
            rows: { type: 'string', description: 'JSON array of arrays (for new file), e.g., [["a","b"],["c","d"]]' },
            source: { type: 'string', description: 'Source CSV to transform (optional)' },
            rename: { type: 'string', description: 'Rename columns: "old1:new1,old2:new2"' },
            drop: { type: 'string', description: 'Drop columns: "col1,col2"' },
            delimiter: { type: 'string', description: 'Output delimiter (default: ",")' },
        },
        tier: 'free',
        async execute(args) {
            const outPath = join(process.cwd(), String(args.path));
            const delim = String(args.delimiter || ',');
            if (args.source) {
                // Transform existing CSV
                const srcPath = join(process.cwd(), String(args.source));
                if (!existsSync(srcPath))
                    return `Source not found: ${args.source}`;
                const { headers, rows } = parseCSV(readFileSync(srcPath, 'utf-8'));
                let outHeaders = [...headers];
                let outRows = rows.map(r => [...r]);
                // Drop columns
                if (args.drop) {
                    const dropCols = String(args.drop).split(',').map(c => c.trim());
                    const keepIndices = headers.map((_, i) => i).filter(i => !dropCols.includes(headers[i]));
                    outHeaders = keepIndices.map(i => headers[i]);
                    outRows = rows.map(r => keepIndices.map(i => r[i] || ''));
                }
                // Rename columns
                if (args.rename) {
                    const renames = String(args.rename).split(',').map(r => r.trim().split(':'));
                    for (const [old, newName] of renames) {
                        const idx = outHeaders.indexOf(old);
                        if (idx >= 0)
                            outHeaders[idx] = newName;
                    }
                }
                const csv = toCSV(outHeaders, outRows, delim);
                writeFileSync(outPath, csv, 'utf-8');
                return `Wrote ${outRows.length} rows to ${args.path} (${outHeaders.length} columns)`;
            }
            // Create new CSV
            if (!args.headers)
                return 'Provide headers for a new CSV file.';
            const newHeaders = String(args.headers).split(',').map(h => h.trim());
            let newRows = [];
            if (args.rows) {
                try {
                    newRows = JSON.parse(String(args.rows));
                }
                catch {
                    return 'Invalid rows JSON. Use format: [["a","b"],["c","d"]]';
                }
            }
            const csv = toCSV(newHeaders, newRows, delim);
            writeFileSync(outPath, csv, 'utf-8');
            return `Created ${args.path} with ${newRows.length} rows and ${newHeaders.length} columns`;
        },
    });
    // ── JSON / YAML Transform ──
    registerTool({
        name: 'data_transform',
        description: 'Transform data between formats: CSV to JSON, JSON to CSV, JSON to markdown table. Useful for converting data files, generating reports, and preparing data for different tools.',
        parameters: {
            input: { type: 'string', description: 'Input file path', required: true },
            output: { type: 'string', description: 'Output file path (extension determines format: .csv, .json, .md, .tsv)' },
            format: { type: 'string', description: 'Output format if no output file: "csv", "json", "markdown", "tsv"' },
        },
        tier: 'free',
        async execute(args) {
            const inPath = join(process.cwd(), String(args.input));
            if (!existsSync(inPath))
                return `File not found: ${args.input}`;
            const text = readFileSync(inPath, 'utf-8');
            const inExt = extname(String(args.input)).toLowerCase();
            const outFormat = args.output ? extname(String(args.output)).replace('.', '') : String(args.format || 'json');
            let headers = [];
            let rows = [];
            // Parse input
            if (inExt === '.csv' || inExt === '.tsv') {
                const delim = inExt === '.tsv' ? '\t' : ',';
                const parsed = parseCSV(text, delim);
                headers = parsed.headers;
                rows = parsed.rows;
            }
            else if (inExt === '.json') {
                try {
                    const data = JSON.parse(text);
                    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
                        headers = [...new Set(data.flatMap((d) => Object.keys(d)))];
                        rows = data.map((d) => headers.map(h => String(d[h] ?? '')));
                    }
                    else {
                        return 'JSON must be an array of objects for conversion.';
                    }
                }
                catch {
                    return 'Invalid JSON file.';
                }
            }
            else {
                return `Unsupported input format: ${inExt}. Supported: .csv, .tsv, .json`;
            }
            // Generate output
            let result;
            switch (outFormat) {
                case 'csv':
                    result = toCSV(headers, rows);
                    break;
                case 'tsv':
                    result = toCSV(headers, rows, '\t');
                    break;
                case 'json':
                    result = JSON.stringify(rows.map(r => {
                        const obj = {};
                        headers.forEach((h, i) => { obj[h] = r[i] || ''; });
                        return obj;
                    }), null, 2);
                    break;
                case 'md':
                case 'markdown':
                    result = toMarkdownTable(headers, rows);
                    break;
                default:
                    return `Unsupported output format: ${outFormat}. Use csv, tsv, json, or markdown.`;
            }
            if (args.output) {
                const outPath = join(process.cwd(), String(args.output));
                writeFileSync(outPath, result, 'utf-8');
                return `Converted ${args.input} → ${args.output} (${rows.length} rows)`;
            }
            return result;
        },
    });
    // ── Report Generator ──
    registerTool({
        name: 'generate_report',
        description: 'Generate a formatted markdown report from data. Takes a title, sections, and optional data files (CSV/JSON). Produces a clean, shareable markdown document.',
        parameters: {
            title: { type: 'string', description: 'Report title', required: true },
            sections: { type: 'string', description: 'JSON array of sections: [{"heading":"...","content":"...","data_file":"optional.csv"}]', required: true },
            output: { type: 'string', description: 'Output file path (default: stdout)' },
        },
        tier: 'free',
        async execute(args) {
            const title = String(args.title);
            let sectionData;
            try {
                sectionData = JSON.parse(String(args.sections));
            }
            catch {
                return 'Invalid sections JSON. Use: [{"heading":"Summary","content":"..."}]';
            }
            const lines = [
                `# ${title}`,
                '',
                `> Generated ${new Date().toLocaleDateString()} by [kbot](https://www.npmjs.com/package/@kernel.chat/kbot)`,
                '',
            ];
            for (const section of sectionData) {
                lines.push(`## ${section.heading}`, '');
                if (section.content)
                    lines.push(section.content, '');
                if (section.data_file) {
                    const dataPath = join(process.cwd(), section.data_file);
                    if (existsSync(dataPath)) {
                        const text = readFileSync(dataPath, 'utf-8');
                        const ext = extname(section.data_file).toLowerCase();
                        if (ext === '.csv' || ext === '.tsv') {
                            const { headers, rows } = parseCSV(text, ext === '.tsv' ? '\t' : ',');
                            lines.push(toMarkdownTable(headers, rows.slice(0, 50)), '');
                            if (rows.length > 50)
                                lines.push(`*${rows.length - 50} more rows not shown*`, '');
                        }
                        else if (ext === '.json') {
                            try {
                                const data = JSON.parse(text);
                                if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
                                    const headers = Object.keys(data[0]);
                                    const rows = data.slice(0, 50).map((d) => headers.map(h => String(d[h] ?? '')));
                                    lines.push(toMarkdownTable(headers, rows), '');
                                }
                                else {
                                    lines.push('```json', JSON.stringify(data, null, 2).slice(0, 3000), '```', '');
                                }
                            }
                            catch {
                                lines.push(`Could not parse ${section.data_file}`, '');
                            }
                        }
                    }
                    else {
                        lines.push(`*Data file not found: ${section.data_file}*`, '');
                    }
                }
            }
            lines.push('---', `*Report generated by [kbot](https://www.npmjs.com/package/@kernel.chat/kbot)*`);
            const report = lines.join('\n');
            if (args.output) {
                writeFileSync(join(process.cwd(), String(args.output)), report, 'utf-8');
                return `Report saved to ${args.output}`;
            }
            return report;
        },
    });
    // ── Invoice Generator ──
    registerTool({
        name: 'generate_invoice',
        description: 'Generate a professional invoice in markdown format. Input line items, client info, and payment terms. Outputs a formatted invoice ready to share or convert to PDF.',
        parameters: {
            from: { type: 'string', description: 'Your name/company', required: true },
            to: { type: 'string', description: 'Client name/company', required: true },
            items: { type: 'string', description: 'JSON array: [{"description":"...","qty":1,"rate":100}]', required: true },
            invoice_number: { type: 'string', description: 'Invoice number (default: auto-generated)' },
            due_date: { type: 'string', description: 'Payment due date' },
            notes: { type: 'string', description: 'Additional notes' },
            currency: { type: 'string', description: 'Currency symbol (default: "$")' },
            output: { type: 'string', description: 'Output file path' },
        },
        tier: 'free',
        async execute(args) {
            const currency = String(args.currency || '$');
            let items;
            try {
                items = JSON.parse(String(args.items));
            }
            catch {
                return 'Invalid items JSON.';
            }
            const invoiceNum = String(args.invoice_number || `INV-${Date.now().toString(36).toUpperCase()}`);
            const total = items.reduce((sum, i) => sum + (i.qty * i.rate), 0);
            const lines = [
                `# INVOICE`,
                '',
                `| | |`,
                `|---|---|`,
                `| **Invoice #** | ${invoiceNum} |`,
                `| **Date** | ${new Date().toLocaleDateString()} |`,
                args.due_date ? `| **Due** | ${args.due_date} |` : null,
                '',
                `**From:** ${args.from}`,
                '',
                `**To:** ${args.to}`,
                '',
                '---',
                '',
                '| Description | Qty | Rate | Amount |',
                '|---|---|---|---|',
                ...items.map(i => `| ${i.description} | ${i.qty} | ${currency}${i.rate.toFixed(2)} | ${currency}${(i.qty * i.rate).toFixed(2)} |`),
                `| | | **Total** | **${currency}${total.toFixed(2)}** |`,
                '',
            ].filter(Boolean);
            if (args.notes)
                lines.push('---', '', `**Notes:** ${args.notes}`, '');
            lines.push('---', `*Generated by [kbot](https://www.npmjs.com/package/@kernel.chat/kbot)*`);
            const invoice = lines.join('\n');
            if (args.output) {
                writeFileSync(join(process.cwd(), String(args.output)), invoice, 'utf-8');
                return `Invoice saved to ${args.output}`;
            }
            return invoice;
        },
    });
}
//# sourceMappingURL=documents.js.map