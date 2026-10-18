export interface DraftMaterial {
    bvid: string;
    title: string;
    author: string;
    subtitle: string;
}
export declare function referenceDraftPrompts(input: DraftMaterial[], persona?: string): {
    system: string;
    prompt: string;
};
export declare function referenceDraftStyle(persona?: string): string;
