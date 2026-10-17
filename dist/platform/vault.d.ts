export interface Credential {
    uid: string;
    sessdata: string;
    csrf: string;
    buvid3: string;
}
export interface Vault {
    read(): Promise<Credential | null>;
    write(value: Credential): Promise<void>;
    remove(): Promise<void>;
}
export declare function credentialOf(value: unknown): Credential;
export declare function dpapi(operation: 'protect' | 'unprotect', bytes: Buffer): Promise<Buffer>;
export declare class WindowsVault implements Vault {
    private readonly path;
    constructor(path: string);
    read(): Promise<Credential | null>;
    write(value: Credential): Promise<void>;
    remove(): Promise<void>;
}
