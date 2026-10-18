import { z } from 'zod';
import { createTypertRemoteInfo } from '@deepseek-ai/dsh-typert-protocol/remote-info';
const configSchema = z.object({ ownerUid: z.string().max(25), bvid: z.string().max(12), persona: z.string().max(2000), diagnosticMarker: z.string().max(80) }).strict();
export const REQUESTS = {
    status: z.object({}).strict(),
    saveConfig: z.object({ config: configSchema, revision: z.string().max(64) }).strict(),
    loginStart: z.object({}).strict(),
    loginPoll: z.object({ loginId: z.string().uuid() }).strict(),
    logout: z.object({}).strict(),
    preflight: z.object({}).strict(),
    inspectVideo: z.object({}).strict(),
    chat: z.object({ text: z.string().min(1).max(4000) }).strict(),
    start: z.object({ revision: z.string().max(64), accountUid: z.string().regex(/^[1-9]\d{0,24}$/) }).strict(),
    startMediaTrial: z.object({ revision: z.string().max(64), accountUid: z.string().regex(/^[1-9]\d{0,24}$/) }).strict(),
    stop: z.object({}).strict(),
    reconcile: z.object({}).strict(),
};
export const REMOTE = createTypertRemoteInfo({
    package: 'dsh-dafeiyu',
    methods: Object.fromEntries(Object.entries(REQUESTS).map(([method, schema]) => {
        const codec = { mode: 'strict', typeSymbol: `dsh-dafeiyu#${method}:request`, create: () => schema };
        const spec = {
            service: 'dafeyuControl', invocation: { kind: 'direct' },
            parameters: [{ name: 'request', source: 'json', codec, strictCodec: codec }],
            cancellation: { parameter: 'signal' },
            result: { mode: 'strict', typeSymbol: `dsh-dafeiyu#${method}:result`, create: () => z.json() },
        };
        return [`dafeyu/${method}`, spec];
    })),
}, z);
//# sourceMappingURL=remote.js.map