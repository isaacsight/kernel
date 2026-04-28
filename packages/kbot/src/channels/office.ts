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

import type {
  ChannelAdapter,
  ChannelEnvelope,
  ChannelInfo,
  ChannelMessage,
  ChannelReceiveOptions,
} from './types.js'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

interface GraphDriveItem {
  id: string
  name?: string
  webUrl?: string
  folder?: { childCount?: number }
  file?: { mimeType?: string }
  size?: number
}

interface GraphCollection<T> {
  value?: T[]
  '@odata.nextLink'?: string
}

interface GraphComment {
  id: string
  content?: { content?: string; contentType?: string }
  createdDateTime?: string
  from?: { user?: { displayName?: string; id?: string } }
}

interface GraphCommentCreate {
  id?: string
  content?: { content?: string }
  createdDateTime?: string
}

export interface ListFilesOptions {
  driveId?: string
  folderId?: string
}

export interface ReadDocumentOptions {
  fileId: string
  /** "raw" returns the file bytes as text; "worksheets" lists Excel sheets. */
  format?: 'raw' | 'worksheets'
}

export interface WriteDocumentSectionOptions {
  fileId: string
  /** Path within the document. Currently informational — see TODO below. */
  sectionPath: string
  content: string | Uint8Array
}

export interface AppendToWorkbookOptions {
  fileId: string
  sheet: string
  rows: Array<Array<string | number | boolean | null>>
  /** Table name in the worksheet. Defaults to "Table1". */
  table?: string
}

export interface AddSlideOptions {
  fileId: string
  layout?: string
  content?: Record<string, unknown>
}

function getToken(): string {
  const token = process.env.MICROSOFT_GRAPH_TOKEN
  if (!token) {
    throw new Error(
      'MICROSOFT_GRAPH_TOKEN is not set — Microsoft Office adapter cannot authenticate',
    )
  }
  return token
}

