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
var import_zod = require("zod");

// node_modules/@deepseek-ai/dsh-typert-protocol/lib/types/remote-info.js
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

// src/shared/remote.ts
var configSchema = import_zod.z.object({ ownerUid: import_zod.z.string().max(25), bvid: import_zod.z.string().max(12), persona: import_zod.z.string().max(2e3), diagnosticMarker: import_zod.z.string().max(80) }).strict();
var REQUESTS = {
  status: import_zod.z.object({}).strict(),
  saveConfig: import_zod.z.object({ config: configSchema, revision: import_zod.z.string().max(64) }).strict(),
  loginStart: import_zod.z.object({}).strict(),
  loginPoll: import_zod.z.object({ loginId: import_zod.z.string().uuid() }).strict(),
  logout: import_zod.z.object({}).strict(),
  preflight: import_zod.z.object({}).strict(),
  chat: import_zod.z.object({ text: import_zod.z.string().min(1).max(4e3) }).strict(),
  start: import_zod.z.object({ revision: import_zod.z.string().max(64), accountUid: import_zod.z.string().regex(/^[1-9]\d{0,24}$/) }).strict(),
  stop: import_zod.z.object({}).strict(),
  reconcile: import_zod.z.object({}).strict()
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
      result: { mode: "strict", typeSymbol: `dsh-dafeiyu#${method}:result`, create: () => import_zod.z.json() }
    };
    return [`dafeyu/${method}`, spec];
  }))
}, import_zod.z);

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
  return (0, import_react.createElement)(
    "section",
    { "aria-label": "\u5927\u80A5\u9C7C\u8BBE\u7F6E", "data-mode": "pilot", style: { padding: 24, border: "1px solid #71809666", borderRadius: 16, maxWidth: 760 } },
    (0, import_react.createElement)("small", null, "DaFeiYu \xB7 \u5355\u89C6\u9891\u5B9E\u9A8C\u7248"),
    (0, import_react.createElement)("h2", null, "\u5927\u80A5\u9C7C"),
    (0, import_react.createElement)("p", { role: "status" }, status ? `\u6A21\u578B\u8BF7\u6C42 ${status.budget.used} / 5 \xB7 ${status.run?.state ?? "\u5C1A\u672A\u542F\u52A8"} \xB7 15 \u5206\u949F / 1 \u6761\u8BC4\u8BBA / 2 \u6761\u56DE\u590D` : "\u5C1A\u672A\u8FDE\u63A5 Desktop \u8FD0\u884C\u72B6\u6001"),
    error ? (0, import_react.createElement)("p", { role: "alert", style: { color: "#e15b64", overflowWrap: "anywhere" } }, error) : null,
    status?.configError || status?.credentialError ? (0, import_react.createElement)("p", { role: "alert" }, status.configError || status.credentialError) : null,
    notice ? (0, import_react.createElement)("p", null, notice) : null,
    (0, import_react.createElement)(
      "fieldset",
      { disabled: disabled || status?.busy || status?.trialConsumed },
      (0, import_react.createElement)("legend", null, "\u8EAB\u4EFD\u4E0E\u76EE\u6807"),
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
    (0, import_react.createElement)("h3", null, "B\u7AD9\u8D26\u53F7"),
    (0, import_react.createElement)("p", null, status?.account ? `\u5DF2\u4FDD\u5B58\u673A\u5668\u4EBA\u8D26\u53F7 UID\uFF1A${status.account.uid}\uFF08\u8FD0\u884C\u524D\u4F1A\u91CD\u65B0\u9A8C\u8BC1\uFF09` : "\u5C1A\u672A\u767B\u5F55"),
    button("\u626B\u7801\u767B\u5F55", () => act(async () => {
      setPreflight(null);
      setQr(await call("loginStart"));
    }), !!status?.trialConsumed || !!status?.busy),
    button("\u79FB\u9664\u672C\u5730\u767B\u5F55\u51ED\u8BC1", () => act(async () => {
      setQr(null);
      setPreflight(null);
      await call("logout");
    }), !!status?.busy),
    qr ? (0, import_react.createElement)("img", { src: qr.image, alt: "\u7528\u5927\u80A5\u9C7C\u8D26\u53F7\u626B\u63CF B\u7AD9\u767B\u5F55\u4E8C\u7EF4\u7801", width: 240, height: 240 }) : null,
    button("\u53EA\u8BFB\u9884\u68C0", () => act(async () => {
      setPreflight(await call("preflight"));
    }), dirty.current || !status?.account || !!status?.busy),
    preflight ? (0, import_react.createElement)("p", null, `\u8D26\u53F7 ${preflight.account.name}\uFF08${preflight.account.uid}\uFF09 \xB7 ${preflight.video.title} \xB7 \u8BFB\u53D6 ${preflight.commentsRead} \u6761\u8BC4\u8BBA \xB7 ${preflight.video.hasSubtitle ? "\u6709\u5B57\u5E55" : "\u65E0\u5B57\u5E55\uFF0C\u4E0D\u4F1A\u58F0\u79F0\u770B\u5B8C\u89C6\u9891"}`) : null,
    (0, import_react.createElement)("h3", null, "\u4E3B\u4EBA\u4F1A\u8BDD"),
    (0, import_react.createElement)("p", null, "\u9996\u6B21\u9A8C\u6536\u9884\u7559 1 \u6B21\u79C1\u804A\u8BF7\u6C42\uFF1B\u6D3B\u52A8\u7ED3\u675F\u7684\u6C47\u62A5\u53E6\u9884\u7559 1 \u6B21\u3002"),
    (0, import_react.createElement)("textarea", { value: chat, onChange: (e) => setChat(e.target.value), maxLength: 4e3, "aria-label": "\u7ED9\u5927\u80A5\u9C7C\u7684\u6D88\u606F", style: { width: "100%", minHeight: 70 } }),
    button("\u53D1\u9001\u5230\u5927\u80A5\u9C7C\u4F1A\u8BDD", () => act(async () => {
      const result = await call("chat", { text: chat });
      setAnswer(result.text);
    }), !chat.trim() || !!status?.budget.byPurpose.private || !!status?.busy),
    answer ? (0, import_react.createElement)("p", { style: { whiteSpace: "pre-wrap" } }, answer) : null,
    status?.privateSessionId ? (0, import_react.createElement)("p", null, "\u6301\u4E45\u4F1A\u8BDD\u5DF2\u5EFA\u7ACB\uFF0C\u53EF\u5728\u4FA7\u680F\u6253\u5F00\u300C\u5927\u80A5\u9C7C \xB7 \u4E3B\u4EBA\u4F1A\u8BDD\u300D\u3002") : null,
    (0, import_react.createElement)("h3", null, "\u9650\u5B9A\u89C6\u9891\u8BD5\u8DD1"),
    (0, import_react.createElement)("p", null, "\u542F\u52A8\u5373\u5141\u8BB8\u5728\u4E0A\u8FF0\u89C6\u9891\u516C\u5F00\u53D1\u8A00\uFF0C\u6700\u591A 1 \u6761\u8BC4\u8BBA\u548C 2 \u6761\u76F4\u63A5\u56DE\u590D\uFF1B\u5355\u6761\u6700\u591A 150 \u5B57\u3002\u5230\u671F\u3001\u53D6\u6D88\u6216\u91CD\u542F\u4E0D\u7EED\u8DD1\uFF0C\u989D\u5EA6\u4E0D\u81EA\u52A8\u91CD\u7F6E\u3002"),
    button("\u542F\u52A8\u4E00\u6B21 15 \u5206\u949F\u8BD5\u8DD1", () => act(async () => {
      await call("start", { revision: preflight.revision, accountUid: preflight.account.uid });
      setNotice("\u8BD5\u8DD1\u5DF2\u542F\u52A8\u3002");
    }), !preflight || dirty.current || preflight.revision !== status?.revision || !!status?.trialConsumed || !!status?.busy),
    (0, import_react.createElement)("button", { type: "button", disabled: !ctx || !status?.busy, onClick: () => {
      void call("stop").then(() => refresh()).catch((e) => setError(e instanceof Error ? e.message : "\u505C\u6B62\u5931\u8D25"));
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
