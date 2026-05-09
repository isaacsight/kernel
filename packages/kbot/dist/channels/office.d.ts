import type { ChannelAdapter, ChannelEnvelope, ChannelInfo, ChannelMessage, ChannelReceiveOptions } from './types.js';
interface GraphDriveItem {
    id: string;
    name?: string;
    webUrl?: string;
    folder?: {
        childCount?: number;
    };
    file?: {
        mimeType?: string;
    };
    size?: number;
}
export interface ListFilesOptions {
    driveId?: string;
    folderId?: string;
}
export interface ReadDocumentOptions {
    fileId: string;
    /** "raw" returns the file bytes as text; "worksheets" lists Excel sheets. */
    format?: 'raw' | 'worksheets';
}
export interface WriteDocumentSectionOptions {
    fileId: string;
    /** Path within the document. Currently informational — see TODO below. */
    sectionPath: string;
    content: string | Uint8Array;
}
export interface AppendToWorkbookOptions {
    fileId: string;
    sheet: string;
    rows: Array<Array<string | number | boolean | null>>;
    /** Table name in the worksheet. Defaults to "Table1". */
    table?: string;
}
export interface AddSlideOptions {
    fileId: string;
    layout?: string;
    content?: Record<string, unknown>;
}
export declare class OfficeChannel implements ChannelAdapter {
    readonly name = "office";
    isConfigured(): boolean;
    /** Post a comment to a drive item (file). `envelope.channel` is the fileId. */
    send(envelope: ChannelEnvelope): Promise<{
        id: string;
        ts: number;
    }>;
    /** List comments on a drive item. `opts.channel` is the fileId. */
    receive(opts: ChannelReceiveOptions): Promise<ChannelMessage[]>;
    /** List drive root children. */
    listChannels(): Promise<ChannelInfo[]>;
    listFiles(options?: ListFilesOptions): Promise<GraphDriveItem[]>;
    readDocument(options: ReadDocumentOptions): Promise<string | unknown>;
    /**
     * Replace an entire Word document with `content`.
     *
     * TODO(office-add-in): For surgical, paragraph- or range-level edits, route
     * through an Office Add-in's `Word.Range` API (Word JavaScript API). The
     * Graph REST surface does not expose Word ranges directly; the standard
     * workaround is the Office Add-in JS bridge.
     */
    writeDocumentSection(options: WriteDocumentSectionOptions): Promise<{
        id: string;
        size?: number;
    }>;
    appendToWorkbook(options: AppendToWorkbookOptions): Promise<unknown>;
    /**
     * TODO(pptx): Microsoft Graph does not expose slide-level mutation. The
     * workaround is to regenerate the .pptx (e.g. via `pptxgenjs`) and PUT the
     * bytes back via `/me/drive/items/{fileId}/content`. Until that dependency
     * is wired, this method throws.
     */
    addSlide(_options: AddSlideOptions): Promise<never>;
}
export declare const officeAdapter: ChannelAdapter;
export default officeAdapter;
//# sourceMappingURL=office.d.ts.map