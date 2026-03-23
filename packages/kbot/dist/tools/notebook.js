// kbot Notebook Editing — Jupyter .ipynb cell manipulation
//
// Read, edit, insert, and delete cells in Jupyter notebooks.
// Handles the JSON structure so the AI doesn't have to manage
// cell metadata, outputs, and execution counts manually.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { registerTool } from './index.js';
function readNotebook(path) {
    if (!existsSync(path))
        throw new Error(`File not found: ${path}`);
    const raw = readFileSync(path, 'utf-8');
    const nb = JSON.parse(raw);
    if (!nb.cells || !Array.isArray(nb.cells)) {
        throw new Error(`Invalid notebook format: ${path}`);
    }
    return nb;
}
function writeNotebook(path, nb) {
    writeFileSync(path, JSON.stringify(nb, null, 1) + '\n');
}
function formatCell(cell, index) {
    const source = cell.source.join('');
    const typeTag = cell.cell_type === 'code' ? 'code' : cell.cell_type === 'markdown' ? 'md' : 'raw';
    const execCount = cell.cell_type === 'code' && cell.execution_count != null
        ? `[${cell.execution_count}]`
        : '';
    const header = `Cell ${index} (${typeTag})${execCount}`;
    const lines = [`── ${header} ──`, source];
    // Show outputs for code cells
    if (cell.cell_type === 'code' && cell.outputs && cell.outputs.length > 0) {
        lines.push('  Output:');
        for (const out of cell.outputs) {
            if (out.output_type === 'stream') {
                const text = Array.isArray(out.text) ? out.text.join('') : String(out.text || '');
                lines.push(`  ${text}`);
            }
            else if (out.output_type === 'execute_result' || out.output_type === 'display_data') {
                const data = out.data;
                if (data?.['text/plain']) {
                    const text = Array.isArray(data['text/plain'])
                        ? data['text/plain'].join('')
                        : String(data['text/plain']);
                    lines.push(`  ${text}`);
                }
            }
            else if (out.output_type === 'error') {
                lines.push(`  Error: ${out.ename}: ${out.evalue}`);
            }
        }
    }
    return lines.join('\n');
}
export function registerNotebookTools() {
    registerTool({
        name: 'notebook_read',
        description: 'Read a Jupyter notebook (.ipynb). Returns all cells with their type, source, and outputs.',
        parameters: {
            path: { type: 'string', description: 'Path to the .ipynb file', required: true },
            cell: { type: 'number', description: 'Read only a specific cell (0-indexed). Omit to read all cells.' },
        },
        tier: 'free',
        async execute(args) {
            try {
                const nb = readNotebook(String(args.path));
                const cellIndex = typeof args.cell === 'number' ? args.cell : undefined;
                if (cellIndex !== undefined) {
                    if (cellIndex < 0 || cellIndex >= nb.cells.length) {
                        return `Error: Cell ${cellIndex} out of range. Notebook has ${nb.cells.length} cells (0-${nb.cells.length - 1}).`;
                    }
                    return formatCell(nb.cells[cellIndex], cellIndex);
                }
                const lines = [
                    `Notebook: ${args.path} (${nb.cells.length} cells)`,
                    `Kernel: ${nb.metadata?.kernelspec?.display_name || 'unknown'}`,
                    '',
                ];
                for (let i = 0; i < nb.cells.length; i++) {
                    lines.push(formatCell(nb.cells[i], i));
                    lines.push('');
                }
                return lines.join('\n');
            }
            catch (err) {
                return `Error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    registerTool({
        name: 'notebook_edit',
        description: 'Replace the source of a specific cell in a Jupyter notebook. Cell number is 0-indexed.',
        parameters: {
            path: { type: 'string', description: 'Path to the .ipynb file', required: true },
            cell: { type: 'number', description: 'Cell index (0-based)', required: true },
            source: { type: 'string', description: 'New cell source content', required: true },
            cell_type: { type: 'string', description: 'Change cell type: code, markdown, raw' },
        },
        tier: 'free',
        async execute(args) {
            try {
                const path = String(args.path);
                const nb = readNotebook(path);
                const cellIndex = Number(args.cell);
                if (cellIndex < 0 || cellIndex >= nb.cells.length) {
                    return `Error: Cell ${cellIndex} out of range. Notebook has ${nb.cells.length} cells (0-${nb.cells.length - 1}).`;
                }
                const cell = nb.cells[cellIndex];
                cell.source = String(args.source).split('\n').map((line, i, arr) => i < arr.length - 1 ? line + '\n' : line);
                if (args.cell_type) {
                    const ct = String(args.cell_type);
                    if (!['code', 'markdown', 'raw'].includes(ct)) {
                        return `Error: Invalid cell_type "${ct}". Use: code, markdown, raw`;
                    }
                    cell.cell_type = ct;
                    if (ct === 'code' && !cell.outputs)
                        cell.outputs = [];
                    if (ct !== 'code') {
                        delete cell.outputs;
                        delete cell.execution_count;
                    }
                }
                // Clear outputs on edit (stale)
                if (cell.cell_type === 'code') {
                    cell.outputs = [];
                    cell.execution_count = null;
                }
                writeNotebook(path, nb);
                return `Edited cell ${cellIndex} in ${path}`;
            }
            catch (err) {
                return `Error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    registerTool({
        name: 'notebook_insert',
        description: 'Insert a new cell into a Jupyter notebook at the specified position.',
        parameters: {
            path: { type: 'string', description: 'Path to the .ipynb file', required: true },
            position: { type: 'number', description: 'Position to insert at (0-indexed). Inserts before this index. Use -1 to append.', required: true },
            source: { type: 'string', description: 'Cell source content', required: true },
            cell_type: { type: 'string', description: 'Cell type: code (default), markdown, raw' },
        },
        tier: 'free',
        async execute(args) {
            try {
                const path = String(args.path);
                const nb = readNotebook(path);
                const position = Number(args.position);
                const cellType = (String(args.cell_type || 'code'));
                if (!['code', 'markdown', 'raw'].includes(cellType)) {
                    return `Error: Invalid cell_type "${cellType}". Use: code, markdown, raw`;
                }
                const newCell = {
                    cell_type: cellType,
                    source: String(args.source).split('\n').map((line, i, arr) => i < arr.length - 1 ? line + '\n' : line),
                    metadata: {},
                };
                if (cellType === 'code') {
                    newCell.outputs = [];
                    newCell.execution_count = null;
                }
                // Generate a cell ID if nbformat supports it
                if (nb.nbformat >= 4 && (nb.nbformat_minor || 0) >= 5) {
                    newCell.id = Math.random().toString(36).slice(2, 10);
                }
                if (position === -1 || position >= nb.cells.length) {
                    nb.cells.push(newCell);
                }
                else {
                    nb.cells.splice(Math.max(0, position), 0, newCell);
                }
                writeNotebook(path, nb);
                const insertedAt = position === -1 ? nb.cells.length - 1 : Math.max(0, position);
                return `Inserted ${cellType} cell at position ${insertedAt} in ${path}`;
            }
            catch (err) {
                return `Error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
    registerTool({
        name: 'notebook_delete',
        description: 'Delete a cell from a Jupyter notebook by index.',
        parameters: {
            path: { type: 'string', description: 'Path to the .ipynb file', required: true },
            cell: { type: 'number', description: 'Cell index to delete (0-based)', required: true },
        },
        tier: 'free',
        async execute(args) {
            try {
                const path = String(args.path);
                const nb = readNotebook(path);
                const cellIndex = Number(args.cell);
                if (cellIndex < 0 || cellIndex >= nb.cells.length) {
                    return `Error: Cell ${cellIndex} out of range. Notebook has ${nb.cells.length} cells (0-${nb.cells.length - 1}).`;
                }
                const removed = nb.cells.splice(cellIndex, 1)[0];
                writeNotebook(path, nb);
                return `Deleted cell ${cellIndex} (${removed.cell_type}) from ${path}. ${nb.cells.length} cells remaining.`;
            }
            catch (err) {
                return `Error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    });
}
//# sourceMappingURL=notebook.js.map