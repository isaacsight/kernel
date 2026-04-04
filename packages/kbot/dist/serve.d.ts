interface ServeOptions {
    port: number;
    token?: string;
    computerUse?: boolean;
    https?: boolean;
    cert?: string;
    key?: string;
}
export declare function startServe(options: ServeOptions): Promise<void>;
export {};
//# sourceMappingURL=serve.d.ts.map