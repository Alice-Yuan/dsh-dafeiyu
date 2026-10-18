export interface DraftMaterial {
    bvid: string;
    title: string;
    author: string;
    subtitle: string;
}
export declare function referenceDraftPrompts(input: DraftMaterial[]): {
    system: string;
    prompt: string;
};
export declare function referenceDraftStyle(): string;
