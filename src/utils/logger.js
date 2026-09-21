import { CONFIG } from "../config.js";

const STORAGE_KEY = "ktms_frontend_logs";
const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

function settings() {
  return CONFIG.LOGGING || {};
}

function currentLevel() {
  const configured = String(settings().level || "info").toLowerCase();
  return LEVELS[configured] === undefined ? LEVELS.info : LEVELS[configured];
}

function canLog(level) {
  return Boolean(settings().enabled) && LEVELS[level] <= currentLevel();
}

function safeValue(value) {
  if (value === undefined || value === null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return "[unserializable]";
  }
}

function readLogs() {
  if (!settings().persist) return [];
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLog(entry) {
  if (!settings().persist) return;
  try {
    const logs = readLogs();
    logs.push(entry);
    const maxEntries = Math.max(20, Number(settings().maxEntries) || 200);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(-maxEntries)));
  } catch {
    // Diagnostics must never break KTMS application functionality.
  }
}

function emit(level, event, details = {}) {
  if (!canLog(level)) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...safeValue(details)
  };

  writeLog(entry);

  const method =
    level === "error" ? "error" :
    level === "warn" ? "warn" :
    level === "debug" ? "debug" :
    "log";

  console[method]("[KTMS]", entry);
}

export function createTraceId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `ktms-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function logError(event, details = {}) {
  emit("error", event, details);
}

export function logWarn(event, details = {}) {
  emit("warn", event, details);
}

export function logInfo(event, details = {}) {
  emit("info", event, details);
}

export function logDebug(event, details = {}) {
  emit("debug", event, details);
}

export function logTrace(event, details = {}) {
  emit("trace", event, details);
}

export function getLogs() {
  return readLogs();
}

export function clearLogs() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
  }
}

export function setLogLevel(level) {
  const normalized = String(level || "").toLowerCase();
  if (LEVELS[normalized] === undefined) {
    throw new Error("Invalid KTMS diagnostic log level.");
  }

  CONFIG.LOGGING.level = normalized;
}

globalThis.KTMSDiagnostics = Object.freeze({
  getLogs,
  clearLogs,
  setLevel: setLogLevel
});
