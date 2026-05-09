// Microsoft Office channel adapter — drives Word, Excel, PowerPoint via the
// Microsoft Graph API. Mirrors Microsoft's Copilot Agent Mode (GA April 22,
// 2026) but lets kbot orchestrate the same operations from the terminal.
//
// Auth: bearer token in MICROSOFT_GRAPH_TOKEN. Acquire via the Microsoft
// identity platform (delegated permissions: Files.ReadWrite, Sites.ReadWrite.All).
//
// The standard ChannelAdapter interface is preserved:
//   - send       → POST a comment on a drive item (file)
//   - receive    → list comments on a drive item
//   - listChannels → enumerate drive root children (folders/files)
//
// Office-specific operations are exposed as additional methods on the class:
//   - listFiles, readDocument, writeDocumentSection,
//     appendToWorkbook, addSlide
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
function getToken() {
    const token = process.env.MICROSOFT_GRAPH_TOKEN;
    if (!token) {
        throw new Error('MICROSOFT_GRAPH_TOKEN is not set — Microsoft Office adapter cannot authenticate');
    }
    return token;
}
async function graphFetch(path, init = {}) {
    const token = getToken();
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(init.headers ?? {}),
    };
    if (init.body !== undefined && !headers['Content-Type'] && !init.rawBody) {
        headers['Content-Type'] = 'application/json';
    }
    const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`;
    const res = await fetch(url, { ...init, headers });
    if (!res.ok) {
        let bodyText = '';
        try {
            bodyText = await res.text();
        }
        catch {
            // ignore body decode errors
        }
        throw new Error(`Microsoft Graph ${init.method ?? 'GET'} ${path} failed: ${res.status} ${res.statusText}${bodyText ? ` — ${bodyText}` : ''}`);
    }
    if (res.status === 204)
        return undefined;
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
        return (await res.json());
    }
    // Raw body — return as text. Callers casting to T accept the contract.
    return (await res.text());
}
function commentToChannelMessage(c) {
    const text = c.content?.content ?? '';
    const ts = c.createdDateTime ? Date.parse(c.createdDateTime) : Date.now();
    return {
        id: c.id,
        from: c.from?.user?.displayName ?? c.from?.user?.id ?? 'unknown',
        text,
        ts: Number.isNaN(ts) ? Date.now() : ts,
        raw: c,
    };
}
export class OfficeChannel {
    name = 'office';
    isConfigured() {
        return Boolean(process.env.MICROSOFT_GRAPH_TOKEN);
    }
    /** Post a comment to a drive item (file). `envelope.channel` is the fileId. */
    async send(envelope) {
        const fileId = envelope.channel;
        const json = await graphFetch(`/me/drive/items/${encodeURIComponent(fileId)}/comments`, {
            method: 'POST',
            body: JSON.stringify({ message: envelope.text }),
        });
        const ts = json.createdDateTime ? Date.parse(json.createdDateTime) : Date.now();
        return { id: json.id ?? '', ts: Number.isNaN(ts) ? Date.now() : ts };
    }
    /** List comments on a drive item. `opts.channel` is the fileId. */
    async receive(opts) {
        const limit = opts.limit ?? 100;
        const json = await graphFetch(`/me/drive/items/${encodeURIComponent(opts.channel)}/comments?$top=${limit}`);
        const items = (json.value ?? []).map(commentToChannelMessage);
        if (opts.oldest !== undefined) {
            return items.filter((m) => m.ts > opts.oldest);
        }
        return items;
    }
    /** List drive root children. */
    async listChannels() {
        const items = await this.listFiles({});
        return items.map((it) => ({
            id: it.id,
            name: it.name ?? it.id,
            topic: it.file?.mimeType ?? (it.folder ? 'folder' : undefined),
        }));
    }
    // ---------- Office-specific operations ----------
    async listFiles(options = {}) {
        let path;
        if (options.driveId && options.folderId) {
            path = `/drives/${encodeURIComponent(options.driveId)}/items/${encodeURIComponent(options.folderId)}/children`;
        }
        else if (options.driveId) {
            path = `/drives/${encodeURIComponent(options.driveId)}/root/children`;
        }
        else if (options.folderId) {
            path = `/me/drive/items/${encodeURIComponent(options.folderId)}/children`;
        }
        else {
            path = '/me/drive/root/children';
        }
        const json = await graphFetch(path);
        return json.value ?? [];
    }
    async readDocument(options) {
        const { fileId, format = 'raw' } = options;
        if (format === 'worksheets') {
            const json = await graphFetch(`/me/drive/items/${encodeURIComponent(fileId)}/workbook/worksheets`);
            return json.value ?? [];
        }
        return graphFetch(`/me/drive/items/${encodeURIComponent(fileId)}/content`, {
            method: 'GET',
            rawBody: true,
        });
    }
    /**
     * Replace an entire Word document with `content`.
     *
     * TODO(office-add-in): For surgical, paragraph- or range-level edits, route
     * through an Office Add-in's `Word.Range` API (Word JavaScript API). The
     * Graph REST surface does not expose Word ranges directly; the standard
     * workaround is the Office Add-in JS bridge.
     */
    async writeDocumentSection(options) {
        const { fileId, content } = options;
        const body = typeof content === 'string' ? new TextEncoder().encode(content) : content;
        const json = await graphFetch(`/me/drive/items/${encodeURIComponent(fileId)}/content`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: body,
            rawBody: true,
        });
        return { id: json.id, size: json.size };
    }
    async appendToWorkbook(options) {
        const { fileId, sheet, rows, table = 'Table1' } = options;
        const path = `/me/drive/items/${encodeURIComponent(fileId)}/workbook/worksheets/` +
            `${encodeURIComponent(sheet)}/tables/${encodeURIComponent(table)}/rows/add`;
        return graphFetch(path, {
            method: 'POST',
            body: JSON.stringify({ values: rows }),
        });
    }
    /**
     * TODO(pptx): Microsoft Graph does not expose slide-level mutation. The
     * workaround is to regenerate the .pptx (e.g. via `pptxgenjs`) and PUT the
     * bytes back via `/me/drive/items/{fileId}/content`. Until that dependency
     * is wired, this method throws.
     */
    async addSlide(_options) {
        throw new Error('addSlide requires pptx-genjs — see TODO in office.ts');
    }
}
export const officeAdapter = new OfficeChannel();
export default officeAdapter;
//# sourceMappingURL=office.js.map