async function graphFetch<T = unknown>(
  path: string,
  init: RequestInit & { rawBody?: boolean } = {},
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  }
  if (init.body !== undefined && !headers['Content-Type'] && !init.rawBody) {
    headers['Content-Type'] = 'application/json'
  }
  const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`
  const res = await fetch(url, { ...init, headers })
  if (!res.ok) {
    let bodyText = ''
    try {
      bodyText = await res.text()
    } catch {
      // ignore body decode errors
    }
    throw new Error(
      `Microsoft Graph ${init.method ?? 'GET'} ${path} failed: ${res.status} ${res.statusText}${
        bodyText ? ` — ${bodyText}` : ''
      }`,
    )
  }
  if (res.status === 204) return undefined as T
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return (await res.json()) as T
  }
  // Raw body — return as text. Callers casting to T accept the contract.
  return (await res.text()) as unknown as T
}

function commentToChannelMessage(c: GraphComment): ChannelMessage {
  const text = c.content?.content ?? ''
  const ts = c.createdDateTime ? Date.parse(c.createdDateTime) : Date.now()
  return {
    id: c.id,
    from: c.from?.user?.displayName ?? c.from?.user?.id ?? 'unknown',
    text,
    ts: Number.isNaN(ts) ? Date.now() : ts,
    raw: c,
  }
}

export class OfficeChannel implements ChannelAdapter {
  readonly name = 'office'

  isConfigured(): boolean {
    return Boolean(process.env.MICROSOFT_GRAPH_TOKEN)
  }

  /** Post a comment to a drive item (file). `envelope.channel` is the fileId. */
  async send(envelope: ChannelEnvelope): Promise<{ id: string; ts: number }> {
    const fileId = envelope.channel
    const json = await graphFetch<GraphCommentCreate>(
      `/me/drive/items/${encodeURIComponent(fileId)}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ message: envelope.text }),
      },
    )
    const ts = json.createdDateTime ? Date.parse(json.createdDateTime) : Date.now()
    return { id: json.id ?? '', ts: Number.isNaN(ts) ? Date.now() : ts }
  }

  /** List comments on a drive item. `opts.channel` is the fileId. */
  async receive(opts: ChannelReceiveOptions): Promise<ChannelMessage[]> {
    const limit = opts.limit ?? 100
    const json = await graphFetch<GraphCollection<GraphComment>>(
      `/me/drive/items/${encodeURIComponent(opts.channel)}/comments?$top=${limit}`,
    )
    const items = (json.value ?? []).map(commentToChannelMessage)
    if (opts.oldest !== undefined) {
      return items.filter((m) => m.ts > (opts.oldest as number))
    }
    return items
  }

  /** List drive root children. */
  async listChannels(): Promise<ChannelInfo[]> {
    const items = await this.listFiles({})
    return items.map((it) => ({
      id: it.id,
      name: it.name ?? it.id,
      topic: it.file?.mimeType ?? (it.folder ? 'folder' : undefined),
    }))
  }

  // ---------- Office-specific operations ----------

  async listFiles(options: ListFilesOptions = {}): Promise<GraphDriveItem[]> {
    let path: string
    if (options.driveId && options.folderId) {
      path = `/drives/${encodeURIComponent(options.driveId)}/items/${encodeURIComponent(
        options.folderId,
      )}/children`
    } else if (options.driveId) {
      path = `/drives/${encodeURIComponent(options.driveId)}/root/children`
    } else if (options.folderId) {
      path = `/me/drive/items/${encodeURIComponent(options.folderId)}/children`
    } else {
      path = '/me/drive/root/children'
    }
    const json = await graphFetch<GraphCollection<GraphDriveItem>>(path)
    return json.value ?? []
  }

  async readDocument(options: ReadDocumentOptions): Promise<string | unknown> {
    const { fileId, format = 'raw' } = options
    if (format === 'worksheets') {
      const json = await graphFetch<GraphCollection<{ id: string; name: string }>>(
        `/me/drive/items/${encodeURIComponent(fileId)}/workbook/worksheets`,
      )
      return json.value ?? []
    }
    return graphFetch<string>(`/me/drive/items/${encodeURIComponent(fileId)}/content`, {
      method: 'GET',
      rawBody: true,
    })
  }

  /**
   * Replace an entire Word document with `content`.
   *
   * TODO(office-add-in): For surgical, paragraph- or range-level edits, route
   * through an Office Add-in's `Word.Range` API (Word JavaScript API). The
   * Graph REST surface does not expose Word ranges directly; the standard
   * workaround is the Office Add-in JS bridge.
   */
  async writeDocumentSection(
    options: WriteDocumentSectionOptions,
  ): Promise<{ id: string; size?: number }> {
    const { fileId, content } = options
    const body =
      typeof content === 'string' ? new TextEncoder().encode(content) : content
    const json = await graphFetch<GraphDriveItem>(
      `/me/drive/items/${encodeURIComponent(fileId)}/content`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: body as unknown as BodyInit,
        rawBody: true,
      },
    )
    return { id: json.id, size: json.size }
  }

  async appendToWorkbook(options: AppendToWorkbookOptions): Promise<unknown> {
    const { fileId, sheet, rows, table = 'Table1' } = options
    const path =
      `/me/drive/items/${encodeURIComponent(fileId)}/workbook/worksheets/` +
      `${encodeURIComponent(sheet)}/tables/${encodeURIComponent(table)}/rows/add`
    return graphFetch<unknown>(path, {
      method: 'POST',
      body: JSON.stringify({ values: rows }),
    })
  }

  /**
   * TODO(pptx): Microsoft Graph does not expose slide-level mutation. The
   * workaround is to regenerate the .pptx (e.g. via `pptxgenjs`) and PUT the
   * bytes back via `/me/drive/items/{fileId}/content`. Until that dependency
   * is wired, this method throws.
   */
  async addSlide(_options: AddSlideOptions): Promise<never> {
    throw new Error('addSlide requires pptx-genjs — see TODO in office.ts')
  }
}

export const officeAdapter: ChannelAdapter = new OfficeChannel()

export default officeAdapter
