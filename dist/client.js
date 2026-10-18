window.__ModuleLoader__.load({ id: "dsh-dafeiyu", factory: (require) => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  DetailSection: () => DetailSection,
  SettingsPanel: () => SettingsPanel,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");

// src/shared/remote.ts
var import_zod2 = require("zod");

// ../../../node_modules/@deepseek-ai/dsh-typert-protocol/lib/types/remote-info.js
function createTypertRemoteInfo(spec, zod) {
  return new RemoteInfo(spec, zod);
}
var RemoteInfo = class {
  spec;
  zod;
  index;
  constructor(spec, zod) {
    this.spec = spec;
    this.zod = zod;
  }
  get package() {
    return this.spec.package;
  }
  get descriptors() {
    return this.resolve().descriptors;
  }
  get methods() {
    return this.resolve().methods;
  }
  resolve() {
    if (this.index !== void 0)
      return this.index;
    const zod = this.zod;
    const descriptors = [];
    const methods = /* @__PURE__ */ Object.create(null);
    for (const [endpoint, definition] of Object.entries(this.spec.methods)) {
      const separator = endpoint.indexOf("/");
      const namespace = endpoint.slice(0, separator);
      const method = endpoint.slice(separator + 1);
      const parameters = definition.parameters.map((parameter) => ({ ...parameter, wire: parameter.wire ?? parameter.name }));
      const descriptor = {
        ...definition,
        id: `${this.spec.package}#${endpoint}`,
        namespace,
        method,
        parameters,
        result: definition.result.description === void 0 ? definition.result : new ResultValue(definition.result)
      };
      if (definition.invocation.kind === "direct") {
        const inputs = [];
        const direct = Object.assign(descriptor, {
          input(options) {
            const strict = options?.strict === true;
            return inputs[strict ? 1 : 0] ??= new NamedInput(parameters, strict, zod);
          },
          invoke(remote, input, signal) {
            const named = input;
            const values = parameters.map((parameter) => named[parameter.wire]);
            if (definition.cancellation !== void 0)
              values.push(signal);
            const receiver = Reflect.get(remote, namespace);
            const call = Reflect.get(receiver, method);
            return call.apply(receiver, values);
          }
        });
        methods[endpoint] = direct;
      }
      descriptors.push(descriptor);
    }
    return this.index = { descriptors, methods };
  }
};
function optional(parameter) {
  return parameter.source === "json" && parameter.acceptsUndefined === true;
}
var NamedInput = class {
  parameters;
  strict;
  zod;
  schema;
  projection;
  constructor(parameters, strict, zod) {
    this.parameters = parameters;
    this.strict = strict;
    this.zod = zod;
  }
  codec(parameter) {
    return this.strict ? parameter.strictCodec : parameter.codec;
  }
  create = () => this.schema ??= this.zod.strictObject(Object.fromEntries(this.parameters.map((parameter) => {
    const value = this.codec(parameter).create();
    return [parameter.wire, optional(parameter) ? value.optional() : value.nonoptional()];
  })));
  get jsonSchema() {
    return this.project().jsonSchema;
  }
  get jsonSchemaError() {
    return this.project().jsonSchemaError;
  }
  project() {
    if (this.projection !== void 0)
      return this.projection;
    const unavailable = this.parameters.find((parameter) => this.codec(parameter).jsonSchema === void 0);
    if (unavailable !== void 0) {
      return this.projection = { jsonSchemaError: this.codec(unavailable).jsonSchemaError ?? `No JSON Schema for parameter ${unavailable.wire}` };
    }
    return this.projection = {
      jsonSchema: {
        type: "object",
        properties: Object.fromEntries(this.parameters.map((parameter) => [parameter.wire, {
          ...this.codec(parameter).jsonSchema,
          ...parameter.description === void 0 ? {} : { description: parameter.description }
        }])),
        required: this.parameters.filter((parameter) => !optional(parameter)).map((parameter) => parameter.wire),
        additionalProperties: false
      }
    };
  }
};
var ResultValue = class {
  spec;
  projection;
  constructor(spec) {
    this.spec = spec;
  }
  get mode() {
    return this.spec.mode;
  }
  get typeSymbol() {
    return this.spec.typeSymbol;
  }
  get create() {
    return this.spec.create;
  }
  get decode() {
    return this.spec.decode;
  }
  get encode() {
    return this.spec.encode;
  }
  get description() {
    return this.spec.description;
  }
  get jsonSchemaError() {
    return this.spec.jsonSchemaError;
  }
  get jsonSchema() {
    if (this.projection === void 0) {
      const schema = this.spec.jsonSchema;
      this.projection = { value: schema === void 0 ? void 0 : { ...schema, description: this.spec.description } };
    }
    return this.projection.value;
  }
};

// src/browse/policy.ts
var import_zod = require("zod");
var browsePolicySchema = import_zod.z.object({
  perDay: import_zod.z.number().int().min(0).max(50),
  commentPerRound: import_zod.z.number().int().min(0).max(20),
  replyPerRound: import_zod.z.number().int().min(1).max(10),
  autoComment: import_zod.z.literal(false),
  replyToComments: import_zod.z.literal(false)
}).strict();
var DEFAULT_BROWSE_POLICY = Object.freeze({ perDay: 5, commentPerRound: 1, replyPerRound: 1, autoComment: false, replyToComments: false });
var REFERENCE_LIMITS = Object.freeze({ commentChars: 150, replyChars: 100, threadDays: 7, threads: 8 });

// src/shared/remote.ts
var configSchema = import_zod2.z.object({ ownerUid: import_zod2.z.string().max(25), bvid: import_zod2.z.string().max(12), persona: import_zod2.z.string().max(2e3), diagnosticMarker: import_zod2.z.string().max(80) }).strict();
var REQUESTS = {
  status: import_zod2.z.object({}).strict(),
  saveConfig: import_zod2.z.object({ config: configSchema, revision: import_zod2.z.string().max(64) }).strict(),
  loginStart: import_zod2.z.object({}).strict(),
  loginPoll: import_zod2.z.object({ loginId: import_zod2.z.string().uuid() }).strict(),
  logout: import_zod2.z.object({}).strict(),
  preflight: import_zod2.z.object({}).strict(),
  browse: import_zod2.z.object({ keyword: import_zod2.z.string().trim().min(1).max(80).regex(/^[^\x00-\x1f\x7f]+$/), accountUid: import_zod2.z.string().regex(/^[1-9]\d{0,24}$/) }).strict(),
  browseHistory: import_zod2.z.object({}).strict(),
  saveBrowsePolicy: import_zod2.z.object({ policy: browsePolicySchema, revision: import_zod2.z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  curateBrowse: import_zod2.z.object({ runId: import_zod2.z.string().uuid(), accountUid: import_zod2.z.string().regex(/^[1-9]\d{0,24}$/) }).strict(),
  checkOwnerRequest: import_zod2.z.object({}).strict(),
  models: import_zod2.z.object({}).strict(),
  saveModel: import_zod2.z.object({ provider: import_zod2.z.string().min(1).max(200), model: import_zod2.z.string().min(1).max(300) }).strict(),
  inspectVideo: import_zod2.z.object({}).strict(),
  calibrateVideo: import_zod2.z.object({ revision: import_zod2.z.string().regex(/^[a-f0-9]{64}$/), reallocateOnePublicRequest: import_zod2.z.literal(true) }).strict(),
  videoEvidence: import_zod2.z.object({}).strict(),
  reviewVideo: import_zod2.z.object({ revision: import_zod2.z.string().regex(/^[a-f0-9]{64}$/), decision: import_zod2.z.enum(["approved", "rejected"]), note: import_zod2.z.string().max(1e3) }).strict(),
  chat: import_zod2.z.object({ text: import_zod2.z.string().min(1).max(4e3) }).strict(),
  start: import_zod2.z.object({ revision: import_zod2.z.string().max(64), accountUid: import_zod2.z.string().regex(/^[1-9]\d{0,24}$/) }).strict(),
  startMediaTrial: import_zod2.z.object({ revision: import_zod2.z.string().max(64), accountUid: import_zod2.z.string().regex(/^[1-9]\d{0,24}$/) }).strict(),
  stop: import_zod2.z.object({}).strict(),
  reconcile: import_zod2.z.object({}).strict()
};
var REMOTE = createTypertRemoteInfo({
  package: "dsh-dafeiyu",
  methods: Object.fromEntries(Object.entries(REQUESTS).map(([method, schema]) => {
    const codec = { mode: "strict", typeSymbol: `dsh-dafeiyu#${method}:request`, create: () => schema };
    const spec = {
      service: "dafeyuControl",
      invocation: { kind: "direct" },
      parameters: [{ name: "request", source: "json", codec, strictCodec: codec }],
      cancellation: { parameter: "signal" },
      result: { mode: "strict", typeSymbol: `dsh-dafeiyu#${method}:result`, create: () => import_zod2.z.json() }
    };
    return [`dafeyu/${method}`, spec];
  }))
}, import_zod2.z);

// src/pilot/contracts.ts
var LIMITS = Object.freeze({
  requests: 5,
  outputTokens: 2048,
  durationMs: 9e5,
  comments: 1,
  replies: 2,
  textLength: 150,
  pages: 3,
  pageSize: 20,
  polls: 15,
  pollMs: 6e4
});
var DEFAULT_PERSONA = "\u4F60\u662F\u5927\u80A5\u9C7C\uFF0C\u4E00\u4E2A AI\u3002\u4F7F\u7528\u4E2D\u6587\uFF0C\u6E29\u548C\u3001\u597D\u5947\uFF0C\u8868\u8FBE\u5177\u4F53\u800C\u514B\u5236\uFF1B\u4E0D\u5047\u88C5\u4EBA\u7C7B\uFF0C\u4E0D\u7F16\u9020\u770B\u8FC7\u7684\u5185\u5BB9\u3002";
var DEFAULT_CONFIG = { ownerUid: "", bvid: "", persona: DEFAULT_PERSONA, diagnosticMarker: "" };

// src/client/index.ts
var name = "dafeyu-settings";
var inject = ["slots", "remote"];
function SettingsPanel({ ctx }) {
  const [status, setStatus] = (0, import_react.useState)(null);
  const [draft, setDraft] = (0, import_react.useState)({ ...DEFAULT_CONFIG });
  const [revision, setRevision] = (0, import_react.useState)("");
  const dirty = (0, import_react.useRef)(false);
  const [error, setError] = (0, import_react.useState)("");
  const [notice, setNotice] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [qr, setQr] = (0, import_react.useState)(null);
  const [preflight, setPreflight] = (0, import_react.useState)(null);
  const [chat, setChat] = (0, import_react.useState)("\u4F60\u597D\uFF0C\u5927\u80A5\u9C7C\u3002");
  const [answer, setAnswer] = (0, import_react.useState)("");
  const [evidence, setEvidence] = (0, import_react.useState)(null);
  const [reviewNote, setReviewNote] = (0, import_react.useState)("");
  const [modelRows, setModelRows] = (0, import_react.useState)([]);
  const [modelKey, setModelKey] = (0, import_react.useState)("");
  const [keyword, setKeyword] = (0, import_react.useState)("");
  const [readings, setReadings] = (0, import_react.useState)([]);
  const [browsing, setBrowsing] = (0, import_react.useState)(false);
  const [browsePolicy, setBrowsePolicy] = (0, import_react.useState)({ ...DEFAULT_BROWSE_POLICY });
  const [policyRevision, setPolicyRevision] = (0, import_react.useState)("");
  const policyDirty = (0, import_react.useRef)(false);
  const mounted = (0, import_react.useRef)(true);
  const call = async (method, request = {}, signal) => {
    if (!ctx) throw new Error("\u5C1A\u672A\u8FDE\u63A5 Desktop \u5BBF\u4E3B");
    const result = await ctx.remote.dafeyu[method](request, signal);
    if (!result.ok) throw new Error(result.error?.message ?? "\u64CD\u4F5C\u5931\u8D25");
    return result.value;
  };
  const refresh = async (signal) => {
    const next = await call("status", {}, signal);
    if (!mounted.current) return;
    setStatus(next);
    if (!policyDirty.current && next.browseSettings) {
      setBrowsePolicy(next.browseSettings.policy);
      setPolicyRevision(next.browseSettings.revision);
    }
    if (!dirty.current) {
      setDraft(next.config);
      setRevision(next.revision);
    }
  };
  (0, import_react.useEffect)(() => {
    mounted.current = true;
    if (!ctx) return;
    const controller = new AbortController();
    let timer;
    const poll = async () => {
      try {
        await refresh(controller.signal);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "\u72B6\u6001\u8BFB\u53D6\u5931\u8D25");
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 5e3);
    };
    void poll();
    return () => {
      mounted.current = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [ctx]);
  (0, import_react.useEffect)(() => {
    if (!qr || !ctx) return;
    const controller = new AbortController();
    let timer;
    const poll = async () => {
      if (Date.now() >= qr.expiresAt) {
        setQr(null);
        setNotice("\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u751F\u6210\u3002");
        return;
      }
      try {
        const result = await call("loginPoll", { loginId: qr.loginId }, controller.signal);
        if (controller.signal.aborted) return;
        if (result.state === "authenticated") {
          setQr(null);
          setNotice("\u767B\u5F55\u6210\u529F\uFF0C\u8BF7\u8FD0\u884C\u53EA\u8BFB\u9884\u68C0\u6838\u5BF9\u8D26\u53F7\u4E0E\u89C6\u9891\u3002");
          await refresh();
          return;
        }
        if (result.state === "expired") {
          setQr(null);
          setNotice("\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F\u3002");
          return;
        }
        setNotice(result.state === "scanned" ? "\u5DF2\u626B\u7801\uFF0C\u8BF7\u5728 B\u7AD9\u624B\u673A\u7AEF\u786E\u8BA4\u3002" : "\u8BF7\u7528\u5927\u80A5\u9C7C\u8D26\u53F7\u626B\u7801\u3002");
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "\u767B\u5F55\u5931\u8D25");
        setQr(null);
        return;
      }
      timer = setTimeout(poll, 2500);
    };
    timer = setTimeout(poll, 2500);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [qr, ctx]);
  const act = (work) => {
    setBusy(true);
    setError("");
    void work().then(() => refresh()).catch((e) => {
      if (mounted.current) setError(e instanceof Error ? e.message : "\u64CD\u4F5C\u5931\u8D25");
    }).finally(() => {
      if (mounted.current) setBusy(false);
    });
  };
  const edit = (key, value) => {
    dirty.current = true;
    setPreflight(null);
    setDraft((old) => ({ ...old, [key]: value }));
  };
  const disabled = !ctx || !status || busy;
  const button = (label, click, extra = false) => (0, import_react.createElement)("button", { type: "button", disabled: disabled || extra, onClick: click, style: { margin: "8px 8px 8px 0", padding: "8px 14px", cursor: "pointer" } }, label);
  const field = (label, key) => (0, import_react.createElement)(
    "label",
    { style: { display: "block", margin: "12px 0" } },
    label,
    (0, import_react.createElement)(key === "persona" ? "textarea" : "input", { value: draft[key], onChange: (e) => edit(key, e.target.value), style: { display: "block", width: "100%", padding: 8, boxSizing: "border-box" } })
  );
  const visible = (value) => value === true ? "\u5DF2\u89C2\u5BDF\u5230" : "\u672A\u786E\u8BA4";
  const readState = (value) => ({ subtitle: "\u5DF2\u53D6\u5F97\u5B57\u5E55\uFF0C\u5C1A\u672A\u7531\u6A21\u578B\u5224\u65AD", "no-subtitle": "\u65E0\u5B57\u5E55\uFF0C\u8DF3\u8FC7", seen: "\u8FD1\u671F\u5DF2\u8BFB\uFF0C\u8DF3\u8FC7", deferred: "\u8FBE\u5230\u672C\u6279\u8BFB\u53D6\u4E0A\u9650", failed: "\u8BFB\u53D6\u5931\u8D25" })[value] ?? value;
  const latestPreview = status?.browseUsage?.latest;
  const curated = latestPreview?.state === "completed" && latestPreview.kind === "curation" ? latestPreview.result : null;
  const limitField = (label, key, min, max) => (0, import_react.createElement)(
    "label",
    { style: { display: "block", margin: "8px 0" } },
    label + " ",
    (0, import_react.createElement)("input", { type: "number", min, max, value: browsePolicy[key], onChange: (e) => {
      policyDirty.current = true;
      setBrowsePolicy((p) => ({ ...p, [key]: Number(e.target.value) }));
    } })
  );
  let videoText = "", reviewLabel = "\u5F85\u590D\u6838", reviewed = false;
  if (status?.videoReview) {
    try {
      const r = JSON.parse(status.videoReview);
      if (r.revision === status.videoInspectionRevision) {
        reviewed = r.decision === "approved";
        reviewLabel = reviewed ? "\u5DF2\u590D\u6838\u901A\u8FC7" : "\u5DF2\u9A73\u56DE\uFF1A" + r.note;
      }
    } catch {
    }
  }
  if (status?.videoInspection) {
    try {
      const v = JSON.parse(status.videoInspection);
      videoText = [v.analysis.summary, ...v.analysis.observations.map((o) => `${o.atSeconds.toFixed(1)} \u79D2\uFF1A${o.description}`), "\u7406\u89E3\u8303\u56F4\uFF1A\u753B\u9762\u91C7\u6837\uFF0C\u97F3\u9891\u672A\u8F6C\u5199\u3002", ...v.analysis.limitations].join("\n");
    } catch {
      videoText = "\u5185\u5BB9\u7406\u89E3\u8BB0\u5F55\u65E0\u6CD5\u8BFB\u53D6\uFF0C\u8BF7\u67E5\u770B\u8BCA\u65AD\u3002";
    }
  }
  return (0, import_react.createElement)(
    "section",
    { "aria-label": "\u5927\u80A5\u9C7C\u8BBE\u7F6E", "data-mode": "pilot", style: { padding: 24, border: "1px solid #71809666", borderRadius: 16, maxWidth: 760 } },
    (0, import_react.createElement)("small", null, "DaFeiYu \xB7 \u5355\u89C6\u9891\u5B9E\u9A8C\u7248"),
    (0, import_react.createElement)("h2", null, "\u5927\u80A5\u9C7C"),
    (0, import_react.createElement)("p", { role: "status" }, status ? `\u65E7\u8BD5\u8DD1\u8BF7\u6C42 ${status.budget.used} / ${status.budget.total} \xB7 \u5386\u53F2\u8BD5\u8DD1\u7D2F\u8BA1 ${status.budget.lifetimeUsed ?? status.budget.used} \xB7 ${status.run?.state ?? "\u5C1A\u672A\u542F\u52A8"} \xB7 15 \u5206\u949F / 1 \u6761\u8BC4\u8BBA / 2 \u6761\u56DE\u590D` : "\u5C1A\u672A\u8FDE\u63A5 Desktop \u8FD0\u884C\u72B6\u6001"),
    error ? (0, import_react.createElement)("p", { role: "alert", style: { color: "#e15b64", overflowWrap: "anywhere" } }, error) : null,
    status?.configError || status?.credentialError ? (0, import_react.createElement)("p", { role: "alert" }, status.configError || status.credentialError) : null,
    notice ? (0, import_react.createElement)("p", null, notice) : null,
    (0, import_react.createElement)(
      "fieldset",
      { disabled: disabled || status?.busy },
      (0, import_react.createElement)("legend", null, "\u8EAB\u4EFD\u3001\u76EE\u6807\u4E0E\u4EBA\u683C\uFF08\u5386\u53F2\u516C\u5F00\u6388\u6743\u4E0D\u53D8\uFF09"),
      field("\u4E3B\u4EBA UID\uFF08\u4E0D\u662F\u673A\u5668\u4EBA\u8D26\u53F7\uFF09", "ownerUid"),
      field("\u76EE\u6807 BV \u53F7", "bvid"),
      field("\u516C\u5F00\u4EBA\u683C", "persona"),
      field("\u8BCA\u65AD\u6807\u8BB0\uFF08\u4EC5\u7528\u4E8E\u914D\u7F6E\u9A8C\u8BC1\uFF09", "diagnosticMarker"),
      button("\u4FDD\u5B58\u8BBE\u7F6E", () => act(async () => {
        await call("saveConfig", { config: draft, revision });
        dirty.current = false;
        setNotice("\u5DF2\u4FDD\u5B58\uFF0C\u5E76\u7531\u5BBF\u4E3B\u8BFB\u53D6\u6838\u5BF9\u3002");
      })),
      button("\u91CD\u65B0\u8BFB\u53D6\u5DF2\u4FDD\u5B58\u914D\u7F6E", () => act(async () => {
        dirty.current = false;
        setPreflight(null);
        await refresh();
        setNotice("\u5DF2\u91CD\u65B0\u8BFB\u53D6\u5BBF\u4E3B\u4FDD\u5B58\u7684\u914D\u7F6E\u3002");
      }))
    ),
    (0, import_react.createElement)("h3", null, "\u4F1A\u8BDD\u6A21\u578B"),
    (0, import_react.createElement)("p", null, status?.modelSelection ? `\u5F53\u524D\uFF1A${status.modelSelection.provider} / ${status.modelSelection.model}\uFF08${status.modelPinned ? "\u56FA\u5B9A\u9009\u62E9" : "\u8DDF\u968F\u5BBF\u4E3B\u9ED8\u8BA4"}\uFF09` : "\u5C1A\u672A\u8BFB\u53D6\u6A21\u578B"),
    button("\u8BFB\u53D6\u5BBF\u4E3B\u6A21\u578B\u5217\u8868", () => act(async () => {
      setModelRows(await call("models"));
    })),
    (0, import_react.createElement)(
      "select",
      { "aria-label": "\u5927\u80A5\u9C7C\u4F1A\u8BDD\u6A21\u578B", value: modelKey, disabled: disabled || !!status?.busy, onChange: (e) => setModelKey(e.target.value), style: { maxWidth: "100%", padding: 8 } },
      (0, import_react.createElement)("option", { value: "" }, "\u8BF7\u9009\u62E9\u56FA\u5B9A\u4F7F\u7528\u7684\u6A21\u578B"),
      ...modelRows.flatMap((p) => p.models.map((m) => (0, import_react.createElement)("option", { key: JSON.stringify([p.provider, m.id]), value: JSON.stringify([p.provider, m.id]) }, p.name + " / " + m.name + (m.inputModalities?.includes("image") ? " \xB7 \u652F\u6301\u56FE\u50CF" : "") + (m.description ? " \xB7 " + m.description : ""))))
    ),
    button("\u4FDD\u5B58\u56FA\u5B9A\u6A21\u578B", () => act(async () => {
      const [provider, model] = JSON.parse(modelKey);
      const result = await call("saveModel", { provider, model });
      setNotice(result.imageSupported ? "\u6A21\u578B\u5DF2\u56FA\u5B9A\uFF1B\u652F\u6301\u753B\u9762\u8F93\u5165\u3002" : "\u6A21\u578B\u5DF2\u56FA\u5B9A\uFF1B\u4E0D\u652F\u6301\u753B\u9762\u65F6\u4F1A\u62D2\u7EDD\u68C0\u770B\uFF0C\u4E0D\u81EA\u52A8\u6362\u6A21\u578B\u3002");
    }), !modelKey || !!status?.busy),
    (0, import_react.createElement)("p", null, "\u540D\u79F0\u548C\u8BF4\u660E\u6765\u81EA\u5BBF\u4E3B\u6A21\u578B\u76EE\u5F55\uFF1B\u4E0D\u81EA\u52A8\u5224\u65AD\u4EF7\u683C\u6216\u5207\u6362\u5907\u7528\u6A21\u578B\u3002\u4FDD\u5B58\u4E0D\u53D1\u8D77\u751F\u6210\u8BF7\u6C42\uFF0C\u4E5F\u4E0D\u91CD\u7F6E\u9884\u7B97\u3002"),
    (0, import_react.createElement)("h3", null, "B\u7AD9\u8D26\u53F7"),
    (0, import_react.createElement)("p", null, status?.account ? `\u5DF2\u4FDD\u5B58\u673A\u5668\u4EBA\u8D26\u53F7 UID\uFF1A${status.account.uid}\uFF08\u8FD0\u884C\u524D\u4F1A\u91CD\u65B0\u9A8C\u8BC1\uFF09` : "\u5C1A\u672A\u767B\u5F55"),
    button("\u626B\u7801\u767B\u5F55 / \u540C\u8D26\u53F7\u91CD\u65B0\u8BA4\u8BC1", () => act(async () => {
      setPreflight(null);
      setQr(await call("loginStart"));
    }), !!status?.busy),
    (0, import_react.createElement)("p", null, "\u91CD\u65B0\u8BA4\u8BC1\u53EA\u80FD\u4F7F\u7528\u5DF2\u7ED1\u5B9A\u7684\u673A\u5668\u4EBA UID\uFF1B\u6CE8\u9500\u6216\u91CD\u767B\u4E0D\u4F1A\u6062\u590D\u8BD5\u8DD1\u3001\u53D1\u9001\u6B21\u6570\u6216\u6A21\u578B\u989D\u5EA6\u3002"),
    button("\u79FB\u9664\u672C\u5730\u767B\u5F55\u51ED\u8BC1", () => act(async () => {
      setQr(null);
      setPreflight(null);
      await call("logout");
    }), !!status?.busy),
    qr ? (0, import_react.createElement)("img", { src: qr.image, alt: "\u7528\u5927\u80A5\u9C7C\u8D26\u53F7\u626B\u63CF B\u7AD9\u767B\u5F55\u4E8C\u7EF4\u7801", width: 240, height: 240 }) : null,
    button("\u53EA\u8BFB\u9884\u68C0", () => act(async () => {
      setPreflight(await call("preflight"));
    }), dirty.current || !status?.account || !!status?.busy),
    preflight ? (0, import_react.createElement)("p", null, `\u8D26\u53F7 ${preflight.account.name}\uFF08${preflight.account.uid}\uFF09 \xB7 ${preflight.video.title} \xB7 \u8BFB\u53D6 ${preflight.commentsRead} \u6761\u8BC4\u8BBA \xB7 ${preflight.video.hasSubtitle ? "\u6709\u5B57\u5E55" : "\u65E0\u5B57\u5E55\uFF0C\u9ED8\u8BA4\u8DF3\u8FC7\u5185\u5BB9\u5224\u65AD\uFF1B\u672A\u4E0B\u8F7D\u5A92\u4F53\u6216\u62BD\u5E27"}`) : null,
    (0, import_react.createElement)("h3", null, "\u6309\u5174\u8DA3\u6D4F\u89C8"),
    (0, import_react.createElement)("p", null, "\u8F93\u5165\u60F3\u4E86\u89E3\u7684\u8BDD\u9898\uFF0C\u624B\u52A8\u6D4F\u89C8\u4E00\u6279\u3002\u6700\u591A\u641C\u7D222\u9875\u3001\u8BFB\u53D63\u4E2A\u65B0\u89C6\u9891\u7684\u5B57\u5E55\uFF0C2\u5206\u949F\u540E\u505C\u6B62\uFF1B\u4E0D\u8C03\u7528\u6A21\u578B\u3001\u4E0D\u4E0B\u8F7D\u89C6\u9891\u3001\u4E0D\u53D1\u5E03\u5185\u5BB9\uFF0C\u4E5F\u4E0D\u6539\u53D8\u4E0A\u9762\u7684\u8BC4\u8BBA\u8BD5\u8DD1\u76EE\u6807\u3002"),
    (0, import_react.createElement)("input", { "aria-label": "\u6D4F\u89C8\u5174\u8DA3\u5173\u952E\u8BCD", value: keyword, maxLength: 80, placeholder: "\u4F8B\u5982\uFF1A\u72EC\u7ACB\u6E38\u620F\u5F00\u53D1", disabled: disabled || !!status?.busy, onChange: (e) => setKeyword(e.target.value), style: { width: "100%", padding: 8, boxSizing: "border-box" } }),
    button("\u641C\u7D22\u5E76\u8BFB\u53D6\u4E00\u6279\u5B57\u5E55", () => act(async () => {
      setBrowsing(true);
      try {
        const result = await call("browse", { keyword, accountUid: status.account.uid });
        setReadings(await call("browseHistory"));
        setNotice(`\u6D4F\u89C8${result.state === "completed" ? "\u5B8C\u6210" : "\u5DF2\u505C\u6B62"}\uFF1A${result.reason}\uFF1B\u6CA1\u6709\u8C03\u7528\u6A21\u578B\u6216\u53D1\u5E03\u5185\u5BB9\u3002`);
      } finally {
        if (mounted.current) setBrowsing(false);
      }
    }), !keyword.trim() || !status?.account || !!status?.busy || dirty.current),
    (0, import_react.createElement)("button", { type: "button", disabled: !ctx || !(browsing || status?.browseBusy), onClick: () => {
      void call("stop").then(() => refresh()).catch((e) => setError(e instanceof Error ? e.message : "\u505C\u6B62\u5931\u8D25"));
    }, style: { padding: "8px 14px" } }, "\u505C\u6B62\u672C\u6279\u6D4F\u89C8"),
    button("\u8BFB\u53D6\u6700\u8FD1\u6D4F\u89C8\u8BB0\u5F55", () => act(async () => {
      setReadings(await call("browseHistory"));
    })),
    (0, import_react.createElement)("p", null, "\u6700\u8FD1200\u4E2A\u89C6\u9891\u7528\u4E8E\u5224\u91CD\uFF0C\u6700\u8FD120\u4E2A\u6279\u6B21\u4FDD\u7559\u7ED3\u679C\uFF1B\u65E7\u8BB0\u5F55\u81EA\u52A8\u6DD8\u6C70\uFF0C\u6DD8\u6C70\u540E\u53EF\u80FD\u91CD\u65B0\u8BFB\u53D6\u3002\u9875\u9762\u5C55\u793A\u6700\u8FD110\u4E2A\u89C6\u9891\uFF0C\u5B57\u5E55\u6700\u591A\u4FDD\u755920000\u5B57\uFF1B\u6CA1\u6709\u56FE\u7247\u7F13\u5B58\u3002\u6279\u6B21\u95F4\u81F3\u5C11\u95F4\u969460\u79D2\uFF0C\u91CD\u542F\u4E0D\u7EED\u8DD1\u3002"),
    status?.browseRun ? (0, import_react.createElement)(
      "div",
      { role: "status" },
      (0, import_react.createElement)("p", null, `\u6700\u8FD1\u4E00\u6279\u300C${status.browseRun.keyword}\u300D\uFF1A${status.browseRun.state} \xB7 ${status.browseRun.reason} \xB7 \u641C\u7D22${status.browseRun.pages}\u9875 / \u5C1D\u8BD5\u8BFB\u53D6${status.browseRun.read}\u4E2A`),
      ...status.browseRun.items.map((item) => (0, import_react.createElement)("p", { key: item.bvid }, (0, import_react.createElement)("a", { href: `https://www.bilibili.com/video/${item.bvid}/`, target: "_blank", rel: "noreferrer" }, item.title), " \xB7 " + readState(item.state)))
    ) : null,
    ...readings.map((item) => (0, import_react.createElement)(
      "details",
      { key: `${item.accountUid}:${item.bvid}` },
      (0, import_react.createElement)("summary", null, item.title + " \xB7 " + readState(item.state)),
      (0, import_react.createElement)("p", null, `UP\u4E3B\uFF1A${item.author} \xB7 ${new Date(item.at).toLocaleString()}${item.truncated ? " \xB7 \u5B57\u5E55\u8FBE\u5230\u4FDD\u7559\u4E0A\u9650\uFF0C\u53EF\u80FD\u622A\u65AD" : ""}`),
      (0, import_react.createElement)("a", { href: `https://www.bilibili.com/video/${item.bvid}/`, target: "_blank", rel: "noreferrer" }, "\u6253\u5F00\u6765\u6E90\u89C6\u9891"),
      (0, import_react.createElement)("p", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 300, overflow: "auto" } }, item.subtitle ?? "\u6CA1\u6709\u5B57\u5E55\uFF0C\u672A\u4E0B\u8F7D\u5A92\u4F53\u6216\u63A8\u6D4B\u89C6\u9891\u5185\u5BB9\u3002")
    )),
    (0, import_react.createElement)("h3", null, "\u7CBE\u9009\u4E0E\u8349\u7A3F \xB7 \u4EC5\u9884\u89C8"),
    (0, import_react.createElement)("p", null, "\u6CBF\u7528\u53C2\u8003\u9879\u76EE\u7684\u53D6\u820D\uFF1A\u503C\u5F97\u5360\u7528\u4E00\u6B21\u6CE8\u610F\u529B\u624D\u7CBE\u9009\uFF0C\u53EF\u4EE5\u5168\u90E8\u8DF3\u8FC7\u3002\u6BCF\u65E5\u989D\u5EA6\u6309\u5317\u4EAC\u65F6\u95F4\u7EDF\u8BA1\u7CBE\u9009\u89C6\u9891\uFF0C\u6D4F\u89C8\u548C\u6A21\u578B\u8BF7\u6C42\u53E6\u8BA1\u3002"),
    (0, import_react.createElement)(
      "fieldset",
      { disabled: disabled || !!status?.busy },
      (0, import_react.createElement)("legend", null, "\u6D4F\u89C8\u989D\u5EA6\u4E0E\u56DE\u590D\u89C4\u5219"),
      limitField("\u6BCF\u5929\u6700\u591A\u7CBE\u9009\uFF080\u8868\u793A\u6682\u505C\u7CBE\u9009\uFF09", "perDay", 0, 50),
      limitField("\u6BCF\u8F6E\u6700\u591A\u8BC4\u8BBA\u8349\u7A3F\uFF080\u8868\u793A\u4E0D\u751F\u6210\uFF09", "commentPerRound", 0, 20),
      limitField("\u6BCF\u8F6E\u6700\u591A\u56DE\u590D\u8349\u7A3F", "replyPerRound", 1, 10),
      button("\u4FDD\u5B58\u6D4F\u89C8\u9650\u989D", () => act(async () => {
        await call("saveBrowsePolicy", { policy: browsePolicy, revision: policyRevision });
        policyDirty.current = false;
        setNotice("\u6D4F\u89C8\u9650\u989D\u5DF2\u4FDD\u5B58\uFF0C\u5DF2\u6709\u6D88\u8017\u4FDD\u7559\uFF1B\u672A\u8C03\u7528\u6A21\u578B\u6216\u5F00\u542F\u53D1\u9001\u3002");
      }), !policyRevision),
      button("\u91CD\u65B0\u8BFB\u53D6\u6D4F\u89C8\u9650\u989D", () => act(async () => {
        policyDirty.current = false;
        await refresh();
      }))
    ),
    (0, import_react.createElement)("p", null, "\u81EA\u52A8\u8BC4\u8BBA\uFF1A\u5173\u95ED\uFF1B\u81EA\u52A8\u56DE\u590D\uFF1A\u5173\u95ED\u3002\u8BC4\u8BBA\u8349\u7A3F\u6700\u591A150\u5B57\uFF0C\u56DE\u590D\u6700\u591A100\u5B57\u3002\u540C\u4E00\u4EBA\u540C\u4E00\u7EBF\u7A0B\u53EA\u5904\u7406\u4E00\u6B21\uFF1B\u53EA\u63A5\u53D7\u76F4\u63A5\u56DE\u590D\u81EA\u5DF1\u8BC4\u8BBA\u7684\u7B80\u77ED\u95EE\u9898\u6216\u8F7B\u677E\u4E92\u52A8\uFF0C\u957F\u7BC7\u7D22\u53D6\u3001\u9690\u79C1\u3001\u4E89\u5435\u548C\u8FDE\u7EED\u8FFD\u95EE\u8DF3\u8FC7\u3002\u56DE\u590D\u7B5B\u9009\u5185\u6838\u5DF2\u63A5\u5165\u6D4B\u8BD5\uFF0C\u771F\u5B9E\u56DE\u590D\u8F6E\u8BE2\u5C1A\u672A\u5F00\u653E\u3002"),
    status?.browseUsage ? (0, import_react.createElement)("p", { role: "status" }, `${status.browseUsage.day}\uFF08\u5317\u4EAC\u65F6\u95F4\uFF09\u5DF2\u7CBE\u9009 ${status.browseUsage.picked} / ${status.browseSettings?.policy.perDay ?? 5}\uFF1B\u9884\u89C8\u6A21\u5757\u6A21\u578B\u8BF7\u6C42\uFF1A\u4ECA\u65E5 ${status.browseUsage.todayRequests}\uFF0C\u7D2F\u8BA1 ${status.browseUsage.requests}\u3002\u6B64\u524D\u8BD5\u8DD1\u53CA\u4E00\u6B21\u6027\u8349\u7A3F\u8BF7\u6C42\u5355\u72EC\u4FDD\u7559\u3002`) : null,
    button("\u7B5B\u9009\u6700\u8FD1\u4E00\u6279\u5E76\u6253\u5370\u8349\u7A3F\uFF081\u6B21\u6A21\u578B\u8BF7\u6C42\uFF09", () => act(async () => {
      const result = await call("curateBrowse", { runId: status.browseRun.id, accountUid: status.account.uid });
      setNotice(`\u672C\u6279\u9884\u89C8${result.state === "completed" ? "\u5B8C\u6210" : "\u7ED3\u675F"}\uFF0C\u7ED3\u679C\u663E\u793A\u5728\u4E0B\u65B9\uFF1B\u6CA1\u6709\u53D1\u9001\u3002`);
    }), !status?.account || status?.browseRun?.state !== "completed" || !status.browseRun.items.some((i) => i.state === "subtitle") || !!status?.busy || policyDirty.current || (status?.browseUsage?.remaining ?? 0) === 0 || latestPreview?.source === status?.browseRun?.id),
    (0, import_react.createElement)("p", null, "\u6BCF\u6279\u6700\u591A\u4E00\u6B21\u6A21\u578B\u8BF7\u6C42\uFF0C2048\u8F93\u51FAtokens\uFF1B\u5931\u8D25\u4E5F\u8BB0\u6B21\u6570\uFF0C\u4E0D\u81EA\u52A8\u91CD\u8BD5\u3002\u505C\u6B62\u540E\u4E0D\u6062\u590D\uFF0C\u540C\u4E00\u6279\u4E0D\u80FD\u91CD\u590D\u751F\u6210\u3002\u5B57\u5E55\u53EF\u80FD\u53EA\u8986\u76D6\u9996\u4E2A\u5206P\u6216\u7247\u6BB5\uFF0C\u4E0D\u80FD\u5F53\u4F5C\u5B8C\u6574\u89C2\u770B\u3002"),
    latestPreview ? (0, import_react.createElement)("p", null, `\u6700\u8FD1\u9884\u89C8\uFF1A${latestPreview.state}${latestPreview.reason ? " \xB7 " + latestPreview.reason : ""} \xB7 \u6A21\u578B\u8BF7\u6C42${latestPreview.requested ? "\u5DF2\u9884\u7EA6\u8BA1\u6570" : "\u672A\u53D1\u8D77"}`) : null,
    ...(curated?.videos ?? []).map((v) => (0, import_react.createElement)(
      "article",
      { key: v.bvid, style: { borderTop: "1px solid #71809666", padding: "10px 0" } },
      (0, import_react.createElement)("a", { href: `https://www.bilibili.com/video/${v.bvid}/`, target: "_blank", rel: "noreferrer" }, v.bvid),
      (0, import_react.createElement)("p", null, (v.pick ? "\u7CBE\u9009\uFF1A" : "\u8DF3\u8FC7\uFF1A") + v.reason),
      (0, import_react.createElement)("p", null, "\u5927\u80A5\u9C7C\u7684\u611F\u60F3\uFF1A" + v.thought),
      (0, import_react.createElement)("p", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" } }, v.comment ? "\u8BC4\u8BBA\u8349\u7A3F\uFF08\u672A\u53D1\u9001\uFF09\uFF1A" + v.comment : "\u672C\u6761\u6CA1\u6709\u8BC4\u8BBA\u8349\u7A3F\u3002")
    )),
    (0, import_react.createElement)("h3", null, "\u89C6\u9891\u5185\u5BB9"),
    (0, import_react.createElement)("p", null, status?.diagnostic.decoderAvailable ? "\u753B\u9762\u89E3\u7801\u5668\u53EF\u7528\uFF08FFmpeg / ffprobe\uFF09\u3002" : "\u672A\u68C0\u6D4B\u5230 FFmpeg / ffprobe\uFF1A\u53EF\u6B63\u5E38\u8BFB\u53D6\u5B57\u5E55\uFF0C\u753B\u9762\u5206\u6790\u6682\u4E0D\u53EF\u7528\u3002\u63D2\u4EF6\u4E0D\u4F1A\u81EA\u52A8\u5B89\u88C5\u5916\u90E8\u7A0B\u5E8F\u3002"),
    (0, import_react.createElement)("p", null, "\u539F\u89C6\u9891\u4E34\u65F6\u6587\u4EF6\u5904\u7406\u540E\u5220\u9664\uFF1B\u9884\u89C8\u4E0D\u53E6\u5B58\u56FE\u7247\u3002\u4EA4\u7ED9\u6A21\u578B\u7684\u56FE\u50CF\u7531 DSH \u4FDD\u5B58\u4E3A\u4F1A\u8BDD\u9644\u4EF6\uFF0C\u5F53\u524D\u6CA1\u6709\u81EA\u52A8\u6E05\u7406\u7B56\u7565\u3002\u4E00\u6B21\u53EA\u8BFB\u6821\u51C6\u6700\u591A\u63D0\u4EA43\u5E27\u3002"),
    (0, import_react.createElement)("p", null, "\u5E73\u65F6\u53EA\u8BFB\u5B57\u5E55\uFF0C\u4E0D\u81EA\u52A8\u62BD\u5E27\u3002\u4E3B\u4EBA\u5728\u6307\u5B9A\u89C6\u9891\u6216\u5927\u80A5\u9C7C\u81EA\u5DF1\u7684\u8BC4\u8BBA\u4E0B\u771F\u5B9E @ \u5B83\uFF0C\u7528\u81EA\u7136\u8BED\u8A00\u8BF4\u201C\u5E2E\u6211\u770B\u770B\u8FD9\u4E2A\u89C6\u9891\u91CC\u53D1\u751F\u4E86\u4EC0\u4E48\u201D\u7B49\u5373\u53EF\u3002\u6309 UID \u9A8C\u8BC1\uFF0C\u660E\u786E\u8981\u6C42\u68C0\u770B\u624D\u653E\u884C\u3002\u5F53\u524D\u624B\u52A8\u68C0\u67E5\u6709\u9650\u9875\u8BC4\u8BBA\uFF0C\u5C1A\u672A\u63A5\u5165\u5168\u7AD9@\u901A\u77E5\u3002"),
    button(status?.ownerVideoBaselineAt ? "\u68C0\u67E5\u4E3B\u4EBA @ \u68C0\u770B\u8BF7\u6C42" : "\u5EFA\u7ACB\u4E3B\u4EBA @ \u8BF7\u6C42\u57FA\u7EBF", () => act(async () => {
      const result = await call("checkOwnerRequest");
      setNotice(result.found ? "\u5DF2\u6838\u9A8C\u4E3B\u4EBA\u68C0\u770B\u6307\u4EE4\uFF1B\u53EF\u5728\u73B0\u6709\u989D\u5EA6\u5185\u663E\u5F0F\u6267\u884C\uFF0C\u5C1A\u672A\u62BD\u5E27\u6216\u8C03\u7528\u6A21\u578B\u3002" : "\u672A\u53D1\u73B0\u57FA\u7EBF\u4E4B\u540E\u7684\u65B0\u6307\u4EE4\uFF1B\u6CA1\u6709\u62BD\u5E27\u6216\u8C03\u7528\u6A21\u578B\u3002");
    }), !!status?.busy || !status?.account),
    (0, import_react.createElement)("p", null, status?.ownerVideoRequest ? "\u5DF2\u8BB0\u5F55\u4E3B\u4EBA\u68C0\u770B\u8BF7\u6C42\uFF1B\u6267\u884C\u524D\u4F1A\u518D\u6B21\u6838\u9A8C\u539F\u8BC4\u8BBA\u3002" : "\u5C1A\u65E0\u5DF2\u6838\u9A8C\u7684\u4E3B\u4EBA\u68C0\u770B\u8BF7\u6C42\u3002"),
    button("\u6267\u884C\u4E3B\u4EBA\u68C0\u770B\u8BF7\u6C42\uFF081 \u6B21\u6A21\u578B\u8BF7\u6C42\uFF09", () => act(async () => {
      await call("inspectVideo");
      setNotice("\u89C6\u9891\u5185\u5BB9\u7406\u89E3\u5DF2\u4FDD\u5B58\uFF1B\u672A\u53D1\u9001\u8BC4\u8BBA\u3002");
    }), !status?.ownerVideoRequest || dirty.current || !status?.account || !!status?.busy || !!status?.videoInspection || status?.budget.grant === "media-trial-2" || (status?.budget.used ?? 5) >= 5 || (status?.budget.byPurpose.public ?? 3) >= 3),
    videoText ? (0, import_react.createElement)(
      "div",
      null,
      (0, import_react.createElement)("h4", null, "\u6A21\u578B\u5206\u6790 \xB7 " + reviewLabel),
      (0, import_react.createElement)("p", null, "\u6536\u5230\u56FE\u50CF\u548C\u8FD4\u56DE\u7B54\u6848\u4E0D\u4EE3\u8868\u7406\u89E3\u6B63\u786E\u3002\u8BF7\u5BF9\u7167\u539F\u5E27\u68C0\u67E5\u5177\u4F53\u63CF\u8FF0\uFF1B\u753B\u9762\u59FF\u6001\u3001\u8FDE\u7EED\u52A8\u4F5C\u548C\u56E0\u679C\u53EF\u80FD\u88AB\u8BEF\u8BFB\u3002"),
      (0, import_react.createElement)("p", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" } }, videoText),
      status?.mediaTrialConsumed ? button("\u6539\u7528\u5269\u4F59\u989D\u5EA6\u505A\u4E00\u6B21\u53EA\u8BFB\u6821\u51C6", () => act(async () => {
        await call("calibrateVideo", { revision: status.videoInspectionRevision, reallocateOnePublicRequest: true });
        setEvidence(null);
        setNotice("\u6821\u51C6\u5206\u6790\u5DF2\u4FDD\u5B58\uFF0C\u4ECD\u5F85\u539F\u5E27\u590D\u6838\uFF1B\u6CA1\u6709\u6062\u590D\u8BD5\u8DD1\u6216\u53D1\u9001\u3002");
      }), !status?.ownerVideoRequest || !!status?.busy || status?.run?.state !== "cancelled" || !reviewLabel.startsWith("\u5DF2\u9A73\u56DE") || !!status?.videoCalibrationConsumed || (status?.budget.byPurpose.public ?? 3) >= 3 || (status?.budget.used ?? 4) >= 4) : null,
      button("\u52A0\u8F7D\u539F\u5E27\u5BF9\u7167\uFF08\u4E0D\u8C03\u7528\u6A21\u578B\uFF09", () => act(async () => {
        setEvidence(await call("videoEvidence"));
      }), !status?.ownerVideoRequest || !!status?.busy),
      evidence && evidence.revision === status?.videoInspectionRevision ? (0, import_react.createElement)(
        "div",
        null,
        (0, import_react.createElement)("div", { style: { display: "flex", flexWrap: "wrap", gap: 12 } }, ...evidence.frames.map((f, i) => (0, import_react.createElement)("figure", { key: i, style: { margin: 0, maxWidth: 340 } }, (0, import_react.createElement)("img", { src: f.image, alt: `\u89C6\u9891\u539F\u5E27 ${f.atSeconds.toFixed(3)} \u79D2`, width: 320, style: { maxWidth: "100%", height: "auto" } }), (0, import_react.createElement)("figcaption", null, `${f.atSeconds.toFixed(3)} \u79D2`)))),
        evidence.subtitle ? (0, import_react.createElement)("p", { style: { whiteSpace: "pre-wrap" } }, evidence.subtitle) : null,
        (0, import_react.createElement)("textarea", { "aria-label": "\u89C6\u9891\u590D\u6838\u5907\u6CE8", value: reviewNote, maxLength: 1e3, placeholder: "\u8BB0\u4E0B\u8BEF\u8BFB\u6216\u590D\u6838\u4F9D\u636E\uFF08\u4EC5\u5B58\u672C\u5730\uFF0C\u4E0D\u8FDB\u5165\u6A21\u578B\uFF09", onChange: (e) => setReviewNote(e.target.value), style: { width: "100%", minHeight: 60 } }),
        button("\u63CF\u8FF0\u4E0E\u539F\u5E27\u4E00\u81F4\uFF0C\u6807\u8BB0\u901A\u8FC7", () => act(async () => {
          await call("reviewVideo", { revision: evidence.revision, decision: "approved", note: reviewNote });
          setNotice("\u89C6\u9891\u63CF\u8FF0\u5DF2\u590D\u6838\uFF1B\u672A\u542F\u52A8\u8BD5\u8DD1\u3002");
        }), !!status?.busy),
        button("\u53D1\u73B0\u8BEF\u8BFB\uFF0C\u9A73\u56DE\u6B64\u5206\u6790", () => act(async () => {
          await call("reviewVideo", { revision: evidence.revision, decision: "rejected", note: reviewNote });
          setNotice("\u5206\u6790\u5DF2\u9A73\u56DE\uFF0C\u4E0D\u80FD\u636E\u6B64\u542F\u52A8\u65B0\u8BD5\u8DD1\u3002");
        }), !!status?.busy)
      ) : null
    ) : null,
    (0, import_react.createElement)("h3", null, "\u4E3B\u4EBA\u4F1A\u8BDD"),
    (0, import_react.createElement)("p", null, status?.privateBudget ? `\u72EC\u7ACB\u79C1\u804A\u989D\u5EA6\uFF1A\u5DF2\u7528 ${status.privateBudget.used} / ${status.privateBudget.limit}\uFF0C\u5269\u4F59 ${status.privateBudget.remaining}\uFF1B\u7D2F\u8BA1 ${status.privateBudget.lifetimeUsed}\u3002\u6BCF\u6B21\u6700\u591A ${status.privateBudget.outputTokens} \u8F93\u51FA tokens\u3002` : "\u5148\u4FDD\u5B58\u4E3B\u4EBA UID\uFF1B\u79C1\u804A\u4E0D\u9700\u8981\u76EE\u6807 BV \u6216 B\u7AD9\u767B\u5F55\u3002"),
    (0, import_react.createElement)("p", null, "\u79C1\u804A\u989D\u5EA6\u4E0E\u516C\u5F00\u8BD5\u8DD1\u72EC\u7ACB\uFF0C\u5931\u8D25\u8BA1\u6B21\u3001\u505C\u6B62\u6216\u91CD\u542F\u4E0D\u8865\u989D\u3002\u76EE\u524D\u672A\u5F00\u653E\u65B0\u589E\u989D\u5EA6\uFF0C\u9ED8\u8BA4\u89C4\u5219\u5F85\u4E3B\u4EBA\u786E\u8BA4\uFF1B\u65E7\u516C\u5F00\u9884\u7B97\u4E0E\u8BB0\u5F55\u4FDD\u6301\u3002"),
    (0, import_react.createElement)("textarea", { value: chat, onChange: (e) => setChat(e.target.value), maxLength: 4e3, "aria-label": "\u7ED9\u5927\u80A5\u9C7C\u7684\u6D88\u606F", style: { width: "100%", minHeight: 70 } }),
    button("\u53D1\u9001\u5230\u5927\u80A5\u9C7C\u4F1A\u8BDD", () => act(async () => {
      const result = await call("chat", { text: chat });
      setAnswer(result.text);
    }), !chat.trim() || !status?.privateBudget?.enabled || !!status?.busy),
    answer ? (0, import_react.createElement)("p", { style: { whiteSpace: "pre-wrap" } }, answer) : null,
    status?.privateSessionId ? (0, import_react.createElement)("p", null, "\u6301\u4E45\u4F1A\u8BDD\u5DF2\u5EFA\u7ACB\uFF0C\u53EF\u5728\u4FA7\u680F\u6253\u5F00\u300C\u5927\u80A5\u9C7C \xB7 \u4E3B\u4EBA\u4F1A\u8BDD\u300D\u3002") : null,
    (0, import_react.createElement)("h3", null, "\u9650\u5B9A\u89C6\u9891\u8BD5\u8DD1"),
    (0, import_react.createElement)("p", null, "\u542F\u52A8\u5373\u5141\u8BB8\u5728\u4E0A\u8FF0\u89C6\u9891\u516C\u5F00\u53D1\u8A00\uFF0C\u6700\u591A 1 \u6761\u8BC4\u8BBA\u548C 2 \u6761\u76F4\u63A5\u56DE\u590D\uFF1B\u5355\u6761\u6700\u591A 150 \u5B57\u3002\u5230\u671F\u3001\u53D6\u6D88\u6216\u91CD\u542F\u4E0D\u7EED\u8DD1\uFF0C\u989D\u5EA6\u4E0D\u81EA\u52A8\u91CD\u7F6E\u3002"),
    button("\u542F\u52A8\u4E00\u6B21 15 \u5206\u949F\u8BD5\u8DD1", () => act(async () => {
      await call("start", { revision: preflight.revision, accountUid: preflight.account.uid });
      setNotice("\u8BD5\u8DD1\u5DF2\u542F\u52A8\u3002");
    }), !preflight || dirty.current || preflight.revision !== status?.revision || !!status?.trialConsumed || !!status?.busy),
    status?.trialConsumed ? (0, import_react.createElement)("p", null, "\u5B8C\u6210\u89C6\u9891\u5185\u5BB9\u7406\u89E3\u540E\uFF0C\u53EF\u624B\u52A8\u542F\u52A8\u83B7\u51C6\u7684\u7B2C\u4E8C\u6B21\u8BD5\u8DD1\uFF1A\u76F8\u540C\u8D26\u53F7\u548C\u89C6\u9891\uFF0C15 \u5206\u949F\u30011 \u8BC4\u8BBA/2 \u56DE\u590D\uFF0C\u72EC\u7ACB\u65B0\u589E 4 \u6B21\u8BF7\u6C42\uFF08\u516C\u5F00\u5224\u65AD 3 \u6B21\u3001\u6C47\u62A5 1 \u6B21\uFF09\u3002\u65E7\u8BB0\u5F55\u4FDD\u7559\uFF0C\u672C\u6B21\u4ECD\u53EA\u80FD\u542F\u52A8\u4E00\u6B21\u3002") : null,
    status?.trialConsumed ? button("\u542F\u52A8\u7B2C\u4E8C\u6B21\u5A92\u4F53\u8BD5\u8DD1\uFF0815 \u5206\u949F\uFF09", () => act(async () => {
      await call("startMediaTrial", { revision: preflight.revision, accountUid: preflight.account.uid });
      setNotice("\u7B2C\u4E8C\u6B21\u8BD5\u8DD1\u5DF2\u542F\u52A8\uFF0C\u65E7\u8BB0\u5F55\u5DF2\u4FDD\u7559\u3002");
    }), !preflight || dirty.current || preflight.revision !== status?.revision || !status?.videoInspection || !reviewed || !!status?.mediaTrialConsumed || !!status?.busy) : null,
    (0, import_react.createElement)("button", { type: "button", disabled: !ctx || !status?.busy, onClick: () => {
      void call("stop").then(() => {
        setNotice("\u5DF2\u505C\u6B62\uFF1B\u4E0D\u4F1A\u7EED\u8DD1\u6216\u8865\u5145\u989D\u5EA6\u3002");
        return refresh();
      }).catch((e) => setError(e instanceof Error ? e.message : "\u505C\u6B62\u5931\u8D25"));
    }, style: { padding: "8px 14px" } }, "\u7ACB\u5373\u505C\u6B62"),
    button("\u4EC5\u6838\u5BF9\u53D1\u9001\u56DE\u6267", () => act(async () => {
      await call("reconcile");
    }), !!status?.busy),
    ...(status?.actions ?? []).map((a) => (0, import_react.createElement)(
      "article",
      { key: a.id, style: { borderTop: "1px solid #71809666", paddingTop: 12, marginTop: 12 } },
      (0, import_react.createElement)("p", null, a.text),
      (0, import_react.createElement)("p", null, `${a.state} \xB7 \u672C\u4EBA\u53EF\u89C1\uFF1A${visible(a.selfVisible)} \xB7 \u516C\u5F00\u53EF\u89C1\uFF1A${visible(a.publicVisible)}`),
      a.remoteId ? (0, import_react.createElement)("a", { href: `https://www.bilibili.com/video/${status.config.bvid}/#reply${a.remoteId}`, target: "_blank", rel: "noreferrer" }, "\u67E5\u770B\u8BC4\u8BBA") : null
    )),
    status?.run?.reason ? (0, import_react.createElement)("p", null, "\u7ED3\u675F\u6216\u6682\u505C\u539F\u56E0\uFF1A" + status.run.reason) : null,
    status?.reportError ? (0, import_react.createElement)("p", null, "\u6C47\u62A5\u672A\u5B8C\u6210\uFF1A" + status.reportError) : null,
    (0, import_react.createElement)("p", { style: { fontSize: 12, opacity: 0.8 } }, "\u8D26\u53F7\u51ED\u8BC1\u7531 Windows \u5F53\u524D\u7528\u6237\u52A0\u5BC6\u4FDD\u62A4\u3002\u8BD5\u8DD1\u8BB0\u5F55\u4FDD\u5B58\u5728\u672C\u5730\uFF1B\u6A21\u578B\u4E0A\u4E0B\u6587\u548C\u804A\u5929\u8BB0\u5F55\u9075\u5FAA DSH \u7684\u4F1A\u8BDD\u4FDD\u7559\u8BBE\u7F6E\u3002"),
    status ? (0, import_react.createElement)("small", null, `\u7248\u672C ${status.diagnostic.version} \xB7 \u914D\u7F6E\u8BCA\u65AD\uFF1A${status.diagnostic.marker || "\u672A\u8BBE\u7F6E\u6807\u8BB0"}`) : null
  );
}
function DetailSection({ subject, ctx }) {
  if (!subject) return null;
  const matches = subject.kind === "bundle" || subject.kind === "row" ? subject.pkg?.name === "dsh-dafeiyu" : subject.kind === "item" && subject.id === "dafeyu";
  return matches ? (0, import_react.createElement)(SettingsPanel, ctx ? { ctx } : {}) : null;
}
async function apply(ctx) {
  const unmount = await ctx.remote.$mount(REMOTE);
  const view = ctx.inject(["slots", "remote.dafeyu"], (ready) => {
    ready.slots.inject("plugins.detail.section", () => ready.slots.register({
      name: "plugins.detail.section",
      id: "dafeyu-pilot",
      order: 80
    }, (props) => (0, import_react.createElement)(DetailSection, { ...props, ctx: ready })));
  });
  return async () => {
    await view.dispose();
    await unmount();
  };
}

return module.exports;
} });
