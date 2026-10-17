export declare const name = "dafeyu";
export declare const inject: readonly string[];
export interface HostContext {
    logger: {
        info(message: string): void;
    };
}
export declare function apply(ctx: HostContext): void;
