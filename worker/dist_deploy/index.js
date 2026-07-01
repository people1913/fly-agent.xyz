var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
if (!("__unenv__" in performance)) {
  const proto = Performance.prototype;
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key !== "constructor" && !(key in performance)) {
      const desc = Object.getOwnPropertyDescriptor(proto, key);
      if (desc) {
        Object.defineProperty(performance, key, desc);
      }
    }
  }
}
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  _channel,
  _debugEnd,
  _debugProcess,
  _disconnect,
  _events,
  _eventsCount,
  _exiting,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _handleQueue,
  _kill,
  _linkedBinding,
  _maxListeners,
  _pendingMessage,
  _preload_modules,
  _rawDebug,
  _send,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  assert: assert2,
  availableMemory,
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  disconnect,
  dlopen,
  domain,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  hrtime: hrtime3,
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  mainModule,
  memoryUsage,
  moduleLoadList,
  nextTick,
  off,
  on,
  once,
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// src/index.ts
var RolePermissions = {
  owner: ["agent:create", "agent:update", "verification:create", "verification:approve", "trust:recalculate", "audit:view", "policy:update", "policy:assign_role", "data:delete"],
  operator: ["agent:create", "agent:update", "verification:create", "audit:view"],
  verifier: ["verification:create", "verification:approve", "audit:view"],
  auditor: ["audit:view", "trust:recalculate"]
};
async function generateAttributionProof(env2, actionId) {
  const action = await env2.FLY_D1.prepare("SELECT * FROM actions WHERE id = ?").bind(actionId).first();
  if (!action) return { error: "action not found" };
  const agentId = action.agent_id;
  const metadata = JSON.parse(action.metadata || "{}");
  const agent = await env2.FLY_D1.prepare("SELECT * FROM agents WHERE id = ?").bind(agentId).first();
  const trustScore = agent ? agent.trust_score : 0;
  const uniqueUsers = await env2.FLY_D1.prepare("SELECT COUNT(DISTINCT user_id) as cnt FROM actions WHERE agent_id = ?").bind(agentId).first();
  const channelDiv = await env2.FLY_D1.prepare("SELECT COUNT(DISTINCT channel) as cnt FROM actions WHERE agent_id = ?").bind(agentId).first();
  const verifSources = await env2.FLY_D1.prepare("SELECT COUNT(DISTINCT verifier) as cnt FROM verifications v JOIN actions a ON v.action_id = a.id WHERE a.agent_id = ?").bind(agentId).first();
  const timeSpan = await env2.FLY_D1.prepare("SELECT CAST(julianday('now') - julianday(MIN(created_at)) AS INTEGER) as days FROM actions WHERE agent_id = ?").bind(agentId).first();
  const trustFactors = {
    unique_users: uniqueUsers?.cnt || 0,
    channel_diversity: channelDiv?.cnt || 0,
    verification_sources: verifSources?.cnt || 0,
    time_span_days: timeSpan?.days || 0
  };
  const verifications = await env2.FLY_D1.prepare("SELECT * FROM verifications WHERE action_id = ? ORDER BY created_at DESC").bind(actionId).all();
  const vList = verifications.results;
  const vCount = vList.length;
  const hasApproved = vList.some((v) => v.result === "approved" || v.result === "verified");
  const hasRejected = vList.some((v) => v.result === "rejected");
  const vStatus = hasApproved ? "verified" : hasRejected ? "rejected" : "unverified";
  const selfVerifBlocked = vList.some((v) => v.verifier === agentId);
  const signalQuality = metadata.signal_quality || "raw";
  const humanScore = metadata.human_score || 0;
  const botDetected = signalQuality === "bot";
  const auditEvents = await env2.FLY_D1.prepare("SELECT * FROM audit_events WHERE entity_type = 'action' AND entity_id = ? ORDER BY created_at ASC").bind(actionId).all();
  const aList = auditEvents.results;
  let auditChainValid = true;
  let latestAuditHash = "0";
  for (const evt of aList) {
    const hashInput = `${evt.prev_hash}${evt.event_id}${evt.entity_type}${evt.entity_id}${evt.action}${evt.actor_id}${evt.created_at}`;
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(hashInput));
    const expected = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (evt.event_hash !== expected) {
      auditChainValid = false;
      break;
    }
    latestAuditHash = evt.event_hash;
  }
  const blockers = [];
  if (trustScore < 60) blockers.push(`trust_score ${trustScore} < 60`);
  if (vStatus !== "verified") blockers.push(`verification status: ${vStatus}`);
  if (signalQuality === "bot") blockers.push("bot signal detected");
  if (!auditChainValid) blockers.push("audit chain integrity failed");
  if (selfVerifBlocked) blockers.push("self-verification detected");
  const settlementEligible = blockers.length === 0;
  const prevProofHash = await env2.FLY_KV.get("proof:latest_hash") || "0";
  const proofCore = {
    schema_version: "1.0",
    action_id: actionId,
    agent_id: agentId,
    trust_score: trustScore,
    trust_factors: trustFactors,
    verification: {
      status: vStatus,
      count: vCount,
      latest_id: vList.length > 0 ? vList[0].id : null,
      self_verification_blocked: selfVerifBlocked
    },
    signal: {
      quality: signalQuality,
      human_score: humanScore,
      bot_detected: botDetected
    },
    audit: {
      latest_hash: latestAuditHash,
      event_count: aList.length,
      chain_valid: auditChainValid
    },
    settlement: {
      eligible: settlementEligible,
      blockers
    },
    prev_proof_hash: prevProofHash
  };
  const proofHashInput = JSON.stringify(proofCore);
  const proofHashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(proofHashInput));
  const proofHash = Array.from(new Uint8Array(proofHashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const signature = await hmacSha256(env2.IP_SALT || "fly-attribution-salt-2026", proofHash);
  await env2.FLY_KV.put("proof:latest_hash", proofHash);
  return {
    ...proofCore,
    generated_at: (/* @__PURE__ */ new Date()).toISOString(),
    proof_id: `prf_${crypto.randomUUID()}`,
    integrity: {
      prev_proof_hash: prevProofHash,
      proof_hash: proofHash,
      signature
    }
  };
}
__name(generateAttributionProof, "generateAttributionProof");
var BotPatterns = [
  { pattern: /GPTBot/i, name: "GPTBot" },
  { pattern: /ChatGPT-User/i, name: "ChatGPT" },
  { pattern: /ClaudeBot/i, name: "ClaudeBot" },
  { pattern: /Googlebot/i, name: "Googlebot" },
  { pattern: /Bingbot/i, name: "Bingbot" },
  { pattern: /PerplexityBot/i, name: "PerplexityBot" },
  { pattern: /Bytespider/i, name: "Bytespider" },
  { pattern: /SemrushBot/i, name: "SemrushBot" },
  { pattern: /AhrefsBot/i, name: "AhrefsBot" }
];
function detectBot(userAgent) {
  for (const bot of BotPatterns) {
    if (bot.pattern.test(userAgent)) return { isBot: true, botName: bot.name };
  }
  return { isBot: false };
}
__name(detectBot, "detectBot");
function determineSignalQuality(humanScore, isBot) {
  if (isBot) return "bot";
  if (humanScore >= 50) return "verified";
  if (humanScore > 0) return "raw";
  return "unknown";
}
__name(determineSignalQuality, "determineSignalQuality");
async function hmacSha256(key, data) {
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hmacSha256, "hmacSha256");
async function hmacUserId(plain, salt) {
  return `hmac_${await hmacSha256(salt, plain)}`;
}
__name(hmacUserId, "hmacUserId");
async function verifyBearerToken(authHeader, env2) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return { ok: false, error: "missing Authorization header" };
  const token = authHeader.slice(7);
  const validKeys = env2.API_KEYS.split(",").map((k) => k.trim()).filter(Boolean);
  if (validKeys.includes(token)) return { ok: true, token };
  const authRow = await env2.FLY_D1.prepare("SELECT agent_id FROM agent_auth WHERE public_key = ? AND verified = 1").bind(token).first();
  if (authRow) return { ok: true, token, agentId: authRow.agent_id };
  return { ok: false, error: "invalid API key" };
}
__name(verifyBearerToken, "verifyBearerToken");
async function writeAuditEvent(env2, event) {
  const eventId = `aud_${crypto.randomUUID()}`;
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const prevEvent = await env2.FLY_D1.prepare("SELECT event_hash FROM audit_events ORDER BY created_at DESC LIMIT 1").first();
  const prevHash = prevEvent?.event_hash || "0";
  const hashInput = `${prevHash}${eventId}${event.entity_type}${event.entity_id}${event.action}${event.actor_id}${timestamp}`;
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(hashInput));
  const eventHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  await env2.FLY_D1.prepare(
    `INSERT INTO audit_events (event_id, request_id, entity_type, entity_id, action, actor_type, actor_id, actor_name, source, reason, before_data, after_data, prev_hash, event_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(eventId, event.request_id, event.entity_type, event.entity_id, event.action, event.actor_type, event.actor_id, event.actor_name, event.source, event.reason, event.before, event.after, prevHash, eventHash, timestamp).run();
  return eventId;
}
__name(writeAuditEvent, "writeAuditEvent");
async function getPrincipalRoles(env2, principalType, principalId) {
  const results = await env2.FLY_D1.prepare("SELECT DISTINCT role FROM role_assignments WHERE principal_type = ? AND principal_id = ?").bind(principalType, principalId).all();
  return results.results.map((r) => r.role);
}
__name(getPrincipalRoles, "getPrincipalRoles");
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Fly-Signature, X-Fly-Timestamp", ...headers }
  });
}
__name(json, "json");
async function recordRequestMetric(env2, status, latencyMs) {
  const minute = Math.floor(Date.now() / 6e4);
  const key = `metrics:m:${minute}`;
  try {
    const raw = await env2.FLY_KV.get(key);
    const data = raw ? JSON.parse(raw) : {
      total: 0,
      s2xx: 0,
      s3xx: 0,
      s4xx: 0,
      s5xx: 0,
      lat_sum: 0,
      lat_max: 0,
      lat_samples: []
    };
    data.total += 1;
    if (status >= 200 && status < 300) data.s2xx += 1;
    else if (status >= 300 && status < 400) data.s3xx += 1;
    else if (status >= 400 && status < 500) data.s4xx += 1;
    else if (status >= 500) data.s5xx += 1;
    data.lat_sum += latencyMs;
    if (latencyMs > data.lat_max) data.lat_max = latencyMs;
    if (data.lat_samples.length < 200) {
      data.lat_samples.push(latencyMs);
    } else {
      const idx = Math.floor(Math.random() * data.total);
      if (idx < 200) data.lat_samples[idx] = latencyMs;
    }
    await env2.FLY_KV.put(key, JSON.stringify(data), { expirationTtl: 600 });
  } catch (e) {
  }
}
__name(recordRequestMetric, "recordRequestMetric");
async function getAggregatedMetrics(env2, minutes) {
  try {
    const nowMinute = Math.floor(Date.now() / 6e4);
    let total = 0, s2xx = 0, s3xx = 0, s4xx = 0, s5xx = 0;
    let latSum = 0, latMax = 0;
    const allSamples = [];
    for (let i = 0; i < minutes; i++) {
      const key = `metrics:m:${nowMinute - i}`;
      const raw = await env2.FLY_KV.get(key);
      if (!raw) continue;
      const data = JSON.parse(raw);
      total += data.total || 0;
      s2xx += data.s2xx || 0;
      s3xx += data.s3xx || 0;
      s4xx += data.s4xx || 0;
      s5xx += data.s5xx || 0;
      latSum += data.lat_sum || 0;
      if ((data.lat_max || 0) > latMax) latMax = data.lat_max;
      if (data.lat_samples && data.lat_samples.length > 0) {
        allSamples.push(...data.lat_samples);
      }
    }
    if (total === 0) return null;
    allSamples.sort((a, b) => a - b);
    const p95Index = Math.ceil(allSamples.length * 0.95) - 1;
    const p95 = allSamples.length > 0 ? allSamples[Math.max(0, p95Index)] : 0;
    return {
      total,
      s2xx,
      s3xx,
      s4xx,
      s5xx,
      avg_ms: Math.round(latSum / total),
      max_ms: latMax,
      p95_ms: p95
    };
  } catch (e) {
    return null;
  }
}
__name(getAggregatedMetrics, "getAggregatedMetrics");
async function sendTelegramAlert(env2, level, message, details = {}) {
  if (!env2.TELEGRAM_BOT_TOKEN || !env2.TELEGRAM_CHAT_ID) return;
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const emoji = level === "P0" ? "\u{1F534}" : level === "P1" ? "\u{1F7E1}" : level === "TEST" ? "\u{1F9EA}" : "\u{1F535}";
  const detailLines = Object.entries(details).map(([k, v]) => `  ${k}: ${v}`).join("\n");
  const text = [
    `${emoji} Fly Attribution ${level} Alert`,
    ``,
    message,
    detailLines ? `
${detailLines}` : "",
    ``,
    `\u23F0 ${timestamp}`,
    `\u{1F4E6} v2.8.0`
  ].join("\n");
  try {
    await fetch(`https://api.telegram.org/bot${env2.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env2.TELEGRAM_CHAT_ID, text })
    });
  } catch (e) {
  }
}
__name(sendTelegramAlert, "sendTelegramAlert");
async function sendEmailAlert(env2, level, message, details = {}) {
  if (!env2.RESEND_API_KEY || !env2.ALERT_EMAIL_TO) return;
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const subject = `[Fly Attribution ${level}] ${message.slice(0, 80)}`;
  const textBody = [
    `Fly Attribution Worker \u544A\u8B66\u901A\u77E5`,
    `================================`,
    ``,
    `\u544A\u8B66\u7EA7\u522B: ${level}`,
    `\u65F6\u95F4: ${timestamp}`,
    `Worker\u7248\u672C: v2.8.0`,
    ``,
    `\u544A\u8B66\u5185\u5BB9:`,
    message,
    ``,
    `\u6307\u6807\u8BE6\u60C5:`,
    ...Object.entries(details).map(([k, v]) => `  ${k}: ${v}`),
    ``,
    `---`,
    `\u6B64\u90AE\u4EF6\u7531 Fly Attribution Worker v2.8.0 \u81EA\u52A8\u53D1\u9001`,
    `\u8BF7\u52FF\u76F4\u63A5\u56DE\u590D`
  ].join("\n");
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env2.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: env2.ALERT_EMAIL_TO,
        subject,
        text: textBody
      })
    });
  } catch (e) {
  }
}
__name(sendEmailAlert, "sendEmailAlert");
async function alertTrigger(env2, level, message, details = {}) {
  await Promise.allSettled([
    sendTelegramAlert(env2, level, message, details),
    sendEmailAlert(env2, level, message, details)
  ]);
}
__name(alertTrigger, "alertTrigger");
var ALERT_DEDUP_TTL = 300;
async function isAlertDeduped(env2, alertKey) {
  try {
    const existing = await env2.FLY_KV.get(`alert:${alertKey}`);
    return existing !== null;
  } catch {
    return false;
  }
}
__name(isAlertDeduped, "isAlertDeduped");
async function markAlertSent(env2, alertKey) {
  try {
    await env2.FLY_KV.put(`alert:${alertKey}`, (/* @__PURE__ */ new Date()).toISOString(), { expirationTtl: ALERT_DEDUP_TTL });
  } catch {
  }
}
__name(markAlertSent, "markAlertSent");
async function checkAlertConditions(env2) {
  try {
    const metrics = await getAggregatedMetrics(env2, 5);
    if (!metrics || metrics.total < 10) return;
    const errorRate = metrics.s5xx / metrics.total;
    if (errorRate > 0.1) {
      if (!await isAlertDeduped(env2, "5xx_critical")) {
        await markAlertSent(env2, "5xx_critical");
        await alertTrigger(
          env2,
          "P0",
          `5xx\u9519\u8BEF\u7387\u4E25\u91CD: ${(errorRate * 100).toFixed(1)}% (${metrics.s5xx}/${metrics.total})`,
          {
            "5xx_count": metrics.s5xx,
            "total_requests": metrics.total,
            "error_rate": `${(errorRate * 100).toFixed(1)}%`,
            "threshold": ">10%",
            "window": "5min"
          }
        );
      }
    } else if (errorRate > 0.03) {
      if (!await isAlertDeduped(env2, "5xx_warning")) {
        await markAlertSent(env2, "5xx_warning");
        await alertTrigger(
          env2,
          "P1",
          `5xx\u9519\u8BEF\u7387\u504F\u9AD8: ${(errorRate * 100).toFixed(1)}% (${metrics.s5xx}/${metrics.total})`,
          {
            "5xx_count": metrics.s5xx,
            "total_requests": metrics.total,
            "error_rate": `${(errorRate * 100).toFixed(1)}%`,
            "threshold": ">3%",
            "window": "5min"
          }
        );
      }
    }
    if (metrics.p95_ms > 3e3) {
      if (!await isAlertDeduped(env2, "p95_high")) {
        await markAlertSent(env2, "p95_high");
        await alertTrigger(
          env2,
          "P1",
          `P95\u5EF6\u8FDF\u8FC7\u9AD8: ${metrics.p95_ms}ms`,
          {
            "p95_ms": metrics.p95_ms,
            "avg_ms": metrics.avg_ms,
            "max_ms": metrics.max_ms,
            "threshold": ">3000ms",
            "window": "5min"
          }
        );
      }
    }
  } catch (e) {
  }
}
__name(checkAlertConditions, "checkAlertConditions");
var index_default = {
  async fetch(request, env2, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Fly-Signature, X-Fly-Timestamp" } });
    }
    const startTime = Date.now();
    const response = await (async () => {
      try {
        if (path === "/v1/health" && method === "GET") {
          let dbStatus = "ok";
          let kvStatus = "ok";
          try {
            await env2.FLY_D1.prepare("SELECT 1").first();
          } catch {
            dbStatus = "error";
          }
          try {
            await env2.FLY_KV.put("__health_check", "1", { expirationTtl: 60 });
            const v = await env2.FLY_KV.get("__health_check");
            if (v !== "1") kvStatus = "error";
          } catch {
            kvStatus = "error";
          }
          const status = dbStatus === "ok" && kvStatus === "ok" ? "ok" : "degraded";
          return json({ status, version: "2.9.0", layers: 8, protocols: 6, db: dbStatus, kv: kvStatus, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
        }
        if (path === "/v1/agents" && method === "POST") {
          const body = await request.json();
          const agentId = `agt_${crypto.randomUUID()}`;
          const apiKey = `fly_${crypto.randomUUID().replace(/-/g, "")}`;
          await env2.FLY_D1.prepare("INSERT INTO agents (id, owner_id, provider, runtime, version, trust_score, verification_level) VALUES (?, ?, ?, ?, ?, 50.0, 'L0')").bind(agentId, body.owner_id || "usr_owner", body.provider || body.name || "default", body.runtime || "cloudflare", body.version || "1.0").run();
          await env2.FLY_D1.prepare("INSERT INTO agent_auth (agent_id, public_key, signature, verified) VALUES (?, ?, ?, 1)").bind(agentId, apiKey, "auto-generated").run();
          await writeAuditEvent(env2, { request_id: `req_${crypto.randomUUID()}`, entity_type: "agent", entity_id: agentId, action: "created", actor_type: "user", actor_id: body.owner_id || "usr_owner", actor_name: body.owner_name || body.name || "owner", source: "api", reason: "agent_registered", before: "{}", after: JSON.stringify({ agent_id: agentId, provider: body.provider || body.name }) });
          return json({ success: true, agent_id: agentId, api_key: apiKey, verification_level: "L0", trust_score: 50 }, 201);
        }
        if (path.startsWith("/v1/agents/") && !path.includes("recalc-trust") && method === "GET") {
          const id = path.split("/v1/agents/")[1];
          const agent = await env2.FLY_D1.prepare("SELECT * FROM agents WHERE id = ?").bind(id).first();
          if (!agent) return json({ error: "not found" }, 404);
          const authRow = await env2.FLY_D1.prepare("SELECT * FROM agent_auth WHERE agent_id = ?").bind(id).first();
          return json({ agent, auth: authRow || null });
        }
        if (path === "/v1/action" && method === "POST") {
          const auth = await verifyBearerToken(request.headers.get("Authorization"), env2);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const body = await request.json();
          if (body.user_id) body.user_id = await hmacUserId(body.user_id, env2.IP_SALT || "fly-attribution-salt-2026");
          const validTypes = ["impression", "click", "consult", "booking", "deal"];
          if (!validTypes.includes(body.signal_type)) return json({ error: "invalid signal_type" }, 400);
          const validChannels = ["douyin", "xiaohongshu", "wechat", "meituan", "feishu", "geo", "direct"];
          if (!validChannels.includes(body.channel)) return json({ error: "invalid channel" }, 400);
          const existing = await env2.FLY_D1.prepare("SELECT id FROM actions WHERE user_id = ? AND agent_id = ? AND channel = ? AND signal_type = ? AND created_at > datetime('now', '-24 hours') LIMIT 1").bind(body.user_id ?? null, body.agent_id, body.channel, body.signal_type).first();
          if (existing) return json({ success: true, action_id: existing.id, dedup: true });
          const actionId = `act_${crypto.randomUUID()}`;
          const metadata = body.metadata || {};
          metadata.signal_quality = body.signal_quality || "raw";
          metadata.human_score = body.human_score || 0;
          await env2.FLY_D1.prepare("INSERT INTO actions (id, agent_id, channel, user_id, signal_type, short_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))").bind(actionId, body.agent_id, body.channel, body.user_id ?? null, body.signal_type, body.short_id || null, JSON.stringify(metadata)).run();
          await writeAuditEvent(env2, { request_id: `req_${crypto.randomUUID()}`, entity_type: "action", entity_id: actionId, action: "created", actor_type: "system", actor_id: "sys_api", actor_name: "api-gateway", source: "api", reason: "action_created", before: "{}", after: JSON.stringify({ action_id: actionId, signal_type: body.signal_type, signal_quality: metadata.signal_quality }) });
          return json({ success: true, action_id: actionId, signal_quality: metadata.signal_quality }, 201);
        }
        if (path.startsWith("/v1/status/") && method === "GET") {
          const actionId = path.split("/v1/status/")[1];
          const action = await env2.FLY_D1.prepare("SELECT * FROM actions WHERE id = ?").bind(actionId).first();
          if (!action) return json({ error: "not found" }, 404);
          const verifications = await env2.FLY_D1.prepare("SELECT * FROM verifications WHERE action_id = ? ORDER BY created_at DESC").bind(actionId).all();
          const attributions = await env2.FLY_D1.prepare("SELECT * FROM attributions WHERE action_id = ? ORDER BY created_at DESC").bind(actionId).all();
          return json({ action, verifications: verifications.results, attributions: attributions.results });
        }
        if (path.includes("/recalc-trust") && method === "POST") {
          const auth = await verifyBearerToken(request.headers.get("Authorization"), env2);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const agentId = path.split("/v1/agents/")[1]?.replace("/recalc-trust", "");
          const body = await request.json().catch(() => ({}));
          const callerType = body.caller_type || "human";
          const callerId = body.caller_id || "usr_owner";
          const roles = await getPrincipalRoles(env2, callerType, callerId);
          const hasTrustPerm = roles.some((r) => (RolePermissions[r] || []).includes("trust:recalculate"));
          if (!hasTrustPerm) return json({ error: "forbidden: no trust:recalculate permission", roles }, 403);
          const agent = await env2.FLY_D1.prepare("SELECT * FROM agents WHERE id = ?").bind(agentId).first();
          if (!agent) return json({ error: "agent not found" }, 404);
          const oldScore = agent.trust_score;
          const uniqueUsers = await env2.FLY_D1.prepare("SELECT COUNT(DISTINCT user_id) as cnt FROM actions WHERE agent_id = ?").bind(agentId).first();
          const channelDiv = await env2.FLY_D1.prepare("SELECT COUNT(DISTINCT channel) as cnt FROM actions WHERE agent_id = ?").bind(agentId).first();
          const verifSources = await env2.FLY_D1.prepare("SELECT COUNT(DISTINCT verifier) as cnt FROM verifications v JOIN actions a ON v.action_id = a.id WHERE a.agent_id = ?").bind(agentId).first();
          const timeSpan = await env2.FLY_D1.prepare("SELECT CAST(julianday('now') - julianday(MIN(created_at)) AS INTEGER) as days FROM actions WHERE agent_id = ?").bind(agentId).first();
          const u = uniqueUsers?.cnt || 0;
          const ch = channelDiv?.cnt || 0;
          const vs = verifSources?.cnt || 0;
          const ts = timeSpan?.days || 0;
          let newScore = 50 + Math.min(u * 2, 20) + Math.min(ch * 5, 10) + Math.min(vs * 5, 10) + Math.min(ts, 10);
          newScore = Math.min(newScore, 100);
          await env2.FLY_D1.prepare("UPDATE agents SET trust_score = ?, updated_at = datetime('now') WHERE id = ?").bind(newScore, agentId).run();
          await writeAuditEvent(env2, { request_id: `req_${crypto.randomUUID()}`, entity_type: "agent", entity_id: agentId, action: "updated", actor_type: callerType, actor_id: callerId, actor_name: body.caller_name || callerId, source: "api", reason: "trust_recalculated", before: JSON.stringify({ trust_score: oldScore }), after: JSON.stringify({ trust_score: newScore, factors: { unique_users: u, channel_diversity: ch, verification_sources: vs, time_span_days: ts } }) });
          return json({ agent_id: agentId, trust_score: { before: oldScore, after: newScore }, factors: { unique_users: u, channel_diversity: ch, verification_sources: vs, time_span_days: ts } });
        }
        if (path === "/v1/verifications" && method === "POST") {
          const auth = await verifyBearerToken(request.headers.get("Authorization"), env2);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const body = await request.json();
          if (body.verifier === body.subject || body.verifier_id === body.subject_id) {
            return json({ error: "verification rejected: verifier cannot be the same as subject (self-verification forbidden)" }, 403);
          }
          if (!body.verifier_id || body.verifier_id.length === 0) return json({ error: "verification rejected: verifier_id is required" }, 400);
          if (!body.evidence || !Array.isArray(body.evidence) || body.evidence.length === 0) return json({ error: "verification rejected: evidence is required" }, 400);
          const verifierType = body.verifier_type || "system";
          if (body.target_level && ["L2", "L3", "L4"].includes(body.target_level) && verifierType !== "audit" && verifierType !== "external") {
            return json({ error: "verification rejected: L2+ requires audit or external verifier" }, 403);
          }
          const verificationId = `vrf_${crypto.randomUUID()}`;
          await env2.FLY_D1.prepare("INSERT INTO verifications (id, action_id, verifier, result, confidence, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))").bind(verificationId, body.action_id, body.verifier, body.result || "pending", body.confidence || 0, JSON.stringify(body.evidence)).run();
          await writeAuditEvent(env2, { request_id: `req_${crypto.randomUUID()}`, entity_type: "verification", entity_id: verificationId, action: "created", actor_type: verifierType === "system" ? "system" : "user", actor_id: body.verifier_id, actor_name: body.verifier_name || body.verifier, source: "api", reason: "verification_created", before: "{}", after: JSON.stringify({ verification_id: verificationId, verifier: body.verifier, verifier_type: verifierType, result: body.result }) });
          return json({ success: true, verification_id: verificationId, verifier_type: verifierType, rules_checked: ["self_verification_blocked", "verifier_id_required", "evidence_required", "L2_source_check"] }, 201);
        }
        if (path.startsWith("/s/") && method === "GET") {
          const actionId = path.split("/s/")[1];
          const clientIP = (request.headers.get("CF-Connecting-IP") || "unknown").slice(0, 40);
          const userAgent = request.headers.get("User-Agent") || "";
          const rateLimitKey = `ratelimit:${clientIP}`;
          const currentCount = await env2.FLY_KV.get(rateLimitKey);
          if (currentCount && parseInt(currentCount) >= 10) return Response.redirect("https://fly-agent.xyz", 302);
          await env2.FLY_KV.put(rateLimitKey, (parseInt(currentCount || "0") + 1).toString(), { expirationTtl: 60 });
          const botResult = detectBot(userAgent);
          const signalQuality = determineSignalQuality(0, botResult.isBot);
          const action = await env2.FLY_D1.prepare("SELECT * FROM actions WHERE id = ? OR short_id = ?").bind(actionId, actionId).first();
          const ipHash = await hmacUserId(clientIP, env2.IP_SALT || "fly-attribution-salt-2026");
          await env2.FLY_D1.prepare("INSERT INTO actions (id, agent_id, channel, user_id, signal_type, short_id, metadata, created_at) VALUES (?, ?, ?, ?, 'click', ?, ?, datetime('now'))").bind(`act_${crypto.randomUUID()}`, action?.agent_id || "agt_system", action?.channel || "direct", ipHash, actionId, JSON.stringify({ referrer: request.headers.get("Referer") || "", ua: userAgent.slice(0, 200), signal_quality: signalQuality, bot_name: botResult.botName || null, human_score: 0 })).run();
          return Response.redirect("https://fly-agent.xyz", 302);
        }
        if (path === "/v1/signal/verify" && method === "POST") {
          const body = await request.json();
          const action = await env2.FLY_D1.prepare("SELECT * FROM actions WHERE id = ?").bind(body.action_id).first();
          if (!action) return json({ error: "not found" }, 404);
          let hs = 0;
          if (body.has_cookie) hs += 20;
          if (body.js_executed) hs += 30;
          if (body.stay_seconds >= 3) hs += 20;
          const nq = determineSignalQuality(hs, false);
          const om = JSON.parse(action.metadata || "{}");
          const nm = { ...om, signal_quality: nq, human_score: hs };
          await env2.FLY_D1.prepare("UPDATE actions SET metadata = ? WHERE id = ?").bind(JSON.stringify(nm), body.action_id).run();
          return json({ action_id: body.action_id, signal_quality: nq, human_score: hs });
        }
        if (path.startsWith("/v1/audit/") && method === "GET") {
          const parts = path.split("/v1/audit/")[1].split("/");
          const rawEntityType = parts[0];
          const entityId = parts[1];
          const entityTypeMap = { agents: "agent", actions: "action", verifications: "verification", role_assignments: "role_assignment", policies: "policy" };
          const entityType = entityTypeMap[rawEntityType] || rawEntityType.replace(/s$/, "");
          const events = await env2.FLY_D1.prepare("SELECT * FROM audit_events WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC").bind(entityType, entityId).all();
          let chainValid = true;
          for (const evt of events.results) {
            const hashInput = `${evt.prev_hash}${evt.event_id}${evt.entity_type}${evt.entity_id}${evt.action}${evt.actor_id}${evt.created_at}`;
            const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(hashInput));
            const expected = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
            if (evt.event_hash !== expected) {
              chainValid = false;
              break;
            }
          }
          return json({ entity_type: entityType, entity_id: entityId, events: events.results, chain_valid: chainValid, total_events: events.results.length });
        }
        if (path.startsWith("/v1/proof/") && method === "GET") {
          const actionId = path.split("/v1/proof/")[1];
          const proof = await generateAttributionProof(env2, actionId);
          if ("error" in proof) return json({ error: proof.error }, 404);
          return json(proof);
        }
        if (path === "/v1/governance/assign-role" && method === "POST") {
          const auth = await verifyBearerToken(request.headers.get("Authorization"), env2);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const body = await request.json();
          const callerRoles = await getPrincipalRoles(env2, "human", body.caller_id || "usr_owner");
          if (!callerRoles.includes("owner")) return json({ error: "only owner can assign roles" }, 403);
          const validRoles = ["owner", "operator", "verifier", "auditor"];
          const validTypes = ["human", "agent", "system"];
          if (!validRoles.includes(body.role)) return json({ error: "invalid role" }, 400);
          if (!validTypes.includes(body.principal_type)) return json({ error: "invalid principal_type" }, 400);
          const existing = await env2.FLY_D1.prepare("SELECT id FROM role_assignments WHERE principal_type = ? AND principal_id = ? AND role = ? AND resource_type = ?").bind(body.principal_type, body.principal_id, body.role, body.resource_type).first();
          if (existing) return json({ error: "role already assigned" }, 409);
          const assignmentId = `ra_${crypto.randomUUID()}`;
          await env2.FLY_D1.prepare("INSERT INTO role_assignments (id, principal_type, principal_id, role, resource_type, resource_id, granted_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))").bind(assignmentId, body.principal_type, body.principal_id, body.role, body.resource_type, body.resource_id || null, body.caller_id || "usr_owner").run();
          await writeAuditEvent(env2, { request_id: `req_${crypto.randomUUID()}`, entity_type: "role_assignment", entity_id: assignmentId, action: "created", actor_type: "user", actor_id: body.caller_id || "usr_owner", actor_name: body.caller_name || "owner", source: "api", reason: "role_assigned", before: "{}", after: JSON.stringify({ principal_type: body.principal_type, principal_id: body.principal_id, role: body.role }) });
          return json({ assignment_id: assignmentId, principal_type: body.principal_type, principal_id: body.principal_id, role: body.role, permissions: RolePermissions[body.role] }, 201);
        }
        if (path === "/v1/governance/check-permission" && method === "POST") {
          const body = await request.json();
          const roles = await getPrincipalRoles(env2, body.principal_type || "human", body.principal_id);
          if (roles.length === 0) return json({ allowed: false, reason: "no roles assigned (default deny)" }, 403);
          const permission2 = body.permission;
          const matching = roles.filter((r) => (RolePermissions[r] || []).includes(permission2));
          if (matching.length === 0) return json({ allowed: false, reason: `no role grants permission: ${permission2}`, roles }, 403);
          return json({ allowed: true, roles, matching_roles: matching, permission: permission2 });
        }
        if (path === "/v1/governance/update-policy" && method === "POST") {
          const auth = await verifyBearerToken(request.headers.get("Authorization"), env2);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const body = await request.json();
          const callerRoles = await getPrincipalRoles(env2, "human", body.caller_id || "usr_owner");
          if (!callerRoles.includes("owner")) return json({ error: "only owner can update policies" }, 403);
          const oldPolicy = await env2.FLY_D1.prepare("SELECT * FROM policies WHERE id = ?").bind(body.policy_id).first();
          if (!oldPolicy) return json({ error: "policy not found" }, 404);
          const newRules = body.rules || JSON.parse(oldPolicy.rules);
          await env2.FLY_D1.prepare("UPDATE policies SET name = ?, description = ?, rules = ?, updated_at = datetime('now') WHERE id = ?").bind(body.name || oldPolicy.name, body.description || oldPolicy.description, JSON.stringify(newRules), body.policy_id).run();
          await writeAuditEvent(env2, { request_id: `req_${crypto.randomUUID()}`, entity_type: "policy", entity_id: body.policy_id, action: "updated", actor_type: "user", actor_id: body.caller_id || "usr_owner", actor_name: body.caller_name || "owner", source: "api", reason: "policy_updated", before: oldPolicy.rules, after: JSON.stringify(newRules) });
          return json({ policy_id: body.policy_id, updated: true });
        }
        if (path === "/v1/db/query" && method === "GET") {
          const type = url.searchParams.get("type");
          const limit = parseInt(url.searchParams.get("limit") || "10");
          if (type === "actions") {
            const r = await env2.FLY_D1.prepare("SELECT * FROM actions ORDER BY created_at DESC LIMIT ?").bind(limit).all();
            return json(r);
          }
          if (type === "agents") {
            const r = await env2.FLY_D1.prepare("SELECT * FROM agents ORDER BY created_at DESC LIMIT ?").bind(limit).all();
            return json(r);
          }
          if (type === "verifications") {
            const r = await env2.FLY_D1.prepare("SELECT * FROM verifications ORDER BY created_at DESC LIMIT ?").bind(limit).all();
            return json(r);
          }
          if (type === "audit") {
            const r = await env2.FLY_D1.prepare("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?").bind(limit).all();
            return json(r);
          }
          if (type === "roles") {
            const r = await env2.FLY_D1.prepare("SELECT * FROM role_assignments ORDER BY created_at DESC LIMIT ?").bind(limit).all();
            return json(r);
          }
          if (type === "policies") {
            const r = await env2.FLY_D1.prepare("SELECT * FROM policies").all();
            return json(r);
          }
          return json({ error: "unknown type. Use: actions, agents, verifications, audit, roles, policies" }, 400);
        }
        if (path === "/v1/admin/metrics" && method === "GET") {
          const auth = await verifyBearerToken(request.headers.get("Authorization"), env2);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const minutes = Math.min(parseInt(url.searchParams.get("minutes") || "5"), 60);
          const metrics = await getAggregatedMetrics(env2, minutes);
          if (!metrics) {
            return json({ requests: { total: 0, "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 }, latency: { avg_ms: 0, max_ms: 0, p95_ms: 0 }, window_minutes: minutes });
          }
          return json({
            requests: { total: metrics.total, "2xx": metrics.s2xx, "3xx": metrics.s3xx, "4xx": metrics.s4xx, "5xx": metrics.s5xx },
            latency: { avg_ms: metrics.avg_ms, max_ms: metrics.max_ms, p95_ms: metrics.p95_ms },
            window_minutes: minutes
          });
        }
        if (path === "/v1/admin/alert/test" && method === "POST") {
          const auth = await verifyBearerToken(request.headers.get("Authorization"), env2);
          if (!auth.ok) return json({ error: auth.error }, 401);
          await alertTrigger(env2, "TEST", "\u544A\u8B66\u6D4B\u8BD5 - \u8FD9\u662F\u4E00\u4E2A\u6D4B\u8BD5\u544A\u8B66", { trigger: "manual", version: "v2.8.0" });
          return json({ success: true, message: "Test alert sent to all configured channels", channels: { telegram: !!(env2.TELEGRAM_BOT_TOKEN && env2.TELEGRAM_CHAT_ID), email: !!(env2.RESEND_API_KEY && env2.ALERT_EMAIL_TO) } });
        }
        if (path === "/v1/admin/backup" && method === "POST") {
          const auth = await verifyBearerToken(request.headers.get("Authorization"), env2);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const backupId = `bak_${crypto.randomUUID()}`;
          const timestamp = (/* @__PURE__ */ new Date()).toISOString();
          const tables = ["agents", "actions", "verifications", "audit_events", "role_assignments", "policies"];
          let totalRecords = 0;
          const tableCounts = {};
          for (const table3 of tables) {
            try {
              const result = await env2.FLY_D1.prepare(`SELECT COUNT(*) as cnt FROM ${table3}`).first();
              const count3 = result?.cnt || 0;
              tableCounts[table3] = count3;
              totalRecords += count3;
            } catch {
              tableCounts[table3] = -1;
            }
          }
          const backup = { backup_id: backupId, timestamp, total_records: totalRecords, tables: tableCounts };
          const historyKey = "backups:history";
          const historyRaw = await env2.FLY_KV.get(historyKey);
          const history = historyRaw ? JSON.parse(historyRaw) : [];
          history.push(backup);
          if (history.length > 30) history.splice(0, history.length - 30);
          await env2.FLY_KV.put(historyKey, JSON.stringify(history));
          return json({ success: true, ...backup });
        }
        if (path === "/v1/admin/backup" && method === "GET") {
          const auth = await verifyBearerToken(request.headers.get("Authorization"), env2);
          if (!auth.ok) return json({ error: auth.error }, 401);
          const historyKey = "backups:history";
          const historyRaw = await env2.FLY_KV.get(historyKey);
          const backups = historyRaw ? JSON.parse(historyRaw) : [];
          return json({ success: true, backups });
        }
        return json({ error: "not found", hint: "try /v1/health" }, 404);
      } catch (err) {
        const errMsg = (err?.message || "").toLowerCase();
        if (errMsg.includes("d1") || errMsg.includes("database") || errMsg.includes("sql")) {
          ctx.waitUntil(alertTrigger(env2, "P0", "D1\u67E5\u8BE2\u5931\u8D25", { error: err.message, path }).catch(() => {
          }));
        } else if (errMsg.includes("kv") || errMsg.includes("namespace")) {
          ctx.waitUntil(alertTrigger(env2, "P0", "KV\u64CD\u4F5C\u5931\u8D25", { error: err.message, path }).catch(() => {
          }));
        }
        return json({ error: err.message || "internal server error" }, 500);
      }
    })();
    ctx.waitUntil((async () => {
      try {
        const latency = Date.now() - startTime;
        await recordRequestMetric(env2, response.status, latency);
        await checkAlertConditions(env2);
      } catch (e) {
      }
    })());
    return response;
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
