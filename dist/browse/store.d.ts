import { PilotStore } from '../pilot/store.js';
import { type BrowseRun, type Reading } from './contracts.js';
export declare class BrowseStore {
    private readonly pilot;
    constructor(pilot: PilotStore);
    latest(): BrowseRun | null;
    save(run: BrowseRun): void;
    seen(account: string, bvid: string): boolean;
    record(reading: Reading, run: BrowseRun): void;
    history(): Reading[];
}
